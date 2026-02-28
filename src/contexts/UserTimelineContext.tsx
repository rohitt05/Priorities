import React, { createContext, useContext, useState, useRef, useCallback, useMemo, ReactNode } from 'react';
import { LayoutRectangle, FlatList } from 'react-native';
import Animated, { useSharedValue, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { useTabBarVisibility } from '@/contexts/TabBarVisibilityContext';
import { useBackground } from '@/contexts/BackgroundContext';
import UserTimelineView from '@/features/timeline/components/UserTimelineView';
import { PriorityUserWithPost } from '@/types/userTypes';

interface UserTimelineContextType {
    expandedUser: any | null;
    expandAnim: any;
    openTimeline: (user: any, layout: LayoutRectangle) => void;
    closeTimeline: () => void;
    priorities: PriorityUserWithPost[];
    setPriorities: (users: PriorityUserWithPost[]) => void;
    scrollToUserIndex: (index: number) => void;
    flatListRef: React.RefObject<FlatList | null>;
}

const UserTimelineContext = createContext<UserTimelineContextType | undefined>(undefined);

export const UserTimelineProvider = ({ children }: { children: ReactNode }) => {
    const [expandedUser, setExpandedUser] = useState<any | null>(null);
    const [originLayout, setOriginLayout] = useState<LayoutRectangle | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [priorities, setPriorities] = useState<PriorityUserWithPost[]>([]);

    const expandAnim = useSharedValue(0);
    const flatListRef = useRef<FlatList>(null);

    const { hideTabBar, showTabBar } = useTabBarVisibility();
    const { handleColorChange } = useBackground();

    const openTimeline = (user: any, layout: LayoutRectangle) => {
        if (isAnimating) return;
        setIsAnimating(true);
        hideTabBar();
        setOriginLayout(layout);
        setExpandedUser(user);
        handleColorChange(user.dominantColor);
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
        priorities, setPriorities, scrollToUserIndex, flatListRef
    }), [expandedUser, priorities, scrollToUserIndex]);

    return (
        <UserTimelineContext.Provider value={value}>
            {children}
            {expandedUser && originLayout && (
                <UserTimelineView user={expandedUser} originLayout={originLayout} expandAnim={expandAnim} onClose={closeTimeline} />
            )}
        </UserTimelineContext.Provider>
    );
};

export const useUserTimeline = () => {
    const context = useContext(UserTimelineContext);
    if (!context) throw new Error('useUserTimeline must be used within a UserTimelineProvider');
    return context;
};
