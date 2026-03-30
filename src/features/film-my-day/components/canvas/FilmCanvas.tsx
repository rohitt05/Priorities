// src/features/film-my-day/components/canvas/FilmCanvas.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle, useSharedValue, withSpring, clamp, SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenGrid from './ScreenGrid';
import DecoShape from './DecoShape';
import { DecoItem, CardPosition, isInView, RENDER_WINDOW } from './canvasUtils';


const { width: SW, height: SH } = Dimensions.get('window');


const MIN_SC = 0.2;
const MAX_SC = 3.0;
const SPRING_CFG = { damping: 28, stiffness: 160, mass: 1 };


export interface FilmCanvasChildProps {
    /** current pan X shared value — pass to children that need canvas coords */
    tx: SharedValue<number>;
    ty: SharedValue<number>;
    sc: SharedValue<number>;
    /** which card indices are currently within render window */
    visibleIndices: number[];
}


interface Props {
    /** background gradient colors — 3 stops */
    bgColors: [string, string, string];
    decoItems: DecoItem[];
    cardPositions: CardPosition[];
    /** render children inside the pivot (receives canvas state) */
    children: (props: FilmCanvasChildProps) => React.ReactNode;
    /** render overlay children outside the canvas (header, bottom bar, etc.) */
    overlay?: React.ReactNode;
    defaultScale?: number;
    /**
     * If provided, canvas will open pre-panned so this canvas-space position
     * is centered on screen. Pass the latest film's cardPosition to show it
     * in view on first render.
     */
    initialFocusPosition?: { x: number; y: number };
}


const FilmCanvas = ({
    bgColors,
    decoItems,
    cardPositions,
    children,
    overlay,
    defaultScale = 1,
    initialFocusPosition,
}: Props) => {
    // If caller wants a specific position centered on open, compute initial tx/ty.
    // Canvas transform: screenPos = SW/2 + tx + itemPos * sc
    // To center itemPos: tx = -itemPos * sc
    const initTx = initialFocusPosition ? -initialFocusPosition.x * defaultScale : 0;
    const initTy = initialFocusPosition ? -initialFocusPosition.y * defaultScale : 0;

    const tx = useSharedValue(initTx);
    const ty = useSharedValue(initTy);
    const sc = useSharedValue(defaultScale);
    const sTx = useSharedValue(initTx);
    const sTy = useSharedValue(initTy);
    const sSc = useSharedValue(defaultScale);
    const pivotX = useSharedValue(0);
    const pivotY = useSharedValue(0);


    // ── Culling state (JS-side, 150ms poll) ───────────────────
    const [renderTx, setRenderTx] = useState(initTx);
    const [renderTy, setRenderTy] = useState(initTy);
    const [renderSc, setRenderSc] = useState(defaultScale);


    const cullTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        cullTimer.current = setInterval(() => {
            setRenderTx(tx.value);
            setRenderTy(ty.value);
            setRenderSc(sc.value);
        }, 150);
        return () => { if (cullTimer.current) clearInterval(cullTimer.current); };
    }, []);


    const visibleIndices = useMemo(() =>
        cardPositions
            .map((p, i) => isInView(p.x, p.y, renderTx, renderTy, renderSc, SW, SH) ? i : -1)
            .filter(i => i !== -1),
        [cardPositions, renderTx, renderTy, renderSc],
    );


    const visibleDecoIndices = useMemo(() =>
        decoItems
            .map((d, i) => isInView(d.x, d.y, renderTx, renderTy, renderSc, SW, SH) ? i : -1)
            .filter(i => i !== -1),
        [decoItems, renderTx, renderTy, renderSc],
    );


    // ── Gestures ───────────────────────────────────────────────
    const pan = Gesture.Pan()
        .minDistance(4)
        .onStart(() => { sTx.value = tx.value; sTy.value = ty.value; })
        .onUpdate(e => { tx.value = sTx.value + e.translationX; ty.value = sTy.value + e.translationY; })
        .onEnd(e => {
            tx.value = withSpring(tx.value + e.velocityX * 0.18, { damping: 35, stiffness: 120 });
            ty.value = withSpring(ty.value + e.velocityY * 0.18, { damping: 35, stiffness: 120 });
            sTx.value = tx.value;
            sTy.value = ty.value;
        });


    const pinch = Gesture.Pinch()
        .onStart(e => {
            sSc.value = sc.value;
            sTx.value = tx.value; sTy.value = ty.value;
            pivotX.value = e.focalX - SW / 2;
            pivotY.value = e.focalY - SH / 2;
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
            sc.value = withSpring(finalSc, SPRING_CFG);
            sSc.value = finalSc;
            sTx.value = tx.value; sTy.value = ty.value;
        });


    const gesture = Gesture.Simultaneous(pan, pinch);


    const pivotStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: SW / 2 + tx.value },
            { translateY: SH / 2 + ty.value },
            { scale: sc.value },
        ],
    }));


    return (
        <View style={StyleSheet.absoluteFill}>


            {/* Background */}
            <LinearGradient
                colors={bgColors}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
            />
            <LinearGradient
                colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.12)', 'transparent']}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
            />


            {/* Grid */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <ScreenGrid />
            </View>


            {/* Canvas */}
            <GestureDetector gesture={gesture}>
                <Animated.View style={styles.viewport} collapsable={false}>
                    <Animated.View style={[styles.pivot, pivotStyle]} collapsable={false}>


                        {/* Deco shapes */}
                        {visibleDecoIndices.map(i => (
                            <DecoShape key={`deco-${i}`} item={decoItems[i]} />
                        ))}


                        {/* Screen content via render prop */}
                        {children({ tx, ty, sc, visibleIndices })}


                    </Animated.View>
                </Animated.View>
            </GestureDetector>


            {/* Overlay (header, bottom bar) */}
            {overlay}
        </View>
    );
};


const styles = StyleSheet.create({
    viewport: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        overflow: 'visible',
        zIndex: 100,
    },
    pivot: {
        position: 'absolute',
        left: 0, top: 0,
        width: 0, height: 0,
        overflow: 'visible',
    },
});


export default FilmCanvas;