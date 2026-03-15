import { StyleSheet, Text, View, Pressable, Animated as RNAnimated } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '@/theme/theme';
import { useBackground } from '@/contexts/BackgroundContext';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    runOnJS,
    interpolate,
    Extrapolation,
    useAnimatedProps,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

export default function Header() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { bgColor, prevBgColor, colorAnim } = useBackground();

    const translateY = useSharedValue(0);
    const hasTriggered = useSharedValue(false);
    const PULL_THRESHOLD = 80;

    const navigateToFilm = () => {
        router.push({
            pathname: '/myFilmOfTheDay',
            params: { color: bgColor }
        });
    };

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            if (event.translationY > 0) {
                const drag = event.translationY * 0.4; // natural rubber-band feel
                translateY.value = drag;

                if (drag > PULL_THRESHOLD && !hasTriggered.value) {
                    hasTriggered.value = true;
                    runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
                } else if (drag < PULL_THRESHOLD && hasTriggered.value) {
                    hasTriggered.value = false;
                }
            } else {
                translateY.value = 0;
            }
        })
        .onEnd(() => {
            if (translateY.value > PULL_THRESHOLD) {
                runOnJS(navigateToFilm)();
            }
            // Fast iPhone-like snap back
            translateY.value = withSpring(0, { damping: 26, stiffness: 400, mass: 0.6 });
            hasTriggered.value = false;
        });

    const animatedHeaderStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const indicatorStyle = useAnimatedStyle(() => {
        const opacity = interpolate(translateY.value, [20, 60], [0, 1], Extrapolation.CLAMP);
        const scale = interpolate(translateY.value, [20, 80], [0.8, 1.1], Extrapolation.CLAMP);
        const y = interpolate(translateY.value, [0, 80], [-20, 10], Extrapolation.CLAMP);
        const color = translateY.value > PULL_THRESHOLD ? COLORS.PALETTE.coralRed : COLORS.primary;

        return {
            opacity,
            transform: [
                { scale },
                { translateY: y }
            ],
            // We pass color through a separate mechanism if possible,
            // but for now, we can use it in a derived Text/Icon style.
        };
    });

    const indicatorColorStyle = useAnimatedStyle(() => ({
        color: translateY.value > PULL_THRESHOLD ? COLORS.PALETTE.coralRed : COLORS.primary as string
    }));

    const animatedProps = useAnimatedProps(() => ({
        color: translateY.value > PULL_THRESHOLD ? COLORS.PALETTE.coralRed : COLORS.primary as string
    }));

    return (
        <View style={styles.root}>
            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.sheetContainer, animatedHeaderStyle]}>
                    {/* The Full Sheet Surface (Covers indicators and header) */}
                    <View style={styles.sheetSurface}>
                        {/* Dynamic Color Layers - 1:1 Match with Home Screen Logic */}
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.background }]} />
                        {/* Current/New Color Layer */}
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor, opacity: 0.35 }]} />
                        {/* Fading Old Color Layer */}
                        <RNAnimated.View
                            style={[
                                StyleSheet.absoluteFill,
                                {
                                    backgroundColor: prevBgColor,
                                    opacity: colorAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.35, 0]
                                    })
                                }
                            ]}
                        />
                        <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
                    </View>

                    {/* Hidden Indicator Area (revealed when pulling) */}
                    <View style={styles.indicatorArea}>
                        <Animated.View style={[styles.indicatorContent, indicatorStyle]}>
                            <AnimatedIonicons
                                name={hasTriggered.value ? "film" : "arrow-down"}
                                size={24}
                                animatedProps={animatedProps}
                            />
                            <Animated.Text style={[styles.indicatorText, indicatorColorStyle]}>
                                {hasTriggered.value ? "Release for Film" : "Pull for Daily Film"}
                            </Animated.Text>
                        </Animated.View>
                    </View>

                    {/* Visible Header Content */}
                    <View style={[styles.headerContent, { paddingTop: Math.max(insets.top, SPACING.md) }]}>
                        <View style={styles.logoContainer}>
                            <Text style={styles.logo} numberOfLines={1}>priorities</Text>
                        </View>
                        <Link href="/profile" asChild>
                            <Pressable style={styles.profileButton}>
                                <Ionicons name="person-outline" size={28} color={COLORS.primary} />
                            </Pressable>
                        </Link>
                    </View>

                    {/* Sheet Bottom Edge/Handle */}
                    <View style={styles.sheetEdge} />
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        width: '100%',
        zIndex: 2000,
        height: 120 // Increased height to push tabs down further
    },
    sheetContainer: {
        width: '100%',
        zIndex: 2000,
    },
    sheetSurface: {
        position: 'absolute',
        top: -1000,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.background,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        overflow: 'hidden',
    },
    indicatorArea: {
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -100, // Move indicators off-screen above header
    },
    indicatorContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    indicatorText: {
        fontSize: 12,
        fontFamily: FONTS.bold,
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    headerContent: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.md, // More space before the sheet ends
    },
    sheetEdge: {
        height: 1,
        width: '100%',
        // Removed visible props since surface handles it now
    },
    logoContainer: {
        height: 50,
        justifyContent: 'center',
    },
    logo: {
        fontSize: 32,
        fontFamily: FONTS.bold,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: -1,
        includeFontPadding: false,
    },
    profileButton: {
        padding: 4,
    }
});
