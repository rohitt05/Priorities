// src/features/film-my-day/components/canvas/AuthCanvas.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    clamp,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenGrid from './ScreenGrid';
import DecoShape from './DecoShape';
import { DecoItem, isInView } from './canvasUtils';


const { width: SW, height: SH } = Dimensions.get('window');

const MIN_SC = 0.6;
const MAX_SC = 2.0;
const SPRING_CFG = { damping: 28, stiffness: 160, mass: 1 };


interface Props {
    bgColors: [string, string, string];
    decoItems: DecoItem[];
    defaultScale?: number;
    children: React.ReactNode;
}


const AuthCanvas = ({
    bgColors,
    decoItems,
    defaultScale = 1,
    children,
}: Props) => {
    const tx = useSharedValue(0);
    const ty = useSharedValue(0);
    const sc = useSharedValue(defaultScale);
    const sTx = useSharedValue(0);
    const sTy = useSharedValue(0);
    const sSc = useSharedValue(defaultScale);
    const pivotX = useSharedValue(0);
    const pivotY = useSharedValue(0);

    const [renderTx, setRenderTx] = useState(0);
    const [renderTy, setRenderTy] = useState(0);
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

    const visibleDecoIndices = useMemo(() =>
        decoItems
            .map((d, i) => isInView(d.x, d.y, renderTx, renderTy, renderSc, SW, SH) ? i : -1)
            .filter(i => i !== -1),
        [decoItems, renderTx, renderTy, renderSc],
    );

    // ── Gestures ───────────────────────────────────────────────
    const pan = Gesture.Pan()
        .minDistance(6)
        .onStart(() => {
            sTx.value = tx.value;
            sTy.value = ty.value;
        })
        .onUpdate(e => {
            tx.value = sTx.value + e.translationX;
            ty.value = sTy.value + e.translationY;
        })
        .onEnd(e => {
            tx.value = withSpring(tx.value + e.velocityX * 0.18, { damping: 35, stiffness: 120 });
            ty.value = withSpring(ty.value + e.velocityY * 0.18, { damping: 35, stiffness: 120 });
            sTx.value = tx.value;
            sTy.value = ty.value;
        });

    const pinch = Gesture.Pinch()
        .onStart(e => {
            sSc.value = sc.value;
            sTx.value = tx.value;
            sTy.value = ty.value;
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
            sTx.value = tx.value;
            sTy.value = ty.value;
        });

    // KEY: use simultaneousWithExternalGesture is NOT needed here —
    // instead we make pan/pinch only activate on the deco layer itself
    // by keeping form children outside the animated pivot
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

            {/*
                GestureDetector wraps EVERYTHING — both the deco canvas
                and the form children. This is the only way RNGH gestures
                work alongside touchable children.

                The trick: form children are NOT inside the animated pivot,
                so they don't move with the canvas. They sit in a separate
                absoluteFill view inside the GestureDetector. RNGH correctly
                gives tap ownership to TextInput/TouchableOpacity when the
                touch starts on them, and gives pan/pinch to the gesture
                when touch starts on the empty canvas background.
            */}
            <GestureDetector gesture={gesture}>
                <View style={StyleSheet.absoluteFill} collapsable={false}>

                    {/* Deco canvas — moves with pan/pinch */}
                    <Animated.View
                        style={[styles.pivot, pivotStyle]}
                        pointerEvents="none"
                        collapsable={false}
                    >
                        {visibleDecoIndices.map(i => (
                            <DecoShape key={`deco-${i}`} item={decoItems[i]} />
                        ))}
                    </Animated.View>

                    {/*
                        Form children — static, don't move with canvas.
                        Sit inside GestureDetector so RNGH touch arbitration
                        works correctly. Their touches are claimed by the
                        native responders (TextInput, TouchableOpacity) before
                        the pan gesture activates (pan needs minDistance:6 to
                        activate, taps resolve instantly).
                    */}
                    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                        {children}
                    </View>

                </View>
            </GestureDetector>

        </View>
    );
};


const styles = StyleSheet.create({
    pivot: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        overflow: 'visible',
    },
});


export default AuthCanvas;