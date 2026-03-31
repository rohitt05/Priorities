/**
 * UserFilms.tsx — View another user's films on the free canvas
 * - NO long press / viewer overlay (owner-only feature)
 * - Tap bubble → FilmStoryModal
 * - Countdown label below each bubble
 * - Dynamic background crossfade from dominant color
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    StyleSheet, View, Text, Pressable,
    Dimensions, Animated as RNAnimated,
    ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '@/theme/theme';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import FilmMedia from '@/features/film-my-day/components/FilmMedia';
import FilmStoryModal from '@/features/film-my-day/components/FilmStoryModal';
import { Profile, Film } from '@/types/domain';
import { getColors } from 'react-native-image-colors';
import * as VideoThumbnails from 'expo-video-thumbnails';
import Animated, {
    useSharedValue, useAnimatedStyle, withTiming,
    runOnJS,
} from 'react-native-reanimated';
import {
    FilmCanvas,
    buildCardLayout,
    buildDecoCircleLayout,
    rgba,
} from '@/features/film-my-day/components/canvas';
import { useFilmCountdown } from '@/features/film-my-day/components/filmCountdown';
import Svg, { Path } from 'react-native-svg';

const { width: SW, height: SH } = Dimensions.get('window');

const BUBBLE_R_MIN = 35;
const BUBBLE_R_MAX = 100;
const DEF_SC = (SW * 0.48) / (BUBBLE_R_MAX * 2);
const VIEW_THRESHOLD_MS = 2000;

function buildBubbleRadii(count: number): number[] {
    let rs = 42;
    const randR = () => { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; };
    return Array.from({ length: count }, () =>
        BUBBLE_R_MIN + randR() * (BUBBLE_R_MAX - BUBBLE_R_MIN)
    );
}

// ── DoodleUnderline ────────────────────────────────────────────
const DoodleUnderline = React.memo(({ color, width = 160 }: { color: string; width?: number }) => (
    <Svg width={width} height={14} viewBox={`0 0 ${width} 14`} style={{ marginTop: -5, opacity: 0.85 }}>
        <Path
            d={`M${width * 0.03} 7C${width * 0.2} 5 ${width * 0.4} 6 ${width * 0.6} 7C${width * 0.8} 8 ${width * 0.95} 5 ${width * 0.98} 6`}
            stroke={color} strokeWidth={2.8} strokeLinecap="round" fill="none"
        />
        <Path
            d={`M${width * 0.08} 10C${width * 0.3} 9 ${width * 0.5} 10 ${width * 0.7} 11C${width * 0.9} 12 ${width * 0.95} 9 ${width * 0.92} 8`}
            stroke={color} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.65}
        />
    </Svg>
));
DoodleUnderline.displayName = 'DoodleUnderline';

// ── FilmBubble — tap only, no long press ──────────────────────
interface FilmItemExtended extends Film {
    viewers: Profile[];
    likedByIds: Set<string>;
}

const FilmBubble = React.memo(({ film, x, y, r, isActive, isVisible, onPress }: {
    film: FilmItemExtended; x: number; y: number; r: number;
    isActive: boolean; isVisible: boolean;
    onPress: () => void;
}) => {
    const size = r * 2;
    const isVideo = film.type === 'video';
    const countdownLabel = useFilmCountdown(film.createdAt);
    const isExpired = countdownLabel === 'Expired';

    const tap = Gesture.Tap()
        .maxDuration(250)
        .onEnd(() => { runOnJS(onPress)(); });

    return (
        <>
            <GestureDetector gesture={tap}>
                <Animated.View style={[
                    styles.bubble,
                    {
                        left: x - r, top: y - r,
                        width: size, height: size, borderRadius: r,
                        borderWidth: isActive ? 2.5 : 1,
                        borderColor: isActive ? COLORS.primary : 'rgba(67,61,53,0.18)',
                        shadowOpacity: isActive ? 0.25 : 0.1,
                        shadowRadius: isActive ? 16 : 8,
                        opacity: isExpired ? 0.4 : 1,
                    },
                ]}>
                    <FilmMedia
                        uri={film.uri}
                        type={isVideo ? 'video' : 'image'}
                        isPlaying={isActive && isVideo}
                        accent={COLORS.primary}
                        resizeMode="cover"
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.22)']}
                        style={[StyleSheet.absoluteFill, { borderRadius: r }]}
                        pointerEvents="none"
                    />
                    {isActive && (
                        <View style={[styles.activeDot, { backgroundColor: COLORS.primary }]} />
                    )}
                </Animated.View>
            </GestureDetector>
            <View
                style={[styles.timestampHolder, { left: x - 44, top: y + r + 7 }]}
                pointerEvents="none"
            >
                <Text style={[
                    styles.timestampText,
                    isExpired && { color: 'rgba(180,60,60,0.65)' },
                ]}>
                    {countdownLabel}
                </Text>
            </View>
        </>
    );
});
FilmBubble.displayName = 'FilmBubble';

// ── Main ───────────────────────────────────────────────────────
export default function UserFilms() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { userId, userName, dominantColor } = useLocalSearchParams<{
        userId: string; userName: string; dominantColor?: string;
    }>();

    const accent = dominantColor
        ? decodeURIComponent(dominantColor as string)
        : COLORS.primary;

    const [films, setFilms] = useState<FilmItemExtended[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeIdx, setActiveIdx] = useState(0);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalIndex, setModalIndex] = useState(0);

    const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recordedIds = useRef<Set<string>>(new Set());
    const currentUserId = useRef<string | null>(null);

    const clearViewTimer = () => {
        if (viewTimerRef.current) { clearTimeout(viewTimerRef.current); viewTimerRef.current = null; }
    };
    const recordView = async (filmId: string, creatorId: string) => {
        if (recordedIds.current.has(filmId)) return;
        const uid = currentUserId.current;
        if (!uid || uid === creatorId) return;
        try {
            await supabase.from('film_views').upsert(
                { film_id: filmId, viewer_id: uid },
                { onConflict: 'film_id,viewer_id', ignoreDuplicates: true }
            );
            recordedIds.current.add(filmId);
        } catch { }
    };
    const startViewTimer = useCallback((film: FilmItemExtended) => {
        clearViewTimer();
        viewTimerRef.current = setTimeout(
            () => recordView(film.id, film.creatorId),
            VIEW_THRESHOLD_MS
        );
    }, []);

    useEffect(() => {
        if (!userId) return;
        (async () => {
            setIsLoading(true);
            const { data: sd } = await supabase.auth.getSession();
            currentUserId.current = sd?.session?.user?.id ?? null;

            const { data: fd, error } = await supabase
                .from('films')
                .select('id, type, uri, thumbnail, created_at, creator_id')
                .eq('creator_id', userId)
                .order('created_at', { ascending: true });
            if (error || !fd?.length) { setIsLoading(false); return; }

            const ids = fd.map(f => f.id);

            const { data: vd } = await supabase
                .from('film_views')
                .select('film_id, viewer_id, profiles:viewer_id(id, name, profile_picture, unique_user_id, dominant_color, relationship)')
                .in('film_id', ids);

            const viewersByFilm: Record<string, Profile[]> = {};
            (vd || []).forEach((v: any) => {
                if (!v.profiles) return;
                if (!viewersByFilm[v.film_id]) viewersByFilm[v.film_id] = [];
                if (!viewersByFilm[v.film_id].some(p => p.id === v.profiles.id))
                    viewersByFilm[v.film_id].push({
                        id: v.profiles.id,
                        uniqueUserId: v.profiles.unique_user_id,
                        name: v.profiles.name,
                        profilePicture: v.profiles.profile_picture,
                        dominantColor: v.profiles.dominant_color || '#D4A373',
                        relationship: v.profiles.relationship ?? undefined,
                    });
            });

            const { data: ld } = await supabase
                .from('film_likes')
                .select('film_id, user_id')
                .in('film_id', ids);
            const likedByFilm: Record<string, Set<string>> = {};
            (ld || []).forEach((l: any) => {
                if (!likedByFilm[l.film_id]) likedByFilm[l.film_id] = new Set();
                likedByFilm[l.film_id].add(l.user_id);
            });

            setFilms(fd.map(f => ({
                id: f.id,
                creatorId: f.creator_id,
                type: f.type as 'image' | 'video',
                uri: f.uri,
                thumbnail: f.thumbnail ?? undefined,
                isPublic: true,
                targetUserId: null,
                createdAt: f.created_at,
                viewers: viewersByFilm[f.id] || [],
                likedByIds: likedByFilm[f.id] || new Set(),
            })));
            setIsLoading(false);
        })();
    }, [userId]);

    useEffect(() => { return () => clearViewTimer(); }, []);
    useEffect(() => {
        if (films.length === 0) return;
        Promise.all([0, 1, 2].map(i => extractColor(i))).then(() => updateBg(0));
        if (films[0]) startViewTimer(films[0]);
    }, [films]);

    // ── Dynamic background crossfade ───────────────────────────
    const bgAnim = useRef(new RNAnimated.Value(0)).current;
    const colorCache = useRef<Record<string, string[]>>({});
    const [bgColors, setBgColors] = useState<[string, string, string]>([
        rgba(accent, 0.92), rgba(accent, 0.78), rgba(accent, 0.55),
    ]);
    const [prevBgColors, setPrevBgColors] = useState<[string, string, string]>([
        rgba(accent, 0.92), rgba(accent, 0.78), rgba(accent, 0.55),
    ]);

    const extractColor = useCallback(async (idx: number) => {
        const film = films[idx];
        if (!film) return null;
        if (colorCache.current[film.id]) return colorCache.current[film.id];
        try {
            let uri = film.uri;
            if (film.type === 'video') {
                const t = await VideoThumbnails.getThumbnailAsync(film.uri, { time: 500 });
                uri = t.uri;
            }
            const small = await ImageManipulator.manipulateAsync(uri,
                [{ resize: { width: 100 } }],
                { format: ImageManipulator.SaveFormat.JPEG, compress: 0.6 });
            const res = await getColors(small.uri, { fallback: accent, cache: true, quality: 'low' });
            let dominant = accent;
            if (res.platform === 'android') dominant = res.vibrant || res.dominant || res.average || accent;
            else if (res.platform === 'ios') dominant = res.primary || res.detail || res.background || accent;
            const result: [string, string, string] = [
                rgba(dominant, 0.95), rgba(dominant, 0.75), rgba(dominant, 0.45),
            ];
            colorCache.current[film.id] = result;
            return result;
        } catch {
            return [rgba(accent, 0.8), rgba(accent, 0.6), rgba(accent, 0.4)] as [string, string, string];
        }
    }, [accent, films]);

    const updateBg = useCallback(async (idx: number) => {
        const film = films[idx];
        if (!film) return;
        const cached = colorCache.current[film.id];
        const colors = (cached || await extractColor(idx)) as [string, string, string] | null;
        if (!colors) return;
        setPrevBgColors(bgColors);
        setBgColors(colors);
        bgAnim.setValue(0);
        RNAnimated.timing(bgAnim, { toValue: 1, duration: cached ? 500 : 800, useNativeDriver: false }).start();
        if (idx + 1 < films.length) extractColor(idx + 1);
        if (idx - 1 >= 0) extractColor(idx - 1);
    }, [bgColors, bgAnim, films, extractColor]);

    // ── Stable layouts ─────────────────────────────────────────
    const decoItems = useMemo(() => buildDecoCircleLayout(40, 15, 40, 99), []);
    const cardPositions = useMemo(() =>
        buildCardLayout(films.length, BUBBLE_R_MAX * 2, BUBBLE_R_MAX * 2, 42),
        [films.length]
    );
    const bubbleRadii = useMemo(() => buildBubbleRadii(films.length), [films.length]);

    const latestFilmPos = cardPositions.length > 0
        ? cardPositions[cardPositions.length - 1]
        : undefined;

    // ── Header ─────────────────────────────────────────────────
    const Header = useMemo(() => (
        <View style={[styles.header, { paddingTop: insets.top + 32 }]} pointerEvents="box-none">
            <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
                style={[styles.backBtn, { top: insets.top + 14 }]}
            >
                <Ionicons name="chevron-back" size={24} color="#433D35" />
            </Pressable>
            <View style={styles.headerCenter} pointerEvents="none">
                <Text style={styles.hSub}>watching films of</Text>
                <Text style={styles.hName} numberOfLines={1}>{userName}</Text>
                <DoodleUnderline color="#433D35" width={Math.min((userName?.length ?? 6) * 14 + 20, 260)} />
            </View>
        </View>
    ), [insets.top, userName]);

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: rgba(accent, 0.18) }]}>
                <ActivityIndicator size="large" color={accent} />
            </View>
        );
    }

    if (films.length === 0) {
        return (
            <GestureHandlerRootView style={{ flex: 1 }}>
                <FilmCanvas
                    bgColors={[rgba(accent, 0.92), rgba(accent, 0.72), rgba(accent, 0.45)]}
                    decoItems={decoItems}
                    cardPositions={[]}
                    defaultScale={DEF_SC}
                    overlay={
                        <>
                            <View style={styles.emptyOverlay} pointerEvents="none">
                                <Ionicons name="film-outline" size={44} color="rgba(67,61,53,0.25)" />
                                <Text style={styles.emptyTitle}>No Films Yet</Text>
                                <Text style={styles.emptyText}>
                                    {userName || 'This user'} hasn't shared any films.
                                </Text>
                            </View>
                            {Header}
                        </>
                    }
                >
                    {() => null}
                </FilmCanvas>
            </GestureHandlerRootView>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            {/* Animated bg crossfade */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <RNAnimated.View style={[StyleSheet.absoluteFill, {
                    opacity: bgAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                }]}>
                    <LinearGradient colors={prevBgColors} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
                </RNAnimated.View>
                <RNAnimated.View style={[StyleSheet.absoluteFill, { opacity: bgAnim }]}>
                    <LinearGradient colors={bgColors} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
                </RNAnimated.View>
            </View>

            {/* Canvas — transparent bg */}
            <FilmCanvas
                bgColors={['transparent', 'transparent', 'transparent']}
                decoItems={decoItems}
                cardPositions={cardPositions}
                defaultScale={DEF_SC}
                initialFocusPosition={latestFilmPos}
                overlay={Header}
            >
                {({ visibleIndices }) =>
                    films.map((film, i) => {
                        if (!visibleIndices.includes(i)) return null;
                        const p = cardPositions[i];
                        const r = bubbleRadii[i] ?? BUBBLE_R_MIN;
                        return (
                            <FilmBubble
                                key={film.id}
                                film={film}
                                x={p.x} y={p.y} r={r}
                                isActive={i === activeIdx}
                                isVisible={visibleIndices.includes(i)}
                                onPress={() => {
                                    setActiveIdx(i);
                                    updateBg(i);
                                    startViewTimer(film);
                                    setModalIndex(i);
                                    setModalVisible(true);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                }}
                            />
                        );
                    })
                }
            </FilmCanvas>

            {/* Story modal */}
            <FilmStoryModal
                films={films}
                initialIndex={modalIndex}
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
            />
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bubble: {
        position: 'absolute',
        overflow: 'hidden',
        backgroundColor: '#e8e7e4',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    activeDot: {
        position: 'absolute',
        top: 6, right: 6,
        width: 9, height: 9,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: '#fff',
    },
    header: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 200,
        alignItems: 'center',
        paddingBottom: 10,
    },
    backBtn: {
        position: 'absolute',
        left: 16,
        width: 36, height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 201,
    },
    headerCenter: { alignItems: 'center', paddingHorizontal: 64 },
    hSub: {
        fontFamily: FONTS.bold,
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 3,
        textTransform: 'uppercase',
        marginBottom: 4,
        color: rgba('#433D35', 0.65),
    },
    hName: {
        fontFamily: 'DancingScript-Bold',
        fontSize: 36,
        lineHeight: 40,
        color: '#433D35',
    },
    emptyOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        zIndex: 10,
    },
    emptyTitle: {
        fontFamily: FONTS.bold,
        fontSize: 17,
        color: COLORS.primary,
        opacity: 0.7,
        marginTop: 8,
    },
    emptyText: {
        fontFamily: FONTS.regular,
        fontSize: 13,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 40,
    },
    timestampHolder: {
        position: 'absolute',
        width: 90,
        alignItems: 'center',
    },
    timestampText: {
        fontFamily: FONTS.bold,
        fontSize: 10,
        color: 'rgba(67,61,53,0.55)',
        letterSpacing: 0.4,
        textShadowColor: 'rgba(255,255,255,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
});