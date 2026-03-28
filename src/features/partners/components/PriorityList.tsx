import React, { useState, useRef, useEffect, useCallback, useMemo, useContext } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Dimensions,
    TouchableOpacity,
    Vibration,
    type ViewabilityConfig,
} from 'react-native';
import { BlurView } from 'expo-blur';
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
import { Feather, MaterialCommunityIcons, Entypo, Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/theme/theme';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Profile, PriorityUserWithPost, Message, MediaType } from '@/types/domain';
import PriorityMenuModal, { AnchorPosition } from './PriorityMenuModal';
import { TapHoldProvider, TapHoldContext, TapHoldImage } from '@/contexts/TapHoldViewer';
import { useVoiceNoteRecording } from '@/contexts/VoiceNoteRecordingContext';
import { useMediaInbox } from '@/contexts/MediaInboxContext';
import { ViewMessageModal } from '@/components/ui/ViewMessageModal';
import usersData from '@/data/users.json';

const AnimatedGHFlatList = Animated.createAnimatedComponent(GHFlatList);

const SCREEN_WIDTH = Dimensions.get('window').width;

const PINNED_KEY = 'priority_pinned_id';

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

const BlobBackground = React.memo(({ color, size, isActive }: { color: string; size: number; isActive: boolean }) => {
    if (!isActive) return null;
    const containerSize = size * 1.25;
    return (
        <View pointerEvents="none" style={[styles.blobContainer, { width: containerSize, height: containerSize }]}>
            <Svg viewBox="-100 -100 200 200" width="100%" height="100%">
                <Path d={BLOB_PATH} fill={color} opacity={0.35} />
            </Svg>
        </View>
    );
});
BlobBackground.displayName = 'BlobBackground';

const CurvedText = React.memo(({ text, width, color, isActive }: { text: string; width: number; color?: string; isActive: boolean }) => {
    const scale = useSharedValue(isActive ? 1 : 0);
    const opacity = useSharedValue(isActive ? 1 : 0);

    useEffect(() => {
        scale.value = withTiming(isActive ? 1 : 0, { duration: ANIMATION.DURATION, easing: Easing.out(Easing.ease) });
        opacity.value = withTiming(isActive ? 1 : 0, { duration: ANIMATION.DURATION, easing: Easing.inOut(Easing.ease) });
    }, [isActive]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(scale.value, [0, 1], [0.98, 1]) }],
        opacity: opacity.value,
    }));

    if (!isActive && opacity.value === 0) return null;

    const textRadius = width / 2 + 4;
    const svgWidth = textRadius * 2 + 20;
    const d = `M 20,${textRadius} A ${textRadius},${textRadius} 0 0,1 ${svgWidth - 20},${textRadius}`;

    return (
        <Animated.View pointerEvents="none" style={[styles.curvedTextWrapper, { width: svgWidth, height: textRadius * 0.5 }, animatedStyle]}>
            <Svg width={svgWidth} height={textRadius + 10} viewBox={`0 0 ${svgWidth} ${textRadius + 10}`}>
                <Defs><Path id="outerArc" d={d} fill="none" /></Defs>
                <SvgText fill={COLORS.textSecondary} fontSize="56" fontFamily="DancingScript-Bold" opacity="0.3" textAnchor="middle" letterSpacing="1" dy="10">
                    <TextPath href="#outerArc" startOffset="50%">{text}</TextPath>
                </SvgText>
                <SvgText fill={COLORS.primary} fontSize="34" fontFamily={FONTS.bold} fontWeight="900" textAnchor="middle" letterSpacing="2">
                    <TextPath href="#outerArc" startOffset="50%">{text}</TextPath>
                </SvgText>
            </Svg>
        </Animated.View>
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

const OptionsButton = React.memo(({ onPress, size }: {
    onPress: (anchor: AnchorPosition) => void;
    size: number;
}) => {
    const position = useMemo(() => calculateOptionsButtonPosition(size), [size]);
    const buttonRef = useRef<View>(null);

    const handlePress = () => {
        buttonRef.current?.measureInWindow((x, y, width, height) => {
            onPress({ x, y, width, height });
        });
    };

    return (
        <TouchableOpacity
            ref={buttonRef as any}
            style={[styles.optionsButton, position]}
            onPress={handlePress}
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

const UnreadIndicator = React.memo(({ type, size, onPress }: { type: MediaType; size: number; onPress: () => void }) => {
    const position = useMemo(() => calculateOptionsButtonPosition(size, -145, 28), [size]);

    let accentColor = '#007AFF';
    let iconName = 'notifications';

    if (type === 'video') {
        accentColor = '#AF52DE';
        iconName = 'videocam';
    } else if (type === 'photo') {
        accentColor = '#FF3B30';
        iconName = 'image';
    } else if (type === 'voice') {
        accentColor = '#007AFF';
        iconName = 'mic';
    } else if (type === 'note') {
        accentColor = '#FF9500';
        iconName = 'chatbubble';
    }

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={[styles.thoughtBubbleContainer, position]}
        >
            <View style={styles.thoughtMainBubble}>
                <Ionicons name={iconName as any} size={11} color={accentColor} />
                <View style={[styles.thoughtDotIndicator, { backgroundColor: accentColor }]} />
            </View>
            <View style={styles.thoughtBubblesTrail}>
                <View style={styles.thoughtBubbleSmall} />
                <View style={styles.thoughtBubbleTiny} />
            </View>
        </TouchableOpacity>
    );
});
UnreadIndicator.displayName = 'UnreadIndicator';

const SeenIndicator = React.memo(({ status, size, userName }: { status: string; size: number; userName: string }) => {
    // -30 deg is top-right; buttonRadius 20 makes it sit nicely on the inner edge
    const position = useMemo(() => calculateOptionsButtonPosition(size, -30, 20), [size]);
    const isEmoji = status !== 'sent' && status !== 'seen';

    return (
        <Animated.View style={[position, isEmoji ? styles.emojiIndicator : styles.seenLabelContainer]}>
            {!isEmoji && <BlurView intensity={45} tint="light" style={StyleSheet.absoluteFill} />}
            <Text style={[styles.seenText, isEmoji && styles.emojiIndicatorText]}>
                {status === 'seen' ? 'Seen' : (status === 'sent' ? 'Sent' : status)}
            </Text>
        </Animated.View>
    );
});
SeenIndicator.displayName = 'SeenIndicator';

interface PriorityCardProps {
    item: any;
    isActive: boolean;
    onOptionsPress: (anchor: AnchorPosition) => void;
    unreadMedia: Message | null;
    sentStatus: string;
}

const PriorityCard = React.memo(
    ({ item, isActive, onOptionsPress, unreadMedia, sentStatus }: PriorityCardProps) => {
        const dominantColor = item.dominantColor || COLORS.primary;
        const router = useRouter();
        const tapHoldContext = useContext(TapHoldContext);
        const VIBRATION_PATTERN = [0, 500, 200, 500, 200, 500, 200, 800];

        const startCallVibration = () => { Vibration.vibrate(VIBRATION_PATTERN, true); };
        const stopCallVibration = () => { Vibration.cancel(); };

        const { isActive: isGlobalRecording, activeSourceId, startFromRef, updateDrag, endFromTranslationX } = useVoiceNoteRecording();
        const { markAsSeen, recordMessageSent, simulateCounterpartSeen } = useMediaInbox();
        const imageWrapperRef = useRef<View | null>(null);

        const recordingForThisCard = isGlobalRecording && activeSourceId === item.id;

        const [viewingMedia, setViewingMedia] = useState(false);

        const handleSingleTap = useCallback(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
            router.push({
                pathname: '/FilmMyDay' as any,
                params: {
                    recipient: item.name,
                    recipientId: item.id
                }
            });
        }, [item.id, item.name, router]);

        const handleDoubleTap = useCallback(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
            tapHoldContext?.showImage(item.profilePicture);
        }, [item.profilePicture, tapHoldContext]);

        const startRecording = useCallback(() => {
            startFromRef(imageWrapperRef, { sourceId: item.id, uri: item.profilePicture });
        }, [item.id, item.profilePicture, startFromRef]);

        const handleSendStatus = useCallback(() => {
            recordMessageSent(item.id);
        }, [item.id, recordMessageSent]);

        const singleTap = Gesture.Tap().onEnd(() => runOnJS(handleSingleTap)());
        const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => runOnJS(handleDoubleTap)());
        const tapGestures = Gesture.Exclusive(doubleTap, singleTap);

        const panGesture = Gesture.Pan()
            .activateAfterLongPress(350)
            .onStart(() => runOnJS(startRecording)())
            .onUpdate((e) => runOnJS(updateDrag)(e.translationX))
            .onEnd((e) => {
                if (e.translationX > 50) runOnJS(handleSendStatus)();
                runOnJS(endFromTranslationX)(e.translationX);
            });

        const composedGesture = Gesture.Exclusive(panGesture, tapGestures);

        const callVibrationGesture = Gesture.LongPress()
            .minDuration(400)
            .onStart(() => { 'worklet'; runOnJS(startCallVibration)(); })
            .onFinalize(() => { 'worklet'; runOnJS(stopCallVibration)(); });

        if (item.isPending) {
            return (
                <View style={styles.cardContainer}>
                    <BlobBackground color={dominantColor} size={LAYOUT.IMAGE_SIZE} isActive={isActive} />
                    <CurvedText text={item.name} width={LAYOUT.IMAGE_SIZE} color={dominantColor} isActive={isActive} />
                    <View style={styles.imageWrapper}>
                        <Animated.View
                            style={[{
                                zIndex: Z_INDEX.IMAGE,
                                opacity: 0.35,
                                flex: 1,
                                width: '100%',
                                height: '100%',
                                borderRadius: LAYOUT.IMAGE_SIZE / 2,
                                overflow: 'hidden',
                            }]}
                        >
                            <TapHoldImage source={{ uri: item.profilePicture }} style={styles.circularImage} />
                        </Animated.View>
                        <View style={styles.pendingOverlay} pointerEvents="none">
                            <Ionicons name="hourglass-outline" size={28} color="rgba(255,255,255,0.9)" />
                        </View>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.cardContainer}>
                <GestureDetector gesture={callVibrationGesture}>
                    <View style={StyleSheet.absoluteFill} />
                </GestureDetector>

                <BlobBackground color={dominantColor} size={LAYOUT.IMAGE_SIZE} isActive={isActive} />
                <CurvedText text={item.name} width={LAYOUT.IMAGE_SIZE} color={dominantColor} isActive={isActive} />

                <View style={styles.imageWrapper}>
                    <GestureDetector gesture={composedGesture}>
                        <Animated.View
                            collapsable={false}
                            ref={imageWrapperRef as any}
                            style={[{
                                zIndex: Z_INDEX.IMAGE,
                                opacity: recordingForThisCard ? 0 : 1,
                                flex: 1,
                                width: '100%',
                                height: '100%',
                                borderRadius: LAYOUT.IMAGE_SIZE / 2,
                                overflow: 'hidden',
                            }]}
                        >
                            <TapHoldImage source={{ uri: item.profilePicture }} style={styles.circularImage} />
                        </Animated.View>
                    </GestureDetector>

                    {!recordingForThisCard && <CallIcons visible={isActive} />}
                    {!recordingForThisCard && isActive && (
                        <OptionsButton size={LAYOUT.IMAGE_SIZE} onPress={onOptionsPress} />
                    )}
                    {!recordingForThisCard && unreadMedia && isActive && (
                        <UnreadIndicator
                            type={unreadMedia.type}
                            size={LAYOUT.IMAGE_SIZE}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setViewingMedia(true);
                            }}
                        />
                    )}
                    {!recordingForThisCard && !unreadMedia && sentStatus !== 'none' && isActive && (
                        <SeenIndicator status={sentStatus} size={LAYOUT.IMAGE_SIZE} userName={item.name} />
                    )}
                </View>

                <ViewMessageModal
                    visible={viewingMedia}
                    media={unreadMedia || null}
                    userName={item.name}
                    userColor={dominantColor}
                    onClose={() => {
                        setViewingMedia(false);
                        markAsSeen(item.id);
                    }}
                />
            </View>
        );
    },
    (prev, next) =>
        prev.isActive === next.isActive &&
        prev.item.id === next.item.id &&
        prev.item.hasNewPost === next.item.hasNewPost &&
        prev.item.profilePicture === next.item.profilePicture &&
        prev.unreadMedia?.id === next.unreadMedia?.id &&
        prev.sentStatus === next.sentStatus
);
PriorityCard.displayName = 'PriorityCard';

const hexToRgba = (hex: string, alpha: number) => {
    if (!hex || hex[0] !== '#') return `rgba(0,0,0,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const PriorityMessageIndicator = React.memo(({ direction, count, onPress, bgColor }: { direction: 'left' | 'right', count: number, onPress: () => void, bgColor: string }) => {
    const indicatorColor = hexToRgba(bgColor, 0.85);
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={[
                styles.edgeIndicatorContainer,
                direction === 'left' ? styles.indicatorLeft : styles.indicatorRight,
            ]}
        >
            <View style={styles.indicatorGroup}>
                <View style={[
                    styles.indicatorCircle,
                    { backgroundColor: indicatorColor },
                    direction === 'left' ? { bottom: 0, right: 0 } : { top: 0, left: 0 }
                ]}>
                    <Text style={styles.indicatorCountTextSmall}>{count}+</Text>
                </View>
                <View style={[
                    styles.indicatorDot,
                    { backgroundColor: indicatorColor },
                    direction === 'left' ? { top: 4, left: 2 } : { bottom: 4, right: 2 }
                ]} />
            </View>
        </TouchableOpacity>
    );
});
PriorityMessageIndicator.displayName = 'PriorityMessageIndicator';

const PriorityListContent: React.FC<PriorityListProps> = ({ priorities, onColorChange, onActiveUserChange, scrollX }) => {
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => { if (scrollX) scrollX.value = event.contentOffset.x; },
    });

    const router = useRouter();
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPinSheetVisible, setIsPinSheetVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<PriorityUserWithPost | null>(null);
    const [pinnedId, setPinnedId] = useState<string | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<AnchorPosition | null>(null);

    const flatListRef = useRef<GHFlatList>(null);

    const { unreadMessages, myLastSentStatus } = useMediaInbox();

    useEffect(() => {
        AsyncStorage.getItem(PINNED_KEY).then(val => { if (val) setPinnedId(val); });
    }, []);

    useEffect(() => {
        if (pinnedId) AsyncStorage.setItem(PINNED_KEY, pinnedId);
        else AsyncStorage.removeItem(PINNED_KEY);
    }, [pinnedId]);

    const centerIndex = useMemo(() => Math.max(0, Math.floor(priorities.length / 2)), [priorities.length]);

    const displayPriorities = useMemo(() => {
        if (!pinnedId) return priorities;
        const without = priorities.filter(p => p.id !== pinnedId);
        const pinned = priorities.find(p => p.id === pinnedId);
        if (!pinned) return priorities;
        const result = [...without];
        result.splice(centerIndex, 0, pinned);
        return result;
    }, [priorities, pinnedId, centerIndex]);

    const isSelectedPinned = useMemo(
        () => (selectedUser ? pinnedId === selectedUser.id : false),
        [selectedUser, pinnedId]
    );

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

    const getItemLayout = useCallback((_: any, index: number) => ({
        length: LAYOUT.FULL_ITEM_WIDTH,
        offset: LAYOUT.FULL_ITEM_WIDTH * index,
        index,
    }), []);

    const openPinSheetForUser = useCallback((user: PriorityUserWithPost, anchor: AnchorPosition) => {
        setSelectedUser(user);
        setMenuAnchor(anchor);
        setIsPinSheetVisible(true);
    }, []);

    const handlePin = useCallback(() => {
        if (!selectedUser) return;
        setPinnedId(selectedUser.id);
        setTimeout(() => flatListRef.current?.scrollToIndex({ index: centerIndex, animated: true }), 100);
    }, [selectedUser, centerIndex]);

    const handleUnpin = useCallback(() => { setPinnedId(null); }, []);

    const handleMicPress = useCallback(() => {
        setIsPinSheetVisible(false);
        if (!selectedUser) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        router.push({ pathname: '/VoiceMessage' as any, params: { recipient: selectedUser.name } });
    }, [selectedUser, router]);

    const renderItem = useCallback(({ item, index }: any) => {
        // unreadMessages[item.id] is a single Message object (or undefined) — pass directly
        const unreadMedia = unreadMessages[item.id] ?? null;
        const sentStatus = myLastSentStatus[item.id] ?? 'none';
        return (
            <PriorityCard
                item={item}
                isActive={index === activeIndex}
                onOptionsPress={(anchor: AnchorPosition) => openPinSheetForUser(item, anchor)}
                unreadMedia={unreadMedia}
                sentStatus={sentStatus}
            />
        );
    }, [activeIndex, openPinSheetForUser, unreadMessages, myLastSentStatus]);

    const leftUnread = useMemo(() => {
        let count = 0;
        let firstIndex = -1;
        let lastUnreadIndex = -1;
        for (let i = 0; i < activeIndex; i++) {
            const user = displayPriorities[i];
            if (unreadMessages[user.id]) {
                if (firstIndex === -1) firstIndex = i;
                lastUnreadIndex = i;
                count++;
            }
        }
        const upcomingUserColor = lastUnreadIndex !== -1 ? (displayPriorities[lastUnreadIndex].dominantColor || COLORS.primary) : COLORS.primary;
        return { count, firstIndex, upcomingUserColor };
    }, [displayPriorities, activeIndex, unreadMessages]);

    const rightUnread = useMemo(() => {
        let count = 0;
        let firstIndex = -1;
        for (let i = activeIndex + 1; i < displayPriorities.length; i++) {
            const user = displayPriorities[i];
            if (unreadMessages[user.id]) {
                if (firstIndex === -1) firstIndex = i;
                count++;
            }
        }
        const upcomingUserColor = firstIndex !== -1 ? (displayPriorities[firstIndex].dominantColor || COLORS.primary) : COLORS.primary;
        return { count, firstIndex, upcomingUserColor };
    }, [displayPriorities, activeIndex, unreadMessages]);

    if (displayPriorities.length === 0) return null;

    return (
        <View style={styles.container} pointerEvents="box-none">
            <AnimatedGHFlatList
                ref={flatListRef as any}
                hitSlop={{ top: -220, bottom: -220 }}
                style={{ flexGrow: 0 }}
                data={displayPriorities}
                keyExtractor={(item: any) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.flatListContent}
                snapToInterval={LAYOUT.FULL_ITEM_WIDTH}
                snapToAlignment="start"
                decelerationRate="fast"
                initialScrollIndex={centerIndex}
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

            {leftUnread.count > 0 && (
                <PriorityMessageIndicator
                    direction="left"
                    count={leftUnread.count}
                    bgColor={leftUnread.upcomingUserColor}
                    onPress={() => flatListRef.current?.scrollToIndex({ index: leftUnread.firstIndex, animated: true })}
                />
            )}

            {rightUnread.count > 0 && (
                <PriorityMessageIndicator
                    direction="right"
                    count={rightUnread.count}
                    bgColor={rightUnread.upcomingUserColor}
                    onPress={() => flatListRef.current?.scrollToIndex({ index: rightUnread.firstIndex, animated: true })}
                />
            )}

            <PriorityMenuModal
                visible={isPinSheetVisible}
                onClose={() => setIsPinSheetVisible(false)}
                isPinned={isSelectedPinned}
                onPin={handlePin}
                onUnpin={handleUnpin}
                userName={selectedUser?.name || 'User'}
                onMicPress={handleMicPress}
                anchor={menuAnchor}
            />
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
    container: { flex: 1, justifyContent: 'center', height: '100%', width: '100%', marginVertical: 0 },
    flatListContent: { paddingHorizontal: LAYOUT.SIDE_PADDING, alignItems: 'center', paddingTop: 100, paddingBottom: 80 },
    cardContainer: { width: LAYOUT.CARD_WIDTH, height: 800, marginHorizontal: LAYOUT.SPACING_PER_SIDE, alignItems: 'center', justifyContent: 'center', overflow: 'visible', backgroundColor: 'transparent' },
    blobContainer: { position: 'absolute', zIndex: Z_INDEX.BLOB, justifyContent: 'center', alignItems: 'center' },
    backgroundTextContainer: { position: 'absolute', top: -70, width: '130%', alignItems: 'center', justifyContent: 'center', zIndex: Z_INDEX.BACKGROUND_TEXT },
    backgroundText: { fontSize: 48, fontFamily: 'DancingScript-Bold', color: COLORS.primary, opacity: 0.3, textAlign: 'center', letterSpacing: 1 },
    curvedTextWrapper: { marginBottom: -75, zIndex: Z_INDEX.CURVED_TEXT, alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible' },
    imageWrapper: { width: LAYOUT.IMAGE_SIZE, height: LAYOUT.IMAGE_SIZE, borderRadius: LAYOUT.IMAGE_SIZE / 2, position: 'relative', overflow: 'visible' },
    circularImage: { width: '100%', height: '100%', backgroundColor: '#F0EFE9', resizeMode: 'cover' },
    callIconsContainer: { position: 'absolute', bottom: -60, alignSelf: 'center', flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.96)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 4, zIndex: Z_INDEX.INDICATOR },
    callIconBubble: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 1)', justifyContent: 'center', alignItems: 'center' },
    callIconSpacer: { width: 12 },
    optionsButton: { position: 'absolute', zIndex: Z_INDEX.OPTIONS_BUTTON, elevation: 10 },
    optionsIconBlur: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255, 255, 255, 0.9)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3.84, elevation: 5, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.5)' },
    thoughtBubbleContainer: { position: 'absolute', zIndex: Z_INDEX.INDICATOR, alignItems: 'center' },
    thoughtMainBubble: { backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
    thoughtDotIndicator: { width: 6, height: 6, borderRadius: 3 },
    thoughtBubblesTrail: { alignItems: 'center', marginTop: 1, marginRight: -10 },
    thoughtBubbleSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF', marginBottom: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 2 },
    thoughtBubbleTiny: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 1 },
    seenLabelContainer: { position: 'absolute', zIndex: Z_INDEX.INDICATOR, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(255, 255, 255, 0.4)' },
    seenText: { fontSize: 8, fontFamily: FONTS.bold, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    edgeIndicatorContainer: { position: 'absolute', zIndex: Z_INDEX.INDICATOR },
    indicatorLeft: { top: 80, left: 0 },
    indicatorRight: { bottom: 80, right: 0 },
    indicatorGroup: { width: 42, height: 42 },
    indicatorCircle: { position: 'absolute', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    indicatorDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
    indicatorCountTextSmall: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.text, fontWeight: '800' },
    pendingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: LAYOUT.IMAGE_SIZE / 2,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: Z_INDEX.IMAGE + 1,
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    emojiIndicator: {
        position: 'absolute',
        zIndex: Z_INDEX.INDICATOR,
        paddingHorizontal: 0,
        paddingVertical: 0,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    emojiIndicatorText: {
        fontSize: 20,
        fontFamily: FONTS.bold,
        color: COLORS.text,
        textTransform: 'none',
        letterSpacing: 0,
        textShadowColor: 'transparent',
    },
});

export default PriorityList;