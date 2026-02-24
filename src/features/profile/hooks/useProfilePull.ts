import { useSharedValue, withSpring, withTiming, runOnJS, interpolate, Extrapolation, useAnimatedStyle } from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { TRIGGER_THRESHOLD, HEADER_HEIGHT } from '../utils/profileConstants';

export const useProfilePull = (onTrigger: () => void) => {
    const pullY = useSharedValue(0);
    const hasVibrated = useSharedValue(false);

    const triggerThresholdHaptic = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const panGesture = Gesture.Pan()
        .activeOffsetY([0, 20])
        .failOffsetX([-20, 20])
        .onUpdate((event) => {
            if (event.translationY > 0) {
                pullY.value = event.translationY * 0.5;
                if (pullY.value > TRIGGER_THRESHOLD && !hasVibrated.value) {
                    hasVibrated.value = true;
                    runOnJS(triggerThresholdHaptic)();
                } else if (pullY.value < TRIGGER_THRESHOLD && hasVibrated.value) {
                    hasVibrated.value = false;
                }
            }
        })
        .onEnd(() => {
            if (pullY.value > TRIGGER_THRESHOLD) {
                runOnJS(onTrigger)();
                pullY.value = withTiming(0, { duration: 0 });
            } else {
                pullY.value = withSpring(0, { damping: 15, stiffness: 120 });
            }
            hasVibrated.value = false;
        });

    const headerAnimatedStyle = useAnimatedStyle(() => {
        return { height: HEADER_HEIGHT + pullY.value };
    });

    const imageScaleStyle = useAnimatedStyle(() => {
        const scale = interpolate(pullY.value, [0, TRIGGER_THRESHOLD], [1, 1.15], Extrapolation.CLAMP);
        return { transform: [{ scale: scale }] };
    });

    const partnerContainerStyle = useAnimatedStyle(() => {
        return { transform: [{ translateY: pullY.value }] };
    });

    return {
        pullY,
        panGesture,
        headerAnimatedStyle,
        imageScaleStyle,
        partnerContainerStyle,
    };
};
