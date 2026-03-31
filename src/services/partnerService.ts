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

async function setPartnerIdForUser(
    userId: string,
    partnerId: string | null
): Promise<void> {
    const { error } = await supabase
        .from('profiles')
        .update({ partner_id: partnerId })
        .eq('id', userId);
    if (error) throw error;
}

// ── Check if a user already has a partner ─────────────────────────────────────
// Returns true if userId.partner_id is non-null in DB
export async function checkIfAlreadyPartnered(userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('profiles')
        .select('partner_id')
        .eq('id', userId)
        .single();
    if (error) throw error;
    return data?.partner_id != null;
}

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

export async function acceptPartnerRequest(
    requestId: string,
    senderId: string,
    receiverId: string
): Promise<void> {
    const { error: updateErr } = await supabase
        .from('partner_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);
    if (updateErr) throw updateErr;

    await Promise.all([
        setPartnerIdForUser(senderId, receiverId),
        setPartnerIdForUser(receiverId, senderId),
    ]);
}

export async function declinePartnerRequest(requestId: string): Promise<void> {
    const { error } = await supabase
        .from('partner_requests')
        .update({ status: 'declined' })
        .eq('id', requestId);
    if (error) throw error;
}

export async function removePartner(
    myId: string,
    partnerId: string
): Promise<void> {
    await Promise.all([
        setPartnerIdForUser(myId, null),
        setPartnerIdForUser(partnerId, null),
    ]);
}