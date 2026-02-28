// app/profile.tsx

import React, { useMemo, useEffect, useState } from 'react';
import {
    View,
    StyleSheet,
    StatusBar,
    Animated as RNAnimated,
    BackHandler,
    Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    interpolate,
    Extrapolation,
} from 'react-native-reanimated';

import { useLocalSearchParams } from 'expo-router';
import { useBackground, BackgroundProvider } from '@/contexts/BackgroundContext';
import usersData from '@/data/users.json';
import { User } from '@/types/userTypes';
import EditProfileScreen from '@/features/profile/components/EditProfileScreen';
import AddPartnerModal from '@/features/partners/components/AddPartnerModal';
import FloatingPartnerIcon from '@/features/partners/components/FloatingPartnerIcon';
import { CURRENT_USER_ID, PARTNER_KEY, BG_OPACITY, HEADER_HEIGHT } from '@/features/profile/utils/profileConstants';
import { hexToRgba } from '@/features/profile/utils/profileUtils';
import { useProfilePull } from '@/features/profile/hooks/useProfilePull';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { PartnerSection } from '@/features/profile/components/PartnerSection';
import YourPriorities from '@/features/profile/components/yourpriorities';
import { FilmsInProfile } from '@/features/profile/components/FilmsInProfile';
import { ProfileStickyBar } from '@/features/profile/components/ProfileStickyBar';

function ProfileScreenContent() {
    const { userId } = useLocalSearchParams<{ userId?: string }>();
    const effectiveUserId = userId || CURRENT_USER_ID;
    const isOwner = effectiveUserId === CURRENT_USER_ID;

    const { bgColor, prevBgColor, colorAnim, handleColorChange } = useBackground();
    const [isEditing, setIsEditing] = useState(false);
    const [isAddPartnerVisible, setIsAddPartnerVisible] = useState(false);
    const [savedPartnerUniqueUserId, setSavedPartnerUniqueUserId] = useState<string | null>(null);

    const scrollY = useSharedValue(0);

    const triggerEditMode = () => setIsEditing(true);
    const handleCloseEdit = () => setIsEditing(false);

    const {
        pullY,
        panGesture,
        headerAnimatedStyle,
        imageScaleStyle,
        partnerContainerStyle,
    } = useProfilePull(isOwner ? triggerEditMode : () => { });

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    // Capsule fades out + floats up slightly as user scrolls — iOS native feel
    const capsuleFadeStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [0, 70],
            [1, 0],
            Extrapolation.CLAMP
        );
        const translateY = interpolate(
            scrollY.value,
            [0, 100],
            [0, -80],
            Extrapolation.CLAMP
        );
        return {
            opacity,
            transform: [{ translateY }],
            display: scrollY.value > 120 ? 'none' : 'flex'
        };
    });

    // Priorities fade out as you scroll down
    const prioritiesFadeStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [40, 120],
            [1, 0],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    // Films section slides up to take the space of the faded priorities
    const filmsSlideUpStyle = useAnimatedStyle(() => {
        const translateY = interpolate(
            scrollY.value,
            [40, 140],
            [0, -130], // Approximate height of the YourPriorities section
            Extrapolation.CLAMP
        );
        return { transform: [{ translateY }] };
    });

    useEffect(() => {
        const onBackPress = () => {
            if (isEditing) {
                handleCloseEdit();
                return true;
            }
            return false;
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isEditing]);

    const currentUser = useMemo(() => {
        const user = (usersData as User[]).find((u) => u.uniqueUserId === effectiveUserId);
        return user || (usersData[0] as User);
    }, [effectiveUserId]);

    const handleRemovePartner = async () => {
        try {
            await AsyncStorage.removeItem(PARTNER_KEY);
            setSavedPartnerUniqueUserId(null);
        } catch (e) {
            console.error('Failed to remove partner:', e);
        }
    };

    useEffect(() => {
        const loadPartner = async () => {
            try {
                const stored = await AsyncStorage.getItem(PARTNER_KEY);
                if (stored) setSavedPartnerUniqueUserId(stored);
            } catch { }
        };
        loadPartner();
    }, []);

    const partnerUser = useMemo(() => {
        if (!savedPartnerUniqueUserId) return null;
        return (usersData as User[]).find((u) => u.uniqueUserId === savedPartnerUniqueUserId) || null;
    }, [savedPartnerUniqueUserId]);

    const lightDominantColor = useMemo(
        () => (currentUser ? hexToRgba(currentUser.dominantColor, BG_OPACITY) : 'rgba(255,255,255,1)'),
        [currentUser]
    );

    const solidDominantColor = useMemo(
        () => (currentUser ? hexToRgba(currentUser.dominantColor, 0.85) : 'rgba(255,255,255,0.85)'),
        [currentUser]
    );

    useEffect(() => {
        if (lightDominantColor) handleColorChange(lightDominantColor);
    }, [lightDominantColor, handleColorChange]);

    const animatedBgColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    const animatedCapsuleColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [
            prevBgColor.replace(/[\d.]+\)$/, '0.85)'),
            solidDominantColor,
        ],
    });

    if (!currentUser) return null;

    const relationshipLabel = isOwner
        ? 'Mine'
        : (currentUser.gender === 'male' ? 'His' : (currentUser.gender === 'female' ? 'Hers' : 'Theirs'));

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar barStyle="dark-content" />

            {/* Animated background wash */}
            <RNAnimated.View
                style={[StyleSheet.absoluteFill, { backgroundColor: animatedBgColor }]}
                pointerEvents="none"
            />

            {/* Sticky Top Bar that appears on scroll */}
            <ProfileStickyBar
                user={currentUser}
                isOwner={isOwner}
                scrollY={scrollY}
                animatedBarColor={animatedCapsuleColor}
            />

            <Reanimated.ScrollView
                style={styles.container}
                contentContainerStyle={[
                    styles.scrollContent,
                    { minHeight: Dimensions.get('window').height + HEADER_HEIGHT }
                ]}
                showsVerticalScrollIndicator={false}
                bounces={true}
                scrollEventThrottle={16}
                onScroll={scrollHandler}
            >
                {/* Pull gesture only wraps the header */}
                <GestureDetector gesture={panGesture}>
                    <View>
                        <ProfileHeader
                            user={currentUser}
                            isOwner={isOwner}
                            headerAnimatedStyle={headerAnimatedStyle}
                            imageScaleStyle={imageScaleStyle}
                        />
                    </View>
                </GestureDetector>

                {/*
                    When NO partner: show the "+ partner" capsule in normal scroll flow.
                    When partner EXISTS: capsule row is hidden — FloatingPartnerIcon
                    renders outside the ScrollView below (absolute, screen-relative).
                */}
                {isOwner && !partnerUser && (
                    <Reanimated.View style={[styles.capsuleRow, capsuleFadeStyle]}>
                        <PartnerSection
                            partnerUser={null}
                            relationshipLabel={relationshipLabel}
                            animatedBgColor={animatedBgColor}
                            animatedCapsuleColor={animatedCapsuleColor}
                            pullY={pullY}
                            partnerContainerStyle={partnerContainerStyle}
                            onAddPartner={() => setIsAddPartnerVisible(true)}
                            onRemovePartner={handleRemovePartner}
                        />
                    </Reanimated.View>
                )}

                <Reanimated.View style={prioritiesFadeStyle}>
                    <YourPriorities user={currentUser} />
                </Reanimated.View>

                {/* Wrapper to slide up the rest of the content */}
                <Reanimated.View style={filmsSlideUpStyle}>
                    <FilmsInProfile
                        userId={currentUser.uniqueUserId}
                        dominantColor={currentUser.dominantColor}
                    />
                    <View style={styles.bottomPad} />
                </Reanimated.View>
            </Reanimated.ScrollView>

            {/*
                FloatingPartnerIcon MUST live outside the ScrollView.
                Its style uses position: 'absolute', top: HEADER_HEIGHT which
                must be measured from the screen root — not from a scroll container.
                Placing it here (sibling to ScrollView, inside GestureHandlerRootView)
                gives it correct screen-relative positioning.
            */}
            {isOwner && partnerUser && (
                <FloatingPartnerIcon
                    partnerUser={partnerUser}
                    relationshipLabel={relationshipLabel}
                    animatedBgColor={animatedBgColor}
                    pullY={pullY}
                    scrollY={scrollY}
                    capsuleFadeStyle={capsuleFadeStyle}
                    onRemove={handleRemovePartner}
                />
            )}

            {isEditing && (
                <EditProfileScreen user={currentUser} onBack={handleCloseEdit} />
            )}

            <AddPartnerModal
                visible={isAddPartnerVisible}
                onClose={() => setIsAddPartnerVisible(false)}
                currentUserUniqueUserId={CURRENT_USER_ID}
                onSelectPartner={(selectedUserId) => {
                    setSavedPartnerUniqueUserId(selectedUserId);
                    AsyncStorage.setItem(PARTNER_KEY, selectedUserId).catch(() => { });
                }}
            />
        </GestureHandlerRootView>
    );
}

export default function ProfileScreen() {
    return (
        <BackgroundProvider>
            <ProfileScreenContent />
        </BackgroundProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 20,
    },
    capsuleRow: {
        // Only shown when no partner — "+ partner" capsule in scroll flow
        marginTop: -15,
        paddingHorizontal: 24,
        alignItems: 'flex-end',
    },
    bottomPad: {
        height: 60,
    },
});
