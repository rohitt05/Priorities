import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Text,
    Pressable,
    InteractionManager,
    Dimensions,
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
    FadeInDown,
} from 'react-native-reanimated';
import { Entypo, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { getCurrentUserId } from '@/services/authService';
import { getIncomingRequests, getAcceptedPriorityNotifications } from '@/services/priorityService';
import { supabase } from '@/lib/supabase';
import ReceivedPriorityRequests from '@/components/ui/ReceivedPriorityRequests';
import { COLORS, FONTS } from '@/theme/theme';
import { appRefreshOrchestrator } from '@/services/AppRefreshOrchestrator';
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
    const modalOpacity = useSharedValue(0);
    const modalScale = useSharedValue(0.95);

    useEffect(() => {
        modalOpacity.value = withTiming(1, { duration: 180 });
        modalScale.value = withTiming(1, {
            duration: 220,
            easing: Easing.out(Easing.quad),
        });
    }, []);

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
            requestListOpacity.value = withTiming(1, { duration: 180 });
        }
    };

    useEffect(() => {
        if (!currentUserId) return;

        const task = InteractionManager.runAfterInteractions(() => {
            loadNotifications();
        });

        // Subscribe to the central orchestrator — no duplicate channels.
        // The orchestrator already owns these table channels globally.
        const unsubRequests = appRefreshOrchestrator.on('priority-requests', loadNotifications);
        const unsubNotifs = appRefreshOrchestrator.on('notifications', loadNotifications);

        return () => {
            task.cancel();
            unsubRequests();
            unsubNotifs();
        };
    }, [currentUserId]);

    const handleBack = useCallback(() => {
        if (isClosing) return;
        setIsClosing(true);
        modalOpacity.value = withTiming(0, { duration: 150 });
        modalScale.value = withTiming(0.95, { duration: 150 });
        setTimeout(() => {
            router.back();
        }, 150);
    }, [isClosing, router]);

    const modalStyle = useAnimatedStyle(() => ({
        opacity: modalOpacity.value,
        transform: [{ scale: modalScale.value }],
    }));

    const welcomeMessage = useMemo(() => {
        const name = currentUserName?.trim();
        return name ? `Hello, ${name} — welcome to Priorities.` : 'Hello — welcome to Priorities.';
    }, [currentUserName]);

    const [isWelcomeExpanded, setIsWelcomeExpanded] = useState(false);
    const [loadingText, setLoadingText] = useState("getting your notifications...");

    useEffect(() => {
        if (!isLoading) return;
        const texts = [
            "getting your notifications...",
            "almost there...",
            "checking for new priorities...",
            "loading the latest..."
        ];
        let index = 0;
        const interval = setInterval(() => {
            index = (index + 1) % texts.length;
            setLoadingText(texts[index]);
        }, 1200);
        return () => clearInterval(interval);
    }, [isLoading]);

    const renderHeader = () => (
        <View style={styles.headerPadding}>
            <Pressable
                onPress={() => setIsWelcomeExpanded(!isWelcomeExpanded)}
                style={({ pressed }) => [
                    styles.welcomeCard,
                    { opacity: pressed ? 0.85 : 1 }
                ]}
            >
                <View style={styles.welcomeIconWrap}>
                    <Ionicons name="sparkles" size={16} color={COLORS.primary} />
                </View>
                <View style={styles.welcomeTextWrap}>
                    <View style={styles.welcomeHeaderRow}>
                        <Text style={styles.welcomeTitle}>{WELCOME_NOTIFICATION.title}</Text>
                        <Ionicons
                            name={isWelcomeExpanded ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={COLORS.textSecondary}
                        />
                    </View>
                    {isWelcomeExpanded && (
                        <Animated.View entering={FadeInDown.duration(150)} style={styles.instructionsContainer}>
                            <Text style={styles.welcomeMessage}>{welcomeMessage}</Text>
                            
                            <View style={styles.divider} />
                            
                            <View style={styles.instructionItem}>
                                <Ionicons name="mic-outline" size={14} color={COLORS.primary} style={styles.instructionIcon} />
                                <Text style={styles.instructionText}>
                                    Tap and hold your priorities to send them a voice note, tap once to send them a media message
                                </Text>
                            </View>

                            <View style={styles.instructionItem}>
                                <Ionicons name="create-outline" size={14} color={COLORS.primary} style={styles.instructionIcon} />
                                <Text style={styles.instructionText}>
                                    In profile screen pull your profile card down to edit or change
                                </Text>
                            </View>

                            <View style={styles.instructionItem}>
                                <Ionicons name="arrow-down-outline" size={14} color={COLORS.primary} style={styles.instructionIcon} />
                                <Text style={styles.instructionText}>
                                    Pull down those priorities main header to see your films
                                </Text>
                            </View>

                            <View style={styles.instructionItem}>
                                <Ionicons name="arrow-up-outline" size={14} color={COLORS.primary} style={styles.instructionIcon} />
                                <Text style={styles.instructionText}>
                                    And pull up this watch films below the priorities to view their films
                                </Text>
                            </View>

                            <View style={styles.instructionItem}>
                                <Ionicons name="heart-outline" size={14} color={COLORS.primary} style={styles.instructionIcon} />
                                <Text style={styles.instructionText}>
                                    In the search you can find and add people; you can also check who's dating whom if you have a crush on someone
                                </Text>
                            </View>
                        </Animated.View>
                    )}
                </View>
            </Pressable>
            {isLoading && (
                <View style={styles.centerLoading}>
                    <ActivityIndicator size="small" color={COLORS.primary} style={{ marginBottom: 10 }} />
                    <Text style={styles.loadingProgressText}>{loadingText}</Text>
                </View>
            )}
        </View>
    );

    const renderEmpty = () => {
        if (isLoading) return null;
        return (
            <View style={styles.emptyFullState}>
                <View style={styles.emptyIconContainer}>
                    <Entypo name="bell" size={32} color={COLORS.primary} style={styles.emptyIcon} />
                </View>
                <Text style={styles.emptyText}>No new notifications</Text>
                <Text style={styles.emptySubtext}>You're all caught up!</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerShown: false,
                    animation: 'none',
                    gestureEnabled: false,
                }}
            />

            <Pressable style={StyleSheet.absoluteFill} onPress={handleBack}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.04)' }]} />
            </Pressable>

            <Animated.View style={[styles.modalCard, modalStyle]}>
                <View style={styles.panelCaret} />
                <View style={styles.innerContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Notifications</Text>
                        <Pressable onPress={handleBack} style={styles.closeButton}>
                            <Ionicons name="close" size={18} color={COLORS.primary} />
                        </Pressable>
                    </View>

                    <View style={styles.listWrapper}>
                        <ReceivedPriorityRequests
                            requests={isLoading ? [] : incomingRequests}
                            opacity={requestListOpacity}
                            onRequestsChange={setIncomingRequests}
                            ListHeaderComponent={renderHeader}
                            ListEmptyComponent={renderEmpty}
                        />
                    </View>
                </View>
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
        backgroundColor: 'transparent',
    },
    modalCard: {
        position: 'absolute',
        top: 104,
        left: SCREEN_WIDTH * 0.04,
        width: SCREEN_WIDTH * 0.92,
        maxHeight: SCREEN_HEIGHT * 0.75,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        overflow: 'visible',
        borderWidth: 1,
        borderColor: 'rgba(67, 61, 53, 0.08)',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 16,
        zIndex: 20,
    },
    innerContainer: {
        flex: 1,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
    },
    panelCaret: {
        position: 'absolute',
        top: -8,
        left: 32,
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderBottomWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: '#FFFFFF',
        zIndex: 21,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(67, 61, 53, 0.06)',
    },
    modalTitle: {
        fontFamily: FONTS.bold,
        fontSize: 14,
        color: '#1C1C1E',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    closeButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(67, 61, 53, 0.06)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listWrapper: {
        flex: 1,
    },
    headerPadding: {
        paddingTop: 4,
        paddingBottom: 4,
    },
    welcomeCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.65)',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(67, 61, 53, 0.05)',
    },
    welcomeIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(212, 163, 115, 0.14)',
        marginTop: 1,
        marginRight: 8,
    },
    welcomeTextWrap: {
        flex: 1,
    },
    welcomeHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingRight: 4,
    },
    welcomeTitle: {
        fontFamily: FONTS.bold,
        fontSize: 15,
        color: COLORS.primary,
        marginBottom: 1,
    },
    welcomeMessage: {
        fontFamily: FONTS.medium,
        fontSize: 12,
        lineHeight: 16,
        color: COLORS.textSecondary,
    },
    centerLoading: {
        minHeight: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingProgressText: {
        fontFamily: FONTS.medium,
        fontSize: 12,
        color: COLORS.textSecondary,
        opacity: 0.8,
        textAlign: 'center',
    },
    emptyFullState: {
        minHeight: 180,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 16,
    },
    emptyIconContainer: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: 'rgba(212, 163, 115, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    emptyIcon: {
        opacity: 0.85,
    },
    emptyText: {
        fontFamily: FONTS.bold,
        fontSize: 15,
        color: COLORS.primary,
        marginBottom: 4,
    },
    emptySubtext: {
        fontFamily: FONTS.medium,
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    instructionsContainer: {
        marginTop: 8,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(67, 61, 53, 0.08)',
        marginVertical: 10,
    },
    instructionItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginVertical: 5,
        paddingRight: 10,
    },
    instructionIcon: {
        marginRight: 10,
        marginTop: 1,
    },
    instructionText: {
        fontFamily: FONTS.medium,
        fontSize: 11,
        lineHeight: 15,
        color: COLORS.textSecondary,
        flex: 1,
    },
});