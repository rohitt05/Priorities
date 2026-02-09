import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    FlatList,
    Dimensions,
    TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    TimelineEvent,
    TimelineRow,
    processTimelineData,
    filterEventsForUser
} from './timelineCalendarLogic';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TimelineCalendarProps {
    userUniqueId: string;
    timelineEvents: TimelineEvent[];
    contentPaddingTop: number;
    onMediaPress?: (event: TimelineEvent) => void;
    // Removed isCircularGrid prop
}

export default function TimelineCalendar({
    userUniqueId,
    timelineEvents,
    contentPaddingTop,
    onMediaPress
}: TimelineCalendarProps) {

    let userEvents = filterEventsForUser(timelineEvents, userUniqueId);
    if (userEvents.length === 0) {
        userEvents = filterEventsForUser(timelineEvents, 'rohit123');
    }

    const timelineRows = processTimelineData(userEvents);

    const renderGridItem = (item: any, index: number, dateKey: string) => {
        // Calculate size for 3 columns
        const itemSize = (SCREEN_WIDTH * 0.70) / 3 - 6;

        // Find original event
        const dayEvents = userEvents.filter(e => {
            const eventDate = new Date(e.ts);
            const y = eventDate.getFullYear();
            const m = String(eventDate.getMonth() + 1).padStart(2, '0');
            const d = String(eventDate.getDate()).padStart(2, '0');
            const key = `${y}-${m}-${d}`;
            return key === dateKey;
        });

        const originalEvent = dayEvents[index];

        const handlePress = () => {
            if (originalEvent && onMediaPress) {
                onMediaPress(originalEvent);
            }
        };

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
                        borderRadius: 8, // FIXED: Consistent border radius for rounded squares
                        overflow: 'hidden'
                    }
                ]}
            >
                {/* 1. PHOTO */}
                {item.type === 'photo' && item.uri && (
                    <Image
                        source={{ uri: item.uri }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                )}

                {/* 2. NOTE */}
                {item.type === 'note' && (
                    <View style={{ padding: 6, justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        {item.text && (
                            <Text
                                style={{ fontSize: 9, fontWeight: '600', textAlign: 'center', color: '#333' }}
                                numberOfLines={3}
                            >
                                {item.text}
                            </Text>
                        )}
                        <View style={{ height: 2, width: '60%', backgroundColor: 'rgba(0,0,0,0.05)', marginTop: 4, borderRadius: 1 }} />
                    </View>
                )}

                {/* 3. AUDIO/CALL ICONS */}
                {(item.type === 'audio' || item.type === 'play' || item.type === 'voice_call' || item.type === 'video_call') && (
                    <View style={StyleSheet.absoluteFill}>
                        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons
                                name={item.type === 'audio' ? 'mic' : (item.type === 'voice_call' ? 'call' : 'videocam')}
                                size={20}
                                color={item.type === 'note' ? '#000' : '#333'}
                                style={{ opacity: 0.7 }}
                            />
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderTimelineRow = ({ item }: { item: TimelineRow }) => {
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

        const dateKey = item.id.replace('d_', '');

        return (
            <View style={styles.timelineRow}>
                <View style={styles.leftCol}>
                    <Text style={styles.weekdayText}>{item.weekday}</Text>
                    <Text style={styles.dayText}>{item.day}</Text>
                    <LinearGradient
                        colors={item.moodColor}
                        style={styles.moodDot}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                </View>
                <View style={styles.railColumn}>
                    <View style={styles.railLine} />
                </View>
                <View style={styles.rightCol}>
                    <View style={styles.gridContainer}>
                        {item.items.map((gridItem, idx) => renderGridItem(gridItem, idx, dateKey))}
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
            contentContainerStyle={{
                paddingTop: contentPaddingTop,
                paddingBottom: 120
            }}
            showsVerticalScrollIndicator={false}
        />
    );
}

const styles = StyleSheet.create({
    timelineRow: {
        flexDirection: 'row',
        paddingBottom: 20,
        paddingRight: 20
    },
    monthHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 20,
        paddingTop: 10
    },
    monthText: {
        fontSize: 36,
        fontWeight: '300',
        letterSpacing: 1,
        color: '#000',
        marginLeft: 6
    },
    leftCol: {
        width: '18%',
        alignItems: 'center',
        paddingTop: 0
    },
    railColumn: {
        width: 10,
        alignItems: 'center',
        height: '100%'
    },
    rightCol: {
        flex: 1,
        justifyContent: 'center'
    },
    weekdayText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#000',
        textTransform: 'uppercase',
        marginBottom: 2
    },
    dayText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000',
        marginBottom: 8
    },
    moodDot: {
        width: 12,
        height: 12,
        borderRadius: 6
    },
    railLine: {
        width: 3,
        backgroundColor: '#000',
        flex: 1,
        height: '100%'
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6
    },
    gridItem: {
        justifyContent: 'center',
        alignItems: 'center',
        // Radius handled inline
    }
});