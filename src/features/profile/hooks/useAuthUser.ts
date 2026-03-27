// src/hooks/useAuthUser.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useAuthUser() {
    const [authId, setAuthId] = useState<string | null>(null);

    useEffect(() => {
        // Get session immediately on mount
        supabase.auth.getSession().then(({ data }) => {
            setAuthId(data.session?.user?.id ?? null);
        });

        // Keep in sync if auth state changes (logout, token refresh etc)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setAuthId(session?.user?.id ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    return authId; // null while loading, UUID string once session resolves
}
