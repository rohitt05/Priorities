import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import usersData from '@/data/users.json';
import messagesData from '@/data/userMessages.json';
import { TimelineEvent } from '@/types/domain';

export type UnreadMedia = {
    id: string;
    type: 'video' | 'image' | 'voice';
    uri: string;
    durationSec?: number;
};

interface MediaInboxContextType {
    unreadMessages: Record<string, UnreadMedia>; // userId -> message
    myLastSentStatus: Record<string, 'none' | 'sent' | 'seen'>;
    markAsSeen: (userId: string) => void;
    addTimelineEvent: (event: TimelineEvent) => void;
    timelineEvents: Record<string, TimelineEvent[]>;
    recordMessageSent: (userId: string) => void;
    simulateCounterpartSeen: (userId: string) => void;
}

const MediaInboxContext = createContext<MediaInboxContextType | undefined>(undefined);

export const MediaInboxProvider = ({ children }: { children: ReactNode }) => {
    // Initialize with data from userMessages.json
    const initialUnread: Record<string, UnreadMedia> = {};
    (messagesData as any[]).forEach(msg => {
        if (msg.status === 'unread') {
            initialUnread[msg.userId] = {
                id: msg.id,
                type: msg.type,
                uri: msg.uri,
                durationSec: msg.durationSec || 5
            };
        }
    });

    const [unreadMessages, setUnreadMessages] = useState<Record<string, UnreadMedia>>(initialUnread);
    const [myLastSentStatus, setMyLastSentStatus] = useState<Record<string, 'none' | 'sent' | 'seen'>>({});
    const [timelineEvents, setTimelineEvents] = useState<Record<string, TimelineEvent[]>>({});

    const addTimelineEvent = useCallback((event: TimelineEvent) => {
        setTimelineEvents(prev => ({
            ...prev,
            [event.userUniqueId]: [event, ...(prev[event.userUniqueId] || [])]
        }));
    }, []);

    const recordMessageSent = useCallback((userId: string) => {
        // When I send a message, clear any existing "Seen" status and show "Sent" (internal state)
        setMyLastSentStatus(prev => ({ ...prev, [userId]: 'sent' }));
    }, []);

    const simulateCounterpartSeen = useCallback((userId: string) => {
        // Simulation: They viewed my message
        setMyLastSentStatus(prev => {
            if (prev[userId] === 'sent') {
                return { ...prev, [userId]: 'seen' };
            }
            return prev;
        });
    }, []);

    const markAsSeen = useCallback((userId: string) => {
        if (unreadMessages[userId]) {
            const message = unreadMessages[userId];
            
            // 1. Move to timeline
            const event: TimelineEvent = {
                id: message.id,
                userUniqueId: userId,
                timestamp: new Date().toISOString(),
                sender: 'them',
                type: message.type === 'voice' ? 'audio' : (message.type === 'video' ? 'video' : 'photo'),
                uri: message.uri,
                durationSec: message.durationSec,
                title: message.type === 'voice' ? 'Voice note' : undefined,
            };
            addTimelineEvent(event);

            // 2. Remove from unread (Indicator disappears, NO "Seen" label for the viewer)
            setUnreadMessages(prev => {
                const next = { ...prev };
                delete next[userId];
                return next;
            });
        }
    }, [unreadMessages, addTimelineEvent]);

    // Internal simulation: Clear "Seen" if a new unread arrives
    useEffect(() => {
        const unreadUserIds = Object.keys(unreadMessages);
        setMyLastSentStatus(prev => {
            const next = { ...prev };
            let changed = false;
            unreadUserIds.forEach(uid => {
                if (next[uid] !== 'none' && next[uid] !== undefined) {
                    next[uid] = 'none';
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [unreadMessages]);

    const value = useMemo(() => ({
        unreadMessages,
        myLastSentStatus,
        markAsSeen,
        addTimelineEvent,
        timelineEvents,
        recordMessageSent,
        simulateCounterpartSeen
    }), [unreadMessages, myLastSentStatus, markAsSeen, addTimelineEvent, timelineEvents, recordMessageSent, simulateCounterpartSeen]);

    return (
        <MediaInboxContext.Provider value={value}>
            {children}
        </MediaInboxContext.Provider>
    );
};

export const useMediaInbox = () => {
    const context = useContext(MediaInboxContext);
    if (!context) throw new Error('useMediaInbox must be used within a MediaInboxProvider');
    return context;
};
