// src/contexts/MediaInboxContext.tsx
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect, useRef } from 'react';
import { Image } from 'react-native';
import { supabase } from '@/lib/supabase';
import { TimelineEvent, Message } from '@/types/domain';

export type UnreadMedia = Message;

interface MediaInboxContextType {
    unreadMessages: Record<string, Message>;
    myLastSentStatus: Record<string, string>; // 'none' | 'sent' | 'seen' | emoji
    markAsSeen: (userId: string) => Promise<void>;
    reactToMessage: (userId: string, emoji: string) => Promise<void>;
    addTimelineEvent: (event: TimelineEvent) => void;
    timelineEvents: Record<string, TimelineEvent[]>;
    recordMessageSent: (userId: string) => void;
    simulateCounterpartSeen: (userId: string) => void;
}

const MediaInboxContext = createContext<MediaInboxContextType | undefined>(undefined);

// ── Extracts bucket + path from a Supabase signed URL ────────────────────
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
    if (!uri.includes('/storage/v1/object/sign/')) return uri;

    const parsed = extractStoragePath(uri);
    if (!parsed) return uri;

    const { data, error } = await supabase.storage
        .from(parsed.bucket)
        .createSignedUrl(parsed.path, 60 * 60);

    if (error || !data?.signedUrl) {
        console.warn('[MediaInbox] Failed to refresh signed URL, using original:', error?.message);
        return uri;
    }
    return data.signedUrl;
};

// ── Pre-fetches images into RN image cache ────────────────────────────────
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

    // ── Keep a ref of sent message IDs → receiver, so realtime can map back ─
    // { message_id: receiver_id }
    const sentMessageMapRef = useRef<Record<string, string>>({});

    // ── Fetch all unread messages + refresh signed URLs ───────────────────
    const loadUnreadMessages = useCallback(async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const myId = sessionData?.session?.user?.id;
        if (!myId) return;

        // ── Load received unread messages ─────────────────────────────────
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

        // Group into queues by sender
        const queuesBySender: Record<string, Message[]> = {};
        (data ?? []).forEach((row) => {
            if (!queuesBySender[row.sender_id]) queuesBySender[row.sender_id] = [];
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

        setUnreadQueues(queuesBySender);

        // Refresh URL of top (latest) message per sender + prefetch images
        const topEntries = await Promise.all(
            Object.entries(queuesBySender).map(async ([senderId, queue]) => {
                const topMsg = queue[0];
                const freshUri = await refreshSignedUrl(topMsg.uri);
                prefetchIfImage(freshUri, topMsg.type);
                return [senderId, { ...topMsg, uri: freshUri }] as const;
            })
        );
        setUnreadMessages(Object.fromEntries(topEntries));

        // ── Load status of MY last sent messages ──────────────────────────
        // Join with message_reactions to get emoji if reacted
        const { data: sentData, error: sentError } = await supabase
            .from('messages')
            .select('id, receiver_id, seen_at, message_reactions(emoji)')
            .eq('sender_id', myId)
            .eq('disappeared', false)
            .order('sent_at', { ascending: false });

        if (!sentError && sentData) {
            const statusMap: Record<string, string> = {};
            const newSentMap: Record<string, string> = {};

            sentData.forEach((row: any) => {
                // Track sent message ID → receiver for realtime reaction mapping
                newSentMap[row.id] = row.receiver_id;

                if (!statusMap[row.receiver_id]) {
                    // Prefer emoji reaction over seen/sent
                    const reaction = row.message_reactions?.[0]?.emoji;
                    statusMap[row.receiver_id] = reaction || (row.seen_at ? 'seen' : 'sent');
                }
            });

            sentMessageMapRef.current = newSentMap;
            setMyLastSentStatus(prev => ({ ...prev, ...statusMap }));
        }
    }, []);

    // ── Realtime subscription ─────────────────────────────────────────────
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    useEffect(() => {
        loadUnreadMessages();

        const setupRealtime = async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            const myId = sessionData?.session?.user?.id;
            if (!myId) return;

            channelRef.current = supabase
                .channel('messages-inbox')

                // ── New message received ──────────────────────────────────
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

                        // Add to front of queue (descending order)
                        setUnreadQueues(prev => ({
                            ...prev,
                            [row.sender_id]: [newMessage, ...(prev[row.sender_id] || [])],
                        }));

                        // Refresh URL + prefetch + set as current top message
                        const freshUri = await refreshSignedUrl(row.uri);
                        prefetchIfImage(freshUri, row.type);

                        setUnreadMessages(prev => ({
                            ...prev,
                            [row.sender_id]: { ...newMessage, uri: freshUri },
                        }));
                    }
                )

                // ── My sent message was seen ──────────────────────────────
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
                        // Only update to 'seen' if no emoji reaction already showing
                        if (row.seen_at) {
                            setMyLastSentStatus(prev => {
                                const current = prev[row.receiver_id];
                                // Don't overwrite an emoji reaction with 'seen'
                                const isEmoji = current && current !== 'sent' && current !== 'seen' && current !== 'none';
                                if (isEmoji) return prev;
                                return { ...prev, [row.receiver_id]: 'seen' };
                            });
                        }
                    }
                )

                // ── Someone reacted to my message ─────────────────────────
                // Listens to INSERT on message_reactions (no user filter needed —
                // Supabase RLS ensures we only get rows where the message belongs to us)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'message_reactions',
                    },
                    (payload) => {
                        const row = payload.new as any;
                        // Look up which receiver this message_id belongs to
                        const receiverId = sentMessageMapRef.current[row.message_id];
                        if (!receiverId) return; // not one of my sent messages

                        setMyLastSentStatus(prev => ({
                            ...prev,
                            [receiverId]: row.emoji,
                        }));
                    }
                )

                // ── Someone changed their reaction (upsert triggers UPDATE) ─
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'message_reactions',
                    },
                    (payload) => {
                        const row = payload.new as any;
                        const receiverId = sentMessageMapRef.current[row.message_id];
                        if (!receiverId) return;

                        setMyLastSentStatus(prev => ({
                            ...prev,
                            [receiverId]: row.emoji,
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

    // ── Add timeline event ────────────────────────────────────────────────
    const addTimelineEvent = useCallback((event: TimelineEvent) => {
        setTimelineEvents(prev => ({
            ...prev,
            [event.userUniqueId]: [event, ...(prev[event.userUniqueId] || [])],
        }));
    }, []);

    // ── Mark as seen ──────────────────────────────────────────────────────
    const markAsSeen = useCallback(async (userId: string) => {
        const message = unreadMessages[userId];
        if (!message) return;

        const seenAt = new Date().toISOString();

        // Fire-and-forget DB update
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

        // Pop from queue, load next message if any
        setUnreadQueues(prev => {
            const queue = prev[userId] || [];
            const remaining = queue.filter(m => m.id !== message.id);

            if (remaining.length > 0) {
                const nextMsg = remaining[0];
                refreshSignedUrl(nextMsg.uri).then(freshUri => {
                    prefetchIfImage(freshUri, nextMsg.type);
                    setUnreadMessages(prevMsgs => ({
                        ...prevMsgs,
                        [userId]: { ...nextMsg, uri: freshUri },
                    }));
                });
            } else {
                setUnreadMessages(prevMsgs => {
                    const next = { ...prevMsgs };
                    delete next[userId];
                    return next;
                });
            }

            if (remaining.length === 0) {
                const next = { ...prev };
                delete next[userId];
                return next;
            }
            return { ...prev, [userId]: remaining };
        });
    }, [unreadMessages, addTimelineEvent]);

    // ── React to message ──────────────────────────────────────────────────
    const reactToMessage = useCallback(async (userId: string, emoji: string) => {
        const message = unreadMessages[userId];
        if (!message) return;

        const { data: sessionData } = await supabase.auth.getSession();
        const myId = sessionData?.session?.user?.id;
        if (!myId) return;

        // ✅ Correct: INSERT/UPSERT into message_reactions table
        // upsert handles the case where they change their emoji (UNIQUE message_id + user_id)
        const { error } = await supabase
            .from('message_reactions')
            .upsert(
                { message_id: message.id, user_id: myId, emoji },
                { onConflict: 'message_id,user_id' }
            );

        if (error) {
            console.error('[MediaInbox] Failed to react to message:', error);
            return;
        }

        // Sender sees emoji immediately via realtime INSERT on message_reactions
        // (no local state update needed here — the sender's realtime listener handles it)
    }, [unreadMessages]);

    // ── Sent status helpers ───────────────────────────────────────────────
    const recordMessageSent = useCallback((userId: string) => {
        setMyLastSentStatus(prev => ({ ...prev, [userId]: 'sent' }));
    }, []);

    const simulateCounterpartSeen = useCallback((userId: string) => {
        setMyLastSentStatus(prev => {
            if (prev[userId] === 'sent') return { ...prev, [userId]: 'seen' };
            return prev;
        });
    }, []);

    // Clear sent status when we receive a new unread from that user
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
    }), [
        unreadMessages,
        myLastSentStatus,
        markAsSeen,
        reactToMessage,
        addTimelineEvent,
        timelineEvents,
        recordMessageSent,
        simulateCounterpartSeen,
    ]);

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