import React, { useState, useRef, useEffect, useCallback, useMemo, useContext } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Dimensions,
    TouchableOpacity,
    type ViewabilityConfig,
} from 'react-native';
import Animated, {
    useAnimatedScrollHandler,
    SharedValue,
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    interpolate,
    runOnJS,
} from 'react-native-reanimated';
import {
    FlatList as GHFlatList,
    GestureHandlerRootView,
    Gesture,
    GestureDetector,
} from 'react-native-gesture-handler';
import Svg, { Path, Text as SvgText, TextPath, Defs } from 'react-native-svg';
import { Feather, MaterialCommunityIcons, Entypo } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/theme/theme';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { PriorityUserWithPost } from '@/types/userTypes';
import PriorityMenuModal from './PriorityMenuModal';
import { TapHoldProvider, TapHoldContext, TapHoldImage } from '@/contexts/TapHoldViewer';
import { useVoiceNoteRecording } from '@/contexts/VoiceNoteRecordingContext';

const AnimatedGHFlatList = Animated.createAnimatedComponent(GHFlatList);

const SCREEN_WIDTH = Dimensions.get('window').width;

const LAYOUT = {
    CARD_WIDTH: SCREEN_WIDTH * 0.74,
    get IMAGE_SIZE() { return this.CARD_WIDTH; },
    SPACING_PER_SIDE: 10,
    get FULL_ITEM_WIDTH() { return this.CARD_WIDTH + this.SPACING_PER_SIDE * 2; },
    get SIDE_PADDING() { return (SCREEN_WIDTH - this.FULL_ITEM_WIDTH) / 2; },
} as const;

const ANIMATION = { DURATION: 300, SCALE_MIN: 0.85, SCALE_MAX: 1 } as const;

const Z_INDEX = {
    BACKGROUND_TEXT: 0,
    BLOB: 5,
    CURVED_TEXT: 10,
    IMAGE: 20,
    INDICATOR: 35,
    OPTIONS_BUTTON: 40,
} as const;

const BLOB_PATH = 'M46.3,-76.3C59.5,-69.1,69.7,-56.3,77.3,-42.3C84.9,-28.3,89.9,-13.1,88.6,1.4C87.3,15.9,79.7,29.7,70.3,41.9C60.9,54.1,49.7,64.7,37.1,71.2C24.5,77.7,10.5,80.1,-2.9,78.8C-16.3,77.5,-29.1,72.5,-41.4,65.6C-53.7,58.7,-65.5,49.9,-74.1,38.6C-82.7,27.3,-88.1,13.5,-86.9,0.3C-85.7,-12.9,-77.9,-25.5,-68.2,-36.2C-58.5,-46.9,-46.9,-55.7,-34.5,-63.3C-22.1,-70.9,-8.9,-77.3,5.6,-78.7C20.1,-80.1,40.2,-76.5,46.3,-76.3Z';

export interface PriorityListProps {
    priorities: PriorityUserWithPost[];
    onColorChange?: (color: string) => void;
    onActiveUserChange?: (user: PriorityUserWithPost) => void;
    scrollX?: SharedValue<number>;
}

const calculateOptionsButtonPosition = (size: number, angleDeg: number = -45, buttonRadius: number = 18) => {
    const radius = size / 2;
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
        top: radius + radius * Math.sin(angleRad) - buttonRadius,
        left: radius + radius * Math.cos(angleRad) - buttonRadius,
    };
};

const BlobBackground = React.memo(({ color, size }: { color: string; size: number }) => {
    const containerSize = size * 1.25;
    return (
        <View pointerEvents="none" style={[styles.blobContainer, { width: containerSize, height: containerSize }]}>
            <Svg viewBox="-100 -100 200 200" width="100%" height="100%">
                <Path d={BLOB_PATH} fill={color} opacity={0.12} />
            </Svg>
        </View>
    );
});
BlobBackground.displayName = 'BlobBackground';

const CurvedText = React.memo(({ text, width }: { text: string; width: number }) => {
    const textRadius = width / 2 + 4;
    const svgWidth = textRadius * 2 + 20;
    const d = `M 20,${textRadius} A ${textRadius},${textRadius} 0 0,1 ${svgWidth - 20},${textRadius}`;

    return (
        <View pointerEvents="none" style={[styles.curvedTextWrapper, { width: svgWidth, height: textRadius * 0.5 }]}>
            <Svg width={svgWidth} height={textRadius + 10} viewBox={`0 0 ${svgWidth} ${textRadius + 10}`}>
                <Defs><Path id="outerArc" d={d} fill="none" /></Defs>
                <SvgText fill={COLORS.primary} fontSize="36" fontFamily={FONTS.bold} fontWeight="900" textAnchor="middle" letterSpacing="2">
                    <TextPath href="#outerArc" startOffset="50%">{text}</TextPath>
                </SvgText>
            </Svg>
        </View>
    );
});
CurvedText.displayName = 'CurvedText';

const CallIcons = React.memo(({ visible }: { visible: boolean }) => {
    const scale = useSharedValue(visible ? 1 : 0);
    const opacity = useSharedValue(visible ? 1 : 0);

    useEffect(() => {
        scale.value = withTiming(visible ? 1 : 0, { duration: ANIMATION.DURATION, easing: Easing.out(Easing.ease) });
        opacity.value = withTiming(visible ? 1 : 0, { duration: ANIMATION.DURATION, easing: Easing.inOut(Easing.ease) });
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(scale.value, [0, 1], [ANIMATION.SCALE_MIN, ANIMATION.SCALE_MAX]) }],
        opacity: opacity.value,
    }));

    if (!visible && scale.value === 0) return null;

    return (
        <Animated.View style={[styles.callIconsContainer, animatedStyle]}>
            <TouchableOpacity activeOpacity={0.9} style={styles.callIconBubble} accessibilityLabel="Video call" accessibilityRole="button">
                <MaterialCommunityIcons name="video-outline" size={20} color={COLORS.text} />
            </TouchableOpacity>
            <View style={styles.callIconSpacer} />
            <TouchableOpacity activeOpacity={0.9} style={styles.callIconBubble} accessibilityLabel="Voice call" accessibilityRole="button">
                <Feather name="phone-call" size={19} color={COLORS.text} />
            </TouchableOpacity>
        </Animated.View>
    );
});
CallIcons.displayName = 'CallIcons';

const OptionsButton = React.memo(({ onPress, size }: { onPress: () => void; size: number }) => {
    const position = useMemo(() => calculateOptionsButtonPosition(size), [size]);
    return (
        <TouchableOpacity style={[styles.optionsButton, position]} onPress={onPress} activeOpacity={0.7} accessibilityLabel="Options menu" accessibilityRole="button">
            <View style={styles.optionsIconBlur}>
                <Entypo name="dots-two-horizontal" size={20} color={COLORS.text} />
            </View>
        </TouchableOpacity>
    );
});
OptionsButton.displayName = 'OptionsButton';

const PriorityCard = React.memo(({ item, isActive, onOptionsPress }: any) => {
    const dominantColor = item.dominantColor || COLORS.primary;
    const router = useRouter();
    const tapHoldContext = useContext(TapHoldContext);

    const { isActive: isGlobalRecording, activeSourceId, startFromRef, updateDrag, endFromTranslationX } = useVoiceNoteRecording();
    const imageWrapperRef = useRef<View | null>(null);

    const recordingForThisCard = isGlobalRecording && activeSourceId === item.id;

    const handleSingleTap = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        router.push({ pathname: '/FilmMyDay' as any, params: { recipient: item.name } });
    }, [item.name, router]);

    const handleDoubleTap = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
        tapHoldContext?.showImage(item.profilePicture);
    }, [item.profilePicture, tapHoldContext]);

    const startRecording = useCallback(() => {
        startFromRef(imageWrapperRef, { sourceId: item.id, uri: item.profilePicture });
    }, [item.id, item.profilePicture, startFromRef]);

    const singleTap = Gesture.Tap().onEnd(() => runOnJS(handleSingleTap)());
    const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => runOnJS(handleDoubleTap)());
    const tapGestures = Gesture.Exclusive(doubleTap, singleTap);

    const panGesture = Gesture.Pan()
        .activateAfterLongPress(350)
        .onStart(() => runOnJS(startRecording)())
        .onUpdate((e) => runOnJS(updateDrag)(e.translationX))
        .onEnd((e) => runOnJS(endFromTranslationX)(e.translationX));

    const composedGesture = Gesture.Exclusive(panGesture, tapGestures);

    return (
        <View style={styles.cardContainer}>
            <View pointerEvents="none" style={styles.backgroundTextContainer}>
                <Text style={styles.backgroundText} numberOfLines={1} adjustsFontSizeToFit>{item.name}</Text>
            </View>

            <BlobBackground color={dominantColor} size={LAYOUT.IMAGE_SIZE} />
            <CurvedText text={item.name} width={LAYOUT.IMAGE_SIZE} />

            {/* 
          ✅ FIX: The wrapper around everything so absolute positioning still works,
          but the Gesture Detector ONLY wraps the TapHoldImage now.
        */}
            <View style={styles.imageWrapper}>

                <GestureDetector gesture={composedGesture}>
                    <Animated.View
                        collapsable={false}
                        ref={imageWrapperRef as any}
                        style={[{ zIndex: Z_INDEX.IMAGE, opacity: recordingForThisCard ? 0 : 1, flex: 1, width: '100%', height: '100%', borderRadius: LAYOUT.IMAGE_SIZE / 2, overflow: 'hidden' }]}
                    >
                        <TapHoldImage source={{ uri: item.profilePicture }} style={styles.circularImage} />
                    </Animated.View>
                </GestureDetector>

                {/* ✅ Icons are OUTSIDE the Gesture Detector so they don't trigger the voice note */}
                {!recordingForThisCard && <CallIcons visible={isActive} />}
                {!recordingForThisCard && isActive && <OptionsButton size={LAYOUT.IMAGE_SIZE} onPress={onOptionsPress} />}
            </View>
        </View>
    );
},
    (prev, next) => prev.isActive === next.isActive && prev.item.id === next.item.id && prev.item.hasNewPost === next.item.hasNewPost
);
PriorityCard.displayName = 'PriorityCard';

const PriorityListContent: React.FC<PriorityListProps> = ({ priorities, onColorChange, onActiveUserChange, scrollX }) => {
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => { if (scrollX) scrollX.value = event.contentOffset.x; },
    });

    const router = useRouter();
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPinSheetVisible, setIsPinSheetVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<PriorityUserWithPost | null>(null);
    const [pinnedIds, setPinnedIds] = useState<string[]>([]);
    const flatListRef = useRef<GHFlatList>(null);

    const displayPriorities = useMemo(() => {
        if (pinnedIds.length === 0) return priorities;
        const pinnedSet = new Set(pinnedIds);
        return [...priorities.filter(p => pinnedSet.has(p.id)), ...priorities.filter(p => !pinnedSet.has(p.id))];
    }, [priorities, pinnedIds]);

    const initialIndex = useMemo(() => Math.max(0, Math.floor(displayPriorities.length / 2)), [displayPriorities.length]);
    const isSelectedPinned = useMemo(() => (selectedUser ? pinnedIds.includes(selectedUser.id) : false), [selectedUser, pinnedIds]);

    useEffect(() => {
        if (activeIndex > displayPriorities.length - 1) setActiveIndex(Math.max(0, displayPriorities.length - 1));
    }, [displayPriorities.length, activeIndex]);

    const viewabilityConfig = useRef<ViewabilityConfig>({ itemVisiblePercentThreshold: 50, minimumViewTime: 0 }).current;
    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems?.length > 0 && viewableItems[0]?.index != null) {
            setActiveIndex(viewableItems[0].index);
            if (viewableItems[0].item?.dominantColor) onColorChange?.(viewableItems[0].item.dominantColor);
            if (viewableItems[0].item) onActiveUserChange?.(viewableItems[0].item);
        }
    }).current;

    const getItemLayout = useCallback((_: any, index: number) => ({ length: LAYOUT.FULL_ITEM_WIDTH, offset: LAYOUT.FULL_ITEM_WIDTH * index, index }), []);

    const openPinSheetForUser = useCallback((user: PriorityUserWithPost) => {
        setSelectedUser(user);
        setIsPinSheetVisible(true);
    }, []);

    const handlePin = useCallback(() => {
        if (!selectedUser) return;
        setPinnedIds(prev => (prev.includes(selectedUser.id) ? prev : [selectedUser.id, ...prev]));
        setTimeout(() => flatListRef.current?.scrollToIndex({ index: 0, animated: true }), 100);
    }, [selectedUser]);

    const handleUnpin = useCallback(() => {
        if (!selectedUser) return;
        setPinnedIds(prev => prev.filter(id => id !== selectedUser.id));
    }, [selectedUser]);

    const handleMicPress = useCallback(() => {
        setIsPinSheetVisible(false);
        if (!selectedUser) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        router.push({ pathname: '/VoiceMessage' as any, params: { recipient: selectedUser.name } });
    }, [selectedUser, router]);

    const renderItem = useCallback(({ item, index }: any) => (
        <PriorityCard item={item} isActive={index === activeIndex} onOptionsPress={() => openPinSheetForUser(item)} />
    ), [activeIndex, openPinSheetForUser]);

    if (displayPriorities.length === 0) return null;

    return (
        <View style={styles.container}>
            <AnimatedGHFlatList
                ref={flatListRef as any}
                style={{ flexGrow: 0 }}
                data={displayPriorities}
                keyExtractor={(item: any) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.flatListContent}
                snapToInterval={LAYOUT.FULL_ITEM_WIDTH}
                snapToAlignment="start"
                decelerationRate="fast"
                initialScrollIndex={initialIndex}
                getItemLayout={getItemLayout}
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={5}
                renderItem={renderItem as any}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                overScrollMode="never"
                nestedScrollEnabled
            />

            <PriorityMenuModal visible={isPinSheetVisible} onClose={() => setIsPinSheetVisible(false)} isPinned={isSelectedPinned} onPin={handlePin} onUnpin={handleUnpin} userName={selectedUser?.name || 'User'} onMicPress={handleMicPress} />
        </View>
    );
};

const PriorityList: React.FC<PriorityListProps> = (props) => {
    return (
        <GestureHandlerRootView style={styles.rootContainer}>
            <TapHoldProvider>
                <PriorityListContent {...props} />
            </TapHoldProvider>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    rootContainer: { flex: 1 },
    container: { flex: 1, justifyContent: 'center', height: '100%', marginVertical: 0 },
    flatListContent: { paddingHorizontal: LAYOUT.SIDE_PADDING, alignItems: 'center', paddingTop: 100, paddingBottom: 80 },
    cardContainer: { width: LAYOUT.CARD_WIDTH, marginHorizontal: LAYOUT.SPACING_PER_SIDE, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
    blobContainer: { position: 'absolute', zIndex: Z_INDEX.BLOB, justifyContent: 'center', alignItems: 'center' },
    backgroundTextContainer: { position: 'absolute', top: -70, width: '130%', alignItems: 'center', justifyContent: 'center', zIndex: Z_INDEX.BACKGROUND_TEXT },
    backgroundText: { fontSize: 48, fontFamily: 'DancingScript-Bold', color: COLORS.primary, opacity: 0.3, textAlign: 'center', letterSpacing: 1 },
    curvedTextWrapper: { marginBottom: -85, zIndex: Z_INDEX.CURVED_TEXT, alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible' },
    imageWrapper: { width: LAYOUT.IMAGE_SIZE, height: LAYOUT.IMAGE_SIZE, borderRadius: LAYOUT.IMAGE_SIZE / 2, position: 'relative', overflow: 'visible' },
    circularImage: { width: '100%', height: '100%', backgroundColor: '#F0EFE9', resizeMode: 'cover' },
    callIconsContainer: { position: 'absolute', bottom: -60, alignSelf: 'center', flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.96)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 4, zIndex: Z_INDEX.INDICATOR },
    callIconBubble: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 1)', justifyContent: 'center', alignItems: 'center' },
    callIconSpacer: { width: 12 },
    optionsButton: { position: 'absolute', zIndex: Z_INDEX.OPTIONS_BUTTON, elevation: 10 },
    optionsIconBlur: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255, 255, 255, 0.9)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3.84, elevation: 5, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.5)' },
});

export default PriorityList;
