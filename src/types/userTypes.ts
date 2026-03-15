// src/types/userTypes.ts
// Proxy file to maintain backward compatibility while transitioning to domain.ts schema

import { Profile, User, PriorityUserWithPost } from './domain';

export type { Profile, User, PriorityUserWithPost };

// Compatibility aliases for removed types
export type PriorityUser = Profile & { relationship: string };
export type PriorityUserDTO = Profile;
