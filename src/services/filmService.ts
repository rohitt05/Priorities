// src/services/filmService.ts

import profilesFilmRaw from '@/data/profilesfilm.json';
import userFilmsRaw from '@/data/userFilms.json';
import { TIMELINE_EVENTS as timelineEventsRaw } from '@/data/timelineData';
import { FilmDTO, UserFilmCardDTO, TimelineEventDTO } from '@/types/dto';
import { mapFilmDTOToFilm, mapUserFilmCardDTOToFilm, mapTimelineEventDTOToEvent } from '@/types/mappers';
import { Film, TimelineEvent } from '@/types/domain';

export const filmService = {
    getFilmsByUserId: (userId: string): Film[] => {
        const films = (profilesFilmRaw as FilmDTO[])
            .filter(f => f.userId === userId)
            .map(mapFilmDTOToFilm);

        // Also check userFilms.json which seems to have a slightly different structure
        const additionalFilms = (userFilmsRaw as UserFilmCardDTO[])
            .filter(f => f.userId === userId)
            .map(mapUserFilmCardDTOToFilm);

        // Merge and sort by createdAt (standardized)
        return [...films, ...additionalFilms].sort((a, b) =>
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
    }
};
