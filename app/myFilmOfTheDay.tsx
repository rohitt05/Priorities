/**
 * myFilmOfTheDay.tsx — Film Map
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    StyleSheet, View, Text, Pressable,
    Dimensions, Animated as RNAnimated, Platform,
    ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, Fontisto } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '@/theme/theme';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import Animated, {
    useAnimatedStyle, useSharedValue, withSpring, runOnJS, clamp,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import FilmMedia from '../src/features/film-my-day/components/FilmMedia';
import ZoomableMediaCard from '../src/features/film-my-day/components/ZoomableMediaCard';
import FilmViewerList from '../src/features/film-my-day/components/FilmViewerList';
import { getColors } from 'react-native-image-colors';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { BlurView } from 'expo-blur';

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_W = 200;
const CARD_H = 270;
const CELL = 22;
const MIN_SC = 0.12;
const MAX_SC = 3.5;
const DEF_SC = (SW * 0.8) / CARD_W;
const COLS = 3;
const ROW_H = 420;
const CANVAS_W = 1400;
const WINDOW = 3;

function hexRgb(hex: string) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgba(hex: string, a: number) {
    const { r, g, b } = hexRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
}
function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtDate(iso: string) {
    const d = new Date(iso);
    return {
        weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
        date: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
}

function buildLayout(count: number) {
    const margin = 160;
    const step = (CANVAS_W - margin * 2 - CARD_W) / (COLS - 1);
    const xs = [margin, margin + step, margin + step * 2];
    const startY = -60;
    return Array.from({ length: count }, (_, i) => {
        const row = Math.floor(i / COLS);
        const col = i % COLS;
        const colIdx = row % 2 === 1 ? COLS - 1 - col : col;
        const dx = Math.sin(i * 1.5) * 80;
        const dy = Math.cos(i * 0.8) * 40;
        return { x: xs[colIdx] - CANVAS_W / 2 + dx, y: startY + i * ROW_H + dy };
    });
}

function buildPath(pts: { x: number; y: number }[]) {
    if (pts.length < 2) return '';
    const cx = (p: { x: number }) => p.x + 12;
    const cy = (p: { y: number }) => p.y;
    let d = `M ${cx(pts[0])} ${cy(pts[0])}`;
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const distY = cy(b) - cy(a);
        const distX = cx(b) - cx(a);
        d += ` C ${cx(a) + distX * 0.15} ${cy(a) + distY * 0.75}, ${cx(b) - distX * 0.15} ${cy(b) - distY * 0.75}, ${cx(b)} ${cy(b)}`;
    }
    return d;
}

function makeCentre(idx: number, positions: { x: number; y: number }[], sc: number) {
    const p = positions[idx];
    if (!p) return { tx: 0, ty: 0 }; // ✅ safe guard
    return { tx: -(p.x - CARD_W / 2) * sc, ty: -(p.y + CARD_H / 2) * sc };
}

const ScreenGrid = React.memo(({ accent }: { accent: string }) => {
    const lc = rgba('#433D35', 0.15);
    const cols = Math.ceil(SW / CELL) + 1;
    const rows = Math.ceil(SH / CELL) + 1;
    const lines: React.ReactNode[] = [];
    for (let r = 0; r <= rows; r++)
        lines.push(<Line key={`h${r}`} x1={0} y1={r * CELL} x2={SW} y2={r * CELL} stroke={lc} strokeWidth={1.2} />);
    for (let c = 0; c <= cols; c++)
        lines.push(<Line key={`v${c}`} x1={c * CELL} y1={0} x2={c * CELL} y2={SH} stroke={lc} strokeWidth={1.2} />);
    return <Svg width={SW} height={SH} style={StyleSheet.absoluteFill} pointerEvents="none">{lines}</Svg>;
});
ScreenGrid.displayName = 'ScreenGrid';

const RouteLayer = React.memo(({ path, positions, accent, cw, ch, originX, originY }: {
    path: string; positions: { x: number; y: number }[];
    accent: string; cw: number; ch: number; originX: number; originY: number;
}) => (
    <Svg width={cw} height={ch} style={{ position: 'absolute', left: originX, top: originY }} pointerEvents="none">
        <Path d={path} stroke={rgba('#433D35', 0.12)} strokeWidth={12} fill="none" strokeLinecap="round" />
        <Path d={path} stroke={rgba('#433D35', 0.45)} strokeWidth={3} fill="none" strokeDasharray="0.1, 12" strokeLinecap="round" />
        {positions.slice(0, -1).map((p, i) => {
            const next = positions[i + 1];
            const cxA = (p.x + 12) - originX, cyA = p.y - originY;
            const cxB = (next.x + 12) - originX, cyB = next.y - originY;
            return [0.25, 0.5, 0.75].map(t => (
                <Circle key={`deco-ring-${i}-${t}`}
                    cx={cxA + (cxB - cxA) * t} cy={cyA + (cyB - cyA) * t}
                    r={6 + t * 2} stroke={'#433D35'} strokeWidth={0.6} fill="none" opacity={0.15 - t * 0.05} />
            ));
        })}
        <Path d={path} stroke={rgba('#433D35', 0.3)} strokeWidth={0.6} fill="none" />
        {positions.map((p, i) => {
            const cx = (p.x + 12) - originX, cy = p.y - originY;
            return (
                <React.Fragment key={i}>
                    <Circle cx={cx} cy={cy} r={24} stroke={'#433D35'} strokeWidth={0.35} fill="none" opacity={0.06} />
                    <Circle cx={cx} cy={cy} r={12} stroke={rgba('#433D35', 0.15)} strokeWidth={0.8} fill="none" />
                    <Circle cx={cx} cy={cy} r={4.5} fill="white" stroke={'#433D35'} strokeWidth={2} />
                </React.Fragment>
            );
        })}
    </Svg>
));
RouteLayer.displayName = 'RouteLayer';

const DoodleUnderline = React.memo(({ color, width = 160 }: { color: string; width?: number }) => (
    <Svg width={width} height={14} viewBox={`0 0 ${width} 14`} style={{ marginTop: -5, opacity: 0.85 }}>
        <Path d={`M${width * 0.03} 7C${width * 0.2} 5 ${width * 0.4} 6 ${width * 0.6} 7C${width * 0.8} 8 ${width * 0.95} 5 ${width * 0.98} 6`} stroke={color} strokeWidth={2.8} strokeLinecap="round" fill="none" />
        <Path d={`M${width * 0.08} 10C${width * 0.3} 9 ${width * 0.5} 10 ${width * 0.7} 11C${width * 0.9} 12 ${width * 0.95} 9 ${width * 0.92} 8`} stroke={color} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.65} />
        <Path d={`M${width * 0.2} 12C${width * 0.4} 11 ${width * 0.6} 12 ${width * 0.8} 13`} stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none" opacity={0.4} />
    </Svg>
));
DoodleUnderline.displayName = 'DoodleUnderline';

const MediaNode = React.memo(({ item, pos, active, accent, inView, isPaused, tx, ty, sc, onPress }: {
    item: any; pos: { x: number; y: number }; active: boolean;
    accent: string; inView: boolean; isPaused: boolean;
    tx: any; ty: any; sc: any; onPress: () => void;
}) => {
    const finalX = pos.x - CARD_W;
    const finalY = pos.y;
    return (
        <View style={{ position: 'absolute', left: finalX, top: finalY }}>
            <ZoomableMediaCard width={CARD_W} height={CARD_H} pos={{ x: finalX, y: finalY }}
                isActive={active} accent={accent} tx={tx} ty={ty} sc={sc}>
                {inView ? (
                    <FilmMedia uri={item.mediaUrl} type={item.mediaType === 'video' ? 'video' : 'image'}
                        isPlaying={active && item.mediaType === 'video' && !isPaused} accent={accent} resizeMode="cover" />
                ) : (
                    <View style={[styles.placeholder, { backgroundColor: rgba('#433D35', 0.1) }]} />
                )}
                {active && <View style={[styles.activeDot, { backgroundColor: accent }]} />}
            </ZoomableMediaCard>
            <View style={styles.timeLabelContainer}>
                <Text style={styles.timeText}>{fmtTime(item.timestamp)}</Text>
            </View>
        </View>
    );
});
MediaNode.displayName = 'MediaNode';

const SafeBlur = ({ intensity, tint, style, children }: any) => {
    const [isReady, setIsReady] = useState(false);
    useEffect(() => { const t = setTimeout(() => setIsReady(true), 150); return () => clearTimeout(t); }, []);
    if (!isReady || Platform.OS === 'android')
        return <View style={[style, { backgroundColor: 'rgba(255,255,255,0.32)' }]}>{children}</View>;
    return <BlurView intensity={intensity} tint={tint} style={style}>{children}</BlurView>;
};

export default function MyFilmOfTheDay() {
    const router = useRouter();
    const { color: colorParam } = useLocalSearchParams<{ color?: string }>();
    const insets = useSafeAreaInsets();
    const accent = (colorParam as string) || COLORS.primary;

    // ── Supabase data ──────────────────────────────────────────
    const [films, setFilms] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            const userId = sessionData?.session?.user?.id;
            if (!userId) { setIsLoading(false); return; }

            const { data, error } = await supabase
                .from('films')
                .select('*')
                .eq('creator_id', userId)
                .order('created_at', { ascending: true });

            if (error) { console.error('[MyFilms]', error); setIsLoading(false); return; }

            setFilms((data || []).map(f => ({
                id: f.id,
                mediaUrl: f.uri,
                mediaType: f.type,
                timestamp: f.created_at,
                viewers: [],
            })));
            setIsLoading(false);
        })();
    }, []);

    const positions = useMemo(() => buildLayout(films.length), [films.length]);
    const routePath = useMemo(() => buildPath(positions), [positions]);

    const { minX, minY, svgW, svgH } = useMemo(() => {
        if (positions.length === 0) return { minX: 0, minY: 0, svgW: 1, svgH: 1 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        positions.forEach(p => {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x + CARD_W); maxY = Math.max(maxY, p.y + CARD_H);
        });
        const pad = 120;
        return { minX: minX - pad, minY: minY - pad, svgW: maxX - minX + pad * 2, svgH: maxY - minY + pad * 2 };
    }, [positions]);

    const offsetPath = useMemo(() =>
        routePath.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g,
            (_, x, y) => `${(parseFloat(x) - minX).toFixed(2)} ${(parseFloat(y) - minY).toFixed(2)}`),
        [routePath, minX, minY]);

    const [activeIdx, setIdx] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [showViewers, setShowViewers] = useState(false);

    const bgAnim = useRef(new RNAnimated.Value(0)).current;
    const colorCache = useRef<Record<string, string[]>>({});
    const [bgColors, setBgColors] = useState([rgba(accent, 0.92), rgba(accent, 0.78), rgba(accent, 0.55)]);
    const [prevBgColors, setPrevBgColors] = useState([rgba(accent, 0.92), rgba(accent, 0.78), rgba(accent, 0.55)]);

    const extractColor = useCallback(async (idx: number) => {
        const film = films[idx];
        if (!film) return null;
        if (colorCache.current[film.id]) return colorCache.current[film.id];
        try {
            let mediaUri = film.mediaUrl;
            if (film.mediaType === 'video') {
                const thumb = await VideoThumbnails.getThumbnailAsync(film.mediaUrl, { time: 500 });
                mediaUri = thumb.uri;
            }
            const small = await ImageManipulator.manipulateAsync(mediaUri,
                [{ resize: { width: 100 } }], { format: ImageManipulator.SaveFormat.JPEG, compress: 0.6 });
            const res = await getColors(small.uri, { fallback: accent, cache: true, quality: 'low' });
            let dominant = accent;
            if (res.platform === 'android') dominant = res.vibrant || res.dominant || res.average || accent;
            else if (res.platform === 'ios') dominant = res.primary || res.detail || res.background || accent;
            const result = [rgba(dominant, 0.95), rgba(dominant, 0.75), rgba(dominant, 0.45)];
            colorCache.current[film.id] = result;
            return result;
        } catch { return [rgba(accent, 0.8), rgba(accent, 0.6), rgba(accent, 0.4)]; }
    }, [accent, films]);

    const updateBg = useCallback(async (idx: number) => {
        const film = films[idx];
        if (!film) return;
        const cached = colorCache.current[film.id];
        const colors = cached || await extractColor(idx);
        if (!colors) return;
        setPrevBgColors(bgColors);
        setBgColors(colors);
        bgAnim.setValue(0);
        RNAnimated.timing(bgAnim, { toValue: 1, duration: cached ? 500 : 800, useNativeDriver: false }).start();
        if (idx + 1 < films.length) extractColor(idx + 1);
        if (idx - 1 >= 0) extractColor(idx - 1);
    }, [bgColors, bgAnim, films, extractColor]);

    // ✅ Only runs after films are loaded
    useEffect(() => {
        if (films.length === 0) return;
        Promise.all([extractColor(0), extractColor(1), extractColor(2)]).then(() => updateBg(0));
    }, [films]);

    // ✅ Safe shared value init — no positions yet, defaults to 0
    const tx = useSharedValue(0);
    const ty = useSharedValue(0);
    const sc = useSharedValue(DEF_SC);
    const sTx = useSharedValue(0);
    const sTy = useSharedValue(0);
    const sSc = useSharedValue(DEF_SC);
    const pivotX = useSharedValue(0);
    const pivotY = useSharedValue(0);
    const activeIdxSV = useSharedValue(0);

    const SPRING = { damping: 30, stiffness: 180, mass: 1 };

    // ✅ Snap to first card once films/positions are ready
    useEffect(() => {
        if (films.length === 0 || positions.length === 0) return;
        const c = makeCentre(0, positions, DEF_SC);
        tx.value = withSpring(c.tx, SPRING);
        ty.value = withSpring(c.ty, SPRING);
        sTx.value = c.tx;
        sTy.value = c.ty;
    }, [films.length]);

    const closeViewers = () => { if (showViewers) setShowViewers(false); };

    const snapTo = useCallback((idx: number) => {
        if (films.length === 0) return;
        const i = Math.max(0, Math.min(films.length - 1, idx));
        const currentSc = sc.value;
        const snapSc = currentSc < 0.4 ? DEF_SC : currentSc;
        const c = makeCentre(i, positions, snapSc);
        tx.value = withSpring(c.tx, SPRING);
        ty.value = withSpring(c.ty, SPRING);
        if (Math.abs(snapSc - currentSc) > 0.01) sc.value = withSpring(snapSc, SPRING);
        activeIdxSV.value = i;
        runOnJS(setIdx)(i);
        runOnJS(updateBg)(i);
        runOnJS(setIsPaused)(false);
        runOnJS(closeViewers)();
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        sTx.value = c.tx;
        sTy.value = c.ty;
        sSc.value = snapSc;
    }, [films.length, positions, updateBg, showViewers]);

    const pan = Gesture.Pan()
        .minDistance(2)
        .onStart(() => { sTx.value = tx.value; sTy.value = ty.value; runOnJS(closeViewers)(); })
        .onUpdate(e => { tx.value = sTx.value + e.translationX; ty.value = sTy.value + e.translationY; })
        .onEnd(e => {
            sTx.value = tx.value; sTy.value = ty.value;
            const speed = Math.sqrt(e.velocityX ** 2 + e.velocityY ** 2);
            let targetIdx = activeIdx;
            if (speed > 350) {
                const vert = Math.abs(e.velocityY) > Math.abs(e.velocityX);
                targetIdx = vert
                    ? (e.velocityY < 0 ? activeIdx + 1 : activeIdx - 1)
                    : (e.velocityX < 0 ? activeIdx + 1 : activeIdx - 1);
            } else {
                const ccx = -tx.value / sc.value, ccy = -ty.value / sc.value;
                let minDist = Infinity;
                positions.forEach((p, idx) => {
                    const dx = (p.x + CARD_W / 2) - ccx, dy = (p.y + CARD_H / 2) - ccy;
                    const dist = dx * dx + dy * dy;
                    if (dist < minDist) { minDist = dist; targetIdx = idx; }
                });
            }
            runOnJS(snapTo)(targetIdx);
        });

    const pinch = Gesture.Pinch()
        .onStart(e => {
            sSc.value = sc.value; sTx.value = tx.value; sTy.value = ty.value;
            pivotX.value = e.focalX - SW / 2; pivotY.value = e.focalY - SH / 2;
            runOnJS(closeViewers)();
        })
        .onUpdate(e => {
            const next = clamp(sSc.value * e.scale, MIN_SC, MAX_SC);
            const ratio = next / sSc.value;
            sc.value = next;
            tx.value = pivotX.value * (1 - ratio) + sTx.value * ratio;
            ty.value = pivotY.value * (1 - ratio) + sTy.value * ratio;
        })
        .onEnd(() => {
            const finalSc = clamp(sc.value, MIN_SC, MAX_SC);
            sc.value = withSpring(finalSc, SPRING);
            sSc.value = finalSc; sTx.value = tx.value; sTy.value = ty.value;
        });

    const tap = Gesture.Tap().maxDuration(250).maxDistance(25).onEnd(e => {
        let tappedIdx = -1;
        for (let i = 0; i < positions.length; i++) {
            const p = positions[i];
            const csx = SW / 2 + tx.value + p.x * sc.value;
            const csy = SH / 2 + ty.value + p.y * sc.value;
            if (e.x >= csx && e.x <= csx + CARD_W * sc.value && e.y >= csy && e.y <= csy + CARD_H * sc.value) {
                tappedIdx = i; break;
            }
        }
        if (tappedIdx !== -1) {
            if (tappedIdx === activeIdxSV.value) {
                runOnJS(setIsPaused)((prev: boolean) => !prev);
                runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
            } else runOnJS(snapTo)(tappedIdx);
        } else runOnJS(closeViewers)();
    });

    const gesture = Gesture.Simultaneous(tap, pan, pinch);
    const pivotStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }],
    }));

    const activeFilm = films[activeIdx];
    const { weekday, date } = useMemo(() =>
        fmtDate(activeFilm?.timestamp || new Date().toISOString()), [activeFilm]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: '#FBFAF6', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={accent} />
            </View>
        );
    }

    if (films.length === 0) {
        return (
            <View style={{ flex: 1, backgroundColor: '#FBFAF6', justifyContent: 'center', alignItems: 'center' }}>
                <Pressable onPress={() => router.back()}
                    style={{ position: 'absolute', top: insets.top + 14, left: 16 }}>
                    <Ionicons name="chevron-back" size={24} color="#433D35" />
                </Pressable>
                <Text style={{ fontFamily: FONTS.bold, fontSize: 16, color: '#433D35', opacity: 0.6 }}>No films yet</Text>
                <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: '#433D35', opacity: 0.4, marginTop: 8 }}>
                    Film your day and it'll appear here
                </Text>
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={styles.root}>
            <View style={StyleSheet.absoluteFill}>
                <RNAnimated.View style={[StyleSheet.absoluteFill, { opacity: bgAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
                    <LinearGradient colors={prevBgColors as [string, string, string]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
                </RNAnimated.View>
                <RNAnimated.View style={[StyleSheet.absoluteFill, { opacity: bgAnim }]}>
                    <LinearGradient colors={bgColors as [string, string, string]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
                </RNAnimated.View>
                <LinearGradient colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.15)', 'transparent']} locations={[0, 0.4, 0.9]} style={StyleSheet.absoluteFill} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.12)']} locations={[0.6, 1]} style={StyleSheet.absoluteFill} />
            </View>

            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <ScreenGrid accent={accent} />
            </View>

            <View style={[styles.header, { paddingTop: insets.top + 32 }]} pointerEvents="box-none">
                <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
                    style={[styles.backBtn, { top: insets.top + 14 }]}>
                    <Ionicons name="chevron-back" size={24} color={'#433D35'} />
                </Pressable>
                <View style={styles.headerCenter} pointerEvents="none">
                    <Text style={[styles.hSub, { color: rgba('#433D35', 0.8), ...styles.textShadowHighlight }]}>Films of my day</Text>
                    <Text style={[styles.hWeekday, { color: '#433D35', ...styles.textShadowSoft }]} numberOfLines={1}>{weekday}</Text>
                    <DoodleUnderline color={'#433D35'} width={180} />
                    <Text style={[styles.hDate, { color: rgba('#433D35', 0.9), ...styles.textShadowHighlight }]} numberOfLines={1}>{date}</Text>
                </View>
            </View>

            <GestureDetector gesture={gesture}>
                <Animated.View style={styles.viewport} collapsable={false}>
                    <Animated.View style={[styles.pivot, pivotStyle]} collapsable={false}>
                        <RouteLayer path={offsetPath} positions={positions} accent={accent}
                            cw={svgW} ch={svgH} originX={minX} originY={minY} />
                        {films.map((f, i) => (
                            <MediaNode key={f.id} item={{ ...f, index: i }} pos={positions[i]}
                                active={i === activeIdx} isPaused={isPaused} accent={accent}
                                tx={tx} ty={ty} sc={sc} inView={Math.abs(i - activeIdx) <= WINDOW}
                                onPress={() => { if (i !== activeIdx) snapTo(i); }} />
                        ))}
                    </Animated.View>
                </Animated.View>
            </GestureDetector>

            <View style={[styles.bottomActions, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
                <FilmViewerList viewerIds={activeFilm?.viewers || []} accent={accent} visible={showViewers} />
                <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowViewers(!showViewers); }} style={styles.eyesBtn}>
                    <SafeBlur intensity={30} style={styles.blurCover}>
                        <Fontisto name="heart-eyes" size={30} color="#000" />
                    </SafeBlur>
                </Pressable>
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: 'rgba(251,250,246,1)' },
    header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 200, alignItems: 'center', paddingBottom: 10 },
    backBtn: { position: 'absolute', left: 16, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', zIndex: 201 },
    headerCenter: { alignItems: 'center', paddingHorizontal: 64 },
    hSub: { fontFamily: FONTS.bold, fontSize: 15, fontWeight: '600', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 6 },
    hWeekday: { fontFamily: 'DancingScript-Bold', fontSize: 36, lineHeight: 40 },
    hDate: { fontFamily: FONTS.bold, fontSize: 12.5, fontWeight: '900', letterSpacing: 0.5, marginTop: 1.5 },
    viewport: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent', overflow: 'visible', zIndex: 100 },
    pivot: { position: 'absolute', left: SW / 2, top: SH / 2, width: 0, height: 0, overflow: 'visible' },
    timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    timeText: { fontFamily: FONTS.bold, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: '#433D35', opacity: 0.8 },
    timeLabelContainer: { position: 'absolute', bottom: -22, right: 0, paddingVertical: 3 },
    card: { width: CARD_W, height: CARD_H, borderRadius: 24, overflow: 'hidden', backgroundColor: '#e8e7e4', shadowOffset: { width: 0, height: 12 }, shadowRadius: 20, elevation: 12 },
    placeholder: { flex: 1 },
    videoOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
    playBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', paddingLeft: 2 },
    activeDot: { position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
    progressLayer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, padding: 4, zIndex: 10 },
    track: { height: 2, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 1 },
    captionWrap: { width: CARD_W + 8, marginLeft: -4, marginTop: 7, paddingHorizontal: 4 },
    caption: { fontFamily: FONTS.regular, fontSize: 9.5, lineHeight: 13, textAlign: 'center' },
    bottomActions: { position: 'absolute', right: 20, flexDirection: 'row', alignItems: 'center', zIndex: 300 },
    eyesBtn: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', zIndex: 301, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
    blurCover: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    textShadowSoft: { textShadowColor: 'rgba(255,255,255,0.85)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 6 },
    textShadowHighlight: { textShadowColor: 'rgba(255,255,255,0.92)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
});