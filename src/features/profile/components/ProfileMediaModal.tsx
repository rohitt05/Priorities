import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    FlatList,
    TouchableWithoutFeedback,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { MediaItem } from '@/types/mediaTypes';

const { width, height } = Dimensions.get('window');

const formatTime = (secs: number) => {
    if (isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const CardVideoPlayer = ({ uri, thumbUri, isFocused }: { uri: string, thumbUri?: string, isFocused: boolean }) => {
    // We only mount the actual video player when the card is focused.
    // This prevents multiple native players from hogging hardware decoders.
    if (!isFocused) {
        return (
            <View style={{ flex: 1 }}>
                <Image
                    source={{ uri: thumbUri || uri }}
                    style={styles.media}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                />
                <View style={[styles.centerPlayOverlay, { opacity: 0.6 }]} pointerEvents="none">
                    <View style={styles.playIconBg}>
                        <Ionicons name="play" size={40} color="#FFF" style={{ marginLeft: 6 }} />
                    </View>
                </View>
            </View>
        );
    }

    return <ActiveVideoPlayer uri={uri} thumbUri={thumbUri} />;
};

const ActiveVideoPlayer = ({ uri, thumbUri }: { uri: string, thumbUri?: string }) => {
    const player = useVideoPlayer({ uri }, p => {
        p.loop = true;
        p.timeUpdateEventInterval = 0.1;
        p.play();
    });

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [showIndicator, setShowIndicator] = useState<'play' | 'pause' | null>(null);

    useEffect(() => {
        const timeSub = player.addListener('timeUpdate', (event) => {
            setCurrentTime(event.currentTime);
            if (player.duration > 0 && duration !== player.duration) {
                setDuration(player.duration);
            }
        });
        const playSub = player.addListener('playingChange', (event) => {
            setIsPlaying(event.isPlaying);
        });
        const statusSub = player.addListener('statusChange', (status) => {
            if (status.status === 'readyToPlay') {
                setIsLoaded(true);
            }
            if (player.duration > 0 && duration !== player.duration) {
                setDuration(player.duration);
            }
        });

        return () => {
            timeSub.remove();
            playSub.remove();
            statusSub.remove();
        };
    }, [player, duration]);

    useEffect(() => {
        if (isLoaded) {
            player.play();
        }
    }, [isLoaded, player]);

    const handlePress = () => {
        if (player.playing) {
            player.pause();
            setShowIndicator('pause');
        } else {
            player.play();
            setShowIndicator('play');
        }
        setTimeout(() => setShowIndicator(null), 800);
    };

    const handleLongPressLeft = () => {
        player.playbackRate = -1.5;
    };

    const handleLongPressRight = () => {
        player.playbackRate = 1.5;
    };

    const handlePressOut = () => {
        player.playbackRate = 1.0;
    };

    const progressValue = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <View style={{ flex: 1 }}>
            <VideoView
                player={player}
                style={styles.media}
                contentFit="cover"
                nativeControls={false}
            />

            {!isLoaded && (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]}>
                    <Image
                        source={{ uri: thumbUri || uri }}
                        style={styles.media}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                    />
                    <View style={styles.centerPlayOverlay}>
                        <ActivityIndicator color="#FFF" size="large" />
                    </View>
                </View>
            )}

            {/* Gesture Areas */}
            <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
                <TouchableWithoutFeedback
                    onPress={handlePress}
                    onLongPress={handleLongPressLeft}
                    onPressOut={handlePressOut}
                    delayLongPress={300}
                >
                    <View style={{ flex: 1 }} />
                </TouchableWithoutFeedback>

                <TouchableWithoutFeedback
                    onPress={handlePress}
                    onLongPress={handleLongPressRight}
                    onPressOut={handlePressOut}
                    delayLongPress={300}
                >
                    <View style={{ flex: 1 }} />
                </TouchableWithoutFeedback>
            </View>

            {/* Play/Pause Animated Indicator */}
            {showIndicator && (
                <View style={styles.centerPlayOverlay} pointerEvents="none">
                    <View style={styles.playIconBg}>
                        <Ionicons
                            name={showIndicator === 'play' ? "play" : "pause"}
                            size={40}
                            color="#FFF"
                            style={showIndicator === 'play' ? { marginLeft: 6 } : {}}
                        />
                    </View>
                </View>
            )}

            {!isPlaying && !showIndicator && isLoaded && (
                <View style={[styles.centerPlayOverlay, { opacity: 0.6 }]} pointerEvents="none">
                    <View style={styles.playIconBg}>
                        <Ionicons name="play" size={40} color="#FFF" style={{ marginLeft: 6 }} />
                    </View>
                </View>
            )}

            {/* Custom Simple Progress Bar */}
            <View style={styles.bottomControlsContainer} pointerEvents="none">
                <View style={styles.simpleProgressBarTrack}>
                    <View style={[styles.simpleProgressFill, { width: `${progressValue}%` }]} />
                </View>
                <Text style={styles.simpleTimeText}>{formatTime(currentTime)}</Text>
            </View>
        </View>
    );
};

interface ProfileMediaModalProps {
    visible: boolean;
    mediaItems: MediaItem[];
    initialIndex: number;
    onClose: () => void;
}

export default function ProfileMediaModal({ visible, mediaItems, initialIndex, onClose }: ProfileMediaModalProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        if (visible) setCurrentIndex(initialIndex);
    }, [visible, initialIndex]);

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems && viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const formatHeaderDate = (isoString?: string) => {
        if (!isoString) return "";
        const date = new Date(isoString);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const dom = date.getDate();
        return `${dom} ${month} • ${dayName}`;
    };

    const getItemLayout = (data: any, index: number) => ({
        length: width,
        offset: width * index,
        index,
    });

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <View style={styles.overlay}>
                {/* Background Dim */}
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>

                {/* Horizontal Scroll List */}
                <FlatList
                    ref={flatListRef}
                    data={mediaItems}
                    keyExtractor={item => item.id}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    initialScrollIndex={initialIndex}
                    getItemLayout={getItemLayout}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                    windowSize={3}
                    removeClippedSubviews={true}
                    renderItem={({ item, index }: { item: MediaItem, index: number }) => {
                        const isFocused = currentIndex === index;

                        return (
                            <View style={styles.page}>
                                {/* Date / Day Above Card */}
                                <Text style={styles.headerText}>{formatHeaderDate(item.timestamp)}</Text>

                                {/* The Big Card */}
                                <View style={styles.card}>
                                    {item.type === 'video' ? (
                                        <CardVideoPlayer
                                            uri={item.uri || ''}
                                            thumbUri={item.thumbUri}
                                            isFocused={isFocused}
                                        />
                                    ) : (
                                        <Image
                                            source={{ uri: item.uri }}
                                            style={styles.media}
                                            contentFit="cover"
                                            cachePolicy="memory-disk"
                                            transition={200}
                                        />
                                    )}
                                </View>
                            </View>
                        );
                    }}
                />

                {/* Close Button Below Card */}
                <View style={styles.closeContainer} pointerEvents="box-none">
                    <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
                        <View style={styles.closeIconWrapper}>
                            <Ionicons name="close" size={28} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
    page: {
        width,
        height,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 20 // less offset to make room for larger card
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 20,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
        letterSpacing: 0.5
    },
    card: {
        width: width * 0.95,
        height: height * 0.75,
        borderRadius: 24,
        backgroundColor: '#1C1C1E',
        overflow: 'hidden',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    media: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    closeContainer: {
        position: 'absolute',
        bottom: 30, // move down slightly
        width: '100%',
        alignItems: 'center',
    },
    closeButton: {
        elevation: 30,
    },
    closeIconWrapper: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    bottomControlsContainer: {
        position: 'absolute',
        bottom: 15,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    simpleProgressBarTrack: {
        flex: 1,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        overflow: 'hidden'
    },
    simpleProgressFill: {
        height: '100%',
        backgroundColor: '#FFF',
        borderRadius: 2
    },
    simpleTimeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
        minWidth: 35,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
    },
    centerPlayOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playIconBg: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});
