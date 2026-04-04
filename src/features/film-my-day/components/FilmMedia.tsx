import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import FilmVideoPlayer from './FilmVideoPlayer';

interface FilmMediaProps {
    uri: string;
    thumbnail?: string;
    type: 'image' | 'video';
    style?: any;
    resizeMode?: 'cover' | 'contain';
    isActive?: boolean;
    isPlaying?: boolean;
    isMuted?: boolean;
    onReady?: () => void;
    onDuration?: (durationMs: number) => void;
    onComplete?: () => void;
}

const FilmMedia: React.FC<FilmMediaProps> = ({
    uri,
    thumbnail,
    type,
    style,
    resizeMode = 'cover',
    isActive = false,
    isPlaying = false,
    isMuted = false,
    onReady,
    onDuration,
    onComplete,
}) => {
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    // Images: fire onReady immediately
    useEffect(() => {
        if (type === 'image') {
            onReadyRef.current?.();
        }
    }, [uri, type]);

    if (type === 'video') {
        // If it's a video but not active, render a lightweight thumbnail
        if (!isActive) {
             return (
                <View style={[styles.container, style]}>
                    {thumbnail ? (
                        <Image
                            source={{ uri: thumbnail }}
                            style={StyleSheet.absoluteFill}
                            contentFit={resizeMode === 'cover' ? 'cover' : 'contain'}
                            transition={300}
                        />
                    ) : (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1C1C1E' }]} />
                    )}
                </View>
             );
        }

        // Only mount the native video player when truly active
        return (
            <FilmVideoPlayer
                uri={uri}
                style={style}
                resizeMode={resizeMode}
                isPlaying={isPlaying}
                isMuted={isMuted}
                onReady={onReady}
                onDuration={onDuration}
                onComplete={onComplete}
            />
        );
    }

    return (
        <View style={[styles.container, style]}>
            <Image
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                contentFit={resizeMode === 'cover' ? 'cover' : 'contain'}
                transition={300}
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

export default FilmMedia;