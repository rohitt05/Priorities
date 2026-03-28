import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    FlatList,
    Dimensions,
    TouchableOpacity,
    ViewToken
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    TimelineRow,
    processTimelineData,
    filterEventsForUser
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
    userUniqueId,
    timelineEvents,
    contentPaddingTop,
    onMediaPress
}: TimelineCalendarProps) {

    // 1. Data Processing
    // We already pass pre-filtered events from UserTimelineView,
    // but filterEventsForUser is kept as a safety net.
    const userEvents = filterEventsForUser(timelineEvents, userUniqueId);
    const timelineRows = processTimelineData(userEvents);

    // 2. Visibility State for Autoplay
    const [visibleRowIds, setVisibleRowIds] = useState<Set<string>>(new Set());

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 10,
        minimumViewTime: 0
    }).current;

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        const newVisibleIds = new Set<string>();
        viewableItems.forEach(viewToken => {
            if (viewToken.isViewable) {
                newVisibleIds.add(viewToken.item.id);
            }
        });
        setVisibleRowIds(newVisibleIds);
    }).current;

    // 3. Render Grid Item
    const renderGridItem = (item: any, index: number, dateKey: string, isRowVisible: boolean) => {
        const itemSize = (SCREEN_WIDTH * 0.70) / 3 - 6;

        const dayEvents = userEvents.filter((e: TimelineEvent) => {
            const eventDate = new Date(e.timestamp);
            const y = eventDate.getFullYear();
            const m = String(eventDate.getMonth() + 1).padStart(2, '0');
            const d = String(eventDate.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}` === dateKey;
        });
        const originalEvent = dayEvents[index];

        const handlePress = () => {
            if (originalEvent && onMediaPress) onMediaPress(originalEvent);
        };

        const isVideo = item.type === 'video';
        const hasUri = !!item.uri;

        return (
            <TouchableOpacity
                key={index}
                activeOpacity={0.7}
                onPress={handlePress}
                style={[
                    styles.gridItem,
                    {
                        width: itemSize,
                        height: itemSize,
                        backgroundColor: item.bg || '#eee',
                        borderRadius: 8,
                        overflow: 'hidden'
                    }
                ]}
            >
                {isVideo && hasUri ? (
                    <SmartVideoTile
                        uri={item.uri}
                        thumbUri={item.thumbUri}
                        isVisible={isRowVisible}
                        style={{ width: '100%', height: '100%' }}
                    />
                ) : (
                    <>
                        {item.uri && (
                            <Image
                                source={{ uri: item.uri }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                            />
                        )}
                    </>
                )}
            </TouchableOpacity>
        );
    };

    // 4. Render Row
    const renderTimelineRow = ({ item }: { item: TimelineRow }) => {
        if (item.type === 'month_header') {
            return (
                <View style={styles.monthHeaderRow}>
                    <View style={styles.leftCol} />
                    <View style={styles.railColumn}><View style={styles.railLine} /></View>
                    <View style={styles.rightCol}><Text style={styles.monthText}>{item.label}</Text></View>
                </View>
            );
        }

        const dateKey = item.id.replace('d_', '');
        const isRowVisible = visibleRowIds.has(item.id);

        return (
            <View style={styles.timelineRow}>
                <View style={styles.leftCol}>
                    <Text style={styles.weekdayText}>{item.weekday}</Text>
                    <Text style={styles.dayText}>{item.day}</Text>
                    <LinearGradient colors={item.moodColor} style={styles.moodDot} />
                </View>
                <View style={styles.railColumn}><View style={styles.railLine} /></View>
                <View style={styles.rightCol}>
                    <View style={styles.gridContainer}>
                        {item.items.map((gridItem, idx) => renderGridItem(gridItem, idx, dateKey, isRowVisible))}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <FlatList
            data={timelineRows}
            renderItem={renderTimelineRow}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: contentPaddingTop, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={5}
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
    gridItem: { justifyContent: 'center', alignItems: 'center' }
});
