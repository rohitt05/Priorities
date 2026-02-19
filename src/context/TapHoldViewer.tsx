import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { View, StyleSheet, Dimensions, Modal, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

import { PinchZoomProvider, usePinchZoom } from '@/context/PinchZoomContext';

const { width, height } = Dimensions.get('window');

type TapHoldContextType = {
    showImage: (uri: string) => void;
    hideImage: () => void;
};

const TapHoldContext = createContext<TapHoldContextType | undefined>(undefined);

const ZoomableImageContent = React.memo(({ uri }: { uri: string }) => {
    const { ZoomableHeader } = usePinchZoom();

    return (
        <ZoomableHeader style={{ flex: 1, width: '100%', height: '100%' }}>
            <ExpoImage
                source={uri}
                cachePolicy="memory-disk"
                style={styles.fullImage}
                contentFit="cover"
                transition={120}
            />
        </ZoomableHeader>
    );
});
ZoomableImageContent.displayName = 'ZoomableImageContent';

export const TapHoldProvider = ({ children }: { children: ReactNode }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [activeUri, setActiveUri] = useState<string | null>(null);

    const showImage = useCallback((uri: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        setModalVisible(true);

        // Defer heavy work to next frame
        requestAnimationFrame(() => {
            setActiveUri(uri);
            ExpoImage.prefetch(uri, { cachePolicy: 'memory-disk' }).catch(() => { });
        });
    }, []);

    const hideImage = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        setActiveUri(null);
        requestAnimationFrame(() => setModalVisible(false));
    }, []);

    const ctx = useMemo(() => ({ showImage, hideImage }), [showImage, hideImage]);

    return (
        <TapHoldContext.Provider value={ctx}>
            <PinchZoomProvider>
                {children}

                <Modal
                    visible={modalVisible}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                    onRequestClose={hideImage}
                >
                    <View style={styles.overlay}>
                        <TouchableWithoutFeedback onPress={hideImage}>
                            <View style={styles.backdrop} />
                        </TouchableWithoutFeedback>

                        <View style={styles.imageContainer} pointerEvents="box-none">
                            {activeUri ? <ZoomableImageContent uri={activeUri} /> : null}
                        </View>

                        <TouchableOpacity style={styles.closeButton} onPress={hideImage} activeOpacity={0.7}>
                            <View style={styles.closeIconWrapper}>
                                <Ionicons name="close" size={30} color="#FFFFFF" />
                            </View>
                        </TouchableOpacity>
                    </View>
                </Modal>
            </PinchZoomProvider>
        </TapHoldContext.Provider>
    );
};

export const TapHoldImage = ({ source, style }: { source: { uri: string }; style?: any }) => {
    const context = useContext(TapHoldContext);

    // Prefetch thumbnails as they mount
    React.useEffect(() => {
        ExpoImage.prefetch(source.uri, { cachePolicy: 'disk' }).catch(() => { });
    }, [source.uri]);

    if (!context) {
        return <ExpoImage source={source.uri} cachePolicy="disk" style={style} contentFit="cover" />;
    }

    const longPressGesture = Gesture.LongPress()
        .minDuration(350)
        .maxDistance(35)
        .onStart(() => {
            'worklet';
            runOnJS(context.showImage)(source.uri);
        });

    return (
        <GestureDetector gesture={longPressGesture}>
            <ExpoImage source={source.uri} cachePolicy="disk" style={style} contentFit="cover" />
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.93)' },
    imageContainer: {
        width: width - 24,
        height: height * 0.7,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: '#000',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    fullImage: { width: '100%', height: '100%' },
    closeButton: { position: 'absolute', bottom: 60, alignSelf: 'center', zIndex: 99999, elevation: 30 },
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
    },
});
