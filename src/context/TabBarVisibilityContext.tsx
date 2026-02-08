import React, { createContext, useContext, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

interface TabBarVisibilityContextType {
    isTabBarVisible: boolean;
    tabBarAnim: Animated.Value; // 1 = Visible, 0 = Hidden
    hideTabBar: () => void;
    showTabBar: () => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextType | undefined>(undefined);

export const TabBarVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isVisible, setIsVisible] = useState(true);
    const tabBarAnim = useRef(new Animated.Value(1)).current;

    const hideTabBar = () => {
        setIsVisible(false);
        Animated.timing(tabBarAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
        }).start();
    };

    const showTabBar = () => {
        setIsVisible(true);
        Animated.timing(tabBarAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
        }).start();
    };

    return (
        <TabBarVisibilityContext.Provider value={{
            isTabBarVisible: isVisible,
            tabBarAnim,
            hideTabBar,
            showTabBar
        }}>
            {children}
        </TabBarVisibilityContext.Provider>
    );
};

export const useTabBarVisibility = () => {
    const context = useContext(TabBarVisibilityContext);
    if (!context) {
        throw new Error('useTabBarVisibility must be used within a TabBarVisibilityProvider');
    }
    return context;
};
