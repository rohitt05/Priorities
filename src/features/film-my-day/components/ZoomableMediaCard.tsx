import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

interface ZoomableMediaCardProps {
    children: React.ReactNode;
    width: number;
    height: number;
    pos: { x: number; y: number }; // Original position in pivot
    accent: string;
    isActive: boolean;
    tx: any; // SharedValue from parent (Map Tx)
    ty: any; // SharedValue from parent (Map Ty)
    sc: any; // SharedValue from parent (Map Scale)
    onLongPressStart?: () => void;
    onLongPressEnd?: () => void;
}

const { width: SW, height: SH } = require('react-native').Dimensions.get('window');

const ZoomableMediaCard: React.FC<ZoomableMediaCardProps> = ({
    children,
    width,
    height,
    pos,
    accent,
    isActive,
    tx,
    ty,
    sc,
    onLongPressStart,
    onLongPressEnd,
}) => {
    const scale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const backdropOpacity = useSharedValue(0);
    const borderRadius = useSharedValue(24);
    const zIndex = useSharedValue(100);

    const SPRING_CONFIG = {
        damping: 15,
        stiffness: 120,
        mass: 0.8,
    };

    const longPressGesture = Gesture.LongPress()
        .minDuration(300)
        .onStart(() => {
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
            
            // 1. Calculate the target scale (95% width)
            const modalScale = (SW * 0.95) / width;
            
            // 2. Fly to Center logic:
            const targetPivotCenterX = -tx.value / sc.value;
            const targetPivotCenterY = -ty.value / sc.value;
            
            const cardCenterX = pos.x + width / 2;
            const cardCenterY = pos.y + height / 2;
            
            translateX.value = withSpring(targetPivotCenterX - cardCenterX, SPRING_CONFIG);
            translateY.value = withSpring(targetPivotCenterY - cardCenterY, SPRING_CONFIG);
            
            scale.value = withSpring(modalScale / sc.value, SPRING_CONFIG); 
            borderRadius.value = withSpring(15, SPRING_CONFIG);
            backdropOpacity.value = withTiming(0, { duration: 300 }); // Remove backdrop opacity
            zIndex.value = 9999;
            if (onLongPressStart) runOnJS(onLongPressStart)();
        })
        .onFinalize(() => {
            scale.value = withSpring(1, SPRING_CONFIG);
            translateX.value = withSpring(0, SPRING_CONFIG);
            translateY.value = withSpring(0, SPRING_CONFIG);
            backdropOpacity.value = withTiming(0, { duration: 300 });
            borderRadius.value = withSpring(24, SPRING_CONFIG);
            zIndex.value = withTiming(100, { duration: 300 });
            if (onLongPressEnd) runOnJS(onLongPressEnd)();
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
        borderRadius: borderRadius.value,
        zIndex: zIndex.value,
        width: width,
        height: height,
        shadowColor: '#433D35',
        shadowOpacity: isActive ? 0.35 : 0.08,
        shadowOffset: { width: 0, height: scale.value > 1.1 ? 30 : 12 },
        shadowRadius: scale.value > 1.1 ? 40 : 20,
        elevation: scale.value > 1.1 ? 30 : 12,
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: 0, // No backdrop as requested
        backgroundColor: 'transparent',
        position: 'absolute',
    }));

    return (
        <GestureDetector gesture={longPressGesture}>
            <Animated.View style={[styles.wrapper, { zIndex: zIndex.value }]}>
                <Animated.View style={[styles.card, animatedStyle]}>
                    <Animated.View style={[StyleSheet.absoluteFill, { 
                        borderRadius: borderRadius.value, 
                        overflow: 'hidden',
                        backgroundColor: 'transparent' 
                    }]}>
                            {children}
                    </Animated.View>
                </Animated.View>
            </Animated.View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        backgroundColor: 'transparent',
        overflow: 'visible',
    },
});

export default ZoomableMediaCard;
