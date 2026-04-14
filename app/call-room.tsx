import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, SafeAreaView, Image, AppState, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    LiveKitRoom,
    useTracks,
    VideoTrack,
    useRoomContext,
    TrackReference,
} from '@livekit/react-native';
import { VideoPresets } from 'livekit-client';
import { COLORS, FONTS } from '@/theme/theme';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { endCall } from '@/services/callService';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import PipHandler from 'react-native-pip-android';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PIP_WIDTH = 110;
const PIP_HEIGHT = 160;

export default function CallRoom() {
    const params = useLocalSearchParams<{
        token: string;
        livekitUrl: string;
        sessionId: string;
        callType: 'voice' | 'video';
        isCaller: 'true' | 'false';
        receiverId?: string;
        receiverName?: string;
        receiverPic?: string;
        callerId?: string;
        callerName?: string;
        callerPic?: string;
    }>();
    const router = useRouter();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    useEffect(() => {
        (async () => {
            const cameraStatus = await Camera.requestCameraPermissionsAsync();
            const audioStatus = await Audio.requestPermissionsAsync();
            setHasPermission(cameraStatus.granted && audioStatus.granted);
        })();
    }, []);

    useEffect(() => {
        if (!params.sessionId) return;
        const channel = supabase
            .channel(`call-room-status-${params.sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'call_sessions',
                    filter: `id=eq.${params.sessionId}`,
                },
                (payload) => {
                    const session = payload.new;
                    if (['ended', 'declined', 'missed'].includes(session.status)) {
                        cleanup();
                    }
                }
            )
            .subscribe();

        // Handle app-wide PiP when backgrounding
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'background' && params.callType === 'video' && hasPermission) {
                PipHandler.enterPipMode();
            }
        });

        return () => {
            supabase.removeChannel(channel);
            subscription.remove();
        };
    }, [params.sessionId, hasPermission]);

    const cleanup = () => {
        if (router.canGoBack()) {
            router.dismissAll();
        }
        router.replace('/(tabs)');
    };

    const handleDisconnect = async () => {
        try {
            await endCall(params.sessionId);
        } catch (e) {
            console.error('Error ending call:', e);
        }
        cleanup();
    };

    if (hasPermission === false) {
        return (
            <View style={styles.errorContainer}>
                <Ionicons name="warning" size={48} color="#FF3B30" />
                <Text style={[styles.errorText, { textAlign: 'center', marginTop: 10 }]}>
                    Camera or Microphone{"\n"}Permission Denied
                </Text>
                <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
                    <Text style={styles.backBtn}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!params.token || !params.livekitUrl || hasPermission === null) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                    {hasPermission === null ? 'Requesting hardware access...' : 'Missing call credentials'}
                </Text>
                {hasPermission !== null && (
                    <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
                        <Text style={styles.backBtn}>Return Home</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={styles.container}>
                <LiveKitRoom
                    serverUrl={params.livekitUrl}
                    token={params.token}
                    connect={true}
                    audio={true}
                    video={{
                        resolution: VideoPresets.h1080.resolution,
                    }}
                    onDisconnected={handleDisconnect}
                >
                    <RoomContent
                        callType={params.callType}
                        onHangup={handleDisconnect}
                        remoteName={params.receiverName || params.callerName}
                        remotePic={params.receiverPic || params.callerPic}
                        remoteId={params.receiverId || params.callerId}
                    />
                </LiveKitRoom>
            </SafeAreaView>
        </GestureHandlerRootView>
    );
}

function RoomContent({ callType, onHangup, remoteName, remotePic, remoteId }: {
    callType: string,
    onHangup: () => void,
    remoteName?: string,
    remotePic?: string,
    remoteId?: string
}) {
    const insets = useSafeAreaInsets();
    const tracks = useTracks([
        { source: 'camera' as any, withPlaceholder: false },
    ]);
    const room = useRoomContext();
    const localParticipant = room.localParticipant;
    const [isMicEnabled, setIsMicEnabled] = useState(localParticipant.isMicrophoneEnabled);
    const [isCameraEnabled, setIsCameraEnabled] = useState(localParticipant.isCameraEnabled);

    const localTrack = tracks.find(t => t.participant.isLocal);
    const remoteTrack = tracks.find(t => !t.participant.isLocal);

    // Draggable PiP State
    const translateX = useSharedValue(SCREEN_WIDTH - PIP_WIDTH - 20);
    const translateY = useSharedValue(SCREEN_HEIGHT - PIP_HEIGHT - 100);

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            translateX.value = event.absoluteX - PIP_WIDTH / 2;
            translateY.value = event.absoluteY - PIP_HEIGHT / 2;
        })
        .onEnd(() => {
            // Snap to nearest corner
            const snapX = translateX.value > SCREEN_WIDTH / 2 ? SCREEN_WIDTH - PIP_WIDTH - 20 : 20;
            translateX.value = withSpring(snapX);
            translateY.value = withSpring(translateY.value);
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
        ],
    }));

    const toggleMic = async () => {
        const enabled = !isMicEnabled;
        await localParticipant.setMicrophoneEnabled(enabled);
        setIsMicEnabled(enabled);
    };

    const toggleCamera = async () => {
        const enabled = !isCameraEnabled;
        await localParticipant.setCameraEnabled(enabled);
        setIsCameraEnabled(enabled);
    };

    const switchCamera = async () => {
        // @ts-ignore
        await localParticipant.switchCamera();
    };

    return (
        <View style={styles.roomContainer}>
            {/* Background: Remote Video */}
            <View style={styles.remoteContainer}>
                {remoteTrack ? (
                    <VideoTrack
                        // @ts-ignore
                        trackRef={remoteTrack}
                        style={styles.remoteVideo}
                        objectFit="cover"
                    />
                ) : (
                    <View style={styles.remotePlaceholder}>
                        <Image source={{ uri: remotePic }} style={styles.placeholderPic} />
                        <Text style={styles.waitingText}>Connecting to {remoteName}...</Text>
                    </View>
                )}
            </View>

            {/* Header Overlay - Uses Insets */}
            <View style={[styles.headerOverlay, { top: insets.top + 10 }]}>
                <View style={styles.participantChip}>
                    <Image source={{ uri: remotePic }} style={styles.chipAvatar} />
                    <Text style={styles.chipName}>{remoteName || 'Charlie'}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#fff" />
                </View>
                <TouchableOpacity style={styles.topRightIcon}>
                    <View style={styles.whiteCircle} />
                </TouchableOpacity>
            </View>

            {/* Draggable PIP Overlay: Local Video */}
            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.pipContainer, animatedStyle]}>
                    {isCameraEnabled && localTrack ? (
                        <View style={styles.pipVideoWrapper}>
                            <VideoTrack
                                // @ts-ignore
                                trackRef={localTrack}
                                style={styles.pipVideo}
                                objectFit="cover"
                                mirror={true}
                            />
                        </View>
                    ) : (
                        <View style={[styles.pipVideo, styles.pipPlaceholder]}>
                            <Feather name="video-off" size={24} color="#fff" />
                        </View>
                    )}
                </Animated.View>
            </GestureDetector>

            {/* Vertical Controls Overlay - Uses Insets */}
            <View style={[styles.verticalControls, { bottom: insets.bottom + 40 }]}>
                <TouchableOpacity
                    style={[styles.controlBtn, isCameraEnabled ? styles.btnActive : styles.btnInactive]}
                    onPress={toggleCamera}
                >
                    <Feather name={isCameraEnabled ? "video" : "video-off"} size={22} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.controlBtn, isMicEnabled ? styles.btnActiveMic : styles.btnInactive]}
                    onPress={toggleMic}
                >
                    <Feather name={isMicEnabled ? "mic" : "mic-off"} size={22} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlBtn} onPress={switchCamera}>
                    <Ionicons name="camera-reverse" size={24} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.hangupBtnLarge} onPress={onHangup}>
                    <Ionicons name="close" size={32} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    roomContainer: { flex: 1 },
    remoteContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#111' },
    remoteVideo: { flex: 1 },
    remotePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
    placeholderPic: { width: 120, height: 120, borderRadius: 60, opacity: 0.5 },
    waitingText: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontFamily: FONTS.medium },

    headerOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        zIndex: 100
    },
    participantChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 6,
        paddingRight: 12,
        borderRadius: 30,
        gap: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    chipAvatar: { width: 34, height: 34, borderRadius: 17 },
    chipName: { color: '#fff', fontFamily: FONTS.bold, fontSize: 15 },
    topRightIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    whiteCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff' },

    pipContainer: {
        position: 'absolute',
        width: PIP_WIDTH,
        height: PIP_HEIGHT,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#222',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.3)',
        zIndex: 200,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10
    },
    pipVideoWrapper: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden'
    },
    pipVideo: { flex: 1 },
    pipPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#333' },

    verticalControls: {
        position: 'absolute',
        right: 20,
        gap: 16,
        zIndex: 100,
    },
    controlBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    btnActive: { backgroundColor: '#4CD964' },
    btnActiveMic: { backgroundColor: '#FFCC00' },
    btnInactive: { backgroundColor: 'rgba(0,0,0,0.4)' },
    hangupBtnLarge: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
    },

    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    errorText: { color: COLORS.text, fontSize: 18, marginBottom: 20 },
    backBtn: { color: COLORS.primary, fontSize: 16, fontWeight: 'bold' },
});
