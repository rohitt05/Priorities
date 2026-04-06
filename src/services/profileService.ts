// src/services/profileService.ts
import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/database.types';

export type ProfileRow = Tables<'profiles'>;

// ─── GET MY PROFILE ────────────────────────────────────────
export async function getMyProfile(userId: string): Promise<ProfileRow> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) throw error;
    return data;
}

// ─── GET ANY PROFILE BY ID ─────────────────────────────────
export async function getProfileById(id: string): Promise<ProfileRow> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
}

// ─── GET PROFILE BY @HANDLE ────────────────────────────────
export async function getProfileByHandle(handle: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('unique_user_id', handle)
        .maybeSingle();
    if (error) throw error;
    return data;
}

// ─── UPDATE PROFILE ────────────────────────────────────────
export async function updateProfile(
    userId: string,
    updates: Partial<Pick<ProfileRow,
        'name' |
        'profile_picture' |
        'dominant_color' |
        'phone_number' |
        'birthday' |
        'gender' |
        'relationship' |
        'partner_id'
    >>
) {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ─── CHECK IF @HANDLE IS AVAILABLE ────────────────────────
// Queries the unique_user_id column (which has a UNIQUE constraint in DB).
// Returns true if the handle is free, false if already taken.
// ✅ Switch from a direct table query → RPC call
// ─── CHECK IF @HANDLE IS AVAILABLE ────────────────────────
export async function isHandleAvailable(handle: string): Promise<boolean> {
    const { data, error } = await (supabase as any)
        .rpc('is_handle_available', { handle: handle.trim() });
    if (error) {
        console.warn('Handle check error:', error.message);
        return false;
    }
    return data === true;
}

// ─── SEARCH USERS BY NAME OR HANDLE ───────────────────────
export async function searchUsers(
    query: string,
    excludeIds: string[] = []
): Promise<ProfileRow[]> {
    let q = supabase
        .from('profiles')
        .select('*')
        .or(`name.ilike.%${query}%,unique_user_id.ilike.%${query}%`)
        .limit(20);

    if (excludeIds.length > 0) {
        q = q.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
}

// ─── UPLOAD PROFILE PICTURE ───────────────────────────────
// Uses timestamp in filename — always a unique fresh INSERT.
// No upsert, no delete, no UPDATE policy needed ever.
export async function uploadProfilePicture(
    fallbackUserId: string,
    localUri: string
): Promise<string> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[AUTH SESSION CHECK ID]', session?.user?.id);

        const realAuthId = session?.user?.id;
        if (!realAuthId) {
            throw new Error('No active auth session. Cannot upload profile picture.');
        }

        // Timestamp in filename = always unique = always fresh INSERT
        const path = `${realAuthId}/avatar_${Date.now()}.jpg`;

        console.log('[uploadProfilePicture] Fetching file...');
        const response = await fetch(localUri);
        const arrayBuffer = await response.arrayBuffer();

        console.log('[uploadProfilePicture] Uploading...');
        const { error: uploadError } = await supabase.storage
            .from('profile-pictures')
            .upload(path, arrayBuffer, {
                contentType: 'image/jpeg',
                upsert: false,
            });

        if (uploadError) {
            console.error('[uploadProfilePicture] Upload Error:', uploadError);
            throw uploadError;
        }

        console.log('[uploadProfilePicture] Upload successful!');
        const { data } = supabase.storage
            .from('profile-pictures')
            .getPublicUrl(path);

        // Cache-bust so React Native re-fetches the new image immediately
        const publicUrlWithCacheBust = `${data.publicUrl}?t=${Date.now()}`;
        console.log('[uploadProfilePicture] Public URL:', publicUrlWithCacheBust);

        await updateProfile(realAuthId, { profile_picture: publicUrlWithCacheBust });

        console.log('[uploadProfilePicture] Profile updated successfully!');
        return publicUrlWithCacheBust;
    } catch (err) {
        console.error('[uploadProfilePicture] Exception:', err);
        throw err;
    }
}