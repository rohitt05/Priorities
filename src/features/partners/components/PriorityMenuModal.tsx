import React, { useRef, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/theme/theme';
import { useBackground } from '@/contexts/BackgroundContext';

interface PriorityMenuModalProps {
    visible: boolean;
    onClose: () => void;
    isPinned: boolean;
    onPin: () => void;
    onUnpin: () => void;
    userName?: string;
    onMicPress?: () => void;
}

const PriorityMenuModal = ({
    visible,
    onClose,
    isPinned,
    onPin,
    onUnpin,
}: PriorityMenuModalProps) => {

    const { bgColor, prevBgColor, colorAnim } = useBackground();
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    // The color interpolation (JS-driven, useNativeDriver: false in Context)
    const animatedModalBg = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    useNativeDriver: true, // Native driver for scale
                    damping: 20,
                    mass: 0.6,
                    stiffness: 200,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true, // Native driver for opacity
                }),
            ]).start();
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 0.85,
                useNativeDriver: true,
                damping: 20,
                mass: 0.6,
                stiffness: 200,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(({ finished }) => {
            if (finished) onClose();
        });
    };

    const handlePinPress = () => {
        if (isPinned) onUnpin();
        else onPin();
        handleClose();
    };

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <TouchableWithoutFeedback onPress={handleClose}>
                <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]} />
            </TouchableWithoutFeedback>

            <View style={styles.centeredWrapper} pointerEvents="box-none">

                {/* 
                  FIX: We separate the animations!
                  Outer view handles the NATIVE driver animations (scale and opacity).
                */}
                <Animated.View style={[
                    styles.cardWrapper,
                    {
                        opacity: opacityAnim,
                        transform: [{ scale: scaleAnim }],
                    }
                ]}>

                    {/* 
                      Inner view handles the JS driver animation (backgroundColor).
                      By keeping them on separate Animated.Views, React Native doesn't crash!
                    */}
                    <Animated.View style={[styles.card, { backgroundColor: animatedModalBg }]}>

                        <View style={styles.cardTintOverlay} pointerEvents="none" />

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={handlePinPress}
                            activeOpacity={0.7}
                        >
                            <MaterialCommunityIcons
                                name={isPinned ? 'pin-off' : 'pin'}
                                size={24}
                                color={COLORS.primary}
                                style={{ transform: [{ rotate: isPinned ? '0deg' : '20deg' }] }}
                            />
                            <Text style={[styles.actionText, { color: COLORS.primary }]}>
                                {isPinned ? 'Unpin' : 'Pin to top'}
                            </Text>
                        </TouchableOpacity>

                    </Animated.View>

                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    centeredWrapper: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardWrapper: {
        width: 220,
        borderRadius: 16,
        // Shadows must be on the wrapper so they don't get clipped
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 10,
    },
    card: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
    },
    cardTintOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 24,
        gap: 12,
        zIndex: 2,
    },
    actionText: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        letterSpacing: 0.5,
    },
});

export default PriorityMenuModal;
