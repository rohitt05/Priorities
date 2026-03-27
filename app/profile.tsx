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

import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useBackground, BackgroundProvider } from '@/contexts/BackgroundContext';
import { User } from '@/types/userTypes';
import { supabase } from '@/lib/supabase';
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

    const capsuleFadeStyle = useAnimatedStyle(() => {
        const opacity = interpolate(scrollY.value, [0, 70], [1, 0], Extrapolation.CLAMP);
        const translateY = interpolate(scrollY.value, [0, 100], [0, -80], Extrapolation.CLAMP);
        return {
            opacity,
            transform: [{ translateY }],
            display: scrollY.value > 120 ? 'none' : 'flex'
        };
    });

    const prioritiesFadeStyle = useAnimatedStyle(() => {
        const opacity = interpolate(scrollY.value, [40, 120], [1, 0], Extrapolation.CLAMP);
        return { opacity };
    });

    const filmsSlideUpStyle = useAnimatedStyle(() => {
        const translateY = interpolate(scrollY.value, [40, 140], [0, -130], Extrapolation.CLAMP);
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

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [partnerUser, setPartnerUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // useFocusEffect re-fetches every time screen comes into focus
    // so profile picture updates from settings screen reflect immediately
    useFocusEffect(
        React.useCallback(() => {
            let isMounted = true;
            const fetchProfiles = async () => {
                try {
                    const sessionRes = await supabase.auth.getSession();
                    const sessionUser = sessionRes.data.session?.user;
                    if (!sessionUser) return;

                    let queryCol = 'unique_user_id';
                    let queryVal = effectiveUserId;
                    if (isOwner && (!effectiveUserId || effectiveUserId === CURRENT_USER_ID)) {
                        queryCol = 'id';
                        queryVal = sessionUser.id;
                    }

                    const { data: dbUser } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq(queryCol, queryVal)
                        .single();

                    if (dbUser && isMounted) {
                        const userObj: User = {
                            id: dbUser.id,
                            name: dbUser.name,
                            uniqueUserId: dbUser.unique_user_id,
                            profilePicture: dbUser.profile_picture || '',
                            dominantColor: dbUser.dominant_color || '#44562F',
                            gender: dbUser.gender || 'male',
                            birthday: dbUser.birthday || undefined,
                            partnerId: dbUser.partner_id || undefined,
                            relationship: dbUser.relationship || undefined,
                            priorities: [],
                        };
                        setCurrentUser(userObj);

                        const partnerId = isOwner ? savedPartnerUniqueUserId : dbUser.partner_id;
                        if (partnerId) {
                            const { data: pDbUser } = await supabase
                                .from('profiles')
                                .select('*')
                                .eq('unique_user_id', partnerId)
                                .single();
                            if (pDbUser && isMounted) {
                                setPartnerUser({
                                    id: pDbUser.id,
                                    name: pDbUser.name,
                                    uniqueUserId: pDbUser.unique_user_id,
                                    profilePicture: pDbUser.profile_picture || '',
                                    dominantColor: pDbUser.dominant_color || '#44562F',
                                    gender: pDbUser.gender || 'female',
                                    birthday: pDbUser.birthday || undefined,
                                    partnerId: pDbUser.partner_id || undefined,
                                    relationship: pDbUser.relationship || undefined,
                                    priorities: [],
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.error(error);
                } finally {
                    if (isMounted) setIsLoading(false);
                }
            };
            fetchProfiles();
            return () => { isMounted = false; };
        }, [effectiveUserId, isOwner, savedPartnerUniqueUserId])
    );

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

    const relationshipLabel = useMemo(() => {
        if (!currentUser) return '';
        if (isOwner) return 'Mine';
        const ownerGender = currentUser.gender || 'male';
        const possessive = ownerGender === 'male' ? 'his' : (ownerGender === 'female' ? 'hers' : 'theirs');
        if (CURRENT_USER_ID === currentUser.partnerId) {
            return `you're ${possessive}`;
        }
        return possessive.charAt(0).toUpperCase() + possessive.slice(1);
    }, [currentUser, isOwner]);

    if (isLoading) return null;
    if (!currentUser) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar barStyle="dark-content" />

            <RNAnimated.View
                style={[StyleSheet.absoluteFill, { backgroundColor: animatedBgColor }]}
                pointerEvents="none"
            />

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

                <Reanimated.View style={[prioritiesFadeStyle, { zIndex: 100 }]}>
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

                <Reanimated.View style={filmsSlideUpStyle}>
                    <FilmsInProfile
                        userId={currentUser.uniqueUserId}
                        dominantColor={currentUser.dominantColor}
                    />
                    <View style={styles.bottomPad} />
                </Reanimated.View>

            </Reanimated.ScrollView>

            {isEditing && (
                <EditProfileScreen
                    user={currentUser}
                    onBack={handleCloseEdit}
                    onSave={async (updatedUser) => {
                        setCurrentUser(updatedUser);
                    }}
                />
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
