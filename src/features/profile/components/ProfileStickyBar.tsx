// src/features/profile/components/ProfileStickyBar.tsx

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated as RNAnimated } from 'react-native';
import Reanimated, { useAnimatedStyle, interpolate, Extrapolation, SharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/theme/theme';
import { User } from '@/types/userTypes';
import { HEADER_HEIGHT } from '@/features/profile/utils/profileConstants';



interface ProfileStickyBarProps {
    user: User;
    isOwner?: boolean;
    scrollY: SharedValue<number>;
    animatedBarColor: any; // RNAnimated.AnimatedInterpolation
}

export const ProfileStickyBar: React.FC<ProfileStickyBarProps> = ({
    user,
    isOwner = false,
    scrollY,
    animatedBarColor,
}) => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const headerHeight = insets.top + 60; // Safe area + icon row height

    // Fade the sticky bar background in right before the original header leaves the screen
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

    return (
        <View style={[styles.container, { height: headerHeight, paddingTop: insets.top }]} pointerEvents="box-none">
            {/* 1. Animated solid background layer that fades in on scroll */}
            <Reanimated.View style={[StyleSheet.absoluteFill, barBgStyle]} pointerEvents="none">
                {/* Use the profile picture itself as the background. We make sure it fills the area.
                    Using an absolute absolute filling image creates a clean, matching aesthetic.
                */}
                <Reanimated.Image
                    source={{ uri: user.profilePicture }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                />

                {/* Darker overlay on top of the image to ensure the icons remain completely readable */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />

                {/* User preference: Little light linear gradient effect at the bottom */}
                <LinearGradient
                    colors={['rgba(0,0,0,0.4)', 'transparent']}
                    style={styles.bottomGradient}
                    pointerEvents="none"
                />
            </Reanimated.View>

            {/* 2. Header Row containing Icons */}
            <View style={styles.headerRow} pointerEvents="box-none">
                {/* Left — back */}
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

                {/* Center name */}
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

                {/* Right — settings (owner) or spacer */}
                {isOwner ? (
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
                ) : (
                    <View style={{ width: 40 }} />
                )}
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
        zIndex: 100, // Stay above everything else
    },
    bottomGradient: {
        position: 'absolute',
        bottom: -10, // Hangs slightly below the solid bar
        left: 0,
        right: 0,
        height: 10,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 10, // Padding below safe area
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
