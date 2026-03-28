// src/contexts/MediaInboxContext.tsx
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect, useRef } from 'react';
import { Image } from 'react-native';
import { supabase } from '@/lib/supabase';
import { TimelineEvent, Message } from '@/types/domain';

export type UnreadMedia = Message;

interface MediaInboxContextType {
    unreadMessages: Record<string, Message>; // sender_id -> freshest unread message (with fresh URI)
    myLastSentStatus: Record<string, string>; // Status: 'none', 'sent', 'seen', or emoji
    markAsSeen: (userId: string) => Promise<void>;
    reactToMessage: (userId: string, emoji: string) => Promise<void>;
    addTimelineEvent: (event: TimelineEvent) => void;
    timelineEvents: Record<string, TimelineEvent[]>;
    recordMessageSent: (userId: string) => void;
    simulateCounterpartSeen: (userId: string) => void;
}

const MediaInboxContext = createContext<MediaInboxContextType | undefined>(undefined);

// ── Extracts the storage path from a signed URL ───────────────────────────
// e.g. "https://xxx.supabase.co/storage/v1/object/sign/messages/abc/media/file.jpg?token=..."
// → "messages/abc/media/file.jpg" (bucket = "messages", path = "abc/media/file.jpg")
const extractStoragePath = (signedUrl: string): { bucket: string; path: string } | null => {
    try {
        const match = signedUrl.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(\?|$)/);
        if (!match) return null;
        return { bucket: match[1], path: match[2] };
    } catch {
        return null;
    }
};

// ── Re-signs a URL so it is always fresh (1 hour expiry) ─────────────────
const refreshSignedUrl = async (uri: string | null | undefined): Promise<string | undefined> => {
    if (!uri) return undefined;
    // If it's not a signed URL (e.g. already public), return as-is
    if (!uri.includes('/storage/v1/object/sign/')) return uri;

    const parsed = extractStoragePath(uri);
    if (!parsed) return uri; // can't parse, use original

    const { data, error } = await supabase.storage
        .from(parsed.bucket)
        .createSignedUrl(parsed.path, 60 * 60); // fresh 1-hour token

    if (error || !data?.signedUrl) {
        console.warn('[MediaInbox] Failed to refresh signed URL, using original:', error?.message);
        return uri; // fall back to original
    }
    return data.signedUrl;
};

// ── Pre-fetches images into React Native's image cache ───────────────────
const prefetchIfImage = (uri: string | undefined, type: string) => {
    if (!uri) return;
    if (type === 'photo' || type === 'image') {
        Image.prefetch(uri).catch(() => { });
    }
};

export const MediaInboxProvider = ({ children }: { children: ReactNode }) => {
    const [unreadQueues, setUnreadQueues] = useState<Record<string, Message[]>>({});
    const [unreadMessages, setUnreadMessages] = useState<Record<string, Message>>({});
    const [myLastSentStatus, setMyLastSentStatus] = useState<Record<string, string>>({});
    const [timelineEvents, setTimelineEvents] = useState<Record<string, TimelineEvent[]>>({});

    // ── Fetch all unread messages + refresh their signed URLs ─
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

        // Group by sender_id (all unread messages)
        const queuesBySender: Record<string, Message[]> = {};
        (data ?? []).forEach((row) => {
            if (!queuesBySender[row.sender_id]) {
                queuesBySender[row.sender_id] = [];
            }
            queuesBySender[row.sender_id].push({
                id: row.id,
                senderId: row.sender_id,
                receiverId: row.receiver_id,
                type: row.type as Message['type'],
                uri: row.uri ?? undefined,
                durationSec: row.duration_sec ?? undefined,
                sentAt: row.sent_at,
                seenAt: row.seen_at ?? null,
                disappeared: row.disappeared,
            });
        });

        // Set the full queues
        setUnreadQueues(queuesBySender);

        // For each sender, refresh the URL of the TOP message (latest)
        const topMessagesEntries = await Promise.all(
            Object.entries(queuesBySender).map(async ([senderId, queue]) => {
                const topMsg = queue[0];
                const freshUri = await refreshSignedUrl(topMsg.uri);
                prefetchIfImage(freshUri, topMsg.type);
                return [senderId, { ...topMsg, uri: freshUri }] as const;
            })
        );

        setUnreadMessages(Object.fromEntries(topMessagesEntries));

        // ── Fetch statuses of last messages SENT by me ──
        const { data: sentData, error: sentError } = await supabase
            .from('messages')
            .select('receiver_id, seen_at, reaction')
            .eq('sender_id', myId)
            .order('sent_at', { ascending: false });

        if (!sentError && sentData) {
            const statusMap: Record<string, string> = {};
            sentData.forEach((row: any) => {
                if (!statusMap[row.receiver_id]) {
                    statusMap[row.receiver_id] = row.reaction || (row.seen_at ? 'seen' : 'sent');
                }
            });
            setMyLastSentStatus(prev => ({ ...prev, ...statusMap }));
        }
    }, []);

    // ── Realtime subscription ─────────────────────────────────
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    useEffect(() => {
        loadUnreadMessages();

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
                    async (payload) => {
                        const row = payload.new as any;
                        if (row.disappeared || row.seen_at) return;

                        const newMessage: Message = {
                            id: row.id,
                            senderId: row.sender_id,
                            receiverId: row.receiver_id,
                            type: row.type as Message['type'],
                            uri: row.uri ?? undefined,
                            durationSec: row.duration_sec ?? undefined,
                            sentAt: row.sent_at,
                            seenAt: null,
                            disappeared: row.disappeared,
                        };

                        // Add to queue (at the beginning because list is descending)
                        setUnreadQueues(prev => {
                            const queue = prev[row.sender_id] || [];
                            return {
                                ...prev,
                                [row.sender_id]: [newMessage, ...queue]
                            };
                        });

                        // Re-sign the URL immediately for the latest message
                        const freshUri = await refreshSignedUrl(row.uri);
                        prefetchIfImage(freshUri, row.type);
                        
                        setUnreadMessages(prev => ({
                            ...prev,
                            [row.sender_id]: { ...newMessage, uri: freshUri },
                        }));
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'messages',
                        filter: `sender_id=eq.${myId}`,
                    },
                    (payload) => {
                        const row = payload.new as any;
                        if (row.reaction) {
                            setMyLastSentStatus(prev => ({
                                ...prev,
                                [row.receiver_id]: row.reaction
                            }));
                        } else if (row.seen_at) {
                            setMyLastSentStatus(prev => ({
                                ...prev,
                                [row.receiver_id]: 'seen'
                            }));
                        }
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

    const addTimelineEvent = useCallback((event: TimelineEvent) => {
        setTimelineEvents(prev => ({
            ...prev,
            [event.userUniqueId]: [event, ...(prev[event.userUniqueId] || [])]
        }));
    }, []);

    // ── Mark as seen ──────────────────────────────────────────
    const markAsSeen = useCallback(async (userId: string) => {
        const message = unreadMessages[userId];
        if (!message) return;

        const seenAt = new Date().toISOString();

        // Update database (async)
        supabase
            .from('messages')
            .update({ seen_at: seenAt })
            .eq('id', message.id)
            .then(({ error }) => {
                if (error) console.error('[MediaInbox] Failed to mark seen:', error);
            });

        // Add to timeline
        const updatedMessage: Message = { ...message, seenAt };
        const event: TimelineEvent = {
            ...updatedMessage,
            userUniqueId: userId,
            timestamp: seenAt,
            sender: 'them',
        } as TimelineEvent;
        addTimelineEvent(event);

        // Update queues and current message
        setUnreadQueues(prev => {
            const queue = prev[userId] || [];
            const remaining = queue.filter(m => m.id !== message.id);
            
            // If there's a next message, prepare it
            if (remaining.length > 0) {
                const nextMsg = remaining[0];
                // We refresh its URL and update unreadMessages
                refreshSignedUrl(nextMsg.uri).then(freshUri => {
                    prefetchIfImage(freshUri, nextMsg.type);
                    setUnreadMessages(prevMsgs => ({
                        ...prevMsgs,
                        [userId]: { ...nextMsg, uri: freshUri }
                    }));
                });
            } else {
                // No more messages for this user
                setUnreadMessages(prevMsgs => {
                    const nextMsgs = { ...prevMsgs };
                    delete nextMsgs[userId];
                    return nextMsgs;
                });
            }

            return {
                ...prev,
                [userId]: remaining
            };
        });
    }, [unreadMessages, addTimelineEvent]);

    // ── React to message ──────────────────────────────────────
    const reactToMessage = useCallback(async (userId: string, emoji: string) => {
        const message = unreadMessages[userId];
        if (!message) return;

        // Update database
        const { error } = await supabase
            .from('messages')
            .update({ reaction: emoji })
            .eq('id', message.id);

        if (error) {
            console.error('[MediaInbox] Failed to react to message:', error);
            return;
        }

        // Add to timeline or local state if needed (currently we just want user A to see it)
        // User A will see it via Realtime subscription in their own app.
    }, [unreadMessages]);


    const recordMessageSent = useCallback((userId: string) => {
        setMyLastSentStatus(prev => ({ ...prev, [userId]: 'sent' }));
    }, []);

    const simulateCounterpartSeen = useCallback((userId: string) => {
        setMyLastSentStatus(prev => {
            if (prev[userId] === 'sent') return { ...prev, [userId]: 'seen' };
            return prev;
        });
    }, []);

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
        reactToMessage,
        addTimelineEvent,
        timelineEvents,
        recordMessageSent,
        simulateCounterpartSeen,
    }), [unreadMessages, myLastSentStatus, markAsSeen, reactToMessage, addTimelineEvent, timelineEvents, recordMessageSent, simulateCounterpartSeen]);

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