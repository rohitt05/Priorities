/**
 * myFilmOfTheDay.tsx — Free Canvas Film Map (circle bubbles, same as UserFilms)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    StyleSheet, View, Text, Pressable,
    Dimensions, Animated as RNAnimated, Platform,
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
import { Profile, Film } from '@/types/domain';
import { getColors } from 'react-native-image-colors';
import * as VideoThumbnails from 'expo-video-thumbnails';
import Animated, {
    useSharedValue, useAnimatedStyle, withSpring, withTiming,
    interpolate, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
    FilmCanvas,
    buildCardLayout,
    buildDecoCircleLayout,
    rgba,
} from '@/features/film-my-day/components/canvas';

const { width: SW, height: SH } = Dimensions.get('window');

const BUBBLE_R_MIN = 35;
const BUBBLE_R_MAX = 100;
// Slightly zoomed out — latest film visible but neighbouring bubbles also in frame
const DEF_SC = (SW * 0.48) / (BUBBLE_R_MAX * 2);
const VIEW_THRESHOLD_MS = 2000;

// ── Seeded radii (must match buildCardLayout seed 77) ─────────
function buildBubbleRadii(count: number): number[] {
    let s = 77;
    const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    // skip the positions consumed inside buildCardLayout
    // radii are derived independently from count
    let rs = 42; // separate seed for radii
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

// Relative time label rendered below each bubble
function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return days === 1 ? 'yesterday' : `${days}d ago`;
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

// ── Viewer overlay — scattered avatars on visible screen ───────
interface ViewerOverlayProps {
    viewers: Profile[];
    likedByIds: Set<string>;
    visible: boolean;
    onDismiss: () => void;
}

// Ring layout around screen center — avatars are AROUND the film, never on it.
// Min radius (130px) > largest possible bubble screen radius at DEF_SC (~93px).
function buildAvatarRingPositions(count: number): { x: number; y: number }[] {
    if (count === 0) return [];
    const cx = SW / 2;
    const cy = SH / 2;
    const INNER_R = 140; // clear of the film bubble
    const OUTER_R = 210; // max spread
    return Array.from({ length: count }, (_, i) => {
        // Evenly spaced angle, start from top (−π/2)
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        // Alternate inner/outer radii for a natural scattered-ring feel
        const radius = i % 2 === 0 ? INNER_R : OUTER_R;
        return {
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
        };
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
            // No spring — clean, instant iOS-style pop-in
            scale.value = withTiming(1, { duration: 160 });
            opacity.value = withTiming(1, { duration: 160 });
        }, delay);
        return () => clearTimeout(timer);
    }, []);

    const style = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    // Show relationship label if set, else "Friend"
    const label = viewer.relationship || 'Friend';

    return (
        <Animated.View style={[styles.avatarItem, { left: x - AVATAR_SIZE / 2, top: y - AVATAR_SIZE / 2 }, style]}>
            {/* iOS-style: no border, real shadow */}
            <View style={styles.avatarRing}>
                <Image
                    source={{ uri: viewer.profilePicture }}
                    style={styles.avatarImg}
                />
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
    // Ring positions: avatars orbit around screen center (where the long-pressed bubble is)
    const positions = useMemo(() => buildAvatarRingPositions(viewers.length), [viewers.length]);

    useEffect(() => {
        // Fade in on hold, snap out on release
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
                // Centered pill — clearly on the dark overlay, never on the film circle
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

// ── FilmBubble ─────────────────────────────────────
const FilmBubble = React.memo(({ film, x, y, r, isActive, isVisible, onPress, onLongPress, onLongPressEnd }: {
    film: FilmItem; x: number; y: number; r: number;
    isActive: boolean; isVisible: boolean;
    onPress: () => void; onLongPress: () => void; onLongPressEnd: () => void;
}) => {
    const size = r * 2;
    const isVideo = film.mediaType === 'video';
    const timeLabel = relativeTime(film.timestamp);

    const longPress = Gesture.LongPress()
        .minDuration(400)
        // Allow 50px of finger wiggle — prevents canvas pan from killing the hold
        .maxDistance(50)
        .onStart(() => {
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
            runOnJS(onLongPress)();
        })
        // onFinalize fires in ALL terminal states (lift, cancel, system interrupt)
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
            {/* Timestamp label in canvas space, below the bubble */}
            <View
                style={[styles.timestampHolder, { left: x - 40, top: y + r + 7 }]}
                pointerEvents="none"
            >
                <Text style={styles.timestampText}>{timeLabel}</Text>
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
            await supabase.from('film_views').insert({ film_id: filmId, viewer_id: uid });
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
                .from('films').select('*')
                .eq('creator_id', uid).order('created_at', { ascending: true });
            if (error || !fd?.length) { setIsLoading(false); return; }

            const ids = fd.map(f => f.id);

            const { data: vd } = await supabase
                .from('film_views')
                // Also fetch relationship so we can show e.g. "GF", "Bro", fallback "Friend"
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

            setFilms(fd.map(f => ({
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

    // ── Dynamic background ─────────────────────────────────────
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

    // ── Stable layouts ─────────────────────────────────────────
    const decoItems = useMemo(() => buildDecoCircleLayout(40, 15, 40, 99), []);
    const cardPositions = useMemo(() =>
        buildCardLayout(films.length, BUBBLE_R_MAX * 2, BUBBLE_R_MAX * 2, 42),
        [films.length]
    );
    const bubbleRadii = useMemo(() => buildBubbleRadii(films.length), [films.length]);

    // Latest film (last in ascending order) — center canvas on open
    const latestFilmPos = cardPositions.length > 0
        ? cardPositions[cardPositions.length - 1]
        : undefined;

    const activeFilm = films[activeIdx];
    const { weekday, date } = useMemo(() =>
        fmtDate(activeFilm?.timestamp || new Date().toISOString()),
        [activeFilm]
    );

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

    // ── Empty state ────────────────────────────────────────────
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
                                <Text style={styles.emptyText}>Film your day and it'll appear here</Text>
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

            {/* Canvas — transparent bg so crossfade shows through */}
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
                                    setIdx(i);
                                    updateBg(i);
                                    startViewTimer(film);
                                    setShowViewers(false);
                                    // Open full-screen story view on tap
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

            {/* Viewer overlay — rendered outside canvas, covers full screen */}
            <ViewerOverlay
                viewers={activeFilm?.viewers ?? []}
                likedByIds={activeFilm?.likedByIds ?? new Set()}
                visible={showViewers}
                onDismiss={() => setShowViewers(false)}
            />

            {/* Full-screen story modal — tap on any bubble to open */}
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

    // ── Bubble ─────────────────────────────────────────────────
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

    // ── Header ─────────────────────────────────────────────────
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

    // ── Empty ──────────────────────────────────────────────────
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

    // ── Viewer overlay ─────────────────────────────────────────
    viewerOverlay: {
        zIndex: 400,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    avatarItem: {
        position: 'absolute',
        alignItems: 'center',
    },
    // iOS-style avatar: no border, just shadow
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
    avatarImg: {
        width: '100%',
        height: '100%',
    },
    heartBadge: {
        position: 'absolute',
        bottom: 16,
        right: -5,
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
    // "No viewers" — centered pill placed in screen center,
    // safely BELOW the ring avatars and away from the film bubble
    noViewersCenter: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        top: SH * 0.55, // below likely film position
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
    // Timestamp label in canvas space, rendered below each film bubble
    timestampHolder: {
        position: 'absolute',
        width: 80,
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