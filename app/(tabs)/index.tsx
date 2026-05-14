import { StyleSheet, View, Text, Share, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import { COLORS, FONTS, FONT_SIZES } from '@/theme/theme';
import FloatingSearch from '@/components/ui/FloatingSearch';
import PriorityList from '@/features/partners/components/PriorityList';
import { PriorityUserWithPost } from '@/types/domain';
import { useBackground } from '@/contexts/BackgroundContext';
import FilmSwiperBlob from '@/features/film-my-day/components/FilmSwiperBlob';
import FilmMyDay from '@/features/film-my-day/components/FilmMyDayContent';
import { useRouter } from 'expo-router';
import { useSharedValue } from 'react-native-reanimated';
import { getMyPriorities, getOutgoingPendingRequests } from '@/services/priorityService';
import { getCurrentUserId } from '@/services/authService';
import { usePrioritiesRefresh } from '@/contexts/PrioritiesRefreshContext';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { startBuzz, stopBuzz } from '@/services/hapticService';
import { runOnJS } from 'react-native-reanimated';
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

    // Tracks whether buzz is currently active to avoid duplicate stop signals
    const isBuzzing = useRef(false);

    // FIX 1 — Persistent channel ref: subscribed ONCE per activeUser so that
    // .send() is always called on an already-joined channel. Supabase Realtime
    // requires .subscribe() before .send() — creating a fresh channel on every
    // buzz and immediately calling .send() was the root cause of silent failures.
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

            // FIX #9: Parallelize profile fetch and priorities data load.
            const [profileResult] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('unique_user_id, name')
                    .eq('id', userId)
                    .single(),
                loadPrioritiesData(userId)
            ]);

            if (profileResult.data) {
                setMyUniqueId(profileResult.data.unique_user_id);
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

    // FIX 1 — Subscribe the sender-side broadcast channel ONCE when activeUser
    // changes. Tear down the old channel first so we never have stale subs.
    // The channel stays alive for the entire session with this person, so every
    // .send() call hits an already-subscribed socket — no more silent drops.
    useEffect(() => {
        if (buzzChannelRef.current) {
            supabase.removeChannel(buzzChannelRef.current);
            buzzChannelRef.current = null;
        }

        if (!activeUser) return;

        const ch = supabase
            .channel(`user-signals-${activeUser.id}`)
            .subscribe((status) => {
                console.log(`[Buzz] Sender channel status for ${activeUser.id}:`, status);
            });

        buzzChannelRef.current = ch;

        return () => {
            supabase.removeChannel(ch);
            buzzChannelRef.current = null;
        };
    }, [activeUser?.id]);

    // ─── Buzz Helpers (called from worklet via runOnJS) ───────────────────────
    const sendBuzzStart = async () => {
        if (!activeUser || !currentUserId || isBuzzing.current) return;
        isBuzzing.current = true;

        startBuzz();

        // FIX 1 — Use buzzChannelRef.current (already subscribed) instead of
        // creating a new unsubscribed channel. Supabase silently drops broadcasts
        // on channels that haven't joined yet — this was the core bug.
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
        } else {
            console.warn('[Buzz] Sender channel not ready — Realtime path skipped');
        }

        // FIX 4 — Check receiver has a push token before invoking Edge Function.
        // Skip the network call entirely if token is missing — avoids a wasted
        // round-trip and keeps logs clean.
        try {
            const { data: receiverProfile } = await supabase
                .from('profiles')
                .select('expo_push_token')
                .eq('id', activeUser.id)
                .single();

            if (!receiverProfile?.expo_push_token) {
                console.warn(`[Buzz] Receiver ${activeUser.id} has no push token — skipping send-push`);
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
            console.warn('[Buzz] Push fallback failed:', e);
        }
    };

    const sendBuzzStop = async () => {
        if (!isBuzzing.current) return;
        isBuzzing.current = false;

        stopBuzz();

        if (!activeUser || !currentUserId) return;

        // FIX 1 — Use buzzChannelRef for stop signal too
        if (buzzChannelRef.current) {
            await buzzChannelRef.current.send({
                type: 'broadcast',
                event: 'buzz',
                payload: { state: 'stop', senderId: currentUserId },
            });
        }
    };

    // ─── Full-screen Long Press Gesture ──────────────────────────────────────
    const buzzGesture = Gesture.LongPress()
        .minDuration(350)
        .maxDistance(999)
        .onStart(() => { runOnJS(sendBuzzStart)(); })
        .onEnd(() => { runOnJS(sendBuzzStop)(); })
        .onTouchesCancelled(() => { runOnJS(sendBuzzStop)(); });

    const hasPriorities = priorities.length > 0;

    const handleInvite = async () => {
        const message = `I'm okay on my own, but honestly, everything feels brighter when I'm with you.\n\nDownload the app and add me: @${myUniqueId}`;
        try {
            await Share.share({ message });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <GestureDetector gesture={buzzGesture}>
            <View style={styles.container}>
                <View style={styles.mainContent}>
                    <PriorityList
                        priorities={priorities}
                        onColorChange={handleColorChange}
                        onActiveUserChange={setActiveUser}
                        scrollX={scrollX}
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
                    <View style={styles.emptyContainer} pointerEvents="box-none">
                        <View style={styles.cuteBoxWrapper}>
                            <View style={styles.distortedBoxBehind} />
                            <View style={styles.distortedBoxFront}>
                                <Text style={styles.quoteText}>
                                    "I'm okay on my own, but honestly, everything feels brighter when I'm with you"
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.whoText}>
                            who's the person, who came to your mind when you first read it?
                        </Text>

                        <TouchableOpacity style={styles.inviteButton} onPress={handleInvite} activeOpacity={0.7}>
                            <Ionicons name="paper-plane-outline" size={20} color={COLORS.text} />
                            <Text style={styles.inviteButtonText}>invite them</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <FilmMyDay />
                <FloatingSearch />
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
    emptyContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 100,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30,
        zIndex: 10,
    },
    cuteBoxWrapper: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 35,
        position: 'relative',
    },
    distortedBoxBehind: {
        position: 'absolute',
        top: 6, left: 6, right: -2, bottom: -4,
        borderWidth: 1,
        borderColor: COLORS.text,
        opacity: 0.15,
        borderRadius: 20,
        transform: [{ rotate: '-2deg' }],
    },
    distortedBoxFront: {
        width: '100%',
        paddingVertical: 28,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: COLORS.text,
        opacity: 0.5,
        borderRadius: 20,
        transform: [{ rotate: '1deg' }],
        backgroundColor: 'transparent',
    },
    quoteText: {
        fontFamily: 'DancingScript-Bold',
        fontSize: 22,
        color: COLORS.text,
        textAlign: 'center',
        lineHeight: 32,
    },
    whoText: {
        fontFamily: FONTS.medium,
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
        opacity: 0.7,
        paddingHorizontal: 20,
    },
    inviteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: COLORS.text,
        borderStyle: 'dashed',
        backgroundColor: 'transparent',
        opacity: 0.8,
    },
    inviteButtonText: {
        fontFamily: FONTS.bold,
        fontSize: FONT_SIZES.sm,
        color: COLORS.text,
        letterSpacing: 0.5,
    },
});