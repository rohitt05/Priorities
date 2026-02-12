import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Dimensions,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { FlatList, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path, Text as SvgText, TextPath, Defs } from 'react-native-svg';
import { Feather, MaterialCommunityIcons, Entypo } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS } from '@/constants/theme';

// ✅ Imported above FloatingSearch
import FilmMyDay from './FilmMyDay';
import { PriorityUser } from './FloatingSearch';
import PriorityMenuModal from './PriorityMenuModal';
import { TapHoldProvider, TapHoldImage } from '../context/TapHoldViewer';

const { width } = Dimensions.get('window');

// 1. DIMENSIONS
const CARD_WIDTH = width * 0.74;
const CARD_HEIGHT = CARD_WIDTH * 1.3;
const IMAGE_SIZE = CARD_WIDTH;
const SPACING_PER_SIDE = 10;
const FULL_ITEM_WIDTH = CARD_WIDTH + SPACING_PER_SIDE * 2;
const SIDE_PADDING = (width - FULL_ITEM_WIDTH) / 2;

export interface PriorityListProps {
    priorities: PriorityUser[];
    onColorChange?: (color: string) => void;
}

// ==========================================
// 🔹 SUB-COMPONENTS (MEMOIZED)
// ==========================================

const BlobBackground = React.memo(({ color, size }: { color: string; size: number }) => {
    const smoothBlobPath =
        'M46.3,-76.3C59.5,-69.1,69.7,-56.3,77.3,-42.3C84.9,-28.3,89.9,-13.1,88.6,1.4C87.3,15.9,79.7,29.7,70.3,41.9C60.9,54.1,49.7,64.7,37.1,71.2C24.5,77.7,10.5,80.1,-2.9,78.8C-16.3,77.5,-29.1,72.5,-41.4,65.6C-53.7,58.7,-65.5,49.9,-74.1,38.6C-82.7,27.3,-88.1,13.5,-86.9,0.3C-85.7,-12.9,-77.9,-25.5,-68.2,-36.2C-58.5,-46.9,-46.9,-55.7,-34.5,-63.3C-22.1,-70.9,-8.9,-77.3,5.6,-78.7C20.1,-80.1,40.2,-76.5,46.3,-76.3Z';
    return (
        <View
            pointerEvents="none"
            style={[styles.blobContainer, { width: size * 1.25, height: size * 1.25 }]}
        >
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
    const pathId = 'outerArc';
    const d = `M 20,${textRadius} A ${textRadius},${textRadius} 0 0,1 ${svgWidth - 20},${textRadius}`;

    return (
        <View
            pointerEvents="none"
            style={{
                width: svgWidth,
                height: textRadius * 0.5,
                marginBottom: -85,
                zIndex: 20,
                alignItems: 'center',
                justifyContent: 'flex-end',
                overflow: 'visible',
            }}
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

// small, cute row with video + call icons at bottom center of the circle
const CallIcons = React.memo(({ visible }: { visible: boolean }) => {
    const scaleAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: visible ? 1 : 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
        }).start();
    }, [visible, scaleAnim]);

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.callIconsContainer,
                {
                    transform: [
                        {
                            scale: scaleAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.85, 1],
                            }),
                        },
                    ],
                    opacity: scaleAnim,
                },
            ]}
        >
            <TouchableOpacity activeOpacity={0.9} style={styles.callIconBubble}>
                <MaterialCommunityIcons
                    name="video-outline"
                    size={20}
                    color={COLORS.text}
                />
            </TouchableOpacity>

            <View style={{ width: 12 }} />

            <TouchableOpacity activeOpacity={0.9} style={styles.callIconBubble}>
                <Feather name="phone-call" size={19} color={COLORS.text} />
            </TouchableOpacity>
        </Animated.View>
    );
});

// original top-left dots options button
const OptionsButton = React.memo(({ onPress, size }: any) => {
    const angleDeg = -45;
    const radius = size / 2;
    const buttonRadius = 18;
    const top = radius + radius * Math.sin((angleDeg * Math.PI) / 180) - buttonRadius;
    const left = radius + radius * Math.cos((angleDeg * Math.PI) / 180) - buttonRadius;

    return (
        <TouchableOpacity
            style={[styles.optionsButton, { top, left }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.optionsIconBlur}>
                <Entypo name="dots-two-horizontal" size={20} color={COLORS.text} />
            </View>
        </TouchableOpacity>
    );
});

const PriorityCard = React.memo(
    ({ item, isActive, onOptionsPress }: any) => {
        return (
            <View style={styles.cardContainer}>
                <View pointerEvents="none" style={styles.backgroundTextContainer}>
                    <Text
                        style={styles.backgroundText}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                    >
                        {item.name}
                    </Text>
                </View>

                <BlobBackground color={item.dominantColor || COLORS.primary} size={IMAGE_SIZE} />
                <CurvedText text={item.name} width={IMAGE_SIZE} />

                <View style={styles.imageWrapper} pointerEvents="box-none">
                    <TapHoldImage
                        source={{ uri: item.profilePicture }}
                        style={styles.circularImage}
                    />

                    {/* bottom center: simple video + voice icons */}
                    <CallIcons visible={isActive} />

                    {/* top-left options dots */}
                    {isActive && <OptionsButton size={IMAGE_SIZE} onPress={onOptionsPress} />}
                </View>
            </View>
        );
    },
    (prev, next) => prev.isActive === next.isActive && prev.item.id === next.item.id,
);

// ==========================================
// 🔹 MAIN COMPONENT CONTENT
// ==========================================
const PriorityListContent: React.FC<PriorityListProps> = ({ priorities, onColorChange }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const [isPinSheetVisible, setIsPinSheetVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<PriorityUser | null>(null);
    const [pinnedIds, setPinnedIds] = useState<string[]>([]);

    const displayPriorities = useMemo(() => {
        if (pinnedIds.length === 0) return priorities;
        const pinnedSet = new Set(pinnedIds);
        const pinned = priorities.filter(p => pinnedSet.has(p.id));
        const unpinned = priorities.filter(p => !pinnedSet.has(p.id));
        return [...pinned, ...unpinned];
    }, [priorities, pinnedIds]);

    const initialIndex = useMemo(
        () => Math.max(0, Math.floor(displayPriorities.length / 2)),
        [displayPriorities.length],
    );

    useEffect(() => {
        if (activeIndex > displayPriorities.length - 1) {
            setActiveIndex(Math.max(0, displayPriorities.length - 1));
        }
    }, [displayPriorities.length, activeIndex]);

    const isSelectedPinned = useMemo(
        () => (selectedUser ? pinnedIds.includes(selectedUser.id) : false),
        [selectedUser, pinnedIds],
    );

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 60,
        minimumViewTime: 10,
    }).current;

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems?.length > 0) {
            const centered = viewableItems[0];
            if (centered?.index !== null) {
                setActiveIndex(centered.index);
                if (centered.item?.dominantColor) {
                    onColorChange?.(centered.item.dominantColor);
                }
            }
        }
    }).current;

    const getItemLayout = useCallback(
        (_: any, index: number) => ({
            length: FULL_ITEM_WIDTH,
            offset: FULL_ITEM_WIDTH * index,
            index,
        }),
        [],
    );

    const openPinSheetForUser = useCallback((user: PriorityUser) => {
        setSelectedUser(user);
        setIsPinSheetVisible(true);
    }, []);

    const handlePin = useCallback(() => {
        if (!selectedUser) return;
        setPinnedIds(prev => (prev.includes(selectedUser.id) ? prev : [selectedUser.id, ...prev]));
        setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: 0, animated: true });
        }, 100);
    }, [selectedUser]);

    const handleUnpin = useCallback(() => {
        if (!selectedUser) return;
        setPinnedIds(prev => prev.filter(id => id !== selectedUser.id));
    }, [selectedUser]);

    const renderItem = useCallback(
        ({ item, index }: any) => (
            <PriorityCard
                item={item}
                isActive={index === activeIndex}
                onOptionsPress={() => openPinSheetForUser(item)}
            />
        ),
        [activeIndex],
    );

    if (displayPriorities.length === 0) return null;

    return (
        <View style={styles.container}>
            {/* ✅ Render FilmMyDay Icon Component */}
            <FilmMyDay />

            <FlatList
                ref={flatListRef}
                data={displayPriorities}
                keyExtractor={item => item.id}
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
                overScrollMode="never"
                nestedScrollEnabled={true}
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
        <GestureHandlerRootView style={{ flex: 1 }}>
            <TapHoldProvider>
                <PriorityListContent {...props} />
            </TapHoldProvider>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        height: '100%',
        marginVertical: 0,
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
    blobContainer: { position: 'absolute', zIndex: 5, justifyContent: 'center', alignItems: 'center' },
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
    // bottom center video + call row
    callIconsContainer: {
        position: 'absolute',
        bottom: -60, // ⬇️ moved significantly down to clear the border completely
        alignSelf: 'center',
        flexDirection: 'row',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.96)',
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
        backgroundColor: 'rgba(255,255,255,1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionsButton: { position: 'absolute', zIndex: 25, elevation: 10 },
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
        borderColor: 'rgba(255,255,255,0.5)',
    },
});

export default PriorityList;
