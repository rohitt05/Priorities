// src/features/timeline/components/TimelineCalendar.tsx
import React, { useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, Image,
    FlatList, Dimensions, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    TimelineRow, processTimelineData, filterEventsForUser,
} from '@/features/timeline/utils/timelineCalendarLogic';
import { TimelineEvent } from '@/types/domain';
import SmartVideoTile from '@/components/ui/SmartVideoTile';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TimelineCalendarProps {
    userUniqueId: string;
    timelineEvents: TimelineEvent[];
    contentPaddingTop: number;
    onMediaPress?: (event: TimelineEvent) => void;
}

export default function TimelineCalendar({
    userUniqueId, timelineEvents, contentPaddingTop, onMediaPress,
}: TimelineCalendarProps) {

    const userEvents = useMemo(
        () => filterEventsForUser(timelineEvents, userUniqueId),
        [timelineEvents, userUniqueId]
    );

    const timelineRows = useMemo(
        () => processTimelineData(userEvents),
        [userEvents]
    );

    const eventById = useMemo(() => {
        const map = new Map<string, TimelineEvent>();
        userEvents.forEach(e => {
            const ev = e as any;
            if (ev.id) map.set(ev.id, e);
        });
        console.log('[TimelineCalendar] eventById map built, size:', map.size, 'keys:', [...map.keys()]);
        return map;
    }, [userEvents]);

    const renderGridItem = useCallback((item: any, itemIndex: number) => {
        const itemSize = (SCREEN_WIDTH * 0.70) / 3 - 6;
        const originalEvent = item.id ? eventById.get(item.id) : undefined;

        const handlePress = () => {
            console.log('[TimelineCalendar] Tile pressed:', {
                itemId: item.id,
                itemType: item.type,
                foundInMap: !!originalEvent,
                hasOnMediaPress: !!onMediaPress,
            });

            if (!item.id) {
                console.warn('[TimelineCalendar] ❌ item.id is missing! Grid item:', item);
                return;
            }
            if (!originalEvent) {
                console.warn('[TimelineCalendar] ❌ originalEvent not found for id:', item.id, '— map keys:', [...eventById.keys()]);
                return;
            }
            if (!onMediaPress) {
                console.warn('[TimelineCalendar] ❌ onMediaPress prop is undefined');
                return;
            }

            console.log('[TimelineCalendar] ✅ Calling onMediaPress for:', item.id);
            onMediaPress(originalEvent);
        };

        const isVideo = item.type === 'video';
        const shouldAutoplay = isVideo && itemIndex === 0;

        return (
            <TouchableOpacity
                key={item.id || String(itemIndex)}
                activeOpacity={0.7}
                onPress={handlePress}
                style={[
                    styles.gridItem,
                    {
                        width: itemSize,
                        height: itemSize,
                        backgroundColor: item.bg || '#eee',
                        borderRadius: 8,
                        overflow: 'hidden',
                    },
                ]}
            >
                {isVideo ? (
                    <SmartVideoTile
                        uri={item.videoUri}
                        thumbUri={item.thumbUri || item.uri}
                        isVisible={shouldAutoplay}
                        style={{ width: '100%', height: '100%' }}
                    />
                ) : item.uri ? (
                    <Image
                        source={{ uri: item.uri }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={{ flex: 1, backgroundColor: item.bg || '#eee' }} />
                )}
            </TouchableOpacity>
        );
    }, [eventById, onMediaPress]);

    const renderTimelineRow = useCallback(({ item }: { item: TimelineRow }) => {
        if (item.type === 'month_header') {
            return (
                <View style={styles.monthHeaderRow}>
                    <View style={styles.leftCol} />
                    <View style={styles.railColumn}><View style={styles.railLine} /></View>
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
                    <LinearGradient colors={item.moodColor} style={styles.moodDot} />
                </View>
                <View style={styles.railColumn}>
                    <View style={styles.railLine} />
                </View>
                <View style={styles.rightCol}>
                    <View style={styles.gridContainer}>
                        {item.items.map((gridItem, idx) => renderGridItem(gridItem, idx))}
                    </View>
                </View>
            </View>
        );
    }, [renderGridItem]);

    return (
        <FlatList
            data={timelineRows}
            renderItem={renderTimelineRow}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: contentPaddingTop, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={7}
            removeClippedSubviews={true}
        />
    );
}

const styles = StyleSheet.create({
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
    gridItem: { justifyContent: 'center', alignItems: 'center' },
});