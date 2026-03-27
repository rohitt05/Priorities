// src/features/profile/utils/profileConstants.ts
import { Dimensions } from 'react-native';

const { height } = Dimensions.get('window');

export const HEADER_HEIGHT = height * 0.60;
export const TRIGGER_THRESHOLD = 100;
export const PARTNER_KEY = '@profile_partner_unique_user_id';
export const BG_OPACITY = 0.35;
// CURRENT_USER_ID removed — use useAuthUser() hook instead
