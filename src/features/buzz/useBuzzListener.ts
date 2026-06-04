import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { startBuzz, stopBuzz } from '@/services/hapticService';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';

export interface BuzzState {
    isBuzzing: boolean;
    buzzerName: string;
    buzzerAvatar: string | null;
    senderId: string;
    isMissedBuzz: boolean;
}

export function useBuzzListener(currentUserId: string | undefined): BuzzState | null {
    const [buzzState, setBuzzState] = useState<BuzzState | null>(null);
    const realtimeFiredRef = useRef(false);
    const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const triggerMissedBuzz = async (senderId: string, senderName: string) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

        // Set initial state immediately using metadata in the payload
        setBuzzState({
            isBuzzing: true,
            buzzerName: senderName || 'Someone',
            buzzerAvatar: null,
            senderId,
            isMissedBuzz: true,
        });

        // Resolve avatar asynchronously in the background
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('profile_picture')
                .eq('id', senderId)
                .single();
            
            if (profile?.profile_picture) {
                setBuzzState(prev => {
                    if (prev && prev.senderId === senderId && prev.isMissedBuzz) {
                        return {
                            ...prev,
                            buzzerAvatar: profile.profile_picture,
                        };
                    }
                    return prev;
                });
            }
        } catch {
            // Ignore avatar fetch errors
        }

        if (dismissTimeoutRef.current) {
            clearTimeout(dismissTimeoutRef.current);
        }
        dismissTimeoutRef.current = setTimeout(() => {
            setBuzzState(null);
        }, 2500);
    };

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
                            isMissedBuzz: false,
                        });
                    } else if (state === 'stop') {
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

    // ── 2. Push notification listeners — background / killed state path ────────
    useEffect(() => {
        if (!currentUserId) return;

        // Foreground push received (backup when realtime is slow)
        const receivedSub = Notifications.addNotificationReceivedListener(
            async (notification) => {
                const data = notification.request.content.data as Record<string, any>;
                if (data?.type !== 'buzz') return;

                const senderId = data?.senderId as string;
                const senderName = data?.senderName as string;
                if (!senderId) return;

                if (realtimeFiredRef.current) {
                    return;
                }

                // Foreground pushes still play a short missed vibration notification
                triggerMissedBuzz(senderId, senderName);
            }
        );

        // Notification tap — app opened from background/killed state
        const responseSub = Notifications.addNotificationResponseReceivedListener(
            (response) => {
                const data = response.notification.request.content.data as Record<string, any>;
                if (data?.type !== 'buzz') return;

                const senderId = data?.senderId as string;
                const senderName = data?.senderName as string;
                if (!senderId) return;

                triggerMissedBuzz(senderId, senderName);
            }
        );

        // Cold start recovery
        Notifications.getLastNotificationResponseAsync().then((response) => {
            if (!response) return;
            const data = response.notification.request.content.data as Record<string, any>;
            if (data?.type !== 'buzz') return;

            const senderId = data?.senderId as string;
            const senderName = data?.senderName as string;
            if (senderId) {
                setTimeout(() => {
                    triggerMissedBuzz(senderId, senderName);
                }, 900);
            }
        });

        return () => {
            receivedSub.remove();
            responseSub.remove();
            if (dismissTimeoutRef.current) {
                clearTimeout(dismissTimeoutRef.current);
            }
        };
    }, [currentUserId]);

    return buzzState;
}