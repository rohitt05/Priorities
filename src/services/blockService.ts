// src/services/blockService.ts
import { supabase } from '@/lib/supabase';

export interface BlockedUser {
    id: string;          // blocked_users row id
    blockedId: string;   // UUID of the blocked profile
    name: string;
    uniqueUserId: string;
    profilePicture: string | null;
}

// ── Get all users blocked by the current user ─────────────────────────────────
export async function getBlockedUsers(): Promise<BlockedUser[]> {
    const { data, error } = await supabase
        .from('blocked_users')
        .select(`
            id,
            blocked_id,
            blocked:blocked_id (
                name,
                unique_user_id,
                profile_picture
            )
        `)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
        id: row.id,
        blockedId: row.blocked_id,
        name: row.blocked?.name ?? '',
        uniqueUserId: row.blocked?.unique_user_id ?? '',
        profilePicture: row.blocked?.profile_picture ?? null,
    }));
}

// ── Unblock a user — deletes the row (RLS ensures only blocker can do this) ───
export async function unblockUser(blockedUserId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error('Not authenticated');

    const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', session.user.id)
        .eq('blocked_id', blockedUserId);

    if (error) throw error;
}