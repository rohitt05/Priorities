// src/services/filmService.ts

import profilesFilmRaw from '@/data/profilesfilm.json';
import userFilmsRaw from '@/data/userFilms.json';
import { TIMELINE_EVENTS as timelineEventsRaw } from '@/data/timelineData';
import { FilmDTO, UserFilmCardDTO, TimelineEventDTO } from '@/types/dto';
import { mapFilmDTOToFilm, mapUserFilmCardDTOToFilm, mapTimelineEventDTOToEvent } from '@/types/mappers';
import { Film, TimelineEvent } from '@/types/domain';
import { supabase } from '@/lib/supabase';

export const filmService = {
    getFilmsByUserId: (userId: string): Film[] => {
        const films = (profilesFilmRaw as FilmDTO[])
            .filter(f => f.userId === userId)
            .map(mapFilmDTOToFilm);

        const additionalFilms = (userFilmsRaw as UserFilmCardDTO[])
            .filter(f => f.userId === userId)
            .map(mapUserFilmCardDTOToFilm);

        return [...films, ...additionalFilms]
            .filter(f => !!f.uri)
            .map(f => ({
                ...f,
                createdAt: f.createdAt || new Date().toISOString()
            }))
            .sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
    },

    getTimelineEventsByUserId: (userId: string): TimelineEvent[] => {
        return (timelineEventsRaw as unknown as TimelineEventDTO[])
            .filter(e => e.userUniqueId === userId)
            .map(mapTimelineEventDTOToEvent);
    },

    getAllTimelineEvents: (): TimelineEvent[] => {
        return (timelineEventsRaw as unknown as TimelineEventDTO[])
            .map(mapTimelineEventDTOToEvent);
    },

    getSignedUrl: async (path: string, expiresIn = 3600): Promise<string> => {
        const { data, error } = await supabase.storage
            .from('films')
            .createSignedUrl(path, expiresIn);
        if (error) throw error;
        return data.signedUrl;
    },

    // ✅ These three were accidentally outside the object before
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

    getLikesCount: async (filmId: string): Promise<number> => {
        const { count, error } = await supabase
            .from('film_likes')
            .select('*', { count: 'exact', head: true })
            .eq('film_id', filmId);
        if (error) throw error;
        return count ?? 0;
    },
};                // ← single closing brace for the whole object