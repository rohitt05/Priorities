// src/services/userService.ts

import usersRaw from '@/data/users.json';
import { UserDTO } from '@/types/dto';
import { mapUserDTOToUser } from '@/types/mappers';
import { Profile } from '@/types/domain';

const users: UserDTO[] = usersRaw as UserDTO[];

export const userService = {
    getAllUsers: (): Profile[] => {
        return users.map(mapUserDTOToUser);
    },

    getUserById: (id: string): Profile | undefined => {
        const userDto = users.find(u => u.id === id || u.uniqueUserId === id);
        return userDto ? mapUserDTOToUser(userDto) : undefined;
    },

    getPrioritiesForUser: (userId: string): Profile[] => {
        const user = users.find(u => u.uniqueUserId === userId || u.id === userId);
        if (!user || !user.priorities) return [];

        return user.priorities
            .map(priorityId => userService.getUserById(priorityId))
            .filter((u): u is Profile => u !== undefined);
    }
};
