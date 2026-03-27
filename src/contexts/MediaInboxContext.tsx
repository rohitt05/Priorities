// src/contexts/MediaInboxContext.tsx
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { TimelineEvent, Message } from '@/types/domain';

export type UnreadMedia = Message;

interface MediaInboxContextType {
    unreadMessages: Record<string, Message>; // profileId -> last unread message
    myLastSentStatus: Record<string, 'none' | 'sent' | 'seen'>;
    markAsSeen: (userId: string) => void;
    addTimelineEvent: (event: TimelineEvent) => void;
    timelineEvents: Record<string, TimelineEvent[]>;
    recordMessageSent: (userId: string) => void;
    simulateCounterpartSeen: (userId: string) => void;
}

const MediaInboxContext = createContext<MediaInboxContextType | undefined>(undefined);

export const MediaInboxProvider = ({ children }: { children: ReactNode }) => {
    const [unreadMessages, setUnreadMessages] = useState<Record<string, Message>>({});
    const [myLastSentStatus, setMyLastSentStatus] = useState<Record<string, 'none' | 'sent' | 'seen'>>({});
    const [timelineEvents, setTimelineEvents] = useState<Record<string, TimelineEvent[]>>({});

    // ── Fetch all unread messages from Supabase ───────────────
    const loadUnreadMessages = useCallback(async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const myId = sessionData?.session?.user?.id;
        if (!myId) return;

        const { data, error } = await supabase
            .from('messages')
            .select('id, sender_id, receiver_id, type, uri, duration_sec, sent_at, seen_at, disappeared')
            .eq('receiver_id', myId)
            .eq('disappeared', false)
            .is('seen_at', null)
            .order('sent_at', { ascending: false });

        if (error) {
            console.error('[MediaInbox] Failed to load messages:', error);
            return;
        }

        // Build map: sender_id -> most recent unread message from them
        const inboxMap: Record<string, Message> = {};
        (data ?? []).forEach((row) => {
            // Only keep the most recent one per sender (already ordered desc)
            if (!inboxMap[row.sender_id]) {
                inboxMap[row.sender_id] = {
                    id: row.id,
                    senderId: row.sender_id,
                    receiverId: row.receiver_id,
                    type: row.type as Message['type'],
                    uri: row.uri ?? undefined,
                    durationSec: row.duration_sec ?? undefined,
                    sentAt: row.sent_at,
                    seenAt: row.seen_at ?? null,
                    disappeared: row.disappeared,
                };
            }
        });

        setUnreadMessages(inboxMap);
    }, []);

    // ── Realtime subscription — new message arrives instantly ─
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    useEffect(() => {
        loadUnreadMessages();

        // Subscribe to new inserts on messages table for this user
        const setupRealtime = async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            const myId = sessionData?.session?.user?.id;
            if (!myId) return;

            channelRef.current = supabase
                .channel('messages-inbox')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `receiver_id=eq.${myId}`,
                    },
                    (payload) => {
                        const row = payload.new as any;
                        if (row.disappeared || row.seen_at) return;

                        const newMessage: Message = {
                            id: row.id,
                            senderId: row.sender_id,
                            receiverId: row.receiver_id,
                            type: row.type as Message['type'],
                            uri: row.uri,
                            durationSec: row.duration_sec ?? undefined,
                            sentAt: row.sent_at,
                            seenAt: null,
                            disappeared: row.disappeared,
                        };

                        // Add/replace for this sender
                        setUnreadMessages(prev => ({
                            ...prev,
                            [row.sender_id]: newMessage,
                        }));
                    }
                )
                .subscribe();
        };

        setupRealtime();

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [loadUnreadMessages]);

    // ── Mark as seen — updates Supabase + local state ─────────
    const markAsSeen = useCallback((userId: string) => {
        const message = unreadMessages[userId];
        if (!message) return;

        const seenAt = new Date().toISOString();

        // Update Supabase (fire and forget — RLS allows receiver to update)
        supabase
            .from('messages')
            .update({ seen_at: seenAt })
            .eq('id', message.id)
            .then(({ error }) => {
                if (error) console.error('[MediaInbox] Failed to mark seen:', error);
            });

        const updatedMessage: Message = { ...message, seenAt };

        // Add to timeline
        const event: TimelineEvent = {
            ...updatedMessage,
            userUniqueId: userId,
            timestamp: seenAt,
            sender: 'them',
        } as TimelineEvent;
        addTimelineEvent(event);

        // Remove from unread inbox
        setUnreadMessages(prev => {
            const next = { ...prev };
            delete next[userId];
            return next;
        });
    }, [unreadMessages]);

    const addTimelineEvent = useCallback((event: TimelineEvent) => {
        setTimelineEvents(prev => ({
            ...prev,
            [event.userUniqueId]: [event, ...(prev[event.userUniqueId] || [])]
        }));
    }, []);

    const recordMessageSent = useCallback((userId: string) => {
        setMyLastSentStatus(prev => ({ ...prev, [userId]: 'sent' }));
    }, []);

    const simulateCounterpartSeen = useCallback((userId: string) => {
        setMyLastSentStatus(prev => {
            if (prev[userId] === 'sent') {
                return { ...prev, [userId]: 'seen' };
            }
            return prev;
        });
    }, []);

    // Clear seen status when a new unread arrives from that user
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