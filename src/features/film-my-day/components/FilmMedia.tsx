import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';

interface FilmMediaProps {
    uri: string;
    type: 'image' | 'video';
    style?: any;
    resizeMode?: 'cover' | 'contain';
    isPlaying?: boolean;
    onReady?: () => void;
    onDuration?: (durationMs: number) => void;
    onComplete?: () => void;
}

const FilmMedia: React.FC<FilmMediaProps> = ({
    uri,
    type,
    style,
    resizeMode = 'cover',
    isPlaying = false,
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

    const player = useVideoPlayer(uri, (p) => {
        p.loop = false;
        p.muted = false;
        p.staysActiveInBackground = false;
    });

    // Reset fired flags every time URI changes
    useEffect(() => {
        firedRef.current = { ready: false, duration: false };
    }, [uri]);

    // Images: fire onReady immediately
    useEffect(() => {
        if (type !== 'image') return;
        onReadyRef.current?.();
    }, [uri, type]);

    // Videos: listen to statusChange for ready + duration
    useEffect(() => {
        if (type !== 'video') return;

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
    }, [player, type]);

    // Play / pause control
    useEffect(() => {
        if (type !== 'video') return;
        try {
            if (isPlaying) player.play();
            else player.pause();
        } catch (_) { }
    }, [isPlaying, player, type]);

    if (type === 'video') {
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
    }

    return (
        <Image
            source={{ uri }}
            style={[styles.container, style]}
            contentFit={resizeMode}
            transition={300}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
    },
});

export default FilmMedia;