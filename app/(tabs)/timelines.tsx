import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    Image,
    TouchableOpacity,
    Dimensions,
    ScrollView,
    LayoutRectangle,
    Text,
    Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Entypo } from '@expo/vector-icons';
import { useBackground } from '../../src/context/BackgroundContext';
import users from '../../src/data/users.json';
import TimelineBottomSheet from '../../src/components/TimelineBottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserTimeline } from '../../src/context/UserTimelineContext';
import { FONTS } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    runOnJS
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SPACING = 16;
const CONTAINER_PADDING = 15;
const CONTENT_WIDTH = SCREEN_WIDTH - CONTAINER_PADDING * 2;

interface User {
    id: string;
    uniqueUserId: string;
    name: string;
    profilePicture: string;
    birthday: string;
    dominantColor: string;
}

const hashString = (str: string) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};
const hashToUnit = (str: string) => hashString(str) / 4294967295;

// --- SUB-COMPONENT FOR BUBBLE LOGIC ---
const TimelineItem = ({
    user,
    w,
    h,
    seedKey,
    onExpand,
    onOpenSheet
}: {
    user: User,
    w: number,
    h: number,
    seedKey: string,
    onExpand: (user: User, layout: LayoutRectangle) => void,
    onOpenSheet: (user: User) => void
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
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
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

    return (
        <View style={{ width: w, height: h, position: 'relative', zIndex: 1 }}>

            {/* NAME BUBBLE */}
            <Reanimated.View style={[styles.bubbleContainer, bubbleStyle]}>
                <View style={styles.bubbleContent}>
                    <Text style={styles.bubbleText} numberOfLines={1}>{user.name}</Text>
                </View>
                <View style={styles.bubbleArrow} />
            </Reanimated.View>

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
                <Reanimated.View
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
                </Reanimated.View>
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
        </View>
    );
};


export default function TimelinesScreen() {
    const insets = useSafeAreaInsets();
    const { handleColorChange } = useBackground();
    const { openTimeline } = useUserTimeline();
    const [selectedUserForSheet, setSelectedUserForSheet] = useState<User | null>(null);

    const handleExpand = (user: User, layout: LayoutRectangle) => {
        openTimeline(user, layout);
    };

    const renderMixedLayout = () => {
        const rows: React.ReactNode[] = [];
        let i = 0;
        const userList = users as User[];
        while (i < userList.length) {
            const patternStep = i % 8;
            if ((patternStep === 0 || patternStep === 5) && userList[i]) {
                const user = userList[i];
                const size = CONTENT_WIDTH * 0.75;
                rows.push(
                    <View key={`row-${i}`} style={[styles.row, { justifyContent: 'center' }]}>
                        <TimelineItem
                            user={user} w={size} h={size} seedKey={`${user.id}-${i}`}
                            onExpand={handleExpand} onOpenSheet={setSelectedUserForSheet}
                        />
                    </View>
                );
                i += 1;
            } else if ((patternStep === 1 || patternStep === 4 || patternStep === 6) && userList[i] && userList[i + 1]) {
                const u1 = userList[i];
                const u2 = userList[i + 1];
                const itemW = (CONTENT_WIDTH - SPACING) / 2;
                rows.push(
                    <View key={`row-${i}`} style={styles.row}>
                        <TimelineItem user={u1} w={itemW} h={itemW * 1.15} seedKey={`${u1.id}-${i}`} onExpand={handleExpand} onOpenSheet={setSelectedUserForSheet} />
                        <TimelineItem user={u2} w={itemW} h={itemW * 0.95} seedKey={`${u2.id}-${i + 1}`} onExpand={handleExpand} onOpenSheet={setSelectedUserForSheet} />
                    </View>
                );
                i += 2;
            } else if (userList[i] && userList[i + 1] && userList[i + 2]) {
                const u1 = userList[i];
                const u2 = userList[i + 1];
                const u3 = userList[i + 2];
                const s = (CONTENT_WIDTH - (SPACING * 2)) / 3;
                rows.push(
                    <View key={`row-${i}`} style={styles.row}>
                        <TimelineItem user={u1} w={s} h={s} seedKey={`${u1.id}-${i}`} onExpand={handleExpand} onOpenSheet={setSelectedUserForSheet} />
                        <TimelineItem user={u2} w={s} h={s * 1.2} seedKey={`${u2.id}-${i + 1}`} onExpand={handleExpand} onOpenSheet={setSelectedUserForSheet} />
                        <TimelineItem user={u3} w={s} h={s} seedKey={`${u3.id}-${i + 2}`} onExpand={handleExpand} onOpenSheet={setSelectedUserForSheet} />
                    </View>
                );
                i += 3;
            } else if (userList[i]) {
                const user = userList[i];
                const size = CONTENT_WIDTH * 0.5;
                rows.push(
                    <View key={`row-${i}`} style={[styles.row, { justifyContent: 'center' }]}>
                        <TimelineItem
                            user={user} w={size} h={size} seedKey={`${user.id}-${i}`}
                            onExpand={handleExpand} onOpenSheet={setSelectedUserForSheet}
                        />
                    </View>
                );
                i += 1;
            } else { break; }
        }
        return rows;
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {renderMixedLayout()}
            </ScrollView>

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
