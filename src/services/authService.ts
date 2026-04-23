// src/services/authService.ts
import { supabase } from '@/lib/supabase';

// ─── SIGN UP ───────────────────────────────────────────────
// Creates auth.users row → trigger auto-creates profiles row
export async function signUp(
    email: string,
    password: string,
    name: string,
    uniqueUserId: string,
    dominantColor: string,
    gender: string,
    profilePicture: string
) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name,
                unique_user_id: uniqueUserId,
                dominant_color: dominantColor,
                gender,
                profile_picture: profilePicture,
            },
        },
    });
    if (error) throw error;
    return data;
}

// ─── SIGN IN ───────────────────────────────────────────────
export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;
    return data;
}

// ─── SIGN OUT ──────────────────────────────────────────────
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

// ─── GET CURRENT SESSION ───────────────────────────────────
export async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
}

// ─── GET CURRENT USER ID ───────────────────────────────────
export async function getCurrentUserId(): Promise<string> {
    const session = await getSession();
    if (!session?.user?.id) throw new Error('Not authenticated');
    return session.user.id;
}

// ─── LISTEN TO AUTH STATE CHANGES ─────────────────────────
export function onAuthStateChange(
    callback: (event: string, session: any) => void
) {
    return supabase.auth.onAuthStateChange(callback);
}

// ─── VERIFY CURRENT PASSWORD ───────────────────────────────
export async function verifyCurrentPassword(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Current password is incorrect.');
}

// ─── CHANGE PASSWORD ───────────────────────────────────────
export async function changePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
}

// ─── DELETE ACCOUNT ────────────────────────────────────────
// Calls the delete-account Edge Function (service role).
// Order of operations:
//   1. Edge Function verifies JWT
//   2. Calls delete_account() SQL RPC → collects storage paths,
//      clears PII, deletes own rows, returns paths
//   3. Edge Function deletes all storage files (3 buckets)
//   4. Edge Function calls admin.deleteUser() → cascades DB cleanup
//   5. We sign out locally → auth listener navigates to auth screen
// ─── DELETE ACCOUNT ────────────────────────────────────────
export async function deleteAccount(): Promise<void> {
    const session = await getSession();
    if (!session?.access_token) throw new Error('Not authenticated');

    // ✅ No custom headers — invoke() auto-attaches the session JWT
    const { data, error } = await supabase.functions.invoke('delete-account');

    if (error) throw new Error(error.message || 'Account deletion failed.');

    await supabase.auth.signOut();
}

// ─── CHECK IF EMAIL IS AVAILABLE ──────────────────────────
// Queries the auth.users via a SECURITY DEFINER RPC.
// Returns true if free, false if already taken.
export async function isEmailAvailable(email: string): Promise<boolean> {
    const { data, error } = await (supabase as any)
        .rpc('is_email_available', { p_email: email.trim().toLowerCase() });
    
    if (error) {
        console.warn('Email check error:', error.message);
        // Fallback to true to not block users if RPC is missing, 
        // though signup will still fail on DB level if taken.
        return true; 
    }
    return data === true;
}