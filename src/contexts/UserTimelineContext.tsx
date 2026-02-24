import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { LayoutRectangle } from 'react-native';
import Animated, {
    useSharedValue,
    withTiming,
    Easing,
    runOnJS
} from 'react-native-reanimated';
import { useTabBarVisibility } from '@/contexts/TabBarVisibilityContext';
import { useBackground } from '@/contexts/BackgroundContext';
import UserTimelineView from '@/features/timeline/components/UserTimelineView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { User } from '@/types/userTypes';

interface UserTimelineContextType {
    expandedUser: User | null;
    expandAnim: any; // Using any for SharedValue type to avoid strict TS issues in migration
    openTimeline: (user: User, layout: LayoutRectangle) => void;
    closeTimeline: () => void;
}

const UserTimelineContext = createContext<UserTimelineContextType | undefined>(undefined);

export const UserTimelineProvider = ({ children }: { children: ReactNode }) => {
    const [expandedUser, setExpandedUser] = useState<User | null>(null);
    const [originLayout, setOriginLayout] = useState<LayoutRectangle | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    const expandAnim = useSharedValue(0);

    // Contexts
    const { hideTabBar, showTabBar } = useTabBarVisibility();
    const { handleColorChange } = useBackground();
    const insets = useSafeAreaInsets();

    const openTimeline = (user: User, layout: LayoutRectangle) => {
        if (isAnimating) return;
        setIsAnimating(true);

        // 1. Hide Tabs immediately
        hideTabBar();

        setOriginLayout(layout);
        setExpandedUser(user);
        handleColorChange(user.dominantColor);
        expandAnim.value = 0;

        expandAnim.value = withTiming(1, {
            duration: 400,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }, (finished) => {
            if (finished) {
                runOnJS(setIsAnimating)(false);
            }
        });
    };

    const closeTimeline = () => {
        if (isAnimating) return;
        setIsAnimating(true);

        // 2. Show Tabs immediately when closing starts
        showTabBar();

        expandAnim.value = withTiming(0, {
            duration: 350,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }, (finished) => {
            if (finished) {
                runOnJS(setExpandedUser)(null);
                runOnJS(setOriginLayout)(null);
                runOnJS(setIsAnimating)(false);
            }
        });
    };

    return (
        <UserTimelineContext.Provider value={{ expandedUser, expandAnim, openTimeline, closeTimeline }}>
            {children}

            {/* Render Overlay here at Layout Level */}
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
    if (!context) {
        throw new Error('useUserTimeline must be used within a UserTimelineProvider');
    }
    return context;
};
