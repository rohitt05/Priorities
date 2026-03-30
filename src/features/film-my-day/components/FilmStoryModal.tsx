import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity,
    Dimensions, Pressable, Platform, FlatList,
    ViewToken, BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    cancelAnimation,
    runOnJS,
    interpolate,
    useDerivedValue,
    withSpring,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Film as UserFilm } from '@/types/domain';
import { FONTS, COLORS } from '@/theme/theme';
import FilmMedia from './FilmMedia';
import { formatRelativeTime } from '../utils/dateUtils';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_STORY_DURATION = 15000;
const SNAP_INTERVAL = SCREEN_WIDTH;

interface FilmStoryModalProps {
    films: UserFilm[];
    initialIndex: number;
    visible: boolean;
    onClose: () => void;
}

const StoryItem = ({
    item,
    index,
    currentIndex,
    visible,
    isPaused,
    progress,
    progressStyle,
    insets,
    handlePressIn,
    handlePressOut,
    handleTap,
    handleDurationReport,
    setIsMediaReady,
    nextStory,
}: any) => {
    const isActive = index === currentIndex;
    const [isLocalLiked, setIsLocalLiked] = useState(false);

    const handleLocalLike = () => {
        setIsLocalLiked(!isLocalLiked);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

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
                    onComplete={isActive ? nextStory : undefined}
                    progress={isActive ? progress : undefined}
                />

                {isActive && (
                    <>
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBarBackground}>
                                <Animated.View style={[styles.progressBarForeground, progressStyle]} />
                            </View>
                        </View>

                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.5)']}
                            style={[styles.overlayBottom, { paddingBottom: Math.max(insets.bottom, 20) }]}
                        >
                            <TouchableOpacity
                                onPress={handleLocalLike}
                                style={styles.heartButton}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={isLocalLiked ? "heart" : "heart-outline"}
                                    size={22}
                                    color={isLocalLiked ? "#FF3B30" : "#FFF"}
                                />
                            </TouchableOpacity>
                        </LinearGradient>
                    </>
                )}
            </Pressable>
        </View>
    );
};

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
    const translateY = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            setCurrentIndex(initialIndex);
            setDuration(DEFAULT_STORY_DURATION);
            setIsMediaReady(false);

            flatListRef.current?.scrollToIndex({
                index: initialIndex,
                animated: false,
                viewPosition: 0.5
            });

            const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
                onClose();
                return true;
            });
            return () => backHandler.remove();
        } else {
            setCurrentIndex(initialIndex);
            setDuration(DEFAULT_STORY_DURATION);
            setIsMediaReady(false);
            translateY.value = 0;
            progress.value = 0;
        }
    }, [visible, initialIndex, onClose]);

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
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            flatListRef.current?.scrollToIndex({
                index: nextIdx,
                animated: true,
                viewPosition: 0
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
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            flatListRef.current?.scrollToIndex({
                index: prevIdx,
                animated: true,
                viewPosition: 0
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

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            if (event.translationY > 0) {
                translateY.value = event.translationY;
            }
        })
        .onEnd((event) => {
            if (event.translationY > 150 || event.velocityY > 1000) {
                runOnJS(onClose)();
            } else {
                translateY.value = withSpring(0);
            }
        });

    const handleTap = (evt: any, index: number) => {
        const x = evt.nativeEvent.pageX;

        if (index !== currentIndex) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            flatListRef.current?.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0
            });
            return;
        }

        if (x < SCREEN_WIDTH * 0.35) {
            prevStory();
        } else if (x > SCREEN_WIDTH * 0.65) {
            nextStory();
        } else {
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

    const renderItem = ({ item, index }: { item: UserFilm, index: number }) => (
        <StoryItem
            item={item}
            index={index}
            currentIndex={currentIndex}
            visible={visible}
            isPaused={isPaused}
            progress={progress}
            progressStyle={progressStyle}
            insets={insets}
            handlePressIn={handlePressIn}
            handlePressOut={handlePressOut}
            handleTap={handleTap}
            handleDurationReport={handleDurationReport}
            setIsMediaReady={setIsMediaReady}
            nextStory={nextStory}
        />
    );

    const currentFilm = films[currentIndex];
    if (!currentFilm) return null;

    const modalOpacity = useSharedValue(0);
    useEffect(() => {
        modalOpacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
    }, [visible]);

    const animatedModalStyle = useAnimatedStyle(() => ({
        opacity: modalOpacity.value,
        transform: [
            { scale: interpolate(modalOpacity.value, [0, 1], [0.95, 1]) },
            { translateY: translateY.value }
        ]
    }));

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View
                style={[
                    styles.modalOverlay,
                    animatedModalStyle,
                    { pointerEvents: visible ? 'auto' : 'none' }
                ]}
            >
                <View style={styles.container}>
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
                                viewabilityConfig={{
                                    itemVisiblePercentThreshold: 60,
                                    minimumViewTime: 50
                                }}
                                initialScrollIndex={initialIndex}
                                getItemLayout={(_, index) => ({
                                    length: SNAP_INTERVAL,
                                    offset: SNAP_INTERVAL * index,
                                    index,
                                })}
                                initialNumToRender={3}
                                windowSize={5}
                                maxToRenderPerBatch={3}
                                removeClippedSubviews={Platform.OS === 'android'}
                            />
                        </View>
                    </View>
                </View>
            </Animated.View>
        </GestureDetector>
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
        backgroundColor: '#000',
        alignItems: 'center',
    },
    contentStack: {
        flex: 1,
        width: '100%',
    },
    carouselContainer: {
        flex: 1,
    },
    overlayBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        paddingTop: 80,
    },
    heartButton: {
        marginBottom: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    flatListContent: {
        paddingHorizontal: 0,
    },
    cardWrapper: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        backgroundColor: '#000',
    },
    card: {
        flex: 1,
    },
    progressContainer: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        height: 3,
        zIndex: 10,
    },
    progressBarBackground: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarForeground: {
        height: '100%',
        backgroundColor: '#FFF',
    },
});

export default FilmStoryModal;
