import React, { useMemo, useEffect, useState } from 'react';
import {
    View,
    StyleSheet,
    Image,
    Text,
    StatusBar,
    TouchableOpacity,
    Dimensions,
    Animated as RNAnimated,
    BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
    GestureHandlerRootView,
    GestureDetector,
    Gesture
} from 'react-native-gesture-handler';
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    runOnJS,
    interpolate,
    Extrapolation,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { COLORS } from '@/constants/theme';
import usersData from '@/data/users.json';
import { useBackground, BackgroundProvider } from '@/context/BackgroundContext';
import EditProfileScreen from '../src/components/EditProfileScreen';

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = height * 0.55;
const TRIGGER_THRESHOLD = 100;

const AnimatedPath = RNAnimated.createAnimatedComponent(Path);

interface User {
    id: string;
    uniqueUserId: string;
    name: string;
    profilePicture: string;
    birthday: string;
    dominantColor: string;
    relationship?: string;
    partnerId?: string;
    prioritiesCount?: number;
}

const CURRENT_USER_ID = 'rohit123';

function ProfileScreenContent() {
    const router = useRouter();
    const { bgColor, prevBgColor, colorAnim, handleColorChange } = useBackground();
    const [isEditing, setIsEditing] = useState(false);

    // Shared Values
    const pullY = useSharedValue(0);
    const hasVibrated = useSharedValue(false);

    // --- Actions ---
    const triggerEditMode = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsEditing(true);
    };

    const triggerThresholdHaptic = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const handleCloseEdit = () => {
        setIsEditing(false);
        pullY.value = TRIGGER_THRESHOLD * 2;
        pullY.value = withSpring(0, { damping: 15, stiffness: 90, mass: 1 });
    };

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
        const user = (usersData as User[]).find((u) => u.uniqueUserId === CURRENT_USER_ID);
        return user || (usersData[0] as User);
    }, []);

    const partnerUser = useMemo(() => {
        if (!currentUser.partnerId) return null;
        return (usersData as User[]).find((u) => u.uniqueUserId === currentUser.partnerId) || null;
    }, [currentUser]);

    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const BG_OPACITY = 0.35;
    const lightDominantColor = currentUser
        ? hexToRgba(currentUser.dominantColor, BG_OPACITY)
        : 'rgba(255,255,255,1)';

    useEffect(() => {
        if (lightDominantColor) {
            handleColorChange(lightDominantColor);
        }
    }, [lightDominantColor, handleColorChange]);

    // --- Gesture ---
    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            if (event.translationY > 0) {
                pullY.value = event.translationY * 0.5;
                if (pullY.value > TRIGGER_THRESHOLD && !hasVibrated.value) {
                    hasVibrated.value = true;
                    runOnJS(triggerThresholdHaptic)();
                } else if (pullY.value < TRIGGER_THRESHOLD && hasVibrated.value) {
                    hasVibrated.value = false;
                }
            }
        })
        .onEnd(() => {
            if (pullY.value > TRIGGER_THRESHOLD) {
                runOnJS(triggerEditMode)();
                pullY.value = withTiming(0, { duration: 0 });
            } else {
                pullY.value = withSpring(0, { damping: 15, stiffness: 120 });
            }
            hasVibrated.value = false;
        });

    const headerAnimatedStyle = useAnimatedStyle(() => {
        return { height: HEADER_HEIGHT + pullY.value };
    });

    const imageScaleStyle = useAnimatedStyle(() => {
        const scale = interpolate(pullY.value, [0, TRIGGER_THRESHOLD], [1, 1.15], Extrapolation.CLAMP);
        return { transform: [{ scale: scale }] };
    });

    const partnerContainerStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: pullY.value }]
        };
    });

    const translateY = useSharedValue(0);

    useEffect(() => {
        translateY.value = withRepeat(
            withSequence(
                withTiming(-4, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
                withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) })
            ),
            -1,
            true
        );
    }, [translateY]);

    const floatingStyle = useAnimatedStyle(() => {
        return { transform: [{ translateY: translateY.value }] };
    });

    const animatedBgColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    if (!currentUser) return null;

    if (isEditing) {
        return <EditProfileScreen user={currentUser} onBack={handleCloseEdit} />;
    }

    const relationshipLabel = (currentUser.relationship || '').trim() || 'My person';

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar barStyle="dark-content" />
            <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: animatedBgColor }]} />

            <GestureDetector gesture={panGesture}>
                <Reanimated.View style={styles.container}>

                    {/* --- HEADER --- */}
                    <Reanimated.View style={[styles.imageHeader, headerAnimatedStyle]}>
                        <Reanimated.Image
                            source={{ uri: currentUser.profilePicture }}
                            style={[styles.profileImage, imageScaleStyle]}
                            resizeMode="cover"
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.5)']}
                            locations={[0, 0.9]}
                            style={styles.gradientOverlay}
                        />
                        <SafeAreaView style={styles.headerSafeOverlay}>
                            <View style={styles.headerRow}>
                                <TouchableOpacity style={styles.iconButton} hitSlop={12} onPress={() => router.back()}>
                                    <Ionicons name="chevron-back" size={24} color="black" />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.iconButton} hitSlop={12} onPress={() => router.push('/settings')}>
                                    <Ionicons name="settings-outline" size={24} color="black" />
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>

                        {/* ✅ RESTORED Name Inside Header */}
                        <View style={styles.textOverlay}>
                            <Text style={styles.name}>{currentUser.name}</Text>
                        </View>
                    </Reanimated.View>

                    {/* --- PARTNER CONTAINER --- */}
                    {partnerUser && (
                        <Reanimated.View style={[styles.floatingPartnerContainer, partnerContainerStyle]}>
                            <View style={styles.partnerContent}>
                                <Image source={{ uri: partnerUser.profilePicture }} style={styles.partnerImage} />
                                <View style={styles.heartBadge}>
                                    <Ionicons name="heart" size={16} color="#f30808ff" />
                                </View>
                                <Reanimated.View style={[styles.dialogueWrapper, floatingStyle]}>
                                    <View style={styles.solidBacking}>
                                        <RNAnimated.View style={[styles.dialogueBox, { backgroundColor: animatedBgColor }]}>
                                            <Text style={styles.dialogueText} numberOfLines={1} ellipsizeMode="tail">
                                                {relationshipLabel}
                                            </Text>
                                        </RNAnimated.View>
                                    </View>
                                    <View style={styles.curvedTailContainer}>
                                        <Svg width={24} height={24} viewBox="0 0 24 24" style={styles.tailSvgBacking}>
                                            <Path d="M0,0 Q12,0 20,20 Q4,12 0,0 Z" fill="white" />
                                        </Svg>
                                        <Svg width={24} height={24} viewBox="0 0 24 24" style={styles.tailSvgOverlay}>
                                            {/* @ts-ignore */}
                                            <AnimatedPath
                                                d="M0,0 Q12,0 20,20 Q4,12 0,0 Z"
                                                fill={animatedBgColor}
                                                stroke={BUBBLE_BORDER_COLOR}
                                                strokeWidth={1}
                                            />
                                        </Svg>
                                        <RNAnimated.View style={[styles.tailHiderPatch, { backgroundColor: animatedBgColor }]} />
                                    </View>
                                </Reanimated.View>
                            </View>
                        </Reanimated.View>
                    )}

                    {/* --- BODY --- */}
                    <View style={styles.contentBody}>
                        {/* Empty body as requested, ready for future content */}
                    </View>

                </Reanimated.View>
            </GestureDetector>
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

const BUBBLE_BORDER_COLOR = 'rgba(0,0,0,0.08)';

const styles = StyleSheet.create({
    container: { flex: 1 },
    imageHeader: {
        width: width,
        position: 'relative',
        zIndex: 1,
        borderBottomLeftRadius: 25,
        borderBottomRightRadius: 25,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    profileImage: { width: '100%', height: '100%' },
    gradientOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '25%',
        zIndex: 2,
    },
    headerSafeOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginTop: 10,
    },
    iconButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textOverlay: {
        position: 'absolute',
        bottom: 15,
        left: 24,
        right: 100,
        zIndex: 3,
    },
    name: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.surfaceLight,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
        letterSpacing: -0.2,
    },
    floatingPartnerContainer: {
        position: 'absolute',
        top: HEADER_HEIGHT,
        right: 24,
        zIndex: 20,
        marginTop: -28,
    },
    partnerContent: {
        position: 'relative',
    },
    partnerImage: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    heartBadge: {
        position: 'absolute',
        bottom: -2,
        right: -5,
        width: 25,
        height: 25,
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ rotate: '15deg' }],
        zIndex: 25,
    },
    dialogueWrapper: {
        position: 'absolute',
        top: -65,
        right: 12,
        zIndex: 20,
        alignItems: 'flex-end',
    },
    solidBacking: {
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
    },
    dialogueBox: {
        minWidth: 100,
        maxWidth: 140,
        height: 38,
        paddingHorizontal: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: BUBBLE_BORDER_COLOR,
    },
    dialogueText: {
        fontFamily: 'DancingScript-Bold',
        fontSize: 17,
        color: COLORS.text,
        textAlign: 'center',
        includeFontPadding: false,
        marginBottom: 3,
    },
    curvedTailContainer: {
        position: 'absolute',
        bottom: -15,
        right: 18,
        width: 24,
        height: 24,
    },
    tailSvgBacking: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: -2,
    },
    tailSvgOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: -1,
    },
    tailHiderPatch: {
        position: 'absolute',
        top: -2,
        right: 0,
        width: 20,
        height: 6,
        zIndex: 5,
    },
    contentBody: {
        flex: 1,
        paddingTop: 35,
        paddingHorizontal: 24,
    }
});
