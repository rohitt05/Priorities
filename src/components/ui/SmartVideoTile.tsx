import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/theme/theme';

interface SmartVideoTileProps {
    uri: string;
    thumbUri?: string;
    isVisible: boolean;
    style?: any;
}

export default function SmartVideoTile({ uri, thumbUri, isVisible, style }: SmartVideoTileProps) {
    const player = useVideoPlayer(uri, player => {
        player.loop = true;
        player.muted = true;
    });

    const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

    useEffect(() => {
        if (isVisible) {
            player.play();
        } else {
            player.pause();
        }
    }, [isVisible, player]);

    return (
        <View style={[styles.container, style]}>
            {thumbUri && !isPlaying && (
                <Image source={{ uri: thumbUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            )}
            <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                nativeControls={false}
            />
            <View style={styles.badge}>
                <Ionicons name="play" size={10} color="#fff" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000',
        overflow: 'hidden'
    },
    badge: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    }
});
