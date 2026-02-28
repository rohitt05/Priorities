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
    gender?: 'male' | 'female' | string;
}

export interface PriorityUser extends User {
    relationship: string;
}

export interface PriorityUserWithPost extends PriorityUser {
    hasNewPost?: boolean;
}
