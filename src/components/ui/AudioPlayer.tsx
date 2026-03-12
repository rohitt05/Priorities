import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import { BaseMediaProps, formatTime } from '@/types/mediaTypes';
import { COLORS, FONTS, SPACING } from '@/theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AudioPlayer({ 
    mediaItem, 
    autoPlay, 
    onReady,
    themeColor = '#000'
}: BaseMediaProps & { autoPlay?: boolean, onReady?: () => void, themeColor?: string }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const soundRef = useRef<Audio.Sound | null>(null);
    
    // Animation for pulses/waveform effect
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isPlaying) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    })
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isPlaying]);

    useEffect(() => {
        if (isPlaying && onReady) {
            onReady();
        }
    }, [isPlaying, onReady]);

    useEffect(() => {
        if (autoPlay && mediaItem.uri) {
            handlePlayPause();
        }
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

    const progressValue = duration > 0 ? (position / duration) * 100 : 0;

    return (
        <View style={styles.outerContainer}>
            <View style={styles.container}>
                {/* Minimal Label */}
                <Text style={[styles.title, { color: themeColor + '60' }]}>Voice Note</Text>

                {/* Modern Visualizer Circle */}
                <View style={styles.visualizerContainer}>
                    <Animated.View style={[
                        styles.pulseCircle,
                        { 
                            transform: [{ scale: pulseAnim }], 
                            opacity: isPlaying ? 0.15 : 0.05,
                            backgroundColor: themeColor
                        }
                    ]} />
                    <TouchableOpacity 
                        onPress={handlePlayPause} 
                        style={[styles.playButton, { backgroundColor: themeColor + '10' }]}
                    >
                        <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color={themeColor} />
                    </TouchableOpacity>
                </View>

                {/* Progress Bar Area */}
                <View style={styles.progressSection}>
                    <View style={styles.barContainer}>
                        <View style={styles.barBackground} />
                        <View style={[styles.barFill, { width: `${progressValue}%`, backgroundColor: themeColor }]} />
                    </View>
                    <View style={styles.timeRow}>
                        <Text style={[styles.timeLabel, { color: themeColor }]}>{formatTime(position)}</Text>
                        <Text style={[styles.timeLabel, { color: themeColor }]}>{formatTime(duration || mediaItem.durationSec || 0)}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    outerContainer: {
        width: '100%',
        alignItems: 'center',
    },
    container: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        borderRadius: 40,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
    },
    title: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 3,
        fontFamily: FONTS.bold,
        marginBottom: 35,
    },
    visualizerContainer: {
        width: 130,
        height: 130,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 35,
    },
    pulseCircle: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
    },
    playButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressSection: {
        width: '100%',
    },
    barContainer: {
        width: '100%',
        height: 3,
        borderRadius: 1.5,
        overflow: 'hidden',
        marginBottom: 8,
    },
    barBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    barFill: {
        height: '100%',
        borderRadius: 1.5,
    },
    timeRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    timeLabel: {
        fontSize: 11,
        fontFamily: FONTS.bold,
    }
});
