import React, { useState, useEffect, useCallback, memo } from 'react';
import { StyleSheet, Text, View, Pressable, Animated as RNAnimated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Entypo } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONTS } from '@/theme/theme';
import { useBackground } from '@/contexts/BackgroundContext';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    runOnJS,
    interpolate,
    Extrapolation,
    useAnimatedProps,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { appRefreshOrchestrator } from '@/services/AppRefreshOrchestrator';
import { getIncomingRequests } from '@/services/priorityService';
import { getCurrentUserId } from '@/services/authService';

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

interface PressableScaleProps {
    onPress: () => void;
    children: React.ReactNode;
    style?: any;
    disabled?: boolean;
}

const PressableScale: React.FC<PressableScaleProps> = memo(({ onPress, children, style, disabled }) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const handlePressIn = () => {
        if (disabled) return;
        scale.value = withTiming(0.94, { duration: 90 });
        opacity.value = withTiming(0.82, { duration: 90 });
    };

    const handlePressOut = () => {
        scale.value = withTiming(1, { duration: 120 });
        opacity.value = withTiming(1, { duration: 120 });
    };

    return (
        <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            disabled={disabled}
            style={style}
        >
            <Animated.View style={animatedStyle}>{children}</Animated.View>
        </Pressable>
    );
});

PressableScale.displayName = 'PressableScale';

export default function Header() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { bgColor, prevBgColor, colorAnim } = useBackground();

    const [isNavigating, setIsNavigating] = useState(false);
    const [hasNewRequests, setHasNewRequests] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isReadyToRelease, setIsReadyToRelease] = useState(false);

    const translateY = useSharedValue(0);
    const hasTriggered = useSharedValue(false);
    const PULL_THRESHOLD = 60;

    useEffect(() => {
        getCurrentUserId().then(setCurrentUserId).catch(console.error);
    }, []);

    const checkRequests = useCallback(async () => {
        if (!currentUserId) return;
        try {
            const requests = await getIncomingRequests(currentUserId);
            setHasNewRequests(requests.length > 0);
        } catch (e) {
            console.error('[Header] Failed to load incoming requests', e);
        }
    }, [currentUserId]);

    useEffect(() => {
        if (!currentUserId) return;
        checkRequests();
        const unsubscribe = appRefreshOrchestrator.on('priority-requests', (payload?: any) => {
            if (payload?.eventType === 'INSERT' && payload?.new?.receiver_id === currentUserId) {
                checkRequests();
            }
        });
        return () => {
            unsubscribe();
        };
    }, [currentUserId, checkRequests]);

    const handleNavigate = (route: '/notifications' | '/profile', flowSide: 'left' | 'right') => {
        if (isNavigating) return;
        setIsNavigating(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });

        router.push({
            pathname: route,
            params: {
                flowEntry: '1',
                flowSide,
            },
        } as any);

        setTimeout(() => {
            setIsNavigating(false);
        }, 320);
    };

    const navigateToFilm = () => {
        router.push({
            pathname: '/myFilmOfTheDay',
            params: { color: bgColor }
        });
    };

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            if (event.translationY > 0) {
                const drag = event.translationY * 0.8;
                translateY.value = drag;

                if (drag > PULL_THRESHOLD && !hasTriggered.value) {
                    hasTriggered.value = true;
                    runOnJS(setIsReadyToRelease)(true);
                    runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
                } else if (drag < PULL_THRESHOLD && hasTriggered.value) {
                    hasTriggered.value = false;
                    runOnJS(setIsReadyToRelease)(false);
                }
            } else {
                translateY.value = 0;
            }
        })
        .onEnd(() => {
            if (translateY.value > PULL_THRESHOLD) {
                runOnJS(navigateToFilm)();
            }
            translateY.value = withSpring(0, { damping: 26, stiffness: 400, mass: 0.6 });
            hasTriggered.value = false;
            runOnJS(setIsReadyToRelease)(false);
        });

    const animatedHeaderStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const indicatorStyle = useAnimatedStyle(() => {
        const opacity = interpolate(translateY.value, [20, 60], [0, 1], Extrapolation.CLAMP);
        const scale = interpolate(translateY.value, [20, 80], [0.8, 1.06], Extrapolation.CLAMP);
        const y = interpolate(translateY.value, [0, 80], [-20, 8], Extrapolation.CLAMP);

        return {
            opacity,
            transform: [{ scale }, { translateY: y }],
        };
    });

    const indicatorColorStyle = useAnimatedStyle(() => ({
        color: translateY.value > PULL_THRESHOLD ? COLORS.PALETTE.coralRed : COLORS.primary,
    }));

    const animatedProps = useAnimatedProps(() => ({
        color: translateY.value > PULL_THRESHOLD ? COLORS.PALETTE.coralRed : COLORS.primary,
    }));

    return (
        <View style={styles.root}>
            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.sheetContainer, animatedHeaderStyle]}>
                    <View style={styles.sheetSurface}>
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.background }]} />
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor, opacity: 0.18 }]} />
                        <RNAnimated.View
                            style={[
                                StyleSheet.absoluteFill,
                                {
                                    backgroundColor: prevBgColor,
                                    opacity: colorAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.18, 0]
                                    })
                                }
                            ]}
                        />
                        <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
                    </View>

                    <View style={styles.indicatorArea}>
                        <Animated.View style={[styles.indicatorContent, indicatorStyle]}>
                            <AnimatedIonicons
                                name={isReadyToRelease ? 'film' : 'arrow-down'}
                                size={24}
                                animatedProps={animatedProps}
                            />
                            <Animated.Text style={[styles.indicatorText, indicatorColorStyle]}>
                                {isReadyToRelease ? 'Release for Film' : 'Pull for Daily Film'}
                            </Animated.Text>
                        </Animated.View>
                    </View>

                    <View style={[styles.headerContent, { paddingTop: Math.max(insets.top, SPACING.md) }]}>
                        <PressableScale
                            onPress={() => handleNavigate('/notifications', 'left')}
                            disabled={isNavigating}
                            style={styles.notificationButton}
                        >
                            <View style={styles.iconContainer}>
                                <Entypo name="bell" size={28} color={COLORS.primary} />
                                {hasNewRequests && <View style={styles.bellDot} />}
                            </View>
                        </PressableScale>

                        <View style={styles.logoContainer}>
                            <Text style={styles.logo} numberOfLines={1}>priorities</Text>
                        </View>

                        <PressableScale
                            onPress={() => handleNavigate('/profile', 'right')}
                            disabled={isNavigating}
                            style={styles.profileButton}
                        >
                            <MaterialCommunityIcons name="face-man-profile" size={30} color={COLORS.primary} />
                        </PressableScale>
                    </View>

                    <View style={styles.sheetEdge} />
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        width: '100%',
        zIndex: 2000,
        height: 120,
        overflow: 'visible',
    },
    sheetContainer: {
        width: '100%',
        zIndex: 2000,
    },
    sheetSurface: {
        position: 'absolute',
        top: -1000,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.background,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        overflow: 'hidden',
    },
    indicatorArea: {
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -100,
    },
    indicatorContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    indicatorText: {
        fontSize: 12,
        fontFamily: FONTS.bold,
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    headerContent: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.md,
    },
    sheetEdge: {
        height: 1,
        width: '100%',
    },
    notificationButton: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    iconContainer: {
        position: 'relative',
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoContainer: {
        flex: 1,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        fontSize: 32,
        fontFamily: FONTS.bold,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: -1,
        includeFontPadding: false,
        textAlign: 'center',
    },
    profileButton: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    bellDot: {
        position: 'absolute',
        top: -1,
        right: -1,
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: COLORS.PALETTE.coralRed,
        borderWidth: 1.5,
        borderColor: COLORS.background,
    },
});