import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Pressable,
    LayoutRectangle,
    BackHandler,
    ActivityIndicator,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    interpolate,
    SharedValue,
    Extrapolate
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

// ==========================================
// UTILS
// ==========================================

const hexToRgba = (hex: string, opacity: number): string => {
    if (!hex) return `rgba(255, 255, 255, ${opacity})`;
    const cleanHex = hex.replace('#', '');
    let r: number, g: number, b: number;
    if (cleanHex.length === 3) {
        r = parseInt(cleanHex[0] + cleanHex[0], 16);
        g = parseInt(cleanHex[1] + cleanHex[1], 16);
        b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else {
        r = parseInt(cleanHex.substring(0, 2), 16);
        g = parseInt(cleanHex.substring(2, 4), 16);
        b = parseInt(cleanHex.substring(4, 6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const formatTimestamp = (isoTs: string): string => {
    const date = new Date(isoTs);
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

interface UserTimelineViewProps {
    user: User | null;
    originLayout: LayoutRectangle | null;
    expandAnim: SharedValue<number>;
    onClose: () => void;
}

export default function UserTimelineView({
    user,
    originLayout,
    expandAnim,
    onClose,
}: UserTimelineViewProps) {
    const { top: topInset } = useSafeAreaInsets();
    const { bgColor, prevBgColor, colorAnim } = useBackground();
    const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

    const { liveTimelineEvents, timelineLoading } = useUserTimeline();
    const { timelineEvents: inboxTimelineEvents } = useMediaInbox();

    useEffect(() => {
        if (!user) return;
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (mediaViewerVisible) {
                handleCloseMediaViewer();
                return true;
            }
            onClose();
            return true;
        });
        return () => backHandler.remove();
    }, [user, mediaViewerVisible, onClose]);

    // ─── Single merge: compute once, derive both consumers from it ───────────
    // Previously this filter/dedup/sort was duplicated in two separate useMemos.
    // Now we merge once and derive `allUserMedia` + `rawEventsForCalendar` from
    // the same result, avoiding double iteration on every render.
    const mergedEvents = useMemo((): TimelineEvent[] => {
        if (!user) return [];

        const liveEvents: TimelineEvent[] = liveTimelineEvents[user.uniqueUserId] ?? [];
        const dynamicEvents: TimelineEvent[] = inboxTimelineEvents[user.uniqueUserId] ?? [];

        const seen = new Set<string>();
        return [...dynamicEvents, ...liveEvents]
            .filter((e): e is TimelineEvent => {
                const ev = e as any;
                if (seen.has(ev.id)) return false;
                seen.add(ev.id);
                return ev.type === 'video' || ev.type === 'photo' || ev.type === 'image';
            })
            .sort((a, b) =>
                new Date((b as any).timestamp).getTime() - new Date((a as any).timestamp).getTime()
            );
    }, [user, liveTimelineEvents, inboxTimelineEvents]);

    // Mapped to MediaItem shape for MediaViewer
    const allUserMedia = useMemo((): MediaItem[] => {
        return mergedEvents.map((event) => {
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
    }, [mergedEvents]);

    // Raw events (with original timestamps) for TimelineCalendar
    const rawEventsForCalendar = mergedEvents;

    const handleMediaPress = (event: TimelineEvent) => {
        const ev = event as any;
        const mediaItem = allUserMedia.find(item => item.id === ev.id);
        if (mediaItem) {
            setSelectedMedia(mediaItem);
            setMediaViewerVisible(true);
        } else {
            const temp: MediaItem = {
                id: ev.id,
                type: (ev.type === 'photo' || ev.type === 'image') ? 'photo' : 'video',
                uri: ev.uri,
                text: ev.textContent || ev.text,
                sender: ev.sender,
                timestamp: formatTimestamp(ev.timestamp),
            } as MediaItem;
            setSelectedMedia(temp);
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

    const imageAnimatedStyle = useAnimatedStyle(() => {
        const top = interpolate(expandAnim.value, [0, 1], [originLayout.y, TARGET_TOP]);
        const left = interpolate(expandAnim.value, [0, 1], [originLayout.x, TARGET_LEFT]);
        const width = interpolate(expandAnim.value, [0, 1], [originLayout.width, TARGET_SIZE]);
        const height = interpolate(expandAnim.value, [0, 1], [originLayout.height, TARGET_SIZE]);
        const borderRadius = interpolate(
            expandAnim.value, [0, 1],
            [Math.min(originLayout.width, originLayout.height) / 2, TARGET_SIZE / 2]
        );
        return { top, left, width, height, borderRadius };
    });

    const headerTextAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(expandAnim.value, [0, 0.8, 1], [0, 0, 1]),
    }));

    const closeBtnBgAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(expandAnim.value, [0, 1], [0.25, 0]),
    }));

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents="box-none">
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                <Animated.View style={[
                    styles.clippingContainer,
                    contentAnimatedStyle,
                    { top: CLIPPING_START_Y, backgroundColor: COLORS.background }
                ]}>
                    {timelineLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#000" />
                        </View>
                    ) : rawEventsForCalendar.length > 0 ? (
                        <TimelineCalendar
                            userUniqueId={user!.uniqueUserId}
                            timelineEvents={rawEventsForCalendar}
                            contentPaddingTop={(TARGET_TOP - CLIPPING_START_Y) + TARGET_SIZE + 20}
                            onMediaPress={handleMediaPress}
                        />
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>no memories with them</Text>
                        </View>
                    )}

                    <View style={styles.floatingCloseContainer}>
                        <View style={styles.closeBtnShadowWrapper}>
                            <BlurView intensity={80} tint="light" style={styles.closeBtnBlur}>
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor, opacity: 0.25 }]} />
                                <Animated.View
                                    style={[
                                        StyleSheet.absoluteFill,
                                        closeBtnBgAnimatedStyle,
                                        { backgroundColor: prevBgColor }
                                    ]}
                                />
                                <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtnContent}>
                                    <Ionicons name="close" size={28} color="#000" />
                                </TouchableOpacity>
                            </BlurView>
                        </View>
                    </View>
                </Animated.View>

                <Animated.View style={[
                    imageAnimatedStyle,
                    {
                        position: 'absolute',
                        backgroundColor: user!.dominantColor,
                        overflow: 'hidden',
                        zIndex: 100,
                        elevation: 10,
                    }
                ]}>
                    <Pressable onPress={onClose} style={{ flex: 1 }}>
                        <Image
                            source={{ uri: user!.profilePicture }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                    </Pressable>
                </Animated.View>

                <Animated.View style={[
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
                ]}>
                    <Text
                        style={{
                            fontSize: 28,
                            fontFamily: 'DancingScript-Bold',
                            color: '#000',
                        }}
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
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    floatingCloseContainer: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 200,
    },
    closeBtnShadowWrapper: {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 0,
        borderRadius: BUTTON_SIZE / 2,
        backgroundColor: 'transparent',
    },
    closeBtnBlur: {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        overflow: 'hidden',
        borderWidth: 0,
    },
    closeBtnContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 100,
    },
    emptyText: {
        fontSize: 18,
        fontFamily: 'DancingScript-Regular',
        color: 'rgba(0,0,0,0.4)',
    },
});
