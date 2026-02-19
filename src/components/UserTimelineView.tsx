import React, { useState, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Animated,
    Pressable,
    LayoutRectangle,
    BackHandler,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useBackground } from '@/context/BackgroundContext';
import { SPACING, COLORS } from '@/constants/theme';
import TimelineCalendar from './TimelineCalendar';
import MediaViewer from './MediaViewer';
import { MediaItem } from '../../types/mediaTypes';
import { TimelineEvent } from './timelineCalendarLogic';


// ==========================================
// TIMELINE DATA
// ==========================================


const TIMELINE_EVENTS: TimelineEvent[] = [
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


const hexToRgba = (hex: string, opacity: number): string => {
    if (!hex) return `rgba(255, 255, 255, ${opacity})`;
    const cleanHex = hex.replace('#', '');
    let r: number, g: number, b: number;
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


const formatTimestamp = (isoTs: string): string => {
    const date = new Date(isoTs);
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};


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


export default function UserTimelineView({
    user,
    originLayout,
    expandAnim,
    onClose,
    topInset
}: UserTimelineViewProps) {
    const { bgColor, prevBgColor, colorAnim } = useBackground();
    const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);


    // Hardware back button handler
    useEffect(() => {
        if (!user) return;


        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (mediaViewerVisible) {
                handleCloseMediaViewer();
                return true;
            }
            onClose();
            return true;
        });


        return () => backHandler.remove();
    }, [user, mediaViewerVisible, onClose]);


    const allUserMedia = useMemo(() => {
        if (!user) return [];
        let events = TIMELINE_EVENTS.filter(e => e.userUniqueId === user.uniqueUserId);
        if (events.length === 0) {
            events = TIMELINE_EVENTS.filter(e => e.userUniqueId === 'rohit123');
        }
        const sorted = [...events].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
        return sorted.map((event, index) => ({
            id: event.id || `temp_id_${index}`,
            type: event.type,
            uri: event.uri,
            thumbUri: event.thumbUri,
            text: event.text,
            caption: event.caption,
            durationSec: event.durationSec,
            title: event.title,
            timestamp: formatTimestamp(event.ts),
            sender: event.sender
        } as MediaItem));
    }, [user]);


    const handleMediaPress = (event: TimelineEvent) => {
        const mediaItem = allUserMedia.find(item => item.id === event.id);
        if (mediaItem) {
            setSelectedMedia(mediaItem);
            setMediaViewerVisible(true);
        } else {
            const temp: MediaItem = {
                id: event.id,
                type: event.type,
                uri: event.uri,
                text: event.text,
                caption: event.caption,
                sender: event.sender,
                timestamp: formatTimestamp(event.ts)
            };
            setSelectedMedia(temp);
            setMediaViewerVisible(true);
        }
    };


    const handleCloseMediaViewer = () => {
        setMediaViewerVisible(false);
        setTimeout(() => setSelectedMedia(null), 300);
    };


    if (!user || !originLayout) return null;


    const HEADER_HEIGHT = Math.max(topInset, SPACING.xl) + 40 + SPACING.xl;
    const TARGET_TOP = HEADER_HEIGHT + 10;
    const CLIPPING_START_Y = HEADER_HEIGHT;
    const TARGET_LEFT = 20;
    const TARGET_SIZE = 50;


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


    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents="box-none">
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                <Animated.View style={[
                    styles.clippingContainer,
                    {
                        top: CLIPPING_START_Y,
                        opacity: contentOpacity,
                        backgroundColor: COLORS.background,
                        transform: [{ translateY: contentTranslateY }]
                    }
                ]}>


                    <TimelineCalendar
                        userUniqueId={user!.uniqueUserId}
                        timelineEvents={TIMELINE_EVENTS}
                        contentPaddingTop={(TARGET_TOP - CLIPPING_START_Y) + TARGET_SIZE + 20}
                        onMediaPress={handleMediaPress}
                    />
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
                                    <Ionicons name="close" size={28} color="#000" />
                                </TouchableOpacity>
                            </BlurView>
                        </View>
                    </View>
                </Animated.View>


                <Animated.View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        top: CLIPPING_START_Y,
                        left: 0,
                        right: 0,
                        height: TARGET_SIZE + 60,
                        opacity: contentOpacity,
                        zIndex: 90,
                    }}
                >
                    <LinearGradient
                        colors={[
                            hexToRgba(bgColor, 1),
                            hexToRgba(bgColor, 0.8),
                            hexToRgba(bgColor, 0)
                        ]}
                        locations={[0, 0.4, 1]}
                        style={{ flex: 1 }}
                    />
                </Animated.View>


                <Animated.View
                    style={{
                        position: 'absolute',
                        top: topAnim,
                        left: leftAnim,
                        width: widthAnim,
                        height: heightAnim,
                        borderRadius: radiusAnim,
                        backgroundColor: user!.dominantColor,
                        overflow: 'hidden',
                        zIndex: 100,
                        elevation: 10
                    }}
                >
                    <Pressable onPress={onClose} style={{ flex: 1 }}>
                        <Image
                            source={{ uri: user!.profilePicture }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                    </Pressable>
                </Animated.View>


                <Animated.View
                    style={{
                        position: 'absolute',
                        top: TARGET_TOP,
                        left: TARGET_LEFT + TARGET_SIZE + 15,
                        right: 60,
                        height: TARGET_SIZE,
                        justifyContent: 'center',
                        opacity: contentOpacity,
                        zIndex: 100
                    }}
                >
                    <Text
                        style={{
                            fontSize: 28,
                            fontFamily: 'DancingScript-Bold',
                            color: '#000'
                        }}
                        numberOfLines={1}
                    >
                        {user!.name}
                    </Text>
                </Animated.View>


            </View>


            <MediaViewer
                visible={mediaViewerVisible}
                initialMediaItem={selectedMedia}
                allMediaItems={allUserMedia}
                onClose={handleCloseMediaViewer}
            />
        </View>
    );
}


const BUTTON_SIZE = 56;


const styles = StyleSheet.create({
    clippingContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    floatingCloseContainer: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 200
    },
    closeBtnShadowWrapper: {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 0, // Removed elevation to prevent Android ring artifact
        borderRadius: BUTTON_SIZE / 2,
        backgroundColor: 'transparent',
    },
    closeBtnBlur: {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        overflow: 'hidden',
        borderWidth: 0, // Explicitly no border
    },
    closeBtnContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
