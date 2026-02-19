import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Dimensions,
    ViewToken,
    Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBackground } from '@/context/BackgroundContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import users from '@/data/users.json';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    interpolateColor,
    runOnJS,
} from 'react-native-reanimated';

// IMPORT THE COMPONENT
import { DrawnArrowItem } from '@/components/DrawnArrowItem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SPACING = 20;
const CONTAINER_PADDING = 20;
const CONTENT_WIDTH = SCREEN_WIDTH - CONTAINER_PADDING * 2;
const BG_OPACITY = 0.15;
const BUTTON_HEIGHT = 56;
const BUTTON_CIRCLE_SIZE = 56;
const SEND_BUTTON_WIDTH = 120; // Increased width for better capsule look

const IOS_SPRING_CONFIG = {
    damping: 15,
    mass: 1,
    stiffness: 120,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
};

// --- TYPES ---
interface User {
    id: string;
    uniqueUserId: string;
    name: string;
    profilePicture: string;
    birthday: string;
    dominantColor: string;
}

interface RowData {
    id: string;
    type: 'single' | 'double' | 'triple';
    users: User[];
}

interface SelectPrioritiesProps {
    capturedMedia?: { uri: string; type: 'image' | 'video' } | null;
    isFrontCamera?: boolean;
    onBack?: () => void;
    onSent?: (selectedIds: string[]) => void;
}

// --- HELPERS ---
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

// --- ROW GENERATION UTILITY ---
const generateRows = (userList: User[]): RowData[] => {
    const rows: RowData[] = [];
    let i = 0;
    while (i < userList.length) {
        const patternStep = i % 8;
        const uniqueId = `row-${i}`;

        if ((patternStep === 0 || patternStep === 5) && userList[i]) {
            rows.push({ id: uniqueId, type: 'single', users: [userList[i]] });
            i += 1;
        } else if ((patternStep === 1 || patternStep === 4 || patternStep === 6) && userList[i] && userList[i + 1]) {
            rows.push({ id: uniqueId, type: 'double', users: [userList[i], userList[i + 1]] });
            i += 2;
        } else if (userList[i] && userList[i + 1] && userList[i + 2]) {
            rows.push({ id: uniqueId, type: 'triple', users: [userList[i], userList[i + 1], userList[i + 2]] });
            i += 3;
        } else if (userList[i]) {
            rows.push({ id: uniqueId, type: 'single', users: [userList[i]] });
            i += 1;
        } else {
            break;
        }
    }
    return rows;
};

// --- ANIMATED ITEM COMPONENT ---
const AnimatedUserItem = React.memo(({
    user,
    isSelected,
    onToggle,
    width,
    height,
    style
}: {
    user: User,
    isSelected: boolean,
    onToggle: (id: string) => void,
    width: number,
    height: number,
    style?: any
}) => {
    const selectionProgress = useSharedValue(isSelected ? 1 : 0);

    useEffect(() => {
        selectionProgress.value = withSpring(isSelected ? 1 : 0, IOS_SPRING_CONFIG);
    }, [isSelected]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { scale: interpolate(selectionProgress.value, [0, 0.5, 1], [1, 0.92, 1]) }
            ]
        };
    });

    return (
        <Pressable onPress={() => onToggle(user.id)}>
            <Animated.View style={[style, animatedStyle]}>
                <DrawnArrowItem
                    user={user}
                    isSelected={isSelected}
                    onPress={() => onToggle(user.id)}
                    width={width}
                    height={height}
                />
            </Animated.View>
        </Pressable>
    );
});

// --- MEMOIZED ROW COMPONENT ---
const UserRow = React.memo(({ item, selectedIds, toggle }: { item: RowData, selectedIds: string[], toggle: (id: string) => void }) => {

    if (item.type === 'single') {
        const user = item.users[0];
        const actualSize = CONTENT_WIDTH * 0.75;
        return (
            <View style={styles.row}>
                <AnimatedUserItem
                    user={user}
                    isSelected={selectedIds.includes(user.id)}
                    onToggle={toggle}
                    width={actualSize}
                    height={actualSize}
                />
            </View>
        );
    }

    if (item.type === 'double') {
        const [u1, u2] = item.users;
        const itemW = (CONTENT_WIDTH - SPACING) / 2;
        return (
            <View style={styles.row}>
                <AnimatedUserItem user={u1} isSelected={selectedIds.includes(u1.id)} onToggle={toggle} width={itemW} height={itemW * 1.15} style={{ marginRight: SPACING / 2 }} />
                <AnimatedUserItem user={u2} isSelected={selectedIds.includes(u2.id)} onToggle={toggle} width={itemW} height={itemW * 0.95} style={{ marginLeft: SPACING / 2 }} />
            </View>
        );
    }

    if (item.type === 'triple') {
        const [u1, u2, u3] = item.users;
        const s = (CONTENT_WIDTH - (SPACING * 2)) / 3;
        return (
            <View style={styles.row}>
                <AnimatedUserItem user={u1} isSelected={selectedIds.includes(u1.id)} onToggle={toggle} width={s} height={s} style={{ marginRight: SPACING / 2 }} />
                <AnimatedUserItem user={u2} isSelected={selectedIds.includes(u2.id)} onToggle={toggle} width={s} height={s * 1.2} style={{ marginHorizontal: SPACING / 2 }} />
                <AnimatedUserItem user={u3} isSelected={selectedIds.includes(u3.id)} onToggle={toggle} width={s} height={s} style={{ marginLeft: SPACING / 2 }} />
            </View>
        );
    }

    return null;
}, (prev, next) => {
    const prevSelected = prev.item.users.map(u => prev.selectedIds.includes(u.id)).join(',');
    const nextSelected = next.item.users.map(u => next.selectedIds.includes(u.id)).join(',');
    return prevSelected === nextSelected && prev.item.id === next.item.id;
});


const SelectPriorities: React.FC<SelectPrioritiesProps> = ({
    capturedMedia, isFrontCamera, onBack, onSent,
}) => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // State
    const [selected, setSelected] = useState<string[]>([]);

    // Process rows once
    const processedRows = useMemo(() => generateRows(users as User[]), []);

    // Background Animation Context
    const { handleColorChange } = useBackground();

    // Local Reanimated Background State
    const bgColorProgress = useSharedValue(0);
    const currentBgColor = useSharedValue(COLORS.background || '#FFFFFF');
    const previousBgColor = useSharedValue(COLORS.background || '#FFFFFF');

    // Animation Values
    const splitAnim = useSharedValue(0);
    const countScaleAnim = useSharedValue(1);

    // --- EFFECTS ---

    useEffect(() => {
        const hasSelection = selected.length > 0;
        splitAnim.value = withSpring(hasSelection ? 1 : 0, IOS_SPRING_CONFIG);

        if (hasSelection) {
            countScaleAnim.value = withTiming(1.4, { duration: 150 }, () => {
                countScaleAnim.value = withSpring(1, IOS_SPRING_CONFIG);
            });
        }
    }, [selected.length]);

    useEffect(() => {
        const firstUser = users[0] as User;
        const initialColor = firstUser ? hexToRgba(firstUser.dominantColor, BG_OPACITY) : '#ffffff';

        currentBgColor.value = initialColor;
        previousBgColor.value = '#ffffff';
        bgColorProgress.value = 0;
        bgColorProgress.value = withTiming(1, { duration: 800 });

        handleColorChange(initialColor);
        return () => handleColorChange(COLORS.background);
    }, []);

    // --- CALLBACKS ---

    const toggle = useCallback((userId: string) => {
        Haptics.selectionAsync();
        setSelected((prev) => {
            const isSelected = prev.includes(userId);
            return isSelected ? prev.filter((x) => x !== userId) : [...prev, userId];
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        const allUserIds = users.map(u => u.id);
        const areAllSelected = selected.length === users.length;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (areAllSelected) {
            setSelected([]);
        } else {
            setSelected(allUserIds);
        }
    }, [selected.length]);

    const handleSend = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (onSent) {
            onSent(selected);
        } else {
            if (router.canDismiss()) { router.dismissAll(); } else { router.replace('/(tabs)'); }
        }
    };

    const handleBack = () => {
        if (onBack) onBack();
        else router.back();
    };

    // --- VIEWABILITY LOGIC ---
    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0) {
            const middleIndex = Math.floor(viewableItems.length / 2);
            const targetItem = viewableItems[middleIndex]?.item as RowData;

            if (targetItem && targetItem.users.length > 0) {
                const dominantColor = targetItem.users[0].dominantColor;
                const targetColor = hexToRgba(dominantColor, BG_OPACITY);

                if (targetColor !== currentBgColor.value) {
                    previousBgColor.value = currentBgColor.value;
                    currentBgColor.value = targetColor;
                    bgColorProgress.value = 0;
                    bgColorProgress.value = withTiming(1, { duration: 600 });
                }
            }
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
        minimumViewTime: 150
    }).current;

    // --- ANIMATED STYLES ---

    const sendButtonStyle = useAnimatedStyle(() => {
        const translateX = interpolate(splitAnim.value, [0, 1], [0, 75]);
        const opacity = interpolate(splitAnim.value, [0, 0.3, 1], [0, 0, 1]);
        const scale = interpolate(splitAnim.value, [0, 1], [0.8, 1]);
        // Width interpolates from a small circle (BUTTON_HEIGHT) to full capsule width (120)
        const width = interpolate(splitAnim.value, [0, 1], [BUTTON_HEIGHT, SEND_BUTTON_WIDTH]);
        return {
            transform: [{ translateX }, { scale }],
            opacity,
            width,
            height: BUTTON_HEIGHT,
            position: 'absolute',
            borderRadius: BUTTON_HEIGHT / 2, // Always half height = capsule
        };
    });

    const closeButtonStyle = useAnimatedStyle(() => {
        const translateX = interpolate(splitAnim.value, [0, 1], [0, -50]);
        return {
            transform: [{ translateX }],
            height: BUTTON_CIRCLE_SIZE,
            width: BUTTON_CIRCLE_SIZE,
            position: 'absolute',
            borderRadius: BUTTON_CIRCLE_SIZE / 2,
        };
    });

    const countTextStyle = useAnimatedStyle(() => ({
        transform: [{ scale: countScaleAnim.value }]
    }));

    const containerAnimatedStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            bgColorProgress.value,
            [0, 1],
            [previousBgColor.value, currentBgColor.value]
        );
        return { backgroundColor };
    });

    const isAllSelected = selected.length === users.length && users.length > 0;

    return (
        <Animated.View style={[styles.container, containerAnimatedStyle]}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0)']}
                    locations={[0, 0.6, 1]}
                    style={[styles.headerGradient, { paddingTop: insets.top + 10, height: insets.top + 70 }]}
                >
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>Select priorities</Text>
                    </View>
                </LinearGradient>
            </View>

            {/* List */}
            <Animated.FlatList
                data={processedRows}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <UserRow item={item} selectedIds={selected} toggle={toggle} />}
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 80 }]}
                showsVerticalScrollIndicator={false}
                initialNumToRender={6}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                ListHeaderComponent={
                    <View style={styles.actionRow}>
                        <TouchableOpacity onPress={handleSelectAll} style={styles.selectAllContainer} activeOpacity={0.6}>
                            <Text style={styles.selectAllText}>{isAllSelected ? 'Deselect All' : 'Select All'}</Text>
                            <View style={[styles.checkbox, isAllSelected && styles.checkboxSelected]}>
                                {isAllSelected && <Feather name="check" size={14} color="#FFF" />}
                            </View>
                        </TouchableOpacity>
                    </View>
                }
            />

            {/* Floating Action Bar */}
            <View style={[styles.floatingActionContainer, { paddingBottom: insets.bottom + 20, height: BUTTON_HEIGHT + insets.bottom + 20 }]}>
                <View style={styles.buttonsCenteringWrapper}>

                    {/* Send Button (Capsule) */}
                    <Animated.View style={[styles.buttonBaseStyle, sendButtonStyle]}>
                        <TouchableOpacity onPress={handleSend} activeOpacity={0.8} style={{ flex: 1, width: '100%' }}>
                            <View style={[styles.shadowWrapper, { width: '100%', borderRadius: BUTTON_HEIGHT / 2 }]}>
                                <BlurView intensity={80} tint="light" style={styles.blurContent}>
                                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.5)' }]} />
                                    <View style={styles.sendButtonContent}>
                                        {/* Text is lowercase for 'small caps' effect */}
                                        <Text style={styles.sendLabelText}>send</Text>
                                        <View style={styles.countBadge}>
                                            <Animated.Text style={[styles.sendCountText, countTextStyle]}>{selected.length}</Animated.Text>
                                        </View>
                                    </View>
                                </BlurView>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Close/Back Button (Circle) */}
                    <Animated.View style={[styles.buttonBaseStyle, closeButtonStyle]}>
                        <View style={[styles.shadowWrapper, { width: BUTTON_CIRCLE_SIZE, borderRadius: BUTTON_CIRCLE_SIZE / 2 }]}>
                            <BlurView intensity={80} tint="light" style={styles.blurContent}>
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.5)' }]} />
                                <TouchableOpacity onPress={handleBack} activeOpacity={0.7} style={styles.iconCenter}>
                                    <Ionicons name="close" size={28} color="#000" />
                                </TouchableOpacity>
                            </BlurView>
                        </View>
                    </Animated.View>

                </View>
            </View>

        </Animated.View>
    );
};

export default SelectPriorities;

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
    headerGradient: { width: '100%', paddingHorizontal: 20, justifyContent: 'flex-start' },
    headerContent: { width: '100%', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontFamily: FONTS.bold, color: '#000', opacity: 0.9, textAlign: 'center' },
    actionRow: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 10, marginBottom: 20 },
    selectAllContainer: { flexDirection: 'row', alignItems: 'center', padding: 8 },
    selectAllText: { fontSize: 15, fontFamily: FONTS.medium, color: 'rgba(0,0,0,0.6)', marginRight: 8 },
    checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
    checkboxSelected: { backgroundColor: '#000', borderColor: '#000' },
    scrollContent: { paddingBottom: 140, paddingHorizontal: CONTAINER_PADDING },
    row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24, width: '100%' },
    floatingActionContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 200, alignItems: 'center', justifyContent: 'flex-end' },
    buttonsCenteringWrapper: { position: 'relative', width: SCREEN_WIDTH, height: BUTTON_HEIGHT, alignItems: 'center', justifyContent: 'center', marginBottom: 0 },
    buttonBaseStyle: { height: BUTTON_HEIGHT, justifyContent: 'center', alignItems: 'center', position: 'absolute' },
    shadowWrapper: { height: BUTTON_HEIGHT, backgroundColor: 'transparent', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 },
    blurContent: { width: '100%', height: '100%', overflow: 'hidden', borderRadius: BUTTON_HEIGHT / 2 },
    iconCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    sendButtonContent: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0 },
    sendLabelText: { fontSize: 16, fontFamily: FONTS.bold, color: '#000', marginRight: 4, textTransform: 'lowercase' }, // Lowercase
    countBadge: { paddingHorizontal: 4, paddingVertical: 2 },
    sendCountText: { fontSize: 16, fontFamily: FONTS.bold, color: '#000' }
});
