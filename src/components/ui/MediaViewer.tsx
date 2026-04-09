// src/components/ui/MediaViewer.tsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Animated,
    StatusBar,
    FlatList,
    ListRenderItem,
    Dimensions,
    Platform,
    Alert,
} from 'react-native';
import { Ionicons, Entypo } from '@expo/vector-icons';
import { useBackground } from '@/contexts/BackgroundContext';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';

import PhotoViewer from './PhotoViewer';
import VideoPlayer from './VideoPlayer';
import AudioPlayer from './AudioPlayer';
import NoteViewer from './NoteViewer';
import CallInfoViewer from './CallInfoViewer';
import MessageMediaItemBottomSheet from './MessageMediaItemBottomSheet';
import { MediaItem } from '@/types/mediaTypes';
import { initiateDeleteRequest } from '@/services/memoryDeleteService';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Typed AnimatedFlatList — avoids the `unknown` item type that
// Animated.createAnimatedComponent strips when used without a generic.
const AnimatedFlatList = Animated.createAnimatedComponent(
    FlatList<MediaItem>
);


interface MediaViewerProps {
    visible: boolean;
    initialMediaItem: MediaItem | null;
    allMediaItems: MediaItem[];
    onClose: () => void;
    // The Supabase UUID of the other user in this timeline pair.
    // Required to send a memory deletion request.
    otherUserId?: string;
}


export default function MediaViewer({
    visible,
    initialMediaItem,
    allMediaItems,
    onClose,
    otherUserId,
}: MediaViewerProps) {
    const { bgColor, prevBgColor, colorAnim } = useBackground();

    // ─── Header + dots visibility ────────────────────────────────────────
    const headerOpacity = useRef(new Animated.Value(1)).current;
    const isHeaderVisible = useRef(true);

    const showHeader = useCallback(() => {
        if (isHeaderVisible.current) return;
        isHeaderVisible.current = true;
        Animated.timing(headerOpacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [headerOpacity]);

    const hideHeader = useCallback(() => {
        if (!isHeaderVisible.current) return;
        isHeaderVisible.current = false;
        Animated.timing(headerOpacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [headerOpacity]);

    const handleMediaTap = useCallback(() => {
        if (sheetVisible) return;
        isHeaderVisible.current ? hideHeader() : showHeader();
    }, [hideHeader, showHeader]);
    // ─────────────────────────────────────────────────────────────────────

    // ─── Bottom sheet state ───────────────────────────────────────────────
    const [sheetVisible, setSheetVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);

    const openSheet = useCallback(() => {
        showHeader();
        setSheetVisible(true);
    }, [showHeader]);

    const closeSheet = useCallback(() => {
        setSheetVisible(false);
    }, []);
    // ─────────────────────────────────────────────────────────────────────

    const backgroundColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    const opacity = useRef(new Animated.Value(0)).current;
    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef<FlatList<MediaItem>>(null);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isListReady, setIsListReady] = useState(false);

    const currentIndexRef = useRef(currentIndex);
    currentIndexRef.current = currentIndex;

    const currentItem = allMediaItems[currentIndex] ?? initialMediaItem;

    // ─── Derived: can we send a delete request for this item? ─────────────
    // Only show the option when:
    //   a) we have the other user's ID (passed from UserTimelineView)
    //   b) the media was sent BY them (sender === 'them')
    const canRequestDeletion = useMemo(() => {
        if (!otherUserId || !currentItem) return false;
        return currentItem.sender === 'them';
    }, [otherUserId, currentItem]);
    // ─────────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (visible) {
            Animated.timing(opacity, {
                toValue: 1,
                duration: 240,
                useNativeDriver: true,
            }).start();
        } else {
            opacity.setValue(0);
            setSheetVisible(false);
            setCurrentIndex(0);
            setIsListReady(false);
        }
    }, [visible]);

    useEffect(() => {
        if (!visible || !initialMediaItem || allMediaItems.length === 0 || isListReady) return;
        const idx = allMediaItems.findIndex(item => item.id === initialMediaItem.id);
        const target = idx >= 0 ? idx : 0;
        setCurrentIndex(target);
        setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: target, animated: false });
            setIsListReady(true);
        }, 50);
    }, [visible, initialMediaItem, allMediaItems, isListReady]);

    // ─── Save to camera roll ──────────────────────────────────────────────
    const handleDownload = useCallback(async () => {
        const item = allMediaItems[currentIndexRef.current] ?? initialMediaItem;
        if (!item?.uri) {
            Alert.alert('Nothing to save', 'This item has no media file.');
            return;
        }
        if (item.type !== 'photo' && item.type !== 'video') {
            Alert.alert('Not supported', 'Only photos and videos can be saved to Camera Roll.');
            return;
        }
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission denied', 'Allow access to your Camera Roll in Settings.');
            return;
        }
        setIsSaving(true);
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            let localUri = item.uri;
            if (localUri.startsWith('http')) {
                const ext = item.type === 'video' ? '.mp4' : '.jpg';
                const dest = FileSystem.cacheDirectory + `media_save_${Date.now()}${ext}`;
                const dl = await FileSystem.downloadAsync(localUri, dest);
                localUri = dl.uri;
            }
            await MediaLibrary.saveToLibraryAsync(localUri);
            Alert.alert('Saved', 'Media saved to your Camera Roll.');
        } catch (e) {
            console.error('[MediaViewer] Save failed:', e);
            Alert.alert('Save failed', 'Could not save media. Try again.');
        } finally {
            setIsSaving(false);
        }
    }, [allMediaItems, initialMediaItem]);

    // ─── Request memory deletion (mutual consent — only path to delete) ───
    const handleRequestMemoryDeletion = useCallback(async () => {
        const item = allMediaItems[currentIndexRef.current] ?? initialMediaItem;
        if (!item || !otherUserId) return;

        Alert.alert(
            'Request Memory Deletion',
            'You are asking them to delete this memory from both timelines. They can accept or decline.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send Request',
                    style: 'destructive',
                    onPress: async () => {
                        setIsRequestingDeletion(true);
                        try {
                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            const result = await initiateDeleteRequest(
                                item.id,
                                otherUserId,
                                item.uri,
                            );
                            switch (result) {
                                case 'requested':
                                    Alert.alert(
                                        'Request Sent ✓',
                                        'They will see your request. If they approve, this memory will be deleted from both timelines.',
                                    );
                                    break;
                                case 'auto_deleted':
                                    Alert.alert(
                                        'Memory Deleted',
                                        'Both of you wanted this deleted — it has been removed from both timelines.',
                                    );
                                    onClose();
                                    break;
                                case 'already_pending':
                                    Alert.alert(
                                        'Request Already Sent',
                                        'You have already sent a deletion request for this memory. Waiting for their response.',
                                    );
                                    break;
                                case 'error':
                                    Alert.alert('Something went wrong', 'Could not send the request. Please try again.');
                                    break;
                            }
                        } finally {
                            setIsRequestingDeletion(false);
                        }
                    },
                },
            ]
        );
    }, [allMediaItems, initialMediaItem, otherUserId, onClose]);
    // ─────────────────────────────────────────────────────────────────────

    // Typed as ListRenderItem<MediaItem> so the generic flows correctly
    // into AnimatedFlatList — no more `unknown` item mismatch.
    const renderItem = useCallback<ListRenderItem<MediaItem>>(({ item }) => (
        <TouchableWithoutFeedback onPress={handleMediaTap}>
            <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
                {item.type === 'photo' && (
                    <PhotoViewer mediaItem={item} />
                )}
                {item.type === 'video' && (
                    <VideoPlayer mediaItem={item} />
                )}
                {item.type === 'voice' && (
                    <AudioPlayer mediaItem={item} />
                )}
                {(item.type === 'voice_call' || item.type === 'video_call') && (
                    <CallInfoViewer mediaItem={item} />
                )}
                {!['photo', 'video', 'voice', 'voice_call', 'video_call'].includes(item.type) && (
                    <NoteViewer mediaItem={item} />
                )}
            </View>
        </TouchableWithoutFeedback>
    ), [handleMediaTap]);

    // Typed to match (item: MediaItem) => string — satisfies FlatList<MediaItem>
    const keyExtractor = useCallback<(item: MediaItem) => string>(
        (item) => item.id,
        []
    );

    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: any) => {
            if (viewableItems.length > 0) {
                setCurrentIndex(viewableItems[0].index ?? 0);
            }
        },
        []
    );

    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <StatusBar hidden />
            <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
                <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor }]} />

                <AnimatedFlatList
                    ref={flatListRef}
                    data={allMediaItems}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig.current}
                    scrollEventThrottle={16}
                    onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                        { useNativeDriver: false }
                    )}
                    getItemLayout={(_: any, index: number) => ({
                        length: SCREEN_WIDTH,
                        offset: SCREEN_WIDTH * index,
                        index,
                    })}
                    initialScrollIndex={0}
                    scrollToOverflowEnabled
                />

                {/* Header row: close on left, timestamp centre, dots on right */}
                <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="chevron-back" size={28} color="#fff" />
                    </TouchableOpacity>

                    {currentItem?.timestamp && (
                        <Text style={styles.timestampText}>{currentItem.timestamp}</Text>
                    )}

                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={openSheet}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Entypo name="dots-three-horizontal" size={22} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>

                {/* Pagination dots */}
                {allMediaItems.length > 1 && (
                    <Animated.View style={[styles.pagination, { opacity: headerOpacity }]}>
                        {allMediaItems.map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    i === currentIndex && styles.dotActive,
                                ]}
                            />
                        ))}
                    </Animated.View>
                )}

                <MessageMediaItemBottomSheet
                    visible={sheetVisible}
                    onClose={closeSheet}
                    onDownload={handleDownload}
                    onRequestMemoryDeletion={handleRequestMemoryDeletion}
                    isSaving={isSaving}
                    canRequestDeletion={canRequestDeletion}
                    isRequestingDeletion={isRequestingDeletion}
                />
            </Animated.View>
        </Modal>
    );
}


const styles = StyleSheet.create({
    header: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        zIndex: 100,
    },
    headerBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timestampText: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 13,
        fontFamily: 'System',
        letterSpacing: 0.2,
    },
    pagination: {
        position: 'absolute',
        bottom: 48,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        zIndex: 50,
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.35)',
    },
    dotActive: {
        backgroundColor: '#fff',
        width: 7,
        height: 7,
    },
});
