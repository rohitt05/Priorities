// app/profile.tsx

import React, { useMemo, useEffect, useState } from 'react';
import {
    View,
    Text,
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
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';

import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
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
import ProfileActionModal from '@/features/profile/components/ProfileActionModal';

function ProfileScreenContent() {
    const { userId } = useLocalSearchParams<{ userId?: string }>();
    const effectiveUserId = userId || CURRENT_USER_ID;
    const isOwner = effectiveUserId === CURRENT_USER_ID;

    const { bgColor, prevBgColor, colorAnim, handleColorChange } = useBackground();
    const [isEditing, setIsEditing] = useState(false);
    const [isAddPartnerVisible, setIsAddPartnerVisible] = useState(false);
    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
    const [savedPartnerUniqueUserId, setSavedPartnerUniqueUserId] = useState<string | null>(null);
    const [showFlashBanner, setShowFlashBanner] = useState(false);
    const bannerTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

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
        const partnerId = isOwner ? savedPartnerUniqueUserId : currentUser.partnerId;
        if (!partnerId) return null;
        return (usersData as User[]).find((u) => u.uniqueUserId === partnerId) || null;
    }, [savedPartnerUniqueUserId, currentUser.partnerId, isOwner]);

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

    const relationshipLabel = useMemo(() => {
        if (isOwner) return 'Mine';
        
        const ownerGender = currentUser.gender || 'male';
        const possessive = ownerGender === 'male' ? 'his' : (ownerGender === 'female' ? 'hers' : 'theirs');
        
        // If viewer is the partner
        if (CURRENT_USER_ID === currentUser.partnerId) {
            return `you're ${possessive}`;
        }
        
        // General viewer sees capitalized possessive
        return possessive.charAt(0).toUpperCase() + possessive.slice(1);
    }, [currentUser, isOwner]);

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
                onActionPress={() => setIsActionModalVisible(true)}
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
                {/*
                    FloatingPartnerIcon is now INSIDE the ScrollView and rendered BEFORE Priorities.
                    This ensures Priorities (with higher zIndex) sit on top of it.
                */}
                {partnerUser && (
                    <FloatingPartnerIcon
                        partnerUser={partnerUser}
                        relationshipLabel={relationshipLabel}
                        animatedBgColor={animatedBgColor}
                        pullY={pullY}
                        scrollY={scrollY}
                        capsuleFadeStyle={capsuleFadeStyle}
                        onRemove={isOwner ? handleRemovePartner : undefined}
                    />
                )}

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

                <Reanimated.View 
                    style={[
                        prioritiesFadeStyle, 
                        { zIndex: 100 } // Elevated stacking context above the partner icon
                    ]}
                >
                    <YourPriorities 
                        user={currentUser} 
                        onUnauthorizedAccess={() => {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
                            setShowFlashBanner(true);
                            bannerTimeoutRef.current = setTimeout(() => {
                                setShowFlashBanner(false);
                            }, 2000);
                        }}
                    />
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

            <ProfileActionModal
                visible={isActionModalVisible}
                onClose={() => setIsActionModalVisible(false)}
                userId={currentUser.uniqueUserId}
                userName={currentUser.name}
            />

            {showFlashBanner && (
                <View style={styles.flashBannerContainer} pointerEvents="none">
                    <Reanimated.View 
                        entering={FadeIn.duration(200).springify().damping(15).stiffness(150)}
                        exiting={FadeOut.duration(200)}
                        style={styles.flashBanner}
                    >
                        <Text style={styles.flashBannerText} numberOfLines={1}>
                            Nahh, you can't just barge into someone like that here
                        </Text>
                    </Reanimated.View>
                </View>
            )}
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
    flashBannerContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    flashBanner: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 30,
        maxWidth: '90%',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 10,
    },
    flashBannerText: {
        color: '#FFFFFF',
        fontSize: 13,
        textAlign: 'center',
        fontWeight: '700',
        letterSpacing: -0.2,
    },
});
