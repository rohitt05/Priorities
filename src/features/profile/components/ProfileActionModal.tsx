import React, { useEffect, useRef, useState } from 'react';
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
    Alert,
    Share,
    Clipboard,
    ActivityIndicator,
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
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { COLORS, FONTS } from '@/theme/theme';
import { useBackground } from '@/contexts/BackgroundContext';
import { removePriority, blockUser } from '@/services/priorityService';
import { supabase } from '@/lib/supabase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_CLOSE_THRESHOLD = 80;

// handle (14+5+14=33) + one row (60+8+18=86, padVert 6*2=12 → 98) + bottom pad 12 + loader-breathing-room
// Single row  → handle 33 + gridWrapper paddingBottom 12 + row ~100 + a bit of air = ~155
// Double rows → handle 33 + gridWrapper paddingBottom 12 + row1 ~100 + divider 17 + row2 ~100 = ~262
const SHEET_HEIGHT_ONE_ROW = 158;
const SHEET_HEIGHT_TWO_ROWS = 268;
const SHEET_HEIGHT_ABOUT = 220;

interface ProfileActionModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
    authId: string;
    targetUUID: string;
    onRemoved?: () => void;
    onBlocked?: () => void;
}

type AboutData = {
    createdAt: string | null;
    birthday: string | null;
};

export default function ProfileActionModal({
    visible,
    onClose,
    userId,
    userName,
    authId,
    targetUUID,
    onRemoved,
    onBlocked,
}: ProfileActionModalProps) {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { bgColor, prevBgColor, colorAnim } = useBackground();

    const [isAboutView, setIsAboutView] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isInMyPriorities, setIsInMyPriorities] = useState<boolean | null>(null);
    const [aboutData, setAboutData] = useState<AboutData>({ createdAt: null, birthday: null });

    const sheetHeight = isAboutView
        ? SHEET_HEIGHT_ABOUT
        : isInMyPriorities
            ? SHEET_HEIGHT_TWO_ROWS
            : SHEET_HEIGHT_ONE_ROW;

    const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT_ONE_ROW)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const swipeY = useSharedValue(0);

    const toOpaque = (color: string) => color.replace(/[\d.]+\)$/, '0.45)');

    const animatedSheetBgColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [toOpaque(prevBgColor), toOpaque(bgColor)],
    });

    // ── Fetch priority membership + profile about data ────────────────────────
    useEffect(() => {
        if (!visible || !authId || !targetUUID) return;
        let cancelled = false;

        const fetchData = async () => {
            try {
                const [{ data: priorityRow }, { data: profileRow }] = await Promise.all([
                    supabase
                        .from('priorities')
                        .select('id')
                        .eq('user_id', authId)
                        .eq('priority_user_id', targetUUID)
                        .maybeSingle(),
                    supabase
                        .from('profiles')
                        .select('created_at, birthday')
                        .eq('id', targetUUID)
                        .single(),
                ]);

                if (!cancelled) {
                    setIsInMyPriorities(!!priorityRow);
                    setAboutData({
                        createdAt: profileRow?.created_at ?? null,
                        birthday: profileRow?.birthday ?? null,
                    });
                }
            } catch {
                if (!cancelled) setIsInMyPriorities(false);
            }
        };

        fetchData();
        return () => { cancelled = true; };
    }, [visible, authId, targetUUID]);

    // Animate height change when priority status resolves or view switches
    useEffect(() => {
        if (!visible) return;
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            mass: 0.9,
            stiffness: 160,
        }).start();
    }, [isInMyPriorities, isAboutView]);

    useEffect(() => {
        if (visible) {
            swipeY.value = 0;
            setIsAboutView(false);
            setIsLoading(false);
            slideAnim.setValue(SHEET_HEIGHT_ONE_ROW);
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
            slideAnim.setValue(SHEET_HEIGHT_ONE_ROW);
            fadeAnim.setValue(0);
            setIsInMyPriorities(null);
            setAboutData({ createdAt: null, birthday: null });
        }
    }, [visible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: sheetHeight,
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
            if (event.translationY > 0) swipeY.value = event.translationY;
        })
        .onEnd((event) => {
            if (swipeY.value > SWIPE_CLOSE_THRESHOLD || event.velocityY > 800) {
                runOnJS(handleClose)();
            } else {
                swipeY.value = withSpring(0, { damping: 20, stiffness: 180 });
            }
        });

    // ─── REMOVE ─────────────────────────────────────────────────────────────
    const handleRemove = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            `Remove ${userName}?`,
            'They will be removed from your Priorities. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsLoading(true);
                            await removePriority(authId, targetUUID);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            handleClose();
                            onRemoved?.();
                        } catch {
                            setIsLoading(false);
                            Alert.alert('Error', 'Failed to remove. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    // ─── BLOCK ───────────────────────────────────────────────────────────────
    const handleBlock = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
            `Block ${userName}?`,
            "They won't be able to find you or interact with you on Priorities. They will also be removed from your Priorities list.",
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsLoading(true);
                            await blockUser(authId, targetUUID);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            handleClose();
                            onBlocked?.();
                        } catch {
                            setIsLoading(false);
                            Alert.alert('Error', 'Failed to block. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    // ─── REPORT ──────────────────────────────────────────────────────────────
    const handleReport = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
            `Report ${userName}`,
            'Why are you reporting this account?',
            [
                { text: 'Spam or fake account', onPress: () => confirmReport('Spam or fake account') },
                { text: 'Inappropriate content', onPress: () => confirmReport('Inappropriate content') },
                { text: 'Harassment or bullying', onPress: () => confirmReport('Harassment or bullying') },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const confirmReport = (reason: string) => {
        Alert.alert(
            'Report sent',
            `Thanks for letting us know. We'll review this account for "${reason}".`,
            [{ text: 'OK', onPress: handleClose }]
        );
    };

    // ─── About date helpers ──────────────────────────────────────────────────
    const formatJoinDate = (iso: string | null) => {
        if (!iso) return { day: '--', month: '---', year: '----' };
        const d = new Date(iso);
        return {
            day: String(d.getDate()).padStart(2, '0'),
            month: d.toLocaleString('default', { month: 'short' }).toUpperCase(),
            year: String(d.getFullYear()),
        };
    };

    const formatBirthday = (dateStr: string | null) => {
        if (!dateStr) return { day: '--', month: '---' };
        const d = new Date(`${dateStr}T00:00:00`);
        return {
            day: String(d.getDate()).padStart(2, '0'),
            month: d.toLocaleString('default', { month: 'short' }).toUpperCase(),
        };
    };

    const joinDate = formatJoinDate(aboutData.createdAt);
    const bday = formatBirthday(aboutData.birthday);

    const renderIcon = (
        lib: 'Ionicons' | 'FontAwesome5' | 'MaterialCommunityIcons',
        icon: string,
        color?: string
    ) => {
        const Lib = lib === 'Ionicons' ? Ionicons : lib === 'FontAwesome5' ? FontAwesome5 : MaterialCommunityIcons;
        return <Lib name={icon as any} size={22} color={color ?? COLORS.text} />;
    };

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            statusBarTranslucent
            onRequestClose={handleClose}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={handleClose}>
                        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
                    </TouchableWithoutFeedback>

                    {/* Sheet — height is driven by sheetHeight state */}
                    <Animated.View
                        style={[
                            styles.sheetContainer,
                            { height: sheetHeight, transform: [{ translateY: slideAnim }] },
                        ]}
                    >
                        <Reanimated.View
                            style={[styles.sheetInner, { transform: [{ translateY: swipeY }] }]}
                        >
                            <View style={[StyleSheet.absoluteFill, styles.sheetWhiteBase]} />
                            <Animated.View
                                style={[StyleSheet.absoluteFill, { backgroundColor: animatedSheetBgColor }]}
                            />

                            {/* ── ABOUT VIEW ─────────────────────────────── */}
                            {isAboutView ? (
                                <View style={styles.aboutContainer}>
                                    <TouchableOpacity
                                        style={styles.aboutBackButton}
                                        onPress={() => setIsAboutView(false)}
                                    >
                                        <Ionicons name="chevron-back" size={24} color="#1C1917" />
                                    </TouchableOpacity>

                                    <Text style={styles.aboutSectionLabel}>About this account</Text>

                                    <View style={styles.aboutRow}>
                                        {/* LEFT — Joined */}
                                        <View style={styles.aboutHalf}>
                                            <Text style={styles.aboutSubLabel}>Joined</Text>
                                            <Text style={styles.aboutBigNumber}>{joinDate.year}</Text>
                                            <Text style={styles.aboutSmallDate}>
                                                {joinDate.month}
                                                <Text style={styles.dot}> · </Text>
                                                {joinDate.day}
                                            </Text>
                                        </View>

                                        {/* Vertical divider */}
                                        <View style={styles.aboutDivider} />

                                        {/* RIGHT — Birthday */}
                                        <View style={styles.aboutHalf}>
                                            <Text style={styles.aboutSubLabel}>Birthday</Text>
                                            <Text style={styles.aboutBigNumber}>{bday.day}</Text>
                                            <Text style={styles.aboutSmallDate}>{bday.month}</Text>
                                        </View>
                                    </View>
                                </View>
                            ) : (
                                /* ── MAIN GRID ───────────────────────────── */
                                <>
                                    <GestureDetector gesture={swipeGesture}>
                                        <View style={styles.handleContainer}>
                                            <View style={styles.handle} />
                                        </View>
                                    </GestureDetector>

                                    {isInMyPriorities === null ? (
                                        <View style={styles.loaderContainer}>
                                            <ActivityIndicator size="small" color={COLORS.text} />
                                        </View>
                                    ) : (
                                        <View style={styles.gridWrapper}>

                                            {/* ── ROW 1: Copy · Share · Info · Block (if not priority) ── */}
                                            <View style={styles.gridRow}>
                                                {/* Copy */}
                                                <TouchableOpacity
                                                    style={styles.gridItem}
                                                    activeOpacity={0.7}
                                                    disabled={isLoading}
                                                    onPress={() => {
                                                        Clipboard.setString(userId);
                                                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                                        handleClose();
                                                    }}
                                                >
                                                    <View style={styles.iconContainer}>
                                                        {renderIcon('Ionicons', 'copy-outline')}
                                                    </View>
                                                    <Text style={styles.gridLabel}>Copy</Text>
                                                </TouchableOpacity>

                                                {/* Share */}
                                                <TouchableOpacity
                                                    style={styles.gridItem}
                                                    activeOpacity={0.7}
                                                    disabled={isLoading}
                                                    onPress={async () => {
                                                        await Share.share({
                                                            message: `Check out ${userName}'s profile on Priorities! @${userId}`,
                                                        });
                                                        handleClose();
                                                    }}
                                                >
                                                    <View style={styles.iconContainer}>
                                                        {renderIcon('Ionicons', 'share-outline')}
                                                    </View>
                                                    <Text style={styles.gridLabel}>Share</Text>
                                                </TouchableOpacity>

                                                {/* Info */}
                                                <TouchableOpacity
                                                    style={styles.gridItem}
                                                    activeOpacity={0.7}
                                                    disabled={isLoading}
                                                    onPress={() => {
                                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                        setIsAboutView(true);
                                                    }}
                                                >
                                                    <View style={styles.iconContainer}>
                                                        {renderIcon('Ionicons', 'information-circle-outline')}
                                                    </View>
                                                    <Text style={styles.gridLabel}>Info</Text>
                                                </TouchableOpacity>

                                                {/* Block — only in row 1 when NOT a priority */}
                                                {!isInMyPriorities && (
                                                    <TouchableOpacity
                                                        style={[styles.gridItem, isLoading && styles.gridItemDisabled]}
                                                        activeOpacity={0.7}
                                                        disabled={isLoading}
                                                        onPress={handleBlock}
                                                    >
                                                        <View style={[styles.iconContainer, styles.dangerBorder]}>
                                                            {renderIcon('MaterialCommunityIcons', 'block-helper', '#FF3B30')}
                                                        </View>
                                                        <Text style={[styles.gridLabel, styles.dangerLabel]}>Block</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            {/* ── ROW 2: only when IS a priority ── */}
                                            {isInMyPriorities && (
                                                <>
                                                    <View style={styles.rowDivider} />
                                                    <View style={styles.gridRow}>
                                                        {/* Remove */}
                                                        <TouchableOpacity
                                                            style={[styles.gridItem, isLoading && styles.gridItemDisabled]}
                                                            activeOpacity={0.7}
                                                            disabled={isLoading}
                                                            onPress={handleRemove}
                                                        >
                                                            <View style={[styles.iconContainer, styles.dangerBorder]}>
                                                                {renderIcon('MaterialCommunityIcons', 'account-remove-outline', '#FF3B30')}
                                                            </View>
                                                            <Text style={[styles.gridLabel, styles.dangerLabel]}>Remove</Text>
                                                        </TouchableOpacity>

                                                        {/* Report */}
                                                        <TouchableOpacity
                                                            style={[styles.gridItem, isLoading && styles.gridItemDisabled]}
                                                            activeOpacity={0.7}
                                                            disabled={isLoading}
                                                            onPress={handleReport}
                                                        >
                                                            <View style={[styles.iconContainer, styles.dangerBorder]}>
                                                                {renderIcon('Ionicons', 'flag-outline', '#FF3B30')}
                                                            </View>
                                                            <Text style={[styles.gridLabel, styles.dangerLabel]}>Report</Text>
                                                        </TouchableOpacity>

                                                        {/* Block */}
                                                        <TouchableOpacity
                                                            style={[styles.gridItem, isLoading && styles.gridItemDisabled]}
                                                            activeOpacity={0.7}
                                                            disabled={isLoading}
                                                            onPress={handleBlock}
                                                        >
                                                            <View style={[styles.iconContainer, styles.dangerBorder]}>
                                                                {renderIcon('MaterialCommunityIcons', 'block-helper', '#FF3B30')}
                                                            </View>
                                                            <Text style={[styles.gridLabel, styles.dangerLabel]}>Block</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </>
                                            )}
                                        </View>
                                    )}
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

    // ── Handle ────────────────────────────────────────────────────────────────
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

    // ── Loader ────────────────────────────────────────────────────────────────
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 16,
    },

    // ── Grid ──────────────────────────────────────────────────────────────────
    gridWrapper: {
        paddingHorizontal: 8,
        paddingBottom: 12,
    },
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    rowDivider: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.07)',
        marginHorizontal: 16,
        marginVertical: 8,
    },
    gridItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,          // tight — keeps single-row sheet compact
        maxWidth: 90,
    },
    gridItemDisabled: {
        opacity: 0.4,
    },
    iconContainer: {
        width: 54,                   // slightly smaller keeps row1 row tight
        height: 54,
        borderRadius: 27,
        backgroundColor: 'rgba(255,255,255,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    dangerBorder: {
        borderColor: '#FF3B30',
        borderWidth: 1,
    },
    gridLabel: {
        fontSize: 11,
        fontFamily: FONTS.bold,
        color: '#1C1917',
        opacity: 0.7,
        textAlign: 'center',
    },
    dangerLabel: {
        color: '#FF3B30',
        opacity: 1,
    },

    // ── About ─────────────────────────────────────────────────────────────────
    aboutContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 16,
        paddingHorizontal: 24,
    },
    aboutBackButton: {
        position: 'absolute',
        top: 16,
        left: 16,
        padding: 8,
    },
    aboutSectionLabel: {
        fontSize: 10,
        fontFamily: FONTS.bold,
        color: '#1C1917',
        opacity: 0.4,
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    aboutRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    aboutHalf: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
    },
    aboutDivider: {
        width: 1,
        height: 80,
        backgroundColor: 'rgba(0,0,0,0.1)',
        marginHorizontal: 8,
    },
    aboutSubLabel: {
        fontSize: 10,
        fontFamily: FONTS.bold,
        color: '#1C1917',
        opacity: 0.4,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    aboutBigNumber: {
        fontSize: 36,
        fontFamily: FONTS.bold,
        fontWeight: '900',
        color: '#1C1917',
        letterSpacing: -1,
        includeFontPadding: false,
    },
    aboutSmallDate: {
        fontSize: 15,
        fontFamily: FONTS.bold,
        fontWeight: '700',
        color: '#1C1917',
        marginTop: -2,
    },
    dot: {
        color: 'rgba(0,0,0,0.2)',
    },
});