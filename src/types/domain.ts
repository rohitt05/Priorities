// src/types/domain.ts

export type MediaType = 'photo' | 'video' | 'audio' | 'voice_call' | 'video_call' | 'note';

export interface User {
    id: string;
    uniqueUserId: string;
    name: string;
    profilePicture: string;
    birthday: string;
    dominantColor: string;
    relationship?: string;
    partnerId?: string;
    prioritiesCount?: number;
    priorities: string[]; // Always present in domain model
    gender?: 'male' | 'female' | string;
}

export interface PriorityUser extends User {
    relationship: string;
}

export interface PriorityUserWithPost extends PriorityUser {
    hasNewPost?: boolean;
}

export interface Film {
    id: string;
    userId: string;
    type: 'image' | 'video';
    thumbnail: string;
    uri: string;
    timestamp: string;
    location?: string;
    isPublic: boolean;
    recipientId?: string | null;
    dayOfWeek?: string; // Derived or optional
}

export interface TimelineEvent {
    id: string;
    userUniqueId: string;
    timestamp: string;
    sender: 'me' | 'them';
    type: MediaType;
    uri?: string;
    thumbUri?: string;
    caption?: string;
    text?: string;
    durationSec?: number;
    title?: string;
}
