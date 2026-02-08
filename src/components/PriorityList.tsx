import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Image,
    Dimensions,
    TouchableOpacity,
    Animated,
    FlatList,
} from 'react-native';
import Svg, { Path, Text as SvgText, TextPath, Defs } from 'react-native-svg';
import { Feather, MaterialCommunityIcons, FontAwesome, Entypo } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS } from '@/constants/theme';
import { PriorityUser } from './FloatingSearch';
import { useBackground } from '@/context/BackgroundContext';
import EmojiScatterOverlay from './EmojiScatterOverlay';

const { width } = Dimensions.get('window');

// 1. DIMENSIONS
const CARD_WIDTH = width * 0.74;
const CARD_HEIGHT = CARD_WIDTH * 1.3;
const IMAGE_SIZE = CARD_WIDTH;
const SPACING_PER_SIDE = 10;
const FULL_ITEM_WIDTH = CARD_WIDTH + (SPACING_PER_SIDE * 2);
const SIDE_PADDING = (width - FULL_ITEM_WIDTH) / 2;

export interface PriorityListProps {
    priorities: PriorityUser[];
    onColorChange?: (color: string) => void;
    onEmojiSelect?: (emoji: string) => void;
}

// --- SUB-COMPONENTS (MEMOIZED) ---

const BlobBackground = React.memo(({ color, size }: { color: string; size: number }) => {
    const smoothBlobPath = `
      M46.3,-76.3C59.5,-69.1,69.7,-56.3,77.3,-42.3C84.9,-28.3,89.9,-13.1,88.6,1.4C87.3,15.9,79.7,29.7,70.3,41.9C60.9,54.1,49.7,64.7,37.1,71.2C24.5,77.7,10.5,80.1,-2.9,78.8C-16.3,77.5,-29.1,72.5,-41.4,65.6C-53.7,58.7,-65.5,49.9,-74.1,38.6C-82.7,27.3,-88.1,13.5,-86.9,0.3C-85.7,-12.9,-77.9,-25.5,-68.2,-36.2C-58.5,-46.9,-46.9,-55.7,-34.5,-63.3C-22.1,-70.9,-8.9,-77.3,5.6,-78.7C20.1,-80.1,40.2,-76.5,46.3,-76.3Z
    `;
    return (
        <View style={[styles.blobContainer, { width: size * 1.25, height: size * 1.25 }]}>
            <Svg viewBox="-100 -100 200 200" width="100%" height="100%">
                <Path d={smoothBlobPath} fill={color} opacity={0.12} />
            </Svg>
        </View>
    );
});

const CurvedText = React.memo(({ text, width }: { text: string; width: number }) => {
    const imageRadius = width / 2;
    const textRadius = imageRadius + 4;
    const svgWidth = textRadius * 2 + 20;
    const svgHeight = textRadius + 10;
    const pathId = "outerArc";
    const d = `M 20,${textRadius} A ${textRadius},${textRadius} 0 0,1 ${svgWidth - 20},${textRadius}`;

    return (
        <View style={{
            width: svgWidth,
            height: textRadius * 0.5,
            marginBottom: -85,
            zIndex: 20,
            alignItems: 'center',
            justifyContent: 'flex-end',
            overflow: 'visible'
        }}>
            <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                <Defs><Path id={pathId} d={d} fill="none" /></Defs>
                <SvgText
                    fill={COLORS.primary}
                    fontSize="36"
                    fontFamily={FONTS.bold}
                    fontWeight="900"
                    textAnchor="middle"
                    letterSpacing="2"
                >
                    <TextPath href={`#${pathId}`} startOffset="50%">{text}</TextPath>
                </SvgText>
            </Svg>
        </View>
    );
});

const ActionButton = React.memo(({
    icon,
    style,
    scaleAnim,
    extraScale = 1,
    onPress,
}: {
    icon: React.ReactNode,
    style: any,
    scaleAnim: Animated.Value,
    extraScale?: number,
    onPress?: () => void
}) => {
    const { backgroundColor, ...layoutStyles } = style;

    return (
        <Animated.View style={[
            layoutStyles,
            {
                opacity: scaleAnim,
                transform: [{
                    scale: scaleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, extraScale]
                    })
                }]
            }
        ]}>
            <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
                <Animated.View style={[
                    styles.innerButton,
                    { backgroundColor }
                ]}>
                    {icon}
                </Animated.View>
            </TouchableOpacity>
        </Animated.View>
    );
});

const ActionIcons = React.memo(({ size, visible, onEmojiPress }: { size: number, visible: boolean, onEmojiPress: () => void }) => {
    const { bgColor, prevBgColor, colorAnim } = useBackground();
    const scaleAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(scaleAnim, {
            toValue: visible ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [visible]);

    const animatedGlassTint = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor]
    });

    const radius = size / 2;
    const buttonSize = 50;
    const halfButton = buttonSize / 2;
    const distanceFromCenter = radius + 35;

    const getPosition = (angleDeg: number) => {
        const angleRad = (angleDeg * Math.PI) / 180;
        return {
            left: radius + (distanceFromCenter * Math.cos(angleRad)) - halfButton,
            top: radius + (distanceFromCenter * Math.sin(angleRad)) - halfButton
        };
    };

    const pos1 = getPosition(135);
    const pos2 = getPosition(105);
    const pos3 = getPosition(75);
    const pos4 = getPosition(45);

    const baseContainerStyle = {
        width: 50, height: 50, position: 'absolute' as 'absolute',
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
        elevation: 6, zIndex: 20, shadowOpacity: 0.12, shadowRadius: 8
    };

    return (
        <View style={[styles.actionContainer, { width: size, height: size }]} pointerEvents={visible ? 'auto' : 'none'}>
            <ActionButton
                scaleAnim={scaleAnim}
                style={{ ...baseContainerStyle, left: pos1.left, top: pos1.top, backgroundColor: animatedGlassTint }}
                icon={<Entypo name="emoji-happy" size={22} color={COLORS.text} />}
                onPress={onEmojiPress}
            />
            <ActionButton
                scaleAnim={scaleAnim}
                style={{ ...baseContainerStyle, left: pos2.left, top: pos2.top, backgroundColor: animatedGlassTint }}
                icon={<FontAwesome name="camera-retro" size={22} color={COLORS.text} />}
            />
            <ActionButton
                scaleAnim={scaleAnim}
                extraScale={1.1}
                style={{ ...baseContainerStyle, left: pos3.left, top: pos3.top, backgroundColor: animatedGlassTint }}
                icon={<MaterialCommunityIcons name="video-wireless-outline" size={28} color={COLORS.text} />}
            />
            <ActionButton
                scaleAnim={scaleAnim}
                style={{ ...baseContainerStyle, left: pos4.left, top: pos4.top, backgroundColor: animatedGlassTint }}
                icon={<Feather name="phone-call" size={22} color={COLORS.text} />}
            />
        </View>
    );
});

// 2. PRIORITY CARD (Memoized)
const PriorityCard = React.memo(({ item, isActive, onEmojiTrigger }: { item: PriorityUser, isActive: boolean, onEmojiTrigger: () => void }) => {
    return (
        <View style={styles.cardContainer}>
            <View style={styles.backgroundTextContainer}>
                <Text style={styles.backgroundText} numberOfLines={1} adjustsFontSizeToFit={true}>
                    {item.name}
                </Text>
            </View>
            <BlobBackground color={item.dominantColor || COLORS.primary} size={IMAGE_SIZE} />
            <CurvedText text={item.name} width={IMAGE_SIZE} />
            <View style={styles.imageWrapper}>
                <Image source={{ uri: item.profilePicture }} style={styles.circularImage} />
                <ActionIcons size={IMAGE_SIZE} visible={isActive} onEmojiPress={onEmojiTrigger} />
            </View>
        </View>
    );
}, (prev, next) => prev.isActive === next.isActive && prev.item.id === next.item.id);

const PriorityList: React.FC<PriorityListProps> = ({ priorities, onColorChange, onEmojiSelect }) => {
    const initialIndex = Math.max(0, Math.floor(priorities.length / 2));
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const [isEmojiPickerVisible, setIsEmojiPickerVisible] = useState(false);

    const handleEmojiSelect = useCallback((emoji: string) => {
        if (onEmojiSelect) onEmojiSelect(emoji);
        setIsEmojiPickerVisible(false);
    }, [onEmojiSelect]);

    // 3. FIXED ViewabilityConfig
    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 60,
        minimumViewTime: 10,
    }).current;

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            const centered = viewableItems[0];
            if (centered.index !== null) {
                setActiveIndex(centered.index);
                if (centered.item.dominantColor) {
                    onColorChange?.(centered.item.dominantColor);
                }
            }
        }
    }).current;

    const getItemLayout = useCallback((_: any, index: number) => ({
        length: FULL_ITEM_WIDTH,
        offset: FULL_ITEM_WIDTH * index,
        index,
    }), []);

    const renderItem = useCallback(({ item, index }: { item: PriorityUser, index: number }) => (
        <PriorityCard
            item={item}
            isActive={index === activeIndex}
            onEmojiTrigger={() => setIsEmojiPickerVisible(true)}
        />
    ), [activeIndex]);

    if (priorities.length === 0) return null;

    return (
        <View style={styles.container}>
            <FlatList
                data={priorities}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.flatListContent}
                snapToInterval={FULL_ITEM_WIDTH}
                snapToAlignment="start"
                decelerationRate="fast"
                initialScrollIndex={initialIndex}
                getItemLayout={getItemLayout}
                removeClippedSubviews={true}
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={5}
                renderItem={renderItem}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
            />

            {isEmojiPickerVisible && (
                <EmojiScatterOverlay
                    visible={isEmojiPickerVisible}
                    onClose={() => setIsEmojiPickerVisible(false)}
                    onSelect={handleEmojiSelect}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: SPACING.md,
        height: CARD_HEIGHT + 60,
        flexGrow: 0,
        zIndex: 1,
    },
    flatListContent: {
        paddingHorizontal: SIDE_PADDING,
        alignItems: 'center',
        paddingVertical: 30,
    },
    cardContainer: {
        width: CARD_WIDTH,
        marginHorizontal: SPACING_PER_SIDE,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
    },
    blobContainer: {
        position: 'absolute',
        zIndex: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backgroundTextContainer: {
        position: 'absolute',
        top: -70,
        width: '130%',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 0,
    },
    backgroundText: {
        fontSize: 48,
        fontFamily: 'DancingScript-Bold',
        color: COLORS.primary,
        opacity: 0.3,
        textAlign: 'center',
        letterSpacing: 1,
    },
    imageWrapper: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        borderRadius: IMAGE_SIZE / 2,
        zIndex: 10,
        position: 'relative',
        overflow: 'visible',
    },
    circularImage: {
        width: '100%',
        height: '100%',
        borderRadius: IMAGE_SIZE / 2,
        backgroundColor: '#F0EFE9',
        resizeMode: 'cover',
    },
    actionContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 20,
    },
    innerButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255, 0.6)',
        opacity: 0.95,
    },
});

export default PriorityList;
