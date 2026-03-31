// src/services/partnerService.ts
import { supabase } from '@/lib/supabase';

export interface PartnerRequest {
    id: string;
    senderId: string;
    receiverId: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: string;
    senderName: string;
    senderProfilePicture: string;
    senderUniqueUserId: string;
}

// ── Check if a user already has a partner ─────────────────────────────────────
export async function checkIfAlreadyPartnered(userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('profiles')
        .select('partner_id')
        .eq('id', userId)
        .single();
    if (error) throw error;
    return data?.partner_id != null;
}

// ── Send a partner request ────────────────────────────────────────────────────
export async function sendPartnerRequest(
    senderId: string,
    receiverId: string
): Promise<void> {
    const { error } = await supabase
        .from('partner_requests')
        .upsert(
            { sender_id: senderId, receiver_id: receiverId, status: 'pending' },
            { onConflict: 'sender_id,receiver_id' }
        );
    if (error) throw error;
}

// ── Get all incoming pending requests for a user ──────────────────────────────
export async function getIncomingPartnerRequests(
    myId: string
): Promise<PartnerRequest[]> {
    const { data, error } = await supabase
        .from('partner_requests')
        .select(`
            id,
            sender_id,
            receiver_id,
            status,
            created_at,
            sender:sender_id (
                name,
                profile_picture,
                unique_user_id
            )
        `)
        .eq('receiver_id', myId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((r: any) => ({
        id: r.id,
        senderId: r.sender_id,
        receiverId: r.receiver_id,
        status: r.status,
        createdAt: r.created_at,
        senderName: r.sender?.name ?? '',
        senderProfilePicture: r.sender?.profile_picture ?? '',
        senderUniqueUserId: r.sender?.unique_user_id ?? '',
    }));
}

// ── Get the outgoing request from senderId to receiverId (if any) ─────────────
export async function getOutgoingRequestTo(
    senderId: string,
    receiverId: string
): Promise<PartnerRequest | null> {
    const { data, error } = await supabase
        .from('partner_requests')
        .select('id, sender_id, receiver_id, status, created_at')
        .eq('sender_id', senderId)
        .eq('receiver_id', receiverId)
        .eq('status', 'pending')
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
        id: data.id,
        senderId: data.sender_id,
        receiverId: data.receiver_id,
        status: data.status as 'pending',
        createdAt: data.created_at,
        senderName: '',
        senderProfilePicture: '',
        senderUniqueUserId: '',
    };
}

// ── Accept a partner request via SECURITY DEFINER RPC ────────────────────────
// Atomic: validates ownership, marks accepted, sets both partner_ids in one
// Postgres transaction. Replaces the old 3-step client-side write.
export async function acceptPartnerRequest(
    requestId: string,
    senderId: string,
    receiverId: string
): Promise<void> {
    const { error } = await supabase.rpc('accept_partner_request', {
        p_request_id: requestId,
        p_sender_id: senderId,
        p_receiver_id: receiverId,
    });
    if (error) throw error;
}

// ── Decline a partner request ─────────────────────────────────────────────────
export async function declinePartnerRequest(requestId: string): Promise<void> {
    const { error } = await supabase
        .from('partner_requests')
        .update({ status: 'declined' })
        .eq('id', requestId);
    if (error) throw error;
}

// ── Remove partner via SECURITY DEFINER RPC ───────────────────────────────────
// Atomic: validates both users are actually partners, clears both partner_ids,
// and cleans up the partner_requests row — all in one Postgres transaction.
export async function removePartner(
    myId: string,
    partnerId: string
): Promise<void> {
    const { error } = await supabase.rpc('remove_partner', {
        p_my_id: myId,
        p_partner_id: partnerId,
    });
    if (error) throw error;
}