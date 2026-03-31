export type MediaType = 'photo' | 'video' | 'voice';

/**
 * Profile: Aligns with 'profiles' table (Supabase/Auth extension)
 */
export interface Profile {
    id: string; // Internal UUID
    uniqueUserId: string; // @handle
    name: string;
    profilePicture: string;
    dominantColor: string;
    birthday?: string;
    gender?: string;
    createdAt?: string;
    priorities?: string[]; // Kept for backward compatibility with mock data logic
    partnerId?: string; // Optional partner link
    relationship?: string; // Relationship label (e.g., "GF", "Wife") - STRICTLY for couples/dating only
    phoneNumber?: string; // User's phone number for security/recovery
}



// Keep User alias for backward compatibility during transition
export type User = Profile;

/**
 * Priority: Aligns with 'priorities' join table
 * Defines the relationship circle on the Home screen
 */
export interface Priority {
    id: string;
    userId: string; // Owner
    priorityUserId: string; // The person in the circle
    rank: number; // Order for horizontal scrolling
    isPinned: boolean;
    createdAt: string;
}

/**
 * Film: Aligns with 'films' table
 * Daily captures (Photo/Video)
 */
export interface Film {
    id: string;
    creatorId: string;
    type: 'image' | 'video';
    uri: string;
    thumbnail?: string;
    location?: string;
    isPublic?: boolean;          // optional — column does not exist in DB yet
    targetUserId?: string | null;
    createdAt: string;
    caption?: string;
    likesCount?: number;
}

/**
 * Message: Aligns with 'messages' table
 * Handles the "Media Inbox" / Snapchat-style disappear logic
 */
export interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    type: MediaType;
    uri?: string;
    textContent?: string;
    durationSec?: number;
    sentAt: string;
    seenAt?: string | null; // Used for "seen badge"
    disappeared?: boolean; // Snapchat-style logic
    reaction?: string | null; // Emoji reaction
}

/**
 * UI Support Types
 * These are used by components that need combined data
 */
export interface PriorityUserWithPost extends Profile {
    relationship?: string;
    hasNewPost?: boolean;
    pinned?: boolean;
    rank?: number;
    isPending?: boolean; // true = request sent, not yet accepted (24hr temp window)
}

// Backward compatibility for existing Timeline logic
export interface TimelineEvent extends Message {
    userUniqueId: string; // Field still used in many files
    sender: 'me' | 'them'; // Derived from senderId vs current user
    timestamp: string; // Alias for sentAt
    thumbUri?: string; // Thumbnail URL for videos/photos
    text?: string; // Text content for notes
    title?: string; // Title for audio messages
}