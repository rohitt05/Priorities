import React, { useMemo } from 'react';
import {
    View,
    StyleSheet,
    Image,
    Dimensions,
    Text,
    TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/theme/theme';

// ✅ CORRECT IMPORTS: Use curly braces for named exports
import { TimelineEvent } from '@/features/timeline/utils/timelineCalendarLogic';
import { TIMELINE_EVENTS } from '@/data/timelineData';

const { width } = Dimensions.get('window');
const GAP = 4; // Slight gap looks cleaner
const ITEM_WIDTH = (width - 48 - (GAP * 2)) / 3; // 48 is parent padding (24*2)

interface UserMediaGridProps {
    userUniqueId: string;
}

export default function UserMediaGrid({ userUniqueId }: UserMediaGridProps) {

    // Filter for "My" photos and videos
    const myMedia = useMemo(() => {
        // Fallback logic from your previous code
        let events = TIMELINE_EVENTS.filter((e: TimelineEvent) => e.userUniqueId === userUniqueId);

        if (events.length === 0) {
            events = TIMELINE_EVENTS.filter((e: TimelineEvent) => e.userUniqueId === 'rohit123');
        }

        // ✅ Explicitly checking types to satisfy TypeScript
        return events
            .filter((e: TimelineEvent) =>
                e.sender === 'me' &&
                (e.type === 'photo' || e.type === 'video')
            )
            .sort((a: TimelineEvent, b: TimelineEvent) =>
                new Date(b.ts).getTime() - new Date(a.ts).getTime()
            );
    }, [userUniqueId]);

    const renderItem = (item: TimelineEvent) => {
        return (
            <TouchableOpacity activeOpacity={0.8} style={styles.gridItem}>
                <Image
                    source={{ uri: item.thumbUri || item.uri }}
                    style={styles.image}
                    resizeMode="cover"
                />
                {item.type === 'video' && (
                    <View style={styles.videoBadge}>
                        <Ionicons name="play" size={12} color="#FFF" />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (myMedia.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No media shared yet.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>My Films</Text>
            <View style={styles.gridContainer}>
                {myMedia.map((item) => (
                    <View key={item.id} style={styles.gridWrapper}>
                        {renderItem(item)}
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 10,
        paddingBottom: 40,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000',
        marginBottom: 15,
        letterSpacing: -0.5,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GAP,
    },
    gridWrapper: {
        width: ITEM_WIDTH,
        height: ITEM_WIDTH * 1.4, // 4:5 Aspect Ratio looks better for "Films"
        borderRadius: 8,
        overflow: 'hidden',
    },
    gridItem: {
        flex: 1,
        backgroundColor: '#f0f0f0',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    videoBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontSize: 14,
    }
});
