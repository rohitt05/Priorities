import React, { useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
    useAnimatedStyle, 
    useSharedValue, 
    withTiming 
} from 'react-native-reanimated';

interface FilmMediaProps {
    uri: string;
    type: 'image' | 'video';
    style?: any;
    resizeMode?: 'cover' | 'contain';
    isPlaying?: boolean;
    accent?: string;
}

const FilmMedia: React.FC<FilmMediaProps> = ({
    uri,
    type,
    style,
    resizeMode = 'cover',
    isPlaying = false,
    accent = '#fff',
}) => {
    const progress = useSharedValue(0);
    const progressOpacity = useSharedValue(1);
    // Always initialize the player for videos to enable pre-loading
    const player = useVideoPlayer(type === 'video' ? uri : null, (p) => {
        p.loop = true;
        p.muted = true;
        p.staysActiveInBackground = false;
        if (isPlaying) {
            p.play();
        }
    });

    useEffect(() => {
        if (type !== 'video') return;
        if (isPlaying) {
            player.play();
            // Show progress bar briefly then fade it
            progressOpacity.value = 1;
            progressOpacity.value = withTiming(0, { duration: 2500 });
        } else {
            player.pause();
            progressOpacity.value = withTiming(1, { duration: 300 });
        }
    }, [isPlaying, player, type]);

    // Use the player's timeUpdate listener to keep the progress bar updated
    useEffect(() => {
        const sub = player.addListener('timeUpdate', (payload) => {
            if (player.duration > 0) {
                progress.value = payload.currentTime / player.duration;
            }
        });
        return () => sub.remove();
    }, [player]);

    const barStyle = useAnimatedStyle(() => ({
        width: `${progress.value * 100}%`,
    }));

    const barContainerStyle = useAnimatedStyle(() => ({
        opacity: progressOpacity.value,
    }));

    if (type === 'video') {
        return (
            <View style={styles.container}>
                <VideoView
                    style={StyleSheet.absoluteFill}
                    player={player}
                    contentFit={resizeMode === 'cover' ? 'cover' : 'contain'}
                    nativeControls={false}
                />
                
                {/* Progress Bar */}
                <Animated.View style={[styles.progressContainer, barContainerStyle]}>
                    <View style={styles.progressBarTrack}>
                        <Animated.View style={[styles.progressBarFill, { backgroundColor: accent }, barStyle]} />
                    </View>
                </Animated.View>
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
    progressContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
    },
    progressBarTrack: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    progressBarFill: {
        height: '100%',
    },
});

export default FilmMedia;
