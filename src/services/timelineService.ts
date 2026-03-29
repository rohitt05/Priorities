// src/services/timelineService.ts
// Fetches the real timeline for a pair of users (you + one of your priorities).
// Returns TimelineEvent[] — the same shape that TimelineCalendar already expects.

import { supabase } from '@/lib/supabase';
import { TimelineEvent } from '@/types/domain';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Re-sign a Supabase Storage URL so it never expires in the viewer */
const refreshSignedUrl = async (
    uri: string | null | undefined
): Promise<string | undefined> => {
    if (!uri) return undefined;
    if (!uri.includes('/storage/v1/object/sign/')) return uri ?? undefined;

    const match = uri.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(\?|$)/);
    if (!match) return uri;

    const [, bucket, path] = match;
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60);

    if (error || !data?.signedUrl) return uri;
    return data.signedUrl;
};

// ─── main export ────────────────────────────────────────────────────────────

export const timelineService = {
    /**
     * Fetch the full shared timeline between `myId` and `theirId`.
     *
     * Sources:
     *   • films    — photos/videos either person posted
     *   • messages — photo / video / voice notes sent between the two
     *
     * Returns a unified, date-sorted TimelineEvent[] ready for TimelineCalendar.
     */
    getTimelineForPair: async (
        myId: string,
        theirId: string,
        theirUniqueUserId: string   // needed for filterEventsForUser() in TimelineCalendar
    ): Promise<TimelineEvent[]> => {
        const events: TimelineEvent[] = [];

        // ── 1. Films ──────────────────────────────────────────────────────────
        const { data: films, error: filmsError } = await supabase
            .from('films')
            .select('id, creator_id, type, uri, thumbnail, created_at')
            .in('creator_id', [myId, theirId])
            .order('created_at', { ascending: false });

        if (filmsError) {
            console.error('[timelineService] films fetch error:', filmsError.message);
        }

        for (const film of films ?? []) {
            const freshUri = await refreshSignedUrl(film.uri);
            const freshThumb = await refreshSignedUrl(film.thumbnail);

            events.push({
                // Message-compatible fields (TimelineEvent extends Message)
                id: film.id,
                senderId: film.creator_id,
                receiverId: film.creator_id === myId ? theirId : myId,
                type: film.type === 'video' ? 'video' : 'photo',
                uri: freshUri,
                sentAt: film.created_at,
                disappeared: false,

                // TimelineEvent-specific fields
                userUniqueId: theirUniqueUserId,
                sender: film.creator_id === myId ? 'me' : 'them',
                timestamp: film.created_at,
                thumbUri: freshThumb ?? freshUri,
            } as TimelineEvent);
        }

        // ── 2. Messages (photo / video / voice) ───────────────────────────────
        // Only show messages if:
        // a) I sent it (sender_id = myId)
        // b) I received it AND I've seen it (receiver_id = myId AND seen_at is not null)
        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('id, sender_id, receiver_id, type, uri, duration_sec, sent_at, seen_at, disappeared')
            .or(`sender_id.eq.${myId},and(receiver_id.eq.${myId},seen_at.not.is.null)`)
            .or(
                `and(sender_id.eq.${myId},receiver_id.eq.${theirId}),` +
                `and(sender_id.eq.${theirId},receiver_id.eq.${myId})`
            )
            .eq('disappeared', false)
            .order('sent_at', { ascending: false });

        if (messagesError) {
            console.error('[timelineService] messages fetch error:', messagesError.message);
        }

        for (const msg of messages ?? []) {
            const freshUri = await refreshSignedUrl(msg.uri);

            events.push({
                id: msg.id,
                senderId: msg.sender_id,
                receiverId: msg.receiver_id,
                type: msg.type as TimelineEvent['type'],
                uri: freshUri,
                durationSec: msg.duration_sec ?? undefined,
                sentAt: msg.sent_at,
                seenAt: msg.seen_at ?? null,
                disappeared: msg.disappeared,

                userUniqueId: theirUniqueUserId,
                sender: msg.sender_id === myId ? 'me' : 'them',
                timestamp: msg.sent_at,
                thumbUri: freshUri,
            } as TimelineEvent);
        }

        // ── 3. Sort everything newest-first ──────────────────────────────────
        events.sort(
            (a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        return events;
    },
};
