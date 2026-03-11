import React, { useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    Text,
    Modal,
    Animated,
    TouchableWithoutFeedback,
    TouchableOpacity,
    Dimensions,
    Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    GestureHandlerRootView,
    GestureDetector,
    Gesture,
} from 'react-native-gesture-handler';
import { useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import Reanimated from 'react-native-reanimated';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { Share, Clipboard, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

import { COLORS, FONTS, FONT_SIZES } from '@/theme/theme';
import { useBackground } from '@/contexts/BackgroundContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = 260; // Shorter top-down height
const SWIPE_CLOSE_THRESHOLD = 80;

interface ActionOption {
    label: string;
    icon: string;
    iconLibrary: 'Ionicons' | 'FontAwesome5' | 'MaterialCommunityIcons';
    color?: string;
    onPress: () => void;
}

interface ProfileActionModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
}

export default function ProfileActionModal({
    visible,
    onClose,
    userId,
    userName,
}: ProfileActionModalProps) {
    const insets = useSafeAreaInsets();
    const { bgColor, prevBgColor, colorAnim } = useBackground();

    const [isAboutView, setIsAboutView] = React.useState(false);

    const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const swipeY = useSharedValue(0);

    const toOpaque = (color: string) => color.replace(/[\d.]+\)$/, '0.45)');

    const animatedSheetBgColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [toOpaque(prevBgColor), toOpaque(bgColor)],
    });

    useEffect(() => {
        if (visible) {
            swipeY.value = 0;
            setIsAboutView(false);
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 22,
                    mass: 0.9,
                    stiffness: 160,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            slideAnim.setValue(SHEET_HEIGHT);
            fadeAnim.setValue(0);
        }
    }, [visible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: SHEET_HEIGHT,
                duration: 220,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(({ finished }) => {
            if (finished) onClose();
        });
    };

    const swipeGesture = Gesture.Pan()
        .activeOffsetY([10, 10])
        .onUpdate((event) => {
            if (event.translationY > 0) {
                swipeY.value = event.translationY;
            }
        })
        .onEnd((event) => {
            if (swipeY.value > SWIPE_CLOSE_THRESHOLD || event.velocityY > 800) {
                runOnJS(handleClose)();
            } else {
                swipeY.value = withSpring(0, { damping: 20, stiffness: 180 });
            }
        });

    const options: ActionOption[] = [
        // Row 1: Common Actions
        {
            label: 'Copy User ID',
            icon: 'copy-outline',
            iconLibrary: 'Ionicons',
            onPress: () => {
                Clipboard.setString(userId);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                handleClose();
            },
        },
        {
            label: 'Share Profile',
            icon: 'share-outline',
            iconLibrary: 'Ionicons',
            onPress: async () => {
                await Share.share({
                    message: `Check out ${userName}'s profile on Priorities! @${userId}`,
                });
                handleClose();
            },
        },
        {
            label: 'About this account',
            icon: 'information-circle-outline',
            iconLibrary: 'Ionicons',
            onPress: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsAboutView(true);
            },
        },
        // Row 2: Moderation/Safety Actions (Red)
        {
            label: 'Remove from Priorities',
            icon: 'account-remove-outline',
            iconLibrary: 'MaterialCommunityIcons',
            color: '#FF3B30',
            onPress: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleClose();
            },
        },
        {
            label: 'Report Account',
            icon: 'flag-outline',
            iconLibrary: 'Ionicons',
            color: '#FF3B30',
            onPress: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                handleClose();
            },
        },
        {
            label: 'Block',
            icon: 'block-helper',
            iconLibrary: 'MaterialCommunityIcons',
            color: '#FF3B30',
            onPress: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                handleClose();
            },
        },
    ];

    const renderIcon = (option: ActionOption) => {
        const Lib = option.iconLibrary === 'Ionicons' ? Ionicons : 
                    option.iconLibrary === 'FontAwesome5' ? FontAwesome5 : 
                    MaterialCommunityIcons;
        return <Lib name={option.icon as any} size={22} color={option.color || COLORS.text} />;
    };

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            statusBarTranslucent={true}
            onRequestClose={handleClose}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={handleClose}>
                        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
                    </TouchableWithoutFeedback>

                    <Animated.View style={[
                        styles.sheetContainer,
                        { transform: [{ translateY: slideAnim }] }
                    ]}>
                        <Reanimated.View style={[
                            styles.sheetInner,
                            { transform: [{ translateY: swipeY }] }
                        ]}>
                            {/* Layer 1: white base */}
                            <View style={[StyleSheet.absoluteFill, styles.sheetWhiteBase]} />

                            {/* Layer 2: color tint from profile context */}
                            <Animated.View
                                style={[
                                    StyleSheet.absoluteFill,
                                    styles.sheetBackground,
                                    { backgroundColor: animatedSheetBgColor }
                                ]}
                            />

                            {/* Content */}
                            {isAboutView ? (
                                <View style={styles.aboutContainer}>
                                    <TouchableOpacity 
                                        style={styles.aboutBackButton}
                                        onPress={() => setIsAboutView(false)}
                                    >
                                        <Ionicons name="chevron-back" size={24} color="#1C1917" />
                                    </TouchableOpacity>
                                    <Text style={styles.joinedTitle}>Joined Priorities on</Text>
                                    <View style={styles.aboutContent}>
                                        <Text style={styles.aboutYear}>2024</Text>
                                        <Text style={styles.aboutDate}>
                                            AUG <Text style={styles.dot}>·</Text> 24
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <>
                                    <GestureDetector gesture={swipeGesture}>
                                        <View style={styles.handleContainer}>
                                            <View style={styles.handle} />
                                        </View>
                                    </GestureDetector>

                            <View style={styles.gridContainer}>
                                {options.map((option, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.gridItem}
                                        activeOpacity={0.7}
                                        onPress={option.onPress}
                                    >
                                        <View style={[
                                            styles.iconContainer,
                                            option.color ? { borderColor: option.color, borderWidth: 1 } : {}
                                        ]}>
                                            {renderIcon(option)}
                                        </View>
                                        <Text style={[
                                            styles.gridLabel,
                                            option.color ? { color: option.color } : {}
                                        ]}>
                                            {option.label === 'Copy User ID' ? 'Copy' : 
                                             option.label === 'Share Profile' ? 'Share' : 
                                             option.label === 'About this account' ? 'Info' : 
                                             option.label === 'Remove from Priorities' ? 'Remove' : 
                                             option.label === 'Report Account' ? 'Report' : 
                                             option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                                </>
                            )}
                        </Reanimated.View>
                    </Animated.View>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheetContainer: {
        width: '100%',
        height: SHEET_HEIGHT,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
    },
    sheetInner: {
        flex: 1,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
    },
    sheetWhiteBase: {
        backgroundColor: '#FFFFFF',
    },
    sheetBackground: {
        // This will be tinted by the profile's dominant color
    },
    handleContainer: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 14,
    },
    handle: {
        width: 36,
        height: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.12)',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 10,
        paddingTop: 4,
    },
    gridItem: {
        width: '33.33%', // exactly 3 per row
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    gridLabel: {
        fontSize: 12,
        fontFamily: FONTS.bold,
        color: '#1C1917',
        opacity: 0.7,
        textAlign: 'center',
    },
    aboutContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 40,
    },
    joinedTitle: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        color: '#1C1917',
        opacity: 0.6,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    aboutContent: {
        alignItems: 'center',
    },
    aboutYear: {
        fontSize: 42,
        fontFamily: FONTS.bold,
        fontWeight: '900',
        color: '#1C1917',
        letterSpacing: -1,
    },
    aboutDate: {
        fontSize: 24,
        fontFamily: FONTS.bold,
        fontWeight: '700',
        color: '#1C1917',
        marginTop: -4,
    },
    dot: {
        color: 'rgba(0,0,0,0.2)',
        marginHorizontal: 4,
    },
    aboutBackButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        padding: 8,
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginVertical: 4,
        marginHorizontal: 12,
    },
});
