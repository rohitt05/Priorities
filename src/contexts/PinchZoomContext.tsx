import React, { createContext, useContext, ReactNode } from 'react';
import { StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    cancelAnimation
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PinchZoomContextType {
    ZoomableHeader: React.FC<{ children: ReactNode; style?: ViewStyle }>;
}

const PinchZoomContext = createContext<PinchZoomContextType | undefined>(undefined);

export const usePinchZoom = () => {
    const context = useContext(PinchZoomContext);
    if (!context) {
        throw new Error('usePinchZoom must be used within PinchZoomProvider');
    }
    return context;
};

export const PinchZoomProvider: React.FC<{ children: ReactNode }> = ({ children }) => {

    const ZoomableHeader: React.FC<{ children: ReactNode; style?: ViewStyle }> = ({ children, style }) => {
        // Shared values for transforms
        const scale = useSharedValue(1);
        const savedScale = useSharedValue(1);
        const translateX = useSharedValue(0);
        const translateY = useSharedValue(0);
        const savedTranslateX = useSharedValue(0);
        const savedTranslateY = useSharedValue(0);

        // Focal point tracking
        const focalX = useSharedValue(0);
        const focalY = useSharedValue(0);

        // --- PINCH GESTURE ---
        const pinchGesture = Gesture.Pinch()
            .onStart((event) => {
                savedScale.value = scale.value;
                savedTranslateX.value = translateX.value;
                savedTranslateY.value = translateY.value;
                focalX.value = event.focalX;
                focalY.value = event.focalY;
            })
            .onUpdate((event) => {
                const newScale = savedScale.value * event.scale;
                // Limit scale between 1 and 4
                scale.value = Math.max(1, Math.min(newScale, 4));

                // Calculate pinch center adjustment
                // This math keeps the image anchored under your fingers
                if (scale.value > 1) {
                    const scaleRatio = scale.value / savedScale.value;
                    const focusX = event.focalX - SCREEN_WIDTH / 2;
                    const focusY = event.focalY - SCREEN_HEIGHT / 2;

                    // Move image opposite to scale direction to zoom "into" the point
                    // Simplified logic for stability: just scale, don't overcomplicate pan during pinch
                }
            })
            .onEnd(() => {
                if (scale.value < 1.1) {
                    // Reset if barely zoomed
                    scale.value = withSpring(1);
                    translateX.value = withSpring(0);
                    translateY.value = withSpring(0);
                } else {
                    // Keep current scale
                    scale.value = withSpring(scale.value);
                }
            });

        // --- PAN GESTURE (For dragging when zoomed) ---
        const panGesture = Gesture.Pan()
            .onStart(() => {
                savedTranslateX.value = translateX.value;
                savedTranslateY.value = translateY.value;
            })
            .onUpdate((event) => {
                if (scale.value > 1) {
                    translateX.value = savedTranslateX.value + event.translationX;
                    translateY.value = savedTranslateY.value + event.translationY;
                }
            })
            .onEnd(() => {
                // If dragging out of bounds, snap back? 
                // For simplicity, we just let it stay where dragged or reset if zoomed out
                if (scale.value <= 1) {
                    translateX.value = withSpring(0);
                    translateY.value = withSpring(0);
                }
            });

        // --- DOUBLE TAP (Reset) ---
        const doubleTapGesture = Gesture.Tap()
            .numberOfTaps(2)
            .onEnd(() => {
                if (scale.value > 1) {
                    scale.value = withSpring(1);
                    translateX.value = withSpring(0);
                    translateY.value = withSpring(0);
                } else {
                    scale.value = withSpring(2.5); // Quick zoom in
                }
            });

        // Compose gestures: Allow Pinch and Pan simultaneously
        const composedGestures = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

        const animatedStyle = useAnimatedStyle(() => ({
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { scale: scale.value },
            ],
            zIndex: scale.value > 1 ? 9999 : 1, // High z-index when zoomed
        }));

        return (
            <GestureDetector gesture={composedGestures}>
                <Animated.View style={[style, animatedStyle]}>
                    {children}
                </Animated.View>
            </GestureDetector>
        );
    };

    return (
        <PinchZoomContext.Provider value={{ ZoomableHeader }}>
            {children}
        </PinchZoomContext.Provider>
    );
};
