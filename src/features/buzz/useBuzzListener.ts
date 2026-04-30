// src/features/buzz/useBuzzListener.ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { startBuzz, stopBuzz } from '@/services/hapticService';

/**
 * Global receiver hook — subscribes to the current user's personal
 * signal channel so haptic buzzes are received regardless of which
 * screen the user is currently on.
 *
 * Registered at the root layout level (app/_layout.tsx) alongside
 * useIncomingCall for the same reason.
 *
 * Channel pattern: user-signals-${currentUserId}
 * Event:           'buzz'
 * Payload:         { state: 'start' | 'stop', senderId: string }
 */
export function useBuzzListener(currentUserId: string | undefined): void {
    useEffect(() => {
        if (!currentUserId) return;

        console.log('[useBuzzListener] Subscribing to user-signals-' + currentUserId);

        const channel = supabase
            .channel(`user-signals-${currentUserId}`)
            .on(
                'broadcast',
                { event: 'buzz' },
                (payload) => {
                    const { state, senderId } = payload.payload as {
                        state: 'start' | 'stop';
                        senderId: string;
                    };

                    console.log(`[useBuzzListener] Buzz ${state} from ${senderId}`);

                    if (state === 'start') {
                        startBuzz();
                    } else if (state === 'stop') {
                        stopBuzz();
                    }
                }
            )
            .subscribe();

        return () => {
            // Cancel any ongoing vibration when the hook unmounts / user logs out
            stopBuzz();
            supabase.removeChannel(channel);
        };
    }, [currentUserId]);
}
