// src/types/mappers.ts

import { Profile, Film, Message, TimelineEvent, MediaType } from './domain';
import { UserDTO, FilmDTO, TimelineEventDTO, UserFilmCardDTO } from './dto';

export const mapUserDTOToUser = (dto: UserDTO): Profile => ({
    id: dto.id,
    uniqueUserId: dto.uniqueUserId,
    name: dto.name,
    profilePicture: dto.profilePicture,
    birthday: dto.birthday,
    dominantColor: dto.dominantColor,
    gender: dto.gender,
});

export const mapFilmDTOToFilm = (dto: FilmDTO): Film => ({
    id: dto.id,
    creatorId: dto.userId, // Standardized to creatorId
    type: dto.type,
    uri: dto.uri,
    thumbnail: dto.thumbnail,
    location: dto.location,
    isPublic: dto.isPublic,
    targetUserId: dto.recipientId, // Standardized to targetUserId
    createdAt: dto.timestamp, // Standardized to createdAt
    caption: dto.caption,
    likesCount: dto.likesCount,
});

export const mapTimelineEventDTOToEvent = (dto: TimelineEventDTO): TimelineEvent => {
    const isMe = dto.sender === 'me';
    let type: MediaType = 'photo';
    if (dto.type === 'video') type = 'video';
    else if (dto.type === 'voice' || dto.type === 'audio') type = 'voice';

    return {
        id: dto.id,
        senderId: isMe ? 'me' : dto.userUniqueId,
        receiverId: isMe ? dto.userUniqueId : 'me',
        userUniqueId: dto.userUniqueId,
        sentAt: dto.timestamp,
        timestamp: dto.timestamp,
        sender: dto.sender,
        type,
        uri: dto.uri,
        textContent: dto.caption || dto.text,
        durationSec: dto.durationSec,
    } as TimelineEvent;
};


export const mapUserFilmCardDTOToFilm = (dto: UserFilmCardDTO): Film => ({
    id: dto.id,
    creatorId: dto.userId,
    type: dto.mediaType === 'video' ? 'video' : 'image',
    thumbnail: dto.mediaUrl,
    uri: dto.mediaUrl,
    isPublic: true,
    createdAt: dto.timestamp,
    caption: dto.caption,
    likesCount: dto.likesCount,
});

