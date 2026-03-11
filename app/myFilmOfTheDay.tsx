import React from 'react';
import { StyleSheet, View, Text, Pressable, Dimensions, Platform, FlatList, ViewToken } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, FONT_SIZES } from '@/theme/theme';
import * as Haptics from 'expo-haptics';
import Animated, {
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    runOnJS,
    cancelAnimation,
    Easing
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import myFilmsData from '@/data/myFilms.json';
import FilmMedia from '../src/features/film-my-day/components/FilmMedia';
import { formatTime } from '../src/features/film-my-day/utils/dateUtils';
import { Film as UserFilm } from '@/types/domain';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MyFilmOfTheDay() {
    const router = useRouter();
    const { color: colorParam } = useLocalSearchParams<{ color?: string }>();
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(0);

    const baseColor = colorParam || COLORS.primary;

    const handleDismiss = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
    };

    const panGesture = Gesture.Pan()
        .onChange((event) => {
            if (event.translationY > 0) {
                translateY.value = event.translationY;
            }
        })
        .onEnd((event) => {
            if (event.translationY > 100 || event.velocityY > 500) {
                runOnJS(handleDismiss)();
            } else {
                translateY.value = withSpring(0);
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const films: (UserFilm & { caption?: string })[] = (myFilmsData.films as any[]).map(f => ({
        id: f.id,
        userId: f.userId,
        uri: f.mediaUrl,
        type: f.mediaType === 'video' ? 'video' : 'image',
        timestamp: f.timestamp,
        dayOfWeek: f.dayOfWeek,
        caption: f.caption,
        thumbnail: '',
        isPublic: true
    }));

    const [currentIndex, setCurrentIndex] = React.useState(0);
    const translateX = useSharedValue(0);
    const rotate = useSharedValue(0);

    const activeFilm = films[currentIndex];

    const swipeGesture = Gesture.Pan()
        .onUpdate((event) => {
            translateX.value = event.translationX;
            rotate.value = event.translationX / 20;
        })
        .onEnd((event) => {
            if (Math.abs(event.translationX) > 120 || Math.abs(event.velocityX) > 800) {
                const direction = event.translationX > 0 ? 1 : -1;
                translateX.value = withTiming(direction * SCREEN_WIDTH * 1.5, { duration: 300 }, () => {
                    runOnJS(setCurrentIndex)((currentIndex + 1) % films.length);
                    translateX.value = 0;
                    rotate.value = 0;
                });
            } else {
                translateX.value = withSpring(0);
                rotate.value = withSpring(0);
            }
        });

    const renderStackCard = (item: (UserFilm & { caption?: string }), index: number) => {
        // Only render the top few cards for performance
        if (index < currentIndex || index > currentIndex + 2) return null;

        const isTopCard = index === currentIndex;
        const offset = index - currentIndex;

        const animatedCardStyle = useAnimatedStyle(() => {
            if (isTopCard) {
                return {
                    transform: [
                        { translateX: translateX.value },
                        { rotate: `${rotate.value}deg` },
                        { scale: 1 }
                    ],
                    zIndex: 100,
                };
            }

            // Background cards styling
            return {
                transform: [
                    { translateX: withSpring(offset * 20) },
                    { scale: withSpring(1 - offset * 0.05) },
                ],
                opacity: withSpring(1 - offset * 0.3),
                zIndex: 100 - offset,
            };
        });

        return (
            <Animated.View key={item.id} style={[styles.stackCard, animatedCardStyle]}>
                <FilmMedia
                    uri={item.uri}
                    type={item.type as 'image' | 'video'}
                    isPlaying={isTopCard}
                    resizeMode="cover"
                />
            </Animated.View>
        );
    };

    const dateObj = new Date(activeFilm?.timestamp);
    const dayLabel = activeFilm?.dayOfWeek?.toUpperCase();
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    const timeStr = formatTime(activeFilm?.timestamp);

    return (
        <GestureDetector gesture={Gesture.Simultaneous(panGesture, swipeGesture)}>
            <Animated.View style={[styles.container, animatedStyle]}>
                {/* Solid Background Color */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: baseColor }]} />

                {/* Header Content */}
                <Animated.View
                    entering={FadeIn.delay(200)}
                    style={[styles.header, { paddingTop: insets.top + SPACING.md }]}
                >
                    <View style={styles.headerTitleContainer}>
                        <Pressable
                            onPress={handleDismiss}
                            style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.7 : 1 }]}
                        >
                            <Ionicons name="chevron-down" size={28} color={COLORS.text} />
                        </Pressable>
                        <Text style={styles.headerTitleText}>MY FILM OF THE DAY</Text>
                    </View>
                    <View style={{ width: 44 }} />
                </Animated.View>

                {/* Stack Area */}
                <View style={styles.stackContainer}>
                    {films.map((item, index) => renderStackCard(item, index)).reverse()}
                </View>

                {/* Info Area (Updated for active card) */}
                <Animated.View
                    entering={FadeInDown.delay(300)}
                    key={`info-${currentIndex}`}
                    style={styles.activeInfoArea}
                >
                    <Text style={styles.dateTimeLabel}>
                        {dayLabel} . {dateStr} . {timeStr}
                    </Text>
                    {activeFilm?.caption && (
                        <Text style={styles.captionText}>{activeFilm.caption}</Text>
                    )}
                </Animated.View>
            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        zIndex: 500,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    closeButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitleText: {
        color: COLORS.text,
        fontFamily: FONTS.bold,
        fontSize: 14,
        letterSpacing: 0.5,
        marginLeft: 4,
    },
    stackContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 40,
        height: SCREEN_HEIGHT * 0.6,
    },
    stackCard: {
        position: 'absolute',
        width: SCREEN_WIDTH * 0.82,
        height: SCREEN_HEIGHT * 0.52,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#000',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
    },
    activeInfoArea: {
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.xxl + 40,
        minHeight: 120,
    },
    dateTimeLabel: {
        color: COLORS.text,
        fontFamily: FONTS.bold,
        fontSize: FONT_SIZES.xs,
        letterSpacing: 1.5,
        opacity: 0.7,
        marginBottom: 8,
    },
    captionText: {
        color: COLORS.text,
        fontFamily: FONTS.bold,
        fontSize: 22,
        lineHeight: 30,
        letterSpacing: -0.4,
    },
});
