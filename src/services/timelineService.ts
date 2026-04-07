// src/services/timelineService.ts
import { supabase } from '@/lib/supabase';
import { TimelineEvent } from '@/types/domain';

// ─── helpers ────────────────────────────────────────────────────────────────

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
    getTimelineForPair: async (
        myId: string,
        theirId: string,
        theirUniqueUserId: string,
        page = 0,
        pageSize = 10
    ): Promise<TimelineEvent[]> => {

        const from = page * pageSize;
        const to = from + pageSize - 1;

        // ── Fetch films + messages IN PARALLEL ───────────────────────────────
        const [filmsResult, messagesResult] = await Promise.all([
            supabase
                .from('films')
                .select('id, creator_id, type, uri, thumbnail, created_at')
                .in('creator_id', [myId, theirId])
                .order('created_at', { ascending: false })
                .range(from, to),

            supabase
                .from('messages')
                .select('id, sender_id, receiver_id, type, uri, duration_sec, sent_at, seen_at, disappeared')
                .or(`sender_id.eq.${myId},and(receiver_id.eq.${myId},seen_at.not.is.null)`)
                .or(
                    `and(sender_id.eq.${myId},receiver_id.eq.${theirId}),` +
                    `and(sender_id.eq.${theirId},receiver_id.eq.${myId})`
                )
                .eq('disappeared', false)
                .order('sent_at', { ascending: false })
                .range(from, to),
        ]);

        if (filmsResult.error) {
            console.error('[timelineService] films fetch error:', filmsResult.error.message);
        }
        if (messagesResult.error) {
            console.error('[timelineService] messages fetch error:', messagesResult.error.message);
        }

        const films = filmsResult.data ?? [];
        const messages = messagesResult.data ?? [];

        // ── Re-sign ALL URLs in parallel (not sequential) ────────────────────
        // Previously: for loop with await = N sequential API calls
        // Now: Promise.all = all calls fire simultaneously
        const [signedFilms, signedMessages] = await Promise.all([
            Promise.all(
                films.map(async (film) => {
                    const [freshUri, freshThumb] = await Promise.all([
                        refreshSignedUrl(film.uri),
                        refreshSignedUrl(film.thumbnail),
                    ]);
                    return { film, freshUri, freshThumb };
                })
            ),
            Promise.all(
                messages.map(async (msg) => {
                    const freshUri = await refreshSignedUrl(msg.uri);
                    return { msg, freshUri };
                })
            ),
        ]);

        // ── Build events array ────────────────────────────────────────────────
        const events: TimelineEvent[] = [];

        for (const { film, freshUri, freshThumb } of signedFilms) {
            events.push({
                id: film.id,
                senderId: film.creator_id,
                receiverId: film.creator_id === myId ? theirId : myId,
                type: film.type === 'video' ? 'video' : 'photo',
                uri: freshUri,
                sentAt: film.created_at,
                disappeared: false,
                userUniqueId: theirUniqueUserId,
                sender: film.creator_id === myId ? 'me' : 'them',
                timestamp: film.created_at,
                thumbUri: freshThumb ?? freshUri,
            } as TimelineEvent);
        }

        for (const { msg, freshUri } of signedMessages) {
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

        // ── Sort newest-first ─────────────────────────────────────────────────
        events.sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        return events;
    },
};