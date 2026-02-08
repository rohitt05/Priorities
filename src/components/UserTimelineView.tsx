import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Animated,
    Pressable,
    LayoutRectangle,
    Modal,
    FlatList,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useBackground } from '@/context/BackgroundContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ==========================================
// 1. REAL TIMELINE DATA (Updated with actual data)
// ==========================================

const REAL_TIMELINE_DATA = [
    {
        "id": "ev_0025",
        "userUniqueId": "lana143",
        "ts": "2025-09-21T19:53:00+05:30",
        "sender": "them",
        "type": "voice_call",
        "durationSec": 1516
    },
    {
        "id": "ev_0023",
        "userUniqueId": "lana143",
        "ts": "2025-09-21T11:34:00+05:30",
        "sender": "me",
        "type": "photo",
        "uri": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e",
        "thumbUri": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=300&fit=crop",
        "caption": "Weekend mood"
    },
    {
        "id": "ev_0016",
        "userUniqueId": "jane_doe",
        "ts": "2025-09-21T09:29:00+05:30",
        "sender": "them",
        "type": "photo",
        "uri": "https://images.unsplash.com/photo-1472214103451-9374bd1c798e",
        "thumbUri": "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=300&h=300&fit=crop",
        "caption": "Coffee time ☕"
    },
    {
        "id": "ev_0017",
        "userUniqueId": "jane_doe",
        "ts": "2025-09-21T08:21:00+05:30",
        "sender": "me",
        "type": "voice_call",
        "durationSec": 1636
    },
    {
        "id": "ev_0015",
        "userUniqueId": "jane_doe",
        "ts": "2025-09-21T07:50:00+05:30",
        "sender": "me",
        "type": "audio",
        "durationSec": 104,
        "title": "Voice note",
        "uri": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
    },
    {
        "id": "ev_0024",
        "userUniqueId": "lana143",
        "ts": "2025-09-21T07:18:00+05:30",
        "sender": "them",
        "type": "note",
        "text": "Can't wait to see you"
    },
    {
        "id": "ev_0019",
        "userUniqueId": "jane_doe",
        "ts": "2025-09-21T06:22:00+05:30",
        "sender": "them",
        "type": "video_call",
        "durationSec": 2990
    },
    {
        "id": "ev_0018",
        "userUniqueId": "jane_doe",
        "ts": "2025-09-21T01:33:00+05:30",
        "sender": "them",
        "type": "note",
        "text": "Work mode 💻"
    },
    {
        "id": "ev_0020",
        "userUniqueId": "charlie_brown",
        "ts": "2025-09-20T22:09:00+05:30",
        "sender": "me",
        "type": "note",
        "text": "Work mode 💻"
    },
    {
        "id": "ev_0014",
        "userUniqueId": "jane_doe",
        "ts": "2025-09-20T13:24:00+05:30",
        "sender": "them",
        "type": "video",
        "durationSec": 24,
        "uri": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "thumbUri": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&h=300&fit=crop",
        "caption": "Adventure awaits"
    },
    {
        "id": "ev_0021",
        "userUniqueId": "charlie_brown",
        "ts": "2025-09-20T09:34:00+05:30",
        "sender": "them",
        "type": "audio",
        "durationSec": 34,
        "title": "Audio message",
        "uri": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
    },
    {
        "id": "ev_0022",
        "userUniqueId": "charlie_brown",
        "ts": "2025-09-20T02:30:00+05:30",
        "sender": "me",
        "type": "photo",
        "uri": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29",
        "thumbUri": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&h=300&fit=crop",
        "caption": "Check this out"
    },
    {
        "id": "ev_0013",
        "userUniqueId": "jane_doe",
        "ts": "2025-09-19T19:59:00+05:30",
        "sender": "me",
        "type": "photo",
        "uri": "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d",
        "thumbUri": "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=300&h=300&fit=crop",
        "caption": "Miss you 💕"
    },
    {
        "id": "ev_0026",
        "userUniqueId": "bob_builder",
        "ts": "2025-09-18T13:09:00+05:30",
        "sender": "me",
        "type": "voice_call",
        "durationSec": 1655
    },
    {
        "id": "ev_0027",
        "userUniqueId": "bob_builder",
        "ts": "2025-09-17T17:34:00+05:30",
        "sender": "me",
        "type": "photo",
        "uri": "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05",
        "thumbUri": "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&h=300&fit=crop"
    },
    {
        "id": "ev_0005",
        "userUniqueId": "rohit123",
        "ts": "2025-09-15T15:33:00+05:30",
        "sender": "them",
        "type": "photo",
        "uri": "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07",
        "thumbUri": "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=300&h=300&fit=crop",
        "caption": "Throwback"
    },
    {
        "id": "ev_0003",
        "userUniqueId": "rohit123",
        "ts": "2025-09-14T23:54:00+05:30",
        "sender": "them",
        "type": "note",
        "text": "Gym done ✅"
    },
    {
        "id": "ev_0002",
        "userUniqueId": "rohit123",
        "ts": "2025-09-14T07:21:00+05:30",
        "sender": "me",
        "type": "voice_call",
        "durationSec": 424
    },
    {
        "id": "ev_0006",
        "userUniqueId": "rohit123",
        "ts": "2025-09-13T22:44:00+05:30",
        "sender": "them",
        "type": "audio",
        "durationSec": 48,
        "title": "Voice note",
        "uri": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
    },
    {
        "id": "ev_0028",
        "userUniqueId": "bob_builder",
        "ts": "2025-09-13T17:26:00+05:30",
        "sender": "them",
        "type": "video_call",
        "durationSec": 3038
    },
    {
        "id": "ev_0004",
        "userUniqueId": "rohit123",
        "ts": "2025-09-13T15:42:00+05:30",
        "sender": "them",
        "type": "video",
        "durationSec": 22,
        "uri": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "thumbUri": "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=300&h=300&fit=crop"
    },
    {
        "id": "ev_0001",
        "userUniqueId": "rohit123",
        "ts": "2025-09-13T11:35:00+05:30",
        "sender": "me",
        "type": "photo",
        "uri": "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0",
        "thumbUri": "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?w=300&h=300&fit=crop",
        "caption": "Morning vibes ☀️"
    },
    {
        "id": "ev_0009",
        "userUniqueId": "rohit123",
        "ts": "2025-09-12T21:24:00+05:30",
        "sender": "me",
        "type": "note",
        "text": "Late night thoughts"
    },
    {
        "id": "ev_0010",
        "userUniqueId": "rohit123",
        "ts": "2025-09-11T15:11:00+05:30",
        "sender": "them",
        "type": "photo",
        "uri": "https://images.unsplash.com/photo-1469474968028-56623f02e42e",
        "thumbUri": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&h=300&fit=crop"
    },
    {
        "id": "ev_0008",
        "userUniqueId": "rohit123",
        "ts": "2025-09-09T11:35:00+05:30",
        "sender": "me",
        "type": "video",
        "durationSec": 35,
        "uri": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        "thumbUri": "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?w=300&h=300&fit=crop",
        "caption": "Good times"
    },
    {
        "id": "ev_0007",
        "userUniqueId": "rohit123",
        "ts": "2025-09-07T11:42:00+05:30",
        "sender": "them",
        "type": "video_call",
        "durationSec": 1893
    },
    {
        "id": "ev_0029",
        "userUniqueId": "bob_builder",
        "ts": "2025-09-06T12:33:00+05:30",
        "sender": "me",
        "type": "note",
        "text": "Coffee date was perfect"
    },
    {
        "id": "ev_0011",
        "userUniqueId": "rohit123",
        "ts": "2025-08-20T18:08:00+05:30",
        "sender": "them",
        "type": "note",
        "text": "Good morning sunshine ☀️"
    },
    {
        "id": "ev_0012",
        "userUniqueId": "rohit123",
        "ts": "2025-08-04T14:23:00+05:30",
        "sender": "them",
        "type": "audio",
        "durationSec": 109,
        "title": "Reply VN",
        "uri": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
    }
];

// ==========================================
// 2. HELPERS
// ==========================================

const hexToRgba = (hex: string, opacity: number) => {
    if (!hex) return `rgba(255, 255, 255, ${opacity})`;
    const cleanHex = hex.replace('#', '');
    let r, g, b;
    if (cleanHex.length === 3) {
        r = parseInt(cleanHex[0] + cleanHex[0], 16);
        g = parseInt(cleanHex[1] + cleanHex[1], 16);
        b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else {
        r = parseInt(cleanHex.substring(0, 2), 16);
        g = parseInt(cleanHex.substring(2, 4), 16);
        b = parseInt(cleanHex.substring(4, 6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toDateKey = (isoTs: string) => {
    const d = new Date(isoTs);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const getMonthLabel = (dateKey: string) => {
    const [y, m] = dateKey.split('-').map(x => parseInt(x, 10));
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
};
const getWeekday = (isoTs: string) => new Date(isoTs).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
const getDay = (isoTs: string) => `${new Date(isoTs).getDate()}`;

interface User {
    id: string;
    uniqueUserId: string;
    name: string;
    profilePicture: string;
    birthday: string;
    dominantColor: string;
}

interface UserTimelineViewProps {
    user: User | null;
    originLayout: LayoutRectangle | null;
    expandAnim: Animated.Value;
    onClose: () => void;
    topInset: number;
}

// ==========================================
// 3. MAIN COMPONENT
// ==========================================

export default function UserTimelineView({
    user,
    originLayout,
    expandAnim,
    onClose,
    topInset
}: UserTimelineViewProps) {

    const { bgColor, prevBgColor, colorAnim } = useBackground();

    // --- DATA TRANSFORMATION ---
    const processedTimelineData = useMemo(() => {
        // 1. Filter events for the selected user
        let filteredEvents = REAL_TIMELINE_DATA.filter(e => e.userUniqueId === user?.uniqueUserId);

        // 2. Fallback to rohit123 if no data (for demo purposes)
        if (filteredEvents.length === 0) {
            filteredEvents = REAL_TIMELINE_DATA.filter(e => e.userUniqueId === 'rohit123');
        }

        // 3. Sort by Date Descending (Newest first)
        const sortedEvents = filteredEvents.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

        // 4. Group by Date Key (YYYY-MM-DD)
        const grouped = new Map();
        sortedEvents.forEach((ev: any) => {
            const key = toDateKey(ev.ts);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(ev);
        });

        // 5. Build FlatList Rows (Month Headers + Day Rows)
        const rows: any[] = [];
        let lastMonth = '';

        grouped.forEach((events: any[], dateKey: string) => {
            const month = dateKey.slice(0, 7); // YYYY-MM

            // Add Month Header?
            if (month !== lastMonth) {
                rows.push({ id: `h_${month}`, type: 'month_header', label: getMonthLabel(dateKey) });
                lastMonth = month;
            }

            // Transform raw events to UI items
            const items = events.map((ev: any) => {
                let type = 'note';
                let bg = '#eee';

                if (ev.type === 'photo') { type = 'photo'; bg = '#eee'; }
                else if (ev.type === 'video') { type = 'photo'; bg = '#000'; }
                else if (ev.type === 'voice_call') { type = 'audio'; bg = '#F8BBD0'; }
                else if (ev.type === 'video_call') { type = 'play'; bg = '#E1BEE7'; }
                else if (ev.type === 'note') { type = 'note'; bg = '#FFF9C4'; }
                else if (ev.type === 'audio') { type = 'audio'; bg = '#B2DFDB'; }

                return {
                    type,
                    bg,
                    uri: ev.thumbUri || ev.uri,
                    text: ev.text || ev.caption,
                };
            });

            // Calculate "Mood Color" based on content types
            const moodColor = items.some((x: any) => x.type === 'photo')
                ? ['#a18cd1', '#fbc2eb']
                : ['#FF9A9E', '#FECFEF'];

            const firstEv = events[0];

            rows.push({
                id: `d_${dateKey}`,
                type: 'day',
                weekday: getWeekday(firstEv.ts),
                day: getDay(firstEv.ts),
                moodColor,
                items
            });
        });

        return rows;
    }, [user]);

    if (!user || !originLayout) return null;

    // --- POSITIONS ---
    const TARGET_TOP = Math.max(topInset, 20) + 40;
    const CLIPPING_START_Y = Math.max(topInset, 20) + 10;

    const TARGET_LEFT = 20;
    const TARGET_SIZE = 50;

    // --- ANIMATIONS ---
    const topAnim = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [originLayout.y, TARGET_TOP]
    });
    const leftAnim = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [originLayout.x, TARGET_LEFT]
    });
    const widthAnim = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [originLayout.width, TARGET_SIZE]
    });
    const heightAnim = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [originLayout.height, TARGET_SIZE]
    });
    const radiusAnim = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [Math.min(originLayout.width, originLayout.height) / 2, TARGET_SIZE / 2]
    });
    const contentOpacity = expandAnim.interpolate({
        inputRange: [0, 0.8, 1],
        outputRange: [0, 0, 1]
    });
    const contentTranslateY = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [50, 0]
    });

    const renderGridItem = (item: any, index: number) => {
        const itemSize = (SCREEN_WIDTH * 0.70) / 3 - 6;
        return (
            <View key={index} style={[styles.gridItem, { width: itemSize, height: itemSize, backgroundColor: item.bg || '#eee' }]}>
                {item.type === 'photo' && item.uri && (
                    <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                )}
                {item.type === 'note' && (
                    <View style={{ padding: 5, justifyContent: 'center', height: '100%' }}>
                        {item.text && <Text style={{ fontSize: 8, fontWeight: 'bold' }} numberOfLines={3}>{item.text}</Text>}
                        <View style={{ height: 2, width: '80%', backgroundColor: 'rgba(0,0,0,0.1)', marginTop: 4 }} />
                        <View style={{ height: 2, width: '50%', backgroundColor: 'rgba(0,0,0,0.1)', marginTop: 2 }} />
                    </View>
                )}
                {item.type === 'audio' && <Ionicons name="call" size={20} color="#000" style={{ opacity: 0.5 }} />}
                {item.type === 'play' && <Ionicons name="videocam" size={20} color="#000" />}
            </View>
        );
    };

    const renderTimelineRow = ({ item }: { item: any }) => {
        if (item.type === 'month_header') {
            return (
                <View style={styles.monthHeaderRow}>
                    <View style={styles.leftCol} />
                    <View style={styles.railColumn}>
                        <View style={styles.railLine} />
                    </View>
                    <View style={styles.rightCol}>
                        <Text style={styles.monthText}>{item.label}</Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.timelineRow}>
                <View style={styles.leftCol}>
                    <Text style={styles.weekdayText}>{item.weekday}</Text>
                    <Text style={styles.dayText}>{item.day}</Text>
                    <LinearGradient colors={item.moodColor} style={styles.moodDot} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                </View>
                <View style={styles.railColumn}>
                    <View style={styles.railLine} />
                </View>
                <View style={styles.rightCol}>
                    <View style={styles.gridContainer}>
                        {item.items.map((gridItem: any, idx: number) => renderGridItem(gridItem, idx))}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <Modal transparent visible={true} animationType="none" onRequestClose={onClose}>
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

                {/* 3. CONTENT (LIST) */}
                <Animated.View style={[
                    styles.clippingContainer,
                    {
                        top: CLIPPING_START_Y,
                        opacity: contentOpacity,
                        transform: [{ translateY: contentTranslateY }]
                    }
                ]}>
                    <FlatList
                        data={processedTimelineData}
                        renderItem={renderTimelineRow}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{
                            paddingTop: (TARGET_TOP - CLIPPING_START_Y) + TARGET_SIZE + 20,
                            paddingBottom: 120
                        }}
                        showsVerticalScrollIndicator={false}
                    />

                    {/* --- CLOSE BUTTON --- */}
                    <View style={styles.floatingCloseContainer}>
                        <View style={styles.closeBtnShadowWrapper}>
                            <BlurView intensity={80} tint="light" style={styles.closeBtnBlur}>
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor, opacity: 0.25 }]} />
                                <Animated.View
                                    style={[
                                        StyleSheet.absoluteFill,
                                        {
                                            backgroundColor: prevBgColor,
                                            opacity: colorAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.25, 0]
                                            })
                                        }
                                    ]}
                                />
                                <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtnContent}>
                                    <Ionicons name="close" size={24} color="#000" />
                                    <Text style={styles.closeText}>Close Timeline</Text>
                                </TouchableOpacity>
                            </BlurView>
                        </View>
                    </View>
                </Animated.View>

                {/* --- FADED MASK --- */}
                <Animated.View
                    pointerEvents="none"
                    style={{
                        position: 'absolute', top: CLIPPING_START_Y, left: 0, right: 0,
                        height: TARGET_SIZE + 60, opacity: contentOpacity, zIndex: 90,
                    }}
                >
                    <LinearGradient
                        colors={[hexToRgba(bgColor, 1), hexToRgba(bgColor, 0.8), hexToRgba(bgColor, 0)]}
                        locations={[0, 0.4, 1]}
                        style={{ flex: 1 }}
                    />
                </Animated.View>

                {/* 1. PROFILE BUBBLE */}
                <Animated.View
                    style={{
                        position: 'absolute', top: topAnim, left: leftAnim, width: widthAnim, height: heightAnim,
                        borderRadius: radiusAnim, backgroundColor: user.dominantColor,
                        overflow: 'hidden', zIndex: 100, elevation: 10
                    }}
                >
                    <Pressable onPress={onClose} style={{ flex: 1 }}>
                        <Image source={{ uri: user.profilePicture }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </Pressable>
                </Animated.View>

                {/* 2. NAME HEADER */}
                <Animated.View
                    style={{
                        position: 'absolute', top: TARGET_TOP, left: TARGET_LEFT + TARGET_SIZE + 15, right: 60,
                        height: TARGET_SIZE, justifyContent: 'center', opacity: contentOpacity, zIndex: 100
                    }}
                >
                    <Text style={{ fontSize: 28, fontFamily: 'DancingScript-Bold', color: '#000' }} numberOfLines={1}>
                        {user.name}
                    </Text>
                </Animated.View>

            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    clippingContainer: {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        overflow: 'hidden', backgroundColor: 'transparent',
    },
    timelineRow: { flexDirection: 'row', paddingBottom: 20, paddingRight: 20 },
    monthHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 20, paddingTop: 10 },
    monthText: { fontSize: 36, fontWeight: '300', letterSpacing: 1, color: '#000', marginLeft: 6 },
    leftCol: { width: '18%', alignItems: 'center', paddingTop: 0 },
    railColumn: { width: 10, alignItems: 'center', height: '100%' },
    rightCol: { flex: 1, justifyContent: 'center' },
    weekdayText: { fontSize: 10, fontWeight: '700', color: '#000', textTransform: 'uppercase', marginBottom: 2 },
    dayText: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 8 },
    moodDot: { width: 12, height: 12, borderRadius: 6 },
    railLine: { width: 3, backgroundColor: '#000', flex: 1, height: '100%' },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    gridItem: { justifyContent: 'center', alignItems: 'center', borderRadius: 2, overflow: 'hidden' },

    floatingCloseContainer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', zIndex: 200 },
    closeBtnShadowWrapper: {
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15,
        shadowRadius: 10, elevation: 6, borderRadius: 30, backgroundColor: 'transparent',
    },
    closeBtnBlur: { borderRadius: 30, overflow: 'hidden' },
    closeBtnContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14 },
    closeText: { marginLeft: 8, fontWeight: '600', fontSize: 16, color: '#000' }
});
