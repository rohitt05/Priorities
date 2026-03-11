import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity,
    Dimensions, Pressable, Platform, FlatList,
    ViewToken, BackHandler
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    cancelAnimation,
    runOnJS,
    interpolate
} from 'react-native-reanimated';
import { Film as UserFilm } from '@/types/domain';
import { FONTS, COLORS } from '@/theme/theme';
import FilmMedia from './FilmMedia';
import { formatTime } from '../utils/dateUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_STORY_DURATION = 15000;
const CARD_WIDTH = SCREEN_WIDTH * 0.90;
const CARD_MARGIN = 6;
const SNAP_INTERVAL = CARD_WIDTH + (CARD_MARGIN * 2);

interface FilmStoryModalProps {
    films: UserFilm[];
    initialIndex: number;
    visible: boolean;
    onClose: () => void;
}

const FilmStoryModal: React.FC<FilmStoryModalProps> = ({
    films,
    initialIndex,
    visible,
    onClose
}) => {
    const insets = useSafeAreaInsets();
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [duration, setDuration] = useState(DEFAULT_STORY_DURATION);
    const progress = useSharedValue(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isMediaReady, setIsMediaReady] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const isScrolling = useRef(false);

    useEffect(() => {
        if (visible) {
            setCurrentIndex(initialIndex);
            setDuration(DEFAULT_STORY_DURATION);
            setIsMediaReady(false);

            // Sync FlatList to initial index immediately when shown
            flatListRef.current?.scrollToIndex({
                index: initialIndex,
                animated: false,
                viewPosition: 0.5
            });

            // Handle hardware back button
            const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
                onClose();
                return true;
            });
            return () => backHandler.remove();
        } else {
            progress.value = 0;
            cancelAnimation(progress);
            setIsPaused(false);
        }
    }, [visible, initialIndex, onClose]);

    // Only start story when media is ready
    useEffect(() => {
        if (visible && isMediaReady && !isPaused) {
            startStory(duration * (1 - progress.value) || DEFAULT_STORY_DURATION);
        } else {
            cancelAnimation(progress);
        }
    }, [isMediaReady, currentIndex, visible, isPaused]);

    const startStory = (targetDuration: number) => {
        cancelAnimation(progress);
        progress.value = withTiming(1, {
            duration: targetDuration,
            easing: Easing.linear
        }, (finished) => {
            if (finished) {
                runOnJS(nextStory)();
            }
        });
    };

    const nextStory = () => {
        if (currentIndex < films.length - 1) {
            const nextIdx = currentIndex + 1;
            setIsMediaReady(false);
            setDuration(DEFAULT_STORY_DURATION);
            setCurrentIndex(nextIdx);
            flatListRef.current?.scrollToIndex({
                index: nextIdx,
                animated: true,
                viewPosition: 0.5
            });
        } else {
            onClose();
        }
    };

    const prevStory = () => {
        if (currentIndex > 0) {
            const prevIdx = currentIndex - 1;
            setIsMediaReady(false);
            setDuration(DEFAULT_STORY_DURATION);
            setCurrentIndex(prevIdx);
            flatListRef.current?.scrollToIndex({
                index: prevIdx,
                animated: true,
                viewPosition: 0.5
            });
        } else {
            progress.value = 0;
            if (isMediaReady) startStory(duration);
        }
    };

    const handleDurationReport = (reportedDuration: number) => {
        if (reportedDuration > 0 && Math.abs(reportedDuration - duration) > 100) {
            setDuration(reportedDuration);
            if (!isPaused && isMediaReady) {
                const currentProgress = progress.value;
                const remaining = reportedDuration * (1 - currentProgress);
                startStory(remaining);
            }
        }
    };

    const handlePressIn = () => {
        cancelAnimation(progress);
        setIsPaused(true);
    };

    const handlePressOut = () => {
        setIsPaused(false);
        if (isMediaReady) {
            const remaining = duration * (1 - progress.value);
            startStory(remaining);
        }
    };

    const handleTap = (evt: any, index: number) => {
        if (index !== currentIndex) {
            flatListRef.current?.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.5
            });
            return;
        }

        const x = evt.nativeEvent.locationX;
        if (x < CARD_WIDTH * 0.3) {
            // Left 30% - Previous
            prevStory();
        } else if (x > CARD_WIDTH * 0.7) {
            // Right 30% - Next
            nextStory();
        } else {
            // Middle 40% - Toggle Play/Pause
            if (isPaused) {
                handlePressOut();
            } else {
                handlePressIn();
            }
        }
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0) {
            const firstVisible = viewableItems[0];
            if (firstVisible.index !== null && firstVisible.index !== currentIndex) {
                setIsMediaReady(false);
                progress.value = 0;
                setCurrentIndex(firstVisible.index);
            }
        }
    }).current;

    const progressStyle = useAnimatedStyle(() => ({
        width: `${progress.value * 100}%`
    }));

    const renderItem = ({ item, index }: { item: UserFilm, index: number }) => {
        const isActive = index === currentIndex;

        return (
            <View style={[styles.cardWrapper, { opacity: isActive ? 1 : 0.6 }]}>
                <Pressable
                    onPressIn={isActive ? handlePressIn : undefined}
                    onPressOut={isActive ? handlePressOut : undefined}
                    onPress={(e) => handleTap(e, index)}
                    style={styles.card}
                >
                    <FilmMedia
                        uri={item.uri}
                        type={item.type as 'image' | 'video'}
                        isPlaying={visible && !isPaused && isActive}
                        resizeMode="cover"
                        onDuration={isActive ? handleDurationReport : undefined}
                        onReady={isActive ? () => setIsMediaReady(true) : undefined}
                    />

                    {isActive && (
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBarBackground}>
                                <Animated.View style={[styles.progressBarForeground, progressStyle]} />
                            </View>
                        </View>
                    )}
                </Pressable>
            </View>
        );
    };

    const currentFilm = films[currentIndex];
    if (!currentFilm) return null;

    const modalOpacity = useSharedValue(0);
    useEffect(() => {
        modalOpacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
    }, [visible]);

    const animatedModalStyle = useAnimatedStyle(() => ({
        opacity: modalOpacity.value,
        transform: [{ scale: interpolate(modalOpacity.value, [0, 1], [0.95, 1]) }]
    }));

    return (
        <Animated.View
            style={[
                styles.modalOverlay,
                animatedModalStyle,
                { pointerEvents: visible ? 'auto' : 'none' }
            ]}
        >
            <View style={styles.container}>
                {/* Header ABOVE the card stack */}
                <View style={[styles.externalHeader, { marginTop: insets.top + 10 }]}>
                    <Text style={styles.headerText}>
                        {currentFilm.dayOfWeek} <Text style={styles.dot}>·</Text> {formatTime(currentFilm.timestamp)}
                    </Text>
                </View>

                {/* Vertical Stack: Header (above) -> Carousel */}
                <View style={styles.contentStack}>
                    <View style={styles.carouselContainer}>
                        <FlatList
                            ref={flatListRef}
                            data={films}
                            renderItem={renderItem}
                            keyExtractor={(item) => item.id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            snapToInterval={SNAP_INTERVAL}
                            decelerationRate="fast"
                            contentContainerStyle={styles.flatListContent}
                            onViewableItemsChanged={onViewableItemsChanged}
                            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                            initialScrollIndex={initialIndex}
                            getItemLayout={(_, index) => ({
                                length: SNAP_INTERVAL,
                                offset: SNAP_INTERVAL * index,
                                index,
                            })}
                        />
                    </View>
                </View>

                {/* Close Button below */}
                <TouchableOpacity
                    style={[styles.closeButton, { marginBottom: insets.bottom + 20 }]}
                    onPress={onClose}
                    activeOpacity={0.7}
                >
                    <Ionicons name="close-circle" size={56} color="#FFF" />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        zIndex: 1000,
    },
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.98)',
        alignItems: 'center',
    },
    externalHeader: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 15,
        zIndex: 20,
    },
    headerText: {
        color: '#FFF',
        fontSize: 18,
        fontFamily: FONTS.bold,
        letterSpacing: 0.5,
    },
    dot: {
        fontSize: 22,
        color: 'rgba(255,255,255,0.5)',
        marginHorizontal: 4,
    },
    contentStack: {
        flex: 1,
        justifyContent: 'center',
        width: '100%',
    },
    carouselContainer: {
        height: SCREEN_HEIGHT * 0.76, // Height adjusted to around 75-80
    },
    flatListContent: {
        paddingHorizontal: (SCREEN_WIDTH - CARD_WIDTH) / 2 - CARD_MARGIN,
    },
    cardWrapper: {
        width: CARD_WIDTH,
        marginHorizontal: CARD_MARGIN,
        height: '100%',
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: '#111',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
    },
    card: {
        flex: 1,
    },
    progressContainer: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        height: 4,
    },
    progressBarBackground: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarForeground: {
        height: '100%',
        backgroundColor: '#FFF',
    },
    closeButton: {
        marginTop: 20,
    },
});

export default FilmStoryModal;
