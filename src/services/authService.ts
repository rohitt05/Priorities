// src/services/authService.ts
import { supabase } from '@/lib/supabase';

// ─── SIGN UP ───────────────────────────────────────────────
// Creates auth.users row → trigger auto-creates profiles row
export async function signUp(
    email: string,
    password: string,
    name: string,
    uniqueUserId: string,       // @handle chosen on signup screen
    dominantColor: string       // randomly picked from PALETTE on signup screen
) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name,
                unique_user_id: uniqueUserId,
                dominant_color: dominantColor,
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
// Use this in your root _layout.tsx to redirect on login/logout
export function onAuthStateChange(
    callback: (event: string, session: any) => void
) {
    return supabase.auth.onAuthStateChange(callback);
}
