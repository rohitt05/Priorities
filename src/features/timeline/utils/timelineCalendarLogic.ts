export type { TimelineEvent } from '@/types/domain';
import { TimelineEvent } from '@/types/domain';

export interface TimelineGridItem {
    id: string;
    type: 'photo' | 'video';
    bg: string;
    uri?: string;
    videoUri?: string;
    thumbUri?: string;
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

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

export const toDateKey = (isoTs: string): string => {
    if (!isoTs) return '0000-00-00';
    const d = new Date(isoTs);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const getMonthLabel = (dateKey: string): string => {
    const [y, m] = dateKey.split('-').map(x => parseInt(x, 10));
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
};

export const getWeekday = (isoTs: string): string => {
    return new Date(isoTs).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
};

export const getDay = (isoTs: string): string => {
    return `${new Date(isoTs).getDate()}`;
};

export const getYearMonth = (dateKey: string): string => {
    return dateKey.slice(0, 7);
};

const isValidUrl = (uri: string | undefined | null): boolean => {
    if (!uri) return false;
    return uri.startsWith('https://') || uri.startsWith('http://') || uri.startsWith('file://');
};

export const transformEventToGridItem = (event: TimelineEvent): TimelineGridItem => {
    const ev = event as any;
    let type: TimelineGridItem['type'] = 'photo';
    let bg = '#eee';
    let uri: string | undefined;
    let videoUri: string | undefined;
    let thumbUri: string | undefined;

    switch (ev.type) {
        case 'photo':
        case 'image':
            type = 'photo';
            bg = '#eee';
            uri = isValidUrl(ev.uri) ? ev.uri : undefined;
            break;
        case 'video':
            type = 'video';
            bg = '#111';
            // Only pass videoUri if it's a real playable URL
            videoUri = isValidUrl(ev.uri) ? ev.uri : undefined;
            thumbUri = isValidUrl(ev.thumbUri) ? ev.thumbUri : (isValidUrl(ev.uri) ? ev.uri : undefined);
            uri = thumbUri; // Image tile shows thumb only
            break;
    }

    return {
        id: ev.id,
        type,
        bg,
        uri,
        videoUri,
        thumbUri,
        text: ev.textContent || ev.text || ev.caption,
    };
};

export const calculateMoodColor = (items: TimelineGridItem[]): [string, string] => {
    const hasMedia = items.some(item => item.type === 'photo' || item.type === 'video');
    if (hasMedia) return ['#a18cd1', '#fbc2eb'];
    return ['#FF9A9E', '#FECFEF'];
};

export const groupEventsByDate = (events: TimelineEvent[]): Map<string, TimelineEvent[]> => {
    const grouped = new Map<string, TimelineEvent[]>();
    events.forEach(event => {
        const key = toDateKey(event.timestamp);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(event);
    });
    return grouped;
};

export const sortEventsByDate = (events: TimelineEvent[]): TimelineEvent[] => {
    return [...events].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
};

export const processTimelineData = (events: TimelineEvent[]): TimelineRow[] => {
    const sortedEvents = sortEventsByDate(events);
    const groupedByDate = groupEventsByDate(sortedEvents);

    const rows: TimelineRow[] = [];
    let lastMonth = '';

    groupedByDate.forEach((dateEvents, dateKey) => {
        const yearMonth = getYearMonth(dateKey);

        if (yearMonth !== lastMonth) {
            rows.push({
                id: `h_${yearMonth}`,
                type: 'month_header',
                label: getMonthLabel(dateKey),
            });
            lastMonth = yearMonth;
        }

        const items = dateEvents.map(transformEventToGridItem);
        const moodColor = calculateMoodColor(items);
        const firstEvent = dateEvents[0];

        rows.push({
            id: `d_${dateKey}`,
            type: 'day',
            weekday: getWeekday(firstEvent.timestamp),
            day: getDay(firstEvent.timestamp),
            moodColor,
            items,
        });
    });

    return rows;
};

export const filterEventsForUser = (
    events: TimelineEvent[],
    userUniqueId: string
): TimelineEvent[] => {
    return events.filter(event => event.userUniqueId === userUniqueId);
};

export const filterEventsByDateRange = (
    events: TimelineEvent[],
    startDate: Date,
    endDate: Date
): TimelineEvent[] => {
    return events.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= startDate && eventDate <= endDate;
    });
};

export const filterEventsByType = (
    events: TimelineEvent[],
    types: any[]
): TimelineEvent[] => {
    return events.filter(event => types.includes(event.type));
};

export interface TimelineStats {
    totalEvents: number;
    photoCount: number;
    videoCount: number;
    dateRange: { oldest: string; newest: string; } | null;
}

export const calculateTimelineStats = (events: TimelineEvent[]): TimelineStats => {
    const stats: TimelineStats = {
        totalEvents: events.length,
        photoCount: 0,
        videoCount: 0,
        dateRange: null,
    };

    if (events.length === 0) return stats;

    events.forEach(event => {
        const ev = event as any;
        if (ev.type === 'photo' || ev.type === 'image') stats.photoCount++;
        else if (ev.type === 'video') stats.videoCount++;
    });

    const sortedEvents = sortEventsByDate(events);
    stats.dateRange = {
        oldest: sortedEvents[sortedEvents.length - 1].timestamp,
        newest: sortedEvents[0].timestamp,
    };

    return stats;
};