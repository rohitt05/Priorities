import React, { useMemo } from 'react';
import { StyleSheet, View, Text, Pressable, Dimensions } from 'react-native';
import Animated, {
    useAnimatedStyle,
    interpolate,
    Extrapolation,
    SharedValue,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import { Film as UserFilm } from '@/types/domain';
import { FONTS } from '@/theme/theme';
import { formatRelativeTime } from '../utils/dateUtils';
import FilmMedia from './FilmMedia';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = 160;
const STICKY_OFFSET = 100;

interface FilmCardProps {
    film: UserFilm;
    index: number;
    scrollY: SharedValue<number>;
    assignedColor: string;
    isLast: boolean;
    totalCards: number;
    onPress: () => void;
    dynamicGap: number;
}

const FilmCardBase: React.FC<FilmCardProps> = ({
    film,
    index,
    scrollY,
    assignedColor,
    isLast,
    totalCards,
    onPress,
    dynamicGap,
}) => {
    const PADDING_TOP = 100;
    const pressScale = useSharedValue(1);

    // Memoize layout constants to avoid re-calculation on every re-render
    const layout = useMemo(() => {
        const naturalPosition = PADDING_TOP + index * (CARD_HEIGHT - 80);
        const stickyTop = STICKY_OFFSET + index * dynamicGap;
        const stickStart = Math.max(0, naturalPosition - stickyTop);
        return { stickStart };
    }, [index, dynamicGap]);

    const animatedStyle = useAnimatedStyle(() => {
        const translation = Math.max(0, scrollY.value - layout.stickStart);
        const finalTranslateY = translation;

        const scale = interpolate(
            translation,
            [0, CARD_HEIGHT * 3],
            [1, 0.94],
            Extrapolation.CLAMP
        );

        return {
            transform: [
                { translateY: finalTranslateY },
                { scale: scale * pressScale.value }
            ],
        };
    });

    const handlePressIn = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        pressScale.value = withSpring(0.98, {
            damping: 20,
            stiffness: 250
        });
    };

    const handlePressOut = () => {
        pressScale.value = withSpring(1, {
            damping: 20,
            stiffness: 250
        });
    };

    return (
        <Animated.View
            shouldRasterizeIOS={true}
            renderToHardwareTextureAndroid={true}
            style={[
                styles.card,
                {
                    backgroundColor: assignedColor,
                    zIndex: index + 1,
                    height: isLast ? undefined : CARD_HEIGHT,
                    flex: isLast ? 1 : undefined,
                    minHeight: isLast ? 400 : undefined,
                    marginTop: index === 0 ? 0 : -80,
                    marginBottom: isLast ? 100 : 0,
                },
                animatedStyle,
            ]}
        >
            <View style={[StyleSheet.absoluteFill, styles.mediaWrapper]}>
                <FilmMedia
                    uri={film.uri}
                    type={film.type as 'image' | 'video'}
                />
                <View style={[StyleSheet.absoluteFillObject, styles.overlay]} />
            </View>

            {isLast && (
                <View
                    style={[
                        styles.magicTail,
                        { backgroundColor: assignedColor }
                    ]}
                >
                    <FilmMedia
                        uri={film.uri}
                        type={film.type as 'image' | 'video'}
                        style={styles.tailMedia}
                    />
                    <View style={[StyleSheet.absoluteFillObject, styles.overlay]} />
                </View>
            )}

            <Pressable
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={{ flex: 1 }}
            >
                <View style={styles.cardTopRow}>
                    <View style={styles.cardRight}>
                        <Text style={styles.dateText}>{formatRelativeTime(film.createdAt)}</Text>
                    </View>
                </View>
            </Pressable>
        </Animated.View>
    );
};

const FilmCard = React.memo(FilmCardBase);
FilmCard.displayName = 'FilmCard';

const styles = StyleSheet.create({
    card: {
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        padding: 24,
        width: '100%',
        overflow: 'visible',
    },
    mediaWrapper: {
        overflow: 'hidden',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
    },
    overlay: {
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    magicTail: {
        position: 'absolute',
        top: 100,
        bottom: -2000,
        left: 0,
        right: 0,
        overflow: 'hidden',
    },
    tailMedia: {
        position: 'absolute',
        top: -100,
        left: 0,
        width: '100%',
        height: SCREEN_HEIGHT,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardRight: {
        alignItems: 'flex-end',
        flex: 1,
    },
    dateText: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        color: '#FFF',
    },
    timeText: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
});

export default FilmCard;
