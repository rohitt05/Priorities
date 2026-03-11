import React, { useRef, useEffect, useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Animated,
    Easing,
    PanResponder,
    Vibration,
    Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '@/theme/theme';

// Calculate exact drag distance to the center of the side buttons
const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Padding (30) + Half of Button Width (25) = 55 from the edge
const MAX_DRAG = (SCREEN_WIDTH / 2) - 55;
const MERGE_THRESHOLD = MAX_DRAG * 0.85;

const VoiceNote = ({ onSend }: { onSend?: () => void }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);

    // Refs to track state inside PanResponder safely
    const isRecordingRef = useRef(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasMergedRef = useRef<string | null>(null);

    // Animations
    const expandAnim = useRef(new Animated.Value(0)).current;
    const pan = useRef(new Animated.ValueXY()).current;

    const ring1 = useRef(new Animated.Value(0)).current;
    const ring2 = useRef(new Animated.Value(0)).current;
    const ring3 = useRef(new Animated.Value(0)).current;

    // Fade side buttons and timer in/out
    useEffect(() => {
        Animated.spring(expandAnim, {
            toValue: isRecording ? 1 : 0,
            useNativeDriver: true,
            friction: 7,
            tension: 50,
        }).start();
    }, [isRecording]);

    // Live Timer
    useEffect(() => {
        if (isRecording) {
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setRecordingTime(0);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isRecording]);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `0${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Actions
    const startRecording = () => {
        isRecordingRef.current = true;
        setIsRecording(true);
        Vibration.vibrate(50); // Light buzz to confirm recording started
    };

    const cancelRecording = () => {
        isRecordingRef.current = false;
        setIsRecording(false);
        Vibration.vibrate([0, 50, 100, 50]); // Double buzz for trash
    };

    const handleSend = () => {
        isRecordingRef.current = false;
        setIsRecording(false);
        if (onSend) onSend();
    };

    const stopRecordingWithoutSending = () => {
        isRecordingRef.current = false;
        setIsRecording(false);
        Vibration.vibrate(50); // Light buzz to confirm recording stopped
        // Note: No onSend() called here, so the modal stays open!
    }

    // Advanced Drag Gesture
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                hasMergedRef.current = null;
                // Wait 200ms to register as a hold
                holdTimeoutRef.current = setTimeout(() => {
                    startRecording();
                }, 200);
            },
            onPanResponderMove: (_, gestureState) => {
                if (isRecordingRef.current) {
                    let newX = gestureState.dx;

                    // Cap the drag exactly at the side buttons
                    if (newX < -MAX_DRAG) newX = -MAX_DRAG;
                    if (newX > MAX_DRAG) newX = MAX_DRAG;

                    pan.setValue({ x: newX, y: 0 });

                    // Haptic feedback when the mic "merges" into the side button
                    if (newX <= -MERGE_THRESHOLD && hasMergedRef.current !== 'left') {
                        hasMergedRef.current = 'left';
                        Vibration.vibrate(50);
                    } else if (newX >= MERGE_THRESHOLD && hasMergedRef.current !== 'right') {
                        hasMergedRef.current = 'right';
                        Vibration.vibrate(50);
                    } else if (newX > -MERGE_THRESHOLD && newX < MERGE_THRESHOLD) {
                        hasMergedRef.current = null;
                    }
                } else {
                    // If they drag finger away before 200ms, cancel the hold
                    if (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10) {
                        if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
                    }
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);

                if (isRecordingRef.current) {
                    // Determine action based on where they let go
                    if (gestureState.dx <= -MERGE_THRESHOLD) {
                        cancelRecording(); // Swiped left completely
                    } else if (gestureState.dx >= MERGE_THRESHOLD) {
                        handleSend(); // Swiped right completely
                    } else {
                        // Simply released finger in the middle without completing a swipe
                        stopRecordingWithoutSending();
                    }

                    // Snap mic back to center
                    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
                }
            },
            onPanResponderTerminate: () => {
                if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
                if (isRecordingRef.current) {
                    cancelRecording();
                    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
                }
            }
        })
    ).current;

    // Mic Pulsing Loop
    useEffect(() => {
        const buildRingAnimation = (anim: Animated.Value, delay: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.parallel([
                        Animated.timing(anim, {
                            toValue: 1,
                            duration: 1600,
                            easing: Easing.out(Easing.ease),
                            useNativeDriver: true,
                        }),
                    ]),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ])
            );

        const a1 = buildRingAnimation(ring1, 0);
        const a2 = buildRingAnimation(ring2, 450);
        const a3 = buildRingAnimation(ring3, 900);

        a1.start();
        a2.start();
        a3.start();

        return () => {
            a1.stop();
            a2.stop();
            a3.stop();
        };
    }, []);

    const getRingStyle = (anim: Animated.Value) => ({
        transform: [{
            scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 2.4],
            }),
        }],
        opacity: anim.interpolate({
            inputRange: [0, 0.2, 1],
            outputRange: [0, 0.45, 0],
        }),
    });

    return (
        <View style={styles.container}>

            {/* ── TIMER (FLOATING ABOVE) ── */}
            <Animated.View style={[styles.timerContainer, {
                opacity: expandAnim,
                transform: [{ translateY: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }]
            }]}>
                <View style={styles.recordingDot} />
                <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
            </Animated.View>

            {/* ── DELETE BUTTON (LEFT) ── */}
            <Animated.View style={[styles.sideBtnContainer, {
                opacity: expandAnim,
                transform: [
                    { translateX: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                    // Scales up massively when mic is dragged toward it to look like it's eating the mic
                    { scale: pan.x.interpolate({ inputRange: [-MAX_DRAG, 0], outputRange: [1.6, 0.8], extrapolate: 'clamp' }) }
                ]
            }]}>
                <View style={[styles.actionBtn, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
                    <Feather name="trash-2" size={24} color="#FF3B30" />
                </View>
            </Animated.View>

            {/* ── CENTER MIC BUTTON (DRAGGABLE) ── */}
            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.micWrapper,
                    {
                        transform: [
                            { translateX: pan.x },
                            // Mic shrinks to NOTHING as it reaches the edges!
                            {
                                scale: pan.x.interpolate({
                                    inputRange: [-MAX_DRAG, -MERGE_THRESHOLD, 0, MERGE_THRESHOLD, MAX_DRAG],
                                    outputRange: [0.2, 0.6, 1, 0.6, 0.2],
                                    extrapolate: 'clamp'
                                })
                            }
                        ],
                        // Mic fades out as it merges!
                        opacity: pan.x.interpolate({
                            inputRange: [-MAX_DRAG, -MERGE_THRESHOLD, 0, MERGE_THRESHOLD, MAX_DRAG],
                            outputRange: [0, 0.5, 1, 0.5, 0],
                            extrapolate: 'clamp'
                        })
                    }
                ]}
            >
                <Animated.View style={[styles.ring, getRingStyle(ring1), isRecording && styles.recordingRing]} />
                <Animated.View style={[styles.ring, getRingStyle(ring2), isRecording && styles.recordingRing]} />
                <Animated.View style={[styles.ring, getRingStyle(ring3), isRecording && styles.recordingRing]} />

                <View style={[styles.iconCenter, isRecording && styles.iconCenterRecording]}>
                    <Feather name="mic" size={28} color={isRecording ? '#fff' : COLORS.primary} />
                </View>
            </Animated.View>

            {/* ── SEND BUTTON (RIGHT) ── */}
            <Animated.View style={[styles.sideBtnContainer, {
                opacity: expandAnim,
                transform: [
                    { translateX: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) },
                    // Scales up massively when mic is dragged toward it
                    { scale: pan.x.interpolate({ inputRange: [0, MAX_DRAG], outputRange: [0.8, 1.6], extrapolate: 'clamp' }) }
                ]
            }]}>
                <View style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}>
                    <Feather name="send" size={20} color="#fff" style={{ marginLeft: 2 }} />
                </View>
            </Animated.View>

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 30,
        height: 100,
        position: 'relative',
    },
    timerContainer: {
        position: 'absolute',
        top: -20,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF3B30',
        marginRight: 6,
    },
    timerText: {
        fontSize: 16,
        color: COLORS.text,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    sideBtnContainer: {
        width: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    micWrapper: {
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    ring: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    recordingRing: {
        borderColor: '#FF3B30',
    },
    iconCenter: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    iconCenterRecording: {
        backgroundColor: '#FF3B30',
    },
});

export default VoiceNote;
