import React, { useMemo } from 'react';
import { StyleSheet, View, Dimensions, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    runOnJS,
    interpolate,
    Extrapolate,
    useAnimatedProps,
    withTiming,
    Easing,
    interpolateColor,
    SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@/theme/theme';
import { PriorityUserWithPost } from '@/types/userTypes';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SWIPE_THRESHOLD = -150;

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Single continuous organic wavy path for smooth scrolling transitions
const WAVY_PATH = "M0,40 C50,10 150,70 200,40 C250,10 350,70 400,40 C450,10 550,70 600,40 C650,10 750,70 800,40 V100 H0 Z";

interface FilmSwiperBlobProps {
    activeUser: PriorityUserWithPost | null;
    onReveal?: () => void;
    scrollX?: SharedValue<number>;
}

const FilmSwiperBlob: React.FC<FilmSwiperBlobProps> = ({ activeUser, onReveal, scrollX }) => {
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const hasTriggered = useSharedValue(false);
    const colorProgress = useSharedValue(0);
    const prevColor = useSharedValue(COLORS.primary);
    const nextColor = useSharedValue(COLORS.primary);

    const insets = useSafeAreaInsets();

    const blobColor = activeUser?.dominantColor || COLORS.primary;

    // We'll use scrollX to drive the flow instead of a continuous timer
    // But we can still have a light "bob" when the user swipes up

    // Color transition when user changes
    React.useEffect(() => {
        if (activeUser?.dominantColor) {
            // Smooth handoff: calculate current transition color as the new starting point
            const currentColor = interpolateColor(
                colorProgress.value,
                [0, 1],
                [prevColor.value, nextColor.value]
            );

            prevColor.value = currentColor as string;
            nextColor.value = activeUser.dominantColor;
            colorProgress.value = withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) });
        }
    }, [activeUser?.id]);


    const mainWaveAnimProps = useAnimatedProps(() => ({
        d: WAVY_PATH,
        fill: interpolateColor(
            colorProgress.value,
            [0, 1],
            [prevColor.value, nextColor.value]
        ),
        transform: [
            {
                translateX: -((scrollX?.value || 0) % 400)
            },
            { scaleX: 1.5 }
        ]
    }));

    const gesture = Gesture.Pan()
        .onUpdate((event) => {
            if (hasTriggered.value) return;

            // Resistance feel
            translateY.value = event.translationY * 0.4;
            scale.value = interpolate(
                event.translationY,
                [0, -200],
                [1, 1.2],
                Extrapolate.CLAMP
            );

            if (event.translationY < SWIPE_THRESHOLD && !hasTriggered.value) {
                hasTriggered.value = true;
                runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
                if (onReveal) runOnJS(onReveal)();
            }
        })
        .onEnd(() => {
            translateY.value = withSpring(0);
            scale.value = withSpring(1);
            hasTriggered.value = false;
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: translateY.value },
            { scale: scale.value }
        ],
    }));

    const animatedBgStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            colorProgress.value,
            [0, 1],
            [prevColor.value, nextColor.value]
        )
    }));

    const textOverlayStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateY.value, [0, -50], [1, 0], Extrapolate.CLAMP),
        transform: [
            // Anchor to wave height: as wave moves up (negative translateY), 
            // the text follows it tightly but with a subtle parallax offset (0.8 factor)
            { translateY: translateY.value * 0.8 }
        ]
    }));

    return (
        <View style={styles.container}>
            <GestureDetector gesture={gesture}>
                <Animated.View style={[
                    styles.blobWrapper,
                    animatedStyle,
                    { height: 140 + insets.bottom }
                ]}>
                    <Svg
                        viewBox="0 0 400 100"
                        width={SCREEN_WIDTH * 2}
                        height={140 + insets.bottom}
                        preserveAspectRatio="none"
                        style={{
                            marginBottom: -insets.bottom,
                            left: -SCREEN_WIDTH * 0.5
                        }}
                    >
                        {/* Single Organic Wave */}
                        <AnimatedPath
                            animatedProps={mainWaveAnimProps}
                        />
                    </Svg>

                    {/* Gap filler below the SVG to hide the edge when swiped up */}
                    <Animated.View style={[
                        animatedBgStyle,
                        {
                            position: 'absolute',
                            bottom: -400,
                            left: -SCREEN_WIDTH * 0.5,
                            width: SCREEN_WIDTH * 2,
                            height: 450,
                        }
                    ]} />

                    <Animated.View style={[
                        styles.textOverlay,
                        textOverlayStyle,
                        { bottom: 35 + (insets.bottom > 0 ? insets.bottom / 2 : 0) }
                    ]}>
                        <Text style={styles.swipeText}>WATCH FILMS</Text>
                    </Animated.View>
                </Animated.View>
            </GestureDetector>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 100,
    },
    blobWrapper: {
        width: SCREEN_WIDTH,
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    textOverlay: {
        position: 'absolute',
        bottom: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    swipeText: {
        color: '#2C2720', // Ink Black
        fontSize: 12,
        fontFamily: FONTS.bold,
        letterSpacing: 2,
        opacity: 0.9,
    },
});

export default FilmSwiperBlob;
