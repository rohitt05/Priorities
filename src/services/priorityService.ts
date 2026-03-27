// src/services/priorityService.ts
import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/database.types';
import { Profile } from '@/types/domain';

export type PriorityRow = Tables<'priorities'>;
export type PriorityRequestRow = Tables<'priority_requests'>;

// 24hr window in milliseconds
const TEMP_WINDOW_MS = 24 * 60 * 60 * 1000;

// ─── GET MY PRIORITY LIST ──────────────────────────────────
// Returns full profile objects for each priority person,
// joined with rank + is_pinned from priorities table.
// Ordered by created_at ASC so carousel order = add order
// (rank is just the badge number shown on profile screen).
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

    // Flatten into PriorityUserWithPost shape
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
// Returns ALL pending requests sent TO this user.
// Never expires — B sees them even after weeks.
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
// Returns pending requests sent BY this user.
// App filters out ones older than 24hrs for carousel display
// but keeps them here — we need created_at to check.
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

    // Only return ones within 24hr window for temp carousel display
    const withinWindow = all.filter((req) => {
        const sentAt = new Date(req.created_at).getTime();
        return Date.now() - sentAt < TEMP_WINDOW_MS;
    });

    return withinWindow;
}

// ─── ACCEPT REQUEST ────────────────────────────────────────
// 1. Updates request status to 'accepted'
// 2. Creates TWO rows in priorities:
//    (user_id: B, priority_user_id: A)
//    (user_id: A, priority_user_id: B)
// Both start at rank 9 (lowest — newest addition)
export async function acceptPriorityRequest(
    requestId: string,
    senderId: string,           // A (who sent the req)
    receiverId: string          // B (who is accepting)
) {
    // Step 1: Mark request as accepted
    const { error: updateError } = await supabase
        .from('priority_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);
    if (updateError) throw updateError;

    // Step 2: Create both priority rows
    const { error: insertError } = await supabase
        .from('priorities')
        .insert([
            { user_id: receiverId, priority_user_id: senderId, rank: 9 },
            { user_id: senderId, priority_user_id: receiverId, rank: 9 },
        ]);
    if (insertError) throw insertError;
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
// Called after each message sent to that person.
// Decreases rank by 1 (min 1). So 9→8→7...→1
export async function bumpRank(userId: string, priorityUserId: string) {
    // First get current rank
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
// Only one person pinned at a time.
// First clears all pins for this user, then sets the new one.
export async function setPinned(userId: string, priorityUserId: string | null) {
    // Clear all pins first
    const { error: clearError } = await supabase
        .from('priorities')
        .update({ is_pinned: false })
        .eq('user_id', userId);
    if (clearError) throw clearError;

    if (!priorityUserId) return;    // just unpinning, we're done

    const { error: pinError } = await supabase
        .from('priorities')
        .update({ is_pinned: true })
        .eq('user_id', userId)
        .eq('priority_user_id', priorityUserId);
    if (pinError) throw pinError;
}

// ─── REMOVE PRIORITY (UNFRIEND) ────────────────────────────
// Deletes both direction rows from priorities table
export async function removePriority(userId: string, priorityUserId: string) {
    const { error } = await supabase
        .from('priorities')
        .delete()
        .or(
            `and(user_id.eq.${userId},priority_user_id.eq.${priorityUserId}),` +
            `and(user_id.eq.${priorityUserId},priority_user_id.eq.${userId})`
        );
    if (error) throw error;
}

// ─── BLOCK USER ────────────────────────────────────────────
// 1. Inserts into blocked_users
// 2. Removes both priority rows
// 3. Cancels any pending requests between them
export async function blockUser(blockerId: string, blockedId: string) {
    // Insert block row
    const { error: blockError } = await supabase
        .from('blocked_users')
        .insert({ blocker_id: blockerId, blocked_id: blockedId });
    if (blockError) throw blockError;

    // Remove from priorities (both directions)
    await removePriority(blockerId, blockedId);

    // Cancel any pending requests between them
    const { error: reqError } = await supabase
        .from('priority_requests')
        .update({ status: 'declined' })
        .or(
            `and(sender_id.eq.${blockerId},receiver_id.eq.${blockedId}),` +
            `and(sender_id.eq.${blockedId},receiver_id.eq.${blockerId})`
        );
    if (reqError) throw reqError;
}

// ─── CHECK MUTUAL PRIORITY ─────────────────────────────────
// Quick check — are these two people mutual priorities?
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
