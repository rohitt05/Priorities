// src/features/partners/components/AddPartnerModal.tsx

import React, { useEffect, useRef, useState, useCallback } from 'react';
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
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    GestureHandlerRootView,
    GestureDetector,
    Gesture,
    ScrollView,
} from 'react-native-gesture-handler';
import { useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';

import { COLORS, FONTS, FONT_SIZES } from '@/theme/theme';
import { useBackground } from '@/contexts/BackgroundContext';
import { searchUsers } from '@/services/profileService';
import { getMyPriorities } from '@/services/priorityService';
import {
    sendPartnerRequest,
    getIncomingPartnerRequests,
    getOutgoingRequestTo,
    acceptPartnerRequest,
    declinePartnerRequest,
    checkIfAlreadyPartnered,
    PartnerRequest,
} from '@/services/partnerService';
import { supabase } from '@/lib/supabase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;
const SWIPE_CLOSE_THRESHOLD = 80;
const TOP_SECTION_HEIGHT = 180;
const LIST_HEIGHT = SHEET_HEIGHT - TOP_SECTION_HEIGHT;

interface UserItem {
    id: string;
    uniqueUserId: string;
    name: string;
    profilePicture: string;
}

interface AddPartnerModalProps {
    visible: boolean;
    onClose: () => void;
    currentUserUniqueUserId: string;
    onPartnerAccepted: (partnerUUID: string) => void;
}

export default function AddPartnerModal({
    visible,
    onClose,
    currentUserUniqueUserId,
    onPartnerAccepted,
}: AddPartnerModalProps) {
    const insets = useSafeAreaInsets();
    const { bgColor, prevBgColor, colorAnim } = useBackground();

    const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const swipeY = useSharedValue(0);

    const [authUUID, setAuthUUID] = useState('');
    const [searchText, setSearchText] = useState('');
    const [sentMap, setSentMap] = useState<Record<string, 'sent' | 'accepted'>>({});
    const [results, setResults] = useState<UserItem[]>([]);
    const [priorities, setPriorities] = useState<UserItem[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<PartnerRequest[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isPrioritiesLoading, setIsPrioritiesLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Flash banner state
    const [flashMessage, setFlashMessage] = useState('');
    const [showFlash, setShowFlash] = useState(false);
    const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const searchTimeout = useRef<NodeJS.Timeout | null>(null);
    const realtimeChannel = useRef<any>(null);

    const toOpaque = (color: string) => color.replace(/[\d.]+\)$/, '0.4)');
    const animatedSheetBgColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [toOpaque(prevBgColor), toOpaque(bgColor)],
    });

    // ── Show flash banner helper ──────────────────────────────────────────────
    const showFlashBanner = useCallback((message: string) => {
        setFlashMessage(message);
        setShowFlash(true);
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => setShowFlash(false), 2800);
    }, []);

    // ── Load data + realtime on open ──────────────────────────────────────────
    useEffect(() => {
        if (!visible) {
            if (realtimeChannel.current) {
                supabase.removeChannel(realtimeChannel.current);
                realtimeChannel.current = null;
            }
            return;
        }

        setIsPrioritiesLoading(true);

        supabase.auth.getSession().then(({ data: { session } }) => {
            const uuid = session?.user?.id ?? '';
            setAuthUUID(uuid);
            if (!uuid) { setIsPrioritiesLoading(false); return; }

            Promise.all([
                getMyPriorities(uuid),
                getIncomingPartnerRequests(uuid),
            ])
                .then(([prioList, requests]) => {
                    setPriorities(
                        prioList.map((p: any) => ({
                            id: p.id,
                            uniqueUserId: p.uniqueUserId,
                            name: p.name,
                            profilePicture: p.profilePicture ?? '',
                        }))
                    );
                    setIncomingRequests(requests);
                })
                .catch(() => { setPriorities([]); setIncomingRequests([]); })
                .finally(() => setIsPrioritiesLoading(false));

            const channel = supabase
                .channel(`partner_requests_${uuid}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'partner_requests',
                        filter: `receiver_id=eq.${uuid}`,
                    },
                    (payload: any) => {
                        const row = payload.new ?? payload.old;
                        if (!row) return;
                        if (payload.eventType === 'INSERT' && row.status === 'pending') {
                            supabase
                                .from('profiles')
                                .select('id, name, profile_picture, unique_user_id')
                                .eq('id', row.sender_id)
                                .single()
                                .then(({ data: sender }) => {
                                    if (!sender) return;
                                    const newReq: PartnerRequest = {
                                        id: row.id,
                                        senderId: row.sender_id,
                                        receiverId: row.receiver_id,
                                        status: 'pending',
                                        createdAt: row.created_at,
                                        senderName: sender.name,
                                        senderProfilePicture: sender.profile_picture ?? '',
                                        senderUniqueUserId: sender.unique_user_id,
                                    };
                                    setIncomingRequests((prev) => [newReq, ...prev]);
                                });
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'partner_requests',
                        filter: `sender_id=eq.${uuid}`,
                    },
                    (payload: any) => {
                        const row = payload.new;
                        if (!row) return;
                        if (row.status === 'accepted') {
                            setSentMap((prev) => ({ ...prev, [row.receiver_id]: 'accepted' }));
                            onPartnerAccepted(row.receiver_id);
                            handleClose();
                        } else if (row.status === 'declined') {
                            setSentMap((prev) => {
                                const next = { ...prev };
                                delete next[row.receiver_id];
                                return next;
                            });
                        }
                    }
                )
                .subscribe();

            realtimeChannel.current = channel;
        });
    }, [visible]);

    // ── Check outgoing requests ───────────────────────────────────────────────
    const checkOutgoingRequests = useCallback(
        async (users: UserItem[], uuid: string) => {
            if (!uuid || users.length === 0) return;
            const checks = await Promise.all(
                users.map((u) => getOutgoingRequestTo(uuid, u.id))
            );
            const newMap: Record<string, 'sent' | 'accepted'> = {};
            checks.forEach((req, i) => {
                if (req) newMap[users[i].id] = 'sent';
            });
            if (Object.keys(newMap).length > 0) {
                setSentMap((prev) => ({ ...prev, ...newMap }));
            }
        },
        []
    );

    useEffect(() => {
        if (priorities.length > 0 && authUUID) checkOutgoingRequests(priorities, authUUID);
    }, [priorities, authUUID]);

    useEffect(() => {
        if (results.length > 0 && authUUID) checkOutgoingRequests(results, authUUID);
    }, [results, authUUID]);

    // ── Debounced search ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!visible) return;
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (!searchText.trim()) { setResults([]); setIsSearching(false); return; }
        setIsSearching(true);
        searchTimeout.current = setTimeout(async () => {
            try {
                const data = await searchUsers(searchText.trim(), [authUUID]);
                setResults(
                    data
                        .filter((u) => u.unique_user_id !== currentUserUniqueUserId)
                        .map((u) => ({
                            id: u.id,
                            uniqueUserId: u.unique_user_id,
                            name: u.name,
                            profilePicture: u.profile_picture ?? '',
                        }))
                );
            } catch { setResults([]); }
            finally { setIsSearching(false); }
        }, 350);
        return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    }, [searchText, visible]);

    // ── Sheet animation ───────────────────────────────────────────────────────
    useEffect(() => {
        if (visible) {
            swipeY.value = 0;
            setSearchText('');
            setSentMap({});
            setResults([]);
            setIsSearching(false);
            setShowFlash(false);
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
        ]).start(({ finished }) => { if (finished) onClose(); });
    };

    const swipeGesture = Gesture.Pan()
        .activeOffsetY([10, 10])
        .onUpdate((e) => { if (e.translationY > 0) swipeY.value = e.translationY; })
        .onEnd((e) => {
            if (swipeY.value > SWIPE_CLOSE_THRESHOLD || e.velocityY > 800) {
                runOnJS(handleClose)();
            } else {
                swipeY.value = withSpring(0, { damping: 20, stiffness: 180 });
            }
        });

    // ── Send request — checks if receiver is already partnered first ──────────
    const handleSendRequest = async (item: UserItem) => {
        if (processingId || !authUUID) return;
        try {
            setProcessingId(item.id);

            // Check if the target already has a partner before even trying
            const alreadyPartnered = await checkIfAlreadyPartnered(item.id);
            if (alreadyPartnered) {
                showFlashBanner("oops they're already hooked no third wheeling here💔");
                return;
            }

            await sendPartnerRequest(authUUID, item.id);
            setSentMap((prev) => ({ ...prev, [item.id]: 'sent' }));
        } catch (e) {
            console.error('Failed to send partner request:', e);
            // Fallback: DB policy also blocks it — show the same message
            showFlashBanner("oops they're already hooked no third wheeling here💔");
        } finally {
            setProcessingId(null);
        }
    };

    // ── Accept incoming ───────────────────────────────────────────────────────
    const handleAccept = async (req: PartnerRequest) => {
        if (processingId) return;
        try {
            setProcessingId(req.id);
            await acceptPartnerRequest(req.id, req.senderId, req.receiverId);
            setIncomingRequests((prev) => prev.filter((r) => r.id !== req.id));
            onPartnerAccepted(req.senderId);
            handleClose();
        } catch (e) {
            console.error('Failed to accept partner request:', e);
        } finally {
            setProcessingId(null);
        }
    };

    // ── Decline incoming ──────────────────────────────────────────────────────
    const handleDecline = async (req: PartnerRequest) => {
        if (processingId) return;
        try {
            setProcessingId(req.id);
            await declinePartnerRequest(req.id);
            setIncomingRequests((prev) => prev.filter((r) => r.id !== req.id));
        } catch (e) {
            console.error('Failed to decline partner request:', e);
        } finally {
            setProcessingId(null);
        }
    };

    // ── Render user row ───────────────────────────────────────────────────────
    const renderUser = (item: UserItem) => {
        const status = sentMap[item.id];
        const isSent = status === 'sent';
        const isAccepted = status === 'accepted';
        const isProcessing = processingId === item.id;

        return (
            <View key={item.uniqueUserId} style={styles.userRow}>
                {item.profilePicture ? (
                    <Image
                        source={{ uri: item.profilePicture }}
                        style={styles.avatar}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                    />
                ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarInitial}>
                            {item.name?.[0]?.toUpperCase() || '?'}
                        </Text>
                    </View>
                )}
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userHandle}>@{item.uniqueUserId}</Text>
                </View>
                <TouchableOpacity
                    style={[
                        styles.requestBtn,
                        (isSent || isAccepted) && styles.requestBtnSent,
                    ]}
                    activeOpacity={0.75}
                    disabled={isSent || isAccepted || !!processingId}
                    onPress={() => handleSendRequest(item)}
                >
                    {isProcessing ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                        <Text style={[
                            styles.requestBtnText,
                            (isSent || isAccepted) && styles.requestBtnTextSent,
                        ]}>
                            {isAccepted ? 'partners 🩷' : isSent ? 'sent ✓' : 'request'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    // ── Render incoming request row ───────────────────────────────────────────
    const renderIncomingRequest = (req: PartnerRequest) => {
        const isProcessing = processingId === req.id;
        return (
            <View key={req.id} style={styles.requestRow}>
                {req.senderProfilePicture ? (
                    <Image
                        source={{ uri: req.senderProfilePicture }}
                        style={styles.avatar}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                    />
                ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarInitial}>
                            {req.senderName?.[0]?.toUpperCase() || '?'}
                        </Text>
                    </View>
                )}
                <View style={styles.requestTextBox}>
                    <Text style={styles.requestLine} numberOfLines={2}>
                        <Text style={styles.requestSenderName}>{req.senderName}</Text>
                        {' wants to be your partner 🩷'}
                    </Text>
                </View>
                {isProcessing ? (
                    <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />
                ) : (
                    <View style={styles.requestActions}>
                        <TouchableOpacity
                            style={styles.declineBtn}
                            onPress={() => handleDecline(req)}
                            disabled={!!processingId}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="close" size={15} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={() => handleAccept(req)}
                            disabled={!!processingId}
                        >
                            <Text style={styles.acceptBtnText}>accept</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
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

                    <Animated.View style={[
                        styles.sheetContainer,
                        { transform: [{ translateY: slideAnim }] },
                    ]}>
                        <Reanimated.View style={[
                            styles.sheetInner,
                            { transform: [{ translateY: swipeY }] },
                        ]}>
                            <View style={[StyleSheet.absoluteFill, styles.sheetWhiteBase]} />
                            <Animated.View style={[
                                StyleSheet.absoluteFill,
                                styles.sheetBackground,
                                { backgroundColor: animatedSheetBgColor },
                            ]} />

                            {/* Fixed top */}
                            <GestureDetector gesture={swipeGesture}>
                                <View style={styles.topSection}>
                                    <View style={styles.handleContainer}>
                                        <View style={styles.handle} />
                                    </View>
                                    <Text style={styles.title}>Add your partner</Text>
                                    <View style={styles.searchBar}>
                                        <TextInput
                                            style={styles.searchInput}
                                            placeholder="who's your partner?"
                                            placeholderTextColor={COLORS.textSecondary}
                                            selectionColor={COLORS.primary}
                                            autoCorrect={false}
                                            autoCapitalize="none"
                                            value={searchText}
                                            onChangeText={setSearchText}
                                        />
                                        <View style={styles.searchIconWrapper}>
                                            {isSearching
                                                ? <ActivityIndicator size="small" color={COLORS.textSecondary} />
                                                : <FontAwesome5 name="search" size={14} color={COLORS.textSecondary} />
                                            }
                                        </View>
                                    </View>
                                </View>
                            </GestureDetector>

                            {/* Scrollable list */}
                            <ScrollView
                                style={{ height: LIST_HEIGHT }}
                                contentContainerStyle={[
                                    styles.scrollContent,
                                    { paddingBottom: Math.max(insets.bottom + 20, 32) },
                                ]}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                bounces
                                scrollEventThrottle={16}
                            >
                                {incomingRequests.length > 0 && (
                                    <View style={styles.incomingSection}>
                                        <Text style={styles.sectionTitle}>Partner Requests</Text>
                                        {incomingRequests.map(renderIncomingRequest)}
                                        <View style={styles.sectionDivider} />
                                    </View>
                                )}

                                {!searchText.trim() ? (
                                    <View>
                                        <Text style={styles.sectionTitle}>Your Priorities</Text>
                                        {isPrioritiesLoading ? (
                                            <ActivityIndicator
                                                size="small"
                                                color={COLORS.textSecondary}
                                                style={{ marginTop: 20 }}
                                            />
                                        ) : priorities.length === 0 ? (
                                            <Text style={styles.emptyText}>no priorities yet</Text>
                                        ) : (
                                            priorities.map(renderUser)
                                        )}
                                        <Text style={[
                                            styles.emptyText,
                                            { marginTop: priorities.length > 0 ? 40 : 10 },
                                        ]}>
                                            or search by name or @handle
                                        </Text>
                                    </View>
                                ) : isSearching ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="small" color={COLORS.textSecondary} />
                                    </View>
                                ) : results.length === 0 ? (
                                    <Text style={styles.emptyText}>no one found</Text>
                                ) : (
                                    results.map(renderUser)
                                )}
                            </ScrollView>

                            {/* Flash banner — floats inside the sheet at the bottom */}
                            {showFlash && (
                                <Reanimated.View
                                    entering={FadeIn.duration(200).springify().damping(15).stiffness(150)}
                                    exiting={FadeOut.duration(250)}
                                    style={[
                                        styles.flashBanner,
                                        { bottom: Math.max(insets.bottom + 16, 28) },
                                    ]}
                                    pointerEvents="none"
                                >
                                    <Text style={styles.flashText}>{flashMessage}</Text>
                                </Reanimated.View>
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
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    sheetContainer: {
        height: SHEET_HEIGHT,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
    },
    sheetInner: {
        flex: 1,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
    },
    sheetWhiteBase: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    sheetBackground: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    topSection: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
    },
    handleContainer: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 10,
    },
    handle: {
        width: 44,
        height: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    title: {
        fontSize: FONT_SIZES.lg,
        fontFamily: FONTS.bold,
        fontWeight: '800',
        color: '#2C2720',
        marginTop: 6,
        marginBottom: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(44, 39, 32, 0.06)',
        borderRadius: 18,
        paddingHorizontal: 16,
        height: 48,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchInput: {
        flex: 1,
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.regular,
        color: COLORS.text,
        paddingVertical: 0,
    },
    searchIconWrapper: {
        marginLeft: 10,
        justifyContent: 'center',
        alignItems: 'center',
        width: 20,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    loadingContainer: {
        marginTop: 40,
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 12,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 10,
        marginBottom: 8,
    },
    incomingSection: {
        marginBottom: 4,
    },
    sectionDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: COLORS.border,
        marginTop: 8,
        marginBottom: 4,
    },
    requestRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 11,
    },
    requestTextBox: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },
    requestLine: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.text,
        lineHeight: 18,
    },
    requestSenderName: {
        fontFamily: FONTS.bold,
        fontWeight: '700',
    },
    requestActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    declineBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptBtn: {
        paddingHorizontal: 13,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptBtnText: {
        fontSize: 12,
        fontFamily: FONTS.bold,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.2,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: COLORS.surfaceLight,
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.secondary,
    },
    avatarInitial: {
        fontFamily: FONTS.bold,
        fontSize: FONT_SIZES.sm,
        color: '#FFFFFF',
    },
    userInfo: {
        flex: 1,
        marginLeft: 12,
    },
    userName: {
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.bold,
        fontWeight: '700',
        color: COLORS.text,
    },
    userHandle: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    requestBtn: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        backgroundColor: 'transparent',
        minWidth: 72,
        alignItems: 'center',
        justifyContent: 'center',
    },
    requestBtnSent: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    requestBtnText: {
        fontSize: 12,
        fontFamily: FONTS.bold,
        fontWeight: '700',
        color: COLORS.primary,
        textTransform: 'lowercase',
        letterSpacing: 0.3,
    },
    requestBtnTextSent: {
        color: '#FFFFFF',
    },
    emptyText: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.regular,
        marginTop: 32,
    },
    flashBanner: {
        position: 'absolute',
        alignSelf: 'center',
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.88)',
        borderRadius: 999,
        paddingHorizontal: 20,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
        zIndex: 999,
    },
    flashText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontFamily: FONTS.bold,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: -0.1,
    },
});