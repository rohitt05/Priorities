// src/components/ui/MediaPreview.tsx
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
    Text,
    LayoutChangeEvent,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons, Feather } from '@expo/vector-icons';
import { BackgroundProvider } from '@/contexts/BackgroundContext';
import * as MediaLibrary from 'expo-media-library';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS } from '@/theme/theme';
import PostSuccessFlash from '@/components/ui/PostSuccessFlash';

const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface MediaPreviewProps {
    capturedMedia: { uri: string; type: 'image' | 'video' } | null;
    isFrontCamera: boolean;
    onDiscard: () => void;
    onSave: () => void;
    recipient?: string;
    recipientId?: string;
}

const MediaPreviewContent: React.FC<MediaPreviewProps> = ({
    capturedMedia,
    isFrontCamera,
    onDiscard,
    onSave,
    recipient,
    recipientId,
}) => {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showSuccessFlash, setShowSuccessFlash] = useState(false);
    const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const mediaCardRef = useRef<View>(null);

    const isMountedRef = useRef(true);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const isMessageMode = Boolean(recipient);
    const isVideo = capturedMedia?.type === 'video';
    const videoSource = isVideo ? capturedMedia.uri : null;

    const player = useVideoPlayer(videoSource, (player) => {
        player.loop = true;
        player.muted = isMuted;
        player.volume = isMuted ? 0 : 1;
        if (videoSource) player.play();
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
                try { player.pause(); } catch (e) { }
                try { player.release(); } catch (e) { }
            }
        };
    }, [player]);

    useEffect(() => {
        const backAction = () => { onDiscard(); return true; };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [onDiscard]);

    const handleCardLayout = (e: LayoutChangeEvent) => {};

    /**
     * Upload via fetch + ArrayBuffer — the only reliable method on React Native.
     * supabase-js .upload() with FormData silently fails on RN for binary files.
     */
    const uploadFileViaFetch = async (
        bucket: string,
        filePath: string,
        localUri: string,
        mimeType: string,
    ): Promise<boolean> => {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) {
                console.error('[Upload] No auth token');
                return false;
            }

            const supabaseUrl = 'https://olpnssfgzhpwrjiejfnr.supabase.co';

            // Read the file as a blob via fetch (works on RN with local file:// URIs)
            const fileResponse = await fetch(localUri);
            const blob = await fileResponse.blob();

            const uploadResponse = await fetch(
                `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': mimeType,
                        'x-upsert': 'false',
                    },
                    body: blob,
                }
            );

            if (!uploadResponse.ok) {
                const errText = await uploadResponse.text();
                console.error(`[Upload] Failed (${uploadResponse.status}):`, errText);
                return false;
            }

            return true;
        } catch (err) {
            console.error('[Upload] Exception:', err);
            return false;
        }
    };

    const sendAsMessage = async (senderId: string, finalUri: string) => {
        if (!capturedMedia || !recipient) return;

        // ── Resolve receiver ID ───────────────────────────────────────────
        let receiverId: string | null = null;
        if (recipientId) {
            receiverId = recipientId;
        } else {
            const { data, error } = await supabase
                .from('profiles')
                .select('id')
                .eq('name', recipient)
                .single();
            if (error || !data?.id) {
                Alert.alert('Error', `Could not find user "${recipient}".`);
                return;
            }
            receiverId = data.id;
        }

        const isVideoFile = capturedMedia.type === 'video';
        const mimeType = isVideoFile ? 'video/mp4' : 'image/jpeg';
        const ext = isVideoFile ? 'mp4' : 'jpg';
        const filePath = `${senderId}/media/${Date.now()}.${ext}`;

        // ── Upload using fetch+blob (reliable on React Native) ────────────
        const uploaded = await uploadFileViaFetch('messages', filePath, finalUri, mimeType);
        if (!uploaded) {
            Alert.alert('Error', 'Failed to upload media. Please try again.');
            return;
        }

        // ── Get signed URL ────────────────────────────────────────────────
        const { data: signedData, error: signedError } = await supabase.storage
            .from('messages')
            .createSignedUrl(filePath, 60 * 60 * 24 * 7);
        if (signedError || !signedData?.signedUrl) {
            Alert.alert('Error', 'Failed to process media. Please try again.');
            return;
        }

        // ── Insert into messages table ────────────────────────────────────
        const { error: insertError } = await supabase.from('messages').insert({
            sender_id: senderId,
            receiver_id: receiverId,
            type: isVideoFile ? 'video' : 'photo',
            uri: signedData.signedUrl,
            duration_sec: isVideoFile ? Math.round(duration) || null : null,
            disappeared: false,
            overlay_data: null,
        });
        if (insertError) {
            console.error('[sendAsMessage] Insert error:', insertError);
            Alert.alert('Error', 'Failed to send message. Please try again.');
            return;
        }

        setShowSuccessFlash(true);
    };

    const postAsFilm = async (senderId: string, finalUri: string) => {
        if (!capturedMedia) return;
        const isVideoFile = capturedMedia.type === 'video';
        const mimeType = isVideoFile ? 'video/mp4' : 'image/jpeg';
        const ext = isVideoFile ? 'mp4' : 'jpg';
        const fileName = `${senderId}/media/${Date.now()}.${ext}`;

        try {
            const uploaded = await uploadFileViaFetch('films', fileName, finalUri, mimeType);
            if (!uploaded) {
                Alert.alert('Error', 'Failed to upload film. Please try again.');
                return;
            }

            const { data: signedData, error: signedError } = await supabase.storage
                .from('films')
                .createSignedUrl(fileName, 60 * 60 * 24 * 30);
            if (signedError || !signedData?.signedUrl) {
                Alert.alert('Error', 'Failed to get signed URL.');
                return;
            }

            const { error: insertError } = await supabase.from('films').insert({
                creator_id: senderId,
                type: isVideoFile ? 'video' : 'image',
                uri: signedData.signedUrl,
                overlay_data: null,
            });
            if (insertError) {
                Alert.alert('Error', insertError.message);
                return;
            }

            setShowSuccessFlash(true);
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Something went wrong.');
        }
    };

    const handleSend = async () => {
        if (!capturedMedia) return;
        setIsSending(true);
        const finalUri = capturedMedia.uri;

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const senderId = sessionData?.session?.user?.id;
            if (!senderId) { Alert.alert('Error', 'You must be logged in.'); return; }

            if (isMessageMode) {
                await sendAsMessage(senderId, finalUri);
            } else {
                await postAsFilm(senderId, finalUri);
            }
        } catch (err) {
            console.error('[MediaPreview] handleSend error:', err);
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
                    Alert.alert('Permission required', 'Please allow access to save media.');
                    setIsSaving(false); return;
                }
            }
            const asset = await MediaLibrary.createAssetAsync(capturedMedia.uri);
            const albumName = 'Priorities';
            const album = await MediaLibrary.getAlbumAsync(albumName);
            if (album == null) {
                await MediaLibrary.createAlbumAsync(albumName, asset, false);
            } else {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            }
            Alert.alert('Saved', 'Saved to Priorities album!');
        } catch (error) {
            Alert.alert('Error', 'Could not save media.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFlashDismiss = () => {
        onDiscard();
        router.replace('/(tabs)');
    };

    const toggleMute = () => setIsMuted(prev => !prev);

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

            <View style={[styles.cardContainer, { paddingTop: STATUS_BAR_HEIGHT + 10 }]}>
                <View
                    style={styles.mediaCard}
                    ref={mediaCardRef}
                    collapsable={false}
                    onLayout={handleCardLayout}
                >
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
                </View>

                {isVideo && isVideoReady && (
                    <View style={styles.videoControlsOverlay} pointerEvents="box-none">
                        <TouchableOpacity
                            style={styles.muteButton}
                            onPress={toggleMute}
                            activeOpacity={0.7}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={22} color="#FFF" />
                        </TouchableOpacity>
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
                            </View>
                            <Text style={styles.timeText}>
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </Text>
                        </View>
                    </View>
                )}
            </View>

            <View style={styles.bottomControls}>
                <View style={styles.buttonsRow}>
                    <TouchableOpacity style={styles.deleteButton} onPress={onDiscard} activeOpacity={0.7}>
                        <Feather name="trash-2" size={24} color="#FF4040" />
                    </TouchableOpacity>

                    <View style={styles.rightGroup}>
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={handleDownload}
                            activeOpacity={0.7}
                            disabled={isSaving}
                        >
                            {isSaving
                                ? <ActivityIndicator size="small" color="#FFF" />
                                : <Ionicons name="download-outline" size={24} color="#FFF" />
                            }
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.capsuleButton, isSending && { opacity: 0.6 }]}
                            onPress={handleSend}
                            activeOpacity={0.7}
                            disabled={isSending}
                        >
                            {isSending
                                ? <ActivityIndicator size="small" color="#FFF" />
                                : <Text style={styles.capsuleButtonText}>
                                    {isMessageMode
                                        ? `Send ${recipient!.split(' ')[0]}`
                                        : '+ Film of the Day'
                                    }
                                </Text>
                            }
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {showSuccessFlash && (
                <PostSuccessFlash
                    isFilm={!isMessageMode}
                    recipientName={recipient?.split(' ')[0]}
                    onDismiss={handleFlashDismiss}
                />
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
    container: { flex: 1, backgroundColor: '#000' },
    cardContainer: { flex: 1, width: '100%', paddingHorizontal: 0, paddingBottom: 20 },
    mediaCard: {
        flex: 1, width: '100%', backgroundColor: '#1a1a1a',
        borderRadius: 20, overflow: 'hidden', position: 'relative',
    },
    mediaFill: { width: '100%', height: '100%' },
    videoControlsOverlay: {
        position: 'absolute', top: STATUS_BAR_HEIGHT + 26,
        left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 2000,
    },
    muteButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    progressContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    progressBar: {
        flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 1.25, overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 1.25 },
    timeText: {
        fontSize: 12, color: '#FFF', fontWeight: '600', minWidth: 75,
        textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
    },
    bottomControls: { paddingHorizontal: 24, paddingBottom: 50, paddingTop: 10, backgroundColor: '#000' },
    buttonsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
    rightGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    deleteButton: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: 'rgba(255,64,64,0.15)', borderWidth: 1,
        borderColor: 'rgba(255,64,64,0.3)', alignItems: 'center', justifyContent: 'center',
    },
    iconButton: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#333' },
    capsuleButton: {
        height: 56, paddingHorizontal: 24, borderRadius: 28,
        borderWidth: 1.5, borderColor: '#FFF', backgroundColor: 'transparent',
        alignItems: 'center', justifyContent: 'center',
    },
    capsuleButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
});

export default MediaPreview;
