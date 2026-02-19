import React, { useEffect, useState, useRef } from 'react';
import {
    StyleSheet,
    View,
    TouchableOpacity,
    Image,
    StatusBar,
    Platform,
    BackHandler,
    Alert,
    ActivityIndicator,
    Text
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons, Feather } from '@expo/vector-icons';
import { BackgroundProvider } from '@/context/BackgroundContext';
import * as MediaLibrary from 'expo-media-library';
import SelectPriorities from '@/components/SelectPriorities';

const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface MediaPreviewProps {
    capturedMedia: { uri: string; type: 'image' | 'video' } | null;
    isFrontCamera: boolean;
    onDiscard: () => void;
    onSave: () => void;
}

const MediaPreviewContent: React.FC<MediaPreviewProps> = ({
    capturedMedia,
    isFrontCamera,
    onDiscard,
    onSave,
}) => {
    const [showSelectPriorities, setShowSelectPriorities] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isVideoReady, setIsVideoReady] = useState(false);

    // Use ref to track if component is mounted
    const isMountedRef = useRef(true);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const isVideo = capturedMedia?.type === 'video';
    const videoSource = isVideo ? capturedMedia.uri : null;

    // Create video player with optimized settings
    const player = useVideoPlayer(videoSource, (player) => {
        player.loop = true;
        player.muted = isMuted;
        player.volume = isMuted ? 0 : 1;

        if (videoSource) {
            player.play();
        }
    });

    // Pause video when navigating to SelectPriorities
    useEffect(() => {
        if (player && isVideo) {
            try {
                if (showSelectPriorities) {
                    player.pause();
                } else {
                    player.play();
                }
            } catch (error) {
                console.log('Player control error:', error);
            }
        }
    }, [showSelectPriorities, player, isVideo]);

    // Update player mute state when isMuted changes
    useEffect(() => {
        if (player && isVideo && isMountedRef.current) {
            try {
                player.muted = isMuted;
                player.volume = isMuted ? 0 : 1;
            } catch (error) {
                console.log('Player already released');
            }
        }
    }, [isMuted, player, isVideo]);

    // Track video progress for timeline
    useEffect(() => {
        if (!player || !isVideo) return;

        progressIntervalRef.current = setInterval(() => {
            if (!isMountedRef.current) return;

            try {
                if (player.status === 'readyToPlay') {
                    setCurrentTime(player.currentTime);
                    setDuration(player.duration);

                    if (!isVideoReady) {
                        setIsVideoReady(true);
                    }
                }
            } catch (error) {
                // Player has been released, clear interval
                if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                    progressIntervalRef.current = null;
                }
            }
        }, 100);

        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }
        };
    }, [player, isVideo, isVideoReady]);

    // Cleanup on unmount - ROBUST VERSION
    useEffect(() => {
        return () => {
            isMountedRef.current = false;

            // Clear interval first
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }

            // Then cleanup player with try-catch
            if (player) {
                try {
                    player.pause();
                } catch (error) {
                    // Player may already be released
                    console.log('Player pause skipped - already released');
                }

                try {
                    player.release();
                } catch (error) {
                    // Player may already be released
                    console.log('Player release skipped - already released');
                }
            }
        };
    }, [player]);

    useEffect(() => {
        const backAction = () => {
            if (showSelectPriorities) {
                setShowSelectPriorities(false);
                return true;
            }
            onDiscard();
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [onDiscard, showSelectPriorities]);

    const handleDownload = async () => {
        if (!capturedMedia) return;
        setIsSaving(true);
        try {
            if (!permissionResponse || permissionResponse.status !== 'granted') {
                const { status } = await requestPermission();
                if (status !== 'granted') {
                    Alert.alert("Permission required", "Please allow access to save media.");
                    setIsSaving(false);
                    return;
                }
            }
            const asset = await MediaLibrary.createAssetAsync(capturedMedia.uri);
            const albumName = "Priorities";
            const album = await MediaLibrary.getAlbumAsync(albumName);

            if (album == null) {
                await MediaLibrary.createAlbumAsync(albumName, asset, false);
            } else {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            }
            Alert.alert("Saved", "Saved to Priorities album!");
        } catch (error) {
            console.error("Save error:", error);
            Alert.alert("Error", "Could not save media.");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleMute = () => {
        setIsMuted(prev => !prev);
    };

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!capturedMedia) return null;

    const mirrorStyle = isFrontCamera ? { transform: [{ scaleX: -1 }] } : {};
    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

    if (showSelectPriorities) {
        return (
            <SelectPriorities
                capturedMedia={capturedMedia}
                isFrontCamera={isFrontCamera}
                onBack={() => setShowSelectPriorities(false)}
                onSent={(selectedIds) => {
                    console.log('Sent to priorities:', selectedIds);
                    setShowSelectPriorities(false);
                    onSave();
                }}
            />
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Main Media View */}
            <View style={[styles.cardContainer, { paddingTop: STATUS_BAR_HEIGHT + 10 }]}>
                <View style={styles.mediaCard}>
                    {isVideo ? (
                        <>
                            <VideoView
                                style={[styles.mediaFill, mirrorStyle]}
                                player={player}
                                contentFit="cover"
                                nativeControls={false}
                                allowsFullscreen={false}
                                allowsPictureInPicture={false}
                            />

                            {/* Video Controls Overlay - Bottom of Preview */}
                            {isVideoReady && (
                                <View style={styles.videoControlsOverlay}>
                                    {/* Mute/Unmute Button */}
                                    <TouchableOpacity
                                        style={styles.muteButton}
                                        onPress={toggleMute}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons
                                            name={isMuted ? 'volume-mute' : 'volume-high'}
                                            size={22}
                                            color="#FFF"
                                        />
                                    </TouchableOpacity>

                                    {/* Progress Bar and Time */}
                                    <View style={styles.progressContainer}>
                                        <View style={styles.progressBar}>
                                            <View
                                                style={[
                                                    styles.progressFill,
                                                    { width: `${progressPercentage}%` }
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.timeText}>
                                            {formatTime(currentTime)} / {formatTime(duration)}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </>
                    ) : (
                        <Image
                            source={{ uri: capturedMedia.uri }}
                            style={[styles.mediaFill, mirrorStyle]}
                            resizeMode="cover"
                        />
                    )}
                </View>
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
                <View style={styles.buttonsRow}>
                    {/* LEFT: Delete Button */}
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={onDiscard}
                        activeOpacity={0.7}
                    >
                        <Feather name="trash-2" size={24} color="#FF4040" />
                    </TouchableOpacity>

                    {/* RIGHT GROUP: Download + Forward */}
                    <View style={styles.rightGroup}>
                        {/* Download Button */}
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={handleDownload}
                            activeOpacity={0.7}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Ionicons name="download-outline" size={24} color="#FFF" />
                            )}
                        </TouchableOpacity>

                        {/* Forward Button */}
                        <TouchableOpacity
                            style={[styles.iconButton, styles.forwardButton]}
                            onPress={() => setShowSelectPriorities(true)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="arrow-forward" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
};

const MediaPreview: React.FC<MediaPreviewProps> = (props) => {
    return (
        <BackgroundProvider>
            <MediaPreviewContent {...props} />
        </BackgroundProvider>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000'
    },
    cardContainer: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 0,
        paddingBottom: 20
    },
    mediaCard: {
        flex: 1,
        width: '100%',
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
    },
    mediaFill: {
        width: '100%',
        height: '100%'
    },

    // Video Controls Overlay (Minimal Design - No Background Capsules)
    videoControlsOverlay: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    muteButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    progressBar: {
        flex: 1,
        height: 2.5,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 1.25,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#FFF',
        borderRadius: 1.25,
    },
    timeText: {
        fontSize: 12,
        color: '#FFF',
        fontWeight: '600',
        minWidth: 75,
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },

    // Controls Layout
    bottomControls: {
        paddingHorizontal: 24,
        paddingBottom: 50,
        paddingTop: 10,
        backgroundColor: '#000',
    },
    buttonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },

    // Right Side Grouping
    rightGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },

    // Button Styles
    deleteButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 64, 64, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 64, 64, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#333',
    },
    forwardButton: {
        backgroundColor: '#FFF',
    }
});

export default MediaPreview;
