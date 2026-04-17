import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getFilmSource } from '@/utils/getMediaSource';

interface FilmVideoPlayerProps {
    uri: string;
    style?: any;
    resizeMode?: 'cover' | 'contain';
    isPlaying?: boolean;
    isMuted?: boolean;
    onReady?: () => void;
    onDuration?: (durationMs: number) => void;
    onComplete?: () => void;
}

const FilmVideoPlayer: React.FC<FilmVideoPlayerProps> = ({
    uri,
    style,
    resizeMode = 'cover',
    isPlaying = false,
    isMuted = false,
    onReady,
    onDuration,
    onComplete,
}) => {
    // Always keep latest callbacks in refs — never stale, never cause re-renders
    const onReadyRef = useRef(onReady);
    const onDurationRef = useRef(onDuration);
    const onCompleteRef = useRef(onComplete);
    onReadyRef.current = onReady;
    onDurationRef.current = onDuration;
    onCompleteRef.current = onComplete;

    const firedRef = useRef({ ready: false, duration: false });

    const player = useVideoPlayer(getFilmSource(uri), (p) => {
        p.loop = false;
        p.muted = isMuted;
        p.volume = isMuted ? 0 : 1;
        p.staysActiveInBackground = false;
    });

    useEffect(() => {
        try {
            player.muted = isMuted;
            player.volume = isMuted ? 0 : 1;
        } catch (_) { }
    }, [isMuted, player]);

    // Reset fired flags every time URI changes
    useEffect(() => {
        firedRef.current = { ready: false, duration: false };
    }, [uri]);

    // Videos: listen to statusChange for ready + duration
    useEffect(() => {
        const statusSub = player.addListener('statusChange', ({ status }: { status: string }) => {
            if (status === 'readyToPlay' && !firedRef.current.ready) {
                firedRef.current.ready = true;
                onReadyRef.current?.();

                // Small delay to let player.duration settle
                setTimeout(() => {
                    const dur = player.duration;
                    if (dur > 0 && !firedRef.current.duration) {
                        firedRef.current.duration = true;
                        onDurationRef.current?.(dur * 1000);
                    }
                }, 50);
            }
        });

        const endSub = player.addListener('playToEnd', () => {
            onCompleteRef.current?.();
        });

        return () => {
            statusSub.remove();
            endSub.remove();
        };
    }, [player]);

    // Play / pause control
    useEffect(() => {
        try {
            if (isPlaying) {
                // To avoid jumping or weird state, we check if it is already playing. 
                // But expo-video handles this properly in most cases.
                player.play();
            } else {
                player.pause();
            }
        } catch (_) { }
    }, [isPlaying, player]);

    return (
        <View style={[styles.container, style]}>
            <VideoView
                style={StyleSheet.absoluteFill}
                player={player}
                contentFit={resizeMode === 'cover' ? 'cover' : 'contain'}
                nativeControls={false}
                allowsFullscreen={false}
                allowsPictureInPicture={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
    },
});

export default FilmVideoPlayer;
