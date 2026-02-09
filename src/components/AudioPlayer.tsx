import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
// FIXED IMPORT PATH
import { BaseMediaProps, formatTime } from '../../types/mediaTypes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AudioPlayer({ mediaItem }: BaseMediaProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const soundRef = useRef<Audio.Sound | null>(null);

    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.stopAsync();
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    const handlePlayPause = async () => {
        try {
            if (!soundRef.current && mediaItem.uri) {
                const { sound } = await Audio.Sound.createAsync(
                    { uri: mediaItem.uri },
                    { shouldPlay: true },
                    (status: any) => {
                        if (status.isLoaded) {
                            setPosition(status.positionMillis / 1000);
                            setDuration(status.durationMillis / 1000);
                            if (status.didJustFinish) {
                                setIsPlaying(false);
                                setPosition(0);
                            }
                        }
                    }
                );
                soundRef.current = sound;
                setIsPlaying(true);
            } else if (soundRef.current) {
                const status = await soundRef.current.getStatusAsync();
                if (status.isLoaded) {
                    if (isPlaying) {
                        await soundRef.current.pauseAsync();
                        setIsPlaying(false);
                    } else {
                        await soundRef.current.playAsync();
                        setIsPlaying(true);
                    }
                }
            }
        } catch (error) { console.error(error); }
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
                <Ionicons name="musical-notes" size={80} color="#fff" style={{ opacity: 0.3, marginBottom: 20 }} />
                <Text style={styles.title}>{mediaItem.title || 'Audio Message'}</Text>
                <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.timeText}>{formatTime(position)} / {formatTime(duration || mediaItem.durationSec || 0)}</Text>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { width: SCREEN_WIDTH * 0.85, height: 400, borderRadius: 20, overflow: 'hidden' },
    gradient: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 30 },
    playButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    timeText: { fontSize: 16, fontWeight: '600', color: '#fff' }
});