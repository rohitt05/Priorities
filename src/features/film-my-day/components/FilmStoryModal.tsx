import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet, View, TouchableOpacity,
    Dimensions, Pressable, Platform, FlatList,
    ViewToken, BackHandler, Text, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Entypo } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    cancelAnimation,
    runOnJS,
    interpolate,
    withSpring,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Film as UserFilm } from '@/types/domain';
import { FONTS } from '@/theme/theme';
import FilmMedia from './FilmMedia';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { useFilmLike } from '@/hooks/useFilmLike';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_STORY_DURATION = 15000;
const SNAP_INTERVAL = SCREEN_WIDTH;

interface FilmStoryModalProps {
    films: UserFilm[];
    initialIndex: number;
    visible: boolean;
    onClose: () => void;
    isOwner?: boolean;
    onFilmDeleted?: (filmId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom Sheet
// ─────────────────────────────────────────────────────────────────────────────
const SHEET_HEIGHT = 160;

interface OwnerSheetProps {
    visible: boolean;
    film: UserFilm | null;
    onClose: () => void;
    onSave: () => void;
    onDelete: () => void;
    isSaving: boolean;
    isDeleting: boolean;
}

const OwnerBottomSheet: React.FC<OwnerSheetProps> = ({
    visible, film, onClose, onSave, onDelete, isSaving, isDeleting,
}) => {
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(SHEET_HEIGHT);
    const bgOpacity = useSharedValue(0);

    const EASE_IN = { duration: 280, easing: Easing.bezier(0.25, 0.1, 0.25, 1) } as const;
    const EASE_OUT = { duration: 240, easing: Easing.bezier(0.4, 0, 1, 1) } as const;

    useEffect(() => {
        if (visible) {
            bgOpacity.value = withTiming(1, { duration: 240 });
            translateY.value = withTiming(0, EASE_IN);
        } else {
            bgOpacity.value = withTiming(0, { duration: 200 });
            translateY.value = withTiming(SHEET_HEIGHT, EASE_OUT);
        }
    }, [visible]);

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
    const overlayStyle = useAnimatedStyle(() => ({
        opacity: bgOpacity.value,
        pointerEvents: visible ? 'auto' : 'none',
    } as any));

    if (!film) return null;
    const busy = isSaving || isDeleting;

    return (
        <Animated.View style={[StyleSheet.absoluteFill, styles.sheetOverlay, overlayStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} />
            <Animated.View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 28) }, sheetStyle]}>
                <View style={styles.sheetHandle} />
                <TouchableOpacity
                    style={[styles.sheetRow, busy && styles.sheetRowDisabled]}
                    onPress={onSave} disabled={busy} activeOpacity={0.55}
                >
                    <Text style={styles.sheetRowText}>{isSaving ? 'Saving…' : 'Save to Camera Roll'}</Text>
                </TouchableOpacity>
                <View style={styles.sheetSep} />
                <TouchableOpacity
                    style={[styles.sheetRow, busy && styles.sheetRowDisabled]}
                    onPress={onDelete} disabled={busy} activeOpacity={0.55}
                >
                    <Text style={[styles.sheetRowText, styles.sheetRowDanger]}>
                        {isDeleting ? 'Deleting…' : 'Delete'}
                    </Text>
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Story Item
// ─────────────────────────────────────────────────────────────────────────────
const StoryItem = ({
    item, index, currentIndex, visible, isPaused,
    progressStyle, insets,
    handlePressIn, handlePressOut, handleTap,
    handleDurationReport, setIsMediaReady, nextStory,
    isOwner, onDotsPress,
}: any) => {
    const isActive = index === currentIndex;
    const { isLiked, toggleLike } = useFilmLike(item.id, item.creatorId);

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
                />

                {isActive && (
                    <>
                        {/* Progress bar — driven purely by modal's withTiming */}
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBarBackground}>
                                <Animated.View style={[styles.progressBarForeground, progressStyle]} />
                            </View>
                        </View>

                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,0.48)']}
                            style={[styles.overlayBottom, { paddingBottom: Math.max(insets.bottom, 20) }]}
                        >
                            {isOwner ? (
                                <TouchableOpacity
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        onDotsPress();
                                    }}
                                    style={styles.actionButton}
                                    activeOpacity={0.7}
                                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                                >
                                    <Entypo name="dots-two-horizontal" size={26} color="#FFF" />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => {
                                        toggleLike();
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={styles.actionButton}
                                    activeOpacity={0.7}
                                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                                >
                                    <Ionicons
                                        name={isLiked ? 'heart' : 'heart-outline'}
                                        size={26}
                                        color={isLiked ? '#FF3B30' : '#FFF'}
                                    />
                                </TouchableOpacity>
                            )}
                        </LinearGradient>
                    </>
                )}
            </Pressable>
        </View>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────
const FilmStoryModal: React.FC<FilmStoryModalProps> = ({
    films: initialFilms,
    initialIndex,
    visible,
    onClose,
    isOwner = false,
    onFilmDeleted,
}) => {
    const insets = useSafeAreaInsets();
    const [films, setFilms] = useState(initialFilms);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const progress = useSharedValue(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isMediaReady, setIsMediaReady] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const translateY = useSharedValue(0);
    const modalOpacity = useSharedValue(0);

    // Use a ref for duration so it's always fresh inside callbacks/worklets
    // without causing re-renders or stale closures
    const durationRef = useRef(DEFAULT_STORY_DURATION);

    const [sheetVisible, setSheetVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => { setFilms(initialFilms); }, [initialFilms]);

    // ── Visibility ──────────────────────────────────────────────
    useEffect(() => {
        if (visible) {
            setCurrentIndex(initialIndex);
            durationRef.current = DEFAULT_STORY_DURATION;
            setIsMediaReady(false);
            setSheetVisible(false);
            progress.value = 0;

            flatListRef.current?.scrollToIndex({
                index: initialIndex, animated: false, viewPosition: 0.5,
            });

            const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
                if (sheetVisible) { setSheetVisible(false); return true; }
                onClose(); return true;
            });
            return () => backHandler.remove();
        } else {
            cancelAnimation(progress);
            progress.value = 0;
            durationRef.current = DEFAULT_STORY_DURATION;
            setIsMediaReady(false);
            setSheetVisible(false);
            translateY.value = 0;
        }
    }, [visible, initialIndex]);

    // Pause when sheet opens
    useEffect(() => {
        if (sheetVisible) {
            cancelAnimation(progress);
            setIsPaused(true);
        } else {
            setIsPaused(false);
        }
    }, [sheetVisible]);

    useEffect(() => {
        modalOpacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
    }, [visible]);

    // ── THE ONLY place withTiming runs ─────────────────────────
    // Fires when: media becomes ready, index changes, paused/unpaused, visible changes
    useEffect(() => {
        if (!visible || !isMediaReady || isPaused) {
            cancelAnimation(progress);
            return;
        }

        // Calculate remaining time based on current progress position
        const elapsed = progress.value * durationRef.current;
        const remaining = durationRef.current - elapsed;

        cancelAnimation(progress);
        progress.value = withTiming(1, {
            duration: remaining > 100 ? remaining : durationRef.current,
            easing: Easing.linear,
        }, (finished) => {
            // Safety net: if withTiming finishes (image, or video where onComplete didn't fire)
            if (finished) runOnJS(nextStory)();
        });
    }, [isMediaReady, currentIndex, visible, isPaused]);

    // ── nextStory / prevStory ───────────────────────────────────
    const nextStory = useCallback(() => {
        cancelAnimation(progress);
        if (currentIndex < films.length - 1) {
            const nextIdx = currentIndex + 1;
            progress.value = 0;
            durationRef.current = DEFAULT_STORY_DURATION;
            setIsMediaReady(false);
            setCurrentIndex(nextIdx);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true, viewPosition: 0 });
        } else {
            onClose();
        }
    }, [currentIndex, films.length, onClose]);

    const prevStory = useCallback(() => {
        cancelAnimation(progress);
        if (currentIndex > 0) {
            const prevIdx = currentIndex - 1;
            progress.value = 0;
            durationRef.current = DEFAULT_STORY_DURATION;
            setIsMediaReady(false);
            setCurrentIndex(prevIdx);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            flatListRef.current?.scrollToIndex({ index: prevIdx, animated: true, viewPosition: 0 });
        } else {
            // Restart from beginning
            progress.value = 0;
        }
    }, [currentIndex]);

    // Called ONCE per film — updates durationRef and restarts withTiming with correct length
    const handleDurationReport = useCallback((reportedMs: number) => {
        if (reportedMs <= 0) return;
        if (Math.abs(reportedMs - durationRef.current) < 300) return; // skip if nearly same

        durationRef.current = reportedMs;

        // Restart the progress animation from 0 with the real duration
        cancelAnimation(progress);
        progress.value = 0;
        progress.value = withTiming(1, {
            duration: reportedMs,
            easing: Easing.linear,
        }, (finished) => {
            if (finished) runOnJS(nextStory)();
        });
    }, [nextStory]);

    const handlePressIn = useCallback(() => {
        cancelAnimation(progress);
        setIsPaused(true);
    }, []);

    const handlePressOut = useCallback(() => {
        setIsPaused(false);
        // isPaused state change triggers the useEffect above which resumes withTiming
    }, []);

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            if (event.translationY > 0) translateY.value = event.translationY;
        })
        .onEnd((event) => {
            if (event.translationY > 150 || event.velocityY > 1000) {
                runOnJS(onClose)();
            } else {
                translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
            }
        });

    const handleTap = (evt: any, index: number) => {
        if (sheetVisible) return;
        const x = evt.nativeEvent.pageX;
        if (index !== currentIndex) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
            return;
        }
        if (x < SCREEN_WIDTH * 0.35) prevStory();
        else if (x > SCREEN_WIDTH * 0.65) nextStory();
        else isPaused ? handlePressOut() : handlePressIn();
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0) {
            const first = viewableItems[0];
            if (first.index !== null && first.index !== currentIndex) {
                cancelAnimation(progress);
                progress.value = 0;
                durationRef.current = DEFAULT_STORY_DURATION;
                setIsMediaReady(false);
                setCurrentIndex(first.index);
            }
        }
    }).current;

    // ── Save ────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        const film = films[currentIndex];
        if (!film) return;
        setIsSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Allow access to your photo library in Settings.');
                return;
            }
            const ext = film.type === 'video' ? 'mp4' : 'jpg';
            const localUri = `${FileSystem.cacheDirectory}film_${Date.now()}.${ext}`;
            const dl = await FileSystem.downloadAsync(film.uri, localUri);
            await MediaLibrary.saveToLibraryAsync(dl.uri);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSheetVisible(false);
            Alert.alert('Saved', `${film.type === 'video' ? 'Video' : 'Photo'} saved to your camera roll.`);
        } catch (e) {
            console.error('[FilmStoryModal] save error:', e);
            Alert.alert('Error', 'Could not save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    }, [films, currentIndex]);

    // ── Delete ──────────────────────────────────────────────────
    const handleDelete = useCallback(() => {
        const film = films[currentIndex];
        if (!film) return;
        Alert.alert('Delete this film?', 'This will permanently remove it.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    setIsDeleting(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    try {
                        const storageMatch = film.uri.match(/\/storage\/v1\/object\/sign\/films\/(.+?)(\?|$)/);
                        if (storageMatch) {
                            await supabase.storage.from('films').remove([decodeURIComponent(storageMatch[1])]);
                        }
                        if (film.thumbnail) {
                            const thumbMatch = film.thumbnail.match(/\/storage\/v1\/object\/sign\/films\/(.+?)(\?|$)/);
                            if (thumbMatch) {
                                await supabase.storage.from('films').remove([decodeURIComponent(thumbMatch[1])]);
                            }
                        }
                        const { error } = await supabase.from('films').delete().eq('id', film.id);
                        if (error) throw error;

                        const newFilms = films.filter(f => f.id !== film.id);
                        setFilms(newFilms);
                        onFilmDeleted?.(film.id);
                        setSheetVisible(false);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                        if (newFilms.length === 0) {
                            onClose();
                        } else {
                            const nextIdx = Math.min(currentIndex, newFilms.length - 1);
                            cancelAnimation(progress);
                            progress.value = 0;
                            durationRef.current = DEFAULT_STORY_DURATION;
                            setIsMediaReady(false);
                            setCurrentIndex(nextIdx);
                            setTimeout(() => {
                                flatListRef.current?.scrollToIndex({ index: nextIdx, animated: false });
                            }, 50);
                        }
                    } catch (e) {
                        console.error('[FilmStoryModal] delete error:', e);
                        Alert.alert('Error', 'Could not delete. Please try again.');
                    } finally {
                        setIsDeleting(false);
                    }
                },
            },
        ]);
    }, [films, currentIndex, onClose, onFilmDeleted]);

    // ── Styles ──────────────────────────────────────────────────
    const progressStyle = useAnimatedStyle(() => ({
        width: `${progress.value * 100}%`,
    }));

    const animatedModalStyle = useAnimatedStyle(() => ({
        opacity: modalOpacity.value,
        transform: [
            { scale: interpolate(modalOpacity.value, [0, 1], [0.95, 1]) },
            { translateY: translateY.value },
        ],
    }));

    const renderItem = ({ item, index }: { item: UserFilm; index: number }) => (
        <StoryItem
            item={item}
            index={index}
            currentIndex={currentIndex}
            visible={visible}
            isPaused={isPaused}
            progressStyle={progressStyle}
            insets={insets}
            handlePressIn={handlePressIn}
            handlePressOut={handlePressOut}
            handleTap={handleTap}
            handleDurationReport={handleDurationReport}
            setIsMediaReady={setIsMediaReady}
            nextStory={nextStory}
            isOwner={isOwner}
            onDotsPress={() => setSheetVisible(true)}
        />
    );

    const currentFilm = films[currentIndex];
    if (!currentFilm) return null;

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View
                style={[
                    styles.modalOverlay,
                    animatedModalStyle,
                    { pointerEvents: visible ? 'auto' : 'none' },
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
                                    minimumViewTime: 50,
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

                {isOwner && (
                    <OwnerBottomSheet
                        visible={sheetVisible}
                        film={currentFilm}
                        onClose={() => setSheetVisible(false)}
                        onSave={handleSave}
                        onDelete={handleDelete}
                        isSaving={isSaving}
                        isDeleting={isDeleting}
                    />
                )}
            </Animated.View>
        </GestureDetector>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        zIndex: 1000,
    },
    container: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
    contentStack: { flex: 1, width: '100%' },
    carouselContainer: { flex: 1 },
    flatListContent: { paddingHorizontal: 0 },
    cardWrapper: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        backgroundColor: '#000',
    },
    card: { flex: 1 },
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
    overlayBottom: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        paddingTop: 80,
    },
    actionButton: {
        marginBottom: 10,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
    },
    sheetOverlay: { zIndex: 2000, justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 10,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 16,
    },
    sheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(0,0,0,0.15)',
        alignSelf: 'center',
        marginBottom: 6,
    },
    sheetRow: { paddingVertical: 18, paddingHorizontal: 24, justifyContent: 'center' },
    sheetRowDisabled: { opacity: 0.4 },
    sheetRowText: {
        fontFamily: FONTS.regular,
        fontSize: 17,
        color: '#1C1C1E',
        textAlign: 'center',
        letterSpacing: -0.2,
    },
    sheetRowDanger: { color: '#FF3B30', fontFamily: FONTS.bold },
    sheetSep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.12)' },
});

export default FilmStoryModal;