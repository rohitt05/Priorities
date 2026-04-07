import React, { useEffect, useRef, useState, useMemo } from 'react';
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
    Dimensions,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBackground } from '@/contexts/BackgroundContext';

import PhotoViewer from './PhotoViewer';
import VideoPlayer from './VideoPlayer';
import AudioPlayer from './AudioPlayer';
import NoteViewer from './NoteViewer';
import CallInfoViewer from './CallInfoViewer';
import { MediaItem } from '@/types/mediaTypes';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);


interface MediaViewerProps {
    visible: boolean;
    initialMediaItem: MediaItem | null;
    allMediaItems: MediaItem[];
    onClose: () => void;
}


export default function MediaViewer({
    visible,
    initialMediaItem,
    allMediaItems,
    onClose
}: MediaViewerProps) {
    const { bgColor, prevBgColor, colorAnim } = useBackground();

    // ─── Header toggle ───────────────────────────────────────────────────
    const headerOpacity = useRef(new Animated.Value(1)).current;
    const isHeaderVisible = useRef(true);

    const showHeader = () => {
        if (isHeaderVisible.current) return;
        isHeaderVisible.current = true;
        Animated.timing(headerOpacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
        }).start();
    };

    const hideHeader = () => {
        if (!isHeaderVisible.current) return;
        isHeaderVisible.current = false;
        Animated.timing(headerOpacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
        }).start();
    };

    const handleMediaTap = () => {
        isHeaderVisible.current ? hideHeader() : showHeader();
    };
    // ────────────────────────────────────────────────────────────────────

    const backgroundColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor]
    });

    const opacity = useRef(new Animated.Value(0)).current;
    const scrollX = useRef(new Animated.Value(0)).current;

    const flatListRef = useRef<FlatList>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isListReady, setIsListReady] = useState(false);

    const initialIndex = useMemo(() => {
        if (!initialMediaItem || !allMediaItems) return 0;
        const index = allMediaItems.findIndex(item => item.id === initialMediaItem.id);
        return index >= 0 ? index : 0;
    }, [initialMediaItem, allMediaItems]);

    useEffect(() => {
        if (visible) {
            setCurrentIndex(initialIndex);
            setIsListReady(false);

            isHeaderVisible.current = true;
            headerOpacity.setValue(1);

            scrollX.setValue(initialIndex * SCREEN_WIDTH);

            Animated.timing(opacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true
            }).start();

            setTimeout(() => setIsListReady(true), 50);
        } else {
            opacity.setValue(0);
            setIsListReady(false);
        }
    }, [visible, initialIndex]);

    const handleClose = () => {
        Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true
        }).start(() => onClose());
    };

    const renderMediaItem = ({ item, index }: { item: any, index: number }) => {
        const mediaItem = item as MediaItem;
        const isFocused = index === currentIndex;

        const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH
        ];

        const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.92, 1, 0.92],
            extrapolate: 'clamp'
        });

        const itemOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.5, 1, 0.5],
            extrapolate: 'clamp'
        });

        const translateY = scrollX.interpolate({
            inputRange,
            outputRange: [20, 0, 20],
            extrapolate: 'clamp'
        });

        let content;
        try {
            switch (mediaItem.type) {
                case 'photo':
                    content = <PhotoViewer mediaItem={mediaItem} onDragDown={handleClose} />;
                    break;
                case 'video':
                    content = <VideoPlayer mediaItem={mediaItem} isFocused={isFocused} />;
                    break;
                case 'voice':
                    content = <AudioPlayer mediaItem={mediaItem} />;
                    break;
                case 'voice_call':
                case 'video_call':
                    content = <CallInfoViewer mediaItem={mediaItem} />;
                    break;
                default:
                    content = <View />;
            }
        } catch (e) {
            content = <View />;
        }

        return (
            <TouchableWithoutFeedback onPress={handleMediaTap}>
                <View style={styles.carouselItem}>
                    <Animated.View
                        style={[
                            styles.animatedContent,
                            {
                                transform: [{ scale }, { translateY }],
                                opacity: itemOpacity
                            }
                        ]}
                    >
                        {content}
                    </Animated.View>
                </View>
            </TouchableWithoutFeedback>
        );
    };

    const getItemLayout = (data: any, index: number) => ({
        length: SCREEN_WIDTH,
        offset: SCREEN_WIDTH * index,
        index,
    });

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems && viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
            showHeader();
        }
    }).current;

    const onScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        {
            useNativeDriver: true,
            listener: () => { showHeader(); }
        }
    );

    if (!visible) return null;

    const safeData = allMediaItems && allMediaItems.length > 0
        ? allMediaItems
        : (initialMediaItem ? [initialMediaItem] : []);
    const currentItem = safeData[currentIndex];
    const senderName = currentItem?.sender === 'me'
        ? 'You'
        : (currentItem?.sender === 'them' ? 'Them' : 'Unknown');

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <StatusBar hidden />
            <Animated.View style={[styles.container, { opacity }]}>

                <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor }]} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />

                {/* ── Fullscreen tap zone — BELOW the header in zIndex ── */}
                <TouchableWithoutFeedback onPress={handleMediaTap}>
                    <View style={StyleSheet.absoluteFill} />
                </TouchableWithoutFeedback>

                {isListReady ? (
                    <AnimatedFlatList
                        ref={flatListRef}
                        data={safeData}
                        renderItem={renderMediaItem}
                        keyExtractor={(item: any) => item.id}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        initialScrollIndex={initialIndex}
                        getItemLayout={getItemLayout}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                        removeClippedSubviews={Platform.OS === 'android'}
                        initialNumToRender={1}
                        maxToRenderPerBatch={2}
                        windowSize={3}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        onScrollToIndexFailed={(info: any) => {
                            const wait = new Promise(resolve => setTimeout(resolve, 100));
                            wait.then(() => {
                                flatListRef.current?.scrollToIndex({
                                    index: info.index,
                                    animated: false
                                });
                            });
                        }}
                    />
                ) : (
                    <View style={styles.carouselItem} />
                )}

                {/* ── Header — fades out on tap, back on tap/swipe ── */}
                {/* pointerEvents="none" when hidden so it never blocks taps */}
                <Animated.View
                    style={[styles.topOverlay, { opacity: headerOpacity }]}
                    pointerEvents="none"
                >
                    {/* Close button gets its own absolute Touchable above everything */}
                    <View style={styles.headerInfo}>
                        <Text style={styles.senderText}>{senderName}</Text>
                        <Text style={styles.dateText}>{currentItem?.timestamp || ''}</Text>
                    </View>

                    <View style={styles.counterContainer}>
                        <Text style={styles.counterText}>
                            {currentIndex + 1} / {safeData.length}
                        </Text>
                    </View>
                </Animated.View>

                {/* ── Close button lives OUTSIDE the fading header ── */}
                {/* Always tappable, always on top */}
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={handleClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>

            </Animated.View>
        </Modal>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    carouselItem: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    },
    animatedContent: {
        flex: 1,
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    },
    topOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 100,
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingBottom: 15,
        paddingHorizontal: 20,
        paddingLeft: 70,         // leave room for close button
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 50,
    },
    closeButton: {
        position: 'absolute',
        top: 44,
        left: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,             // always on top, never fades
    },
    headerInfo: {
        flex: 1,
        justifyContent: 'center',
        paddingBottom: 2,
    },
    senderText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    dateText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        fontWeight: '500',
    },
    counterContainer: {
        justifyContent: 'center',
        paddingBottom: 8,
    },
    counterText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});