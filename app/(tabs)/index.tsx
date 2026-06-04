import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import { COLORS } from '@/theme/theme';

import PriorityList from '@/features/partners/components/PriorityList';
import { PriorityUserWithPost } from '@/types/domain';
import { useBackground } from '@/contexts/BackgroundContext';
import FilmSwiperBlob from '@/features/film-my-day/components/FilmSwiperBlob';
import FilmMyDay from '@/features/film-my-day/components/FilmMyDayContent';
import EmptyPriorityState from '@/features/partners/components/EmptyPriorityState';
import { useRouter } from 'expo-router';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import { getMyPriorities, getOutgoingPendingRequests } from '@/services/priorityService';
import { getCurrentUserId } from '@/services/authService';
import { usePrioritiesRefresh } from '@/contexts/PrioritiesRefreshContext';
import { supabase } from '@/lib/supabase';
import { startBuzz, stopBuzz } from '@/services/hapticService';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { RealtimeChannel } from '@supabase/supabase-js';


export default function HomeScreen() {
    const router = useRouter();
    const [priorities, setPriorities] = useState<PriorityUserWithPost[]>([]);
    const [activeUser, setActiveUser] = useState<PriorityUserWithPost | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const scrollX = useSharedValue(0);
    const { handleColorChange } = useBackground();
    const { refreshKey } = usePrioritiesRefresh();
    const [myUniqueId, setMyUniqueId] = useState<string>('');
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserName, setCurrentUserName] = useState<string>('');

    const isBuzzing = useRef(false);
    const buzzChannelRef = useRef<RealtimeChannel | null>(null);

    const loadPrioritiesData = async (userId: string) => {
        try {
            const [real, pending] = await Promise.all([
                getMyPriorities(userId),
                getOutgoingPendingRequests(userId),
            ]);

            const pendingUsers: PriorityUserWithPost[] = pending.map((req: any) => ({
                id: req.id,
                uniqueUserId: req.uniqueUserId,
                name: req.name,
                profilePicture: req.profilePicture,
                dominantColor: req.dominantColor ?? COLORS.primary,
                isPending: true,
            }));

            const realIds = new Set((real as any[]).map((r: any) => r.id));
            const filteredPending = pendingUsers.filter(p => !realIds.has(p.id));

            setPriorities([...(real as PriorityUserWithPost[]), ...filteredPending]);
        } catch (error) {
            console.error('Error loading priorities:', error);
        } finally {
            setIsLoaded(true);
        }
    };

    useEffect(() => {
        const init = async () => {
            const userId = await getCurrentUserId().catch(() => null);
            if (!userId) return;
            setCurrentUserId(userId);

            const [profileResult] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('unique_user_id, name')
                    .eq('id', userId)
                    .single(),
                loadPrioritiesData(userId)
            ]);

            if (profileResult.data) {
                setMyUniqueId(profileResult.data.unique_user_id ?? '');
                setCurrentUserName(profileResult.data.name ?? '');
            }
        };
        init();
    }, [refreshKey]);

    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase
            .channel(`realtime_outgoing_requests_${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'priority_requests',
                    filter: `sender_id=eq.${currentUserId}`,
                },
                (payload) => {
                    if (payload.new && payload.new.status === 'accepted') {
                        loadPrioritiesData(currentUserId);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId]);

    useEffect(() => {
        if (buzzChannelRef.current) {
            supabase.removeChannel(buzzChannelRef.current);
            buzzChannelRef.current = null;
        }

        if (!activeUser) return;

        const ch = supabase
            .channel(`user-signals-${activeUser.id}`)
            .subscribe();

        buzzChannelRef.current = ch;

        return () => {
            supabase.removeChannel(ch);
            buzzChannelRef.current = null;
        };
    }, [activeUser?.id]);

    const sendBuzzStart = async () => {
        if (!activeUser || !currentUserId || isBuzzing.current) return;
        isBuzzing.current = true;

        startBuzz();

        if (buzzChannelRef.current) {
            await buzzChannelRef.current.send({
                type: 'broadcast',
                event: 'buzz',
                payload: {
                    state: 'start',
                    senderId: currentUserId,
                    senderName: currentUserName,
                },
            });
        }

        try {
            const { data: receiverProfile } = await supabase
                .from('profiles')
                .select('expo_push_token')
                .eq('id', activeUser.id)
                .single();

            if (!receiverProfile?.expo_push_token) {
                return;
            }

            await supabase.functions.invoke('send-push', {
                body: {
                    type: 'buzz',
                    receiverId: activeUser.id,
                    senderId: currentUserId,
                    senderName: currentUserName,
                },
            });
        } catch (e) {
            // push fallback failed silently
        }
    };

    const sendBuzzStop = async () => {
        if (!isBuzzing.current) return;
        isBuzzing.current = false;

        stopBuzz();

        if (!activeUser || !currentUserId) return;

        if (buzzChannelRef.current) {
            await buzzChannelRef.current.send({
                type: 'broadcast',
                event: 'buzz',
                payload: { state: 'stop', senderId: currentUserId },
            });
        }
    };

    const hasPriorities = priorities.length > 0;

    const buzzGesture = Gesture.LongPress()
        .minDuration(150)
        .onStart(() => {
            runOnJS(sendBuzzStart)();
        })
        .onFinalize(() => {
            runOnJS(sendBuzzStop)();
        });

    return (
        <GestureDetector gesture={buzzGesture}>
            <View style={styles.container}>
                <View style={styles.mainContent}>
                    <PriorityList
                        priorities={priorities}
                        onColorChange={handleColorChange}
                        onActiveUserChange={setActiveUser}
                        scrollX={scrollX}
                        onBuzzStart={sendBuzzStart}
                        onBuzzStop={sendBuzzStop}
                    />
                </View>

            {hasPriorities && (
                <FilmSwiperBlob
                    activeUser={activeUser}
                    scrollX={scrollX}
                    onReveal={() => {
                        if (activeUser) {
                            router.push({
                                pathname: '/UserFilms',
                                params: {
                                    userId: activeUser.id,
                                    userName: activeUser.name,
                                    dominantColor: activeUser.dominantColor,
                                    isPending: activeUser.isPending ? 'true' : 'false',
                                }
                            });
                        }
                    }}
                />
            )}

            {isLoaded && !hasPriorities && (
                <EmptyPriorityState
                    myUniqueId={myUniqueId}
                    onColorChange={handleColorChange}
                />
            )}

            <FilmMyDay />
            <StatusBar style="auto" />
        </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    mainContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 100,
        width: '100%',
    },
});