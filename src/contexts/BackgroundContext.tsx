import React, { createContext, useContext, useState, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { COLORS } from '@/theme/theme';

interface BackgroundContextType {
    bgColor: string;
    prevBgColor: string;
    colorAnim: Animated.Value;
    handleColorChange: (color: string) => void;
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

export const BackgroundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [bgColor, setBgColor] = useState(COLORS.background);
    const [prevBgColor, setPrevBgColor] = useState(COLORS.background);
    const colorAnim = useRef(new Animated.Value(0)).current;

    const handleColorChange = (color: string) => {
        if (color === bgColor) return;

        setPrevBgColor(bgColor);
        setBgColor(color);
        colorAnim.setValue(0);

        Animated.timing(colorAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
        }).start();
    };

    return (
        <BackgroundContext.Provider value={{ bgColor, prevBgColor, colorAnim, handleColorChange }}>
            {children}
        </BackgroundContext.Provider>
    );
};

export const useBackground = () => {
    const context = useContext(BackgroundContext);
    if (!context) {
        throw new Error('useBackground must be used within a BackgroundProvider');
    }
    return context;
};
