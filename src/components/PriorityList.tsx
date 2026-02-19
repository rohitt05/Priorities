import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Dimensions,
    TouchableOpacity,
    Animated,
    type ViewabilityConfig,
} from 'react-native';
import { FlatList, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path, Text as SvgText, TextPath, Defs } from 'react-native-svg';
import { Feather, MaterialCommunityIcons, Entypo } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS } from '@/constants/theme';

import FilmMyDay from './FilmMyDay';
import { PriorityUser } from './FloatingSearch';
import PriorityMenuModal from './PriorityMenuModal';
import { TapHoldProvider, TapHoldImage } from '../context/TapHoldViewer';

// ==========================================
// CONSTANTS & LAYOUT CALCULATIONS
// ==========================================

const SCREEN_WIDTH = Dimensions.get('window').width;

const LAYOUT = {
    CARD_WIDTH: SCREEN_WIDTH * 0.74,
    get CARD_HEIGHT() { return this.CARD_WIDTH * 1.3; },
    get IMAGE_SIZE() { return this.CARD_WIDTH; },
    SPACING_PER_SIDE: 10,
    get FULL_ITEM_WIDTH() { return this.CARD_WIDTH + this.SPACING_PER_SIDE * 2; },
    get SIDE_PADDING() { return (SCREEN_WIDTH - this.FULL_ITEM_WIDTH) / 2; },
} as const;

const ANIMATION = {
    SPRING_TENSION: 80,
    SPRING_FRICTION: 10,
    SCALE_MIN: 0.85,
    SCALE_MAX: 1,
} as const;

const Z_INDEX = {
    BACKGROUND_TEXT: 0,
    BLOB: 5,
    IMAGE: 10,
    INDICATOR: 15, // New Z-Index for the Dot
    CURVED_TEXT: 20,
    OPTIONS_BUTTON: 25,
} as const;

const BLOB_PATH = 'M46.3,-76.3C59.5,-69.1,69.7,-56.3,77.3,-42.3C84.9,-28.3,89.9,-13.1,88.6,1.4C87.3,15.9,79.7,29.7,70.3,41.9C60.9,54.1,49.7,64.7,37.1,71.2C24.5,77.7,10.5,80.1,-2.9,78.8C-16.3,77.5,-29.1,72.5,-41.4,65.6C-53.7,58.7,-65.5,49.9,-74.1,38.6C-82.7,27.3,-88.1,13.5,-86.9,0.3C-85.7,-12.9,-77.9,-25.5,-68.2,-36.2C-58.5,-46.9,-46.9,-55.7,-34.5,-63.3C-22.1,-70.9,-8.9,-77.3,5.6,-78.7C20.1,-80.1,40.2,-76.5,46.3,-76.3Z';

// ==========================================
// TYPESCRIPT INTERFACES
// ==========================================

// Extended locally to support the visual "dot" logic
interface PriorityUserWithPost extends PriorityUser {
    hasNewPost?: boolean; // Controls the dot visibility
}

export interface PriorityListProps {
    priorities: PriorityUserWithPost[];
    onColorChange?: (color: string) => void;
}

interface PriorityCardProps {
    item: PriorityUserWithPost;
    isActive: boolean;
    onOptionsPress: () => void;
}

interface BlobBackgroundProps {
    color: string;
    size: number;
}

interface CurvedTextProps {
    text: string;
    width: number;
}

interface CallIconsProps {
    visible: boolean;
}

interface OptionsButtonProps {
    onPress: () => void;
    size: number;
}

interface PostIndicatorProps {
    visible: boolean;
    size: number;
    color?: string;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

const calculateOptionsButtonPosition = (
    size: number,
    angleDeg: number = -45,
    buttonRadius: number = 18
) => {
    const radius = size / 2;
    const angleRad = (angleDeg * Math.PI) / 180;

    return {
        top: radius + radius * Math.sin(angleRad) - buttonRadius,
        left: radius + radius * Math.cos(angleRad) - buttonRadius,
    };
};

// Calculate position for the "Has Post" dot (e.g., bottom-right)
const calculateIndicatorPosition = (
    size: number,
    angleDeg: number = 45, // 45 degrees is bottom-right quadrant relative to center
    indicatorRadius: number = 10
) => {
    const radius = size / 2;
    const angleRad = (angleDeg * Math.PI) / 180;

    return {
        top: radius + radius * Math.sin(angleRad) - indicatorRadius,
        left: radius + radius * Math.cos(angleRad) - indicatorRadius,
    };
};

const generateCurvedTextPath = (width: number) => {
    const imageRadius = width / 2;
    const textRadius = imageRadius + 4;
    const svgWidth = textRadius * 2 + 20;

    return {
        d: `M 20,${textRadius} A ${textRadius},${textRadius} 0 0,1 ${svgWidth - 20},${textRadius}`,
        svgWidth,
        svgHeight: textRadius + 10,
        textRadius,
    };
};

// ==========================================
// MEMOIZED SUB-COMPONENTS
// ==========================================

const BlobBackground = React.memo<BlobBackgroundProps>(({ color, size }) => {
    const containerSize = size * 1.25;

    return (
        <View
            pointerEvents="none"
            style={[
                styles.blobContainer,
                { width: containerSize, height: containerSize }
            ]}
        >
            <Svg viewBox="-100 -100 200 200" width="100%" height="100%">
                <Path d={BLOB_PATH} fill={color} opacity={0.12} />
            </Svg>
        </View>
    );
});
BlobBackground.displayName = 'BlobBackground';

const CurvedText = React.memo<CurvedTextProps>(({ text, width }) => {
    const { d, svgWidth, svgHeight, textRadius } = useMemo(
        () => generateCurvedTextPath(width),
        [width]
    );
    const pathId = 'outerArc';

    return (
        <View
            pointerEvents="none"
            style={[
                styles.curvedTextWrapper,
                {
                    width: svgWidth,
                    height: textRadius * 0.5,
                }
            ]}
        >
            <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                <Defs>
                    <Path id={pathId} d={d} fill="none" />
                </Defs>
                <SvgText
                    fill={COLORS.primary}
                    fontSize="36"
                    fontFamily={FONTS.bold}
                    fontWeight="900"
                    textAnchor="middle"
                    letterSpacing="2"
                >
                    <TextPath href={`#${pathId}`} startOffset="50%">
                        {text}
                    </TextPath>
                </SvgText>
            </Svg>
        </View>
    );
});
CurvedText.displayName = 'CurvedText';

const CallIcons = React.memo<CallIconsProps>(({ visible }) => {
    const scaleAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: visible ? 1 : 0,
            useNativeDriver: true,
            tension: ANIMATION.SPRING_TENSION,
            friction: ANIMATION.SPRING_FRICTION,
        }).start();
    }, [visible, scaleAnim]);

    if (!visible) return null;

    const animatedStyle = {
        transform: [{
            scale: scaleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [ANIMATION.SCALE_MIN, ANIMATION.SCALE_MAX],
            }),
        }],
        opacity: scaleAnim,
    };

    return (
        <Animated.View style={[styles.callIconsContainer, animatedStyle]}>
            <TouchableOpacity
                activeOpacity={0.9}
                style={styles.callIconBubble}
                accessibilityLabel="Video call"
                accessibilityRole="button"
            >
                <MaterialCommunityIcons
                    name="video-outline"
                    size={20}
                    color={COLORS.text}
                />
            </TouchableOpacity>

            <View style={styles.callIconSpacer} />

            <TouchableOpacity
                activeOpacity={0.9}
                style={styles.callIconBubble}
                accessibilityLabel="Voice call"
                accessibilityRole="button"
            >
                <Feather name="phone-call" size={19} color={COLORS.text} />
            </TouchableOpacity>
        </Animated.View>
    );
});
CallIcons.displayName = 'CallIcons';

const OptionsButton = React.memo<OptionsButtonProps>(({ onPress, size }) => {
    const position = useMemo(() => calculateOptionsButtonPosition(size), [size]);

    return (
        <TouchableOpacity
            style={[styles.optionsButton, position]}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityLabel="Options menu"
            accessibilityRole="button"
        >
            <View style={styles.optionsIconBlur}>
                <Entypo name="dots-two-horizontal" size={20} color={COLORS.text} />
            </View>
        </TouchableOpacity>
    );
});
OptionsButton.displayName = 'OptionsButton';

/**
 * The visual "Dot" indicating a new post/priority
 */
const PostIndicator = React.memo<PostIndicatorProps>(({ visible, size, color }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Pulse animation for the "alive" feel
    useEffect(() => {
        if (visible) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [visible]);

    if (!visible) return null;

    const position = calculateIndicatorPosition(size, 45, 12); // 45 degrees, 12px radius

    return (
        <Animated.View
            style={[
                styles.postIndicator,
                position,
                {
                    backgroundColor: color || COLORS.primary, // Use user's color or primary
                    transform: [{ scale: pulseAnim }],
                }
            ]}
        />
    );
});
PostIndicator.displayName = 'PostIndicator';

/**
 * Individual priority user card
 */
const PriorityCard = React.memo<PriorityCardProps>(
    ({ item, isActive, onOptionsPress }) => {
        const dominantColor = item.dominantColor || COLORS.primary;

        return (
            <View style={styles.cardContainer}>
                {/* Background Text */}
                <View pointerEvents="none" style={styles.backgroundTextContainer}>
                    <Text
                        style={styles.backgroundText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                    >
                        {item.name}
                    </Text>
                </View>

                {/* Blob */}
                <BlobBackground color={dominantColor} size={LAYOUT.IMAGE_SIZE} />

                {/* Curved Name */}
                <CurvedText text={item.name} width={LAYOUT.IMAGE_SIZE} />

                {/* Main Image + Overlays */}
                <View style={styles.imageWrapper} pointerEvents="box-none">
                    <TapHoldImage
                        source={{ uri: item.profilePicture }}
                        style={styles.circularImage}
                    />

                    {/* THE NEW DOT INDICATOR */}
                    <PostIndicator
                        visible={!!item.hasNewPost} // Triggers if prop is true
                        size={LAYOUT.IMAGE_SIZE}
                        color={dominantColor}
                    />

                    <CallIcons visible={isActive} />
                    {isActive && (
                        <OptionsButton
                            size={LAYOUT.IMAGE_SIZE}
                            onPress={onOptionsPress}
                        />
                    )}
                </View>
            </View>
        );
    },
    (prev, next) =>
        prev.isActive === next.isActive &&
        prev.item.id === next.item.id &&
        prev.item.hasNewPost === next.item.hasNewPost // Check for post updates
);
PriorityCard.displayName = 'PriorityCard';


// ==========================================
// MAIN COMPONENT
// ==========================================

const PriorityListContent: React.FC<PriorityListProps> = ({
    priorities,
    onColorChange
}) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPinSheetVisible, setIsPinSheetVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<PriorityUserWithPost | null>(null);
    const [pinnedIds, setPinnedIds] = useState<string[]>([]);

    const flatListRef = useRef<FlatList>(null);

    const displayPriorities = useMemo(() => {
        if (pinnedIds.length === 0) return priorities;

        const pinnedSet = new Set(pinnedIds);
        const pinned = priorities.filter(p => pinnedSet.has(p.id));
        const unpinned = priorities.filter(p => !pinnedSet.has(p.id));

        return [...pinned, ...unpinned];
    }, [priorities, pinnedIds]);

    const initialIndex = useMemo(
        () => Math.max(0, Math.floor(displayPriorities.length / 2)),
        [displayPriorities.length]
    );

    const isSelectedPinned = useMemo(
        () => selectedUser ? pinnedIds.includes(selectedUser.id) : false,
        [selectedUser, pinnedIds]
    );

    useEffect(() => {
        if (activeIndex > displayPriorities.length - 1) {
            setActiveIndex(Math.max(0, displayPriorities.length - 1));
        }
    }, [displayPriorities.length, activeIndex]);

    const viewabilityConfig = useRef<ViewabilityConfig>({
        itemVisiblePercentThreshold: 60,
        minimumViewTime: 10,
    }).current;

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems?.length > 0) {
            const centered = viewableItems[0];
            if (centered?.index !== null && centered?.index !== undefined) {
                setActiveIndex(centered.index);

                if (centered.item?.dominantColor) {
                    onColorChange?.(centered.item.dominantColor);
                }
            }
        }
    }).current;

    const getItemLayout = useCallback(
        (_: any, index: number) => ({
            length: LAYOUT.FULL_ITEM_WIDTH,
            offset: LAYOUT.FULL_ITEM_WIDTH * index,
            index,
        }),
        []
    );

    const openPinSheetForUser = useCallback((user: PriorityUserWithPost) => {
        setSelectedUser(user);
        setIsPinSheetVisible(true);
    }, []);

    const handlePin = useCallback(() => {
        if (!selectedUser) return;
        setPinnedIds(prev =>
            prev.includes(selectedUser.id)
                ? prev
                : [selectedUser.id, ...prev]
        );
        setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: 0, animated: true });
        }, 100);
    }, [selectedUser]);

    const handleUnpin = useCallback(() => {
        if (!selectedUser) return;
        setPinnedIds(prev => prev.filter(id => id !== selectedUser.id));
    }, [selectedUser]);

    const renderItem = useCallback(
        ({ item, index }: { item: PriorityUserWithPost; index: number }) => (
            <PriorityCard
                item={item}
                isActive={index === activeIndex}
                onOptionsPress={() => openPinSheetForUser(item)}
            />
        ),
        [activeIndex, openPinSheetForUser]
    );

    if (displayPriorities.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <FilmMyDay />

            <FlatList
                ref={flatListRef}
                data={displayPriorities}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.flatListContent}
                snapToInterval={LAYOUT.FULL_ITEM_WIDTH}
                snapToAlignment="start"
                decelerationRate="fast"
                initialScrollIndex={initialIndex}
                getItemLayout={getItemLayout}
                removeClippedSubviews
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={5}
                renderItem={renderItem}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                overScrollMode="never"
                nestedScrollEnabled
            />

            <PriorityMenuModal
                visible={isPinSheetVisible}
                onClose={() => setIsPinSheetVisible(false)}
                isPinned={isSelectedPinned}
                onPin={handlePin}
                onUnpin={handleUnpin}
                userName={selectedUser?.name || 'User'}
            />
        </View>
    );
};

const PriorityList: React.FC<PriorityListProps> = props => {
    return (
        <GestureHandlerRootView style={styles.rootContainer}>
            <TapHoldProvider>
                <PriorityListContent {...props} />
            </TapHoldProvider>
        </GestureHandlerRootView>
    );
};

// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({
    rootContainer: {
        flex: 1,
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        height: '100%',
        marginVertical: 0,
    },
    flatListContent: {
        paddingHorizontal: LAYOUT.SIDE_PADDING,
        alignItems: 'center',
        paddingVertical: 30,
    },
    cardContainer: {
        width: LAYOUT.CARD_WIDTH,
        marginHorizontal: LAYOUT.SPACING_PER_SIDE,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
    },
    blobContainer: {
        position: 'absolute',
        zIndex: Z_INDEX.BLOB,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backgroundTextContainer: {
        position: 'absolute',
        top: -70,
        width: '130%',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: Z_INDEX.BACKGROUND_TEXT,
    },
    backgroundText: {
        fontSize: 48,
        fontFamily: 'DancingScript-Bold',
        color: COLORS.primary,
        opacity: 0.3,
        textAlign: 'center',
        letterSpacing: 1,
    },
    curvedTextWrapper: {
        marginBottom: -85,
        zIndex: Z_INDEX.CURVED_TEXT,
        alignItems: 'center',
        justifyContent: 'flex-end',
        overflow: 'visible',
    },
    imageWrapper: {
        width: LAYOUT.IMAGE_SIZE,
        height: LAYOUT.IMAGE_SIZE,
        borderRadius: LAYOUT.IMAGE_SIZE / 2,
        zIndex: Z_INDEX.IMAGE,
        position: 'relative',
        overflow: 'visible',
    },
    circularImage: {
        width: '100%',
        height: '100%',
        borderRadius: LAYOUT.IMAGE_SIZE / 2,
        backgroundColor: '#F0EFE9',
        resizeMode: 'cover',
    },
    // STYLES FOR THE DOT INDICATOR
    postIndicator: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#FFF',
        zIndex: Z_INDEX.INDICATOR,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 5,
    },
    callIconsContainer: {
        position: 'absolute',
        bottom: -60,
        alignSelf: 'center',
        flexDirection: 'row',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 4,
    },
    callIconBubble: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    callIconSpacer: {
        width: 12,
    },
    optionsButton: {
        position: 'absolute',
        zIndex: Z_INDEX.OPTIONS_BUTTON,
        elevation: 10,
    },
    optionsIconBlur: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3.84,
        elevation: 5,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
});

export default PriorityList;
