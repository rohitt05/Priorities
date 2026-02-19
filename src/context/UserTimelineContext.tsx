import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { Animated, Easing, LayoutRectangle } from 'react-native';
import { useTabBarVisibility } from './TabBarVisibilityContext';
import { useBackground } from './BackgroundContext';
import UserTimelineView from '../components/UserTimelineView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface User {
    id: string;
    uniqueUserId: string;
    name: string;
    profilePicture: string;
    birthday: string;
    dominantColor: string;
}

interface UserTimelineContextType {
    expandedUser: User | null;
    openTimeline: (user: User, layout: LayoutRectangle) => void;
    closeTimeline: () => void;
}

const UserTimelineContext = createContext<UserTimelineContextType | undefined>(undefined);

export const UserTimelineProvider = ({ children }: { children: ReactNode }) => {
    const [expandedUser, setExpandedUser] = useState<User | null>(null);
    const [originLayout, setOriginLayout] = useState<LayoutRectangle | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    const expandAnim = useRef(new Animated.Value(0)).current;

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
        expandAnim.setValue(0);

        Animated.timing(expandAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: false,
            easing: Easing.bezier(0.2, 0, 0.2, 1),
        }).start(() => setIsAnimating(false));
    };

    const closeTimeline = () => {
        if (isAnimating) return;
        setIsAnimating(true);

        // 2. Show Tabs immediately when closing starts
        showTabBar();

        Animated.timing(expandAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
            easing: Easing.out(Easing.quad),
        }).start(() => {
            setExpandedUser(null);
            setOriginLayout(null);
            setIsAnimating(false);
        });
    };

    return (
        <UserTimelineContext.Provider value={{ expandedUser, openTimeline, closeTimeline }}>
            {children}

            {/* Render Overlay here at Layout Level */}
            {expandedUser && originLayout && (
                <UserTimelineView
                    user={expandedUser}
                    originLayout={originLayout}
                    expandAnim={expandAnim}
                    onClose={closeTimeline}
                    topInset={insets.top}
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
