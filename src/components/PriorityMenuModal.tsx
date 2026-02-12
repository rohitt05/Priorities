import React, { useRef, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Animated,
    Platform,
    Dimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { COLORS, FONTS } from '@/constants/theme';
// ✅ Import Context
import { useBackground } from '@/context/BackgroundContext';

const { width } = Dimensions.get('window');

interface PriorityMenuModalProps {
    visible: boolean;
    onClose: () => void;
    isPinned: boolean;
    onPin: () => void;
    onUnpin: () => void;
    userName: string;
}

const PriorityMenuModal = ({
    visible,
    onClose,
    isPinned,
    onPin,
    onUnpin,
    userName,
}: PriorityMenuModalProps) => {
    // 1. Get Dynamic Background from Context
    const { bgColor, prevBgColor, colorAnim } = useBackground();

    // 2. Interpolate background color exactly like the main screen
    const animatedSheetBg = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    // Start off-screen (translateY: 300)
    const slideAnim = useRef(new Animated.Value(300)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Animate In
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true, // Native driver works for transform
                    damping: 20,
                    mass: 0.8,
                    stiffness: 100,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            // Reset
            slideAnim.setValue(300);
            fadeAnim.setValue(0);
        }
    }, [visible, slideAnim, fadeAnim]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 300,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start(({ finished }) => {
            if (finished) onClose();
        });
    };

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={handleClose}
            hardwareAccelerated={true}
            statusBarTranslucent={true}
        >
            <View style={styles.overlay}>
                <TouchableWithoutFeedback onPress={handleClose}>
                    <Animated.View
                        style={[
                            StyleSheet.absoluteFill,
                            { backgroundColor: 'rgba(0,0,0,0.4)', opacity: fadeAnim }
                        ]}
                    />
                </TouchableWithoutFeedback>

                {/* Bottom Sheet Container */}
                <Animated.View
                    style={[
                        styles.sheetContainer,
                        {
                            transform: [{ translateY: slideAnim }]
                        }
                    ]}
                >
                    {/* ✅ DYNAMIC ANIMATED BACKGROUND LAYER */}
                    <Animated.View
                        style={[
                            StyleSheet.absoluteFill,
                            { backgroundColor: animatedSheetBg, opacity: 0.85 } // Slightly transparent to blend
                        ]}
                    />

                    {/* Glass Effect (iOS) or Plain Overlay (Android) */}
                    <View style={styles.blurWrapper}>
                        {Platform.OS === 'ios' && (
                            <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
                        )}

                        {/* Drag Handle */}
                        <View style={styles.handleContainer}>
                            <View style={styles.handle} />
                        </View>

                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>Options for {userName}</Text>
                        </View>

                        {/* Menu Items */}
                        <View style={styles.menuItems}>
                            {/* Pin / Unpin */}
                            <TouchableOpacity
                                style={styles.menuRow}
                                onPress={() => {
                                    if (isPinned) onUnpin();
                                    else onPin();
                                    handleClose();
                                }}
                            >
                                <View style={[styles.iconBox, isPinned ? styles.activeIconBox : {}]}>
                                    <MaterialCommunityIcons
                                        name={isPinned ? "pin-off" : "pin"}
                                        size={22}
                                        color={isPinned ? COLORS.background : COLORS.primary}
                                    />
                                </View>
                                <View style={styles.menuTextContainer}>
                                    <Text style={styles.menuLabel}>
                                        {isPinned ? "Unpin from Start" : "Pin to Start"}
                                    </Text>
                                    <Text style={styles.menuSubLabel}>
                                        {isPinned ? "Remove user from priority list" : "Keep user at front of list"}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            {/* View Profile */}
                            <TouchableOpacity style={styles.menuRow} onPress={handleClose}>
                                <View style={styles.iconBox}>
                                    <MaterialCommunityIcons name="account-circle-outline" size={22} color={COLORS.primary} />
                                </View>
                                <View style={styles.menuTextContainer}>
                                    <Text style={styles.menuLabel}>View Profile</Text>
                                    <Text style={styles.menuSubLabel}>See full details and history</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Cancel Button */}
                        <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        width: '100%',
        backgroundColor: COLORS.background, // Fallback
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 25,
    },
    blurWrapper: {
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(0,0,0,0.15)',
        borderRadius: 2,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontFamily: FONTS.bold,
        fontSize: 14,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        opacity: 0.7,
    },
    menuItems: {
        paddingHorizontal: 20,
    },
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(0,0,0,0.08)',
        marginLeft: 60,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.4)', // Semi-transparent white
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    activeIconBox: {
        backgroundColor: COLORS.primary,
    },
    menuTextContainer: {
        flex: 1,
    },
    menuLabel: {
        fontSize: 17,
        fontFamily: FONTS.medium,
        color: COLORS.primary,
        marginBottom: 2,
    },
    menuSubLabel: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
    },
    cancelButton: {
        marginTop: 20,
        marginHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    }
});

export default PriorityMenuModal;
