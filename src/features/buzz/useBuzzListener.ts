// src/features/buzz/useBuzzListener.ts
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { startBuzz, stopBuzz } from '@/services/hapticService';
import * as Notifications from 'expo-notifications';

export interface BuzzState {
    isBuzzing: boolean;
    buzzerName: string;
    buzzerAvatar: string | null;
    senderId: string;
}

/**
 * Global receiver hook — handles buzz from TWO sources:
 *
 * 1. Supabase Realtime broadcast — works when app is FOREGROUNDED.
 * 2. Expo push notification — background / killed state path.
 *
 * iOS note: Custom vibration patterns from push notifications are NOT supported
 * on iOS. The default system vibration fires instead. This is an OS limitation —
 * there is no way to play a custom pattern from a background push on iOS without
 * the Critical Alerts entitlement (requires explicit Apple approval).
 */
export function useBuzzListener(currentUserId: string | undefined): BuzzState | null {
    const [buzzState, setBuzzState] = useState<BuzzState | null>(null);

    // FIX 2 — Synchronous ref that is set to true the moment Realtime fires.
    // Checked BEFORE any async await in the push listener, so there is zero
    // race condition — no more stale setState closure capturing old state.
    const realtimeFiredRef = useRef(false);

    // FIX 3 — Auto-stop timeout matches the actual vibration pattern duration.
    // Pattern: [0,100,50,100,50,100,50,600,100,600] = 1760ms total.
    // +200ms buffer = 1960ms. Old value was 3000ms which felt disconnected
    // from the physical vibration ending 1.2s earlier.
    const BUZZ_PATTERN_DURATION_MS = 1960;

    // ── 1. Supabase Realtime — foreground path ────────────────────────────────
    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase
            .channel(`user-signals-${currentUserId}`)
            .on(
                'broadcast',
                { event: 'buzz' },
                async (payload) => {
                    const { state, senderId, senderName, senderAvatar } = payload.payload as {
                        state: 'start' | 'stop';
                        senderId: string;
                        senderName?: string;
                        senderAvatar?: string | null;
                    };

                    if (state === 'start') {
                        // FIX 2 — Set ref synchronously BEFORE any await so the
                        // push listener sees it immediately, no async delay.
                        realtimeFiredRef.current = true;

                        startBuzz();

                        let name = senderName ?? 'Someone';
                        let avatar = senderAvatar ?? null;

                        if (!senderName) {
                            const { data: profile } = await supabase
                                .from('profiles')
                                .select('name, profile_picture')
                                .eq('id', senderId)
                                .single();
                            name = profile?.name ?? 'Someone';
                            avatar = profile?.profile_picture ?? null;
                        }

                        setBuzzState({
                            isBuzzing: true,
                            buzzerName: name,
                            buzzerAvatar: avatar,
                            senderId,
                        });
                    } else if (state === 'stop') {
                        // FIX 2 — Reset ref so next buzz can go through push path
                        realtimeFiredRef.current = false;
                        stopBuzz();
                        setBuzzState(null);
                    }
                }
            )
            .subscribe();

        return () => {
            realtimeFiredRef.current = false;
            stopBuzz();
            setBuzzState(null);
            supabase.removeChannel(channel);
        };
    }, [currentUserId]);

    // ── 2. Push notification listener — background / killed state path ────────
    useEffect(() => {
        if (!currentUserId) return;

        // Foreground push received (app is open)
        const receivedSub = Notifications.addNotificationReceivedListener(
            async (notification) => {
                const data = notification.request.content.data as Record<string, any>;
                if (data?.type !== 'buzz') return;

                const senderId = data?.senderId as string;
                if (!senderId) return;

                // FIX 2 — Check ref SYNCHRONOUSLY before any await.
                // If Realtime already handled this buzz, bail out immediately.
                if (realtimeFiredRef.current) {
                    console.log('[Buzz] Realtime already fired — skipping push duplicate');
                    return;
                }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('name, profile_picture')
                    .eq('id', senderId)
                    .single();

                // FIX 2 — Re-check after the await in case Realtime fired during
                // the DB round-trip (rare but possible on slow connections).
                if (realtimeFiredRef.current) {
                    console.log('[Buzz] Realtime fired during DB fetch — skipping push duplicate');
                    return;
                }

                startBuzz();

                // FIX 3 — Stop after actual pattern duration, not arbitrary 3000ms
                setTimeout(() => {
                    realtimeFiredRef.current = false;
                    stopBuzz();
                    setBuzzState(null);
                }, BUZZ_PATTERN_DURATION_MS);

                setBuzzState({
                    isBuzzing: true,
                    buzzerName: profile?.name ?? 'Someone',
                    buzzerAvatar: profile?.profile_picture ?? null,
                    senderId,
                });
            }
        );

        // Notification tap — app opened from background or killed state
        const responseSub = Notifications.addNotificationResponseReceivedListener(
            async (response) => {
                const data = response.notification.request.content.data as Record<string, any>;
                if (data?.type !== 'buzz') return;

                const senderId = data?.senderId as string;
                if (!senderId) return;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('name, profile_picture')
                    .eq('id', senderId)
                    .single();

                startBuzz();
                setBuzzState({
                    isBuzzing: true,
                    buzzerName: profile?.name ?? 'Someone',
                    buzzerAvatar: profile?.profile_picture ?? null,
                    senderId,
                });

                // FIX 3 — Use pattern duration instead of 3000ms
                setTimeout(() => {
                    realtimeFiredRef.current = false;
                    stopBuzz();
                    setBuzzState(null);
                }, BUZZ_PATTERN_DURATION_MS);
            }
        );

        return () => {
            receivedSub.remove();
            responseSub.remove();
        };
    }, [currentUserId]);

    return buzzState;
} 