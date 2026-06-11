import React, { useMemo, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Animated as RNAnimated,
    BackHandler,
    Dimensions,
    InteractionManager,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { GestureHandlerRootView, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    useAnimatedProps,
    interpolate,
    Extrapolation,
    FadeIn,
    FadeOut,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { MaterialCommunityIcons, Entypo, Ionicons } from '@expo/vector-icons';

import { useLocalSearchParams, useFocusEffect, useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useBackground, BackgroundProvider } from '@/contexts/BackgroundContext';
import { ProfileVideoUploadProvider, useProfileVideoUpload } from '@/contexts/ProfileVideoUploadContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { User } from '@/types/userTypes';
import { supabase } from '@/lib/supabase';
import { appRefreshOrchestrator } from '@/services/AppRefreshOrchestrator';
import EditProfileScreen from '@/features/profile/components/EditProfileScreen';
import AddPartnerModal from '@/features/partners/components/AddPartnerModal';
import FloatingPartnerIcon from '@/features/partners/components/FloatingPartnerIcon';
import FloatingProfilePic from '@/features/profile/components/FloatingProfilePic';
import { BG_OPACITY, HEADER_HEIGHT } from '@/features/profile/utils/profileConstants';
import { useAuthUser } from '@/features/profile/hooks/useAuthUser';
import { hexToRgba } from '@/features/profile/utils/profileUtils';
import { useProfilePull } from '@/features/profile/hooks/useProfilePull';
import { PartnerSection } from '@/features/profile/components/PartnerSection';
import YourPriorities from '@/features/profile/components/yourpriorities';
import { FilmsInProfile } from '@/features/profile/components/FilmsInProfile';
import { ProfileStickyBar } from '@/features/profile/components/ProfileStickyBar';
import ProfileActionModal from '@/features/profile/components/ProfileActionModal';
import { usePrioritiesRefresh } from '@/contexts/PrioritiesRefreshContext';
import { removePartner } from '@/services/partnerService';
import { sendPriorityRequest } from '@/services/priorityService';
import { ProfileHeader, HeaderAccessState } from '@/features/profile/components/ProfileHeader';
import { COLORS, FONTS } from '@/theme/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const OVERLAY_DURATION = 1260;
const ICON_DURATION = 940;
const CONTENT_DELAY = 400;
const CONTENT_DURATION = 520;

function ProfileScreenContent() {
    const { userId, flowEntry, flowSide } = useLocalSearchParams<{
        userId?: string;
        flowEntry?: string;
        flowSide?: 'left' | 'right';
    }>();
    const authId = useAuthUser();
    const router = useRouter();
    const { triggerRefresh } = usePrioritiesRefresh();
    const { onVideoReadyRef } = useProfileVideoUpload();

    const isOwner = !userId;
    const effectiveUserId = userId || authId || '';
    const [isActuallyOwner, setIsActuallyOwner] = useState(isOwner);

    const { bgColor, prevBgColor, colorAnim, handleColorChange } = useBackground();
    const [isEditing, setIsEditing] = useState(false);
    const [isAddPartnerVisible, setIsAddPartnerVisible] = useState(false);
    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
    const [showFlashBanner, setShowFlashBanner] = useState(false);
    const bannerTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const [headerAccessState, setHeaderAccessState] = useState<HeaderAccessState>('loading');
    const [filmsCount, setFilmsCount] = useState<number | null>(null);
    const [isSendingRequest, setIsSendingRequest] = useState(false);
    const { triggerNotificationHaptic, triggerHaptic } = useHapticFeedback();

    const handleSendRequest = async () => {
        if (!authId || !currentUser?.id || isSendingRequest) return;
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        setIsSendingRequest(true);
        try {
            await sendPriorityRequest(authId, currentUser.id);
            setHeaderAccessState('pending');
            triggerNotificationHaptic(Haptics.NotificationFeedbackType.Success);
        } catch (e: any) {
            if (e?.code === '23505') setHeaderAccessState('pending');
        } finally {
            setIsSendingRequest(false);
        }
    };

    const isScrollEnabled = useMemo(() => {
        if (headerAccessState !== 'allowed') return false;
        if (filmsCount === null) return true;
        return filmsCount > 0;
    }, [headerAccessState, filmsCount]);

    const scrollY = useSharedValue(0);
    const triggerEditMode = () => setIsEditing(true);
    const handleCloseEdit = () => setIsEditing(false);

    const {
        pullY,
        panGesture,
        headerAnimatedStyle,
        imageScaleStyle,
    } = useProfilePull(isActuallyOwner ? triggerEditMode : () => { });

    const overlay = useSharedValue(flowEntry === '1' ? 0 : 1);
    const washPrimary = useSharedValue(flowEntry === '1' ? 0 : 1);
    const washSecondary = useSharedValue(flowEntry === '1' ? 0 : 1);
    const iconTravel = useSharedValue(flowEntry === '1' ? 0 : 1);
    const iconAura = useSharedValue(flowEntry === '1' ? 0 : 1);
    const contentEntry = useSharedValue(flowEntry === '1' ? 0 : 1);

    useEffect(() => {
        if (flowEntry === '1') {
            overlay.value = withTiming(1, {
                duration: OVERLAY_DURATION,
                easing: Easing.bezier(0.16, 1, 0.3, 1),
            });

            washPrimary.value = withTiming(1, {
                duration: 980,
                easing: Easing.bezier(0.16, 1, 0.3, 1),
            });

            setTimeout(() => {
                washSecondary.value = withTiming(1, {
                    duration: 1100,
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                });
            }, 120);

            iconAura.value = withTiming(1, {
                duration: 820,
                easing: Easing.out(Easing.cubic),
            });

            setTimeout(() => {
                iconTravel.value = withTiming(1, {
                    duration: ICON_DURATION,
                    easing: Easing.bezier(0.2, 0.9, 0.22, 1),
                });
            }, 30);

            const timer = setTimeout(() => {
                contentEntry.value = withTiming(1, {
                    duration: CONTENT_DURATION,
                    easing: Easing.bezier(0.22, 1, 0.36, 1),
                });
            }, CONTENT_DELAY);

            return () => clearTimeout(timer);
        }
    }, [flowEntry, overlay, washPrimary, washSecondary, iconTravel, iconAura, contentEntry]);

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
            display: scrollY.value > 120 ? 'none' : 'flex',
        };
    });

    const prioritiesFadeStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [40, 120], [1, 0], Extrapolation.CLAMP),
        zIndex: scrollY.value > 80 ? -1 : 100,
    }));

    const prioritiesPointerProps = useAnimatedProps(() => ({
        pointerEvents: scrollY.value > 80 ? 'none' : 'auto',
    } as any));

    const filmsSlideUpStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: interpolate(scrollY.value, [40, 140], [0, -130], Extrapolation.CLAMP) }],
    }));

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

    // Register callback so background video uploads can update currentUser
    useEffect(() => {
        onVideoReadyRef.current = (url: string | null) => {
            setCurrentUser((prev) => prev ? { ...prev, profileVideo: url ?? undefined } : prev);
        };
        return () => { onVideoReadyRef.current = null; };
    }, [onVideoReadyRef]);

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
                uniqueUserId: data.unique_user_id ?? '',
                profilePicture: data.profile_picture || '',
                dominantColor: data.dominant_color || '#44562F',
                gender: data.gender || 'female',
                birthday: data.birthday || undefined,
                partnerId: data.partner_id || undefined,
                relationship: data.relationship || undefined,
                profileVideo: data.profile_video || null,
                priorities: [],
            });
        }
    }, []);

    const lastFetch = React.useRef(0);

    useFocusEffect(
        React.useCallback(() => {
            if (!authId) return;
            if (Date.now() - lastFetch.current < 5 * 60 * 1000) return;
            lastFetch.current = Date.now();

            let isMounted = true;
            let task: { cancel: () => void } | null = null;

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
                            uniqueUserId: dbUser.unique_user_id ?? '',
                            profilePicture: dbUser.profile_picture || '',
                            dominantColor: dbUser.dominant_color || '#44562F',
                            gender: dbUser.gender || 'male',
                            birthday: dbUser.birthday || undefined,
                            partnerId: dbUser.partner_id || undefined,
                            relationship: dbUser.relationship || undefined,
                            profileVideo: dbUser.profile_video || null,
                            priorities: [],
                        };
                        setCurrentUser(userObj);

                        const actuallyOwner = dbUser.id === authId;
                        if (isMounted) setIsActuallyOwner(actuallyOwner);

                        if (dbUser.partner_id) {
                            await fetchAndSetPartner(dbUser.partner_id);
                        } else {
                            if (isMounted) setPartnerUser(null);
                        }

                        if (actuallyOwner) {
                            if (isMounted) setHeaderAccessState('allowed');
                        } else {
                            const [{ data: priorityRow }, { data: pendingRow }] = await Promise.all([
                                supabase
                                    .from('priorities')
                                    .select('id')
                                    .eq('user_id', authId)
                                    .eq('priority_user_id', dbUser.id)
                                    .maybeSingle(),
                                supabase
                                    .from('priority_requests')
                                    .select('id')
                                    .eq('sender_id', authId)
                                    .eq('receiver_id', dbUser.id)
                                    .eq('status', 'pending')
                                    .maybeSingle(),
                            ]);

                            if (isMounted) {
                                setHeaderAccessState(
                                    priorityRow ? 'allowed'
                                        : pendingRow ? 'pending'
                                            : 'locked'
                                );
                            }
                        }
                    }
                } catch (error) {
                    console.error(error);
                } finally {
                    if (isMounted) setIsLoading(false);
                }
            };

            task = InteractionManager.runAfterInteractions(() => {
                if (isMounted) fetchProfiles();
            });

            return () => {
                isMounted = false;
                if (task) task.cancel();
            };
        }, [authId, effectiveUserId, isOwner, fetchAndSetPartner])
    );

    useEffect(() => {
        if (!authId || !isActuallyOwner) return;

        const offPartner = appRefreshOrchestrator.on('partner-requests', async (payload: any) => {
            if (payload?.eventType === 'UPDATE') {
                const row = payload.new;
                if (row && row.sender_id === authId && row.status === 'accepted') {
                    await fetchAndSetPartner(row.receiver_id);
                }
            }
        });

        const offProfile = appRefreshOrchestrator.on('profile', async (payload: any) => {
            const row = payload?.new;
            if (!row) return;
            if (row.partner_id) {
                await fetchAndSetPartner(row.partner_id);
            } else {
                setPartnerUser(null);
            }
        });

        return () => {
            offPartner();
            offProfile();
        };
    }, [authId, isActuallyOwner, fetchAndSetPartner]);

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

    const dominantHex = currentUser?.dominantColor || '#FAD1D8';
    const lightDominantColor = useMemo(
        () => currentUser ? hexToRgba(dominantHex, 0.30) : 'rgba(255,255,255,1)',
        [currentUser, dominantHex]
    );
    const solidDominantColor = useMemo(
        () => currentUser ? hexToRgba(dominantHex, 0.92) : 'rgba(255,255,255,0.92)',
        [currentUser, dominantHex]
    );
    const washPrimaryColor = useMemo(
        () => currentUser ? hexToRgba(dominantHex, 0.24) : COLORS.PALETTE.peachPuff,
        [currentUser, dominantHex]
    );
    const washSecondaryColor = useMemo(
        () => currentUser ? hexToRgba(dominantHex, 0.16) : COLORS.PALETTE.warmSand,
        [currentUser, dominantHex]
    );
    const washTertiaryColor = useMemo(
        () => currentUser ? hexToRgba(dominantHex, 0.12) : COLORS.PALETTE.blushPetal,
        [currentUser, dominantHex]
    );
    const heroHaloColor = useMemo(
        () => currentUser ? hexToRgba(dominantHex, 0.20) : COLORS.PALETTE.blushPetal,
        [currentUser, dominantHex]
    );
    const heroGlowColor = useMemo(
        () => currentUser ? hexToRgba(dominantHex, 0.28) : COLORS.PALETTE.peachPuff,
        [currentUser, dominantHex]
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
            prevBgColor.replace(/([\d.]+)\)$/, '0.92)'),
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

    const ambientStyle = useAnimatedStyle(() => ({
        opacity: interpolate(overlay.value, [0, 0.2, 1], [0, 1, 1], Extrapolation.CLAMP),
    }));

    const primaryWashStyle = useAnimatedStyle(() => ({
        opacity: interpolate(washPrimary.value, [0, 0.35, 0.78, 1], [0, 0.58, 0.26, 0.12], Extrapolation.CLAMP),
        transform: [
            { translateX: interpolate(washPrimary.value, [0, 1], [24, 0], Extrapolation.CLAMP) },
            { translateY: interpolate(washPrimary.value, [0, 1], [-16, 0], Extrapolation.CLAMP) },
            { scale: interpolate(washPrimary.value, [0, 1], [0.92, 1.08], Extrapolation.CLAMP) },
        ],
    }));

    const secondaryWashStyle = useAnimatedStyle(() => ({
        opacity: interpolate(washSecondary.value, [0, 0.32, 0.78, 1], [0, 0.3, 0.16, 0.08], Extrapolation.CLAMP),
        transform: [
            { translateX: interpolate(washSecondary.value, [0, 1], [-18, 0], Extrapolation.CLAMP) },
            { translateY: interpolate(washSecondary.value, [0, 1], [22, 0], Extrapolation.CLAMP) },
            { scale: interpolate(washSecondary.value, [0, 1], [0.96, 1.04], Extrapolation.CLAMP) },
        ],
    }));

    const tertiaryWashStyle = useAnimatedStyle(() => ({
        opacity: interpolate(overlay.value, [0, 0.45, 1], [0, 0.1, 0.05], Extrapolation.CLAMP),
        transform: [
            { scale: interpolate(overlay.value, [0, 1], [0.98, 1.02], Extrapolation.CLAMP) },
        ],
    }));

    const heroIconStyle = useAnimatedStyle(() => {
        const isRightSide = flowSide !== 'left';
        const startX = isRightSide ? SCREEN_WIDTH * 0.395 : -SCREEN_WIDTH * 0.395;
        const midX = isRightSide ? SCREEN_WIDTH * 0.08 : -SCREEN_WIDTH * 0.08;
        const endX = 0;
        const startY = -SCREEN_HEIGHT * 0.335;
        const floatY = -SCREEN_HEIGHT * 0.13;
        const settleY = -SCREEN_HEIGHT * 0.02;
        const endY = 0;
        const p = iconTravel.value;

        const translateX =
            p < 0.58
                ? interpolate(p, [0, 0.58], [startX, midX], Extrapolation.CLAMP)
                : interpolate(p, [0.58, 1], [midX, endX], Extrapolation.CLAMP);

        const translateY =
            p < 0.38
                ? interpolate(p, [0, 0.38], [startY, floatY], Extrapolation.CLAMP)
                : p < 0.78
                    ? interpolate(p, [0.38, 0.78], [floatY, settleY], Extrapolation.CLAMP)
                    : interpolate(p, [0.78, 1], [settleY, endY], Extrapolation.CLAMP);

        return {
            opacity: interpolate(p, [0, 0.7, 0.9, 1], [1, 1, 0.38, 0], Extrapolation.CLAMP),
            transform: [
                { translateX },
                { translateY },
                { scale: interpolate(p, [0, 0.5, 0.82, 1], [1, 2.35, 3.45, 4.1], Extrapolation.CLAMP) },
                { rotate: `${interpolate(p, [0, 0.55, 1], [10, 2, 0], Extrapolation.CLAMP)}deg` },
            ],
        };
    });

    const heroIconInnerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(iconTravel.value, [0, 0.82, 1], [1, 0.94, 0], Extrapolation.CLAMP),
        transform: [
            { scale: interpolate(iconTravel.value, [0, 0.64, 1], [1, 1.06, 1.1], Extrapolation.CLAMP) },
        ],
    }));

    const heroGlowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(iconAura.value, [0, 0.24, 0.72, 1], [0, 0.26, 0.14, 0], Extrapolation.CLAMP),
        transform: [
            { scale: interpolate(iconAura.value, [0, 1], [0.76, 4.8], Extrapolation.CLAMP) },
        ],
    }));

    const heroHaloStyle = useAnimatedStyle(() => ({
        opacity: interpolate(iconAura.value, [0, 0.3, 0.8, 1], [0, 0.18, 0.08, 0], Extrapolation.CLAMP),
        transform: [
            { scale: interpolate(iconAura.value, [0, 1], [0.65, 6.1], Extrapolation.CLAMP) },
        ],
    }));

    const contentEntryStyle = useAnimatedStyle(() => ({
        opacity: interpolate(contentEntry.value, [0, 1], [0, 1], Extrapolation.CLAMP),
        transform: [
            { translateY: interpolate(contentEntry.value, [0, 1], [34, 0], Extrapolation.CLAMP) },
            { scale: interpolate(contentEntry.value, [0, 1], [0.982, 1], Extrapolation.CLAMP) },
        ],
    }));

    if (!authId || isLoading) return null;
    if (!currentUser) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack.Screen
                options={{
                    headerShown: false,
                    animation: 'none',
                    gestureEnabled: false,
                }}
            />
            <StatusBar barStyle="dark-content" />

            <RNAnimated.View
                style={[StyleSheet.absoluteFill, { backgroundColor: animatedBgColor }]}
                pointerEvents="none"
            />

            <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, ambientStyle]}>
                <Reanimated.View style={[styles.gradientWashPrimary, { backgroundColor: washPrimaryColor }, primaryWashStyle]} />
                <Reanimated.View style={[styles.gradientWashSecondary, { backgroundColor: washSecondaryColor }, secondaryWashStyle]} />
                <Reanimated.View style={[styles.gradientWashTertiary, { backgroundColor: washTertiaryColor }, tertiaryWashStyle]} />
            </Reanimated.View>

            {flowEntry === '1' && (
                <View pointerEvents="none" style={styles.heroIconLayer}>
                    <Reanimated.View style={[styles.heroIconHalo, { backgroundColor: heroHaloColor }, heroHaloStyle]} />
                    <Reanimated.View style={[styles.heroIconGlow, { backgroundColor: heroGlowColor }, heroGlowStyle]} />
                    <Reanimated.View style={[styles.heroIconWrap, heroIconStyle]}>
                        <Reanimated.View style={[styles.heroIconInner, heroIconInnerStyle]}>
                            <MaterialCommunityIcons name="face-man-profile" size={38} color={currentUser.dominantColor || COLORS.primary} />
                        </Reanimated.View>
                    </Reanimated.View>
                </View>
            )}

            <Reanimated.View style={[styles.screenFill, contentEntryStyle]}>
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
                    scrollEnabled={isScrollEnabled}
                >
                    <GestureDetector gesture={panGesture}>
                        <View>
                            <ProfileHeader
                                user={currentUser}
                                isOwner={isOwner}
                                headerAnimatedStyle={headerAnimatedStyle}
                                imageScaleStyle={imageScaleStyle}
                            />
                            {!!currentUser.profileVideo && (
                                <FloatingProfilePic
                                    profilePicture={currentUser.profilePicture}
                                    pullY={pullY}
                                    scrollY={scrollY}
                                    capsuleFadeStyle={capsuleFadeStyle}
                                />
                            )}
                        </View>
                    </GestureDetector>

                    {partnerUser && headerAccessState === 'allowed' && (
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

                    {isActuallyOwner && !partnerUser && (
                        <Reanimated.View style={[styles.capsuleRow, capsuleFadeStyle]}>
                            <PartnerSection
                                animatedCapsuleColor={animatedCapsuleColor}
                                onAddPartner={() => setIsAddPartnerVisible(true)}
                            />
                        </Reanimated.View>
                    )}

                    {/* Add to Priorities Below Area Card */}
                    {(headerAccessState === 'locked' || headerAccessState === 'pending') && (
                        <View style={styles.lockedBelowContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.lockedBelowButton,
                                    headerAccessState === 'pending' && styles.lockedBelowButtonPending,
                                ]}
                                activeOpacity={0.8}
                                onPress={headerAccessState === 'locked' ? handleSendRequest : undefined}
                                disabled={headerAccessState === 'pending' || isSendingRequest}
                            >
                                {isSendingRequest ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : headerAccessState === 'pending' ? (
                                    <>
                                        <Ionicons name="checkmark-circle" size={20} color="rgba(67, 61, 53, 0.6)" />
                                        <Text style={styles.lockedBelowButtonTextPending}>Request sent</Text>
                                    </>
                                ) : (
                                    <>
                                        <Ionicons name="add" size={20} color="#fff" />
                                        <Text style={styles.lockedBelowButtonText}>Add to Priorities</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            <Text style={styles.lockedBelowSubtitle}>
                                {headerAccessState === 'pending'
                                    ? "Waiting for them to accept your request"
                                    : `Add ${currentUser.name} to see their priorities and films`}
                            </Text>
                        </View>
                    )}

                    <Reanimated.View style={prioritiesFadeStyle} animatedProps={prioritiesPointerProps}>
                        {headerAccessState === 'allowed' && (
                            <YourPriorities
                                user={currentUser}
                                hasProfileVideo={!!currentUser.profileVideo}
                                onUnauthorizedAccess={() => {
                                    triggerNotificationHaptic(Haptics.NotificationFeedbackType.Warning);
                                    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
                                    setShowFlashBanner(true);
                                    bannerTimeoutRef.current = setTimeout(() => setShowFlashBanner(false), 2000);
                                }}
                            />
                        )}
                    </Reanimated.View>

                    <Reanimated.View style={filmsSlideUpStyle}>
                        {headerAccessState === 'allowed' && (
                            <FilmsInProfile
                                userUUID={currentUser.id}
                                dominantColor={currentUser.dominantColor}
                                isOwner={isActuallyOwner}
                                scrollY={scrollY}
                                onFilmsCountChange={setFilmsCount}
                            />
                        )}
                        <View style={styles.bottomPad} />
                    </Reanimated.View>
                </Reanimated.ScrollView>
            </Reanimated.View>

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
        <ProfileVideoUploadProvider>
            <BackgroundProvider>
                <ProfileScreenContent />
            </BackgroundProvider>
        </ProfileVideoUploadProvider>
    );
}

const styles = StyleSheet.create({
    screenFill: {
        flex: 1,
    },
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingBottom: 20 },
    capsuleRow: {
        marginTop: -15,
        paddingHorizontal: 24,
        alignItems: 'flex-end',
    },
    bottomPad: { height: 60 },
    lockedBelowContainer: {
        marginTop: 40,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    lockedBelowButton: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 25,
        gap: 8,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 4,
    },
    lockedBelowButtonPending: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: 'rgba(67, 61, 53, 0.3)',
        shadowOpacity: 0,
        elevation: 0,
    },
    lockedBelowButtonText: {
        color: '#fff',
        fontSize: 15,
        fontFamily: FONTS.bold,
        letterSpacing: 0.2,
    },
    lockedBelowButtonTextPending: {
        color: 'rgba(67, 61, 53, 0.6)',
        fontSize: 15,
        fontFamily: FONTS.bold,
        letterSpacing: 0.2,
    },
    lockedBelowSubtitle: {
        marginTop: 12,
        color: 'rgba(67, 61, 53, 0.5)',
        fontSize: 12,
        fontFamily: FONTS.medium,
        textAlign: 'center',
        lineHeight: 18,
    },
    gradientWashPrimary: {
        position: 'absolute',
        top: -SCREEN_HEIGHT * 0.1,
        right: -SCREEN_WIDTH * 0.26,
        width: SCREEN_WIDTH * 1.18,
        height: SCREEN_HEIGHT * 0.5,
        borderBottomLeftRadius: 260,
        borderBottomRightRadius: 240,
        borderTopLeftRadius: 210,
    },
    gradientWashSecondary: {
        position: 'absolute',
        top: SCREEN_HEIGHT * 0.18,
        left: -SCREEN_WIDTH * 0.18,
        width: SCREEN_WIDTH * 0.94,
        height: SCREEN_HEIGHT * 0.4,
        borderTopRightRadius: 240,
        borderBottomRightRadius: 250,
        borderTopLeftRadius: 170,
        borderBottomLeftRadius: 170,
    },
    gradientWashTertiary: {
        position: 'absolute',
        bottom: -SCREEN_HEIGHT * 0.03,
        right: -SCREEN_WIDTH * 0.12,
        width: SCREEN_WIDTH * 1.02,
        height: SCREEN_HEIGHT * 0.32,
        borderTopLeftRadius: 200,
        borderTopRightRadius: 210,
    },
    heroIconLayer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 15,
    },
    heroIconHalo: {
        position: 'absolute',
        width: 132,
        height: 132,
        borderRadius: 66,
    },
    heroIconGlow: {
        position: 'absolute',
        width: 112,
        height: 112,
        borderRadius: 56,
    },
    heroIconWrap: {
        width: 78,
        height: 78,
        borderRadius: 39,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(253, 252, 240, 0.72)',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
    },
    heroIconInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
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