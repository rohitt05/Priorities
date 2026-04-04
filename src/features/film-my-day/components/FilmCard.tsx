import React from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Film as UserFilm } from '@/types/domain';
import { FONTS } from '@/theme/theme';
import { formatRelativeTime } from '../utils/dateUtils';
import FilmMedia from './FilmMedia';
import * as Haptics from 'expo-haptics';
import OverlayRenderer from '@/components/ui/OverlayRenderer';

const { width: SW } = Dimensions.get('window');

export const CARD_CONFIGS = [
    { width: SW * 0.42, height: SW * 0.42 },
    { width: SW * 0.56, height: SW * 0.38 },
    { width: SW * 0.38, height: SW * 0.52 },
    { width: SW * 0.48, height: SW * 0.44 },
    { width: SW * 0.44, height: SW * 0.44 },
    { width: SW * 0.52, height: SW * 0.36 },
];

interface FilmCardProps {
    film: UserFilm;
    index: number;
    x: number;
    y: number;
    cardWidth: number;
    cardHeight: number;
    assignedColor: string;
    isNewest: boolean;
    onPress: () => void;
}

const FilmCardBase: React.FC<FilmCardProps> = ({
    film,
    x,
    y,
    cardWidth,
    cardHeight,
    assignedColor,
    isNewest,
    onPress,
}) => {
    const pressScale = useSharedValue(1);

    const tapGesture = Gesture.Tap()
        .maxDistance(8)
        .onBegin(() => {
            pressScale.value = withSpring(0.93, { damping: 15, stiffness: 400 });
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        })
        .onFinalize((_, success) => {
            pressScale.value = withSpring(1, { damping: 12, stiffness: 300 });
            if (success) runOnJS(onPress)();
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pressScale.value }],
    }));

    return (
        <GestureDetector gesture={tapGesture}>
            <Animated.View
                shouldRasterizeIOS
                renderToHardwareTextureAndroid
                style={[
                    styles.card,
                    {
                        width: cardWidth,
                        height: cardHeight,
                        backgroundColor: assignedColor,
                        position: 'absolute',
                        left: x,
                        top: y,
                    },
                    isNewest && styles.cardNewest,
                    animatedStyle,
                ]}
            >
                {/* Media */}
                <View style={StyleSheet.absoluteFill}>
                    <FilmMedia
                        uri={film.uri}
                        thumbnail={film.thumbnail}
                        type={film.type as 'image' | 'video'}
                    />
                    
                    {film.overlay_data && (
                        <OverlayRenderer
                            overlayData={film.overlay_data}
                            containerWidth={cardWidth}
                            containerHeight={cardHeight}
                        />
                    )}
                </View>

                {/* Scrim */}
                <View style={styles.scrim} />

                {/* Newest pill */}
                {isNewest && (
                    <View style={styles.newestPill}>
                        <Text style={styles.newestText}>● LATEST</Text>
                    </View>
                )}

                {/* Bottom meta */}
                <View style={styles.bottomMeta}>
                    <Text style={styles.timeText} numberOfLines={1}>
                        {formatRelativeTime(film.createdAt)}
                    </Text>
                    <Text style={styles.typeText}>
                        {film.type === 'video' ? '🎬' : '📷'}
                    </Text>
                </View>
            </Animated.View>
        </GestureDetector>
    );
};

const FilmCard = React.memo(FilmCardBase);
FilmCard.displayName = 'FilmCard';

const styles = StyleSheet.create({
    card: {
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    cardNewest: {
        borderWidth: 2.5,
        borderColor: 'rgba(255,255,255,0.7)',
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.18)',
    },
    newestPill: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(255,59,48,0.85)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
    },
    newestText: {
        color: '#fff',
        fontSize: 8,
        fontFamily: FONTS.bold,
        letterSpacing: 1,
    },
    bottomMeta: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timeText: {
        color: '#fff',
        fontSize: 11,
        fontFamily: FONTS.bold,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
        flex: 1,
    },
    typeText: {
        fontSize: 14,
    },
});

export default FilmCard;