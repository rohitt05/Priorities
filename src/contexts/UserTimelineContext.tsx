// src/contexts/UserTimelineContext.tsx
import React, {
    createContext, useContext, useState, useRef,
    useCallback, useMemo, ReactNode, useEffect
} from 'react';
import { LayoutRectangle, FlatList } from 'react-native';
import Animated, {
    useSharedValue, withTiming, withSpring, Easing, runOnJS
} from 'react-native-reanimated';
import { useTabBarVisibility } from '@/contexts/TabBarVisibilityContext';
import { useBackground } from '@/contexts/BackgroundContext';
import UserTimelineView from '@/features/timeline/components/UserTimelineView';
import { User, PriorityUserWithPost, TimelineEvent } from '@/types/domain';
import { timelineService } from '@/services/timelineService';
import { supabase } from '@/lib/supabase';
import { useMediaInbox } from '@/contexts/MediaInboxContext';

// ─── Constants ──────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

// ─── Types ──────────────────────────────────────────────────────────────────────────────────
interface PaginationMeta {
    page: number;
    hasMore: boolean;
    loading: boolean;
}

interface UserTimelineContextType {
    expandedUser: any | null;
    expandAnim: any;
    openTimeline: (user: any, layout: LayoutRectangle) => void;
    closeTimeline: () => void;
    priorities: PriorityUserWithPost[];
    setPriorities: (users: PriorityUserWithPost[]) => void;
    scrollToUserIndex: (index: number) => void;
    flatListRef: React.RefObject<FlatList | null>;
    liveTimelineEvents: Record<string, TimelineEvent[]>;
    timelineLoading: boolean;
    loadMoreEvents: (userId: string, uniqueUserId: string) => void;
    refreshTimeline: (user: any) => void;
    // Called by MediaInboxContext immediately after a successful insert
    // so the timeline refreshes without waiting for realtime round-trip.
    notifyTimelineInsert: (otherAuthUserId: string) => void;
    paginationMeta: Record<string, PaginationMeta>;
}

const UserTimelineContext = createContext<UserTimelineContextType | undefined>(undefined);

// ─── Provider ──────────────────────────────────────────────────────────────────────────────────
export const UserTimelineProvider = ({ children }: { children: ReactNode }) => {
    const [expandedUser, setExpandedUser] = useState<any | null>(null);
    const [originLayout, setOriginLayout] = useState<LayoutRectangle | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [priorities, setPriorities] = useState<PriorityUserWithPost[]>([]);

    const { timelineEvents: inboxEvents } = useMediaInbox();
    const [liveTimelineEvents, setLiveTimelineEvents] = useState<Record<string, TimelineEvent[]>>({});
    const [timelineLoading, setTimelineLoading] = useState(false);

    const [paginationMeta, setPaginationMeta] = useState<Record<string, PaginationMeta>>({});
    const loadedUsers = useRef<Set<string>>(new Set());

    // Ref so realtime callbacks always see current expandedUser without stale closure
    const expandedUserRef = useRef<any>(null);
    useEffect(() => { expandedUserRef.current = expandedUser; }, [expandedUser]);

    const expandAnim = useSharedValue(0);
    const flatListRef = useRef<FlatList>(null);
    const animSafetyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { hideTabBar, showTabBar } = useTabBarVisibility();
    const { handleColorChange } = useBackground();

    const clearAnimSafety = () => {
        if (animSafetyTimeout.current) {
            clearTimeout(animSafetyTimeout.current);
            animSafetyTimeout.current = null;
        }
    };

    // ─── Core fetch with pagination ──────────────────────────────────────────────────────────
    const fetchTimelinePage = useCallback(async (
        user: any,
        page: number,
        force = false
    ) => {
        const uniqueKey = user.uniqueUserId || user.id;

        setPaginationMeta(prev => {
            if (prev[uniqueKey]?.loading) return prev;
            return {
                ...prev,
                [uniqueKey]: {
                    page,
                    hasMore: prev[uniqueKey]?.hasMore ?? true,
                    loading: true,
                }
            };
        });

        if (page === 0) setTimelineLoading(true);

        try {
            // Use getUser() — not getSession() — to ensure JWT matches auth.uid() in RLS
            const { data: userData } = await supabase.auth.getUser();
            const myId = userData?.user?.id;
            if (!myId) return;

            const events = await timelineService.getTimelineForPair(
                myId,
                user.id,
                user.uniqueUserId,
                page,
                PAGE_SIZE
            );

            const hasMore = events.length === PAGE_SIZE;

            setLiveTimelineEvents(prev => {
                const existing = page === 0 ? [] : (prev[uniqueKey] ?? []);
                const existingIds = new Set(existing.map((e: TimelineEvent) => (e as any).id));
                const fresh = events.filter((e: TimelineEvent) => !existingIds.has((e as any).id));
                return {
                    ...prev,
                    [uniqueKey]: [...existing, ...fresh],
                };
            });

            setPaginationMeta(prev => ({
                ...prev,
                [uniqueKey]: { page, hasMore, loading: false }
            }));

            loadedUsers.current.add(user.id);
        } catch (err) {
            console.error('[UserTimelineContext] Failed to fetch timeline:', err);
            setPaginationMeta(prev => ({
                ...prev,
                [uniqueKey]: {
                    ...(prev[uniqueKey] ?? { page: 0, hasMore: true }),
                    loading: false,
                }
            }));
        } finally {
            if (page === 0) setTimelineLoading(false);
        }
    }, []);

    // ─── Realtime: DELETE + INSERT on user_timelines + films DELETE ─────────────────────────
    // This is the safety-net refresh layer. MediaInboxContext also calls
    // notifyTimelineInsert() directly for a faster zero-latency path.
    useEffect(() => {
        let myId: string | undefined;

        const setupChannel = async () => {
            const { data: userData } = await supabase.auth.getUser();
            myId = userData?.user?.id;
            if (!myId) return;

            const channel = supabase
                .channel('timeline-changes')

                // ── New row inserted for ME (Row A: I just saw a message) ─────────────────
                // filter: owner_id = myId so we only get rows we own
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'user_timelines',
                        filter: `owner_id=eq.${myId}`,
                    },
                    (payload) => {
                        const row = payload.new as any;
                        // other_user_id is the person this event is about
                        const otherUserId = row.other_user_id;
                        if (!otherUserId) return;

                        // If that user's timeline is currently open, refresh page 0
                        const current = expandedUserRef.current;
                        if (current && (current.id === otherUserId || current.uniqueUserId === otherUserId)) {
                            fetchTimelinePage(current, 0, true);
                        } else {
                            // Not open yet — invalidate cache so next open fetches fresh
                            loadedUsers.current.delete(otherUserId);
                        }
                    }
                )

                // ── Row deleted (user cleared their history) ───────────────────────────
                .on(
                    'postgres_changes',
                    { event: 'DELETE', schema: 'public', table: 'user_timelines' },
                    () => {
                        const current = expandedUserRef.current;
                        if (current) fetchTimelinePage(current, 0, true);
                    }
                )

                // ── Film deleted ───────────────────────────────────────────────────────
                .on(
                    'postgres_changes',
                    { event: 'DELETE', schema: 'public', table: 'films' },
                    () => {
                        const current = expandedUserRef.current;
                        if (current) fetchTimelinePage(current, 0, true);
                    }
                )

                .subscribe();

            return channel;
        };

        let channelRef: ReturnType<typeof supabase.channel> | undefined;
        setupChannel().then(ch => { channelRef = ch; });

        return () => {
            if (channelRef) supabase.removeChannel(channelRef);
        };
    // Only re-run on mount/unmount — expandedUserRef keeps it current without re-subscribing
    }, [fetchTimelinePage]);

    // ─── loadMoreEvents (infinite scroll) ──────────────────────────────────────────────────
    const loadMoreEvents = useCallback((userId: string, uniqueUserId: string) => {
        const uniqueKey = uniqueUserId || userId;
        const meta = paginationMeta[uniqueKey];
        if (!meta || meta.loading || !meta.hasMore) return;
        fetchTimelinePage({ id: userId, uniqueUserId }, meta.page + 1);
    }, [paginationMeta, fetchTimelinePage]);

    // ─── Initial fetch (page 0) for a user ───────────────────────────────────────────────────
    const fetchTimelineForUser = useCallback(async (user: any, force = false) => {
        if (!force && loadedUsers.current.has(user.id)) return;
        fetchTimelinePage(user, 0, force);
    }, [fetchTimelinePage]);

    // ─── notifyTimelineInsert ──────────────────────────────────────────────────────────────────
    // Called directly by MediaInboxContext after a successful user_timelines insert.
    // otherAuthUserId = message.senderId (the other person in the pair).
    // This is the zero-latency path — fires before the realtime event arrives.
    const notifyTimelineInsert = useCallback((otherAuthUserId: string) => {
        const current = expandedUserRef.current;
        if (current && current.id === otherAuthUserId) {
            // Timeline for this person is currently open — hard refresh
            fetchTimelinePage(current, 0, true);
        } else {
            // Timeline not open — invalidate cache so next open fetches fresh
            loadedUsers.current.delete(otherAuthUserId);
        }
    }, [fetchTimelinePage]);

    // ─── React to inbox events (legacy path, kept as extra safety net) ──────────────────
    const fetchedInboxMessageIds = useRef<Set<string>>(new Set());
    useEffect(() => {
        Object.entries(inboxEvents).forEach(([userId, events]) => {
            if (events.length === 0) return;
            const topMsgId = events[0].id;
            if (!fetchedInboxMessageIds.current.has(topMsgId)) {
                fetchedInboxMessageIds.current.add(topMsgId);
                fetchTimelineForUser({ id: events[0].senderId, uniqueUserId: userId }, true);
            }
        });
    }, [inboxEvents, fetchTimelineForUser]);

    // ─── Open / Close ──────────────────────────────────────────────────────────────────────────────
    const openTimeline = (user: any, layout: LayoutRectangle) => {
        if (isAnimating) return;
        setIsAnimating(true);
        hideTabBar();
        setOriginLayout(layout);
        setExpandedUser(user);
        handleColorChange(user.dominantColor);
        fetchTimelineForUser(user);

        clearAnimSafety();
        animSafetyTimeout.current = setTimeout(() => setIsAnimating(false), 800);

        expandAnim.value = withSpring(1, {
            damping: 15,
            stiffness: 120,
            mass: 0.5,
            overshootClamping: true,
        }, (finished) => {
            if (finished) {
                runOnJS(clearAnimSafety)();
                runOnJS(setIsAnimating)(false);
            }
        });
    };

    const closeTimeline = () => {
        if (isAnimating) return;
        setIsAnimating(true);
        showTabBar();

        clearAnimSafety();
        animSafetyTimeout.current = setTimeout(() => {
            setExpandedUser(null);
            setOriginLayout(null);
            setIsAnimating(false);
        }, 800);

        expandAnim.value = withSpring(0, {
            stiffness: 150,
            damping: 24,
            mass: 0.6,
            overshootClamping: true,
            energyThreshold: 0.01,
        }, (finished) => {
            if (finished) {
                runOnJS(clearAnimSafety)();
                setTimeout(() => {
                    runOnJS(setExpandedUser)(null);
                    runOnJS(setOriginLayout)(null);
                    runOnJS(setIsAnimating)(false);
                }, 8);
            }
        });
    };

    const scrollToUserIndex = useCallback((index: number) => {
        if (flatListRef.current) {
            flatListRef.current.scrollToIndex({ index, animated: true });
        }
    }, []);

    const value = useMemo(() => ({
        expandedUser, expandAnim,
        openTimeline, closeTimeline,
        priorities, setPriorities,
        scrollToUserIndex, flatListRef,
        liveTimelineEvents, timelineLoading,
        loadMoreEvents,
        refreshTimeline: (u: any) => fetchTimelineForUser(u, true),
        notifyTimelineInsert,
        paginationMeta,
    }), [
        expandedUser, priorities, scrollToUserIndex,
        liveTimelineEvents, timelineLoading,
        loadMoreEvents, fetchTimelineForUser,
        notifyTimelineInsert, paginationMeta,
    ]);

    return (
        <UserTimelineContext.Provider value={value}>
            {children}
            {expandedUser && originLayout && (
                <UserTimelineView
                    user={expandedUser}
                    originLayout={originLayout}
                    expandAnim={expandAnim}
                    onClose={closeTimeline}
                />
            )}
        </UserTimelineContext.Provider>
    );
};

export const useUserTimeline = () => {
    const context = useContext(UserTimelineContext);
    if (!context) throw new Error('useUserTimeline must be used within a UserTimelineProvider');
    return context;
};
