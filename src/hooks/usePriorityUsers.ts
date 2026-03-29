// src/hooks/usePriorityUsers.ts
// Fetches the current user's real priority list from Supabase.
// Returns Profile[] with real UUIDs — safe to pass to timelineService.

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getMyPriorities } from '@/services/priorityService';
import { Profile } from '@/types/domain';
import { usePrioritiesRefresh } from '@/contexts/PrioritiesRefreshContext';

export interface ExtendedProfile extends Profile {
    isPriority: boolean;
}

export function usePriorityUsers() {
    const { refreshKey } = usePrioritiesRefresh();
    const [users, setUsers] = useState<ExtendedProfile[]>([]);
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

                // 1. Fetch real priorities
                const priorities = await getMyPriorities(myId);

                // 2. Fetch anyone who has sent us a message OR we sent to, but who isn't a priority
                const { data: recentMessages } = await supabase
                    .from('messages')
                    .select('sender_id, receiver_id')
                    .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
                    .order('sent_at', { ascending: false })
                    .limit(50);

                const interactionIds = new Set<string>();
                (recentMessages ?? []).forEach(m => {
                    if (m.sender_id !== myId) interactionIds.add(m.sender_id);
                    if (m.receiver_id !== myId) interactionIds.add(m.receiver_id);
                });

                const priorityIds = new Set(priorities.map(p => p.id));
                const missingIds = Array.from(interactionIds).filter(id => !priorityIds.has(id));

                let missingProfiles: any[] = [];
                if (missingIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, unique_user_id, name, profile_picture, dominant_color, partner_id')
                        .in('id', missingIds);
                    missingProfiles = profiles ?? [];
                }

                if (!cancelled) {
                    const priorityProfiles: ExtendedProfile[] = priorities.map((p: any) => ({
                        id: p.id,
                        uniqueUserId: p.uniqueUserId,
                        name: p.name,
                        profilePicture: p.profilePicture,
                        dominantColor: p.dominantColor ?? '#b6e3f4',
                        relationship: p.relationship ?? undefined,
                        partnerId: p.partnerId ?? undefined,
                        isPriority: true,
                    }));

                    const otherProfiles: ExtendedProfile[] = missingProfiles.map((p: any) => ({
                        id: p.id,
                        uniqueUserId: p.unique_user_id,
                        name: p.name,
                        profilePicture: p.profile_picture,
                        dominantColor: p.dominant_color ?? '#b6e3f4',
                        isPriority: false,
                    }));

                    // Combine and deduplicate
                    setUsers([...priorityProfiles, ...otherProfiles]);
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
    }, [refreshKey]);

    return { users, loading, error };
}
