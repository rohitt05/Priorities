// src/services/timelineService.ts
import { supabase } from '@/lib/supabase';
import { TimelineEvent } from '@/types/domain';
import { extractCacheKey, getCachedUrl, setCachedUrl } from './signedUrlCache';


// ─── helpers ────────────────────────────────────────────────────────────────

const refreshSignedUrl = async (
    uri: string | null | undefined,
    bucket = 'films'
): Promise<string | undefined> => {
    if (!uri) return undefined;

    // Public URLs — return as-is immediately
    if (uri.startsWith('https://') && !uri.includes('/storage/v1/object/sign/')) {
        return uri;
    }

    // ✅ Cache hit — skip the API call entirely
    const cacheKey = extractCacheKey(uri);
    if (cacheKey) {
        const cached = getCachedUrl(cacheKey);
        if (cached) return cached;
    }

    let resolvedBucket = bucket;
    let resolvedPath = uri;

    if (uri.includes('/storage/v1/object/sign/')) {
        const match = uri.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(\?|$)/);
        if (!match) return uri;
        resolvedBucket = match[1];
        resolvedPath = match[2];
    }

    const { data, error } = await supabase.storage
        .from(resolvedBucket)
        .createSignedUrl(resolvedPath, 60 * 60);

    if (error || !data?.signedUrl) {
        console.warn('[timelineService] Failed to sign URL:', error?.message);
        return uri;
    }

    // ✅ Store in cache for 55 minutes
    if (cacheKey) setCachedUrl(cacheKey, data.signedUrl);

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

        // ── Re-sign ALL URLs in parallel (cache will short-circuit most of these) ──
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

        const events: TimelineEvent[] = [];

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

        for (const { row, freshUri } of signedTimeline) {
            if (!freshUri && (row.media_type === 'photo' || row.media_type === 'video')) {
                console.warn('[timelineService] Skipping timeline row with no valid URI:', row.source_id);
                continue;
            }
            events.push({
                id: row.source_id,
                senderId: row.sender === 'me' ? myId : theirId,
                receiverId: row.sender === 'me' ? theirId : myId,
                type: row.media_type as any,
                uri: freshUri,
                thumbUri: row.thumb_uri ?? freshUri,
                durationSec: row.duration_sec ?? undefined,
                textContent: row.text_content ?? undefined,
                sentAt: row.seen_at,
                seenAt: row.seen_at,
                disappeared: false,
                userUniqueId: theirUniqueUserId,
                sender: row.sender as 'me' | 'them',
                timestamp: row.seen_at,
            } as TimelineEvent);
        }

        events.sort(
            (a, b) => new Date((b as any).timestamp).getTime() - new Date((a as any).timestamp).getTime()
        );

        return events;
    },
};