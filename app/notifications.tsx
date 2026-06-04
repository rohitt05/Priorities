import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Text,
    Pressable,
    InteractionManager,
    Dimensions,
    ScrollView,
    Animated as RNAnimated,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    withTiming,
    useAnimatedStyle,
    interpolate,
    Extrapolation,
    Easing,
} from 'react-native-reanimated';
import { Entypo } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUserId } from '@/services/authService';
import { getIncomingRequests, getAcceptedPriorityNotifications } from '@/services/priorityService';
import { supabase } from '@/lib/supabase';
import ReceivedPriorityRequests from '@/components/ui/ReceivedPriorityRequests';
import { COLORS, FONTS } from '@/theme/theme';
import { BackgroundProvider, useBackground } from '@/contexts/BackgroundContext';
import { hexToRgba } from '@/features/profile/utils/profileUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_HEIGHT = 118;
const OPEN_DURATION = 980;
const CONTENT_DELAY = 360;

type WelcomeNotification = {
    id: string;
    type: 'welcome';
    title: string;
    message: string;
};

const WELCOME_NOTIFICATION: WelcomeNotification = {
    id: 'default-welcome-notification',
    type: 'welcome',
    title: 'Hello',
    message: 'Welcome to Priorities.',
};

const sortNotificationsByDateDesc = (items: any[]) => {
    return [...items].sort((a, b) => {
        const aTime = new Date(a.created_at ?? 0).getTime();
        const bTime = new Date(b.created_at ?? 0).getTime();
        return bTime - aTime;
    });
};

function NotificationsScreenContent() {
    const router = useRouter();
    const params = useLocalSearchParams<{ flowEntry?: string; flowSide?: 'left' | 'right' }>();
    const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isClosing, setIsClosing] = useState(false);
    const [currentUserName, setCurrentUserName] = useState<string>('');

    const { bgColor, prevBgColor, colorAnim, handleColorChange } = useBackground();

    const animatedBgColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    const requestListOpacity = useSharedValue(0);
    const overlay = useSharedValue(params.flowEntry === '1' ? 0 : 1);
    const bellTravel = useSharedValue(params.flowEntry === '1' ? 0 : 1);
    const content = useSharedValue(params.flowEntry === '1' ? 0 : 1);

    useEffect(() => {
        if (params.flowEntry === '1') {
            overlay.value = withTiming(1, {
                duration: OPEN_DURATION,
                easing: Easing.bezier(0.16, 1, 0.3, 1),
            });

            bellTravel.value = withTiming(1, {
                duration: 760,
                easing: Easing.bezier(0.22, 1, 0.36, 1),
            });

            setTimeout(() => {
                content.value = withTiming(1, {
                    duration: 420,
                    easing: Easing.out(Easing.cubic),
                });
            }, CONTENT_DELAY);
        }
    }, [params.flowEntry, overlay, bellTravel, content]);

    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            getCurrentUserId()
                .then(async id => {
                    setCurrentUserId(id);
                    if (!id) {
                        setIsLoading(false);
                        return;
                    }

                    try {
                        const { data } = await supabase
                            .from('profiles')
                            .select('name, dominant_color')
                            .eq('id', id)
                            .single();
                        if (data?.name) setCurrentUserName(data.name);

                        const BG_OPACITY = 0.35;
                        const userColor = data?.dominant_color
                            ? hexToRgba(data.dominant_color, BG_OPACITY)
                            : COLORS.background;
                        handleColorChange(userColor);
                    } catch (err) {
                        console.error('Error loading current user name:', err);
                    }
                })
                .catch(err => {
                    console.error(err);
                    setIsLoading(false);
                });
        });

        return () => task.cancel();
    }, []);

    const loadNotifications = async () => {
        if (!currentUserId) return;

        try {
            const [requests, accepted] = await Promise.all([
                getIncomingRequests(currentUserId),
                getAcceptedPriorityNotifications(currentUserId),
            ]);

            const merged = sortNotificationsByDateDesc([...requests, ...accepted]);
            setIncomingRequests(merged);
        } catch (err) {
            console.error('Error loading notifications:', err);
        } finally {
            setIsLoading(false);
            requestListOpacity.value = withTiming(1, { duration: 260 });
        }
    };

    useEffect(() => {
        if (!currentUserId) return;

        const task = InteractionManager.runAfterInteractions(() => {
            loadNotifications();
        });

        const requestsChannel = supabase
            .channel(`realtime_incoming_requests_notifications_${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'priority_requests',
                    filter: `receiver_id=eq.${currentUserId}`,
                },
                () => {
                    loadNotifications();
                }
            )
            .subscribe();

        const acceptedChannel = supabase
            .channel(`realtime_accepted_priority_notifications_${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'accepted_priority_notifications',
                    filter: `receiver_id=eq.${currentUserId}`,
                },
                () => {
                    loadNotifications();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'accepted_priority_notifications',
                    filter: `sender_id=eq.${currentUserId}`,
                },
                () => {
                    loadNotifications();
                }
            )
            .subscribe();

        return () => {
            task.cancel();
            supabase.removeChannel(requestsChannel);
            supabase.removeChannel(acceptedChannel);
        };
    }, [currentUserId]);

    const handleBack = useCallback(() => {
        if (isClosing) return;
        setIsClosing(true);
        router.back();
    }, [isClosing, router]);

    const ambientStyle = useAnimatedStyle(() => ({
        opacity: interpolate(overlay.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    }));

    const washStyle = useAnimatedStyle(() => ({
        opacity: interpolate(overlay.value, [0, 0.25, 0.72, 1], [0, 0.72, 0.42, 0.18], Extrapolation.CLAMP),
        transform: [
            { scale: interpolate(overlay.value, [0, 1], [0.94, 1.06], Extrapolation.CLAMP) },
        ],
    }));

    const bellHeroStyle = useAnimatedStyle(() => {
        const startX = -SCREEN_WIDTH * 0.39;
        const endX = 0;
        const startY = -SCREEN_HEIGHT * 0.31;
        const midLift = -SCREEN_HEIGHT * 0.05;
        const endY = 0;

        const progress = bellTravel.value;
        const translateX = interpolate(progress, [0, 1], [startX, endX], Extrapolation.CLAMP);
        const translateY =
            progress < 0.5
                ? interpolate(progress, [0, 0.5], [startY, midLift], Extrapolation.CLAMP)
                : interpolate(progress, [0.5, 1], [midLift, endY], Extrapolation.CLAMP);

        return {
            opacity: interpolate(progress, [0, 0.72, 1], [1, 1, 0], Extrapolation.CLAMP),
            transform: [
                { translateX },
                { translateY },
                { scale: interpolate(progress, [0, 0.55, 1], [1, 2.9, 4.25], Extrapolation.CLAMP) },
                { rotate: `${interpolate(progress, [0, 1], [-8, 0], Extrapolation.CLAMP)}deg` },
            ],
        };
    });

    const bellGlowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(bellTravel.value, [0, 0.4, 0.78, 1], [0, 0.3, 0.16, 0], Extrapolation.CLAMP),
        transform: [
            { scale: interpolate(bellTravel.value, [0, 1], [0.8, 3.9], Extrapolation.CLAMP) },
        ],
    }));

    const contentStyle = useAnimatedStyle(() => ({
        opacity: interpolate(content.value, [0, 1], [0, 1], Extrapolation.CLAMP),
        transform: [
            { translateY: interpolate(content.value, [0, 1], [26, 0], Extrapolation.CLAMP) },
            { scale: interpolate(content.value, [0, 1], [0.985, 1], Extrapolation.CLAMP) },
        ],
    }));

    const welcomeMessage = useMemo(() => {
        const name = currentUserName?.trim();
        return name ? `Hello, ${name} — welcome to Priorities.` : 'Hello — welcome to Priorities.';
    }, [currentUserName]);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerShown: false,
                    animation: 'none',
                    gestureEnabled: false,
                }}
            />

            <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: animatedBgColor }]} />

            {params.flowEntry === '1' && (
                <View pointerEvents="none" style={styles.heroBellLayer}>
                    <Animated.View style={[styles.heroBellGlow, bellGlowStyle]} />
                    <Animated.View style={[styles.heroBellWrap, bellHeroStyle]}>
                        <Entypo name="bell" size={34} color={COLORS.primary} />
                    </Animated.View>
                </View>
            )}

            <Animated.View style={[StyleSheet.absoluteFill, contentStyle]}>
                <View style={styles.header} pointerEvents="box-none">
                    <LinearGradient
                        colors={['rgba(0, 0, 0, 0.45)', 'rgba(0, 0, 0, 0.15)', 'transparent']}
                        locations={[0, 0.6, 1]}
                        style={styles.headerLinearGradient}
                        pointerEvents="none"
                    />
                    <Pressable onPress={handleBack} style={styles.backButton}>
                        <Entypo name="cross" size={30} color="#ffffff" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView
                    style={styles.body}
                    contentInsetAdjustmentBehavior="never"
                    contentContainerStyle={styles.bodyContent}
                    showsVerticalScrollIndicator={false}
                    bounces
                >
                    <View style={styles.fullListArea}>
                        <View style={styles.welcomeCard}>
                            <View style={styles.welcomeIconWrap}>
                                <Ionicons name="sparkles-sharp" size={24} color={COLORS.primary} />
                            </View>
                            <View style={styles.welcomeTextWrap}>
                                <Text style={styles.welcomeTitle}>{WELCOME_NOTIFICATION.title}</Text>
                                <Text style={styles.welcomeMessage}>{welcomeMessage}</Text>
                            </View>
                        </View>

                        {isLoading ? (
                            <View style={styles.centerLoading}>
                                <ActivityIndicator size="large" color={COLORS.primary} />
                            </View>
                        ) : incomingRequests.length > 0 ? (
                            <View style={styles.requestsBlock}>
                                <ReceivedPriorityRequests
                                    requests={incomingRequests}
                                    opacity={requestListOpacity}
                                    onRequestsChange={setIncomingRequests}
                                />
                            </View>
                        ) : (
                            <View style={styles.emptyFullState}>
                                <Entypo name="bell" size={44} color={COLORS.textSecondary} style={styles.emptyIcon} />
                                <Text style={styles.emptyText}>No new notifications</Text>
                                <Text style={styles.emptySubtext}>You're all caught up!</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </Animated.View>
        </View>
    );
}

export default function NotificationsScreen() {
    return (
        <BackgroundProvider>
            <NotificationsScreenContent />
        </BackgroundProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        overflow: 'hidden',
    },
    baseBg: {
        backgroundColor: COLORS.background,
    },
    gradientWashPrimary: {
        position: 'absolute',
        top: -SCREEN_HEIGHT * 0.08,
        left: -SCREEN_WIDTH * 0.22,
        width: SCREEN_WIDTH * 1.14,
        height: SCREEN_HEIGHT * 0.44,
        backgroundColor: COLORS.PALETTE.peachPuff,
        borderBottomLeftRadius: 220,
        borderBottomRightRadius: 200,
        borderTopRightRadius: 180,
        opacity: 0.22,
    },
    gradientWashSecondary: {
        position: 'absolute',
        top: SCREEN_HEIGHT * 0.16,
        right: -SCREEN_WIDTH * 0.16,
        width: SCREEN_WIDTH * 0.86,
        height: SCREEN_HEIGHT * 0.34,
        backgroundColor: COLORS.PALETTE.warmSand,
        borderTopLeftRadius: 220,
        borderBottomLeftRadius: 220,
        borderTopRightRadius: 140,
        borderBottomRightRadius: 150,
        opacity: 0.18,
    },
    gradientWashTertiary: {
        position: 'absolute',
        bottom: -SCREEN_HEIGHT * 0.04,
        left: -SCREEN_WIDTH * 0.1,
        width: SCREEN_WIDTH * 1.02,
        height: SCREEN_HEIGHT * 0.26,
        backgroundColor: COLORS.PALETTE.blushPetal,
        borderTopLeftRadius: 170,
        borderTopRightRadius: 170,
        opacity: 0.12,
    },
    heroBellLayer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 15,
    },
    heroBellGlow: {
        position: 'absolute',
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: COLORS.PALETTE.peachPuff,
    },
    heroBellWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(253, 252, 240, 0.7)',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: HEADER_HEIGHT,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 58,
        paddingBottom: 16,
        backgroundColor: 'transparent',
        overflow: 'hidden',
        zIndex: 20,
    },
    headerLinearGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerSpacer: {
        width: 44,
        height: 44,
    },
    headerTitle: {
        fontFamily: FONTS.bold,
        fontSize: 18,
        color: '#ffffff',
    },
    body: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    bodyContent: {
        flexGrow: 1,
        paddingTop: HEADER_HEIGHT,
        paddingBottom: 36,
    },
    fullListArea: {
        flex: 1,
        minHeight: SCREEN_HEIGHT - HEADER_HEIGHT,
        paddingHorizontal: 16,
        paddingTop: 18,
    },
    welcomeCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.58)',
        borderRadius: 26,
        paddingHorizontal: 18,
        paddingVertical: 16,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: 'rgba(67, 61, 53, 0.06)',
    },
    welcomeIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(212, 163, 115, 0.16)',
        marginTop: 2,
        marginRight: 12,
    },
    welcomeTextWrap: {
        flex: 1,
    },
    welcomeTitle: {
        fontFamily: FONTS.bold,
        fontSize: 17,
        color: COLORS.primary,
        marginBottom: 4,
    },
    welcomeMessage: {
        fontFamily: FONTS.medium,
        fontSize: 14,
        lineHeight: 20,
        color: COLORS.textSecondary,
    },
    requestsBlock: {
        flex: 1,
    },
    centerLoading: {
        flex: 1,
        minHeight: 220,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyFullState: {
        flex: 1,
        minHeight: SCREEN_HEIGHT * 0.55,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    emptyIcon: {
        marginBottom: 16,
        opacity: 0.5,
    },
    emptyText: {
        fontFamily: FONTS.bold,
        fontSize: 18,
        color: COLORS.primary,
        marginBottom: 8,
    },
    emptySubtext: {
        fontFamily: FONTS.medium,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
});