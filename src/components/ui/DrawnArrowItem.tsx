import React, { useEffect, memo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { FONTS } from '@/theme/theme';
import * as Haptics from 'expo-haptics';
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    runOnJS,
} from 'react-native-reanimated';

const IOS_SPRING_CONFIG = {
    damping: 15,
    mass: 1,
    stiffness: 120,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
};

import { User } from '@/types/userTypes';

interface DrawnArrowItemProps {
    user: User;
    isSelected: boolean;
    onPress: () => void;
    width: number;
    height: number;
    style?: any;
}

export const DrawnArrowItem = memo(({ user, isSelected, onPress, width, height, style }: DrawnArrowItemProps) => {
    const scale = useSharedValue(1);
    const bubbleOpacity = useSharedValue(0);

    useEffect(() => {
        scale.value = withSpring(isSelected ? 0.95 : 1, IOS_SPRING_CONFIG);
    }, [isSelected]);

    const handlePressIn = () => {
        scale.value = withSpring(0.95, IOS_SPRING_CONFIG);
    };

    const handlePressOut = () => {
        scale.value = withSpring(isSelected ? 0.95 : 1, IOS_SPRING_CONFIG);
        bubbleOpacity.value = withTiming(0, { duration: 150 });
    };

    const handleLongPress = () => {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        bubbleOpacity.value = withTiming(1, { duration: 200 });
    };

    const animatedContainerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const bubbleStyle = useAnimatedStyle(() => ({
        opacity: bubbleOpacity.value,
        transform: [
            { translateY: interpolate(bubbleOpacity.value, [0, 1], [10, 0]) },
            { scale: interpolate(bubbleOpacity.value, [0, 1], [0.8, 1]) }
        ]
    }));

    // Calculate dynamic border radius based on width to ensure it's always a perfect circle/pill
    const borderRadius = width / 2;

    return (
        <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}>
            <Pressable
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onLongPress={handleLongPress}
                delayLongPress={300}
                style={{ flex: 1, width: '100%', height: '100%' }}
            >
                <Reanimated.View style={[{ flex: 1, width: '100%', height: '100%' }, animatedContainerStyle]}>

                    {/* BUBBLE NAME LABEL */}
                    <Reanimated.View style={[styles.bubbleContainer, bubbleStyle]}>
                        <View style={styles.bubbleContent}>
                            <Text style={styles.bubbleText} numberOfLines={1}>{user.name}</Text>
                        </View>
                        <View style={styles.bubbleArrow} />
                    </Reanimated.View>

                    {/* PROFILE PICTURE - Restored Circular Look */}
                    <View style={[styles.profileWrapper, { backgroundColor: user.dominantColor, borderRadius: borderRadius }]}>
                        <Image
                            source={{ uri: user.profilePicture }}
                            style={styles.image}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="memory-disk"
                        />

                        {/* Checkmark Overlay */}
                        {isSelected && (
                            <View style={[styles.checkmarkContainer, { borderRadius: borderRadius }]}>
                                <View style={styles.checkmarkCircle}>
                                    <Feather name="check" size={20} color="#000" />
                                </View>
                            </View>
                        )}
                    </View>

                </Reanimated.View>
            </Pressable>
        </View>
    );
});

const styles = StyleSheet.create({
    profileWrapper: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
        backgroundColor: '#f0f0f0',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    checkmarkContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    checkmarkCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
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
