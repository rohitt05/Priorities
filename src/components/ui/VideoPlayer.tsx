import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Pressable,
    PanResponder,
    Animated,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { BaseMediaProps, formatTime } from '@/types/mediaTypes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.9;
const PROGRESS_BAR_WIDTH = CARD_WIDTH - 40;

interface VideoPlayerProps extends BaseMediaProps {
    isFocused?: boolean;
    autoPlay?: boolean;
    onReady?: () => void;
    themeColor?: string;
}

// ── Checks if a URI is actually playable by expo-video ───────────────────────
const isPlayableUri = (uri: string | undefined | null): boolean => {
    if (!uri) return false;
    return uri.startsWith('https://') || uri.startsWith('http://') || uri.startsWith('file://');
};

export default function VideoPlayer({ mediaItem, isFocused, autoPlay, onReady, themeColor = '#000' }: VideoPlayerProps) {

    // Guard: if URI isn't a valid playable URL, show error state immediately
    if (!isPlayableUri(mediaItem?.uri)) {
        console.warn('[VideoPlayer] Invalid or missing URI:', mediaItem?.uri, 'for item:', mediaItem?.id);
        return (
            <View style={[styles.container, styles.errorContainer]}>
                <Ionicons name="alert-circle-outline" size={40} color="rgba(255,255,255,0.6)" />
                <Text style={styles.errorText}>Video unavailable</Text>
            </View>
        );
    }

    // 1. Initialize Player
    const player = useVideoPlayer(mediaItem.uri!, player => {
        player.loop = true;
        player.timeUpdateEventInterval = 0.1;
        if (autoPlay) player.play();
    });

    const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

    useEffect(() => {
        if (isPlaying && onReady) {
            onReady();
        }
    }, [isPlaying, onReady]);

    // UI State
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [cardLayout, setCardLayout] = useState<{ width: number; height: number } | null>(null);

    const handleCardLayout = (e: any) => {
        const { width, height } = e.nativeEvent.layout;
        setCardLayout({ width, height });
    };

    // Animation & Timers
    const controlsOpacity = useRef(new Animated.Value(1)).current;
    const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

    const clearTimer = () => {
        if (hideControlsTimer.current) {
            clearTimeout(hideControlsTimer.current);
            hideControlsTimer.current = null;
        }
    };

    const startHideTimer = useCallback(() => {
        clearTimer();
        if (player.playing) {
            hideControlsTimer.current = setTimeout(() => {
                fadeOutControls();
            }, 3000);
        }
    }, [player.playing]);

    const fadeInControls = () => {
        setShowControls(true);
        Animated.timing(controlsOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true
        }).start(() => {
            startHideTimer();
        });
    };

    const fadeOutControls = () => {
        Animated.timing(controlsOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true
        }).start(() => {
            setShowControls(false);
        });
    };

    const toggleControls = () => {
        if (showControls) {
            fadeOutControls();
        } else {
            fadeInControls();
        }
    };

    // Listeners
    useEffect(() => {
        const subscription = player.addListener('timeUpdate', (event) => {
            if (!isScrubbing) {
                setCurrentTime(event.currentTime);
                if (player.duration > 0 && duration !== player.duration) {
                    setDuration(player.duration);
                }
            }
        });
        return () => {
            subscription.remove();
            clearTimer();
        };
    }, [player, isScrubbing, duration]);

    // Focus Handling
    useEffect(() => {
        if (!isFocused) {
            player.pause();
            setShowControls(true);
            controlsOpacity.setValue(1);
        } else {
            if (autoPlay) {
                player.play();
            }
            fadeInControls();
        }
    }, [isFocused, player, autoPlay]);

    useEffect(() => {
        if (isPlaying) {
            startHideTimer();
        } else {
            clearTimer();
            if (!showControls) {
                fadeInControls();
            }
        }
    }, [isPlaying]);

    const handlePlayPause = () => {
        if (isPlaying) {
            player.pause();
        } else {
            player.play();
        }
    };

    const handleScrubStart = () => {
        setIsScrubbing(true);
        clearTimer();
    };

    const handleScrubEnd = () => {
        setIsScrubbing(false);
        if (isPlaying) startHideTimer();
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: handleScrubStart,

            onPanResponderMove: (_, gestureState) => {
                const relativeX = gestureState.moveX - 20;
                let percentage = relativeX / PROGRESS_BAR_WIDTH;
                percentage = Math.max(0, Math.min(1, percentage));
                if (player.duration > 0) {
                    setCurrentTime(percentage * player.duration);
                }
            },

            onPanResponderRelease: (_, gestureState) => {
                const relativeX = gestureState.moveX - 20;
                let percentage = relativeX / PROGRESS_BAR_WIDTH;
                percentage = Math.max(0, Math.min(1, percentage));

                if (player.duration > 0) {
                    const newTime = percentage * player.duration;
                    player.currentTime = newTime;
                    setCurrentTime(newTime);
                }
                setTimeout(handleScrubEnd, 100);
            }
        })
    ).current;

    const progressPercent = (duration > 0 && currentTime > 0)
        ? (currentTime / duration) * 100
        : 0;

    return (
        <View style={styles.container} onLayout={handleCardLayout}>
            <VideoView
                player={player}
                style={styles.video}
                contentFit="cover"
                nativeControls={false}
            />

            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={toggleControls}
            >
                <Animated.View
                    style={[
                        styles.centerOverlay,
                        { opacity: controlsOpacity }
                    ]}
                    pointerEvents={showControls ? 'auto' : 'none'}
                >
                    <TouchableOpacity
                        onPress={handlePlayPause}
                        style={[styles.playButton, { backgroundColor: themeColor + '20', borderColor: themeColor }]}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={isPlaying ? "pause" : "play"}
                            size={50}
                            color={themeColor}
                            style={{ marginLeft: isPlaying ? 0 : 5 }}
                        />
                    </TouchableOpacity>
                </Animated.View>
            </Pressable>

            <Animated.View
                style={[
                    styles.controlsBottom,
                    { opacity: controlsOpacity }
                ]}
                pointerEvents={showControls ? 'box-none' : 'none'}
            >
                <View style={styles.timeContainer}>
                    <Text style={[styles.timeText, { color: themeColor }]}>{formatTime(currentTime)}</Text>
                    <Text style={[styles.timeText, { color: themeColor }]}>{formatTime(duration)}</Text>
                </View>

                <View
                    style={styles.progressBarContainer}
                    {...panResponder.panHandlers}
                    hitSlop={{ top: 20, bottom: 20 }}
                >
                    <View style={styles.progressBarTrack}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${progressPercent}%`, backgroundColor: themeColor }
                            ]}
                        />
                        <View
                            style={[
                                styles.scrubberKnob,
                                { left: `${progressPercent}%`, backgroundColor: themeColor }
                            ]}
                        />
                    </View>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    errorContainer: {
        gap: 12,
    },
    errorText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        fontWeight: '500',
    },
    video: {
        width: '100%',
        height: '100%',
        borderRadius: 32,
        overflow: 'hidden',
    },
    centerOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10
    },
    playButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)'
    },
    controlsBottom: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        zIndex: 20
    },
    timeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    timeText: {
        fontSize: 14,
        fontWeight: '700',
    },
    progressBarContainer: {
        height: 30,
        justifyContent: 'center'
    },
    progressBarTrack: {
        height: 4,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 2,
        position: 'relative'
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#fff',
        borderRadius: 2
    },
    scrubberKnob: {
        position: 'absolute',
        top: -6,
        marginLeft: -8,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#fff',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 2,
        elevation: 3
    }
});