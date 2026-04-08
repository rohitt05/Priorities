// src/services/timelineService.ts
import { supabase } from '@/lib/supabase';
import { TimelineEvent } from '@/types/domain';

// ─── helpers ────────────────────────────────────────────────────────────────

const refreshSignedUrl = async (
    uri: string | null | undefined,
    bucket = 'films'
): Promise<string | undefined> => {
    if (!uri) return undefined;

    // Already a full signed URL → extract path and re-sign (handles expired tokens)
    if (uri.includes('/storage/v1/object/sign/')) {
        const match = uri.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(\?|$)/);
        if (!match) return uri;
        const [, b, path] = match;
        const { data, error } = await supabase.storage
            .from(b)
            .createSignedUrl(path, 60 * 60);
        if (error || !data?.signedUrl) {
            console.warn('[timelineService] Failed to re-sign URL:', error?.message);
            return uri;
        }
        return data.signedUrl;
    }

    // Already a full public HTTPS URL → return as-is
    if (uri.startsWith('https://')) return uri;

    // Raw storage path (e.g. "films/USER_ID/media/filename.mp4") → sign it
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(uri, 60 * 60);

    if (error || !data?.signedUrl) {
        console.warn('[timelineService] Failed to sign raw path:', uri, error?.message);
        return undefined;
    }
    return data.signedUrl;
};

// ─── main export ────────────────────────────────────────────────────────────

export const timelineService = {
    getTimelineForPair: async (
        myId: string,
        theirId: string,           // their auth UUID (profiles.id)
        theirUniqueUserId: string,
        page = 0,
        pageSize = 10
    ): Promise<TimelineEvent[]> => {

        const from = page * pageSize;
        const to = from + pageSize - 1;

        // ── Fetch films + user_timelines IN PARALLEL ──────────────────────────
        // Films: unchanged — still read from films table
        // Messages history: now reads from user_timelines (HISTORY LAYER)
        //   Simple query: owner_id = myId AND other_user_id = theirId
        //   No complex OR filters, no seen_at checks, no dedup needed
        const [filmsResult, timelineResult] = await Promise.all([
            supabase
                .from('films')
                .select('id, creator_id, type, uri, thumbnail, created_at')
                .in('creator_id', [myId, theirId])
                .order('created_at', { ascending: false })
                .range(from, to),

            supabase
                .from('user_timelines')
                .select('id, source_id, media_type, uri, thumb_uri, duration_sec, sender, text_content, seen_at, created_at')
                .eq('owner_id', myId)
                .eq('other_user_id', theirId)
                .order('seen_at', { ascending: false })
                .range(from, to),
        ]);

        if (filmsResult.error) {
            console.error('[timelineService] films fetch error:', filmsResult.error.message);
        }
        if (timelineResult.error) {
            console.error('[timelineService] user_timelines fetch error:', timelineResult.error.message);
        }

        const films = filmsResult.data ?? [];
        const timelineRows = timelineResult.data ?? [];

        // ── Re-sign ALL URLs in parallel ─────────────────────────────────────
        const [signedFilms, signedTimeline] = await Promise.all([
            Promise.all(
                films.map(async (film) => {
                    const [freshUri, freshThumb] = await Promise.all([
                        refreshSignedUrl(film.uri, 'films'),
                        refreshSignedUrl(film.thumbnail, 'films'),
                    ]);
                    return { film, freshUri, freshThumb };
                })
            ),
            Promise.all(
                timelineRows.map(async (row) => {
                    const freshUri = await refreshSignedUrl(row.uri, 'messages');
                    return { row, freshUri };
                })
            ),
        ]);

        // ── Build events array ────────────────────────────────────────────────
        const events: TimelineEvent[] = [];

        // Films (unchanged mapping)
        for (const { film, freshUri, freshThumb } of signedFilms) {
            if (!freshUri) {
                console.warn('[timelineService] Skipping film with no valid URI:', film.id);
                continue;
            }
            events.push({
                id: film.id,
                senderId: film.creator_id,
                receiverId: film.creator_id === myId ? theirId : myId,
                type: (film.type === 'video') ? 'video' : 'photo',
                uri: freshUri,
                sentAt: film.created_at,
                disappeared: false,
                userUniqueId: theirUniqueUserId,
                sender: film.creator_id === myId ? 'me' : 'them',
                timestamp: film.created_at,
                thumbUri: freshThumb ?? freshUri,
            } as TimelineEvent);
        }

        // user_timelines rows → TimelineEvent
        // All 4 types supported: photo, video, voice, text
        // sender is pre-computed ('me' | 'them') — no derivation needed
        for (const { row, freshUri } of signedTimeline) {
            // Skip photo/video rows with no valid URI (voice + text have no URI, that's fine)
            if (!freshUri && (row.media_type === 'photo' || row.media_type === 'video')) {
                console.warn('[timelineService] Skipping timeline row with no valid URI:', row.source_id);
                continue;
            }
            events.push({
                id: row.source_id,        // source_id = original messages.id
                senderId: row.sender === 'me' ? myId : theirId,
                receiverId: row.sender === 'me' ? theirId : myId,
                type: row.media_type as TimelineEvent['type'],
                uri: freshUri,
                thumbUri: row.thumb_uri ?? freshUri,
                durationSec: row.duration_sec ?? undefined,
                textContent: row.text_content ?? undefined,
                sentAt: row.seen_at,      // seen_at is the canonical timestamp for history
                seenAt: row.seen_at,
                disappeared: false,
                userUniqueId: theirUniqueUserId,
                sender: row.sender as 'me' | 'them',
                timestamp: row.seen_at,
            } as TimelineEvent);
        }

        // ── Sort newest-first ─────────────────────────────────────────────────
        events.sort(
            (a, b) => new Date((b as any).timestamp).getTime() - new Date((a as any).timestamp).getTime()
        );

        return events;
    },
};
