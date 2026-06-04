import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Dimensions,
    Pressable,
    Text,
} from 'react-native';
import { useFonts } from 'expo-font';
import Animated, {
    useSharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    interpolate,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    withSpring,
} from 'react-native-reanimated';
import Svg, {
    Path,
    Circle,
    Defs,
    RadialGradient,
    Stop,
    Text as SvgText,
    TextPath,
    Line,
} from 'react-native-svg';
import { FlatList as GHFlatList } from 'react-native-gesture-handler';
import { COLORS, FONTS } from '@/theme/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

const LAYOUT = {
    CARD_WIDTH: SCREEN_WIDTH * 0.58,
    get IMAGE_SIZE() {
        return this.CARD_WIDTH;
    },
    SPACING_PER_SIDE: 18,
    get FULL_ITEM_WIDTH() {
        return this.CARD_WIDTH + this.SPACING_PER_SIDE * 2;
    },
    get SIDE_PADDING() {
        return (SCREEN_WIDTH - this.FULL_ITEM_WIDTH) / 2;
    },
} as const;

const BLOB_PATH =
    'M46.3,-76.3C59.5,-69.1,69.7,-56.3,77.3,-42.3C84.9,-28.3,89.9,-13.1,88.6,1.4C87.3,15.9,79.7,29.7,70.3,41.9C60.9,54.1,49.7,64.7,37.1,71.2C24.5,77.7,10.5,80.1,-2.9,78.8C-16.3,77.5,-29.1,72.5,-41.4,65.6C-53.7,58.7,-65.5,49.9,-74.1,38.6C-82.7,27.3,-88.1,13.5,-86.9,0.3C-85.7,-12.9,-77.9,-25.5,-68.2,-36.2C-58.5,-46.9,-46.9,-55.7,-34.5,-63.3C-22.1,-70.9,-8.9,-77.3,5.6,-78.7C20.1,-80.1,40.2,-76.5,46.3,-76.3Z';

const GHOST_THEMES = [
    { id: 'ghost-1', accent: '#E8A598', petName: 'sweetheart' },
    { id: 'ghost-2', accent: '#A8C5DA', petName: 'bhiduuu' },
    { id: 'ghost-3', accent: '#C4B5D4', petName: 'tedha hai pr mera hai' },
    { id: 'ghost-4', accent: '#B8D8C2', petName: 'kam chor' },
    { id: 'ghost-5', accent: '#E0C39B', petName: 'queenie' },
    { id: 'ghost-6', accent: '#D8B4A0', petName: 'cutie' },
    { id: 'ghost-7', accent: '#AFC7D9', petName: 'my 2 am' },
    { id: 'ghost-8', accent: '#D6B8E8', petName: 'pagal' },
    { id: 'ghost-9', accent: '#C7D9B7', petName: 'meri jaan' },
] as const;

type GhostTheme = typeof GHOST_THEMES[number];

const CENTER_INDEX = Math.floor(GHOST_THEMES.length / 2);

const AnimatedFlatList = Animated.createAnimatedComponent(GHFlatList);

interface EmptyPriorityStateProps {
    myUniqueId: string;
    onColorChange?: (color: string) => void;
}

const useShimmer = () => {
    const shimmer = useSharedValue(0);

    useEffect(() => {
        shimmer.value = withRepeat(
            withSequence(
                withTiming(1, {
                    duration: 1400,
                    easing: Easing.inOut(Easing.ease),
                }),
                withTiming(0, {
                    duration: 1400,
                    easing: Easing.inOut(Easing.ease),
                }),
            ),
            -1,
            false,
        );
    }, [shimmer]);

    return shimmer;
};

const GhostPlus = ({
    size,
    isVisible,
}: {
    size: number;
    isVisible: boolean;
}) => {
    const opacity = useSharedValue(isVisible ? 1 : 0);
    const scale = useSharedValue(isVisible ? 1 : 0.86);

    useEffect(() => {
        opacity.value = withTiming(isVisible ? 1 : 0, {
            duration: 220,
            easing: Easing.inOut(Easing.ease),
        });
        scale.value = withSpring(isVisible ? 1 : 0.86, {
            damping: 13,
            stiffness: 180,
        });
    }, [isVisible, opacity, scale]);

    const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    const iconSize = size * 0.18;
    const strokeWidth = 2.8;

    return (
        <Animated.View pointerEvents="none" style={[ghostStyles.plusWrap, animStyle]}>
            <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
                <Line
                    x1="12"
                    y1="5"
                    x2="12"
                    y2="19"
                    stroke={COLORS.text}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />
                <Line
                    x1="5"
                    y1="12"
                    x2="19"
                    y2="12"
                    stroke={COLORS.text}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />
            </Svg>
        </Animated.View>
    );
};

const GhostBlob = ({
    size,
    isActive,
    accent,
}: {
    size: number;
    isActive: boolean;
    accent: string;
}) => {
    const blobOpacity = useSharedValue(isActive ? 0.26 : 0.15);
    const blobScale = useSharedValue(isActive ? 1 : 0.94);

    useEffect(() => {
        blobOpacity.value = withTiming(isActive ? 0.26 : 0.15, { duration: 280 });
        blobScale.value = withTiming(isActive ? 1 : 0.94, {
            duration: 280,
            easing: Easing.out(Easing.ease),
        });
    }, [isActive, blobOpacity, blobScale]);

    const animStyle = useAnimatedStyle(() => ({
        opacity: blobOpacity.value,
        transform: [{ scale: blobScale.value }],
    }));

    const containerSize = size * 1.32;

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                ghostStyles.blobContainer,
                { width: containerSize, height: containerSize },
                animStyle,
            ]}
        >
            <Svg viewBox="-100 -100 200 200" width="100%" height="100%">
                <Path d={BLOB_PATH} fill={accent} opacity={1} />
            </Svg>

            <GhostPlus size={size} isVisible={isActive} />
        </Animated.View>
    );
};

const GhostCircle = ({
    size,
    isActive,
    accent,
    gradientId,
    pressed,
}: {
    size: number;
    isActive: boolean;
    accent: string;
    gradientId: string;
    pressed: boolean;
}) => {
    const shimmer = useShimmer();
    const pressScale = useSharedValue(1);

    useEffect(() => {
        pressScale.value = withSpring(pressed ? 0.97 : 1, {
            damping: 12,
            stiffness: 180,
        });
    }, [pressed, pressScale]);

    const shimmerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            shimmer.value,
            [0, 1],
            [isActive ? 0.14 : 0.06, isActive ? 0.24 : 0.12]
        ),
    }));

    const scaleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pressScale.value }],
        opacity: withTiming(isActive ? 1 : 0.58, { duration: 280 }),
    }));

    const radius = size / 2;

    return (
        <Animated.View
            style={[
                {
                    width: size,
                    height: size,
                    borderRadius: radius,
                    overflow: 'hidden',
                },
                scaleStyle,
            ]}
        >
            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                <Defs>
                    <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
                        <Stop offset="0%" stopColor={accent} stopOpacity="0.28" />
                        <Stop offset="70%" stopColor={accent} stopOpacity="0.12" />
                        <Stop offset="100%" stopColor={accent} stopOpacity="0.04" />
                    </RadialGradient>
                </Defs>

                <Circle cx={radius} cy={radius} r={radius} fill={`url(#${gradientId})`} />
                <Circle
                    cx={radius}
                    cy={radius}
                    r={radius - 2}
                    fill="none"
                    stroke={accent}
                    strokeOpacity={0.3}
                    strokeWidth={1.5}
                    strokeDasharray="6 5"
                />
            </Svg>

            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    {
                        borderRadius: radius,
                        backgroundColor: accent,
                    },
                    shimmerStyle,
                ]}
            />
        </Animated.View>
    );
};

const GhostCurvedText = ({
    width,
    isActive,
    accent,
    petName,
}: {
    width: number;
    isActive: boolean;
    accent: string;
    petName: string;
}) => {
    const [fontsLoaded] = useFonts({
        'DancingScript-Bold': require('../../../../assets/fonts/DancingScript-Bold.ttf'),
    });

    const opacity = useSharedValue(isActive ? 1 : 0);
    const scale = useSharedValue(isActive ? 1 : 0.98);

    useEffect(() => {
        opacity.value = withTiming(isActive ? 1 : 0, {
            duration: 240,
            easing: Easing.inOut(Easing.ease),
        });
        scale.value = withTiming(isActive ? 1 : 0.98, {
            duration: 240,
            easing: Easing.out(Easing.ease),
        });
    }, [isActive, opacity, scale]);

    const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: -28 }, { scale: scale.value }],
    }));

    const textRadius = width / 2 + 18;
    const svgWidth = textRadius * 2 + 20;
    const svgHeight = textRadius + 48;
    const d = `M 20,${textRadius} A ${textRadius},${textRadius} 0 0,1 ${svgWidth - 20},${textRadius}`;
    const pathId = `outerArc-${petName.replace(/\s+/g, '-').toLowerCase()}`;

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                ghostStyles.curvedTextWrapper,
                { width: svgWidth },
                animStyle,
            ]}
        >
            <Svg
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            >
                <Defs>
                    <Path id={pathId} d={d} fill="none" />
                </Defs>

                {fontsLoaded ? (
                    <SvgText
                        fill={COLORS.textSecondary}
                        fontSize="50"
                        fontFamily="DancingScript-Bold"
                        opacity="0.28"
                        textAnchor="middle"
                        letterSpacing="1"
                        dy="6"
                    >
                        <TextPath href={`#${pathId}`} startOffset="50%">
                            {petName}
                        </TextPath>
                    </SvgText>
                ) : null}

                <SvgText
                    fill={COLORS.primary}
                    fontSize={petName.length > 14 ? '22' : '30'}
                    fontFamily={FONTS.bold}
                    fontWeight="900"
                    textAnchor="middle"
                    letterSpacing={petName.length > 14 ? '1' : '1.8'}
                >
                    <TextPath href={`#${pathId}`} startOffset="50%">
                        {petName}
                    </TextPath>
                </SvgText>
            </Svg>
        </Animated.View>
    );
};

const GhostCard = React.memo(
    ({
        theme,
        isActive,
    }: {
        theme: GhostTheme;
        isActive: boolean;
    }) => {
        const [pressed, setPressed] = useState(false);
        const cardScale = useSharedValue(1);

        useEffect(() => {
            cardScale.value = withSpring(pressed ? 0.98 : 1, {
                damping: 12,
                stiffness: 190,
            });
        }, [pressed, cardScale]);

        const cardAnimatedStyle = useAnimatedStyle(() => ({
            transform: [{ scale: cardScale.value }],
            opacity: withTiming(isActive ? 1 : 0.88, { duration: 220 }),
        }));

        return (
            <Pressable
                onPressIn={() => setPressed(true)}
                onPressOut={() => setPressed(false)}
                style={ghostStyles.pressable}
            >
                <Animated.View style={[ghostStyles.cardContainer, cardAnimatedStyle]}>
                    <GhostBlob size={LAYOUT.IMAGE_SIZE} isActive={isActive} accent={theme.accent} />

                    <GhostCurvedText
                        width={LAYOUT.IMAGE_SIZE}
                        isActive={isActive}
                        accent={theme.accent}
                        petName={theme.petName}
                    />

                    <View style={ghostStyles.imageWrapper}>
                        <GhostCircle
                            size={LAYOUT.IMAGE_SIZE}
                            isActive={isActive}
                            accent={theme.accent}
                            gradientId={`ghostGrad-${theme.id}`}
                            pressed={pressed}
                        />
                    </View>
                </Animated.View>
            </Pressable>
        );
    }
);

GhostCard.displayName = 'GhostCard';

export default function EmptyPriorityState({
    myUniqueId,
    onColorChange,
}: EmptyPriorityStateProps) {
    const scrollX = useSharedValue(0);
    const [activeIndex, setActiveIndex] = useState(CENTER_INDEX);

    useEffect(() => {
        onColorChange?.(GHOST_THEMES[CENTER_INDEX].accent);
    }, [onColorChange]);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollX.value = event.contentOffset.x;
        },
    });

    const onViewableItemsChanged = useRef(
        ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
            if (viewableItems?.length > 0 && viewableItems[0]?.index != null) {
                const index = viewableItems[0].index;
                setActiveIndex(index);
                onColorChange?.(GHOST_THEMES[index]?.accent ?? COLORS.background);
            }
        }
    ).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 55,
        minimumViewTime: 0,
    }).current;

    const renderItem = useCallback(
        ({ item, index }: { item: GhostTheme; index: number }) => (
            <GhostCard theme={item} isActive={index === activeIndex} />
        ),
        [activeIndex],
    );

    return (
        <View style={ghostStyles.outerContainer} pointerEvents="box-none">
            <View style={ghostStyles.carouselWrapper}>
                <AnimatedFlatList
                    data={GHOST_THEMES}
                    keyExtractor={((item: any) => item.id) as (item: unknown, index: number) => string}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={ghostStyles.flatListContent}
                    snapToInterval={LAYOUT.FULL_ITEM_WIDTH}
                    snapToAlignment="start"
                    decelerationRate="fast"
                    disableIntervalMomentum
                    bounces={false}
                    initialScrollIndex={CENTER_INDEX}
                    getItemLayout={
                        ((_: any, index: number) => ({
                            length: LAYOUT.FULL_ITEM_WIDTH,
                            offset: LAYOUT.FULL_ITEM_WIDTH * index,
                            index,
                        })) as (
                            data: ArrayLike<unknown> | null | undefined,
                            index: number
                        ) => { length: number; offset: number; index: number }
                    }
                    initialNumToRender={7}
                    maxToRenderPerBatch={7}
                    windowSize={7}
                    renderItem={renderItem as any}
                    onViewableItemsChanged={onViewableItemsChanged as any}
                    viewabilityConfig={viewabilityConfig}
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                    overScrollMode="never"
                    nestedScrollEnabled
                    style={{ flexGrow: 0 }}
                />
            </View>

            <View style={ghostStyles.bottomHintWrap} pointerEvents="none">
                <Text style={ghostStyles.bottomHintTitle}>Your code</Text>
                <View style={ghostStyles.codePill}>
                    <Text style={ghostStyles.codeText}>
                        {myUniqueId?.trim() ? myUniqueId : 'loading...'}
                    </Text>
                </View>
                <Text style={ghostStyles.bottomHintSubtext}>
                    Share this with someone you want to add.
                </Text>
            </View>
        </View>
    );
}

const ghostStyles = StyleSheet.create({
    outerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 96,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    carouselWrapper: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -28,
    },
    flatListContent: {
        paddingHorizontal: LAYOUT.SIDE_PADDING,
        alignItems: 'center',
        paddingBottom: 12,
    },
    pressable: {
        width: LAYOUT.CARD_WIDTH,
        marginHorizontal: LAYOUT.SPACING_PER_SIDE,
    },
    cardContainer: {
        width: LAYOUT.CARD_WIDTH,
        minHeight: LAYOUT.IMAGE_SIZE * 1.34,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        backgroundColor: 'transparent',
    },
    blobContainer: {
        position: 'absolute',
        zIndex: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    plusWrap: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    curvedTextWrapper: {
        marginBottom: -122,
        zIndex: 30,
        alignItems: 'center',
        justifyContent: 'flex-end',
        overflow: 'visible',
    },
    imageWrapper: {
        width: LAYOUT.IMAGE_SIZE,
        height: LAYOUT.IMAGE_SIZE,
        borderRadius: LAYOUT.IMAGE_SIZE / 2,
        position: 'relative',
        overflow: 'visible',
        zIndex: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 38,
    },
    bottomHintWrap: {
        position: 'absolute',
        bottom: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomHintTitle: {
        fontSize: 12,
        color: COLORS.text,
        opacity: 0.5,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    codePill: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.7)',
        marginBottom: 8,
    },
    codeText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: 0.4,
    },
    bottomHintSubtext: {
        fontSize: 13,
        color: COLORS.text,
        opacity: 0.58,
        textAlign: 'center',
    },
});