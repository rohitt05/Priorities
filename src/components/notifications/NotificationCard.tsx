import React from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    Dimensions,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    interpolate,
    Easing,
    runOnJS,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/theme/theme';

const { width: SW, height: SH } = Dimensions.get('window');

const SPRING_OUT = Easing.bezier(0.34, 1.56, 0.64, 1);
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);
const EASE_BACK = Easing.bezier(0.36, 0, 0.66, 0);

export type NotifCardData = {
    id: string;
    name: string;
    handle: string;
    profilePicture: string | null;
    dominantColor: string | null;
    type: 'theySent' | 'youSent' | 'pending';
    created_at: string;
    senderId?: string;
    requestId?: string;
};

interface Props {
    data: NotifCardData;
    cardX: number;
    cardY: number;
    cardWidth: number;
    cardHeight: number;
    containerOffsetY: number;
    onAccept?: (data: NotifCardData) => void;
    onDecline?: (data: NotifCardData) => void;
    onDismiss?: () => void;
}

const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return Math.floor(h / 24) === 1 ? 'Yesterday' : `${Math.floor(h / 24)}d ago`;
};

export const NotificationCard: React.FC<Props> = ({
    data,
    cardX,
    cardY,
    cardWidth,
    cardHeight,
    containerOffsetY,
    onAccept,
    onDecline,
    onDismiss,
}) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [showBack, setShowBack] = React.useState(false);

    const expand = useSharedValue(0);
    const flip = useSharedValue(0);
    const backdrop = useSharedValue(0);

    const TARGET_W = SW * 0.84;
    const TARGET_H = SH * 0.62;
    const TARGET_X = (SW - TARGET_W) / 2;
    const TARGET_Y = (SH - TARGET_H) / 2;

    const absX = cardX;
    const absY = cardY + containerOffsetY;

    const isSmall = cardWidth < 90;

    const handleTap = () => {
        if (isExpanded) return;
        setIsExpanded(true);
        backdrop.value = withTiming(1, { duration: 240 });
        expand.value = withTiming(1, { duration: 480, easing: SPRING_OUT }, () => {
            flip.value = withDelay(60, withTiming(1, {
                duration: 540,
                easing: Easing.bezier(0.4, 0, 0.2, 1),
            }, () => {
                runOnJS(setShowBack)(true);
            }));
        });
    };

    const handleClose = () => {
        runOnJS(setShowBack)(false);
        flip.value = withTiming(0, { duration: 360, easing: EASE_BACK }, () => {
            expand.value = withTiming(0, { duration: 340, easing: EASE_IN });
            backdrop.value = withTiming(0, { duration: 280 }, () => {
                runOnJS(setIsExpanded)(false);
                onDismiss && runOnJS(onDismiss)();
            });
        });
    };

    const cardAnimStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        left: interpolate(expand.value, [0, 1], [absX, TARGET_X]),
        top: interpolate(expand.value, [0, 1], [absY, TARGET_Y]),
        width: interpolate(expand.value, [0, 1], [cardWidth, TARGET_W]),
        height: interpolate(expand.value, [0, 1], [cardHeight, TARGET_H]),
        borderRadius: interpolate(expand.value, [0, 1], [12, 28]),
        zIndex: isExpanded ? 9000 : 10,
    }));

    const frontStyle = useAnimatedStyle(() => ({
        transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
        backfaceVisibility: 'hidden' as const,
    }));

    const backStyle = useAnimatedStyle(() => ({
        transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
        backfaceVisibility: 'hidden' as const,
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdrop.value,
        zIndex: isExpanded ? 8999 : -1,
    }));

    const pillLabel =
        data.type === 'pending' ? 'Sent you a request' :
            data.type === 'youSent' ? 'They accepted ✓' :
                'You accepted ✓';

    const pillBg = data.type === 'pending' ? COLORS.primary : 'rgba(61,170,110,0.15)';
    const pillTextColor = data.type === 'pending' ? '#fff' : '#2E8A56';

    return (
        <>
            {isExpanded && (
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: 'rgba(0,0,0,0.45)' },
                        backdropStyle,
                    ]}
                    pointerEvents="box-none"
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
                </Animated.View>
            )}

            <Animated.View style={[styles.cardWrapper, cardAnimStyle]}>
                <Pressable
                    onPress={handleTap}
                    style={StyleSheet.absoluteFill}
                    disabled={isExpanded}
                >
                    {/* ── FRONT ── */}
                    <Animated.View style={[StyleSheet.absoluteFill, frontStyle, styles.face]}>
                        <Image
                            source={{ uri: data.profilePicture ?? '' }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={200}
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.58)']}
                            style={styles.frontGradient}
                            pointerEvents="none"
                        />
                        {!isSmall && (
                            <View style={[styles.typeBadge, { backgroundColor: pillBg }]}>
                                <Text style={[styles.typeBadgeText, { color: pillTextColor }]}>
                                    {pillLabel}
                                </Text>
                            </View>
                        )}
                        <View style={styles.frontBottom}>
                            <Text style={styles.frontName} numberOfLines={1}>{data.name}</Text>
                            {!isSmall && (
                                <Text style={styles.frontHandle}>@{data.handle}</Text>
                            )}
                        </View>
                    </Animated.View>

                    {/* ── BACK ── */}
                    <Animated.View style={[StyleSheet.absoluteFill, backStyle, styles.face, styles.backFace]}>
                        <View style={styles.backContent}>
                            <View style={[
                                styles.backAvatarRing,
                                { borderColor: (data.dominantColor ?? COLORS.primary) + '66' },
                            ]}>
                                <Image
                                    source={{ uri: data.profilePicture ?? '' }}
                                    style={styles.backAvatar}
                                    contentFit="cover"
                                />
                            </View>
                            <Text style={styles.backName}>{data.name}</Text>
                            <Text style={styles.backHandle}>@{data.handle}</Text>
                            <Text style={styles.backTime}>{timeAgo(data.created_at)}</Text>

                            <View style={[
                                styles.backPill,
                                {
                                    backgroundColor: pillBg,
                                    borderColor: (data.dominantColor ?? COLORS.primary) + '33',
                                },
                            ]}>
                                <Text style={[styles.backPillText, { color: pillTextColor }]}>
                                    {pillLabel}
                                </Text>
                            </View>

                            {data.type === 'pending' ? (
                                <View style={styles.backActions}>
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.declineBtn,
                                            { opacity: pressed ? 0.6 : 1 },
                                        ]}
                                        onPress={() => { handleClose(); onDecline?.(data); }}
                                    >
                                        <Ionicons name="close" size={20} color="rgba(0,0,0,0.5)" />
                                        <Text style={styles.declineText}>Decline</Text>
                                    </Pressable>
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.acceptBtn,
                                            { backgroundColor: COLORS.primary, opacity: pressed ? 0.75 : 1 },
                                        ]}
                                        onPress={() => { handleClose(); onAccept?.(data); }}
                                    >
                                        <Ionicons name="checkmark" size={20} color="#fff" />
                                        <Text style={styles.acceptText}>Accept</Text>
                                    </Pressable>
                                </View>
                            ) : (
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.closeBtn,
                                        { opacity: pressed ? 0.6 : 1 },
                                    ]}
                                    onPress={handleClose}
                                >
                                    <Text style={styles.closeBtnText}>Close</Text>
                                </Pressable>
                            )}
                        </View>
                    </Animated.View>
                </Pressable>
            </Animated.View>
        </>
    );
};

const styles = StyleSheet.create({
    cardWrapper: {
        overflow: 'visible',
    },
    face: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: 12,
        overflow: 'hidden',
    },
    backFace: {
        backgroundColor: 'rgba(253,252,240,0.98)',
    },

    // ── Front ──
    frontGradient: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: '55%',
    },
    typeBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    typeBadgeText: {
        fontFamily: FONTS.bold,
        fontSize: 10,
        letterSpacing: 0.2,
    },
    frontBottom: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
    },
    frontName: {
        fontFamily: FONTS.bold,
        fontSize: 14,
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    frontHandle: {
        fontFamily: FONTS.regular,
        fontSize: 11,
        color: 'rgba(255,255,255,0.72)',
        marginTop: 1,
    },

    // ── Back ──
    backContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    backAvatarRing: {
        width: 84,
        height: 84,
        borderRadius: 42,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    backAvatar: {
        width: 76,
        height: 76,
        borderRadius: 38,
    },
    backName: {
        fontFamily: FONTS.bold,
        fontSize: 20,
        color: COLORS.primary,
        marginBottom: 3,
    },
    backHandle: {
        fontFamily: FONTS.regular,
        fontSize: 13,
        color: COLORS.textSecondary,
        opacity: 0.65,
        marginBottom: 5,
    },
    backTime: {
        fontFamily: FONTS.regular,
        fontSize: 11,
        color: COLORS.textSecondary,
        opacity: 0.45,
        marginBottom: 18,
    },
    backPill: {
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 22,
        borderWidth: 1,
        marginBottom: 24,
    },
    backPillText: {
        fontFamily: FONTS.bold,
        fontSize: 12,
        letterSpacing: 0.2,
    },
    backActions: {
        flexDirection: 'row',
        gap: 10,
    },
    declineBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 26,
        backgroundColor: 'rgba(0,0,0,0.06)',
    },
    declineText: {
        fontFamily: FONTS.bold,
        fontSize: 14,
        color: 'rgba(0,0,0,0.5)',
    },
    acceptBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 26,
    },
    acceptText: {
        fontFamily: FONTS.bold,
        fontSize: 14,
        color: '#fff',
    },
    closeBtn: {
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 26,
        backgroundColor: 'rgba(61,42,71,0.07)',
    },
    closeBtnText: {
        fontFamily: FONTS.bold,
        fontSize: 14,
        color: COLORS.primary,
    },
});