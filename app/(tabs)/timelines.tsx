import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    Image,
    TouchableOpacity,
    Dimensions,
    LayoutRectangle,
    Text,
    Pressable,
    ViewToken,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Entypo } from '@expo/vector-icons';
import { useBackground } from '@/contexts/BackgroundContext';
import users from '@/data/users.json';
import TimelineBottomSheet from '@/features/timeline/components/TimelineBottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserTimeline } from '@/contexts/UserTimelineContext';
import { User } from '@/types/userTypes';
import { FONTS } from '@/theme/theme';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    interpolateColor,
    runOnJS,
    SharedValue
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SPACING = 16;
const CONTAINER_PADDING = 15;
const CONTENT_WIDTH = SCREEN_WIDTH - CONTAINER_PADDING * 2;
const BG_OPACITY = 0.15;



const hashString = (str: string) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};
const hashToUnit = (str: string) => hashString(str) / 4294967295;

const hexToRgba = (hex: string, alpha: number) => {
    const fullHex = hex.length === 4 ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3] : hex;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(fullHex)) {
        const r = parseInt(fullHex.slice(1, 3), 16);
        const g = parseInt(fullHex.slice(3, 5), 16);
        const b = parseInt(fullHex.slice(5, 7), 16);
        const a = alpha;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    return `rgba(255, 255, 255, ${alpha})`;
};

interface RowData {
    id: string;
    type: 'single' | 'double' | 'triple';
    users: User[];
}

// --- SUB-COMPONENT FOR BUBBLE LOGIC ---
const TimelineItem = React.memo(({
    user,
    w,
    h,
    seedKey,
    onExpand,
    onOpenSheet,
    isSelected,
    expandAnim
}: {
    user: User,
    w: number,
    h: number,
    seedKey: string,
    onExpand: (user: User, layout: LayoutRectangle) => void,
    onOpenSheet: (user: User) => void,
    isSelected: boolean,
    expandAnim: SharedValue<number>
}) => {
    // Animation Values
    const scale = useSharedValue(1);
    const bubbleOpacity = useSharedValue(0);

    // --- GEOMETRY LOGIC ---
    const rx = w / 2;
    const ry = h / 2;
    const cx = w / 2;
    const cy = h / 2;
    const randomVal = hashToUnit(seedKey + ':angle');
    const angleDeg = -20 - (randomVal * 140);
    const theta = (angleDeg * Math.PI) / 180;
    const dirX = Math.cos(theta);
    const dirY = Math.sin(theta);
    const termX = dirX / rx;
    const termY = dirY / ry;
    const t = 1 / Math.sqrt((termX * termX) + (termY * termY));
    const borderX = cx + (dirX * t);
    const borderY = cy + (dirY * t);
    const minDim = Math.min(w, h);
    let btnSize = minDim * 0.15;
    if (btnSize < 22) btnSize = 22;
    if (btnSize > 32) btnSize = 32;
    const ICON_SIZE = btnSize * 0.5;

    // --- ANIMATION HANDLERS ---
    const handlePressIn = () => {
        scale.value = withSpring(0.95);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
        bubbleOpacity.value = withTiming(0, { duration: 150 });
    };

    const handleLongPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        bubbleOpacity.value = withTiming(1, { duration: 200 });
    };

    const bubbleStyle = useAnimatedStyle(() => ({
        opacity: bubbleOpacity.value,
        transform: [
            { translateY: interpolate(bubbleOpacity.value, [0, 1], [10, 0]) },
            { scale: interpolate(bubbleOpacity.value, [0, 1], [0.8, 1]) }
        ]
    }));

    const scaleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    const itemVisibilityStyle = useAnimatedStyle(() => {
        // If this item is currently expanded, hide it completely to avoid ghosting
        return {
            opacity: isSelected ? 0 : 1,
        };
    });

    return (
        <View style={{ width: w, height: h, position: 'relative', zIndex: 1 }}>
            <Animated.View style={[{ width: '100%', height: '100%' }, itemVisibilityStyle]}>
                {/* NAME BUBBLE */}
                <Animated.View style={[styles.bubbleContainer, bubbleStyle]}>
                    <View style={styles.bubbleContent}>
                        <Text style={styles.bubbleText} numberOfLines={1}>{user.name}</Text>
                    </View>
                    <View style={styles.bubbleArrow} />
                </Animated.View>

                {/* PROFILE IMAGE */}
                <Pressable
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    onLongPress={handleLongPress}
                    delayLongPress={300}
                    onPress={(e) => {
                        (e.target as any).measureInWindow((x: number, y: number, width: number, height: number) => {
                            onExpand(user, { x, y, width, height });
                        });
                    }}
                    style={{ width: '100%', height: '100%' }}
                >
                    <Animated.View
                        style={[
                            {
                                width: '100%',
                                height: '100%',
                                borderRadius: 999,
                                backgroundColor: user.dominantColor,
                                overflow: 'hidden',
                            },
                            scaleStyle
                        ]}
                    >
                        <Image
                            source={{ uri: user.profilePicture }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                    </Animated.View>
                </Pressable>

                {/* FLOATING DOTS BUTTON */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => onOpenSheet(user)}
                    style={[
                        styles.iconBtn,
                        {
                            width: btnSize,
                            height: btnSize,
                            borderRadius: btnSize / 2,
                            left: borderX - (btnSize / 2),
                            top: borderY - (btnSize / 2),
                        },
                    ]}
                >
                    <Entypo name="dots-two-horizontal" size={ICON_SIZE} color="#000" />
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
});

// --- MEMOIZED ROW COMPONENT ---
const TimelineRow = React.memo(({
    item,
    onExpand,
    onOpenSheet,
    expandedUserId,
    expandAnim
}: {
    item: RowData;
    onExpand: (user: User, layout: LayoutRectangle) => void;
    onOpenSheet: (user: User) => void;
    expandedUserId: string | null;
    expandAnim: SharedValue<number>;
}) => {
    if (item.type === 'single') {
        const user = item.users[0];
        const size = CONTENT_WIDTH * 0.75;
        return (
            <View style={[styles.row, { justifyContent: 'center' }]}>
                <TimelineItem
                    user={user} w={size} h={size} seedKey={`${user.id}-${item.id}`}
                    onExpand={onExpand} onOpenSheet={onOpenSheet}
                    isSelected={expandedUserId === user.uniqueUserId}
                    expandAnim={expandAnim}
                />
            </View>
        );
    }

    if (item.type === 'double') {
        const [u1, u2] = item.users;
        const itemW = (CONTENT_WIDTH - SPACING) / 2;
        return (
            <View style={styles.row}>
                <TimelineItem
                    user={u1} w={itemW} h={itemW * 1.15} seedKey={`${u1.id}-${item.id}`}
                    onExpand={onExpand} onOpenSheet={onOpenSheet}
                    isSelected={expandedUserId === u1.uniqueUserId}
                    expandAnim={expandAnim}
                />
                <TimelineItem
                    user={u2} w={itemW} h={itemW * 0.95} seedKey={`${u2.id}-${item.id + 1}`}
                    onExpand={onExpand} onOpenSheet={onOpenSheet}
                    isSelected={expandedUserId === u2.uniqueUserId}
                    expandAnim={expandAnim}
                />
            </View>
        );
    }

    if (item.type === 'triple') {
        const [u1, u2, u3] = item.users;
        const s = (CONTENT_WIDTH - (SPACING * 2)) / 3;
        return (
            <View style={styles.row}>
                <TimelineItem
                    user={u1} w={s} h={s} seedKey={`${u1.id}-${item.id}`}
                    onExpand={onExpand} onOpenSheet={onOpenSheet}
                    isSelected={expandedUserId === u1.uniqueUserId}
                    expandAnim={expandAnim}
                />
                <TimelineItem
                    user={u2} w={s} h={s * 1.2} seedKey={`${u2.id}-${item.id + 1}`}
                    onExpand={onExpand} onOpenSheet={onOpenSheet}
                    isSelected={expandedUserId === u2.uniqueUserId}
                    expandAnim={expandAnim}
                />
                <TimelineItem
                    user={u3} w={s} h={s} seedKey={`${u3.id}-${item.id + 2}`}
                    onExpand={onExpand} onOpenSheet={onOpenSheet}
                    isSelected={expandedUserId === u3.uniqueUserId}
                    expandAnim={expandAnim}
                />
            </View>
        );
    }

    return null;
});

export default function TimelinesScreen() {
    const insets = useSafeAreaInsets();
    const { handleColorChange } = useBackground();
    const { openTimeline, expandedUser, expandAnim } = useUserTimeline();
    const [selectedUserForSheet, setSelectedUserForSheet] = useState<User | null>(null);

    // Local Reanimated Background State
    const lastColorRef = React.useRef<string>('#FFFFFF');
    const currentColorRef = React.useRef<string>('#FFFFFF');
    const hasScrolledRef = React.useRef<boolean>(false);

    // Process rows once
    const processedRows = React.useMemo(() => {
        const list = users as User[];
        const rows: RowData[] = [];
        let i = 0;
        while (i < list.length) {
            const patternStep = i % 8;
            const uniqueId = `row-${i}`;

            if ((patternStep === 0 || patternStep === 5) && list[i]) {
                rows.push({ id: uniqueId, type: 'single', users: [list[i]] });
                i += 1;
            } else if ((patternStep === 1 || patternStep === 4 || patternStep === 6) && list[i] && list[i + 1]) {
                rows.push({ id: uniqueId, type: 'double', users: [list[i], list[i + 1]] });
                i += 2;
            } else if (list[i] && list[i + 1] && list[i + 2]) {
                rows.push({ id: uniqueId, type: 'triple', users: [list[i], list[i + 1], list[i + 2]] });
                i += 3;
            } else if (list[i]) {
                rows.push({ id: uniqueId, type: 'single', users: [list[i]] });
                i += 1;
            } else { break; }
        }
        return rows;
    }, []);

    const handleExpand = React.useCallback((user: User, layout: LayoutRectangle) => {
        // Ensure we have layout before opening
        if (layout.width > 0 && layout.height > 0) {
            openTimeline(user, layout);
        }
    }, [openTimeline]);



    // Selection color handle
    const onViewableItemsChanged = React.useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {

        if (viewableItems.length > 0) {
            const middleIndex = Math.floor(viewableItems.length / 2);
            const targetItem = viewableItems[middleIndex]?.item as RowData;

            if (targetItem && targetItem.users.length > 0) {
                const dominantColor = targetItem.users[0].dominantColor;
                const targetColor = hexToRgba(dominantColor, BG_OPACITY);

                currentColorRef.current = targetColor; // Keep track of what the color SHOULD be

                // Only actually update the global background if they have interacted
                if (hasScrolledRef.current && targetColor !== lastColorRef.current) {
                    lastColorRef.current = targetColor;
                    handleColorChange(targetColor);
                }
            }
        }
    }).current;

    const viewabilityConfig = React.useRef({
        itemVisiblePercentThreshold: 50,
        minimumViewTime: 150
    }).current;

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <Animated.FlatList
                data={processedRows}
                keyExtractor={(item) => item.id}
                onScrollBeginDrag={() => {
                    if (!hasScrolledRef.current) {
                        hasScrolledRef.current = true;
                        // First scroll! Immediately apply whatever is currently visible
                        if (currentColorRef.current !== lastColorRef.current) {
                            lastColorRef.current = currentColorRef.current;
                            handleColorChange(currentColorRef.current);
                        }
                    }
                }}
                renderItem={({ item }) => (
                    <TimelineRow
                        item={item}
                        onExpand={handleExpand}
                        onOpenSheet={setSelectedUserForSheet}
                        expandedUserId={expandedUser?.uniqueUserId || null}
                        expandAnim={expandAnim}
                    />
                )}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                initialNumToRender={6}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
            />

            <TimelineBottomSheet
                visible={!!selectedUserForSheet}
                user={selectedUserForSheet}
                onClose={() => setSelectedUserForSheet(null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    scrollContent: {
        paddingTop: 100,
        paddingBottom: 60,
        paddingHorizontal: CONTAINER_PADDING,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        width: '100%',
    },
    iconBtn: {
        position: 'absolute',
        backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
        elevation: 2,
    },
    // --- BUBBLE STYLES ---
    bubbleContainer: {
        position: 'absolute',
        top: -45,
        alignSelf: 'center',
        zIndex: 99,
        alignItems: 'center',
        pointerEvents: 'none',
    },
    bubbleContent: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(20,20,20,0.9)',
    },
    bubbleText: {
        fontFamily: FONTS.bold,
        fontSize: 12,
        color: '#FFF',
    },
    bubbleArrow: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: 'rgba(20,20,20,0.9)',
        marginTop: -1,
    }
});
