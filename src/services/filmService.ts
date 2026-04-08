// src/services/filmService.ts
import { supabase } from '@/lib/supabase';
import { Film, Profile } from '@/types/domain';

const FILM_LIFETIME_MS = 24 * 60 * 60 * 1000;

// ── Re-signs a Supabase Storage signed URL so it never expires ───────────────
const refreshSignedUrl = async (uri: string | null | undefined): Promise<string | undefined> => {
    if (!uri) return undefined;
    if (!uri.includes('/storage/v1/object/sign/')) return uri ?? undefined;
    const match = uri.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(\?|$)/);
    if (!match) return uri;
    const [, bucket, path] = match;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) return uri;
    return data.signedUrl;
};

// ── Shared type for a film enriched with viewers + likes ─────────────────────
export interface FilmWithMeta extends Film {
    viewers: Profile[];
    likedByIds: Set<string>;
}

// ── Internal helper: fetch viewers + likes for a list of film IDs ────────────
const fetchFilmMeta = async (
    filmIds: string[]
): Promise<{
    viewersByFilm: Record<string, Profile[]>;
    likedByFilm: Record<string, Set<string>>;
}> => {
    const [viewsRes, likesRes] = await Promise.all([
        supabase
            .from('film_views')
            .select('film_id, viewer_id, profiles:viewer_id(id, name, profile_picture, unique_user_id, dominant_color, relationship)')
            .in('film_id', filmIds),
        supabase
            .from('film_likes')
            .select('film_id, user_id')
            .in('film_id', filmIds),
    ]);

    const viewersByFilm: Record<string, Profile[]> = {};
    (viewsRes.data ?? []).forEach((v: any) => {
        if (!v.profiles) return;
        if (!viewersByFilm[v.film_id]) viewersByFilm[v.film_id] = [];
        if (!viewersByFilm[v.film_id].some((p) => p.id === v.profiles.id)) {
            viewersByFilm[v.film_id].push({
                id: v.profiles.id,
                uniqueUserId: v.profiles.unique_user_id,
                name: v.profiles.name,
                profilePicture: v.profiles.profile_picture,
                dominantColor: v.profiles.dominant_color || '#D4A373',
                relationship: v.profiles.relationship ?? undefined,
            });
        }
    });

    const likedByFilm: Record<string, Set<string>> = {};
    (likesRes.data ?? []).forEach((l: any) => {
        if (!likedByFilm[l.film_id]) likedByFilm[l.film_id] = new Set();
        likedByFilm[l.film_id].add(l.user_id);
    });

    return { viewersByFilm, likedByFilm };
};

export const filmService = {

    // ── MY films — only within the last 24 hrs (myFilmOfTheDay screen) ───────
    getMyFilms: async (myId: string): Promise<FilmWithMeta[]> => {
        const cutoff = new Date(Date.now() - FILM_LIFETIME_MS).toISOString();

        const { data, error } = await supabase
            .from('films')
            .select('id, creator_id, type, uri, thumbnail, location, target_user_id, created_at')
            .eq('creator_id', myId)
            .gte('created_at', cutoff)
            .order('created_at', { ascending: true });

        if (error) throw error;
        if (!data?.length) return [];

        const live = data.filter(
            (f) => Date.now() - new Date(f.created_at).getTime() < FILM_LIFETIME_MS
        );
        if (!live.length) return [];

        const ids = live.map((f) => f.id);
        const { viewersByFilm, likedByFilm } = await fetchFilmMeta(ids);

        return await Promise.all(
            live.map(async (f) => {
                const freshUri = await refreshSignedUrl(f.uri);
                const freshThumb = await refreshSignedUrl(f.thumbnail);
                return {
                    id: f.id,
                    creatorId: f.creator_id,
                    type: f.type as 'image' | 'video',
                    uri: freshUri ?? f.uri,
                    thumbnail: freshThumb ?? undefined,
                    location: f.location ?? undefined,
                    isPublic: false,
                    targetUserId: f.target_user_id ?? null,
                    createdAt: f.created_at,
                    viewers: viewersByFilm[f.id] ?? [],
                    likedByIds: likedByFilm[f.id] ?? new Set(),
                } satisfies FilmWithMeta;
            })
        );
    },

    // ── THEIR films — only within the last 24 hrs (UserFilms screen) ─────────
    getFilmsByUserId: async (userId: string): Promise<FilmWithMeta[]> => {
        const cutoff = new Date(Date.now() - FILM_LIFETIME_MS).toISOString();

        const { data, error } = await supabase
            .from('films')
            .select('id, creator_id, type, uri, thumbnail, location, target_user_id, created_at')
            .eq('creator_id', userId)
            .gte('created_at', cutoff)
            .order('created_at', { ascending: true });

        if (error) throw error;
        if (!data?.length) return [];

        const live = data.filter(
            (f) => Date.now() - new Date(f.created_at).getTime() < FILM_LIFETIME_MS
        );
        if (!live.length) return [];

        const ids = live.map((f) => f.id);
        const { viewersByFilm, likedByFilm } = await fetchFilmMeta(ids);

        return await Promise.all(
            live.map(async (f) => {
                const freshUri = await refreshSignedUrl(f.uri);
                const freshThumb = await refreshSignedUrl(f.thumbnail);
                return {
                    id: f.id,
                    creatorId: f.creator_id,
                    type: f.type as 'image' | 'video',
                    uri: freshUri ?? f.uri,
                    thumbnail: freshThumb ?? undefined,
                    location: f.location ?? undefined,
                    isPublic: false,
                    targetUserId: f.target_user_id ?? null,
                    createdAt: f.created_at,
                    viewers: viewersByFilm[f.id] ?? [],
                    likedByIds: likedByFilm[f.id] ?? new Set(),
                } satisfies FilmWithMeta;
            })
        );
    },

    // ── ALL films for a profile timeline — NO 24hr cutoff (FilmsInProfile) ───
    getAllFilmsByUserId: async (userUUID: string): Promise<FilmWithMeta[]> => {
        const { data, error } = await supabase
            .from('films')
            .select('id, creator_id, type, uri, thumbnail, location, target_user_id, created_at')
            .eq('creator_id', userUUID)
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!data?.length) return [];

        const ids = data.map((f) => f.id);
        const { viewersByFilm, likedByFilm } = await fetchFilmMeta(ids);

        return await Promise.all(
            data.map(async (f) => {
                const freshUri = await refreshSignedUrl(f.uri);
                const freshThumb = await refreshSignedUrl(f.thumbnail);
                return {
                    id: f.id,
                    creatorId: f.creator_id,
                    type: f.type as 'image' | 'video',
                    uri: freshUri ?? f.uri,
                    thumbnail: freshThumb ?? undefined,
                    location: f.location ?? undefined,
                    isPublic: false,
                    targetUserId: f.target_user_id ?? null,
                    createdAt: f.created_at,
                    viewers: viewersByFilm[f.id] ?? [],
                    likedByIds: likedByFilm[f.id] ?? new Set(),
                } satisfies FilmWithMeta;
            })
        );
    },

    // ── Record a film view ────────────────────────────────────────────────────
    recordView: async (filmId: string, viewerId: string): Promise<void> => {
        await supabase
            .from('film_views')
            .upsert(
                { film_id: filmId, viewer_id: viewerId },
                { onConflict: 'film_id,viewer_id', ignoreDuplicates: true }
            );
    },

    // ── Toggle a like on a film ───────────────────────────────────────────────
    toggleLike: async (filmId: string, userId: string, currentlyLiked: boolean): Promise<void> => {
        if (currentlyLiked) {
            const { error } = await supabase
                .from('film_likes')
                .delete()
                .eq('film_id', filmId)
                .eq('user_id', userId);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('film_likes')
                .insert({ film_id: filmId, user_id: userId });
            if (error) throw error;
        }
    },

    // ── Check if current user has liked a film ───────────────────────────────
    getLikeStatus: async (filmId: string, userId: string): Promise<boolean> => {
        const { data, error } = await supabase
            .from('film_likes')
            .select('id')
            .eq('film_id', filmId)
            .eq('user_id', userId)
            .maybeSingle();
        if (error) throw error;
        return !!data;
    },

    // ── Get total like count for a film ──────────────────────────────────────
    getLikesCount: async (filmId: string): Promise<number> => {
        const { count, error } = await supabase
            .from('film_likes')
            .select('*', { count: 'exact', head: true })
            .eq('film_id', filmId);
        if (error) throw error;
        return count ?? 0;
    },

    // ── Get a fresh signed URL for a storage path ────────────────────────────
    getSignedUrl: async (path: string, expiresIn = 3600): Promise<string> => {
        const { data, error } = await supabase.storage
            .from('films')
            .createSignedUrl(path, expiresIn);
        if (error) throw error;
        return data.signedUrl;
    },

    // ── Delete a film ────────────────────────────────────────────────────────
    deleteFilm: async (filmId: string): Promise<void> => {
        const { error } = await supabase
            .from('films')
            .delete()
            .eq('id', filmId);
        if (error) throw error;
    },
};
