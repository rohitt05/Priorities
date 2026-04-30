// src/features/buzz/useBuzzListener.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { startBuzz, stopBuzz } from '@/services/hapticService';

export interface BuzzState {
    isBuzzing: boolean;
    buzzerName: string;
    buzzerAvatar: string | null;
    senderId: string;
}

/**
 * Global receiver hook.
 * Now also returns the buzzer's identity so the UI can show
 * who is buzzing the current user in real-time.
 *
 * Returns null when no buzz is active.
 */
export function useBuzzListener(currentUserId: string | undefined): BuzzState | null {
    const [buzzState, setBuzzState] = useState<BuzzState | null>(null);

    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase
            .channel(`user-signals-${currentUserId}`)
            .on(
                'broadcast',
                { event: 'buzz' },
                async (payload) => {
                    const { state, senderId } = payload.payload as {
                        state: 'start' | 'stop';
                        senderId: string;
                    };

                    if (state === 'start') {
                        startBuzz();

                        // Fetch the sender's profile to show their identity
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('name, profile_picture')
                            .eq('id', senderId)
                            .single();

                        setBuzzState({
                            isBuzzing: true,
                            buzzerName: profile?.name ?? 'Someone',
                            buzzerAvatar: profile?.profile_picture ?? null,
                            senderId,
                        });
                    } else if (state === 'stop') {
                        stopBuzz();
                        setBuzzState(null);
                    }
                }
            )
            .subscribe();

        return () => {
            stopBuzz();
            setBuzzState(null);
            supabase.removeChannel(channel);
        };
    }, [currentUserId]);

    return buzzState;
}
