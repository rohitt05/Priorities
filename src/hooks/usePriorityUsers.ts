// src/hooks/usePriorityUsers.ts
// Fetches the current user's real priority list from Supabase.
// Returns Profile[] with real UUIDs — safe to pass to timelineService.

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getMyPriorities } from '@/services/priorityService';
import { Profile } from '@/types/domain';

export function usePriorityUsers() {
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setError(null);

                const { data: sessionData } = await supabase.auth.getSession();
                const myId = sessionData?.session?.user?.id;
                if (!myId) {
                    setUsers([]);
                    return;
                }

                const priorities = await getMyPriorities(myId);

                if (!cancelled) {
                    // Map to Profile shape — getMyPriorities already returns the right fields
                    const profiles: Profile[] = priorities.map((p: any) => ({
                        id: p.id,
                        uniqueUserId: p.uniqueUserId,
                        name: p.name,
                        profilePicture: p.profilePicture,
                        dominantColor: p.dominantColor ?? '#b6e3f4',
                        relationship: p.relationship ?? undefined,
                        partnerId: p.partnerId ?? undefined,
                    }));
                    setUsers(profiles);
                }
            } catch (err: any) {
                if (!cancelled) {
                    console.error('[usePriorityUsers] error:', err.message);
                    setError(err.message);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

    return { users, loading, error };
}
