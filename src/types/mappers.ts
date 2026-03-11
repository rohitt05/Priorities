// src/types/mappers.ts

import { User, Film, TimelineEvent } from './domain';
import { UserDTO, FilmDTO, TimelineEventDTO, UserFilmCardDTO } from './dto';

export const mapUserDTOToUser = (dto: UserDTO): User => ({
    id: dto.id,
    uniqueUserId: dto.uniqueUserId,
    name: dto.name,
    profilePicture: dto.profilePicture,
    birthday: dto.birthday,
    dominantColor: dto.dominantColor,
    relationship: dto.relationship,
    partnerId: dto.partnerId,
    prioritiesCount: dto.prioritiesCount,
    priorities: dto.priorities || [],
    gender: dto.gender,
});

export const mapFilmDTOToFilm = (dto: FilmDTO): Film => ({
    ...dto,
    dayOfWeek: new Date(dto.timestamp).toLocaleDateString(undefined, { weekday: 'long' }),
});

export const mapTimelineEventDTOToEvent = (dto: TimelineEventDTO): TimelineEvent => ({
    id: dto.id,
    userUniqueId: dto.userUniqueId,
    timestamp: dto.timestamp,
    sender: dto.sender,
    type: dto.type,
    uri: dto.uri,
    thumbUri: dto.thumbUri,
    caption: dto.caption,
    text: dto.text,
    durationSec: dto.durationSec,
    title: dto.title,
});

export const mapUserFilmCardDTOToFilm = (dto: UserFilmCardDTO): Film => ({
    id: dto.id,
    userId: dto.userId,
    type: dto.mediaType === 'video' ? 'video' : 'image',
    thumbnail: dto.mediaUrl,
    uri: dto.mediaUrl,
    timestamp: dto.timestamp,
    isPublic: true,
    dayOfWeek: dto.dayOfWeek,
});
