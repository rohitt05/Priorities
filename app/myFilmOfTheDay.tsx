/**
 * myFilmOfTheDay.tsx — Free Canvas Film Map (circle bubbles)
 * - Only shows films posted within the last 24 hours
 * - Long press to view viewers (owner only)
 * - Countdown label below each bubble
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    StyleSheet, View, Text, Pressable,
    Dimensions, Animated as RNAnimated,
    ActivityIndicator, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '@/theme/theme';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import FilmMedia from '../src/features/film-my-day/components/FilmMedia';
import FilmStoryModal from '../src/features/film-my-day/components/FilmStoryModal';
import { Profile } from '@/types/domain';
import { getColors } from 'react-native-image-colors';
import * as VideoThumbnails from 'expo-video-thumbnails';
import Animated, {
    useSharedValue, useAnimatedStyle, withTiming,
    runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
    FilmCanvas,
    buildCardLayout,
    buildDecoCircleLayout,
    rgba,
} from '@/features/film-my-day/components/canvas';
import { useFilmCountdown } from '@/features/film-my-day/components/filmCountdown';

const { width: SW, height: SH } = Dimensions.get('window');

const BUBBLE_R_MIN = 35;
const BUBBLE_R_MAX = 100;
const DEF_SC = (SW * 0.48) / (BUBBLE_R_MAX * 2);
const VIEW_THRESHOLD_MS = 2000;
const FILM_LIFETIME_MS = 24 * 60 * 60 * 1000;

// Filter helper — only keep films within 24 hrs
function isWithin24hrs(createdAtIso: string): boolean {
    return Date.now() - new Date(createdAtIso).getTime() < FILM_LIFETIME_MS;
}

function buildBubbleRadii(count: number): number[] {
    let rs = 42;
    const randR = () => { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; };
    return Array.from({ length: count }, () =>
        BUBBLE_R_MIN + randR() * (BUBBLE_R_MAX - BUBBLE_R_MIN)
    );
}

function fmtDate(iso: string) {
    const d = new Date(iso);
    return {
        weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
        date: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
}

interface FilmItem {
    id: string;
    mediaUrl: string;
    mediaType: string;
    timestamp: string;
    viewers: Profile[];
    likedByIds: Set<string>;
    creatorId: string;
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

// ── Viewer overlay ─────────────────────────────────────────────
interface ViewerOverlayProps {
    viewers: Profile[];
    likedByIds: Set<string>;
    visible: boolean;
    onDismiss: () => void;
}

function buildAvatarRingPositions(count: number): { x: number; y: number }[] {
    if (count === 0) return [];
    const cx = SW / 2;
    const cy = SH / 2;
    const INNER_R = 140;
    const OUTER_R = 210;
    return Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const radius = i % 2 === 0 ? INNER_R : OUTER_R;
        return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
}

const AVATAR_SIZE = 52;

const ViewerAvatar = React.memo(({ viewer, hasLiked, x, y, delay }: {
    viewer: Profile; hasLiked: boolean; x: number; y: number; delay: number;
}) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            scale.value = withTiming(1, { duration: 160 });
            opacity.value = withTiming(1, { duration: 160 });
        }, delay);
        return () => clearTimeout(timer);
    }, []);

    const style = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const label = viewer.relationship || 'Friend';

    return (
        <Animated.View style={[styles.avatarItem, { left: x - AVATAR_SIZE / 2, top: y - AVATAR_SIZE / 2 }, style]}>
            <View style={styles.avatarRing}>
                <Image source={{ uri: viewer.profilePicture }} style={styles.avatarImg} />
            </View>
            {hasLiked && (
                <View style={styles.heartBadge}>
                    <Text style={{ fontSize: 10 }}>❤️</Text>
                </View>
            )}
            <Text style={styles.avatarName} numberOfLines={1}>{label}</Text>
        </Animated.View>
    );
});
ViewerAvatar.displayName = 'ViewerAvatar';

const ViewerOverlay = React.memo(({ viewers, likedByIds, visible, onDismiss }: ViewerOverlayProps) => {
    const bgOpacity = useSharedValue(0);
    const positions = useMemo(() => buildAvatarRingPositions(viewers.length), [viewers.length]);

    useEffect(() => {
        bgOpacity.value = withTiming(visible ? 1 : 0, { duration: visible ? 260 : 100 });
    }, [visible]);

    const bgStyle = useAnimatedStyle(() => ({
        opacity: bgOpacity.value,
        pointerEvents: visible ? 'auto' : 'none',
    }));

    if (!visible && bgOpacity.value === 0) return null;

    return (
        <Animated.View style={[StyleSheet.absoluteFill, styles.viewerOverlay, bgStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
            {viewers.length === 0 ? (
                <View style={styles.noViewersCenter} pointerEvents="none">
                    <View style={styles.noViewersPill}>
                        <Ionicons name="eye-off-outline" size={18} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.noViewersText}>No viewers yet</Text>
                    </View>
                </View>
            ) : (
                viewers.map((v, i) => (
                    <ViewerAvatar
                        key={v.id}
                        viewer={v}
                        hasLiked={likedByIds.has(v.id)}
                        x={positions[i]?.x ?? SW / 2}
                        y={positions[i]?.y ?? SH / 2}
                        delay={i * 35}
                    />
                ))
            )}
        </Animated.View>
    );
});
ViewerOverlay.displayName = 'ViewerOverlay';

// ── FilmBubble ─────────────────────────────────────────────────
const FilmBubble = React.memo(({ film, x, y, r, isActive, onPress, onLongPress, onLongPressEnd }: {
    film: FilmItem; x: number; y: number; r: number;
    isActive: boolean;
    onPress: () => void; onLongPress: () => void; onLongPressEnd: () => void;
}) => {
    const size = r * 2;
    const isVideo = film.mediaType === 'video';
    const countdownLabel = useFilmCountdown(film.timestamp);

    const longPress = Gesture.LongPress()
        .minDuration(400)
        .maxDistance(50)
        .onStart(() => {
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
            runOnJS(onLongPress)();
        })
        .onFinalize(() => { runOnJS(onLongPressEnd)(); });

    const tap = Gesture.Tap()
        .maxDuration(250)
        .onEnd(() => { runOnJS(onPress)(); });

    const gesture = Gesture.Exclusive(longPress, tap);

    return (
        <>
            <GestureDetector gesture={gesture}>
                <Animated.View style={[
                    styles.bubble,
                    {
                        left: x - r, top: y - r,
                        width: size, height: size, borderRadius: r,
                        borderWidth: isActive ? 2.5 : 1,
                        borderColor: isActive ? COLORS.primary : 'rgba(67,61,53,0.18)',
                        shadowOpacity: isActive ? 0.25 : 0.1,
                        shadowRadius: isActive ? 16 : 8,
                    },
                ]}>
                    <FilmMedia
                        uri={film.mediaUrl}
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
                <Text style={styles.timestampText}>{countdownLabel}</Text>
            </View>
        </>
    );
});
FilmBubble.displayName = 'FilmBubble';

// ── Main ───────────────────────────────────────────────────────
export default function MyFilmOfTheDay() {
    const router = useRouter();
    const { color: colorParam } = useLocalSearchParams<{ color?: string }>();
    const insets = useSafeAreaInsets();
    const accent = (colorParam as string) || COLORS.primary;

    const [films, setFilms] = useState<FilmItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeIdx, setIdx] = useState(0);
    const [showViewers, setShowViewers] = useState(false);
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
    const startViewTimer = useCallback((film: FilmItem) => {
        clearViewTimer();
        viewTimerRef.current = setTimeout(() => recordView(film.id, film.creatorId), VIEW_THRESHOLD_MS);
    }, []);

    useEffect(() => {
        (async () => {
            const { data: sd } = await supabase.auth.getSession();
            const uid = sd?.session?.user?.id;
            if (!uid) { setIsLoading(false); return; }
            currentUserId.current = uid;

            const { data: fd, error } = await supabase
                .from('films')
                .select('*')
                .eq('creator_id', uid)
                // Only fetch films from the last 24 hrs at DB level too
                .gte('created_at', new Date(Date.now() - FILM_LIFETIME_MS).toISOString())
                .order('created_at', { ascending: true });
            if (error || !fd?.length) { setIsLoading(false); return; }

            // Double-filter on client side (clock drift safety)
            const recent = fd.filter(f => isWithin24hrs(f.created_at));
            if (!recent.length) { setIsLoading(false); return; }

            const ids = recent.map(f => f.id);

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
                        id: v.profiles.id, uniqueUserId: v.profiles.unique_user_id,
                        name: v.profiles.name, profilePicture: v.profiles.profile_picture,
                        dominantColor: v.profiles.dominant_color || '#D4A373',
                        relationship: v.profiles.relationship ?? undefined,
                    });
            });

            const { data: ld } = await supabase
                .from('film_likes').select('film_id, user_id').in('film_id', ids);
            const likedByFilm: Record<string, Set<string>> = {};
            (ld || []).forEach((l: any) => {
                if (!likedByFilm[l.film_id]) likedByFilm[l.film_id] = new Set();
                likedByFilm[l.film_id].add(l.user_id);
            });

            setFilms(recent.map(f => ({
                id: f.id, mediaUrl: f.uri, mediaType: f.type,
                timestamp: f.created_at, creatorId: f.creator_id,
                viewers: viewersByFilm[f.id] || [],
                likedByIds: likedByFilm[f.id] || new Set(),
            })));
            setIsLoading(false);
        })();
    }, []);

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
            let uri = film.mediaUrl;
            if (film.mediaType === 'video') {
                const t = await VideoThumbnails.getThumbnailAsync(film.mediaUrl, { time: 500 });
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

    const decoItems = useMemo(() => buildDecoCircleLayout(40, 15, 40, 99), []);
    const cardPositions = useMemo(() =>
        buildCardLayout(films.length, BUBBLE_R_MAX * 2, BUBBLE_R_MAX * 2, 42),
        [films.length]
    );
    const bubbleRadii = useMemo(() => buildBubbleRadii(films.length), [films.length]);

    const latestFilmPos = cardPositions.length > 0
        ? cardPositions[cardPositions.length - 1]
        : undefined;

    const activeFilm = films[activeIdx];
    const { weekday, date } = useMemo(() =>
        fmtDate(activeFilm?.timestamp || new Date().toISOString()),
        [activeFilm]
    );

    const Header = useMemo(() => (
        <View style={[styles.header, { paddingTop: insets.top + 32 }]} pointerEvents="box-none">
            <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
                style={[styles.backBtn, { top: insets.top + 14 }]}
            >
                <Ionicons name="chevron-back" size={24} color="#433D35" />
            </Pressable>
            <View style={styles.headerCenter} pointerEvents="none">
                <Text style={styles.hSub}>Films of my day</Text>
                <Text style={styles.hWeekday} numberOfLines={1}>{weekday}</Text>
                <DoodleUnderline color="#433D35" width={180} />
                <Text style={styles.hDate} numberOfLines={1}>{date}</Text>
            </View>
        </View>
    ), [insets.top, weekday, date]);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={accent} />
            </View>
        );
    }

    // ── Empty state — no films posted today ────────────────────
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
                                <Ionicons name="film-outline" size={48} color="rgba(67,61,53,0.22)" />
                                <Text style={styles.emptyTitle}>No films today</Text>
                                <Text style={styles.emptyText}>
                                    You haven't posted any films today.{'\n'}Go on, post some! 🎞️
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
                                onPress={() => {
                                    setIdx(i);
                                    updateBg(i);
                                    startViewTimer(film);
                                    setShowViewers(false);
                                    setModalIndex(i);
                                    setModalVisible(true);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                }}
                                onLongPress={() => {
                                    setIdx(i);
                                    setShowViewers(true);
                                }}
                                onLongPressEnd={() => setShowViewers(false)}
                            />
                        );
                    })
                }
            </FilmCanvas>

            <ViewerOverlay
                viewers={activeFilm?.viewers ?? []}
                likedByIds={activeFilm?.likedByIds ?? new Set()}
                visible={showViewers}
                onDismiss={() => setShowViewers(false)}
            />

            <FilmStoryModal
                films={films.map(f => ({
                    id: f.id,
                    creatorId: f.creatorId,
                    type: f.mediaType as 'image' | 'video',
                    uri: f.mediaUrl,
                    isPublic: true,
                    targetUserId: null,
                    createdAt: f.timestamp,
                }))}
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
        backgroundColor: '#FBFAF6',
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
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 4,
        textTransform: 'uppercase',
        marginBottom: 6,
        color: rgba('#433D35', 0.8),
    },
    hWeekday: {
        fontFamily: 'DancingScript-Bold',
        fontSize: 36,
        lineHeight: 40,
        color: '#433D35',
    },
    hDate: {
        fontFamily: FONTS.bold,
        fontSize: 12.5,
        fontWeight: '900',
        letterSpacing: 0.5,
        marginTop: 1.5,
        color: rgba('#433D35', 0.9),
    },
    emptyOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        zIndex: 10,
    },
    emptyTitle: {
        fontFamily: 'DancingScript-Bold',
        fontSize: 30,
        color: '#433D35',
        opacity: 0.75,
        marginTop: 10,
    },
    emptyText: {
        fontFamily: FONTS.regular,
        fontSize: 14,
        color: rgba('#433D35', 0.6),
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 48,
    },
    viewerOverlay: {
        zIndex: 400,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    avatarItem: {
        position: 'absolute',
        alignItems: 'center',
    },
    avatarRing: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        overflow: 'hidden',
        backgroundColor: '#e0ddd8',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
        elevation: 8,
    },
    avatarImg: { width: '100%', height: '100%' },
    heartBadge: {
        position: 'absolute',
        bottom: 16, right: -5,
        width: 20, height: 20,
        borderRadius: 10,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
        elevation: 3,
    },
    avatarName: {
        fontFamily: FONTS.bold,
        fontSize: 11,
        color: '#fff',
        textAlign: 'center',
        marginTop: 6,
        letterSpacing: 0.2,
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 5,
    },
    noViewersCenter: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        top: SH * 0.55,
    },
    noViewersPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.12)',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
    },
    noViewersText: {
        fontFamily: FONTS.bold,
        fontSize: 13.5,
        color: 'rgba(255,255,255,0.75)',
        letterSpacing: 0.3,
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