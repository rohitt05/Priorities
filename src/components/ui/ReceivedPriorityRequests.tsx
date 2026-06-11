import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    Pressable,
    TextInput,
    Keyboard,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
    useAnimatedStyle,
    interpolate,
    Extrapolate,
    SharedValue,
    FadeInDown,
    FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { COLORS, FONTS } from '@/theme/theme';
import { acceptPriorityRequest, declinePriorityRequest } from '@/services/priorityService';
import { getCurrentUserId } from '@/services/authService';
import { usePrioritiesRefresh } from '@/contexts/PrioritiesRefreshContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useBackground } from '@/contexts/BackgroundContext';


// ─── Color utils ───────────────────────────────────────────
const parseColorToRgb = (colorStr: string): { r: number; g: number; b: number } => {
    if (!colorStr) return { r: 253, g: 252, b: 240 };
    const str = colorStr.trim().toLowerCase();
    if (str.startsWith('#')) {
        const hex = str.length === 4
            ? '#' + str[1] + str[1] + str[2] + str[2] + str[3] + str[3]
            : str;
        return {
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16),
        };
    }
    if (str.startsWith('rgb')) {
        const matches = str.match(/\d+/g);
        if (matches && matches.length >= 3) {
            return {
                r: parseInt(matches[0], 10),
                g: parseInt(matches[1], 10),
                b: parseInt(matches[2], 10),
            };
        }
    }
    return { r: 253, g: 252, b: 240 };
};

// ─── Time ago util ─────────────────────────────────────────
const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};


const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ITEM_HEIGHT = 90;
const HEADER_HEIGHT = 118;

// ─── Accent colors per notification type ──────────────────
const ACCENT = {
    theySent: { bar: COLORS.textSecondary, ring: 'rgba(67, 61, 53, 0.05)', badge: 'rgba(67, 61, 53, 0.05)', badgeText: COLORS.textSecondary },
    youSent: { bar: COLORS.textSecondary, ring: 'rgba(67, 61, 53, 0.05)', badge: 'rgba(67, 61, 53, 0.05)', badgeText: COLORS.textSecondary },
    pending: { bar: COLORS.primary, ring: 'rgba(61, 42, 71, 0.12)', badge: COLORS.primary, badgeText: '#fff' },
};


// ─── Types ─────────────────────────────────────────────────
type RequestStatus = 'pending' | 'accepted' | 'declined' | string;

type PendingRequestItem = {
    id: string;
    sender_id: string;
    created_at: string;
    status: RequestStatus;
    profiles: {
        id: string;
        unique_user_id: string | null;
        name: string;
        profile_picture: string | null;
        dominant_color: string | null;
    } | null;
};

type AcceptedNotificationItem = {
    id: string;
    type: 'accepted';
    created_at: string;
    priority_request_id: string | null;
    sender_id: string;
    receiver_id: string;
    accepted_by: string;
    isSender: boolean;
    profiles: {
        id: string;
        unique_user_id: string | null;
        name: string;
        profile_picture: string | null;
        dominant_color: string | null;
    } | null;
};

type NotificationItem = PendingRequestItem | AcceptedNotificationItem;

interface ItemProps {
    item: NotificationItem;
    index: number;
    scrollY: SharedValue<number>;
    onAccept: (item: PendingRequestItem) => void;
    onDecline: (id: string) => void;
}

const isAcceptedNotificationItem = (item: NotificationItem): item is AcceptedNotificationItem =>
    'type' in item && item.type === 'accepted';

const isPendingRequestItem = (item: NotificationItem): item is PendingRequestItem =>
    !('type' in item);


// ─── Card ──────────────────────────────────────────────────
const RequestItemCard = ({ item, index, scrollY, onAccept, onDecline }: ItemProps) => {
    const user = item.profiles;
    const isAccepted = isAcceptedNotificationItem(item) || item.status === 'accepted';

    // Pick accent based on notification type
    const accent = isAccepted
        ? isAcceptedNotificationItem(item)
            ? item.isSender ? ACCENT.youSent : ACCENT.theySent
            : ACCENT.youSent
        : ACCENT.pending;

    const animatedStyle = useAnimatedStyle(() => {
        const itemPosition = index * ITEM_HEIGHT;
        const relativePosition = itemPosition - scrollY.value;

        const opacity = interpolate(
            relativePosition,
            [-ITEM_HEIGHT, 0, SCREEN_HEIGHT * 0.75, SCREEN_HEIGHT * 0.9],
            [0, 1, 1, 0],
            Extrapolate.CLAMP
        );
        const scale = interpolate(
            relativePosition,
            [-ITEM_HEIGHT, 0, SCREEN_HEIGHT * 0.40, SCREEN_HEIGHT * 0.6],
            [0.97, 1, 1, 0.97],
            Extrapolate.CLAMP
        );
        const translateY = interpolate(
            relativePosition,
            [-ITEM_HEIGHT, 0, SCREEN_HEIGHT * 0.45],
            [8, 0, 8],
            Extrapolate.CLAMP
        );

        return { opacity, transform: [{ scale }, { translateY }] };
    });

    if (!user) return null;

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 30).duration(180)}
            exiting={FadeOut.duration(200)}
            style={[styles.cardOuter, animatedStyle]}
        >
            {/* Avatar */}
            <UserAvatar uri={user.profile_picture ?? ''} style={styles.avatar} />

            {/* Text */}
            <View style={styles.cardBody}>
                <Text style={styles.nameText} numberOfLines={1}>{user.name}</Text>
                <View style={styles.metaRow}>
                    <Text style={styles.handleText}>@{user.unique_user_id ?? ''}</Text>
                    {item.created_at ? (
                        <>
                            <View style={styles.metaDot} />
                            <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
                        </>
                    ) : null}
                </View>
            </View>

            {/* Right actions */}
            {isAccepted ? (
                <View style={styles.rightWrap}>
                    <Text style={styles.contextLabel}>
                        {isAcceptedNotificationItem(item)
                            ? item.isSender ? 'you sent' : 'they sent'
                            : ''}
                    </Text>
                    <View style={[styles.pill, { backgroundColor: accent.badge, borderColor: 'rgba(67, 61, 53, 0.08)' }]}>
                        <Text style={[styles.pillText, { color: accent.badgeText }]}>
                            {isAcceptedNotificationItem(item)
                                ? item.isSender ? 'they accepted' : 'you accepted'
                                : 'accepted'}
                        </Text>
                    </View>
                </View>
            ) : (
                <View style={styles.actionsRow}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.declineBtn,
                            { transform: [{ scale: pressed ? 0.92 : 1 }] }
                        ]}
                        onPress={() => onDecline(item.id)}
                    >
                        <Ionicons name="close" size={18} color="rgba(67, 61, 53, 0.7)" />
                    </Pressable>
                    {isPendingRequestItem(item) ? (
                        <Pressable
                            style={({ pressed }) => [
                                styles.acceptBtn,
                                { transform: [{ scale: pressed ? 0.95 : 1 }] }
                            ]}
                            onPress={() => onAccept(item)}
                        >
                            <Text style={styles.acceptBtnText}>Accept</Text>
                        </Pressable>
                    ) : null}
                </View>
            )}
        </Animated.View>
    );
};


// ─── Main component ────────────────────────────────────────
const ReceivedPriorityRequests = ({
    requests,
    opacity,
    onRequestsChange,
    onRelationshipOpen,
    onRelationshipClose,
    ListHeaderComponent,
    ListEmptyComponent,
}: {
    requests: NotificationItem[];
    opacity: SharedValue<number>;
    onRequestsChange: (updated: NotificationItem[]) => void;
    onRelationshipOpen?: () => void;
    onRelationshipClose?: () => void;
    ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
    ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
}) => {
    const { bgColor } = useBackground();

    const blendedColor = React.useMemo(() => {
        const rgb = parseColorToRgb(bgColor);
        return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }, [bgColor]);

    const blendedTransparent = React.useMemo(() =>
        blendedColor.replace('rgb', 'rgba').replace(')', ', 0)'),
        [blendedColor]);

    const [currentRequests, setCurrentRequests] = React.useState<NotificationItem[]>(requests);
    const [pendingItem, setPendingItem] = React.useState<PendingRequestItem | null>(null);
    const [relationshipLabel, setRelationshipLabel] = React.useState('');
    const [isAccepting, setIsAccepting] = React.useState(false);
    const [keyboardHeight, setKeyboardHeight] = React.useState(0);
    const { triggerRefresh } = usePrioritiesRefresh();

    React.useEffect(() => { setCurrentRequests(requests); }, [requests]);

    React.useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, e => setKeyboardHeight(e.endCoordinates.height));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
        return () => { showSub.remove(); hideSub.remove(); };
    }, []);

    const scrollY = useSharedValue(0);
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: e => { scrollY.value = e.contentOffset.y; },
    });

    const syncRequests = (updated: NotificationItem[]) => {
        setCurrentRequests(updated);
        onRequestsChange(updated);
    };

    const handleAcceptTap = (item: PendingRequestItem) => {
        setPendingItem(item);
        setRelationshipLabel('');
        onRelationshipOpen?.();
    };

    const handleConfirmAccept = async () => {
        if (!pendingItem) return;
        setIsAccepting(true);
        try {
            const currentUserId = await getCurrentUserId();
            await acceptPriorityRequest(
                pendingItem.id,
                pendingItem.sender_id,
                currentUserId,
                relationshipLabel || undefined
            );
            const updated = currentRequests.map(r => {
                if (r.id !== pendingItem.id || !isPendingRequestItem(r)) return r;
                return { ...r, status: 'accepted' };
            });
            syncRequests(updated);
            triggerRefresh();
            setPendingItem(null);
            setRelationshipLabel('');
            Keyboard.dismiss();
            onRelationshipClose?.();
        } catch (err) {
            console.error('Accept error:', err);
        } finally {
            setIsAccepting(false);
        }
    };

    const handleDecline = async (id: string) => {
        try {
            await declinePriorityRequest(id);
            syncRequests(currentRequests.filter(r => r.id !== id));
        } catch (err) {
            console.error('Decline error:', err);
        }
    };

    const closeRelationshipModal = () => {
        setPendingItem(null);
        setRelationshipLabel('');
        Keyboard.dismiss();
        onRelationshipClose?.();
    };

    const listAnimatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: interpolate(opacity.value, [0, 1], [10, 0]) }],
    }));

    return (
        <Animated.View style={[styles.container, listAnimatedStyle]}>
            <Animated.FlatList
                data={currentRequests}
                keyExtractor={item => item.id}
                ListHeaderComponent={ListHeaderComponent}
                ListEmptyComponent={ListEmptyComponent}
                renderItem={({ item, index }) => (
                    <RequestItemCard
                        item={item}
                        index={index}
                        scrollY={scrollY}
                        onAccept={handleAcceptTap}
                        onDecline={handleDecline}
                    />
                )}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                style={styles.list}
            />

            {/* Accept relationship modal */}
            {pendingItem && (
                <View style={styles.overlayRoot} pointerEvents="box-none">
                    <Pressable style={styles.backdrop} onPress={closeRelationshipModal} />
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
                        style={styles.keyboardAvoider}
                    >
                        <View style={[
                            styles.relationshipOverlay,
                            Platform.OS === 'android' && keyboardHeight > 0
                                ? { bottom: keyboardHeight + 12 }
                                : null,
                        ]}>
                            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
                            <Text style={styles.relTitle}>
                                Who is {pendingItem.profiles?.name} to you?
                            </Text>
                            <TextInput
                                style={styles.relInput}
                                placeholder="e.g. Best Friend, Sister, Mentor..."
                                placeholderTextColor="rgba(61, 42, 71, 0.4)"
                                value={relationshipLabel}
                                onChangeText={setRelationshipLabel}
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={handleConfirmAccept}
                                blurOnSubmit={false}
                            />
                            <View style={styles.relButtons}>
                                <Pressable style={styles.cancelButton} onPress={closeRelationshipModal}>
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.confirmButton,
                                        { opacity: pressed || isAccepting ? 0.7 : 1 },
                                    ]}
                                    onPress={handleConfirmAccept}
                                    disabled={isAccepting}
                                >
                                    <Text style={styles.confirmText}>
                                        {isAccepting ? 'Accepting...' : 'Accept & Save'}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            )}

        </Animated.View>
    );
};


// ─── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
        zIndex: 2500,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingTop: 12,
        paddingBottom: 32,
        paddingHorizontal: 16,
    },

    // ── List Item ──
    cardOuter: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.55)',
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(67, 61, 53, 0.05)',

    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#eee',
        marginRight: 14,
    },
    cardBody: {
        flex: 1,
        justifyContent: 'center',
    },
    nameText: {
        fontFamily: FONTS.bold,
        fontSize: 15,
        color: COLORS.primary,
        marginBottom: 3,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    handleText: {
        fontFamily: FONTS.regular,
        fontSize: 12,
        color: COLORS.textSecondary,
        opacity: 0.75,
    },
    metaDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: COLORS.textSecondary,
        opacity: 0.4,
        marginHorizontal: 5,
    },
    timeText: {
        fontFamily: FONTS.regular,
        fontSize: 11,
        color: COLORS.textSecondary,
        opacity: 0.6,
    },

    // ── Accepted right side ──
    rightWrap: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 5,
    },
    contextLabel: {
        fontFamily: FONTS.medium,
        fontSize: 10,
        color: COLORS.textSecondary,
        opacity: 0.6,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    pill: {
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    pillText: {
        fontFamily: FONTS.bold,
        fontSize: 11,
        letterSpacing: 0.2,
    },

    // ── Pending actions ──
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    declineBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(67, 61, 53, 0.06)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 2,
    },
    acceptBtnText: {
        color: COLORS.background,
        fontFamily: FONTS.bold,
        fontSize: 13,
    },

    // ── Relationship modal ──
    overlayRoot: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 4000,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.18)',
    },
    keyboardAvoider: {
        justifyContent: 'flex-end',
    },
    relationshipOverlay: {
        marginHorizontal: 16,
        marginBottom: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: 24,
        padding: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(67, 61, 53, 0.08)',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 5,
    },
    relTitle: {
        fontFamily: FONTS.bold,
        fontSize: 18,
        color: COLORS.primary,
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    relInput: {
        height: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 15,
        fontFamily: FONTS.regular,
        color: COLORS.primary,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
    },
    relButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    cancelButton: {
        flex: 1,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    cancelText: {
        color: COLORS.primary,
        fontFamily: FONTS.bold,
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    confirmButton: {
        flex: 2,
        backgroundColor: COLORS.primary,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmText: {
        color: COLORS.background,
        fontFamily: FONTS.bold,
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

});

export default ReceivedPriorityRequests;