// src/types/dto.ts

export interface UserDTO {
    id: string;
    uniqueUserId: string;
    name: string;
    profilePicture: string;
    birthday: string;
    dominantColor: string;
    relationship?: string;
    partnerId?: string;
    prioritiesCount?: number;
    priorities?: string[];
    gender?: string;
}

export interface FilmDTO {
    id: string;
    userId: string;
    type: 'image' | 'video';
    thumbnail: string;
    uri: string;
    timestamp: string;
    location?: string;
    isPublic: boolean;
    recipientId: string | null;
}

export interface TimelineEventDTO {
    id: string;
    userUniqueId: string;
    timestamp: string;
    sender: 'me' | 'them';
    type: any; // Match whatever is in JSON
    uri?: string;
    thumbUri?: string;
    caption?: string;
    text?: string;
    durationSec?: number;
    title?: string;
}

export interface UserFilmCardDTO {
    id: string;
    userId: string;
    mediaUrl: string;
    mediaType: string;
    timestamp: string;
    dayOfWeek: string;
}
