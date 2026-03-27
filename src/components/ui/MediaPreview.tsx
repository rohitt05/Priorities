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
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BackgroundProvider } from '@/contexts/BackgroundContext';
import * as MediaLibrary from 'expo-media-library';
import StoryTextOverlay, { StoryTextOverlayRef } from './StoryTextOverlay';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';

const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface MediaPreviewProps {
    capturedMedia: { uri: string; type: 'image' | 'video' } | null;
    isFrontCamera: boolean;
    onDiscard: () => void;
    onSave: () => void;
    recipient?: string; // name string passed from FilmMyDay
}

const MediaPreviewContent: React.FC<MediaPreviewProps> = ({
    capturedMedia,
    isFrontCamera,
    onDiscard,
    onSave,
    recipient,
}) => {
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false); // ✅ NEW: separate sending state
    const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const overlayRef = useRef<StoryTextOverlayRef>(null);
    const [isEditingText, setIsEditingText] = useState(false);

    const isMountedRef = useRef(true);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const isVideo = capturedMedia?.type === 'video';
    const videoSource = isVideo ? capturedMedia.uri : null;

    const player = useVideoPlayer(videoSource, (player) => {
        player.loop = true;
        player.muted = isMuted;
        player.volume = isMuted ? 0 : 1;
        if (videoSource) {
            player.play();
        }
    });

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

    useEffect(() => {
        if (!player || !isVideo) return;

        progressIntervalRef.current = setInterval(() => {
            if (!isMountedRef.current) return;
            try {
                if (player.status === 'readyToPlay') {
                    setCurrentTime(player.currentTime);
                    setDuration(player.duration);
                    if (!isVideoReady) setIsVideoReady(true);
                }
            } catch (error) {
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

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }
            if (player) {
                try { player.pause(); } catch (error) { }
                try { player.release(); } catch (error) { }
            }
        };
    }, [player]);

    useEffect(() => {
        const backAction = () => {
            onDiscard();
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [onDiscard]);

    // ✅ NEW: Upload media to Supabase and insert into messages table
    const sendToRecipient = async () => {
        if (!capturedMedia || !recipient) {
            // No recipient → fall back to original onSave (save to gallery)
            onSave();
            return;
        }

        setIsSending(true);
        try {
            // 1. Get logged-in user's UUID
            const { data: sessionData } = await supabase.auth.getSession();
            const senderId = sessionData?.session?.user?.id;
            if (!senderId) {
                Alert.alert('Error', 'You must be logged in to send media.');
                return;
            }

            // 2. Resolve recipient name → UUID from profiles table
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id')
                .eq('name', recipient)
                .single();

            if (profileError || !profileData?.id) {
                console.error('[MediaPreview] Could not find recipient profile:', profileError);
                Alert.alert('Error', `Could not find user "${recipient}".`);
                return;
            }
            const receiverId = profileData.id;

            // 3. Determine mime type and file extension
            const isVideoFile = capturedMedia.type === 'video';
            const mimeType = isVideoFile ? 'video/mp4' : 'image/jpeg';
            const ext = isVideoFile ? 'mp4' : 'jpg';
            const messageType = isVideoFile ? 'video' : 'photo';

            // 4. Build storage path: {senderId}/media/{timestamp}.ext
            // RLS: (storage.foldername(name))[1] = auth.uid() — first folder must be senderId
            const fileName = `${senderId}/media/${Date.now()}.${ext}`;

            // 5. Read file and upload to messages bucket
            const response = await fetch(capturedMedia.uri);
            const arrayBuffer = await response.arrayBuffer();

            const { error: uploadError } = await supabase.storage
                .from('messages')
                .upload(fileName, arrayBuffer, {
                    contentType: mimeType,
                    upsert: false,
                });

            if (uploadError) {
                console.error('[MediaPreview] Upload failed:', uploadError);
                Alert.alert('Error', 'Failed to upload media. Please try again.');
                return;
            }

            // 6. Create a 7-day signed URL (bucket is private)
            const { data: signedData, error: signedError } = await supabase.storage
                .from('messages')
                .createSignedUrl(fileName, 60 * 60 * 24 * 7);

            if (signedError || !signedData?.signedUrl) {
                console.error('[MediaPreview] Failed to get signed URL:', signedError);
                Alert.alert('Error', 'Failed to process media. Please try again.');
                return;
            }

            // 7. Insert into messages table
            const { error: insertError } = await supabase
                .from('messages')
                .insert({
                    sender_id: senderId,
                    receiver_id: receiverId,
                    type: messageType,
                    uri: signedData.signedUrl,
                    duration_sec: isVideoFile ? Math.round(duration) || null : null,
                    disappeared: false,
                });

            if (insertError) {
                console.error('[MediaPreview] Failed to insert message:', insertError);
                Alert.alert('Error', 'Failed to send message. Please try again.');
                return;
            }

            console.log('[MediaPreview] Sent successfully to', recipient, receiverId);
            Alert.alert('Sent!', `Your ${messageType} was sent to ${recipient.split(' ')[0]}.`);
            onDiscard(); // go back to camera after send
        } catch (err) {
            console.error('[MediaPreview] sendToRecipient error:', err);
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            if (isMountedRef.current) setIsSending(false);
        }
    };

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

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Main Media View */}
            <View style={[styles.cardContainer, { paddingTop: STATUS_BAR_HEIGHT + 10 }]}>
                <View style={styles.mediaCard}>
                    {isVideo ? (
                        <VideoView
                            style={[styles.mediaFill, mirrorStyle]}
                            player={player}
                            contentFit="cover"
                            nativeControls={false}
                            allowsFullscreen={false}
                            allowsPictureInPicture={false}
                        />
                    ) : (
                        <Image
                            source={{ uri: capturedMedia.uri }}
                            style={[styles.mediaFill, mirrorStyle]}
                            resizeMode="cover"
                        />
                    )}

                    <StoryTextOverlay
                        ref={overlayRef}
                        onOpenEditor={() => setIsEditingText(true)}
                        onCloseEditor={() => setIsEditingText(false)}
                        mediaUri={capturedMedia.uri}
                        mediaType={capturedMedia.type}
                    />
                </View>

                {isVideo && isVideoReady && !isEditingText && (
                    <View style={styles.videoControlsOverlay} pointerEvents="box-none">
                        <TouchableOpacity
                            style={styles.muteButton}
                            onPress={toggleMute}
                            activeOpacity={0.7}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <Ionicons
                                name={isMuted ? 'volume-mute' : 'volume-high'}
                                size={22}
                                color="#FFF"
                            />
                        </TouchableOpacity>

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
            </View>

            {/* Bottom Controls - Hide when editing */}
            {!isEditingText && (
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

                        {/* RIGHT GROUP: Edit + Download + Send Button */}
                        <View style={styles.rightGroup}>
                            {/* Edit Button */}
                            <TouchableOpacity
                                style={styles.editButton}
                                onPress={() => overlayRef.current?.startEditing()}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons name="format-text" size={24} color="#FFF" />
                            </TouchableOpacity>

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

                            {/* ✅ UPDATED: Send button now calls sendToRecipient */}
                            <TouchableOpacity
                                style={[styles.capsuleButton, isSending && { opacity: 0.6 }]}
                                onPress={sendToRecipient}
                                activeOpacity={0.7}
                                disabled={isSending}
                            >
                                {isSending ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.capsuleButtonText}>
                                        {recipient ? `Send ${recipient.split(' ')[0]}` : '+ Film of the Day'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
};

const MediaPreview: React.FC<MediaPreviewProps> = (props) => {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <BackgroundProvider>
                <MediaPreviewContent {...props} />
            </BackgroundProvider>
        </GestureHandlerRootView>
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
    videoControlsOverlay: {
        position: 'absolute',
        top: STATUS_BAR_HEIGHT + 26,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        zIndex: 2000,
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
    rightGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
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
    editButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#333',
    },
    capsuleButton: {
        height: 56,
        paddingHorizontal: 24,
        borderRadius: 28,
        borderWidth: 1.5,
        borderColor: '#FFF',
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    capsuleButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    captionDisplay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    captionGradient: {
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: Platform.OS === 'ios' ? 45 : 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    captionDisplayText: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        width: '100%',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    }
});

export default MediaPreview;