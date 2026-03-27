// src/contexts/VoiceNoteRecordingContext.tsx

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    withRepeat,
    withDelay,
    Easing,
    SharedValue,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { FONTS } from '@/theme/theme';
import { supabase } from '@/lib/supabase';

export type RecordingRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type StartFromRefParams = {
    sourceId: string;   // receiver's UUID (item.id from PriorityCard)
    uri: string;        // receiver's profile picture URI (for overlay display)
};

type VoiceNoteRecordingContextType = {
    isActive: boolean;
    activeSourceId: string | null;
    startFromRef: (ref: React.RefObject<View | null>, params: StartFromRefParams) => void;
    updateDrag: (x: number) => void;
    endFromTranslationX: (x: number) => void;
};

const VoiceNoteRecordingContext = createContext<VoiceNoteRecordingContextType | undefined>(undefined);

const SWIPE_THRESHOLD = 80;

const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
};

export const VoiceNoteRecordingProvider = ({ children }: { children: React.ReactNode }) => {
    const [isActive, setIsActive] = useState(false);
    const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
    const [uri, setUri] = useState<string | null>(null);
    const [rect, setRect] = useState<RecordingRect | null>(null);

    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // ── expo-av recording ref ─────────────────────────────────
    const recordingRef = useRef<Audio.Recording | null>(null);

    const overlayOpacity = useSharedValue(0);
    const dragX = useSharedValue(0);

    // ==========================================
    // PULSE ANIMATION SHARED VALUES
    // ==========================================
    const pulse1 = useSharedValue(0);
    const pulse2 = useSharedValue(0);
    const pulse3 = useSharedValue(0);

    const startPulse = useCallback(() => {
        pulse1.value = 0;
        pulse2.value = 0;
        pulse3.value = 0;

        const config = { duration: 2500, easing: Easing.out(Easing.quad) };
        pulse1.value = withRepeat(withTiming(1, config), -1, false);
        pulse2.value = withDelay(800, withRepeat(withTiming(1, config), -1, false));
        pulse3.value = withDelay(1600, withRepeat(withTiming(1, config), -1, false));
    }, [pulse1, pulse2, pulse3]);

    const stopPulse = useCallback(() => {
        pulse1.value = 0;
        pulse2.value = 0;
        pulse3.value = 0;
    }, [pulse1, pulse2, pulse3]);

    const stopTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
    }, []);

    const startTimer = useCallback(() => {
        stopTimer();
        setRecordingSeconds(0);
        timerRef.current = setInterval(() => setRecordingSeconds(t => t + 1), 1000);
    }, [stopTimer]);

    useEffect(() => {
        return () => {
            stopTimer();
            stopPulse();
        };
    }, [stopTimer, stopPulse]);

    const clearStateAfterHide = useCallback(() => {
        setTimeout(() => {
            setIsActive(false);
            setActiveSourceId(null);
            setUri(null);
            setRect(null);
            dragX.value = 0;
            setRecordingSeconds(0);
        }, 200);
    }, [dragX]);

    // ── Start actual microphone recording ─────────────────────
    const startAudioRecording = useCallback(async () => {
        try {
            // Request mic permission
            const { granted } = await Audio.requestPermissionsAsync();
            if (!granted) {
                console.warn('[VoiceNote] Microphone permission denied');
                return;
            }

            // Configure audio session for recording
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            recordingRef.current = recording;
        } catch (err) {
            console.error('[VoiceNote] Failed to start recording:', err);
        }
    }, []);

    // ── Stop recording and return URI + duration ──────────────
    const stopAudioRecording = useCallback(async (): Promise<{ fileUri: string; durationSec: number } | null> => {
        const recording = recordingRef.current;
        if (!recording) return null;

        try {
            await recording.stopAndUnloadAsync();

            // Reset audio session back to playback mode
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

            const status = await recording.getStatusAsync();
            const durationSec = Math.round((status.durationMillis ?? 0) / 1000);
            const fileUri = recording.getURI() ?? '';

            recordingRef.current = null;
            return { fileUri, durationSec };
        } catch (err) {
            console.error('[VoiceNote] Failed to stop recording:', err);
            recordingRef.current = null;
            return null;
        }
    }, []);

    // ── Upload to Supabase Storage + insert messages row ──────
    // ── Upload to Supabase Storage ─────────────────────────────
    const uploadAndSend = useCallback(async (
        fileUri: string,
        durationSec: number,
        receiverId: string
    ) => {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const senderId = sessionData?.session?.user?.id;
            if (!senderId) {
                console.error('[VoiceNote] No authenticated user found');
                return;
            }

            // ✅ Path: {senderId}/voice-notes/{timestamp}.m4a
            // RLS policy checks (storage.foldername(name))[1] = auth.uid()
            // so the FIRST folder must be the senderId
            const fileName = `${senderId}/voice-notes/${Date.now()}.m4a`;

            // ✅ React Native safe way to read a local file:// URI for upload
            const response = await fetch(fileUri);
            const arrayBuffer = await response.arrayBuffer();

            const { error: uploadError } = await supabase.storage
                .from('messages')
                .upload(fileName, arrayBuffer, {
                    contentType: 'audio/m4a',
                    upsert: false,
                });

            if (uploadError) {
                console.error('[VoiceNote] Upload failed:', uploadError);
                return;
            }

            // 7-day signed URL (bucket is private)
            const { data: signedData, error: signedError } = await supabase.storage
                .from('messages')
                .createSignedUrl(fileName, 60 * 60 * 24 * 7);

            if (signedError || !signedData?.signedUrl) {
                console.error('[VoiceNote] Failed to get signed URL:', signedError);
                return;
            }

            const { error: insertError } = await supabase
                .from('messages')
                .insert({
                    sender_id: senderId,
                    receiver_id: receiverId,
                    type: 'voice',
                    uri: signedData.signedUrl,
                    duration_sec: durationSec,
                    disappeared: false,
                });

            if (insertError) {
                console.error('[VoiceNote] Failed to insert message:', insertError);
                return;
            }

            console.log('[VoiceNote] Sent successfully to', receiverId);
        } catch (err) {
            console.error('[VoiceNote] uploadAndSend error:', err);
        }
    }, []);
    const startFromRef = useCallback(
        (ref: React.RefObject<View | null>, params: StartFromRefParams) => {
            const node = ref.current as any;
            if (!node?.measureInWindow) return;

            node.measureInWindow((x: number, y: number, width: number, height: number) => {
                if (typeof x !== 'number' || typeof y !== 'number') return;

                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
                setIsActive(true);
                setActiveSourceId(params.sourceId);
                setUri(params.uri);
                setRect({ x, y, width, height });

                dragX.value = 0;
                overlayOpacity.value = withTiming(1, { duration: 180 });
                startTimer();
                startPulse();

                // ── Start the actual microphone ───────────────
                startAudioRecording();
            });
        },
        [dragX, overlayOpacity, startTimer, startPulse, startAudioRecording]
    );

    const updateDrag = useCallback((x: number) => {
        dragX.value = x;
    }, [dragX]);

    const finish = useCallback((result: 'send' | 'delete' | 'cancel') => {
        if (result === 'send') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        else if (result === 'delete') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });

        stopTimer();
        stopPulse();
        overlayOpacity.value = withTiming(0, { duration: 180 });
        dragX.value = withSpring(0);

        // ── Stop recording and handle result ──────────────────
        const receiverId = activeSourceId; // capture before clearStateAfterHide
        const duration = recordingSeconds;  // capture current seconds

        stopAudioRecording().then((audioResult) => {
            if (result === 'send' && audioResult && receiverId) {
                uploadAndSend(audioResult.fileUri, audioResult.durationSec || duration, receiverId);
            }
            // 'delete' and 'cancel' → recording is already stopped and discarded
        });

        clearStateAfterHide();
    },
        [activeSourceId, recordingSeconds, clearStateAfterHide, dragX, overlayOpacity,
            stopPulse, stopTimer, stopAudioRecording, uploadAndSend]
    );

    const endFromTranslationX = useCallback((x: number) => {
        if (x < -SWIPE_THRESHOLD) finish('delete');
        else if (x > SWIPE_THRESHOLD) finish('send');
        else finish('cancel');
    }, [finish]);

    const value = useMemo(() => ({
        isActive, activeSourceId, startFromRef, updateDrag, endFromTranslationX
    }), [isActive, activeSourceId, startFromRef, updateDrag, endFromTranslationX]);

    // ==========================================
    // OVERLAY & INTERACTION ANIMATIONS
    // ==========================================
    const containerStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
    const imageTranslateStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }] }));

    // --- LEFT ICON (DISCARD) ---
    const leftIconStyle = useAnimatedStyle(() => {
        const scale = interpolate(dragX.value, [0, -SWIPE_THRESHOLD], [0.9, 1.3], Extrapolation.CLAMP);
        const opacity = interpolate(dragX.value, [SWIPE_THRESHOLD / 2, 0, -SWIPE_THRESHOLD], [0, 0.4, 1], Extrapolation.CLAMP);
        return { transform: [{ scale }], opacity };
    });

    // --- RIGHT ICON (SEND) ---
    const rightIconStyle = useAnimatedStyle(() => {
        const scale = interpolate(dragX.value, [0, SWIPE_THRESHOLD], [0.9, 1.3], Extrapolation.CLAMP);
        const opacity = interpolate(dragX.value, [-SWIPE_THRESHOLD / 2, 0, SWIPE_THRESHOLD], [0, 0.4, 1], Extrapolation.CLAMP);
        return { transform: [{ scale }], opacity };
    });

    // --- BOTTOM INSTRUCTION TEXT FADE ---
    const instructionStyle = useAnimatedStyle(() => {
        const opacity = interpolate(Math.abs(dragX.value), [0, SWIPE_THRESHOLD], [1, 0.3], Extrapolation.CLAMP);
        return { opacity };
    });

    // ==========================================
    // PULSE / WAVE ANIMATION STYLES
    // ==========================================
    const createPulseStyle = (pulseValue: SharedValue<number>) => {
        return useAnimatedStyle(() => {
            const scale = interpolate(pulseValue.value, [0, 1], [1, 2.5], Extrapolation.CLAMP);
            const opacity = interpolate(pulseValue.value, [0, 0.2, 1], [0, 0.5, 0], Extrapolation.CLAMP);
            const dragFade = interpolate(Math.abs(dragX.value), [0, 40], [1, 0], Extrapolation.CLAMP);

            return {
                transform: [{ translateX: dragX.value }, { scale }],
                opacity: opacity * dragFade,
            };
        });
    };

    const pulse1Style = createPulseStyle(pulse1);
    const pulse2Style = createPulseStyle(pulse2);
    const pulse3Style = createPulseStyle(pulse3);

    return (
        <VoiceNoteRecordingContext.Provider value={value}>
            {children}

            {isActive && uri && rect && (
                <Animated.View style={[styles.globalOverlay, containerStyle]} pointerEvents="auto">

                    <ExpoImage
                        source={uri}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="cover"
                        blurRadius={100}
                    />
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.65)' }]} />

                    {/* Timer (Top Center) */}
                    <View style={[styles.timerContainer, { top: rect.y - 52 }]}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.timerText}>{formatTime(recordingSeconds)}</Text>
                    </View>

                    {/* Clean Action Icons (Left & Right) */}
                    <Animated.View style={[styles.iconWrapper, { left: 40, top: rect.y + rect.height / 2 - 28 }, leftIconStyle]}>
                        <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 59, 48, 0.8)' }]}>
                            <Feather name="trash-2" size={24} color="#FFF" />
                        </View>
                    </Animated.View>

                    <Animated.View style={[styles.iconWrapper, { right: 40, top: rect.y + rect.height / 2 - 28 }, rightIconStyle]}>
                        <View style={[styles.iconCircle, { backgroundColor: 'rgba(52, 199, 89, 0.8)' }]}>
                            <Feather name="send" size={24} color="#FFF" />
                        </View>
                    </Animated.View>

                    {/* Pulse Rings */}
                    <Animated.View style={[{
                        position: 'absolute',
                        left: rect.x, top: rect.y, width: rect.width, height: rect.height,
                        borderRadius: rect.width / 2, backgroundColor: 'rgba(255,255,255,0.4)'
                    }, pulse1Style]} pointerEvents="none" />

                    <Animated.View style={[{
                        position: 'absolute',
                        left: rect.x, top: rect.y, width: rect.width, height: rect.height,
                        borderRadius: rect.width / 2, backgroundColor: 'rgba(255,255,255,0.3)'
                    }, pulse2Style]} pointerEvents="none" />

                    <Animated.View style={[{
                        position: 'absolute',
                        left: rect.x, top: rect.y, width: rect.width, height: rect.height,
                        borderRadius: rect.width / 2, backgroundColor: 'rgba(255,255,255,0.2)'
                    }, pulse3Style]} pointerEvents="none" />

                    {/* Sharp Profile Image */}
                    <Animated.View style={[{
                        position: 'absolute',
                        left: rect.x,
                        top: rect.y,
                        width: rect.width,
                        height: rect.height,
                        borderRadius: rect.width / 2,
                        overflow: 'hidden',
                        borderWidth: 2,
                        borderColor: 'rgba(255,255,255,0.6)',
                    }, imageTranslateStyle]}
                    >
                        <ExpoImage source={uri} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    </Animated.View>

                    {/* Bottom Instructions */}
                    <Animated.View style={[styles.instructionsContainer, instructionStyle]}>
                        <View style={styles.instructionRow}>
                            <Feather name="chevron-left" size={16} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.instructionText}>Slide left to cancel</Text>
                        </View>
                        <View style={styles.instructionDivider} />
                        <View style={styles.instructionRow}>
                            <Text style={styles.instructionText}>Slide right to send</Text>
                            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
                        </View>
                    </Animated.View>

                </Animated.View>
            )}
        </VoiceNoteRecordingContext.Provider>
    );
};

export const useVoiceNoteRecording = () => {
    const ctx = useContext(VoiceNoteRecordingContext);
    if (!ctx) throw new Error('useVoiceNoteRecording must be used within VoiceNoteRecordingProvider');
    return ctx;
};

const styles = StyleSheet.create({
    globalOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999999,
        elevation: 999999,
    },
    timerContainer: {
        position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', marginRight: 8 },
    timerText: { color: '#FFF', fontSize: 16, fontFamily: FONTS.bold, fontVariant: ['tabular-nums'] },
    iconWrapper: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    instructionsContainer: {
        position: 'absolute',
        bottom: 80,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    instructionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    instructionText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontFamily: FONTS.medium,
        marginHorizontal: 8,
    },
    instructionDivider: {
        width: 1,
        height: 16,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
});