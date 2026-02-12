import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View, Image, StyleSheet, Dimensions, Modal, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

// ✅ IMPORT PINCH ZOOM
import { PinchZoomProvider, usePinchZoom } from '@/context/PinchZoomContext';

const { width, height } = Dimensions.get('window');

interface TapHoldContextType {
    showImage: (uri: string) => void;
    hideImage: () => void;
}

const TapHoldContext = createContext<TapHoldContextType | undefined>(undefined);

// 🔹 INTERNAL COMPONENT: Consumes PinchZoom Context
const ZoomableImageContent = ({ uri }: { uri: string }) => {
    const { ZoomableHeader } = usePinchZoom();

    return (
        <ZoomableHeader style={{ flex: 1, width: '100%', height: '100%' }}>
            <Image
                source={{ uri }}
                style={styles.fullImage}
                resizeMode="cover"
            />
        </ZoomableHeader>
    );
};

// 1. PROVIDER
export const TapHoldProvider = ({ children }: { children: ReactNode }) => {
    const [activeUri, setActiveUri] = useState<string | null>(null);

    const showImage = (uri: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        setActiveUri(uri);
    };

    const hideImage = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        setActiveUri(null);
    };

    return (
        <TapHoldContext.Provider value={{ showImage, hideImage }}>
            {children}

            <Modal
                visible={!!activeUri}
                transparent={true}
                animationType="fade"
                statusBarTranslucent={true}
                onRequestClose={hideImage}
            >
                <View style={styles.overlay}>
                    {/* ✅ Backdrop - tap to close */}
                    <TouchableWithoutFeedback onPress={hideImage}>
                        <View style={styles.backdrop} />
                    </TouchableWithoutFeedback>

                    {/* ✅ Image Container */}
                    <View style={styles.imageContainer} pointerEvents="box-none">
                        {activeUri && (
                            // ✅ WRAP WITH PINCH ZOOM PROVIDER
                            <PinchZoomProvider>
                                <ZoomableImageContent uri={activeUri} />
                            </PinchZoomProvider>
                        )}
                    </View>

                    {/* ✅ CLOSE BUTTON */}
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={hideImage}
                        activeOpacity={0.7}
                    >
                        <View style={styles.closeIconWrapper}>
                            <Ionicons name="close" size={30} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                </View>
            </Modal>
        </TapHoldContext.Provider>
    );
};

// 2. COMPONENT
interface TapHoldImageProps {
    source: { uri: string };
    style?: any;
}

export const TapHoldImage = ({ source, style }: TapHoldImageProps) => {
    const context = useContext(TapHoldContext);

    if (!context) {
        return <Image source={source} style={style} />;
    }

    // ✅ Simple LongPress - only opens, does NOT close on release
    const longPressGesture = Gesture.LongPress()
        .minDuration(400)
        .maxDistance(50)
        .onStart(() => {
            'worklet';
            runOnJS(context.showImage)(source.uri);
        });

    return (
        <GestureDetector gesture={longPressGesture}>
            <Image source={source} style={style} />
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.93)',
    },
    imageContainer: {
        width: width - 24,
        height: height * 0.70,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: '#000',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    fullImage: {
        width: '100%',
        height: '100%',
    },
    closeButton: {
        position: 'absolute',
        bottom: 60,
        alignSelf: 'center',
        zIndex: 99999,
        elevation: 30,
    },
    closeIconWrapper: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    }
});
