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
}

export interface PriorityUser extends User {
    relationship: string;
}

export interface PriorityUserWithPost extends PriorityUser {
    hasNewPost?: boolean;
}
