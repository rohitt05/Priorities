import React, { useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';

interface FilmMediaProps {
    uri: string;
    type: 'image' | 'video';
    style?: any;
    resizeMode?: 'cover' | 'contain';
    isPlaying?: boolean;
    onDuration?: (duration: number) => void;
    onReady?: () => void;
}

const FilmMedia: React.FC<FilmMediaProps> = ({
    uri,
    type,
    style,
    resizeMode = 'cover',
    isPlaying = false,
    onDuration,
    onReady
}) => {
    const [isImageLoaded, setIsImageLoaded] = React.useState(false);

    // Track when image is ready
    useEffect(() => {
        if (type === 'image' && isImageLoaded && onReady) {
            onReady();
        }
    }, [isImageLoaded, onReady, type]);

    // Always initialize the player for videos to enable pre-loading
    const player = useVideoPlayer(type === 'video' ? uri : null, (p) => {
        p.loop = true;
        p.muted = true;
        if (isPlaying) {
            p.play();
        }
    });

    useEffect(() => {
        if (type !== 'video') return;

        // Trigger onReady when video is buffered/ready
        if (player.status === 'readyToPlay') {
            onReady?.();
            // If we've been waiting for ready to play, start now
            if (isPlaying) {
                player.play();
            }
        }

        if (isPlaying) {
            player.play();
            // Start checking for duration to report back for the progress bar
            let checkInterval: NodeJS.Timeout;
            const checkDuration = () => {
                if (player.duration > 0) {
                    onDuration?.(player.duration * 1000);
                } else {
                    checkInterval = setTimeout(checkDuration, 100);
                }
            };
            checkDuration();
            return () => {
                if (checkInterval) clearTimeout(checkInterval);
            };
        } else {
            player.pause();
        }
    }, [isPlaying, player, type, player.status, onReady]); // Added onReady to deps

    if (type === 'video') {
        return (
            <View style={[styles.container, style]}>
                {/* 
                  Show a placeholder image while the video is not playing 
                  or if it's still loading to ensure UI feels immediate.
                */}
                {!isPlaying && (
                    <Image
                        source={{ uri }}
                        style={StyleSheet.absoluteFill}
                        contentFit={resizeMode}
                        transition={200}
                    />
                )}

                <VideoView
                    style={[StyleSheet.absoluteFill, { opacity: isPlaying ? 1 : 0 }]}
                    player={player}
                    contentFit={resizeMode === 'cover' ? 'cover' : 'contain'}
                    nativeControls={false}
                />

                {!isPlaying && (
                    <View style={[StyleSheet.absoluteFill, styles.inactiveOverlay]}>
                        <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.7)" />
                    </View>
                )}
            </View>
        );
    }

    return (
        <Image
            source={{ uri }}
            style={[styles.container, style]}
            contentFit={resizeMode}
            transition={300}
            onLoad={() => setIsImageLoaded(true)}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
    },
    inactiveOverlay: {
        backgroundColor: 'rgba(0,0,0,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default FilmMedia;
