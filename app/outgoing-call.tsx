import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, FONTS } from '@/theme/theme';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { declineCall } from '@/services/callService';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withDelay,
    Easing,
    interpolate
} from 'react-native-reanimated';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics'; // enums only
import { hapticManager } from '@/hooks/useHapticFeedback';
import {
    LiveKitRoom,
    useTracks,
    useLocalParticipant,
    VideoTrack,
    AudioSession,
} from '@livekit/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

export default function OutgoingCallScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        receiverId: string;
        receiverName: string;
        receiverPic: string;
        roomName: string;
        sessionId: string;
        callType: 'voice' | 'video';
        token: string;
        livekitUrl: string;
    }>();

    const [status, setStatus] = useState('ringing...');
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const ringAnim = useSharedValue(1);

    useEffect(() => {
        (async () => {
            const cameraStatus = await Camera.requestCameraPermissionsAsync();
            const audioStatus = await Audio.requestPermissionsAsync();
            setHasPermission(cameraStatus.granted && audioStatus.granted);
        })();
    }, []);

    useEffect(() => {
        if (!params.sessionId) return;

        // Visual ringing animation
        ringAnim.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        // Haptic ringing feedback loop
        const hapticInterval = setInterval(() => {
            hapticManager.impact(Haptics.ImpactFeedbackStyle.Light);
        }, 1500);

        const channel = supabase
            .channel(`call-status-${params.sessionId}`)
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
                    if (session.status === 'active') {
                        router.replace({
                            pathname: '/call-room' as any,
                            params: { ...params, isCaller: 'true' }
                        });
                    } else if (['declined', 'missed', 'ended'].includes(session.status)) {
                        router.back();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            clearInterval(hapticInterval);
        };
    }, [params.sessionId]);

    const handleEndCall = async () => {
        try {
            await declineCall(params.sessionId);
            router.back();
        } catch (err) {
            router.back();
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.receiverInfo}>
                        <Image source={{ uri: params.receiverPic }} style={styles.miniAvatar} />
                        <View>
                            <Text style={styles.name}>{params.receiverName || 'Priority User'}</Text>
                            <Text style={styles.statusText}>{status}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.closeBtn} onPress={handleEndCall}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Main View Area */}
                <View style={styles.centerArea}>
                    <Animated.View style={[styles.outerRing, useAnimatedStyle(() => {
                        return {
                            transform: [{ scale: ringAnim.value }],
                            opacity: interpolate(ringAnim.value, [1, 1.1], [0.3, 0.1])
                        };
                    })]} />

                    <View style={styles.previewCircle}>
                        {params.callType === 'video' ? (
                            hasPermission === true ? (
                                <LiveKitRoom
                                    serverUrl={params.livekitUrl}
                                    token={params.token}
                                    connect={true}
                                    video={true}
                                    audio={false} // Don't broadcast audio while ringing
                                >
                                    <LocalPreview />
                                </LiveKitRoom>
                            ) : hasPermission === false ? (
                                <View style={styles.errorBanner}>
                                    <Ionicons name="videocam-off" size={40} color="rgba(255,255,255,0.4)" />
                                    <Text style={styles.errorSubText}>Camera access required</Text>
                                </View>
                            ) : (
                                <View style={styles.previewPlaceholder} />
                            )
                        ) : (
                            <Image source={{ uri: params.receiverPic }} style={styles.largeAvatar} />
                        )}
                    </View>
                </View>

                {/* Footer Controls */}
                <View style={styles.footer}>
                    <View style={styles.callTypeIndicator}>
                        <Feather
                            name={params.callType === 'video' ? 'video' : 'phone'}
                            size={20}
                            color="rgba(255,255,255,0.6)"
                        />
                        <Text style={styles.callTypeText}>
                            {params.callType === 'video' ? 'Video Call' : 'Voice Call'}
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.endBtn} onPress={handleEndCall}>
                        <Ionicons name="call" size={32} color="#fff" style={styles.endIcon} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

function LocalPreview() {
    // Current SDK might expect objects or specific types for sources
    const tracks = useTracks([{ source: 'camera' as any, withPlaceholder: false }]);
    const localTrack = tracks.find(t => t.participant.isLocal);

    if (!localTrack || !localTrack.publication) {
        return <View style={styles.previewPlaceholder} />;
    }

    return (
        <VideoTrack
            // @ts-ignore - Some versions have slight mismatches between useTracks output and VideoTrack input
            trackRef={localTrack}
            style={styles.localVideo}
        />
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    content: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 25 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20
    },
    receiverInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15
    },
    miniAvatar: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    name: { fontFamily: FONTS.bold, fontSize: 18, color: '#fff' },
    statusText: { fontFamily: FONTS.regular, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    centerArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    outerRing: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 140,
        borderWidth: 20,
        borderColor: COLORS.primary,
    },
    previewCircle: {
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: '#1a1a1a',
        overflow: 'hidden',
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.15)',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20
    },
    largeAvatar: {
        width: '100%',
        height: '100%',
        opacity: 0.8
    },
    localVideo: {
        width: '100%',
        height: '100%'
    },
    previewPlaceholder: {
        flex: 1,
        backgroundColor: '#222'
    },
    errorBanner: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        padding: 20
    },
    errorSubText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontFamily: FONTS.medium,
        marginTop: 10,
        textAlign: 'center'
    },
    footer: {
        alignItems: 'center',
        marginBottom: 60,
        gap: 40
    },
    callTypeIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20
    },
    callTypeText: {
        fontFamily: FONTS.medium,
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 0.5
    },
    endBtn: {
        backgroundColor: '#FF3B30',
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#FF3B30',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15
    },
    endIcon: {
        transform: [{ rotate: '135deg' }]
    }
});