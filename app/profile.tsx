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
import { Link, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import AddPartnerModal from '@/components/addPartnerModal';
import FloatingPartnerIcon from '@/components/FloatingPartnerIcon';


const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = height * 0.55;
const TRIGGER_THRESHOLD = 100;

const PARTNER_KEY = '@profile_partner_unique_user_id';


const AnimatedPath = RNAnimated.createAnimatedComponent(Path);
const AnimatedTouchableOpacity = RNAnimated.createAnimatedComponent(TouchableOpacity);


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
    const [isAddPartnerVisible, setIsAddPartnerVisible] = useState(false);
    const [savedPartnerUniqueUserId, setSavedPartnerUniqueUserId] = useState<string | null>(null);


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

    useEffect(() => {
        const loadPartner = async () => {
            try {
                const stored = await AsyncStorage.getItem(PARTNER_KEY);
                if (stored) setSavedPartnerUniqueUserId(stored);
            } catch {
                // ignore
            }
        };
        loadPartner();
    }, []);


    const partnerUser = useMemo(() => {
        if (!savedPartnerUniqueUserId) return null;
        return (usersData as User[]).find((u) => u.uniqueUserId === savedPartnerUniqueUserId) || null;
    }, [savedPartnerUniqueUserId]);


    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };


    // Screen background — soft, 0.35 alpha
    const BG_OPACITY = 0.35;
    const lightDominantColor = currentUser
        ? hexToRgba(currentUser.dominantColor, BG_OPACITY)
        : 'rgba(255,255,255,1)';

    // Capsule — same hue, 0.85 alpha — solid, not see-through
    const solidDominantColor = currentUser
        ? hexToRgba(currentUser.dominantColor, 0.85)
        : 'rgba(255,255,255,0.85)';


    useEffect(() => {
        if (lightDominantColor) {
            handleColorChange(lightDominantColor);
        }
    }, [lightDominantColor, handleColorChange]);


    // Animated bg for the screen
    const animatedBgColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    // Animated bg for the capsule — same hue, alpha locked at 0.85
    const animatedCapsuleColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [
            prevBgColor.replace(/[\d.]+\)$/, '0.85)'),
            solidDominantColor,
        ],
    });


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


    if (!currentUser) return null;


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
                                <Link href="/settings" asChild>
                                    <TouchableOpacity style={styles.iconButton} hitSlop={12}>
                                        <Ionicons name="settings-outline" size={24} color="black" />
                                    </TouchableOpacity>
                                </Link>
                            </View>
                        </SafeAreaView>


                        <View style={styles.textOverlay}>
                            <Text style={styles.name}>{currentUser.name}</Text>
                        </View>
                    </Reanimated.View>


                    {/* --- PARTNER CONTAINER --- */}
                    {partnerUser ? (
                        <FloatingPartnerIcon
                            partnerUser={partnerUser}
                            relationshipLabel={relationshipLabel}
                            animatedBgColor={animatedBgColor}
                            pullY={pullY}
                        />
                    ) : (
                        <Reanimated.View style={[styles.floatingPartnerContainer, partnerContainerStyle]}>
                            <AnimatedTouchableOpacity
                                activeOpacity={0.85}
                                style={[styles.addPartnerCapsule, { backgroundColor: animatedCapsuleColor }]}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setIsAddPartnerVisible(true);
                                }}
                            >
                                <Text style={styles.addPartnerText}>+ partner</Text>
                            </AnimatedTouchableOpacity>
                        </Reanimated.View>
                    )}


                    {/* --- BODY --- */}
                    <View style={styles.contentBody}>
                        {/* Body Content */}
                    </View>


                </Reanimated.View>
            </GestureDetector>


            {isEditing && (
                <EditProfileScreen user={currentUser} onBack={handleCloseEdit} />
            )}


            <AddPartnerModal
                visible={isAddPartnerVisible}
                onClose={() => setIsAddPartnerVisible(false)}
                currentUserUniqueUserId={CURRENT_USER_ID}
                onSelectPartner={(partnerUniqueUserId) => {
                    setSavedPartnerUniqueUserId(partnerUniqueUserId);
                    AsyncStorage.setItem(PARTNER_KEY, partnerUniqueUserId).catch(() => { });
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
        marginTop: -16,
    },
    addPartnerCapsule: {
        height: 28,
        paddingHorizontal: 10,   // ← tighter sides
        borderRadius: 999,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
    },
    addPartnerText: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(0,0,0,0.75)',
        letterSpacing: 0.2,      // ← tighter tracking
        textTransform: 'lowercase',
    },
    contentBody: {
        flex: 1,
        paddingTop: 35,
        paddingHorizontal: 24,
    }
});
