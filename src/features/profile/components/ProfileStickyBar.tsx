// src/features/profile/components/ProfileStickyBar.tsx

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated as RNAnimated } from 'react-native';
import Reanimated, { useAnimatedStyle, interpolate, Extrapolation, SharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Entypo } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/theme/theme';
import { User } from '@/types/domain';
import { HEADER_HEIGHT } from '@/features/profile/utils/profileConstants';



interface ProfileStickyBarProps {
    user: User;
    isOwner?: boolean;
    isActuallyOwner?: boolean;
    scrollY: SharedValue<number>;
    animatedBarColor: any;
    onActionPress?: () => void;
}

export const ProfileStickyBar: React.FC<ProfileStickyBarProps> = ({
    user,
    isOwner = false,
    isActuallyOwner = false,
    scrollY,
    animatedBarColor,
    onActionPress,
}) => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const headerHeight = insets.top + 60;

    const fadeEnd = HEADER_HEIGHT - headerHeight;
    const fadeStart = fadeEnd - 40;

    const barBgStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [fadeStart, fadeEnd],
            [0, 1],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    // Determine what to show on the right side:
    // - isOwner (direct /profile route)      → settings icon
    // - isActuallyOwner but !isOwner          → nothing (own profile via @handle navigation)
    // - !isActuallyOwner                      → dots icon
    const renderRightIcon = () => {
        if (isOwner) {
            return (
                <Link href="/settings" asChild>
                    <TouchableOpacity
                        style={styles.iconButton}
                        hitSlop={12}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Open settings"
                    >
                        <Ionicons name="settings-outline" size={24} color="white" />
                    </TouchableOpacity>
                </Link>
            );
        }

        if (isActuallyOwner) {
            // Own profile reached via @handle — show nothing, just a spacer
            return <View style={styles.iconButton} />;
        }

        // Someone else's profile — show dots
        return (
            <TouchableOpacity
                style={styles.iconButton}
                hitSlop={12}
                onPress={onActionPress}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Profile actions"
            >
                <Entypo name="dots-two-horizontal" size={24} color="white" />
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { height: headerHeight, paddingTop: insets.top }]} pointerEvents="box-none">
            <Reanimated.View style={[StyleSheet.absoluteFill, barBgStyle]} pointerEvents="none">
                <Reanimated.Image
                    source={{ uri: user.profilePicture }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
                <LinearGradient
                    colors={['rgba(0,0,0,0.4)', 'transparent']}
                    style={styles.bottomGradient}
                    pointerEvents="none"
                />
            </Reanimated.View>

            <View style={styles.headerRow} pointerEvents="box-none">
                <TouchableOpacity
                    style={styles.iconButton}
                    hitSlop={12}
                    onPress={() => router.back()}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Ionicons name="chevron-back" size={24} color="white" />
                </TouchableOpacity>

                <View style={styles.nameCenterSlot} pointerEvents="none">
                    <Text
                        style={styles.name}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        accessible={true}
                        accessibilityRole="header"
                    >
                        {user.name}
                    </Text>
                </View>

                {renderRightIcon()}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    bottomGradient: {
        position: 'absolute',
        bottom: -10,
        left: 0,
        right: 0,
        height: 10,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 10,
    },
    iconButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    nameCenterSlot: {
        position: 'absolute',
        left: 60,
        right: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    name: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.surfaceLight,
        textShadowColor: 'rgba(0, 0, 0, 0.4)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
        letterSpacing: -0.2,
    },
});