// src/services/priorityService.ts
import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/database.types';
import { Profile } from '@/types/domain';


export type PriorityRow = Tables<'priorities'>;
export type PriorityRequestRow = Tables<'priority_requests'>;


// 24hr window in milliseconds
const TEMP_WINDOW_MS = 24 * 60 * 60 * 1000;


// ─── GET MY PRIORITY LIST ──────────────────────────────────
export async function getMyPriorities(userId: string) {
    const { data, error } = await supabase
        .from('priorities')
        .select(`
            id,
            rank,
            is_pinned,
            created_at,
            priority_user_id,
            profiles!priorities_priority_user_id_fkey (
                id,
                unique_user_id,
                name,
                profile_picture,
                dominant_color,
                relationship,
                partner_id
            )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => ({
        ...(row.profiles as any),
        rank: row.rank,
        pinned: row.is_pinned,
        priorityRowId: row.id,
    }));
}


// ─── SEND PRIORITY REQUEST ─────────────────────────────────
export async function sendPriorityRequest(
    senderId: string,
    receiverId: string
): Promise<PriorityRequestRow> {
    const { data, error } = await supabase
        .from('priority_requests')
        .insert({ sender_id: senderId, receiver_id: receiverId })
        .select()
        .single();
    if (error) throw error;
    return data;
}


// ─── GET PENDING REQUESTS (for B's notification screen) ───
export async function getIncomingRequests(userId: string) {
    const { data, error } = await supabase
        .from('priority_requests')
        .select(`
            id,
            status,
            created_at,
            sender_id,
            profiles!priority_requests_sender_id_fkey (
                id,
                unique_user_id,
                name,
                profile_picture,
                dominant_color
            )
        `)
        .eq('receiver_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
}


// ─── GET OUTGOING PENDING REQUESTS (for A's temp carousel) ─
export async function getOutgoingPendingRequests(userId: string) {
    const { data, error } = await supabase
        .from('priority_requests')
        .select(`
            id,
            status,
            created_at,
            receiver_id,
            profiles!priority_requests_receiver_id_fkey (
                id,
                unique_user_id,
                name,
                profile_picture,
                dominant_color
            )
        `)
        .eq('sender_id', userId)
        .eq('status', 'pending');

    if (error) throw error;

    const all = data ?? [];
    return all.filter((req) => {
        const sentAt = new Date(req.created_at).getTime();
        return Date.now() - sentAt < TEMP_WINDOW_MS;
    });
}


// ─── ACCEPT REQUEST ────────────────────────────────────────
// Uses SECURITY DEFINER RPC to insert both priority rows
export async function acceptPriorityRequest(
    requestId: string,
    senderId: string,
    receiverId: string
) {
    const { error } = await (supabase.rpc as any)('accept_priority_request', {
        p_request_id: requestId,
        p_sender_id: senderId,
        p_receiver_id: receiverId,
    });
    if (error) throw error;
}

// ─── DECLINE REQUEST ───────────────────────────────────────
export async function declinePriorityRequest(requestId: string) {
    const { error } = await supabase
        .from('priority_requests')
        .update({ status: 'declined' })
        .eq('id', requestId);
    if (error) throw error;
}


// ─── UPDATE RANK ───────────────────────────────────────────
export async function bumpRank(userId: string, priorityUserId: string) {
    const { data, error: fetchError } = await supabase
        .from('priorities')
        .select('id, rank')
        .eq('user_id', userId)
        .eq('priority_user_id', priorityUserId)
        .single();
    if (fetchError) throw fetchError;

    const newRank = Math.max(1, (data.rank ?? 9) - 1);

    const { error: updateError } = await supabase
        .from('priorities')
        .update({ rank: newRank })
        .eq('id', data.id);
    if (updateError) throw updateError;
}


// ─── PIN / UNPIN ────────────────────────────────────────────
export async function setPinned(userId: string, priorityUserId: string | null) {
    const { error: clearError } = await supabase
        .from('priorities')
        .update({ is_pinned: false })
        .eq('user_id', userId);
    if (clearError) throw clearError;

    if (!priorityUserId) return;

    const { error: pinError } = await supabase
        .from('priorities')
        .update({ is_pinned: true })
        .eq('user_id', userId)
        .eq('priority_user_id', priorityUserId);
    if (pinError) throw pinError;
}


// ─── REMOVE PRIORITY (UNFRIEND) ────────────────────────────
// Uses SECURITY DEFINER RPC to delete both directions
export async function removePriority(userId: string, priorityUserId: string) {
    const { error } = await (supabase.rpc as any)('remove_priority', {
        p_user_id: userId,
        p_priority_user_id: priorityUserId,
    });
    if (error) throw error;
}


// ─── BLOCK USER ────────────────────────────────────────────
// Uses SECURITY DEFINER RPC to block, remove priorities, cancel requests
export async function blockUser(blockerId: string, blockedId: string) {
    const { error } = await (supabase.rpc as any)('block_user', {
        p_blocker_id: blockerId,
        p_blocked_id: blockedId,
    });
    if (error) throw error;
}


// ─── CHECK MUTUAL PRIORITY ─────────────────────────────────
export async function areMutualPriorities(
    userA: string,
    userB: string
): Promise<boolean> {
    const { data, error } = await supabase
        .from('priorities')
        .select('id')
        .eq('user_id', userA)
        .eq('priority_user_id', userB)
        .maybeSingle();
    if (error) throw error;
    return data !== null;
}
