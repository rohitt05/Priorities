import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SharedValue } from 'react-native-reanimated';

interface TimelineVideoPreviewProps {
    uri: string;
    thumbnailUri: string;
    scrollY?: SharedValue<number>;
    style?: any;
}

export default function TimelineVideoPreview({ thumbnailUri, style }: TimelineVideoPreviewProps) {
    // Completely removing useVideoPlayer and native decoders from the timeline
    // This makes it ultra-lightweight and frees up all hardware decoders
    // ensuring the full screen modal plays flawlessly without stuttering.

    return (
        <View style={style}>
            {/* Show static cached thumbnail */}
            <Image
                source={{ uri: thumbnailUri }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                cachePolicy="memory-disk"
            />

            {/* Always show the little invisible play indicator overlay style that user had */}
            <View style={[styles.videoIndicator, { zIndex: 10 }]}>
                <Ionicons name="play" size={18} color="#FFF" style={styles.iconShadow} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    videoIndicator: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    iconShadow: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    }
});
