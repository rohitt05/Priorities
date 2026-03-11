import React, { useRef, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/theme/theme';
import { useBackground } from '@/contexts/BackgroundContext';

export interface AnchorPosition {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface PriorityMenuModalProps {
    visible: boolean;
    onClose: () => void;
    isPinned: boolean;
    onPin: () => void;
    onUnpin: () => void;
    userName?: string;
    onMicPress?: () => void;
    anchor?: AnchorPosition | null;
}

const ARROW_SIZE = 7;

const PriorityMenuModal = ({
    visible,
    onClose,
    isPinned,
    onPin,
    onUnpin,
    anchor,
}: PriorityMenuModalProps) => {

    const { bgColor, prevBgColor, colorAnim } = useBackground();
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    const animatedModalBg = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                    damping: 18,
                    mass: 0.5,
                    stiffness: 220,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 120,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            scaleAnim.setValue(0.8);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 0.8,
                useNativeDriver: true,
                damping: 18,
                mass: 0.5,
                stiffness: 220,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 100,
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

    if (!visible || !anchor) return null;

    // 🔄 Render BELOW the dots button, horizontally aligned to its right edge
    // 🔄 increase the gap from 4 to 16 to push it further down
    const popoverTop = anchor.y + anchor.height + ARROW_SIZE + 46;

    const popoverRight = anchor.x + anchor.width + 40; // right-align to button's right edge

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            {/* Backdrop with opacity */}
            <TouchableWithoutFeedback onPress={handleClose}>
                <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]} />
            </TouchableWithoutFeedback>

            {/* Popover — positioned below the dots button */}
            <Animated.View
                style={[
                    styles.popoverWrapper,
                    {
                        top: popoverTop,
                        // right-align: position from left = right edge minus popover width
                        // we use position absolute with just top+left
                        left: popoverRight - styles.popoverWrapper.minWidth,
                        opacity: opacityAnim,
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            >
                {/* Arrow pointing UP toward the dots button */}
                <View style={styles.arrow} />

                {/* Card */}
                <Animated.View style={[styles.card, { backgroundColor: animatedModalBg }]}>
                    <View style={styles.cardTintOverlay} pointerEvents="none" />

                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handlePinPress}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons
                            name={isPinned ? 'pin-off' : 'pin'}
                            size={18}
                            color={COLORS.primary}
                            style={{ transform: [{ rotate: isPinned ? '0deg' : '20deg' }] }}
                        />
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    popoverWrapper: {
        position: 'absolute',
        minWidth: 44,   // just enough for icon + padding
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 12,
    },
    arrow: {
        alignSelf: 'flex-start',
        marginLeft: 4,
        marginBottom: -3,  // 🔄 pull arrow down to close the gap with the card
        width: 0,
        height: 0,
        borderLeftWidth: ARROW_SIZE,
        borderRightWidth: ARROW_SIZE,
        borderBottomWidth: ARROW_SIZE,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'rgba(255,255,255,0.96)',
        transform: [{ rotate: '-25deg' }],  // 🔄 slightly more tilt to follow the curve
    },


    card: {
        borderRadius: 25,
        overflow: 'hidden',
    },
    cardTintOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.75)',
    },
    actionButton: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        zIndex: 2,
    },
});

export default PriorityMenuModal;
