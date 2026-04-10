// src/contexts/UserTimelineContext.tsx
import React, {
    createContext, useContext, useState, useRef,
    useCallback, useMemo, ReactNode, useEffect
} from 'react';
import { LayoutRectangle, FlatList } from 'react-native';
import Animated, {
    useSharedValue, withTiming, Easing, runOnJS
} from 'react-native-reanimated';
import { useTabBarVisibility } from '@/contexts/TabBarVisibilityContext';
import { useBackground } from '@/contexts/BackgroundContext';
import UserTimelineView from '@/features/timeline/components/UserTimelineView';
import { User, PriorityUserWithPost, TimelineEvent } from '@/types/domain';
import { timelineService } from '@/services/timelineService';
import { supabase } from '@/lib/supabase';
import { useMediaInbox } from '@/contexts/MediaInboxContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10; // items fetched per page

// ─── Types ────────────────────────────────────────────────────────────────────
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
    paginationMeta: Record<string, PaginationMeta>;
}

const UserTimelineContext = createContext<UserTimelineContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────
export const UserTimelineProvider = ({ children }: { children: ReactNode }) => {
    const [expandedUser, setExpandedUser] = useState<any | null>(null);
    const [originLayout, setOriginLayout] = useState<LayoutRectangle | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [priorities, setPriorities] = useState<PriorityUserWithPost[]>([]);

    const { timelineEvents: inboxEvents } = useMediaInbox();
    const [liveTimelineEvents, setLiveTimelineEvents] = useState<Record<string, TimelineEvent[]>>({});
    const [timelineLoading, setTimelineLoading] = useState(false);

    // tracks pagination state per user
    const [paginationMeta, setPaginationMeta] = useState<Record<string, PaginationMeta>>({});

    // tracks which users had their FIRST page loaded already
    const loadedUsers = useRef<Set<string>>(new Set());

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

    // ─── Core fetch with pagination ───────────────────────────────────────────
    // `page` starts at 0.
    // Page 0 = first PAGE_SIZE items (newest first).
    // Page 1 = next PAGE_SIZE items, appended. And so on.
    const fetchTimelinePage = useCallback(async (
        user: any,
        page: number,
        force = false
    ) => {
        const uniqueKey = user.uniqueUserId || user.id;

        // skip if already loading this user's page
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
            const { data: sessionData } = await supabase.auth.getSession();
            const myId = sessionData?.session?.user?.id;
            if (!myId) return;

            // pass page + PAGE_SIZE to timelineService so it can LIMIT/OFFSET
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
                // dedup by id before appending
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

    // ─── Called by UserTimelineView when user reaches end of scroll ───────────
    const loadMoreEvents = useCallback((userId: string, uniqueUserId: string) => {
        const uniqueKey = uniqueUserId || userId;
        const meta = paginationMeta[uniqueKey];
        if (!meta || meta.loading || !meta.hasMore) return;
        fetchTimelinePage({ id: userId, uniqueUserId }, meta.page + 1);
    }, [paginationMeta, fetchTimelinePage]);

    // ─── Initial fetch (page 0) for a user ───────────────────────────────────
    const fetchTimelineForUser = useCallback(async (user: any, force = false) => {
        if (!force && loadedUsers.current.has(user.id)) return;
        fetchTimelinePage(user, 0, force);
    }, [fetchTimelinePage]);

    // ─── React to inbox events ────────────────────────────────────────────────
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

    // ─── Open / Close ─────────────────────────────────────────────────────────
    const openTimeline = (user: any, layout: LayoutRectangle) => {
        if (isAnimating) return;
        setIsAnimating(true);
        hideTabBar();
        setOriginLayout(layout);
        setExpandedUser(user);
        handleColorChange(user.dominantColor);
        fetchTimelineForUser(user);

        clearAnimSafety();
        animSafetyTimeout.current = setTimeout(() => setIsAnimating(false), 600);

        expandAnim.value = withTiming(1, {
            duration: 400,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1)
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
        }, 550);

        expandAnim.value = withTiming(0, {
            duration: 350,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1)
        }, (finished) => {
            if (finished) {
                runOnJS(clearAnimSafety)();
                runOnJS(setExpandedUser)(null);
                runOnJS(setOriginLayout)(null);
                runOnJS(setIsAnimating)(false);
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
        loadMoreEvents, refreshTimeline: fetchTimelineForUser, paginationMeta,
    }), [
        expandedUser, priorities, scrollToUserIndex,
        liveTimelineEvents, timelineLoading,
        loadMoreEvents, fetchTimelineForUser, paginationMeta,
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