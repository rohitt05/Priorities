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
                                sound?.setPositionAsync(0);
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
                        // If we are at the end, reset to beginning before playing
                        if (status.positionMillis >= (status.durationMillis || 0)) {
                            await soundRef.current.setPositionAsync(0);
                        }
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
            <BlurView intensity={40} tint="dark" style={styles.capsule}>
                
                {/* Play Button */}
                <TouchableOpacity 
                    onPress={handlePlayPause} 
                    activeOpacity={0.8}
                    style={styles.playBtn}
                >
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
                </TouchableOpacity>

                {/* Scrubber / Waveform area */}
                <View style={styles.scrubberContainer}>
                    <View style={styles.barContainer}>
                        <View style={styles.barBackground} />
                        <Animated.View style={[
                            styles.barFill, 
                            { width: `${progressValue}%` }
                        ]} />
                    </View>
                </View>

                {/* Time Indicator */}
                <Text style={styles.timeLabel}>
                    {formatTime(position)} / {formatTime(duration || mediaItem.durationSec || 0)}
                </Text>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    outerContainer: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    capsule: {
        flexDirection: 'row',
        alignItems: 'center',
        width: SCREEN_WIDTH * 0.85,
        height: 64,
        borderRadius: 32,
        paddingHorizontal: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    playBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    scrubberContainer: {
        flex: 1,
        justifyContent: 'center',
        marginRight: 12,
    },
    barContainer: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
        overflow: 'hidden',
    },
    barBackground: {
        ...StyleSheet.absoluteFillObject,
    },
    barFill: {
        height: '100%',
        borderRadius: 3,
        backgroundColor: '#fff',
    },
    timeLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontFamily: FONTS.bold,
        minWidth: 64,
        textAlign: 'right',
    },
});
