// src/features/calls/useIncomingCall.ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { usePrioritiesRefresh } from '@/contexts/PrioritiesRefreshContext';

export function useIncomingCall(currentUserId: string | undefined) {
    useEffect(() => {
        if (!currentUserId) return;

        console.log('[useIncomingCall] Setting up realtime listener for:', currentUserId);

        const channel = supabase
            .channel(`incoming-calls-${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'call_sessions',
                    filter: `callee_id=eq.${currentUserId}`,
                },
                async (payload) => {
                    console.log('[useIncomingCall] New call session received:', payload.new);
                    const session = payload.new;

                    if (session.status === 'ringing') {
                        // Fetch caller name from profiles
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('name, profile_picture')
                            .eq('id', session.caller_id)
                            .single();

                        router.push({
                            pathname: '/incoming-call' as any,
                            params: {
                                callerId: session.caller_id,
                                callerName: profile?.name || 'Someone',
                                callerPic: profile?.profile_picture || '',
                                sessionId: session.id,
                                roomName: session.room_name,
                                callType: session.call_type
                            }
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId]);
}
