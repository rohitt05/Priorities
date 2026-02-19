import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';

interface SmartVideoTileProps {
    uri: string;
    thumbUri?: string;
    isVisible: boolean;
    style?: any;
}

const SmartVideoTile = React.memo(({ uri, thumbUri, isVisible, style }: SmartVideoTileProps) => {
    // Initialize the player with the source
    const player = useVideoPlayer(uri, (player) => {
        player.loop = true;
        player.muted = true;
    });

    // Listen to the 'playing' status change
    const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

    // Manage playback based on visibility
    useEffect(() => {
        if (isVisible) {
            player.play();
        } else {
            player.pause();
        }
    }, [isVisible, player]);

    return (
        <View style={[styles.container, style]}>
            <VideoView
                style={StyleSheet.absoluteFill}
                player={player}
                nativeControls={false}
                allowsFullscreen={false}
                allowsPictureInPicture={false}
                contentFit="cover" // Replaces resizeMode="cover"
            />

            {/* Thumbnail Overlay - Fades out when video starts playing */}
            {(!isPlaying) && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Image
                        source={{ uri: thumbUri || uri }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                    />
                    <View style={styles.iconOverlay}>
                        <Ionicons name="videocam" size={16} color="white" />
                    </View>
                </View>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    iconOverlay: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 8,
        padding: 4
    }
});

export default SmartVideoTile;
