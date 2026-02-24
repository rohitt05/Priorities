export interface MediaItem {
    id: string; // STRICT string ID for reliable keys
    type: 'photo' | 'video' | 'audio' | 'voice_call' | 'video_call' | 'note';
    uri?: string;
    thumbUri?: string;
    text?: string;
    caption?: string;
    durationSec?: number;
    title?: string;
    timestamp?: string;
    sender?: 'me' | 'them';
}

export interface BaseMediaProps {
    mediaItem: MediaItem;
    onClose?: () => void;
}

export const formatTime = (seconds: number): string => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};
