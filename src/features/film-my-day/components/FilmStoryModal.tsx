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
const IMAGE_DURATION = 5000;
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

    useEffect(() => {
        if (visible) {
            bgOpacity.value = withTiming(1, { duration: 240 });
            translateY.value = withTiming(0, { duration: 280, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
        } else {
            bgOpacity.value = withTiming(0, { duration: 200 });
            translateY.value = withTiming(SHEET_HEIGHT, { duration: 240, easing: Easing.bezier(0.4, 0, 1, 1) });
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
                <TouchableOpacity style={[styles.sheetRow, busy && styles.sheetRowDisabled]}
                    onPress={onSave} disabled={busy} activeOpacity={0.55}>
                    <Text style={styles.sheetRowText}>{isSaving ? 'Saving…' : 'Save to Camera Roll'}</Text>
                </TouchableOpacity>
                <View style={styles.sheetSep} />
                <TouchableOpacity style={[styles.sheetRow, busy && styles.sheetRowDisabled]}
                    onPress={onDelete} disabled={busy} activeOpacity={0.55}>
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
const StoryItem = React.memo(({
    item, index, currentIndex, visible, isPaused,
    progressStyle, insets,
    handlePressIn, handlePressOut, handleTap,
    onDuration, onReady, onComplete,
    isOwner, onDotsPress,
}: any) => {
    const isActive = index === currentIndex;
    const { isLiked, toggleLike } = useFilmLike(item.id, item.creatorId);

    return (
        <View style={styles.cardWrapper}>
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
                    onReady={isActive ? onReady : undefined}
                    onDuration={isActive ? onDuration : undefined}
                    onComplete={isActive ? onComplete : undefined}
                />

                {isActive && (
                    <>
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
                                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDotsPress(); }}
                                    style={styles.actionButton} activeOpacity={0.7}
                                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                                >
                                    <Entypo name="dots-two-horizontal" size={26} color="#FFF" />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => { toggleLike(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                                    style={styles.actionButton} activeOpacity={0.7}
                                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                                >
                                    <Ionicons
                                        name={isLiked ? 'heart' : 'heart-outline'}
                                        size={26} color={isLiked ? '#FF3B30' : '#FFF'}
                                    />
                                </TouchableOpacity>
                            )}
                        </LinearGradient>
                    </>
                )}
            </Pressable>
        </View>
    );
});

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
    const [isPaused, setIsPaused] = useState(false);
    const [isMediaReady, setIsMediaReady] = useState(false);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const progress = useSharedValue(0);
    const translateY = useSharedValue(0);
    const modalOpacity = useSharedValue(0);
    const flatListRef = useRef<FlatList>(null);

    // Always-fresh refs — avoids ALL stale closure bugs
    const durationRef = useRef(IMAGE_DURATION);
    const currentIdxRef = useRef(currentIndex);
    const filmsRef = useRef(films);
    const isPausedRef = useRef(isPaused);
    const isMediaReadyRef = useRef(isMediaReady);
    const onCloseRef = useRef(onClose);
    const onFilmDeletedRef = useRef(onFilmDeleted);

    // Keep refs in sync
    currentIdxRef.current = currentIndex;
    filmsRef.current = films;
    isPausedRef.current = isPaused;
    isMediaReadyRef.current = isMediaReady;
    onCloseRef.current = onClose;
    onFilmDeletedRef.current = onFilmDeleted;

    useEffect(() => { setFilms(initialFilms); }, [initialFilms]);

    // ── Core: start the progress bar ──────────────────────────────
    // Stored as ref so it's NEVER stale inside other callbacks
    const startProgressRef = useRef((fromZero = true) => {
        const dur = durationRef.current;
        const fromVal = fromZero ? 0 : progress.value;
        const remaining = dur * (1 - fromVal);

        cancelAnimation(progress);
        if (fromZero) progress.value = 0;

        progress.value = withTiming(1, {
            duration: remaining > 50 ? remaining : dur,
            easing: Easing.linear,
        }, (finished) => {
            if (finished) runOnJS(nextStoryRef.current)();
        });
    });

    // ── nextStory / prevStory stored as refs too ──────────────────
    const nextStoryRef = useRef(() => { });
    const prevStoryRef = useRef(() => { });

    nextStoryRef.current = () => {
        const idx = currentIdxRef.current;
        const total = filmsRef.current.length;
        cancelAnimation(progress);

        if (idx < total - 1) {
            const next = idx + 1;
            progress.value = 0;
            durationRef.current = IMAGE_DURATION;
            setIsMediaReady(false);
            setCurrentIndex(next);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            flatListRef.current?.scrollToIndex({ index: next, animated: true });
        } else {
            onCloseRef.current();
        }
    };

    prevStoryRef.current = () => {
        const idx = currentIdxRef.current;
        cancelAnimation(progress);

        if (idx > 0) {
            const prev = idx - 1;
            progress.value = 0;
            durationRef.current = IMAGE_DURATION;
            setIsMediaReady(false);
            setCurrentIndex(prev);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            flatListRef.current?.scrollToIndex({ index: prev, animated: true });
        } else {
            progress.value = 0;
        }
    };

    // Stable wrappers for JSX callbacks
    const nextStory = useCallback(() => nextStoryRef.current(), []);
    const prevStory = useCallback(() => prevStoryRef.current(), []);

    // ── Visibility ─────────────────────────────────────────────────
    useEffect(() => {
        if (visible) {
            setCurrentIndex(initialIndex);
            durationRef.current = IMAGE_DURATION;
            setIsMediaReady(false);
            setIsPaused(false);
            setSheetVisible(false);
            cancelAnimation(progress);
            progress.value = 0;

            setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
            }, 30);

            const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
                if (sheetVisible) { setSheetVisible(false); return true; }
                onClose(); return true;
            });
            return () => backHandler.remove();
        } else {
            cancelAnimation(progress);
            progress.value = 0;
            durationRef.current = IMAGE_DURATION;
            setIsMediaReady(false);
            setIsPaused(false);
            setSheetVisible(false);
            translateY.value = 0;
        }
    }, [visible, initialIndex]);

    // Modal fade
    useEffect(() => {
        modalOpacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
    }, [visible]);

    // ── Start bar when media becomes ready ────────────────────────
    useEffect(() => {
        if (!visible || !isMediaReady || isPaused) return;
        startProgressRef.current(true);
    }, [isMediaReady, currentIndex, visible]);

    // ── Pause / resume ─────────────────────────────────────────────
    useEffect(() => {
        if (!visible || !isMediaReadyRef.current) return;
        if (isPaused) {
            cancelAnimation(progress);
        } else {
            startProgressRef.current(false); // resume from current position
        }
    }, [isPaused]);

    // ── Sheet pause ────────────────────────────────────────────────
    useEffect(() => {
        setIsPaused(sheetVisible);
    }, [sheetVisible]);

    // ── Callbacks for FilmMedia ────────────────────────────────────
    const onReady = useCallback(() => {
        setIsMediaReady(true);
    }, []);

    const onDuration = useCallback((ms: number) => {
        if (ms <= 0) return;
        durationRef.current = ms;
        // restart with real video duration from 0
        cancelAnimation(progress);
        progress.value = 0;
        progress.value = withTiming(1, {
            duration: ms,
            easing: Easing.linear,
        }, (finished) => {
            if (finished) runOnJS(nextStory)();
        });
    }, [nextStory]);

    const onComplete = useCallback(() => {
        nextStory();
    }, [nextStory]);

    // ── Press handlers ─────────────────────────────────────────────
    const handlePressIn = useCallback(() => { cancelAnimation(progress); setIsPaused(true); }, []);
    const handlePressOut = useCallback(() => { setIsPaused(false); }, []);

    // ── Swipe down ─────────────────────────────────────────────────
    const panGesture = Gesture.Pan()
        .onUpdate((e) => { if (e.translationY > 0) translateY.value = e.translationY; })
        .onEnd((e) => {
            if (e.translationY > 150 || e.velocityY > 1000) runOnJS(onClose)();
            else translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        });

    // ── Tap ────────────────────────────────────────────────────────
    const handleTap = useCallback((evt: any, index: number) => {
        if (sheetVisible) return;
        const x = evt.nativeEvent.pageX;
        if (index !== currentIdxRef.current) {
            flatListRef.current?.scrollToIndex({ index, animated: true });
            return;
        }
        if (x < SCREEN_WIDTH * 0.35) prevStory();
        else if (x > SCREEN_WIDTH * 0.65) nextStory();
        else isPausedRef.current ? handlePressOut() : handlePressIn();
    }, [sheetVisible, nextStory, prevStory, handlePressIn, handlePressOut]);

    // ── FlatList viewability ───────────────────────────────────────
    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (!viewableItems.length) return;
        const first = viewableItems[0];
        if (first.index !== null && first.index !== currentIdxRef.current) {
            cancelAnimation(progress);
            progress.value = 0;
            durationRef.current = IMAGE_DURATION;
            setIsMediaReady(false);
            setCurrentIndex(first.index);
        }
    }).current;

    // ── Save ───────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        const film = filmsRef.current[currentIdxRef.current];
        if (!film) return;
        setIsSaving(true);
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo library access in Settings.'); return; }
            const ext = film.type === 'video' ? 'mp4' : 'jpg';
            const localUri = `${FileSystem.cacheDirectory}film_${Date.now()}.${ext}`;
            const dl = await FileSystem.downloadAsync(film.uri, localUri);
            await MediaLibrary.saveToLibraryAsync(dl.uri);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSheetVisible(false);
            Alert.alert('Saved', `${film.type === 'video' ? 'Video' : 'Photo'} saved to your camera roll.`);
        } catch { Alert.alert('Error', 'Could not save. Please try again.'); }
        finally { setIsSaving(false); }
    }, []);

    // ── Delete ─────────────────────────────────────────────────────
    const handleDelete = useCallback(() => {
        const film = filmsRef.current[currentIdxRef.current];
        if (!film) return;
        Alert.alert('Delete this film?', 'This will permanently remove it.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    setIsDeleting(true);
                    try {
                        const m = film.uri.match(/\/storage\/v1\/object\/sign\/films\/(.+?)(\?|$)/);
                        if (m) await supabase.storage.from('films').remove([decodeURIComponent(m[1])]);
                        if (film.thumbnail) {
                            const t = film.thumbnail.match(/\/storage\/v1\/object\/sign\/films\/(.+?)(\?|$)/);
                            if (t) await supabase.storage.from('films').remove([decodeURIComponent(t[1])]);
                        }
                        const { error } = await supabase.from('films').delete().eq('id', film.id);
                        if (error) throw error;

                        const newFilms = filmsRef.current.filter(f => f.id !== film.id);
                        setFilms(newFilms);
                        onFilmDeletedRef.current?.(film.id);
                        setSheetVisible(false);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                        if (newFilms.length === 0) {
                            onCloseRef.current();
                        } else {
                            const nextIdx = Math.min(currentIdxRef.current, newFilms.length - 1);
                            cancelAnimation(progress);
                            progress.value = 0; durationRef.current = IMAGE_DURATION;
                            setIsMediaReady(false); setCurrentIndex(nextIdx);
                            setTimeout(() => flatListRef.current?.scrollToIndex({ index: nextIdx, animated: false }), 50);
                        }
                    } catch { Alert.alert('Error', 'Could not delete. Please try again.'); }
                    finally { setIsDeleting(false); }
                }
            },
        ]);
    }, []);

    // ── Animated styles ────────────────────────────────────────────
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

    const renderItem = useCallback(({ item, index }: { item: UserFilm; index: number }) => (
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
            onReady={onReady}
            onDuration={onDuration}
            onComplete={onComplete}
            isOwner={isOwner}
            onDotsPress={() => setSheetVisible(true)}
        />
    ), [currentIndex, visible, isPaused, progressStyle]);

    const currentFilm = films[currentIndex];
    if (!currentFilm) return null;

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.modalOverlay, animatedModalStyle, { pointerEvents: visible ? 'auto' : 'none' } as any]}>
                <View style={styles.container}>
                    <FlatList
                        ref={flatListRef}
                        data={films}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        snapToInterval={SNAP_INTERVAL}
                        decelerationRate="fast"
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={{ itemVisiblePercentThreshold: 60, minimumViewTime: 50 }}
                        initialScrollIndex={initialIndex}
                        getItemLayout={(_, i) => ({ length: SNAP_INTERVAL, offset: SNAP_INTERVAL * i, index: i })}
                        initialNumToRender={3}
                        windowSize={5}
                        maxToRenderPerBatch={3}
                        removeClippedSubviews={Platform.OS === 'android'}
                    />
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
    modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 1000 },
    container: { flex: 1, backgroundColor: '#000' },
    cardWrapper: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: '#000' },
    card: { flex: 1 },
    progressContainer: {
        position: 'absolute', top: 60, left: 20, right: 20,
        height: 3, zIndex: 10,
    },
    progressBarBackground: {
        flex: 1, backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 2, overflow: 'hidden',
    },
    progressBarForeground: { height: '100%', backgroundColor: '#FFF' },
    overlayBottom: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end',
        paddingHorizontal: 20, paddingTop: 80,
    },
    actionButton: { marginBottom: 10, padding: 10, justifyContent: 'center', alignItems: 'center' },
    sheetOverlay: { zIndex: 2000, justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingTop: 10, overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08, shadowRadius: 12, elevation: 16,
    },
    sheetHandle: {
        width: 36, height: 4, borderRadius: 2,
        backgroundColor: 'rgba(0,0,0,0.15)', alignSelf: 'center', marginBottom: 6,
    },
    sheetRow: { paddingVertical: 18, paddingHorizontal: 24, justifyContent: 'center' },
    sheetRowDisabled: { opacity: 0.4 },
    sheetRowText: { fontFamily: FONTS.regular, fontSize: 17, color: '#1C1C1E', textAlign: 'center', letterSpacing: -0.2 },
    sheetRowDanger: { color: '#FF3B30', fontFamily: FONTS.bold },
    sheetSep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.12)' },
});

export default FilmStoryModal;