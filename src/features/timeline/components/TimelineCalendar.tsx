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
import { useBackground } from '@/contexts/BackgroundContext'; // ← ADD THIS

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper: is bgColor dark or light?
function isColorDark(hex: string): boolean {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    // Perceived brightness formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
}

interface TimelineCalendarProps {
    userUniqueId: string;
    timelineEvents: TimelineEvent[];
    contentPaddingTop: number;
    onMediaPress?: (event: TimelineEvent) => void;
}

export default function TimelineCalendar({
    userUniqueId, timelineEvents, contentPaddingTop, onMediaPress,
}: TimelineCalendarProps) {

    // ── Pull bg color from context ───────────────────────────────────────────
    const { bgColor } = useBackground();
    const dark = isColorDark(bgColor);
    const textColor = dark ? '#ffffff' : '#000000';
    const textMuted = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
    const railColor = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';

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
        return map;
    }, [userEvents]);

    const renderGridItem = useCallback((item: any, itemIndex: number) => {
        const itemSize = (SCREEN_WIDTH * 0.70) / 3 - 6;
        const originalEvent = item.id ? eventById.get(item.id) : undefined;

        const handlePress = () => {
            if (!item.id || !originalEvent || !onMediaPress) return;
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
                        backgroundColor: item.bg || (dark ? '#222' : '#ddd'),
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
                    <View style={{ flex: 1, backgroundColor: item.bg || (dark ? '#222' : '#ddd') }} />
                )}
            </TouchableOpacity>
        );
    }, [eventById, onMediaPress, dark]);

    const renderTimelineRow = useCallback(({ item }: { item: TimelineRow }) => {
        if (item.type === 'month_header') {
            return (
                <View style={styles.monthHeaderRow}>
                    <View style={styles.leftCol} />
                    <View style={styles.railColumn}>
                        <View style={[styles.railLine, { backgroundColor: railColor }]} />
                    </View>
                    <View style={styles.rightCol}>
                        <Text style={[styles.monthText, { color: textColor }]}>{item.label}</Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.timelineRow}>
                <View style={styles.leftCol}>
                    <Text style={[styles.weekdayText, { color: textMuted }]}>{item.weekday}</Text>
                    <Text style={[styles.dayText, { color: textColor }]}>{item.day}</Text>
                    <LinearGradient colors={item.moodColor} style={styles.moodDot} />
                </View>
                <View style={styles.railColumn}>
                    <View style={[styles.railLine, { backgroundColor: railColor }]} />
                </View>
                <View style={styles.rightCol}>
                    <View style={styles.gridContainer}>
                        {item.items.map((gridItem, idx) => renderGridItem(gridItem, idx))}
                    </View>
                </View>
            </View>
        );
    }, [renderGridItem, textColor, textMuted, railColor]);

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
    monthText: { fontSize: 36, fontWeight: '300', letterSpacing: 1, marginLeft: 6 },
    leftCol: { width: '18%', alignItems: 'center', paddingTop: 0 },
    railColumn: { width: 10, alignItems: 'center', height: '100%' },
    rightCol: { flex: 1, justifyContent: 'center' },
    weekdayText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
    dayText: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
    moodDot: { width: 12, height: 12, borderRadius: 6 },
    railLine: { width: 3, flex: 1, height: '100%' },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    gridItem: { justifyContent: 'center', alignItems: 'center' },
});