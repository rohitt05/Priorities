/**
 * myFilmOfTheDay.tsx — Film Map
 *
 * Transform model: zero-size pivot at screen centre (SW/2, SH/2).
 *
 * UX:
 *  • Opens on FIRST (earliest) film at the top
 *  • Improved gesture math for sharp, distinctive map feel
 *  • Viewers list horizontal scroll view (toggled by eyes icon)
 *  • Auto-closes viewers list on navigation
 *  • Smooth color wash background
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    StyleSheet, View, Text, Pressable,
    Dimensions, Animated as RNAnimated, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, Fontisto } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '@/theme/theme';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    runOnJS,
    clamp,
    interpolateColor,
} from 'react-native-reanimated';
import {
    Gesture, GestureDetector, GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Svg, {
    Path, Circle, Line, Rect,
    Defs, LinearGradient as SvgGrad, Stop,
} from 'react-native-svg';
import myFilmsData from '@/data/myFilms.json';
import FilmMedia from '../src/features/film-my-day/components/FilmMedia';
import FilmViewerList from '../src/features/film-my-day/components/FilmViewerList';

import { BlurView } from 'expo-blur';

// ─────────────────────────────────────────── constants
const { width: SW, height: SH } = Dimensions.get('window');

const CARD_W = 160;
const CARD_H = 210;
const CELL = 22;
const MIN_SC = 0.12; // Allow slightly more zoom out for "map view"
const MAX_SC = 3.5;
const DEF_SC = (SW * 0.72) / CARD_W;
const COLS = 3;
const ROW_H = 340; // Increased spacing for better clarity
const CANVAS_W = 1400;
const WINDOW = 3; // Number of items to keep in view/preloaded

// ─────────────────────────────────────────── helpers
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
    return new Date(iso).toLocaleTimeString('en-US',
        { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtDate(iso: string) {
    const d = new Date(iso);
    return {
        weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
        date: d.toLocaleDateString('en-US',
            { day: 'numeric', month: 'short', year: 'numeric' }),
    };
}

// ─────────────────────────────────────────── layout
function buildLayout(count: number) {
    const margin = 160;
    const step = (CANVAS_W - margin * 2 - CARD_W) / (COLS - 1);
    const xs = [margin, margin + step, margin + step * 2];

    const startY = -60;

    return Array.from({ length: count }, (_, i) => {
        const row = Math.floor(i / COLS);
        const col = i % COLS;
        const colIdx = row % 2 === 1 ? COLS - 1 - col : col;
        
        // Add organic drift so it doesn't look like a rigid grid
        const dx = Math.sin(i * 1.5) * 80;
        const dy = Math.cos(i * 0.8) * 40;

        return {
            x: xs[colIdx] - CANVAS_W / 2 + dx,
            y: startY + i * ROW_H + dy,
        };
    });
}

function buildPath(pts: { x: number; y: number }[]) {
    if (pts.length < 2) return '';
    const cx = (p: { x: number }) => p.x + CARD_W / 2;
    const cy = (p: { y: number }) => p.y + CARD_H / 2;
    
    let d = `M ${cx(pts[0])} ${cy(pts[0])}`;
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const distY = cy(b) - cy(a);
        const distX = cx(b) - cx(a);
        
        // Full curved: increase control points to create more "bulge"
        const cp1x = cx(a) + distX * 0.15;
        const cp1y = cy(a) + distY * 0.75;
        const cp2x = cx(b) - distX * 0.15;
        const cp2y = cy(b) - distY * 0.75;
        
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${cx(b)} ${cy(b)}`;
    }
    return d;
}

function makeCentre(idx: number, positions: { x: number; y: number }[], sc: number) {
    const p = positions[idx];
    const cx = p.x + CARD_W / 2;
    const cy = p.y + CARD_H / 2;
    return { tx: -cx * sc, ty: -cy * sc };
}

// ─────────────────────────────────────────── graph grid
const ScreenGrid = React.memo(({ accent }: { accent: string }) => {
    const lc = rgba(accent, 0.22);
    const cols = Math.ceil(SW / CELL) + 1;
    const rows = Math.ceil(SH / CELL) + 1;
    const lines: React.ReactNode[] = [];
    for (let r = 0; r <= rows; r++) {
        lines.push(<Line key={`h${r}`} x1={0} y1={r * CELL} x2={SW} y2={r * CELL}
            stroke={lc} strokeWidth={0.85} />);
    }
    for (let c = 0; c <= cols; c++) {
        lines.push(<Line key={`v${c}`} x1={c * CELL} y1={0} x2={c * CELL} y2={SH}
            stroke={lc} strokeWidth={0.85} />);
    }
    return (
        <Svg width={SW} height={SH} style={StyleSheet.absoluteFill} pointerEvents="none">
            {lines}
        </Svg>
    );
});
ScreenGrid.displayName = 'ScreenGrid';

// ─────────────────────────────────────────── route SVG
const RouteLayer = React.memo(({
    path, positions, accent, cw, ch, originX, originY,
}: {
    path: string; positions: { x: number; y: number }[];
    accent: string; cw: number; ch: number;
    originX: number; originY: number;
}) => (
    <Svg width={cw} height={ch}
        style={{ position: 'absolute', left: originX, top: originY }}
        pointerEvents="none">
        
        {/* 1. Underlying Soft Glow Trail */}
        <Path 
            d={path} 
            stroke={rgba(accent, 0.12)} 
            strokeWidth={12} 
            fill="none" 
            strokeLinecap="round" 
        />

        {/* 2. Beaded Silk Path (The 'Trail of Light') */}
        <Path 
            d={path} 
            stroke={rgba(accent, 0.45)} 
            strokeWidth={3} 
            fill="none" 
            strokeDasharray="0.1, 12" 
            strokeLinecap="round" 
        />

        {/* 3. Circular Ring Chain — Ethereal rings along the route */}
        {positions.slice(0, -1).map((p, i) => {
            const next = positions[i + 1];
            const cxA = p.x + CARD_W / 2 - originX;
            const cyA = p.y + CARD_H / 2 - originY;
            const cxB = next.x + CARD_W / 2 - originX;
            const cyB = next.y + CARD_H / 2 - originY;

            // Add small rings at 25%, 50%, 75% between nodes
            const points = [0.25, 0.5, 0.75];
            return points.map(t => {
                // Linear interp for simplicity (Bézier nodes are close enough for deco)
                const mx = cxA + (cxB - cxA) * t;
                const my = cyA + (cyB - cyA) * t;
                return (
                    <Circle key={`deco-ring-${i}-${t}`}
                        cx={mx} cy={my}
                        r={6 + t * 2} // Variable size for organic feel
                        stroke={accent}
                        strokeWidth={0.6}
                        fill="none"
                        opacity={0.15 - t * 0.05}
                    />
                );
            });
        })}
        
        {/* 4. Central Connection Line */}
        <Path 
            d={path} 
            stroke={rgba(accent, 0.3)} 
            strokeWidth={0.6} 
            fill="none" 
        />

        {/* Node Portals & Orbital Rings */}
        {positions.map((p, i) => {
            const cx = p.x + CARD_W / 2 - originX;
            const cy = p.y + CARD_H / 2 - originY;
            return (
                <React.Fragment key={i}>
                    <Circle 
                        cx={cx} cy={cy} r={24} 
                        stroke={accent} 
                        strokeWidth={0.35} 
                        fill="none" 
                        opacity={0.06}
                    />
                    <Circle 
                        cx={cx} cy={cy} r={12} 
                        stroke={rgba(accent, 0.15)} 
                        strokeWidth={0.8} 
                        fill="none" 
                    />
                    <Circle 
                        cx={cx} cy={cy} r={4.5} 
                        fill="white" 
                        stroke={accent} 
                        strokeWidth={2} 
                    />
                </React.Fragment>
            );
        })}
    </Svg>
));
RouteLayer.displayName = 'RouteLayer';

// ─────────────────────────────────────────── media node
const MediaNode = React.memo(({
    item, pos, active, accent, inView, isPaused, onPress,
}: {
    item: any; pos: { x: number; y: number }; active: boolean;
    accent: string; inView: boolean; isPaused: boolean; 
    onPress: () => void;
}) => {
    const isVideo = item.mediaType === 'video';
    
    // Auto-play condition: active, is video, and NOT manually paused
    const shouldPlay = active && isVideo && !isPaused;

    return (
        <View style={{ position: 'absolute', left: pos.x, top: pos.y }}>
            {/* Time label — ABOVE card, left-aligned */}
            <View style={styles.timeRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Text style={[styles.timeText, { color: rgba(accent, 0.7) }]}>
                        {fmtTime(item.timestamp)}
                    </Text>
                </View>
            </View>

            {/* Media card */}
            <View
                pointerEvents="none"
                style={[styles.card, {
                    borderColor: active ? rgba(accent, 0.45) : rgba(accent, 0.1),
                    borderWidth: 1,
                    shadowColor: accent,
                    shadowOpacity: active ? 0.42 : 0.07,
                }]}
            >
                {inView ? (
                    <FilmMedia
                        uri={item.mediaUrl}
                        type={isVideo ? 'video' : 'image'}
                        isPlaying={shouldPlay}
                        accent={accent}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.placeholder, { backgroundColor: rgba(accent, 0.1) }]} />
                )}

                {active && <View style={[styles.activeDot, { backgroundColor: accent }]} />}
            </View>

            {/* Caption below */}
            {item.caption ? (
                <View style={styles.captionWrap}>
                    <Text style={[styles.caption, { color: rgba('#2C2720', 0.62) }]}
                        numberOfLines={3}>
                        {item.caption}
                    </Text>
                </View>
            ) : null}
        </View>
    );
});
MediaNode.displayName = 'MediaNode';

// ── Safer Blur for Android (Prevents MissingActivity crash)
const SafeBlur = ({ intensity, tint, style, children }: any) => {
    const [isReady, setIsReady] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 150);
        return () => clearTimeout(timer);
    }, []);

    if (!isReady || Platform.OS === 'android') {
        // High-fidelity translucent shim for Android/Initial mount
        return (
            <View style={[style, { backgroundColor: 'rgba(255,255,255,0.32)' }]}>
                {children}
            </View>
        );
    }
    return (
        <BlurView intensity={intensity} tint={tint} style={style}>
            {children}
        </BlurView>
    );
};

// ═══════════════════════════════════════════ Screen
export default function MyFilmOfTheDay() {
    const router = useRouter();
    const { color: colorParam } = useLocalSearchParams<{ color?: string }>();
    const insets = useSafeAreaInsets();
    const accent = (colorParam as string) || COLORS.primary;

    const films = myFilmsData.films;
    const positions = useMemo(() => buildLayout(films.length), [films.length]);
    const routePath = useMemo(() => buildPath(positions), [positions]);

    // SVG bounding box
    const { minX, minY, svgW, svgH } = useMemo(() => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        positions.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x + CARD_W);
            maxY = Math.max(maxY, p.y + CARD_H);
        });
        const pad = 120;
        return {
            minX: minX - pad, minY: minY - pad,
            svgW: maxX - minX + pad * 2,
            svgH: maxY - minY + pad * 2,
        };
    }, [positions]);

    const offsetPath = useMemo(() =>
        routePath.replace(
            /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g,
            (_, x, y) => `${(parseFloat(x) - minX).toFixed(2)} ${(parseFloat(y) - minY).toFixed(2)}`
        ),
        [routePath, minX, minY]
    );

    // ── Open on FIRST film (index 0) ──────────────────────────
    const [activeIdx, setIdx] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [showViewers, setShowViewers] = useState(false);

    // ── Dynamic background colour from active film ────────────
    const bgAnim = useRef(new RNAnimated.Value(0)).current;
    const [bgColor, setBgColor] = useState(rgba(accent, 0.08));
    const [prevBgColor, setPrevBgColor] = useState(rgba(accent, 0.08));

    const filmBgColors = useMemo(() => [
        'rgba(255, 220, 150, 0.15)', // warm sunrise
        'rgba(150, 200, 255, 0.15)', // cool sky
        'rgba(150, 220, 170, 0.15)', // green walk
        'rgba(200, 160, 120, 0.15)', // warm lunch
        'rgba(120, 200, 210, 0.15)', // teal found spot
        'rgba(255, 180, 100, 0.15)', // golden hour
        'rgba(100, 130, 200, 0.15)', // night blue
    ], []);

    const updateBg = useCallback((idx: number) => {
        const next = filmBgColors[idx % filmBgColors.length] ?? rgba(accent, 0.08);
        setPrevBgColor(bgColor);
        setBgColor(next);
        bgAnim.setValue(0);
        RNAnimated.timing(bgAnim, { toValue: 1, duration: 600, useNativeDriver: false }).start();
    }, [bgColor, filmBgColors, accent, bgAnim]);

    const animBg = bgAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    // ── shared values ──────────────────────────────────────────
    const initC = makeCentre(0, positions, DEF_SC);
    const activeIdxSV = useSharedValue(0);
    const tx = useSharedValue(initC.tx);
    const ty = useSharedValue(initC.ty);
    const sc = useSharedValue(DEF_SC);

    const sTx = useSharedValue(initC.tx);
    const sTy = useSharedValue(initC.ty);
    const sSc = useSharedValue(DEF_SC);

    const pivotX = useSharedValue(0);
    const pivotY = useSharedValue(0);

    // Softer, more natural spring for a premium feel
    const SPRING = { damping: 30, stiffness: 180, mass: 1 };

    const closeViewers = () => {
        if (showViewers) setShowViewers(false);
    };

    const snapTo = useCallback((idx: number) => {
        const i = Math.max(0, Math.min(films.length - 1, idx));
        const currentSc = sc.value;
        const snapSc = currentSc < 0.4 ? DEF_SC : currentSc;

        const c = makeCentre(i, positions, snapSc);

        tx.value = withSpring(c.tx, SPRING);
        ty.value = withSpring(c.ty, SPRING);
        if (Math.abs(snapSc - currentSc) > 0.01) {
            sc.value = withSpring(snapSc, SPRING);
        }

        // Update state
        activeIdxSV.value = i;
        runOnJS(setIdx)(i);
        runOnJS(updateBg)(i);
        runOnJS(setIsPaused)(false);
        runOnJS(closeViewers)();
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);

        // Save current values for next gesture
        sTx.value = c.tx;
        sTy.value = c.ty;
        sSc.value = snapSc;
    }, [films.length, positions, updateBg, showViewers]);

    // ── Pan ──────────────────────────────────────────────────
    const pan = Gesture.Pan()
        .minDistance(2)
        .onStart(() => {
            sTx.value = tx.value;
            sTy.value = ty.value;
            runOnJS(closeViewers)();
        })
        .onUpdate(e => {
            tx.value = sTx.value + e.translationX;
            ty.value = sTy.value + e.translationY;
        })
        .onEnd(e => {
            sTx.value = tx.value;
            sTy.value = ty.value;

            const speed = Math.sqrt(e.velocityX ** 2 + e.velocityY ** 2);
            
            // Logic for snapping: flick or distance based
            let targetIdx = activeIdx;

            if (speed > 350) {
                // Flick logic: move to next/prev based on direction
                const verticalMove = Math.abs(e.velocityY) > Math.abs(e.velocityX);
                if (verticalMove) {
                    targetIdx = e.velocityY < 0 ? activeIdx + 1 : activeIdx - 1;
                } else {
                    targetIdx = e.velocityX < 0 ? activeIdx + 1 : activeIdx - 1;
                }
            } else {
                // Distance logic: Find the card closest to the screen center
                const centerCx = -tx.value / sc.value;
                const centerCy = -ty.value / sc.value;
                
                let minDist = Infinity;
                positions.forEach((p, idx) => {
                    const dx = (p.x + CARD_W / 2) - centerCx;
                    const dy = (p.y + CARD_H / 2) - centerCy;
                    const dist = dx * dx + dy * dy;
                    if (dist < minDist) {
                        minDist = dist;
                        targetIdx = idx;
                    }
                });
            }
            
            runOnJS(snapTo)(targetIdx);
        });

    // ── Focal-point pinch ────────────────────────────────────
    const pinch = Gesture.Pinch()
        .onStart(e => {
            sSc.value = sc.value;
            sTx.value = tx.value;
            sTy.value = ty.value;
            pivotX.value = e.focalX - SW / 2;
            pivotY.value = e.focalY - SH / 2;
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
            const currentSc = sc.value;
            const finalSc = clamp(currentSc, MIN_SC, MAX_SC);
            sc.value = withSpring(finalSc, SPRING);

            sSc.value = finalSc;
            sTx.value = tx.value;
            sTy.value = ty.value;
        });

    const tap = Gesture.Tap()
        .maxDuration(250)
        .maxDistance(25)
        .onEnd((e) => {
            // High-performance Hit Testing for all cards
            // coordinates are relative to the device screen (viewport)
            let tappedIdx = -1;
            
            for (let i = 0; i < positions.length; i++) {
                const p = positions[i];
                // screenX = pivotCenterX + tx + canvasX * sc
                const cardScreenX = SW / 2 + tx.value + p.x * sc.value;
                const cardScreenY = SH / 2 + ty.value + p.y * sc.value;
                const cardW = CARD_W * sc.value;
                const cardH = CARD_H * sc.value;

                if (e.x >= cardScreenX && e.x <= cardScreenX + cardW &&
                    e.y >= cardScreenY && e.y <= cardScreenY + cardH) {
                    tappedIdx = i;
                    break;
                }
            }

            if (tappedIdx !== -1) {
                if (tappedIdx === activeIdxSV.value) {
                    runOnJS(setIsPaused)((prev: boolean) => !prev);
                    runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
                } else {
                    runOnJS(snapTo)(tappedIdx);
                }
            } else {
                runOnJS(closeViewers)();
            }
        });

    const gesture = Gesture.Simultaneous(tap, pan, pinch);

    const pivotStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: tx.value },
            { translateY: ty.value },
            { scale: sc.value },
        ],
    }));

    const activeFilm = films[activeIdx];
    const { weekday, date } = useMemo(() =>
        fmtDate(activeFilm?.timestamp || new Date().toISOString()),
        [activeFilm]
    );

    return (
        <GestureHandlerRootView style={styles.root}>
            {/* Background wash */}
            <RNAnimated.View
                style={[StyleSheet.absoluteFill, { backgroundColor: animBg }]}
                pointerEvents="none"
            />

            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <ScreenGrid accent={accent} />
            </View>

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 32 }]}
                pointerEvents="box-none">
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.back();
                    }}
                    style={[styles.backBtn, { top: insets.top + 14 }]}
                >
                    <Ionicons name="chevron-back" size={24} color={accent} />
                </Pressable>
                <View style={styles.headerCenter} pointerEvents="none">
                    <Text style={[styles.hSub, { color: rgba(accent, 0.5) }]}>
                        Films of my day
                    </Text>
                    <Text style={[styles.hWeekday, { color: accent }]} numberOfLines={1}>
                        {weekday}
                    </Text>
                    <Text style={[styles.hDate, { color: rgba(accent, 0.7) }]} numberOfLines={1}>
                        {date}
                    </Text>
                </View>
            </View>

            {/* Map canvas */}
            <GestureDetector gesture={gesture}>
                <Animated.View style={styles.viewport} collapsable={false}>
                    <Animated.View style={[styles.pivot, pivotStyle]} collapsable={false}>
                        <RouteLayer
                            path={offsetPath}
                            positions={positions}
                            accent={accent}
                            cw={svgW}
                            ch={svgH}
                            originX={minX}
                            originY={minY}
                        />
                        {films.map((f, i) => (
                            <MediaNode
                                key={f.id}
                                item={f}
                                pos={positions[i]}
                                active={i === activeIdx}
                                isPaused={isPaused}
                                accent={accent}
                                inView={Math.abs(i - activeIdx) <= WINDOW}
                                onPress={() => {
                                    if (i !== activeIdx) {
                                        snapTo(i);
                                    }
                                }}
                            />
                        ))}
                    </Animated.View>
                </Animated.View>
            </GestureDetector>

            {/* ── Bottom Actions (Eyes + Viewers) ── */}
            <View style={[styles.bottomActions, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
                <FilmViewerList
                    viewerIds={activeFilm?.viewers || []}
                    accent={accent}
                    visible={showViewers}
                />

                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowViewers(!showViewers);
                    }}
                    style={styles.eyesBtn}
                >
                    <SafeBlur intensity={30} style={styles.blurCover}>
                        <Fontisto name="heart-eyes" size={30} color="#000" />
                    </SafeBlur>
                </Pressable>
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: 'rgba(251,250,246,1)',
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
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 201,
    },
    headerCenter: {
        alignItems: 'center',
        paddingHorizontal: 64,
    },
    hSub: {
        fontFamily: FONTS.bold,
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 4,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    hWeekday: {
        fontFamily: 'DancingScript-Bold',
        fontSize: 36,
        lineHeight: 40,
    },
    hDate: {
        fontFamily: FONTS.bold,
        fontSize: 12.5,
        fontWeight: '900',
        letterSpacing: 0.5,
        marginTop: 1.5,
    },
    viewport: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        overflow: 'visible',
        zIndex: 100,
    },
    pivot: {
        position: 'absolute',
        left: SW / 2,
        top: SH / 2,
        width: 0,
        height: 0,
        overflow: 'visible',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    timeText: {
        fontFamily: FONTS.bold,
        fontSize: 9,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    card: {
        width: CARD_W,
        height: CARD_H,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#e8e7e4',
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 16,
        elevation: 8,
    },
    placeholder: { flex: 1 },
    videoOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    playBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 2,
    },
    activeDot: {
        position: 'absolute',
        top: -4, right: -4,
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: '#fff',
    },
    progressLayer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 6,
        padding: 4,
        zIndex: 10,
    },
    track: {
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 1,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: 1,
    },
    captionWrap: {
        width: CARD_W + 8,
        marginLeft: -4,
        marginTop: 7,
        paddingHorizontal: 4,
    },
    caption: {
        fontFamily: FONTS.regular,
        fontSize: 9.5,
        lineHeight: 13,
        textAlign: 'center',
    },
    // eyes icon and viewers list container
    bottomActions: {
        position: 'absolute',
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 300,
    },
    eyesBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 301,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    blurCover: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
