import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { SharedValue } from 'react-native-reanimated';

interface FilmMediaProps {
    uri: string;
    type: 'image' | 'video';
    style?: any;
    resizeMode?: 'cover' | 'contain';
    isPlaying?: boolean;
    accent?: string;
    onReady?: () => void;
    onDuration?: (duration: number) => void;
    onComplete?: () => void;
    progress?: SharedValue<number>;
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
    const isReadyReported = React.useRef(false);
    const durationReported = React.useRef(false);

    const player = useVideoPlayer(type === 'video' ? uri : null, (p) => {
        p.loop = false;
        p.muted = false;
        p.staysActiveInBackground = false;
        if (isPlaying) p.play();
    });

    // Images: fire onReady immediately
    useEffect(() => {
        if (type === 'image') {
            onReady?.();
        }
    }, [type]);

    // Videos: fire onReady + onDuration ONCE when readyToPlay
    useEffect(() => {
        if (type !== 'video') return;

        // Reset refs when uri changes (new video)
        isReadyReported.current = false;
        durationReported.current = false;

        const statusSub = player.addListener('statusChange', (payload: any) => {
            if (payload.status === 'readyToPlay' && !isReadyReported.current) {
                isReadyReported.current = true;
                onReady?.();
                if (player.duration > 0 && !durationReported.current) {
                    durationReported.current = true;
                    onDuration?.(player.duration * 1000);
                }
            }
        });

        return () => statusSub.remove();
    }, [player, type, uri]);

    // Play / pause
    useEffect(() => {
        if (type !== 'video') return;
        if (isPlaying) player.play();
        else player.pause();
    }, [isPlaying, player, type]);

    // Fire onComplete when video ends — this is the ONLY signal modal needs
    useEffect(() => {
        if (type !== 'video') return;
        const completeSub = player.addListener('playToEnd', () => {
            onComplete?.();
        });
        return () => completeSub.remove();
    }, [player, type, onComplete]);

    if (type === 'video') {
        return (
            <View style={[styles.container, style]}>
                <VideoView
                    style={StyleSheet.absoluteFill}
                    player={player}
                    contentFit={resizeMode === 'cover' ? 'cover' : 'contain'}
                    nativeControls={false}
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