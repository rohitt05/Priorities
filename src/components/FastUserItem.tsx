import React, { memo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import Reanimated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    runOnJS,
    useDerivedValue,
    SharedValue,
    interpolate
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { User } from '@/utils/gridUtils';
import { FONTS } from '@/constants/theme'; // Ensure you have this

const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    'worklet';
    runOnJS(Haptics.impactAsync)(style);
};

interface FastUserItemProps {
    user: User;
    width: number;
    height: number;
    isSelected: SharedValue<boolean>;
    onToggle: (id: string, newState: boolean) => void;
    style?: any;
}

const FastUserItem = memo(({ user, width, height, isSelected, onToggle, style }: FastUserItemProps) => {

    // --- ANIMATION VALUES ---
    const bubbleOpacity = useSharedValue(0);

    const progress = useDerivedValue(() => {
        return withSpring(isSelected.value ? 1 : 0, {
            damping: 12,
            stiffness: 150,
            mass: 0.8
        });
    });

    // --- STYLES ---

    // 1. Profile Scale (Pop effect)
    const animatedProfileStyle = useAnimatedStyle(() => {
        const scale = interpolate(progress.value, [0, 1], [1, 1.05]);
        return { transform: [{ scale }] };
    });

    // 2. Checkmark Scale (Bounce in)
    const checkmarkStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: progress.value }],
            opacity: progress.value
        };
    });

    // 3. Bubble Animation (Fade in + Slide up)
    const bubbleStyle = useAnimatedStyle(() => ({
        opacity: bubbleOpacity.value,
        transform: [
            { translateY: interpolate(bubbleOpacity.value, [0, 1], [10, 0]) },
            { scale: interpolate(bubbleOpacity.value, [0, 1], [0.8, 1]) }
        ]
    }));

    // --- HANDLERS ---

    const handlePress = () => {
        const nextState = !isSelected.value;
        isSelected.value = nextState;
        if (nextState) triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
        onToggle(user.id, nextState);
    };

    const handleLongPress = () => {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        bubbleOpacity.value = withTiming(1, { duration: 200 });
    };

    const handlePressOut = () => {
        // Hide bubble when finger lifts
        bubbleOpacity.value = withTiming(0, { duration: 150 });
    };

    const borderRadius = width / 2;

    return (
        <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}>
            <Pressable
                onPress={handlePress}
                onLongPress={handleLongPress}
                onPressOut={handlePressOut}
                delayLongPress={300}
                style={{ flex: 1, width: '100%', height: '100%' }}
            >
                <Reanimated.View style={[{ flex: 1, width: '100%', height: '100%' }, animatedProfileStyle]}>

                    {/* --- NAME BUBBLE --- */}
                    <Reanimated.View style={[styles.bubbleContainer, bubbleStyle]}>
                        <View style={styles.bubbleContent}>
                            <Text style={styles.bubbleText} numberOfLines={1}>{user.name}</Text>
                        </View>
                        <View style={styles.bubbleArrow} />
                    </Reanimated.View>

                    {/* --- PROFILE IMAGE --- */}
                    <View style={[styles.profileWrapper, { backgroundColor: user.dominantColor, borderRadius }]}>
                        <Image
                            source={{ uri: user.profilePicture }}
                            style={styles.image}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                        />

                        {/* --- CHECKMARK OVERLAY --- */}
                        <Reanimated.View style={[styles.checkmarkContainer, { borderRadius }, checkmarkStyle]}>
                            <View style={styles.checkmarkCircle}>
                                <Feather name="check" size={20} color="#000" />
                            </View>
                        </Reanimated.View>
                    </View>

                </Reanimated.View>
            </Pressable>
        </View>
    );
});

const styles = StyleSheet.create({
    profileWrapper: {
        width: '100%', height: '100%', overflow: 'hidden',
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
        backgroundColor: '#f0f0f0',
    },
    image: { width: '100%', height: '100%' },
    checkmarkContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 10
    },
    checkmarkCircle: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2, shadowRadius: 4, elevation: 3
    },
    // --- BUBBLE STYLES ---
    bubbleContainer: {
        position: 'absolute',
        top: -45,
        alignSelf: 'center',
        zIndex: 99,
        alignItems: 'center',
        pointerEvents: 'none',
    },
    bubbleContent: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(20,20,20,0.9)',
    },
    bubbleText: {
        fontFamily: FONTS.bold,
        fontSize: 12,
        color: '#FFF',
    },
    bubbleArrow: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: 'rgba(20,20,20,0.9)',
        marginTop: -1,
    }
});

export default FastUserItem;
