export interface TimelineEvent {
    id: string;
    userUniqueId: string;
    ts: string; // ISO timestamp
    sender: 'me' | 'them';
    type: 'photo' | 'video' | 'audio' | 'voice_call' | 'video_call' | 'note';
    uri?: string;
    thumbUri?: string;
    caption?: string;
    text?: string;
    durationSec?: number;
    title?: string;
}

export interface TimelineGridItem {
    type: 'photo' | 'note' | 'audio' | 'play';
    bg: string;
    uri?: string;
    text?: string;
}

export interface TimelineDayRow {
    id: string;
    type: 'day';
    weekday: string;
    day: string;
    moodColor: [string, string];
    items: TimelineGridItem[];
}

export interface TimelineMonthHeader {
    id: string;
    type: 'month_header';
    label: string;
}

export type TimelineRow = TimelineDayRow | TimelineMonthHeader;

// ==========================================
// DATE UTILITIES
// ==========================================

/**
 * Pads a number with leading zero if less than 10
 */
const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/**
 * Converts ISO timestamp to date key (YYYY-MM-DD)
 */
export const toDateKey = (isoTs: string): string => {
    const d = new Date(isoTs);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/**
 * Gets month label from date key (e.g., "SEP")
 */
export const getMonthLabel = (dateKey: string): string => {
    const [y, m] = dateKey.split('-').map(x => parseInt(x, 10));
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
};

/**
 * Gets weekday abbreviation from ISO timestamp (e.g., "MON")
 */
export const getWeekday = (isoTs: string): string => {
    return new Date(isoTs).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
};

/**
 * Gets day number from ISO timestamp
 */
export const getDay = (isoTs: string): string => {
    return `${new Date(isoTs).getDate()}`;
};

/**
 * Gets year-month key from date key (YYYY-MM)
 */
export const getYearMonth = (dateKey: string): string => {
    return dateKey.slice(0, 7);
};

// ==========================================
// EVENT TRANSFORMATION
// ==========================================

/**
 * Transforms raw timeline event to UI grid item
 */
export const transformEventToGridItem = (event: TimelineEvent): TimelineGridItem => {
    let type: TimelineGridItem['type'] = 'note';
    let bg = '#eee';

    switch (event.type) {
        case 'photo':
            type = 'photo';
            bg = '#eee';
            break;
        case 'video':
            type = 'photo'; // Videos show as photos with play overlay
            bg = '#000';
            break;
        case 'voice_call':
            type = 'audio';
            bg = '#F8BBD0'; // Pink for voice calls
            break;
        case 'video_call':
            type = 'play';
            bg = '#E1BEE7'; // Purple for video calls
            break;
        case 'note':
            type = 'note';
            bg = '#FFF9C4'; // Yellow for notes
            break;
        case 'audio':
            type = 'audio';
            bg = '#B2DFDB'; // Teal for audio messages
            break;
    }

    return {
        type,
        bg,
        uri: event.thumbUri || event.uri,
        text: event.text || event.caption,
    };
};

/**
 * Calculates mood color gradient based on items in a day
 */
export const calculateMoodColor = (items: TimelineGridItem[]): [string, string] => {
    const hasPhotos = items.some(item => item.type === 'photo');

    if (hasPhotos) {
        // Photo/video days get purple-pink gradient
        return ['#a18cd1', '#fbc2eb'];
    } else {
        // Other days get pink-light pink gradient
        return ['#FF9A9E', '#FECFEF'];
    }
};

// ==========================================
// DATA GROUPING
// ==========================================

/**
 * Groups events by date key
 */
export const groupEventsByDate = (events: TimelineEvent[]): Map<string, TimelineEvent[]> => {
    const grouped = new Map<string, TimelineEvent[]>();

    events.forEach(event => {
        const key = toDateKey(event.ts);
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(event);
    });

    return grouped;
};

/**
 * Sorts events by timestamp (newest first)
 */
export const sortEventsByDate = (events: TimelineEvent[]): TimelineEvent[] => {
    return [...events].sort((a, b) =>
        new Date(b.ts).getTime() - new Date(a.ts).getTime()
    );
};

// ==========================================
// TIMELINE PROCESSING
// ==========================================

/**
 * Main function to process timeline events into FlatList rows
 * with month headers and day rows
 */
export const processTimelineData = (events: TimelineEvent[]): TimelineRow[] => {
    // Sort events by date (newest first)
    const sortedEvents = sortEventsByDate(events);

    // Group by date
    const groupedByDate = groupEventsByDate(sortedEvents);

    // Build rows array
    const rows: TimelineRow[] = [];
    let lastMonth = '';

    // Iterate through grouped dates
    groupedByDate.forEach((dateEvents, dateKey) => {
        const yearMonth = getYearMonth(dateKey);

        // Add month header if new month
        if (yearMonth !== lastMonth) {
            rows.push({
                id: `h_${yearMonth}`,
                type: 'month_header',
                label: getMonthLabel(dateKey)
            });
            lastMonth = yearMonth;
        }

        // Transform events to grid items
        const items = dateEvents.map(transformEventToGridItem);

        // Calculate mood color
        const moodColor = calculateMoodColor(items);

        // Get first event for date info
        const firstEvent = dateEvents[0];

        // Add day row
        rows.push({
            id: `d_${dateKey}`,
            type: 'day',
            weekday: getWeekday(firstEvent.ts),
            day: getDay(firstEvent.ts),
            moodColor,
            items
        });
    });

    return rows;
};

// ==========================================
// FILTERING
// ==========================================

/**
 * Filters events for a specific user
 */
export const filterEventsForUser = (
    events: TimelineEvent[],
    userUniqueId: string
): TimelineEvent[] => {
    return events.filter(event => event.userUniqueId === userUniqueId);
};

/**
 * Filters events for a date range
 */
export const filterEventsByDateRange = (
    events: TimelineEvent[],
    startDate: Date,
    endDate: Date
): TimelineEvent[] => {
    return events.filter(event => {
        const eventDate = new Date(event.ts);
        return eventDate >= startDate && eventDate <= endDate;
    });
};

/**
 * Filters events by type
 */
export const filterEventsByType = (
    events: TimelineEvent[],
    types: TimelineEvent['type'][]
): TimelineEvent[] => {
    return events.filter(event => types.includes(event.type));
};

// ==========================================
// STATISTICS
// ==========================================

/**
 * Calculates statistics for timeline events
 */
export interface TimelineStats {
    totalEvents: number;
    photoCount: number;
    videoCount: number;
    noteCount: number;
    callCount: number;
    audioCount: number;
    dateRange: {
        oldest: string;
        newest: string;
    } | null;
}

export const calculateTimelineStats = (events: TimelineEvent[]): TimelineStats => {
    const stats: TimelineStats = {
        totalEvents: events.length,
        photoCount: 0,
        videoCount: 0,
        noteCount: 0,
        callCount: 0,
        audioCount: 0,
        dateRange: null
    };

    if (events.length === 0) return stats;

    events.forEach(event => {
        switch (event.type) {
            case 'photo':
                stats.photoCount++;
                break;
            case 'video':
                stats.videoCount++;
                break;
            case 'note':
                stats.noteCount++;
                break;
            case 'voice_call':
            case 'video_call':
                stats.callCount++;
                break;
            case 'audio':
                stats.audioCount++;
                break;
        }
    });

    const sortedEvents = sortEventsByDate(events);
    stats.dateRange = {
        oldest: sortedEvents[sortedEvents.length - 1].ts,
        newest: sortedEvents[0].ts
    };

    return stats;
};