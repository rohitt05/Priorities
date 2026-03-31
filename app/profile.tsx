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

import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useBackground, BackgroundProvider } from '@/contexts/BackgroundContext';
import { User } from '@/types/userTypes';
import { supabase } from '@/lib/supabase';
import EditProfileScreen from '@/features/profile/components/EditProfileScreen';
import AddPartnerModal from '@/features/partners/components/AddPartnerModal';
import FloatingPartnerIcon from '@/features/partners/components/FloatingPartnerIcon';
import { BG_OPACITY, HEADER_HEIGHT } from '@/features/profile/utils/profileConstants';
import { useAuthUser } from '@/features/profile/hooks/useAuthUser';
import { hexToRgba } from '@/features/profile/utils/profileUtils';
import { useProfilePull } from '@/features/profile/hooks/useProfilePull';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { PartnerSection } from '@/features/profile/components/PartnerSection';
import YourPriorities from '@/features/profile/components/yourpriorities';
import { FilmsInProfile } from '@/features/profile/components/FilmsInProfile';
import { ProfileStickyBar } from '@/features/profile/components/ProfileStickyBar';
import ProfileActionModal from '@/features/profile/components/ProfileActionModal';
import { usePrioritiesRefresh } from '@/contexts/PrioritiesRefreshContext';
import { removePartner } from '@/services/partnerService';


function ProfileScreenContent() {
    const { userId } = useLocalSearchParams<{ userId?: string }>();
    const authId = useAuthUser();
    const router = useRouter();
    const { triggerRefresh } = usePrioritiesRefresh();

    const isOwner = !userId;
    const effectiveUserId = userId || authId || '';
    const [isActuallyOwner, setIsActuallyOwner] = useState(isOwner);

    const { bgColor, prevBgColor, colorAnim, handleColorChange } = useBackground();
    const [isEditing, setIsEditing] = useState(false);
    const [isAddPartnerVisible, setIsAddPartnerVisible] = useState(false);
    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
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
    } = useProfilePull(isActuallyOwner ? triggerEditMode : () => { });

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => { scrollY.value = event.contentOffset.y; },
    });

    const capsuleFadeStyle = useAnimatedStyle(() => {
        const opacity = interpolate(scrollY.value, [0, 70], [1, 0], Extrapolation.CLAMP);
        const translateY = interpolate(scrollY.value, [0, 100], [0, -80], Extrapolation.CLAMP);
        return {
            opacity,
            transform: [{ translateY }],
            display: scrollY.value > 120 ? 'none' : 'flex',
        };
    });

    const prioritiesFadeStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [40, 120], [1, 0], Extrapolation.CLAMP),
    }));

    const filmsSlideUpStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: interpolate(scrollY.value, [40, 140], [0, -130], Extrapolation.CLAMP) }],
    }));

    useEffect(() => {
        const onBackPress = () => {
            if (isEditing) { handleCloseEdit(); return true; }
            return false;
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isEditing]);

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [partnerUser, setPartnerUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // ── Helper: fetch and set partner profile by UUID ─────────────────────────
    const fetchAndSetPartner = React.useCallback(async (partnerId: string) => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', partnerId)
            .single();
        if (data) {
            setPartnerUser({
                id: data.id,
                name: data.name,
                uniqueUserId: data.unique_user_id,
                profilePicture: data.profile_picture || '',
                dominantColor: data.dominant_color || '#44562F',
                gender: data.gender || 'female',
                birthday: data.birthday || undefined,
                partnerId: data.partner_id || undefined,
                relationship: data.relationship || undefined,
                priorities: [],
            });
        }
    }, []);

    // ── Main profile fetch ────────────────────────────────────────────────────
    useFocusEffect(
        React.useCallback(() => {
            if (!authId) return;
            let isMounted = true;

            const fetchProfiles = async () => {
                try {
                    const { data: dbUser } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq(isOwner ? 'id' : 'unique_user_id', isOwner ? authId : effectiveUserId)
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
                        if (isMounted) setIsActuallyOwner(dbUser.id === authId);

                        if (dbUser.partner_id) {
                            await fetchAndSetPartner(dbUser.partner_id);
                        } else {
                            if (isMounted) setPartnerUser(null);
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
        }, [authId, effectiveUserId, isOwner, fetchAndSetPartner])
    );

    // ── Realtime: watch for accepted partner requests where I am the SENDER ───
    // This makes the sender's screen auto-update when the receiver accepts —
    // no metro restart needed, no manual refresh.
    useEffect(() => {
        if (!authId || !isActuallyOwner) return;

        const channel = supabase
            .channel(`profile_partner_watch_${authId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'partner_requests',
                    filter: `sender_id=eq.${authId}`,
                },
                async (payload: any) => {
                    const row = payload.new;
                    if (!row) return;
                    if (row.status === 'accepted') {
                        // My outgoing request was accepted — fetch and show partner immediately
                        await fetchAndSetPartner(row.receiver_id);
                    } else if (row.status === 'declined') {
                        // Do nothing — partner section just stays as "+ partner"
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${authId}`,
                },
                async (payload: any) => {
                    const row = payload.new;
                    if (!row) return;
                    if (row.partner_id) {
                        // My own profile's partner_id was set (e.g. I accepted someone)
                        await fetchAndSetPartner(row.partner_id);
                    } else {
                        // partner_id was cleared — remove partner from UI
                        setPartnerUser(null);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [authId, isActuallyOwner, fetchAndSetPartner]);

    // ── Remove partner — nulls BOTH sides ─────────────────────────────────────
    const handleRemovePartner = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id && partnerUser?.id) {
                await removePartner(session.user.id, partnerUser.id);
            }
            setPartnerUser(null);
        } catch (e) {
            console.error('Failed to remove partner:', e);
        }
    };

    const lightDominantColor = useMemo(
        () => currentUser ? hexToRgba(currentUser.dominantColor, BG_OPACITY) : 'rgba(255,255,255,1)',
        [currentUser]
    );
    const solidDominantColor = useMemo(
        () => currentUser ? hexToRgba(currentUser.dominantColor, 0.85) : 'rgba(255,255,255,0.85)',
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
        if (isActuallyOwner) return 'Mine';
        const ownerGender = currentUser.gender || 'male';
        const possessive = ownerGender === 'male' ? 'his' : (ownerGender === 'female' ? 'hers' : 'theirs');
        if (authId === currentUser.partnerId) return `you're ${possessive}`;
        return possessive.charAt(0).toUpperCase() + possessive.slice(1);
    }, [currentUser, isActuallyOwner, authId]);

    if (!authId || isLoading) return null;
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
                isActuallyOwner={isActuallyOwner}
                scrollY={scrollY}
                animatedBarColor={animatedCapsuleColor}
                onActionPress={() => setIsActionModalVisible(true)}
            />

            <Reanimated.ScrollView
                style={styles.container}
                contentContainerStyle={[
                    styles.scrollContent,
                    { minHeight: Dimensions.get('window').height + HEADER_HEIGHT },
                ]}
                showsVerticalScrollIndicator={false}
                bounces
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

                {/* Partner icon — visible to EVERYONE who views this profile */}
                {partnerUser && (
                    <FloatingPartnerIcon
                        partnerUser={partnerUser}
                        relationshipLabel={relationshipLabel}
                        animatedBgColor={animatedBgColor}
                        pullY={pullY}
                        scrollY={scrollY}
                        capsuleFadeStyle={capsuleFadeStyle}
                        isOwner={isActuallyOwner}
                        onRemove={isActuallyOwner ? handleRemovePartner : undefined}
                    />
                )}

                {/* + partner capsule — only shown to actual owner when no partner */}
                {isActuallyOwner && !partnerUser && (
                    <Reanimated.View style={[styles.capsuleRow, capsuleFadeStyle]}>
                        <PartnerSection
                            animatedCapsuleColor={animatedCapsuleColor}
                            onAddPartner={() => setIsAddPartnerVisible(true)}
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
                            bannerTimeoutRef.current = setTimeout(() => setShowFlashBanner(false), 2000);
                        }}
                    />
                </Reanimated.View>

                <Reanimated.View style={filmsSlideUpStyle}>
                    <FilmsInProfile
                        userUUID={currentUser.id}
                        dominantColor={currentUser.dominantColor}
                    />
                    <View style={styles.bottomPad} />
                </Reanimated.View>

            </Reanimated.ScrollView>

            {isActuallyOwner && isEditing && (
                <EditProfileScreen
                    user={currentUser}
                    onBack={handleCloseEdit}
                    onSave={async (updatedUser) => { setCurrentUser(updatedUser); }}
                />
            )}

            {isActuallyOwner && (
                <AddPartnerModal
                    visible={isAddPartnerVisible}
                    onClose={() => setIsAddPartnerVisible(false)}
                    currentUserUniqueUserId={currentUser?.uniqueUserId || ''}
                    onPartnerAccepted={async (partnerUUID: string) => {
                        await fetchAndSetPartner(partnerUUID);
                    }}
                />
            )}

            {!isActuallyOwner && (
                <ProfileActionModal
                    visible={isActionModalVisible}
                    onClose={() => setIsActionModalVisible(false)}
                    userId={currentUser.uniqueUserId}
                    userName={currentUser.name}
                    authId={authId}
                    targetUUID={currentUser.id}
                    onRemoved={() => { triggerRefresh(); router.back(); }}
                    onBlocked={() => { triggerRefresh(); router.back(); }}
                />
            )}

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
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingBottom: 20 },
    capsuleRow: {
        marginTop: -15,
        paddingHorizontal: 24,
        alignItems: 'flex-end',
    },
    bottomPad: { height: 60 },
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