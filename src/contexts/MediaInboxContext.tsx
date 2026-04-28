// src/contexts/MediaInboxContext.tsx
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect, useRef } from 'react';
import { Image } from 'react-native';
import { supabase } from '@/lib/supabase';
import { TimelineEvent, Message } from '@/types/domain';
import { getCachedUrl, setCachedUrl } from '@/services/signedUrlCache';
import { notifyTimelineInsert } from '@/services/timelineNotifyBridge';

export type UnreadMedia = Message;

interface MediaInboxContextType {
    unreadMessages: Record<string, Message>;
    myLastSentStatus: Record<string, { status: string; timestamp: string }>;
    markAsSeen: (userId: string) => Promise<void>;
    reactToMessage: (userId: string, emoji: string) => Promise<void>;
    addTimelineEvent: (event: TimelineEvent) => void;
    timelineEvents: Record<string, TimelineEvent[]>;
    recordMessageSent: (userId: string) => void;
    simulateCounterpartSeen: (userId: string) => void;
}

const MediaInboxContext = createContext<MediaInboxContextType | undefined>(undefined);

// ── Extracts bucket + path from a Supabase signed URL ──────────────────
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

    const cached = getCachedUrl(`${parsed.bucket}/${parsed.path}`);
    if (cached) return cached;

    const { data, error } = await supabase.storage
        .from(parsed.bucket)
        .createSignedUrl(parsed.path, 60 * 60);

    if (error || !data?.signedUrl) {
        console.warn('[MediaInbox] Failed to refresh signed URL, using original:', error?.message);
        return uri;
    }

    setCachedUrl(`${parsed.bucket}/${parsed.path}`, data.signedUrl);
    return data.signedUrl;
};

// ── Pre-fetches images into RN image cache ────────────────────────────────
const prefetchIfImage = (uri: string | undefined, type: string) => {
    if (!uri) return;
    if (type === 'photo' || type === 'image') {
        Image.prefetch(uri).catch(() => { });
    }
};

// ── Safe helper: always returns a server-validated user ID ────────────────
// getSession() reads from AsyncStorage and can be stale — its JWT may not
// match auth.uid() that Postgres RLS evaluates. getUser() hits the server
// and is always correct.
const getMyId = async (): Promise<string | undefined> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) return undefined;
    return data.user.id;
};

export const MediaInboxProvider = ({ children }: { children: ReactNode }) => {
    const [unreadQueues, setUnreadQueues] = useState<Record<string, Message[]>>({});
    const [unreadMessages, setUnreadMessages] = useState<Record<string, Message>>({});
    const [myLastSentStatus, setMyLastSentStatus] = useState<Record<string, { status: string; timestamp: string }>>({});
    const [timelineEvents, setTimelineEvents] = useState<Record<string, TimelineEvent[]>>({});

    const sentMessageMapRef = useRef<Record<string, string>>({});

    // ── Fetch all unread messages + refresh signed URLs ───────────────────────
    const loadUnreadMessages = useCallback(async () => {
        const myId = await getMyId();
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

        const topEntries = await Promise.all(
            Object.entries(queuesBySender).map(async ([senderId, queue]) => {
                const topMsg = queue[0];
                const freshUri = await refreshSignedUrl(topMsg.uri);
                prefetchIfImage(freshUri, topMsg.type);
                return [senderId, { ...topMsg, uri: freshUri }] as const;
            })
        );
        setUnreadMessages(Object.fromEntries(topEntries));

        const { data: sentData, error: sentError } = await supabase
            .from('messages')
            .select('id, receiver_id, sent_at, seen_at, message_reactions(emoji, created_at)')
            .eq('sender_id', myId)
            .eq('disappeared', false)
            .order('sent_at', { ascending: false });

        if (!sentError && sentData) {
            const statusMap: Record<string, { status: string; timestamp: string }> = {};
            const newSentMap: Record<string, string> = {};

            sentData.forEach((row: any) => {
                newSentMap[row.id] = row.receiver_id;
                if (!statusMap[row.receiver_id]) {
                    const reactionRow = row.message_reactions?.[0];
                    if (reactionRow) {
                        statusMap[row.receiver_id] = { status: reactionRow.emoji, timestamp: reactionRow.created_at };
                    } else {
                        statusMap[row.receiver_id] = {
                            status: row.seen_at ? 'seen' : 'sent',
                            timestamp: row.seen_at || row.sent_at,
                        };
                    }
                }
            });

            sentMessageMapRef.current = newSentMap;
            setMyLastSentStatus(prev => ({ ...prev, ...statusMap }));
        }
    }, []);

    // ── Realtime subscription ─────────────────────────────────────────────────
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    useEffect(() => {
        loadUnreadMessages();

        const setupRealtime = async () => {
            const myId = await getMyId();
            if (!myId) return;

            channelRef.current = supabase
                .channel('messages-inbox')

                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${myId}` },
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

                        setUnreadQueues(prev => ({
                            ...prev,
                            [row.sender_id]: [newMessage, ...(prev[row.sender_id] || [])],
                        }));

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
                    { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${myId}` },
                    (payload) => {
                        const row = payload.new as any;
                        if (row.seen_at) {
                            setMyLastSentStatus(prev => {
                                const current = prev[row.receiver_id];
                                const isEmoji = current && current.status !== 'sent' && current.status !== 'seen' && current.status !== 'none';
                                if (isEmoji) return prev;
                                return { ...prev, [row.receiver_id]: { status: 'seen', timestamp: row.seen_at } };
                            });
                        }
                    }
                )

                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'message_reactions' },
                    (payload) => {
                        const row = payload.new as any;
                        const receiverId = sentMessageMapRef.current[row.message_id];
                        if (!receiverId) return;
                        setMyLastSentStatus(prev => ({
                            ...prev,
                            [receiverId]: { status: row.emoji, timestamp: row.created_at || new Date().toISOString() },
                        }));
                    }
                )

                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'message_reactions' },
                    (payload) => {
                        const row = payload.new as any;
                        const receiverId = sentMessageMapRef.current[row.message_id];
                        if (!receiverId) return;
                        setMyLastSentStatus(prev => ({
                            ...prev,
                            [receiverId]: { status: row.emoji, timestamp: row.created_at || new Date().toISOString() },
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

    // ── Add timeline event ────────────────────────────────────────────────────
    const addTimelineEvent = useCallback((event: TimelineEvent) => {
        setTimelineEvents(prev => ({
            ...prev,
            [event.userUniqueId]: [event, ...(prev[event.userUniqueId] || [])],
        }));
    }, []);

    // ── Mark as seen ──────────────────────────────────────────────────────────
    // 1. UPDATE messages.seen_at   → sender gets realtime "seen" signal
    // 2. INSERT user_timelines Row A (my perspective, sender = 'them')
    //    DB trigger mirror_timeline_for_sender() auto-writes Row B for the sender.
    // 3. addTimelineEvent (optimistic) → UI updates instantly
    // 4. notifyTimelineInsert() → tells UserTimelineContext to refresh NOW
    //    (zero-latency, fires before the Supabase realtime round-trip)
    const markAsSeen = useCallback(async (userId: string) => {
        const message = unreadMessages[userId];
        if (!message) return;

        const seenAt = new Date().toISOString();

        // Step 1 — mark seen in delivery layer
        supabase
            .from('messages')
            .update({ seen_at: seenAt })
            .eq('id', message.id)
            .then(({ error }) => {
                if (error) console.error('[MediaInbox] Failed to mark seen:', error);
            });

        // Step 2 — write Row A to history layer, then notify timeline immediately
        const myId = await getMyId();

        if (myId) {
            supabase
                .from('user_timelines')
                .insert({
                    owner_id: myId,
                    other_user_id: message.senderId,
                    source_id: message.id,
                    source_type: 'message' as const,
                    media_type: message.type,
                    uri: message.uri ?? null,
                    thumb_uri: null,
                    duration_sec: message.durationSec ?? null,
                    sender: 'them' as const,
                    text_content: (message as any).textContent ?? null,
                    seen_at: seenAt,
                })
                .then(({ error }) => {
                    if (error) {
                        console.error('[MediaInbox] user_timelines insert failed:', error);
                        return;
                    }
                    // ✅ Zero-latency signal: tell UserTimelineContext to refresh NOW
                    // This fires as soon as the DB confirms the insert —
                    // well before the Supabase realtime event arrives.
                    notifyTimelineInsert(message.senderId);
                });
        }

        // Step 3 — optimistic UI update
        const updatedMessage: Message = { ...message, seenAt };
        const event: TimelineEvent = {
            ...updatedMessage,
            userUniqueId: userId,
            timestamp: seenAt,
            sender: 'them',
        } as TimelineEvent;
        addTimelineEvent(event);

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

    // ── React to message ──────────────────────────────────────────────────────
    const reactToMessage = useCallback(async (userId: string, emoji: string) => {
        const message = unreadMessages[userId];
        if (!message) return;

        const myId = await getMyId();
        if (!myId) return;

        const { error } = await supabase
            .from('message_reactions')
            .upsert(
                { message_id: message.id, user_id: myId, emoji },
                { onConflict: 'message_id,user_id' }
            );

        if (error) {
            console.error('[MediaInbox] Failed to react to message:', error);
        }
    }, [unreadMessages]);

    // ── Sent status helpers ───────────────────────────────────────────────────
    const recordMessageSent = useCallback((userId: string) => {
        setMyLastSentStatus(prev => ({ ...prev, [userId]: { status: 'sent', timestamp: new Date().toISOString() } }));
    }, []);

    const simulateCounterpartSeen = useCallback((userId: string) => {
        setMyLastSentStatus(prev => {
            if (prev[userId]?.status === 'sent') {
                return { ...prev, [userId]: { status: 'seen', timestamp: new Date().toISOString() } };
            }
            return prev;
        });
    }, []);

    useEffect(() => {
        const unreadUserIds = Object.keys(unreadMessages);
        setMyLastSentStatus(prev => {
            const next = { ...prev };
            let changed = false;
            unreadUserIds.forEach(uid => {
                if (next[uid] && next[uid].status !== 'none') {
                    next[uid] = { status: 'none', timestamp: new Date().toISOString() };
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
