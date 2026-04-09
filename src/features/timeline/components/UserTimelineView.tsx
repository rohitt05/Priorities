// src/features/timeline/components/UserTimelineView.tsx
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, Image, TouchableOpacity,
    LayoutRectangle, BackHandler, ActivityIndicator,
    ScrollView, Pressable,
} from 'react-native';
import Animated, {
    useAnimatedStyle, interpolate, SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBackground } from '@/contexts/BackgroundContext';
import { COLORS, SPACING, FONTS } from '@/theme/theme';
import TimelineCalendar from './TimelineCalendar';
import MediaViewer from '@/components/ui/MediaViewer';
import { MediaItem } from '@/types/mediaTypes';
import { User, TimelineEvent } from '@/types/domain';
import { useUserTimeline } from '@/contexts/UserTimelineContext';
import {
    fetchIncomingDeleteRequests,
    respondToDeleteRequest,
    MemoryDeleteRequest,
} from '@/services/memoryDeleteService';


const formatTimestamp = (isoTs: string): string => {
    const date = new Date(isoTs);
    return date.toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

const timeAgo = (isoTs: string): string => {
    const diff = Date.now() - new Date(isoTs).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};


interface UserTimelineViewProps {
    user: User | null;
    originLayout: LayoutRectangle | null;
    expandAnim: SharedValue<number>;
    onClose: () => void;
}


export default function UserTimelineView({
    user, originLayout, expandAnim, onClose,
}: UserTimelineViewProps) {
    const { top: topInset } = useSafeAreaInsets();
    const { bgColor, prevBgColor } = useBackground();
    const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
    const [animationDone, setAnimationDone] = useState(false);

    // ─── Delete requests panel state ──────────────────────────────────────
    const [requestsPanelVisible, setRequestsPanelVisible] = useState(false);
    const [deleteRequests, setDeleteRequests] = useState<MemoryDeleteRequest[]>([]);
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [respondingId, setRespondingId] = useState<string | null>(null);
    // ─────────────────────────────────────────────────────────────────────

    const { liveTimelineEvents } = useUserTimeline();


    useEffect(() => {
        if (!user) return;
        setAnimationDone(false);
        const timer = setTimeout(() => setAnimationDone(true), 420);
        return () => clearTimeout(timer);
    }, [user?.uniqueUserId]);


    useEffect(() => {
        if (!user) return;
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (requestsPanelVisible) { setRequestsPanelVisible(false); return true; }
            if (mediaViewerVisible) { handleCloseMediaViewer(); return true; }
            onClose();
            return true;
        });
        return () => backHandler.remove();
    }, [user, mediaViewerVisible, requestsPanelVisible, onClose]);


    // ── Load delete requests scoped to this user ─────────────────────────
    const loadDeleteRequests = useCallback(async () => {
        setRequestsLoading(true);
        try {
            const all = await fetchIncomingDeleteRequests();
            // Filter to only requests from THIS specific user
            const filtered = user
                ? all.filter(r => r.requesterId === user.id)
                : all;
            setDeleteRequests(filtered);
        } finally {
            setRequestsLoading(false);
        }
    }, [user?.id]);


    const handleOpenRequestsPanel = useCallback(() => {
        setRequestsPanelVisible(true);
        loadDeleteRequests();
    }, [loadDeleteRequests]);


    // ── Respond to a single request ───────────────────────────────────────
    const handleRespond = useCallback(async (
        request: MemoryDeleteRequest,
        response: 'approved' | 'rejected',
    ) => {
        setRespondingId(request.id);
        // Find the media URI from the local timeline events (for storage cleanup)
        const allEvents = user ? (liveTimelineEvents[user.uniqueUserId] ?? []) : [];
        const matchingEvent = allEvents.find((e: any) => e.id === request.sourceId) as any;
        const mediaUri = matchingEvent?.uri ?? null;

        const ok = await respondToDeleteRequest(request.id, response, mediaUri, request.sourceId);
        if (ok) {
            // Remove from local list immediately — optimistic
            setDeleteRequests(prev => prev.filter(r => r.id !== request.id));
        }
        setRespondingId(null);
    }, [user, liveTimelineEvents]);
    // ─────────────────────────────────────────────────────────────────────


    // ── Single source of truth: user_timelines (HISTORY LAYER) ──────────────────
    const mergedEvents = useMemo((): TimelineEvent[] => {
        if (!user) return [];
        return liveTimelineEvents[user.uniqueUserId] ?? [];
    }, [user, liveTimelineEvents]);


    const allUserMedia = useMemo((): MediaItem[] => {
        return mergedEvents.map((event) => {
            const ev = event as any;
            return {
                id: ev.id,
                type: (ev.type === 'image' || ev.type === 'photo') ? 'photo' : ev.type,
                uri: ev.uri,
                thumbUri: ev.thumbUri || ev.uri,
                text: ev.textContent || ev.text,
                durationSec: ev.durationSec,
                title: ev.title,
                timestamp: formatTimestamp(ev.timestamp),
                sender: ev.sender,
            } as MediaItem;
        });
    }, [mergedEvents]);


    const handleMediaPress = (event: TimelineEvent) => {
        const ev = event as any;
        const mediaItem = allUserMedia.find(item => item.id === ev.id);
        if (mediaItem) {
            setSelectedMedia(mediaItem);
            setMediaViewerVisible(true);
        } else {
            setSelectedMedia({
                id: ev.id,
                type: (ev.type === 'photo' || ev.type === 'image') ? 'photo' : ev.type,
                uri: ev.uri,
                thumbUri: ev.thumbUri || ev.uri,
                text: ev.textContent || ev.text,
                sender: ev.sender,
                timestamp: formatTimestamp(ev.timestamp),
            } as MediaItem);
            setMediaViewerVisible(true);
        }
    };


    const handleCloseMediaViewer = () => {
        setMediaViewerVisible(false);
        setTimeout(() => setSelectedMedia(null), 300);
    };


    if (!user || !originLayout) return null;


    const HEADER_HEIGHT = Math.max(topInset, SPACING.xl) + 40 + SPACING.xl;
    const TARGET_TOP = HEADER_HEIGHT + 10;
    const CLIPPING_START_Y = HEADER_HEIGHT;
    const TARGET_LEFT = 20;
    const TARGET_SIZE = 50;


    const contentAnimatedStyle = useAnimatedStyle(() => {
        const opacity = interpolate(expandAnim.value, [0, 0.8, 1], [0, 0, 1]);
        const translateY = interpolate(expandAnim.value, [0, 1], [50, 0]);
        return { opacity, transform: [{ translateY }] };
    });


    const imageAnimatedStyle = useAnimatedStyle(() => ({
        top: interpolate(expandAnim.value, [0, 1], [originLayout.y, TARGET_TOP]),
        left: interpolate(expandAnim.value, [0, 1], [originLayout.x, TARGET_LEFT]),
        width: interpolate(expandAnim.value, [0, 1], [originLayout.width, TARGET_SIZE]),
        height: interpolate(expandAnim.value, [0, 1], [originLayout.height, TARGET_SIZE]),
        borderRadius: interpolate(
            expandAnim.value, [0, 1],
            [Math.min(originLayout.width, originLayout.height) / 2, TARGET_SIZE / 2]
        ),
    }));


    const headerTextAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(expandAnim.value, [0, 0.8, 1], [0, 0, 1]),
    }));


    const closeBtnBgAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(expandAnim.value, [0, 1], [0.25, 0]),
    }));


    const renderContent = () => {
        if (!animationDone) return <View style={styles.loadingContainer} />;
        if (mergedEvents.length > 0) {
            return (
                <TimelineCalendar
                    userUniqueId={user!.uniqueUserId}
                    timelineEvents={mergedEvents}
                    contentPaddingTop={(TARGET_TOP - CLIPPING_START_Y) + TARGET_SIZE + 20}
                    onMediaPress={handleMediaPress}
                />
            );
        }
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>no memories with them</Text>
            </View>
        );
    };


    // ─── Delete Requests Panel ────────────────────────────────────────────
    const renderRequestsPanel = () => {
        if (!requestsPanelVisible) return null;

        return (
            <>
                {/* Scrim — tap to close */}
                <Pressable
                    style={[StyleSheet.absoluteFill, styles.panelScrim]}
                    onPress={() => setRequestsPanelVisible(false)}
                />

                {/* Panel card */}
                <View
                    style={[
                        styles.requestsPanel,
                        {
                            top: TARGET_TOP + TARGET_SIZE + 16,
                            right: 16,
                        },
                    ]}
                >
                    <Text style={styles.panelTitle}>Delete Requests</Text>

                    {requestsLoading ? (
                        <ActivityIndicator
                            size="small"
                            color="#000"
                            style={{ marginVertical: 20 }}
                        />
                    ) : deleteRequests.length === 0 ? (
                        <View style={styles.panelEmpty}>
                            <Ionicons
                                name="notifications-off-outline"
                                size={28}
                                color="rgba(0,0,0,0.2)"
                            />
                            <Text style={styles.panelEmptyText}>
                                no delete requests yet
                            </Text>
                        </View>
                    ) : (
                        <ScrollView
                            style={{ maxHeight: 320 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {deleteRequests.map(req => (
                                <View key={req.id} style={styles.requestRow}>
                                    <View style={styles.requestMeta}>
                                        <Text style={styles.requestLabel} numberOfLines={1}>
                                            Memory ID ···{req.sourceId.slice(-6)}
                                        </Text>
                                        <Text style={styles.requestTime}>
                                            {timeAgo(req.createdAt)}
                                        </Text>
                                    </View>

                                    <View style={styles.requestActions}>
                                        <TouchableOpacity
                                            style={[
                                                styles.actionBtn,
                                                styles.approveBtn,
                                                respondingId === req.id && styles.actionBtnDisabled,
                                            ]}
                                            onPress={() => handleRespond(req, 'approved')}
                                            disabled={respondingId === req.id}
                                            activeOpacity={0.7}
                                        >
                                            {respondingId === req.id ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <Text style={styles.actionBtnText}>Approve</Text>
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.actionBtn,
                                                styles.declineBtn,
                                                respondingId === req.id && styles.actionBtnDisabled,
                                            ]}
                                            onPress={() => handleRespond(req, 'rejected')}
                                            disabled={respondingId === req.id}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.actionBtnText, styles.declineBtnText]}>
                                                Decline
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </>
        );
    };
    // ─────────────────────────────────────────────────────────────────────


    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents="box-none">
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">


                <Animated.View
                    style={[
                        styles.clippingContainer,
                        contentAnimatedStyle,
                        { top: CLIPPING_START_Y, backgroundColor: COLORS.background }
                    ]}
                    pointerEvents="box-none"
                >
                    {renderContent()}


                    <View style={styles.floatingCloseContainer}>
                        <View style={styles.closeBtnShadowWrapper}>
                            <BlurView intensity={80} tint="light" style={styles.closeBtnBlur}>
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor, opacity: 0.25 }]} />
                                <Animated.View style={[StyleSheet.absoluteFill, closeBtnBgAnimatedStyle, { backgroundColor: prevBgColor }]} />
                                <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtnContent}>
                                    <Ionicons name="close" size={28} color="#000" />
                                </TouchableOpacity>
                            </BlurView>
                        </View>
                    </View>
                </Animated.View>


                {/* Dominant color gradient banner */}
                <Animated.View
                    style={[
                        headerTextAnimatedStyle,
                        {
                            position: 'absolute',
                            top: TARGET_TOP - 14,
                            left: 0,
                            right: 0,
                            height: TARGET_SIZE + 28,
                            zIndex: 99,
                        }
                    ]}
                    pointerEvents="none"
                >
                    <LinearGradient
                        colors={[user!.dominantColor, 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>


                {/* Avatar */}
                <Animated.View
                    style={[
                        imageAnimatedStyle,
                        {
                            position: 'absolute',
                            backgroundColor: user!.dominantColor,
                            overflow: 'hidden',
                            zIndex: 100,
                            elevation: 10,
                        }
                    ]}
                    pointerEvents="none"
                >
                    <Image
                        source={{ uri: user!.profilePicture }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                </Animated.View>


                {/* Header name */}
                <Animated.View
                    style={[
                        headerTextAnimatedStyle,
                        {
                            position: 'absolute',
                            top: TARGET_TOP,
                            left: TARGET_LEFT + TARGET_SIZE + 15,
                            right: 60,
                            height: TARGET_SIZE,
                            justifyContent: 'center',
                            zIndex: 100,
                        }
                    ]}
                    pointerEvents="none"
                >
                    <Text
                        style={{ fontSize: 28, fontFamily: 'DancingScript-Bold', color: '#000' }}
                        numberOfLines={1}
                    >
                        {user!.name}
                    </Text>
                </Animated.View>


                {/* ─── Bell icon — top-right of header ─────────────────────────── */}
                <Animated.View
                    style={[
                        headerTextAnimatedStyle,
                        {
                            position: 'absolute',
                            top: TARGET_TOP,
                            right: 16,
                            height: TARGET_SIZE,
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 101,
                        }
                    ]}
                >
                    <TouchableOpacity
                        onPress={handleOpenRequestsPanel}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        activeOpacity={0.65}
                        style={styles.bellBtn}
                    >
                        <Ionicons
                            name={deleteRequests.length > 0 ? 'notifications' : 'notifications-outline'}
                            size={24}
                            color="#000"
                        />
                        {/* Badge dot when there are requests */}
                        {deleteRequests.length > 0 && (
                            <View style={styles.bellBadge}>
                                <Text style={styles.bellBadgeText}>
                                    {deleteRequests.length > 9 ? '9+' : deleteRequests.length}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </Animated.View>


                {/* ─── Requests panel (inline overlay) ──────────────────────────── */}
                {renderRequestsPanel()}

            </View>


            <MediaViewer
                visible={mediaViewerVisible}
                initialMediaItem={selectedMedia}
                allMediaItems={allUserMedia}
                onClose={handleCloseMediaViewer}
                otherUserId={user.id}
            />
        </View>
    );
}


const BUTTON_SIZE = 56;


const styles = StyleSheet.create({
    clippingContainer: {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        overflow: 'hidden', backgroundColor: 'transparent',
    },
    loadingContainer: {
        flex: 1, justifyContent: 'center', alignItems: 'center',
    },
    floatingCloseContainer: {
        position: 'absolute', bottom: 40, left: 0, right: 0,
        alignItems: 'center', zIndex: 200,
    },
    closeBtnShadowWrapper: {
        width: BUTTON_SIZE, height: BUTTON_SIZE,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15, shadowRadius: 10, elevation: 0,
        borderRadius: BUTTON_SIZE / 2, backgroundColor: 'transparent',
    },
    closeBtnBlur: {
        width: BUTTON_SIZE, height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2, overflow: 'hidden', borderWidth: 0,
    },
    closeBtnContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
    emptyText: { fontSize: 18, fontFamily: 'DancingScript-Regular', color: 'rgba(0,0,0,0.4)' },

    // Bell button
    bellBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bellBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#FF3B30',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    bellBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '700',
        lineHeight: 11,
    },

    // Delete requests panel
    panelScrim: {
        zIndex: 200,
        backgroundColor: 'transparent',
    },
    requestsPanel: {
        position: 'absolute',
        zIndex: 201,
        width: 280,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 16,
    },
    panelTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1C1C1E',
        letterSpacing: 0.3,
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    panelEmpty: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 8,
    },
    panelEmptyText: {
        fontSize: 14,
        color: 'rgba(0,0,0,0.35)',
        fontFamily: 'DancingScript-Regular',
        textAlign: 'center',
    },

    // Individual request row
    requestRow: {
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    requestMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    requestLabel: {
        fontSize: 13,
        color: '#1C1C1E',
        fontWeight: '500',
        flex: 1,
        marginRight: 8,
    },
    requestTime: {
        fontSize: 11,
        color: 'rgba(0,0,0,0.4)',
        fontWeight: '400',
    },
    requestActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 34,
    },
    actionBtnDisabled: {
        opacity: 0.5,
    },
    actionBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    approveBtn: {
        backgroundColor: '#34C759',
    },
    declineBtn: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.15)',
    },
    declineBtnText: {
        color: '#1C1C1E',
    },
});
