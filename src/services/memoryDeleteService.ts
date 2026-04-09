// src/services/memoryDeleteService.ts
import { supabase } from '@/lib/supabase';

export type DeleteRequestStatus = 'pending' | 'rejected' | 'approved' | 'expired' | 'deleted';

export interface MemoryDeleteRequest {
    id: string;
    requesterId: string;
    otherUserId: string;
    sourceId: string;
    status: DeleteRequestStatus;
    createdAt: string;
    expiresAt: string;
    resolvedAt: string | null;
}

// ─── Extract storage path from a signed or public URL ────────────
const extractStoragePath = (uri: string): { bucket: string; path: string } | null => {
    const signedMatch = uri.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(\?|$)/);
    if (signedMatch) return { bucket: signedMatch[1], path: signedMatch[2] };
    const publicMatch = uri.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(\?|$)/);
    if (publicMatch) return { bucket: publicMatch[1], path: publicMatch[2] };
    return null;
};

// ─── Delete file from Supabase Storage ───────────────────────────
const deleteFromStorage = async (uri: string | null | undefined): Promise<void> => {
    if (!uri) return;
    const parsed = extractStoragePath(uri);
    if (!parsed) return;
    const { error } = await supabase.storage
        .from(parsed.bucket)
        .remove([parsed.path]);
    if (error) console.warn('[MemoryDelete] Storage deletion failed:', error.message);
};

// ─── Initiate a delete request ────────────────────────────────────
// Returns: 'requested' | 'auto_deleted' | 'already_pending' | 'error'
export const initiateDeleteRequest = async (
    sourceId: string,
    otherUserId: string,
    mediaUri: string | null | undefined,
): Promise<'requested' | 'auto_deleted' | 'already_pending' | 'error'> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const myId = sessionData?.session?.user?.id;
    if (!myId) return 'error';

    // ── Check if the OTHER user already has a pending request for this source
    const { data: counterRequest } = await supabase
        .from('memory_delete_requests')
        .select('id, status')
        .eq('source_id', sourceId)
        .eq('requester_id', otherUserId)
        .eq('status', 'pending')
        .maybeSingle();

    // ── RACE CONDITION: Both users want to delete → auto-delete immediately
    if (counterRequest) {
        await deleteFromStorage(mediaUri);
        const { error } = await supabase.rpc('execute_memory_deletion', {
            p_source_id: sourceId,
        });
        if (error) {
            console.error('[MemoryDelete] Auto-deletion failed:', error);
            return 'error';
        }
        return 'auto_deleted';
    }

    // ── Check if I already have a pending request (prevent duplicates)
    const { data: myExisting } = await supabase
        .from('memory_delete_requests')
        .select('id, status')
        .eq('source_id', sourceId)
        .eq('requester_id', myId)
        .eq('status', 'pending')
        .maybeSingle();

    if (myExisting) return 'already_pending';

    // ── Insert new delete request
    const { error } = await supabase
        .from('memory_delete_requests')
        .insert({
            requester_id: myId,
            other_user_id: otherUserId,
            source_id: sourceId,
        });

    if (error) {
        console.error('[MemoryDelete] Failed to create delete request:', error);
        return 'error';
    }

    return 'requested';
};

// ─── Respond to a delete request (as the recipient) ──────────────
export const respondToDeleteRequest = async (
    requestId: string,
    response: 'approved' | 'rejected',
    mediaUri: string | null | undefined,
    sourceId: string,
): Promise<boolean> => {
    const { error } = await supabase
        .from('memory_delete_requests')
        .update({ status: response, resolved_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('status', 'pending'); // Safety: only update if still pending

    if (error) {
        console.error('[MemoryDelete] Failed to respond:', error);
        return false;
    }

    // If approved → execute full deletion
    if (response === 'approved') {
        await deleteFromStorage(mediaUri);
        const { error: delError } = await supabase.rpc('execute_memory_deletion', {
            p_source_id: sourceId,
        });
        if (delError) {
            console.error('[MemoryDelete] Deletion after approval failed:', delError);
            return false;
        }
    }

    return true;
};

// ─── Fetch pending requests sent TO me (I need to respond) ───────
export const fetchIncomingDeleteRequests = async (): Promise<MemoryDeleteRequest[]> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const myId = sessionData?.session?.user?.id;
    if (!myId) return [];

    const { data, error } = await supabase
        .from('memory_delete_requests')
        .select('*')
        .eq('other_user_id', myId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

    if (error) return [];
    return (data ?? []).map(r => ({
        id: r.id,
        requesterId: r.requester_id,
        otherUserId: r.other_user_id,
        sourceId: r.source_id,
        status: r.status,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        resolvedAt: r.resolved_at,
    }));
};

// ─── Check if a specific memory has a pending delete request ─────
export const getDeleteRequestForMemory = async (
    sourceId: string,
): Promise<MemoryDeleteRequest | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const myId = sessionData?.session?.user?.id;
    if (!myId) return null;

    const { data } = await supabase
        .from('memory_delete_requests')
        .select('*')
        .eq('source_id', sourceId)
        .in('status', ['pending'])
        .or(`requester_id.eq.${myId},other_user_id.eq.${myId}`)
        .maybeSingle();

    if (!data) return null;
    return {
        id: data.id,
        requesterId: data.requester_id,
        otherUserId: data.other_user_id,
        sourceId: data.source_id,
        status: data.status,
        createdAt: data.created_at,
        expiresAt: data.expires_at,
        resolvedAt: data.resolved_at,
    };
};