import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Image,
    Alert,
    Dimensions,
    ActivityIndicator,
    StatusBar,
    Platform,
} from 'react-native';
import {
    CameraView,
    CameraType,
    FlashMode,
    useCameraPermissions,
    useMicrophonePermissions,
} from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics'; // Added for better UX
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/theme/theme';
import MediaPreview from '@/components/ui/MediaPreview';

import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    runOnJS,
} from 'react-native-reanimated';

const { width: screenWidth } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

// Optimized Types
type CapturedMedia = { uri: string; type: 'image' | 'video'; facing: CameraType };

const ZOOM_SENSITIVITY = 150; // Adjusted for smoother zoom
const MAX_ZOOM = 0.8; // Capped at 0.8 for stability
const MIN_ZOOM = 0;
const MIN_RECORDING_DURATION = 1000; // Minimum 1 second video

const FilmMyDayContent = () => {
    const router = useRouter();
    const { recipient } = useLocalSearchParams<{ recipient?: string }>();
    const cameraRef = useRef<CameraView>(null);

    // --- CAMERA STATE ---
    const [facing, setFacing] = useState<CameraType>('back');
    const [flash, setFlash] = useState<FlashMode>('off');
    const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture');
    const [zoom, setZoom] = useState(0);

    // --- CAPTURE STATE ---
    const [capturedMedia, setCapturedMedia] = useState<CapturedMedia | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);

    // --- LOGIC REFS ---
    const recordingTimer = useRef<NodeJS.Timeout | null>(null);
    const recordingStartTime = useRef<number>(0);
    const isPressingButton = useRef(false);
    const isRecordingRef = useRef(false);

    // --- GALLERY STATE ---
    const [recentAssets, setRecentAssets] = useState<MediaLibrary.Asset[]>([]);

    // --- FOCUS STATE (Visual) ---
    const [focusCoords, setFocusCoords] = useState<{ x: number; y: number } | null>(null);

    // --- PERMISSIONS ---
    const [permission, requestPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();
    const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

    // --- ANIMATED VALUES ---
    const buttonScale = useSharedValue(1);
    const currentZoom = useSharedValue(0);
    const startZoom = useSharedValue(0);
    const focusOpacity = useSharedValue(0);
    const focusScale = useSharedValue(1.5);

    // --- LIFECYCLE ---

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            } catch (e) { }
        })();
        return () => {
            mounted = false;
            ScreenOrientation.unlockAsync().catch(() => { });
        };
    }, []);

    useEffect(() => {
        if (!permission) requestPermission();
        if (!micPermission) requestMicPermission();
        if (!mediaPermission) requestMediaPermission();

        if (mediaPermission?.status === 'granted') {
            loadRecentAssets();
        }
    }, [mediaPermission?.status]);

    useEffect(() => {
        if (isRecording) {
            setRecordingDuration(0);
            recordingTimer.current = setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);
        } else {
            if (recordingTimer.current) clearInterval(recordingTimer.current);
            setRecordingDuration(0);
        }
        return () => {
            if (recordingTimer.current) clearInterval(recordingTimer.current);
        };
    }, [isRecording]);

    // Sync Reanimated value with State (only on mount/reset)
    useEffect(() => {
        currentZoom.value = zoom;
    }, []);

    // --- FUNCTIONS ---

    const loadRecentAssets = useCallback(async () => {
        try {
            const { assets } = await MediaLibrary.getAssetsAsync({
                first: 3,
                sortBy: [MediaLibrary.SortBy.creationTime],
                mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
            });
            setRecentAssets(assets);
        } catch (e) {
            console.log('Failed to load recent assets', e);
        }
    }, []);

    const getCurrentDate = () => {
        const now = new Date();
        const dayShort = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const date = now.getDate();
        const monthShort = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const yearShort = now.getFullYear().toString().slice(-2);
        return { dayShort, date, monthShort, yearShort };
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const toggleCameraFacing = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setFacing((c) => (c === 'back' ? 'front' : 'back'));
    }, []);

    const toggleFlash = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setFlash((c) => (c === 'off' ? 'on' : 'off'));
    }, []);

    // --- CAPTURE ---

    const takePicture = async () => {
        if (!cameraRef.current || isCapturing || isRecordingRef.current) return;

        // Ensure we are in picture mode
        if (cameraMode !== 'picture') {
            setCameraMode('picture');
            await new Promise(r => setTimeout(r, 50));
        }

        try {
            setIsCapturing(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: false,
                exif: true,
                skipProcessing: true, // Key for performance
            });

            // Directly set captured media. Mirroring happens visually in preview or during save.
            if (photo?.uri) {
                setCapturedMedia({ uri: photo.uri, type: 'image', facing });
            }
        } catch (e) {
            console.log('Photo Error:', e);
            Alert.alert('Error', 'Failed to capture image.');
        } finally {
            setIsCapturing(false);
        }
    };

    // --- ROBUST RECORDING LOGIC ---

    const startRecordingProcess = useCallback(async () => {
        if (!isPressingButton.current || isRecordingRef.current || isCapturing || !cameraRef.current) return;

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCameraMode('video');

        // Wait for mode switch
        setTimeout(async () => {
            if (!isPressingButton.current || !cameraRef.current) {
                setCameraMode('picture');
                return;
            }

            try {
                setIsRecording(true);
                isRecordingRef.current = true;
                recordingStartTime.current = Date.now();

                const video = await cameraRef.current.recordAsync({
                    maxDuration: 60,
                    mirror: facing === 'front',
                });

                if (video?.uri) {
                    setCapturedMedia({ uri: video.uri, type: 'video', facing });
                }
            } catch (e) {
                console.log('Recording Error:', e);
            } finally {
                setIsRecording(false);
                isRecordingRef.current = false;
                setCameraMode('picture');
                setZoom(0);
                currentZoom.value = 0;
            }
        }, 200);
    }, [facing, isCapturing]);

    const stopRecording = useCallback(async () => {
        if (!cameraRef.current || !isRecordingRef.current) return;

        const elapsedTime = Date.now() - recordingStartTime.current;

        if (elapsedTime < MIN_RECORDING_DURATION) {
            const remainingTime = MIN_RECORDING_DURATION - elapsedTime;
            setTimeout(() => {
                if (cameraRef.current) cameraRef.current.stopRecording();
            }, remainingTime);
        } else {
            cameraRef.current.stopRecording();
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }, []);

    // --- GESTURES ---

    // Optimized Zoom Handler
    const updateZoom = (newZoom: number) => {
        setZoom(newZoom);
    };

    const updateZoomFromGesture = (delta: number) => {
        'worklet';
        const rawZoom = delta / ZOOM_SENSITIVITY;
        const newZoom = Math.min(Math.max(rawZoom, 0), MAX_ZOOM);
        currentZoom.value = newZoom;
        runOnJS(updateZoom)(newZoom);
    };

    const shutterGesture = Gesture.Pan()
        .runOnJS(true)
        .onBegin(() => {
            isPressingButton.current = true;
            buttonScale.value = withSpring(1.2);

            setTimeout(() => {
                if (isPressingButton.current && !isRecordingRef.current) {
                    startRecordingProcess();
                }
            }, 300);
        })
        .onUpdate((e) => {
            if (isRecordingRef.current || isPressingButton.current) {
                // Dragging up (negative Y) increases zoom
                const dragDistance = -e.translationY;
                runOnJS(updateZoomFromGesture)(dragDistance);
            }
        })
        .onFinalize(() => {
            isPressingButton.current = false;
            buttonScale.value = withSpring(1.0);

            if (isRecordingRef.current) {
                stopRecording();
            } else {
                takePicture();
            }
        });

    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .runOnJS(true)
        .onEnd(() => {
            toggleCameraFacing();
        });

    const singleTapGesture = Gesture.Tap()
        .runOnJS(true)
        .onEnd((e) => {
            setFocusCoords({ x: e.x, y: e.y });
            focusOpacity.value = 1;
            focusScale.value = 1.3;
            focusScale.value = withSpring(1.0);
            setTimeout(() => {
                focusOpacity.value = withTiming(0, { duration: 500 });
            }, 1000);
        });

    const pinchGesture = Gesture.Pinch()
        .runOnJS(true)
        .onStart(() => {
            startZoom.value = currentZoom.value;
        })
        .onUpdate((e) => {
            const scaleChange = e.scale - 1;
            const newZoom = startZoom.value + (scaleChange * 0.5);
            const clamped = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);
            setZoom(clamped);
            currentZoom.value = clamped;
        });

    const tapGestures = Gesture.Exclusive(doubleTapGesture, singleTapGesture);
    const cameraAreaGesture = Gesture.Simultaneous(pinchGesture, tapGestures);

    // --- ANIMATED STYLES ---

    const animatedButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
    }));

    const animatedFocusStyle = useAnimatedStyle(() => ({
        opacity: focusOpacity.value,
        transform: [{ scale: focusScale.value }],
        left: (focusCoords?.x || 0) - 30,
        top: (focusCoords?.y || 0) - 30,
    }));

    // --- HELPERS ---

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsEditing: false,
                quality: 1,
            });
            if (!result.canceled) {
                const type = result.assets[0].type === 'video' ? 'video' : 'image';
                setCapturedMedia({ uri: result.assets[0].uri, type, facing: 'back' });
            }
        } catch (e) {
            Alert.alert('Error', 'Could not open gallery');
        }
    };

    const saveMedia = async () => {
        if (!capturedMedia) return;
        try {
            let uriToSave = capturedMedia.uri;

            // Perform manipulation ONLY when saving (keeps capture fast)
            if (capturedMedia.type === 'image' && capturedMedia.facing === 'front') {
                const manipulated = await ImageManipulator.manipulateAsync(
                    capturedMedia.uri,
                    [{ flip: ImageManipulator.FlipType.Horizontal }],
                    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
                );
                uriToSave = manipulated.uri;
            }

            await MediaLibrary.saveToLibraryAsync(uriToSave);
            Alert.alert('Saved!', 'Media saved to your gallery.');
            setCapturedMedia(null);
            loadRecentAssets();
        } catch (e) {
            Alert.alert('Error', 'Could not save media.');
        }
    };

    const handleDiscard = () => setCapturedMedia(null);
    const { dayShort, date, monthShort, yearShort } = getCurrentDate();

    // --- RENDERS ---

    if (!permission || !mediaPermission || !micPermission) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (!permission.granted || !micPermission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>We need camera and microphone permissions</Text>
                <TouchableOpacity
                    onPress={() => {
                        requestPermission();
                        requestMicPermission();
                    }}
                    style={styles.permissionButton}
                >
                    <Text style={styles.permissionButtonText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (capturedMedia) {
        return <MediaPreview
            capturedMedia={capturedMedia}
            isFrontCamera={capturedMedia.facing === 'front'}
            onDiscard={handleDiscard}
            onSave={saveMedia}
        />;
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <View style={styles.blackOverlay} />

            <View style={[styles.contentArea, { paddingTop: STATUS_BAR_HEIGHT }]}>

                {/* Header */}
                <View style={styles.topHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.transparentButton}>
                        <Ionicons name="chevron-back-outline" size={28} color="#FFF" />
                    </TouchableOpacity>

                    <View style={styles.dateContainer}>
                        <View style={styles.dateLeftColumn}>
                            <Text style={styles.dateDayText}>{dayShort}</Text>
                            <Text style={styles.dateMonthYearText}>{monthShort} {yearShort}</Text>
                        </View>
                        <Text style={styles.dateNumberText}>{date}</Text>
                    </View>

                    {recipient && (
                        <View style={styles.recipientContainer}>
                            <Text style={styles.sendingToText}>SENDING TO</Text>
                            <Text style={styles.recipientNameText}>{recipient.toUpperCase()}</Text>
                        </View>
                    )}

                    <TouchableOpacity onPress={toggleFlash} style={styles.transparentButton}>
                        <Ionicons
                            name={flash === 'on' ? 'flash' : 'flash-off'}
                            size={24}
                            color={flash === 'on' ? '#FFD700' : '#FFF'}
                        />
                    </TouchableOpacity>
                </View>

                {/* Camera View */}
                <View style={styles.cameraArea}>
                    <View style={styles.cameraFrame}>
                        <View style={styles.cameraCard}>
                            <GestureDetector gesture={cameraAreaGesture}>
                                <View style={styles.cameraTouchArea}>
                                    <CameraView
                                        ref={cameraRef}
                                        style={StyleSheet.absoluteFill}
                                        facing={facing}
                                        enableTorch={isRecording && flash === 'on'}
                                        flash={flash}
                                        mode={cameraMode}
                                        animateShutter={false}
                                        zoom={zoom}
                                        videoStabilizationMode="auto"
                                        videoQuality="720p" // Good balance of quality/performance
                                        responsiveOrientationWhenOrientationLocked
                                    />

                                    {/* Focus Square */}
                                    <Animated.View style={[styles.focusFrame, animatedFocusStyle]} />

                                    {/* Zoom Indicator */}
                                    {zoom > 0 && (
                                        <View style={styles.zoomIndicator}>
                                            <Text style={styles.zoomText}>{(zoom * 3 + 1).toFixed(1)}x</Text>
                                        </View>
                                    )}

                                    {/* Recording Timer (Top Center) */}
                                    {isRecording && (
                                        <View style={styles.recordingTimerBadge}>
                                            <View style={styles.recordingDot} />
                                            <Text style={styles.recordingText}>{formatDuration(recordingDuration)}</Text>
                                        </View>
                                    )}
                                </View>
                            </GestureDetector>
                        </View>

                        {/* Shutter Button (Floating) */}
                        <View style={styles.shutterContainerFloating}>
                            <GestureDetector gesture={shutterGesture}>
                                <Animated.View
                                    style={[
                                        styles.shutterButtonOuter,
                                        isRecording && styles.shutterRecordingOuter,
                                        animatedButtonStyle,
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.shutterButtonInner,
                                            isRecording && styles.shutterRecordingInner,
                                            isCapturing && { backgroundColor: '#ccc' },
                                        ]}
                                    />
                                </Animated.View>
                            </GestureDetector>
                        </View>
                    </View>

                    {/* Bottom Controls */}
                    <View style={styles.controlsBelow}>
                        <TouchableOpacity style={styles.galleryStackContainer} onPress={pickImage} activeOpacity={0.7}>
                            {recentAssets.length > 0 ? (
                                <>
                                    {recentAssets[2] && (
                                        <View style={[styles.stackLayer, styles.stackLayerBottom]}>
                                            <Image source={{ uri: recentAssets[2].uri }} style={styles.stackImage} />
                                        </View>
                                    )}
                                    {recentAssets[1] && (
                                        <View style={[styles.stackLayer, styles.stackLayerMiddle]}>
                                            <Image source={{ uri: recentAssets[1].uri }} style={styles.stackImage} />
                                        </View>
                                    )}
                                    <View style={styles.stackLayerTop}>
                                        <Image source={{ uri: recentAssets[0].uri }} style={styles.stackImage} />
                                    </View>
                                </>
                            ) : (
                                <View style={styles.galleryPlaceholder}>
                                    <MaterialIcons name="photo-library" size={24} color="#FFF" />
                                </View>
                            )}
                        </TouchableOpacity>

                        <View style={{ width: 44, height: 44 }} />

                        <TouchableOpacity onPress={toggleCameraFacing} style={styles.iconButtonBlur}>
                            <MaterialCommunityIcons name="rotate-360" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
};

export default function FilmMyDayScreen() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <FilmMyDayContent />
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    blackOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.85)' },
    contentArea: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
    permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 20 },
    permissionText: { color: '#FFF', fontSize: 18, textAlign: 'center', marginBottom: 20, fontFamily: FONTS.medium },
    permissionButton: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
    permissionButtonText: { color: '#FFF', fontSize: 16, fontFamily: FONTS.bold },

    topHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 },
    transparentButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    dateContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
    dateLeftColumn: { alignItems: 'flex-end', justifyContent: 'center', marginRight: 8, paddingTop: 6 },
    dateDayText: {
        fontSize: 26, fontFamily: FONTS.bold, fontWeight: '900', color: '#FFF',
        letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 26, marginBottom: -4,
    },
    dateMonthYearText: { fontSize: 10, fontFamily: FONTS.medium, color: 'rgba(255,255,255,0.7)', letterSpacing: 2, marginTop: 4 },
    dateNumberText: { fontSize: 48, fontFamily: FONTS.bold, fontWeight: '800', color: '#FFF', letterSpacing: -1, marginLeft: 2 },

    recipientContainer: {
        flex: 1,
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingHorizontal: 10,
        marginLeft: 20,
    },
    sendingToText: {
        fontSize: 8,
        fontFamily: FONTS.medium,
        color: 'rgba(255,255,255,0.6)',
        letterSpacing: 2,
        marginBottom: 2,
    },
    recipientNameText: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        color: '#FFF',
        letterSpacing: 3,
    },

    cameraArea: { flex: 1, marginBottom: 50 },
    cameraFrame: { flex: 1, position: 'relative' },
    cameraCard: { flex: 1, width: '100%', borderRadius: 20, overflow: 'hidden', backgroundColor: '#1a1a1a', position: 'relative' },
    cameraTouchArea: { flex: 1, width: '100%', height: '100%' },

    focusFrame: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderWidth: 1.5,
        borderColor: '#FFD700',
        borderRadius: 4,
        zIndex: 99,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
    },

    zoomIndicator: {
        position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, zIndex: 5,
    },
    zoomText: { color: '#FFF', fontFamily: FONTS.bold, fontSize: 12 },

    shutterContainerFloating: {
        position: 'absolute', alignSelf: 'center', bottom: -60, zIndex: 10,
        width: 120, height: 120, justifyContent: 'center', alignItems: 'center',
    },
    shutterButtonOuter: {
        width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: '#FFF',
        justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)',
    },
    shutterRecordingOuter: { borderColor: '#FF4040' },
    shutterButtonInner: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF' },
    shutterRecordingInner: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#FF4040' },

    controlsBelow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 36, paddingTop: 50 },
    galleryStackContainer: { width: 60, height: 60, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    stackLayer: { position: 'absolute', width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: '#FFF', backgroundColor: '#222', overflow: 'hidden' },
    stackLayerBottom: { transform: [{ rotate: '-12deg' }, { translateX: -4 }], opacity: 0.8, zIndex: 1 },
    stackLayerMiddle: { transform: [{ rotate: '12deg' }, { translateX: 4 }], opacity: 0.9, zIndex: 2 },
    stackLayerTop: { width: 50, height: 50, borderRadius: 10, borderWidth: 2, borderColor: '#FFF', backgroundColor: '#000', zIndex: 3, overflow: 'hidden' },
    stackImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    galleryPlaceholder: {
        width: 48, height: 48, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },

    recordingTimerBadge: {
        position: 'absolute',
        top: 20,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 0, 0, 0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        zIndex: 20,
    },
    recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF', marginRight: 6 },
    recordingText: { color: '#FFF', fontSize: 12, fontFamily: FONTS.bold },

    iconButtonBlur: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
});
