// src/features/timeline/components/UserTimelineView.tsx
import React, { useState, useMemo, useEffect } from 'react';
import {
    View, Text, StyleSheet, Image, TouchableOpacity,
    LayoutRectangle, BackHandler, ActivityIndicator,
} from 'react-native';
import Animated, {
    useAnimatedStyle, interpolate, SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBackground } from '@/contexts/BackgroundContext';
import { COLORS, SPACING } from '@/theme/theme';
import TimelineCalendar from './TimelineCalendar';
import MediaViewer from '@/components/ui/MediaViewer';
import { MediaItem } from '@/types/mediaTypes';
import { User, TimelineEvent } from '@/types/domain';
import { useMediaInbox } from '@/contexts/MediaInboxContext';
import { useUserTimeline } from '@/contexts/UserTimelineContext';

const formatTimestamp = (isoTs: string): string => {
    const date = new Date(isoTs);
    return date.toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
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

    const { liveTimelineEvents, timelineLoading } = useUserTimeline();
    const { timelineEvents: inboxTimelineEvents } = useMediaInbox();

    useEffect(() => {
        if (!user) return;
        setAnimationDone(false);
        const timer = setTimeout(() => setAnimationDone(true), 420);
        return () => clearTimeout(timer);
    }, [user?.uniqueUserId]);

    useEffect(() => {
        if (!user) return;
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (mediaViewerVisible) { handleCloseMediaViewer(); return true; }
            onClose();
            return true;
        });
        return () => backHandler.remove();
    }, [user, mediaViewerVisible, onClose]);

    const mergedEvents = useMemo((): TimelineEvent[] => {
        if (!user) return [];

        const liveEvents: TimelineEvent[] = liveTimelineEvents[user.uniqueUserId] ?? [];

        // ─── FIX: inbox events are keyed by sender's AUTH UUID, not uniqueUserId ───
        // Try both the uniqueUserId key AND the user.id (auth uuid) key
        const inboxByUniqueId: TimelineEvent[] = inboxTimelineEvents[user.uniqueUserId] ?? [];
        const inboxByAuthId: TimelineEvent[] = (user as any).id
            ? (inboxTimelineEvents[(user as any).id] ?? [])
            : [];

        // Merge all three sources
        const allRaw = [...inboxByUniqueId, ...inboxByAuthId, ...liveEvents];

        console.log('[Timeline] mergedEvents build:', {
            userId: user.uniqueUserId,
            userAuthId: (user as any).id,
            liveCount: liveEvents.length,
            inboxByUniqueIdCount: inboxByUniqueId.length,
            inboxByAuthIdCount: inboxByAuthId.length,
            totalRaw: allRaw.length,
        });

        // ─── FIX: dedup by URI, not just id ───────────────────────────────────────
        // Same media can arrive with different IDs (message id vs film id).
        // Primary dedup: by id. Secondary dedup: by uri (catches same media, diff id).
        const seenIds = new Set<string>();
        const seenUris = new Set<string>();

        const deduped = allRaw.filter((e): e is TimelineEvent => {
            const ev = e as any;
            const type = ev.type;

            if (type !== 'video' && type !== 'photo' && type !== 'image') return false;

            // Dedup by id first
            if (ev.id) {
                if (seenIds.has(ev.id)) {
                    console.log('[Timeline] Dropped duplicate by id:', ev.id);
                    return false;
                }
                seenIds.add(ev.id);
            }

            // Dedup by uri (catches message vs film same media)
            const uriKey = ev.uri || ev.thumbUri;
            if (uriKey) {
                // Strip query params (signed URL tokens differ but path is same)
                const uriPath = uriKey.split('?')[0];
                if (seenUris.has(uriPath)) {
                    console.log('[Timeline] Dropped duplicate by uri path:', uriPath);
                    return false;
                }
                seenUris.add(uriPath);
            }

            return true;
        });

        const sorted = deduped.sort((a, b) =>
            new Date((b as any).timestamp).getTime() - new Date((a as any).timestamp).getTime()
        );

        console.log('[Timeline] Final deduplicated events:', sorted.length, sorted.map((e: any) => ({
            id: e.id,
            type: e.type,
            uri: e.uri?.split('?')[0]?.split('/').pop(), // just filename, no token
        })));

        return sorted;
    }, [user, liveTimelineEvents, inboxTimelineEvents]);

    const allUserMedia = useMemo((): MediaItem[] => {
        const media = mergedEvents.map((event) => {
            const ev = event as any;
            return {
                id: ev.id,
                type: (ev.type === 'image' || ev.type === 'photo') ? 'photo' : 'video',
                uri: ev.uri,
                thumbUri: ev.thumbUri || ev.uri,
                text: ev.textContent || ev.text,
                durationSec: ev.durationSec,
                title: ev.title,
                timestamp: formatTimestamp(ev.timestamp),
                sender: ev.sender,
            } as MediaItem;
        });

        console.log('[Timeline] allUserMedia built:', media.length, 'items');
        return media;
    }, [mergedEvents]);

    const handleMediaPress = (event: TimelineEvent) => {
        const ev = event as any;

        console.log('[Timeline] handleMediaPress called:', {
            id: ev.id,
            type: ev.type,
            uri: ev.uri?.split('?')[0]?.split('/').pop(),
            hasUri: !!ev.uri,
        });

        const mediaItem = allUserMedia.find(item => item.id === ev.id);

        console.log('[Timeline] mediaItem lookup:', {
            found: !!mediaItem,
            searchId: ev.id,
            allIds: allUserMedia.map(m => m.id),
        });

        if (mediaItem) {
            console.log('[Timeline] Opening MediaViewer with:', mediaItem.id, mediaItem.type);
            setSelectedMedia(mediaItem);
            setMediaViewerVisible(true);
        } else {
            // Fallback: build inline if lookup missed
            console.log('[Timeline] mediaItem not found in allUserMedia, using fallback');
            setSelectedMedia({
                id: ev.id,
                type: (ev.type === 'photo' || ev.type === 'image') ? 'photo' : 'video',
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
        if (timelineLoading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#000" />
                </View>
            );
        }
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

                {/* Avatar — touch-transparent, no pressable */}
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

                {/* Header name — touch-transparent */}
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
            </View>

            <MediaViewer
                visible={mediaViewerVisible}
                initialMediaItem={selectedMedia}
                allMediaItems={allUserMedia}
                onClose={handleCloseMediaViewer}
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
});