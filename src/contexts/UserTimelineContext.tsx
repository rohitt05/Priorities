// src/contexts/UserTimelineContext.tsx
import React, { createContext, useContext, useState, useRef, useCallback, useMemo, ReactNode, useEffect } from 'react';
import { LayoutRectangle, FlatList } from 'react-native';
import Animated, { useSharedValue, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { useTabBarVisibility } from '@/contexts/TabBarVisibilityContext';
import { useBackground } from '@/contexts/BackgroundContext';
import UserTimelineView from '@/features/timeline/components/UserTimelineView';
import { User, PriorityUserWithPost, TimelineEvent } from '@/types/domain';
import { timelineService } from '@/services/timelineService';
import { supabase } from '@/lib/supabase';
import { useMediaInbox } from '@/contexts/MediaInboxContext';

interface UserTimelineContextType {
    expandedUser: any | null;
    expandAnim: any;
    openTimeline: (user: any, layout: LayoutRectangle) => void;
    closeTimeline: () => void;
    priorities: PriorityUserWithPost[];
    setPriorities: (users: PriorityUserWithPost[]) => void;
    scrollToUserIndex: (index: number) => void;
    flatListRef: React.RefObject<FlatList | null>;
    // ⭐ NEW: live timeline events keyed by their uniqueUserId
    liveTimelineEvents: Record<string, TimelineEvent[]>;
    timelineLoading: boolean;
}

const UserTimelineContext = createContext<UserTimelineContextType | undefined>(undefined);

export const UserTimelineProvider = ({ children }: { children: ReactNode }) => {
    const [expandedUser, setExpandedUser] = useState<any | null>(null);
    const [originLayout, setOriginLayout] = useState<LayoutRectangle | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [priorities, setPriorities] = useState<PriorityUserWithPost[]>([]);

    // ⭐ NEW — live data state
    const { timelineEvents: inboxEvents } = useMediaInbox();
    const [liveTimelineEvents, setLiveTimelineEvents] = useState<Record<string, TimelineEvent[]>>({});
    const [timelineLoading, setTimelineLoading] = useState(false);
    const loadedUsers = useRef<Set<string>>(new Set()); // avoid re-fetching same user

    const expandAnim = useSharedValue(0);
    const flatListRef = useRef<FlatList>(null);

    const { hideTabBar, showTabBar } = useTabBarVisibility();
    const { handleColorChange } = useBackground();

    // ⭐ NEW — fetch live timeline when a user is opened
    const fetchTimelineForUser = useCallback(async (user: any, force = false) => {
        if (!force && loadedUsers.current.has(user.id)) return; // already loaded

        setTimelineLoading(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const myId = sessionData?.session?.user?.id;
            if (!myId) return;

            const events = await timelineService.getTimelineForPair(
                myId,
                user.id,
                user.uniqueUserId
            );

            setLiveTimelineEvents(prev => ({
                ...prev,
                [user.uniqueUserId || user.id]: events,
            }));
            loadedUsers.current.add(user.id);
        } catch (err) {
            console.error('[UserTimelineContext] Failed to fetch timeline:', err);
        } finally {
            setTimelineLoading(false);
        }
    }, []);
    
    const fetchedInboxMessageIds = useRef<Set<string>>(new Set());

    // ⭐ Sync newly-seen messages from MediaInbox into the live timeline state
    useEffect(() => {
        Object.entries(inboxEvents).forEach(([userId, events]) => {
            if (events.length === 0) return;
            const topMsgId = events[0].id;

            if (!fetchedInboxMessageIds.current.has(topMsgId)) {
                // New seen message detected! 
                // Mark as pending-fetch immediately to avoid duplicates
                fetchedInboxMessageIds.current.add(topMsgId);

                // Background fetch to sync the full timeline from DB
                // We use the sender_id (them) and the uniqueUserId (which is userId here)
                fetchTimelineForUser({ id: events[0].senderId, uniqueUserId: userId }, true);
            }
        });
    }, [inboxEvents, fetchTimelineForUser]);

    const openTimeline = (user: any, layout: LayoutRectangle) => {
        if (isAnimating) return;
        setIsAnimating(true);
        hideTabBar();
        setOriginLayout(layout);
        setExpandedUser(user);
        handleColorChange(user.dominantColor);

        // ⭐ kick off the live fetch
        fetchTimelineForUser(user);

        expandAnim.value = withTiming(1, {
            duration: 400,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1)
        }, (finished) => { if (finished) runOnJS(setIsAnimating)(false); });
    };

    const closeTimeline = () => {
        if (isAnimating) return;
        setIsAnimating(true);
        showTabBar();
        expandAnim.value = withTiming(0, {
            duration: 350,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1)
        }, (finished) => {
            if (finished) {
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
        expandedUser, expandAnim, openTimeline, closeTimeline,
        priorities, setPriorities, scrollToUserIndex, flatListRef,
        liveTimelineEvents, timelineLoading,
    }), [expandedUser, priorities, scrollToUserIndex, liveTimelineEvents, timelineLoading]);

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
