import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Image,
    Alert,
    Dimensions,
    ActivityIndicator,
    SafeAreaView,
    StatusBar
} from 'react-native';
import { CameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

const FilmMyDayScreen = () => {
    const router = useRouter();
    const cameraRef = useRef<CameraView>(null);

    // State
    const [facing, setFacing] = useState<CameraType>('back');
    const [flash, setFlash] = useState<FlashMode>('off');
    const [image, setImage] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    // Permissions
    const [permission, requestPermission] = useCameraPermissions();
    const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

    useEffect(() => {
        // Request permissions on mount if not determined
        if (!permission) {
            requestPermission();
        }
        if (!mediaPermission) {
            requestMediaPermission();
        }
    }, []);

    // 1. Loading State
    if (!permission || !mediaPermission) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    // 2. Permission Denied State
    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>We need your permission to show the camera</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
                    <Text style={styles.permissionButtonText}>Grant Permission</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <Text style={{ color: COLORS.primary, fontSize: 16 }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // 🔹 FUNCTION: Toggle Camera Facing
    const toggleCameraFacing = () => {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    };

    // 🔹 FUNCTION: Toggle Flash
    const toggleFlash = () => {
        setFlash(current => (current === 'off' ? 'on' : 'off'));
    };

    // 🔹 FUNCTION: Take Picture
    const takePicture = async () => {
        if (cameraRef.current && !isCapturing) {
            try {
                setIsCapturing(true);
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 1,
                    base64: false,
                    exif: false,
                    skipProcessing: true, // Faster capture
                });
                setImage(photo?.uri || null);
            } catch (error) {
                Alert.alert("Error", "Failed to take photo");
            } finally {
                setIsCapturing(false);
            }
        }
    };

    // 🔹 FUNCTION: Save Picture
    const savePicture = async () => {
        if (image) {
            try {
                if (mediaPermission?.status !== 'granted') {
                    await requestMediaPermission();
                }

                await MediaLibrary.saveToLibraryAsync(image);
                Alert.alert("Saved!", "Photo saved to your gallery.");
                setImage(null); // Return to camera
            } catch (error) {
                Alert.alert("Error", "Could not save photo.");
            }
        }
    };

    // ---------------------------------------------------------
    // RENDER: Preview Mode (After taking photo)
    // ---------------------------------------------------------
    if (image) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <Image source={{ uri: image }} style={styles.previewImage} />

                {/* Preview Overlay Controls */}
                <View style={styles.previewOverlay}>
                    <View style={styles.previewButtonsContainer}>
                        {/* Retake Button */}
                        <TouchableOpacity
                            style={[styles.actionButton, styles.retakeButton]}
                            onPress={() => setImage(null)}
                        >
                            <Feather name="trash-2" size={24} color="#FFF" />
                            <Text style={styles.actionText}>Retake</Text>
                        </TouchableOpacity>

                        {/* Save Button */}
                        <TouchableOpacity
                            style={[styles.actionButton, styles.saveButton]}
                            onPress={savePicture}
                        >
                            <Feather name="download" size={24} color="#FFF" />
                            <Text style={styles.actionText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    // ---------------------------------------------------------
    // RENDER: Camera Mode
    // ---------------------------------------------------------
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <CameraView
                style={styles.camera}
                facing={facing}
                flash={flash}
                ref={cameraRef}
            >
                {/* TOP BAR: Controls */}
                <SafeAreaView style={styles.topBar}>
                    {/* Back Button */}
                    <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                        <Feather name="x" size={28} color="#FFF" />
                    </TouchableOpacity>

                    {/* Flash Toggle */}
                    <TouchableOpacity onPress={toggleFlash} style={styles.iconButton}>
                        <Ionicons
                            name={flash === 'on' ? "flash" : "flash-off"}
                            size={26}
                            color={flash === 'on' ? "#FFD700" : "#FFF"}
                        />
                    </TouchableOpacity>
                </SafeAreaView>

                {/* BOTTOM BAR: Shutter & Flip */}
                <View style={styles.bottomBar}>
                    <View style={styles.bottomControls}>
                        {/* Spacer to center the shutter button */}
                        <View style={styles.sideControl}>
                            <TouchableOpacity style={styles.galleryButtonPlaceholder}>
                                <MaterialIcons name="photo-library" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        {/* Shutter Button */}
                        <TouchableOpacity
                            style={styles.shutterButtonOuter}
                            onPress={takePicture}
                            disabled={isCapturing}
                        >
                            <View style={[
                                styles.shutterButtonInner,
                                isCapturing && { backgroundColor: '#ccc' } // Visual feedback
                            ]} />
                        </TouchableOpacity>

                        {/* Flip Camera */}
                        <View style={styles.sideControl}>
                            <TouchableOpacity onPress={toggleCameraFacing} style={styles.iconButtonBlur}>
                                <Ionicons name="camera-reverse-outline" size={28} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </CameraView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        padding: 20,
    },
    permissionText: {
        color: '#FFF',
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 20,
        fontFamily: FONTS.medium,
    },
    permissionButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        marginBottom: 20,
    },
    permissionButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: FONTS.bold,
    },
    closeButton: {
        padding: 10,
    },

    // Camera Styles
    camera: {
        flex: 1,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10, // Adjust for Status Bar
    },
    iconButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },

    // Bottom Controls
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 40,
        paddingTop: 20,
        backgroundColor: 'rgba(0,0,0,0.2)', // Subtle gradient effect area
    },
    bottomControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    sideControl: {
        width: 50,
        alignItems: 'center',
    },
    galleryButtonPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    iconButtonBlur: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    shutterButtonOuter: {
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 4,
        borderColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shutterButtonInner: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: '#FFF',
    },

    // Preview Styles
    previewImage: {
        width: width,
        height: height,
        resizeMode: 'cover',
    },
    previewOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 50,
        paddingHorizontal: 30,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    previewButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
    },
    retakeButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    saveButton: {
        backgroundColor: COLORS.primary,
    },
    actionText: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: FONTS.bold,
        marginLeft: 8,
    }
});

export default FilmMyDayScreen;
