import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    StatusBar,
    Dimensions,
    ActivityIndicator,
    Animated as RNAnimated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '@/theme/theme';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    interpolate,
    Extrapolation,
    useAnimatedScrollHandler,
    useAnimatedReaction,
    runOnJS,
} from 'react-native-reanimated';
import { SharedValue } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { Film } from '@/types/domain';
import { useBackground } from '@/contexts/BackgroundContext';

import FilmStoryModal from '@/features/film-my-day/components/FilmStoryModal';
import FilmMedia from '@/features/film-my-day/components/FilmMedia';

const { width: SW, height: SH } = Dimensions.get('window');

const CARD_WIDTH = SW - 16;
const GAP = 24;

const HEADER_AREA = SH * 0.22;
const LIST_HEIGHT_APPROX = SH - HEADER_AREA;
const CARD_HEIGHT = LIST_HEIGHT_APPROX * 0.85;
const ITEM_HEIGHT = CARD_HEIGHT + GAP;
const BOTTOM_PEEK = LIST_HEIGHT_APPROX * 0.04;

// ─────────────────────────────────────────────────────────────
// FilmRollCard
// ─────────────────────────────────────────────────────────────
interface FilmRollCardProps {
    film: Film;
    index: number;
    scrollY: SharedValue<number>;
    onPress: () => void;
}

const FilmRollCard: React.FC<FilmRollCardProps> = ({ film, index, scrollY, onPress }) => {
    const inputRange = [
        (index - 1) * ITEM_HEIGHT,
        index * ITEM_HEIGHT,
        (index + 1) * ITEM_HEIGHT,
    ];

    const animStyle = useAnimatedStyle(() => {
        const scale = interpolate(scrollY.value, inputRange, [0.91, 1, 0.91], Extrapolation.CLAMP);
        const opacity = interpolate(scrollY.value, inputRange, [0.42, 1, 0.42], Extrapolation.CLAMP);
        return { transform: [{ scale }], opacity };
    });

    const mediaScale = useAnimatedStyle(() => {
        const scale = interpolate(scrollY.value, inputRange, [0.82, 1.05, 0.82], Extrapolation.CLAMP);
        return { transform: [{ scale }] };
    });

    const relativeTime = useMemo(() => {
        const diff = Math.floor((Date.now() - new Date(film.createdAt).getTime()) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }, [film.createdAt]);

    return (
        <Animated.View style={[styles.cardWrapper, animStyle]}>
            <View style={styles.card}>
                <Animated.View style={[styles.mediaContainer, mediaScale]}>
                    <FilmMedia
                        uri={film.uri}
                        type={film.type as 'image' | 'video'}
                        style={styles.mediaFill}
                    />
                </Animated.View>
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.62)']}
                    style={styles.scrimBottom}
                    pointerEvents="none"
                />
                <View style={styles.cardBottom} pointerEvents="none">
                    <Text style={styles.timeLabel}>{relativeTime}</Text>
                </View>

                {/* Full-cover transparent pressable — always wins over video touch */}
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={0.96}
                    onPress={onPress}
                />
            </View>
        </Animated.View>
    );
};
// ─────────────────────────────────────────────────────────────
// DayLabel
// ─────────────────────────────────────────────────────────────
const DayLabel: React.FC<{ text: string; top: number }> = ({ text, top }) => (
    <View style={[styles.dayContainer, { top }]} pointerEvents="none">
        <Text style={styles.dayTextShadow} numberOfLines={1} allowFontScaling={false}>{text}</Text>
        <Text style={styles.dayTextPrimary} numberOfLines={1} allowFontScaling={false}>{text}</Text>
    </View>
);

// ─────────────────────────────────────────────────────────────
// WatchingHeader
// ─────────────────────────────────────────────────────────────
const WatchingHeader: React.FC<{
    userName: string;
    activeIndex: number;
    filmCount: number;
    animStyle: any;
    paddingTop: number;
    gradientColors: readonly [string, string, string];
}> = ({ userName, activeIndex, filmCount, animStyle, paddingTop, gradientColors }) => (
    <Animated.View style={[styles.header, { paddingTop }, animStyle]} pointerEvents="none">
        <LinearGradient colors={gradientColors} style={styles.headerBlur} pointerEvents="none" />
        <View style={{ flex: 1 }} />
        <View style={styles.headerRight}>
            <Text style={styles.watchingLabel}>watching films of</Text>
            <Text style={styles.headerName}>{userName}</Text>
            {filmCount > 1 && (
                <View style={styles.paginationRow}>
                    {Array.from({ length: filmCount }).map((_, i) => (
                        <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
                    ))}
                </View>
            )}
            <Text style={styles.indexLabel}>{activeIndex + 1} / {filmCount}</Text>
        </View>
    </Animated.View>
);

// ─────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────
const UserFilms = () => {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { userId, userName, dominantColor } = useLocalSearchParams<{
        userId: string;
        userName: string;
        dominantColor?: string;
    }>();

    const { bgColor, prevBgColor, colorAnim, handleColorChange } = useBackground();

    const [films, setFilms] = useState<Film[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalIndex, setModalIndex] = useState(0);
    const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
    const [activeIndex, setActiveIndex] = useState(0);

    const scrollY = useSharedValue(0);

    useEffect(() => {
        if (dominantColor) handleColorChange(decodeURIComponent(dominantColor));
    }, [dominantColor]);

    useEffect(() => {
        if (!userId) return;
        (async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('films')
                .select('id, type, uri, thumbnail, created_at')
                .eq('creator_id', userId)
                .order('created_at', { ascending: false });

            if (error) { console.error('[UserFilms]', error.message); setIsLoading(false); return; }

            setFilms((data || []).map(f => ({
                id: f.id,
                creatorId: userId,
                type: f.type as 'image' | 'video',
                uri: f.uri,
                thumbnail: f.thumbnail ?? undefined,
                isPublic: true,
                targetUserId: null,
                createdAt: f.created_at,
            })));
            setIsLoading(false);
        })();
    }, [userId]);

    const recordView = useCallback(async (filmId: string) => {
        if (viewedIds.has(filmId)) return;
        const { data: s } = await supabase.auth.getSession();
        const viewerId = s?.session?.user?.id;
        if (!viewerId || viewerId === userId) return;
        await supabase.from('film_views').upsert(
            { film_id: filmId, viewer_id: viewerId },
            { onConflict: 'film_id,viewer_id', ignoreDuplicates: true }
        );
        setViewedIds(prev => new Set(prev).add(filmId));
    }, [userId, viewedIds]);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: e => { scrollY.value = e.contentOffset.y; },
    });

    useAnimatedReaction(
        () => Math.round(scrollY.value / ITEM_HEIGHT),
        current => {
            const clamped = Math.min(Math.max(current, 0), films.length - 1);
            runOnJS(setActiveIndex)(clamped);
        }
    );

    const topDay = useMemo(() => {
        const film = films[activeIndex];
        if (!film) return '';
        return new Date(film.createdAt).toLocaleDateString(undefined, { weekday: 'long' });
    }, [activeIndex, films]);

    const handleCardPress = useCallback((index: number) => {
        setModalIndex(index);
        setModalVisible(true);
        if (films[index]) recordView(films[index].id);
    }, [films, recordView]);

    const headerOpacity = useSharedValue(0);
    useEffect(() => {
        headerOpacity.value = withTiming(1, { duration: 400 });
    }, []);
    const headerStyle = useAnimatedStyle(() => ({ opacity: headerOpacity.value }));

    const animatedBg = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    const HEADER_HEIGHT = insets.top + 68;

    // ── DAY_TOP and LIST_TOP are now fully independent ─────────
    // Move DAY_TOP freely without affecting card position
    const DAY_TOP = HEADER_HEIGHT - 30;         // ← day text position, tune freely
    const LIST_TOP = HEADER_HEIGHT + 48;        // ← cards always start here, independent
    const LIST_PADDING_BOTTOM = LIST_HEIGHT_APPROX - CARD_HEIGHT - BOTTOM_PEEK;

    const headerGradientColors = [
        bgColor + 'EE',
        bgColor + '99',
        bgColor + '00',
    ] as const;

    if (isLoading) {
        return (
            <RNAnimated.View style={[styles.container, { backgroundColor: animatedBg }]}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </RNAnimated.View>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: animatedBg }]} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.28)' }]} />

            <View style={styles.container}>
                <StatusBar barStyle="light-content" />

                {films.length > 0 && topDay.length > 0 && (
                    <DayLabel text={topDay} top={DAY_TOP} />
                )}

                {films.length > 0 ? (
                    <Animated.FlatList
                        data={films}
                        keyExtractor={item => item.id}
                        onScroll={scrollHandler}
                        scrollEventThrottle={16}
                        snapToInterval={ITEM_HEIGHT}
                        decelerationRate="fast"
                        showsVerticalScrollIndicator={false}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        contentContainerStyle={{
                            paddingTop: LIST_TOP,
                            paddingBottom: LIST_PADDING_BOTTOM,
                            paddingHorizontal: 8,
                        }}
                        renderItem={({ item, index }) => (
                            <FilmRollCard
                                film={item}
                                index={index}
                                scrollY={scrollY}
                                onPress={() => handleCardPress(index)}
                            />
                        )}
                    />
                ) : (
                    <View style={styles.centered}>
                        <View style={styles.placeholderCard}>
                            <Ionicons name="film-outline" size={52} color="rgba(255,255,255,0.25)" />
                            <Text style={styles.placeholderTitle}>No Films Yet</Text>
                            <Text style={styles.placeholderText}>
                                {userName || 'This user'} hasn't shared a film today.
                            </Text>
                        </View>
                    </View>
                )}

                <WatchingHeader
                    userName={userName ?? ''}
                    activeIndex={activeIndex}
                    filmCount={films.length}
                    animStyle={headerStyle}
                    paddingTop={insets.top + 10}
                    gradientColors={headerGradientColors}
                />

                {/* Floating back button */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={[styles.backButton, { top: insets.top + 12 }]}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back-sharp" size={22} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <FilmStoryModal
                films={films}
                initialIndex={modalIndex}
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
            />
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },

    // ── Day label ──────────────────────────────────────────────
    dayContainer: {
        position: 'absolute',
        left: 0, right: 0,
        zIndex: 101,
        paddingHorizontal: 20,
    },
    dayTextShadow: {
        position: 'absolute',
        fontSize: 64,
        fontFamily: 'DancingScript-Bold',
        color: COLORS.primary,
        opacity: 0.18,
        letterSpacing: 1,
        top: 4,
        left: 22,
    },
    dayTextPrimary: {
        fontSize: 46,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        opacity: 0.92,
        letterSpacing: -1.5,
        marginTop: 14,
        textShadowColor: 'rgba(0,0,0,0.18)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },

    // ── Header ─────────────────────────────────────────────────
    header: {
        position: 'absolute', top: 0, left: 0, right: 0,
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingBottom: 28,
        zIndex: 100,
    },
    headerBlur: { ...StyleSheet.absoluteFillObject, zIndex: -1 },
    backButton: {
        position: 'absolute',
        left: 16,
        width: 36, height: 36,
        justifyContent: 'center', alignItems: 'center',
        zIndex: 102,
    },
    headerRight: {
        alignItems: 'flex-end',
        paddingRight: 4,
        gap: 2,
    },
    watchingLabel: {
        fontFamily: 'DancingScript-SemiBold',
        fontSize: 15,
        color: COLORS.primary,
        opacity: 0.65,
        letterSpacing: 0.3,
    },
    headerName: {
        fontFamily: FONTS.bold,
        fontSize: 22,
        color: COLORS.primary,
        letterSpacing: -0.4,
        textShadowColor: 'rgba(0,0,0,0.1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    paginationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        maxWidth: 200,
    },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: `${COLORS.primary}55` },
    dotActive: { width: 14, height: 4, borderRadius: 2, backgroundColor: COLORS.primary },
    indexLabel: {
        color: COLORS.primary,
        opacity: 0.45,
        fontSize: 10,
        fontFamily: FONTS.medium,
        marginTop: 2,
    },

    // ── Cards ──────────────────────────────────────────────────
    cardWrapper: {
        width: CARD_WIDTH, height: CARD_HEIGHT, marginBottom: GAP,
        borderRadius: 20, overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.55, shadowRadius: 28, elevation: 16,
    },
    card: { flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1a1a1a' },
    mediaContainer: {
        position: 'absolute', top: '-12%', left: '-12%', right: '-12%', bottom: '-12%',
    },
    mediaFill: { flex: 1, width: '100%', height: '100%' },
    scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '38%' },
    cardBottom: { position: 'absolute', bottom: 20, left: 18, right: 18 },
    timeLabel: {
        color: '#fff', fontSize: 19, fontFamily: FONTS.bold, letterSpacing: -0.3,
    },

    // ── Placeholder ────────────────────────────────────────────
    placeholderCard: {
        alignItems: 'center', padding: 48, borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', width: '100%',
    },
    placeholderTitle: {
        color: 'rgba(255,255,255,0.7)', fontSize: 17, fontFamily: FONTS.bold, marginTop: 18, marginBottom: 8,
    },
    placeholderText: {
        color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: FONTS.medium, textAlign: 'center', lineHeight: 20,
    },
});

export default UserFilms;