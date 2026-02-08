import React, { useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    Image,
    TouchableOpacity,
    Dimensions,
    Animated,
    Easing,
    LayoutRectangle,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Entypo } from '@expo/vector-icons';
import { useBackground } from '../../src/context/BackgroundContext';
import users from '../../src/data/users.json';
import TimelineBottomSheet from '../../src/components/TimelineBottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ✅ IMPORT NEW COMPONENTS & CONTEXT
import UserTimelineView from '../../src/components/UserTimelineView';
import { useTabBarVisibility } from '../../src/context/TabBarVisibilityContext';

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

export default function TimelinesScreen() {
    const insets = useSafeAreaInsets();
    const { handleColorChange } = useBackground();

    // ✅ CONSUME VISIBILITY CONTEXT
    const { hideTabBar, showTabBar } = useTabBarVisibility();

    // Sheet State
    const [selectedUserForSheet, setSelectedUserForSheet] = useState<User | null>(null);

    // Expansion State
    const [expandedUser, setExpandedUser] = useState<User | null>(null);
    const [originLayout, setOriginLayout] = useState<LayoutRectangle | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    // Animation Values
    const expandAnim = useRef(new Animated.Value(0)).current;
    const fadeGridAnim = useRef(new Animated.Value(1)).current;

    const handleExpand = (user: User, layout: LayoutRectangle) => {
        if (isAnimating) return;
        setIsAnimating(true);

        // 1. Hide Tabs immediately
        hideTabBar();

        setOriginLayout(layout);
        setExpandedUser(user);
        handleColorChange(user.dominantColor);
        expandAnim.setValue(0);

        Animated.parallel([
            Animated.timing(expandAnim, {
                toValue: 1,
                duration: 350,
                useNativeDriver: false,
                easing: Easing.bezier(0.2, 0, 0.2, 1),
            }),
            Animated.timing(fadeGridAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start(() => setIsAnimating(false));
    };

    const handleCollapse = () => {
        if (isAnimating) return;
        setIsAnimating(true);

        // 2. Show Tabs immediately when closing starts
        showTabBar();

        Animated.parallel([
            Animated.timing(expandAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: false,
                easing: Easing.out(Easing.quad),
            }),
            Animated.timing(fadeGridAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            })
        ]).start(() => {
            setExpandedUser(null);
            setOriginLayout(null);
            setIsAnimating(false);
        });
    };

    const renderItem = (user: User, w: number, h: number, seedKey: string) => {
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

        const isHidden = expandedUser?.id === user.id;

        return (
            <View
                key={user.id}
                style={{ width: w, height: h, position: 'relative', zIndex: 1, opacity: isHidden ? 0 : 1 }}
            >
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={(e) => {
                        (e.target as any).measureInWindow((x: number, y: number, width: number, height: number) => {
                            handleExpand(user, { x, y, width, height });
                        });
                    }}
                    style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: 999,
                        backgroundColor: user.dominantColor,
                        overflow: 'hidden',
                    }}
                >
                    <Image
                        source={{ uri: user.profilePicture }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setSelectedUserForSheet(user)}
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

    const renderMixedLayout = () => {
        const rows: React.ReactNode[] = [];
        let i = 0;
        const userList = users as User[];
        while (i < userList.length) {
            const patternStep = i % 8;
            if ((patternStep === 0 || patternStep === 5) && userList[i]) {
                const user = userList[i];
                const size = CONTENT_WIDTH * 0.75;
                rows.push(<View key={`row-${i}`} style={[styles.row, { justifyContent: 'center' }]}>{renderItem(user, size, size, `${user.id}-${i}`)}</View>);
                i += 1;
            } else if ((patternStep === 1 || patternStep === 4 || patternStep === 6) && userList[i] && userList[i + 1]) {
                const u1 = userList[i];
                const u2 = userList[i + 1];
                const itemW = (CONTENT_WIDTH - SPACING) / 2;
                rows.push(<View key={`row-${i}`} style={styles.row}>{renderItem(u1, itemW, itemW * 1.15, `${u1.id}-${i}`)}{renderItem(u2, itemW, itemW * 0.95, `${u2.id}-${i + 1}`)}</View>);
                i += 2;
            } else if (userList[i] && userList[i + 1] && userList[i + 2]) {
                const u1 = userList[i];
                const u2 = userList[i + 1];
                const u3 = userList[i + 2];
                const s = (CONTENT_WIDTH - (SPACING * 2)) / 3;
                rows.push(<View key={`row-${i}`} style={styles.row}>{renderItem(u1, s, s, `${u1.id}-${i}`)}{renderItem(u2, s, s * 1.2, `${u2.id}-${i + 1}`)}{renderItem(u3, s, s, `${u3.id}-${i + 2}`)}</View>);
                i += 3;
            } else if (userList[i]) {
                const user = userList[i];
                const size = CONTENT_WIDTH * 0.5;
                rows.push(<View key={`row-${i}`} style={[styles.row, { justifyContent: 'center' }]}>{renderItem(user, size, size, `${user.id}-${i}`)}</View>);
                i += 1;
            } else { break; }
        }
        return rows;
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            <Animated.ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={!expandedUser}
                style={{ opacity: fadeGridAnim }}
            >
                {renderMixedLayout()}
            </Animated.ScrollView>

            <UserTimelineView
                user={expandedUser}
                originLayout={originLayout}
                expandAnim={expandAnim}
                onClose={handleCollapse}
                topInset={insets.top}
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
        paddingTop: 80,
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
});
