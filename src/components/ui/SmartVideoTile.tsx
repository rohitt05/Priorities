import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';          // ← expo-image, not react-native
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';

interface SmartVideoTileProps {
    uri?: string;       // actual video .mp4 URL
    thumbUri?: string;  // may be same as uri (mp4) — expo-image handles both
    isVisible: boolean;
    style?: any;
}

export default function SmartVideoTile({ uri, thumbUri, isVisible, style }: SmartVideoTileProps) {

    // Use thumbUri if it looks like an image, otherwise use the video uri directly.
    // expo-image can extract a poster frame from a video URL natively.
    const posterUri = thumbUri || uri;

    // Player only created with a real source when this tile is active
    const player = useVideoPlayer(isVisible && uri ? uri : null, p => {
        p.loop = true;
        p.muted = true;
    });

    useEffect(() => {
        if (isVisible) {
            player?.play();
        } else {
            player?.pause();
        }
    }, [isVisible, player]);

    return (
        <View style={[styles.container, style]} pointerEvents="none">

            {/* LAYER 1: expo-image as base — renders poster frame from video URL */}
            {posterUri ? (
                <Image
                    source={{ uri: posterUri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                />
            ) : (
                <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
            )}

            {/* LAYER 2: VideoView — ONLY when this tile is the active one */}
            {isVisible && uri && player && (
                <VideoView
                    player={player}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    nativeControls={false}
                    pointerEvents="none"
                />
            )}

            {/* LAYER 3: Play badge on inactive tiles */}
            {!isVisible && (
                <View style={styles.badge} pointerEvents="none">
                    <Ionicons name="play" size={10} color="#fff" />
                </View>
            )}

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#111',
        overflow: 'hidden',
    },
    placeholder: {
        backgroundColor: '#1e1e1e',
    },
    badge: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        // backgroundColor removed ✓
    },
});