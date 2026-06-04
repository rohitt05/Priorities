// src/features/film-my-day/components/canvas/FilmCanvas.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View, Pressable } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    clamp,
    SharedValue,
    cancelAnimation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';
import ScreenGrid from './ScreenGrid';
import DecoShape from './DecoShape';
import { DecoItem, CardPosition, isInView } from './canvasUtils';

const { width: SW, height: SH } = Dimensions.get('window');

const MIN_SC = 0.2;
const MAX_SC = 3.0;
const FIT_PADDING = 140;
const SPRING_CFG = { damping: 28, stiffness: 160, mass: 1 };
const PAN_END_SPRING = { damping: 38, stiffness: 110, mass: 1.1 };
const CULL_INTERVAL_MS = 260;

export interface FilmCanvasChildProps {
    tx: SharedValue<number>;
    ty: SharedValue<number>;
    sc: SharedValue<number>;
    visibleIndices: number[];
}

interface Props {
    bgColors: [string, string, string];
    decoItems: DecoItem[];
    cardPositions: CardPosition[];
    children: (props: FilmCanvasChildProps) => React.ReactNode;
    overlay?: React.ReactNode;
    defaultScale?: number;
    initialFocusPosition?: { x: number; y: number };
    disableGestures?: boolean;
    showZoomToggle?: boolean;
}

const FilmCanvas = ({
    bgColors,
    decoItems,
    cardPositions,
    children,
    overlay,
    defaultScale = 1,
    initialFocusPosition,
    disableGestures = false,
    showZoomToggle = true,
}: Props) => {
    const initTx = initialFocusPosition ? -initialFocusPosition.x : 0;
    const initTy = initialFocusPosition ? -initialFocusPosition.y : 0;

    const tx = useSharedValue(initTx);
    const ty = useSharedValue(initTy);
    const sc = useSharedValue(defaultScale);

    const panStartX = useSharedValue(initTx);
    const panStartY = useSharedValue(initTy);

    const pinchStartScale = useSharedValue(defaultScale);
    const pinchStartTx = useSharedValue(initTx);
    const pinchStartTy = useSharedValue(initTy);
    const pinchFocalX = useSharedValue(0);
    const pinchFocalY = useSharedValue(0);

    const [renderTx, setRenderTx] = useState(initTx);
    const [renderTy, setRenderTy] = useState(initTy);
    const [renderSc, setRenderSc] = useState(defaultScale);
    const [isOverview, setIsOverview] = useState(false);

    const cullTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    const normalTx = useRef(initTx);
    const normalTy = useRef(initTy);
    const normalSc = useRef(defaultScale);

    useEffect(() => {
        cullTimer.current = setInterval(() => {
            setRenderTx(tx.value);
            setRenderTy(ty.value);
            setRenderSc(sc.value);
        }, CULL_INTERVAL_MS);

        return () => {
            if (cullTimer.current) clearInterval(cullTimer.current);
        };
    }, []);

    const visibleIndices = useMemo(
        () =>
            cardPositions
                .map((p, i) => (isInView(p.x, p.y, renderTx, renderTy, renderSc, SW, SH) ? i : -1))
                .filter(i => i !== -1),
        [cardPositions, renderTx, renderTy, renderSc]
    );

    const visibleDecoIndices = useMemo(
        () =>
            decoItems
                .map((d, i) => (isInView(d.x, d.y, renderTx, renderTy, renderSc, SW, SH) ? i : -1))
                .filter(i => i !== -1),
        [decoItems, renderTx, renderTy, renderSc]
    );

    const overviewTarget = useMemo(() => {
        if (!cardPositions.length) {
            return {
                tx: initTx,
                ty: initTy,
                sc: defaultScale,
            };
        }

        const xs = cardPositions.map(p => p.x);
        const ys = cardPositions.map(p => p.y);

        const minX = Math.min(...xs) - FIT_PADDING;
        const maxX = Math.max(...xs) + FIT_PADDING;
        const minY = Math.min(...ys) - FIT_PADDING;
        const maxY = Math.max(...ys) + FIT_PADDING;

        const worldWidth = Math.max(1, maxX - minX);
        const worldHeight = Math.max(1, maxY - minY);

        const fitScale = clamp(
            Math.min(SW / worldWidth, SH / worldHeight),
            MIN_SC,
            MAX_SC
        );

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        return {
            tx: -centerX,
            ty: -centerY,
            sc: fitScale,
        };
    }, [cardPositions, initTx, initTy, defaultScale]);

    const animateTo = (nextTx: number, nextTy: number, nextSc: number) => {
        cancelAnimation(tx);
        cancelAnimation(ty);
        cancelAnimation(sc);

        tx.value = withSpring(nextTx, SPRING_CFG);
        ty.value = withSpring(nextTy, SPRING_CFG);
        sc.value = withSpring(nextSc, SPRING_CFG);

        panStartX.value = nextTx;
        panStartY.value = nextTy;
        pinchStartTx.value = nextTx;
        pinchStartTy.value = nextTy;
        pinchStartScale.value = nextSc;
    };

    const handleZoomToggle = () => {
        if (!isOverview) {
            normalTx.current = tx.value;
            normalTy.current = ty.value;
            normalSc.current = sc.value;

            animateTo(overviewTarget.tx, overviewTarget.ty, overviewTarget.sc);
            setIsOverview(true);
            return;
        }

        animateTo(normalTx.current, normalTy.current, normalSc.current);
        setIsOverview(false);
    };

    const pan = Gesture.Pan()
        .enabled(!disableGestures)
        .averageTouches(true)
        .minDistance(3)
        .onStart(() => {
            panStartX.value = tx.value;
            panStartY.value = ty.value;
        })
        .onUpdate(e => {
            tx.value = panStartX.value + e.translationX / sc.value;
            ty.value = panStartY.value + e.translationY / sc.value;
        })
        .onEnd(e => {
            const nextTx = tx.value + (e.velocityX * 0.06) / sc.value;
            const nextTy = ty.value + (e.velocityY * 0.06) / sc.value;

            tx.value = withSpring(nextTx, PAN_END_SPRING);
            ty.value = withSpring(nextTy, PAN_END_SPRING);

            panStartX.value = nextTx;
            panStartY.value = nextTy;
            pinchStartTx.value = nextTx;
            pinchStartTy.value = nextTy;
            pinchStartScale.value = sc.value;
        });

    const pinch = Gesture.Pinch()
        .enabled(!disableGestures)
        .onStart(e => {
            pinchStartScale.value = sc.value;
            pinchStartTx.value = tx.value;
            pinchStartTy.value = ty.value;
            pinchFocalX.value = e.focalX - SW / 2;
            pinchFocalY.value = e.focalY - SH / 2;
        })
        .onUpdate(e => {
            const nextScale = clamp(
                pinchStartScale.value * e.scale,
                MIN_SC,
                MAX_SC
            );

            const worldFocalX =
                pinchStartTx.value + pinchFocalX.value / pinchStartScale.value;
            const worldFocalY =
                pinchStartTy.value + pinchFocalY.value / pinchStartScale.value;

            tx.value = worldFocalX - pinchFocalX.value / nextScale;
            ty.value = worldFocalY - pinchFocalY.value / nextScale;
            sc.value = nextScale;
        })
        .onEnd(() => {
            const finalSc = clamp(sc.value, MIN_SC, MAX_SC);
            sc.value = withSpring(finalSc, { damping: 30, stiffness: 150, mass: 1 });

            pinchStartScale.value = finalSc;
            pinchStartTx.value = tx.value;
            pinchStartTy.value = ty.value;
            panStartX.value = tx.value;
            panStartY.value = ty.value;
        });

    const gesture = Gesture.Simultaneous(pan, pinch);

    const pivotStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: SW / 2 },
            { translateY: SH / 2 },
            { scale: sc.value },
            { translateX: tx.value },
            { translateY: ty.value },
        ],
    }));

    return (
        <View style={StyleSheet.absoluteFill}>
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

            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <ScreenGrid />
            </View>

            <GestureDetector gesture={gesture}>
                <Animated.View style={styles.viewport} collapsable={false}>
                    <Animated.View style={[styles.pivot, pivotStyle]} collapsable={false}>
                        {visibleDecoIndices.map(i => (
                            <DecoShape key={`deco-${i}`} item={decoItems[i]} />
                        ))}

                        {children({ tx, ty, sc, visibleIndices })}
                    </Animated.View>
                </Animated.View>
            </GestureDetector>

            {showZoomToggle && cardPositions.length > 0 && (
                <View style={styles.zoomControls} pointerEvents="box-none">
                    <Pressable style={styles.zoomBtn} onPress={handleZoomToggle}>
                        <FontAwesome
                            name={isOverview ? 'compress' : 'expand'}
                            size={20}
                            color="#fff"
                        />
                    </Pressable>
                </View>
            )}

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
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        overflow: 'visible',
    },
    zoomControls: {
        position: 'absolute',
        right: 20,
        bottom: 110,
        zIndex: 300,
    },
    zoomBtn: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: 'rgba(0,0,0,0.38)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 14,

        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
});

export default FilmCanvas;