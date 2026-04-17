import { USE_LOCAL_MEDIA } from '@/config/mediaConfig';

// ─── Mock asset requires ──────────────────────────────────────────────────────
// These are resolved at bundle time by Metro, so the paths must be static string
// literals — they cannot be dynamic variables.
const MOCK_VIDEO = require('../../assets/mock/mock-video.mp4');
const MOCK_IMAGE = require('../../assets/mock/mock-image.jpg');
const MOCK_AVATAR = require('../../assets/mock/mock-avatar.jpg');
const MOCK_AUDIO = require('../../assets/mock/mock-audio.m4a');

// ─── Shared return type ───────────────────────────────────────────────────────
// Compatible with both expo-image <Image source={} /> and
// expo-video useVideoPlayer(source, …).
export type MediaSource = string | { uri: string } | number;

/**
 * Returns the source for a film (video or image).
 * When USE_LOCAL_MEDIA = true → local mock video.
 * When USE_LOCAL_MEDIA = false → the signed Supabase URL string, unchanged.
 */
export function getFilmSource(uri: string): MediaSource {
    if (USE_LOCAL_MEDIA) return MOCK_VIDEO;
    return uri;
}

/**
 * Returns the source for a generic content image (film thumbnail / photo).
 * When USE_LOCAL_MEDIA = true → local mock image.
 * When USE_LOCAL_MEDIA = false → the Supabase URL (or empty string if missing).
 */
export function getImageSource(uri?: string | null): MediaSource {
    if (USE_LOCAL_MEDIA) return MOCK_IMAGE;
    return uri ?? '';
}

/**
 * Returns the source for a user avatar / profile picture.
 * When USE_LOCAL_MEDIA = true → local mock avatar.
 * When USE_LOCAL_MEDIA = false → the Supabase URL (or empty string if missing).
 */
export function getAvatarSource(uri?: string | null): MediaSource {
    if (USE_LOCAL_MEDIA) return MOCK_AVATAR;
    return uri ?? '';
}

/**
 * Returns the source for a voice note audio file.
 * When USE_LOCAL_MEDIA = true → local mock audio.
 * When USE_LOCAL_MEDIA = false → the Supabase URL (or empty string if missing).
 */
export function getVoiceNoteSource(uri?: string | null): MediaSource {
    if (USE_LOCAL_MEDIA) return MOCK_AUDIO;
    return uri ?? '';
}
