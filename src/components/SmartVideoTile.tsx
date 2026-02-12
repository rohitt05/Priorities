import React, { useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

interface SmartVideoTileProps {
    uri: string;
    thumbUri?: string;
    isVisible: boolean;
    style?: any;
}

const SmartVideoTile = React.memo(({ uri, thumbUri, isVisible, style }: SmartVideoTileProps) => {
    const videoRef = useRef<Video>(null);
    const [status, setStatus] = useState<any>({});
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (videoRef.current) {
            if (isVisible) {
                // Try to play silently
                videoRef.current.playAsync().catch(e => console.log("Play error", e));
            } else {
                // Pause and reset
                videoRef.current.pauseAsync().catch(e => console.log("Pause error", e));
            }
        }
    }, [isVisible]);

    return (
        <View style={[styles.container, style]}>
            <Video
                ref={videoRef}
                style={StyleSheet.absoluteFill}
                source={{ uri }}
                resizeMode={ResizeMode.COVER}
                isLooping
                isMuted={true}
                shouldPlay={isVisible} // Double insurance
                onLoad={() => setIsLoaded(true)}
                onError={(e) => console.log("Video Load Error:", e)}
            />

            {/* Thumbnail Overlay - Fades out when video is ready */}
            {(!isLoaded) && (
                <View style={StyleSheet.absoluteFill}>
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
        backgroundColor: '#000', // Black background
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
