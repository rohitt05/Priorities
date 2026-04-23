import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
    Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, FONTS, SPACING } from '@/theme/theme';

const { width } = Dimensions.get('window');

interface CustomAlertProps {
    visible: boolean;
    title: string;
    description: string;
    onCancel: () => void;
    onConfirm: () => void;
    cancelText?: string;
    confirmText?: string;
    isDestructive?: boolean;
}

export const CustomAlert = ({
    visible,
    title,
    description,
    onCancel,
    onConfirm,
    cancelText = 'cancel',
    confirmText = 'confirm',
    isDestructive = false,
}: CustomAlertProps) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.9,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none">
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onCancel}>
                    <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
                </Pressable>

                <Animated.View
                    style={[
                        styles.alertBox,
                        {
                            opacity: fadeAnim,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
                    <View style={styles.content}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.description}>{description}</Text>

                        <View style={styles.actions}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                style={styles.button}
                                onPress={onCancel}
                            >
                                <Text style={styles.cancelText}>{cancelText}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                activeOpacity={0.7}
                                style={[styles.button, styles.confirmButton, isDestructive && styles.destructiveButton]}
                                onPress={onConfirm}
                            >
                                <Text style={[styles.confirmText, isDestructive && styles.destructiveText]}>
                                    {confirmText}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    alertBox: {
        width: width * 0.85,
        borderRadius: 32,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.65)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    content: {
        padding: SPACING.xl,
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontFamily: FONTS.bold,
        fontWeight: '800',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: SPACING.sm,
        textTransform: 'lowercase',
    },
    description: {
        fontSize: 14,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: SPACING.xl,
        textTransform: 'lowercase',
    },
    actions: {
        flexDirection: 'row',
        width: '100%',
        gap: SPACING.md,
    },
    button: {
        flex: 1,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
    },
    confirmButton: {
        backgroundColor: COLORS.primary,
    },
    destructiveButton: {
        backgroundColor: 'rgba(180, 30, 30, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(180, 30, 30, 0.15)',
    },
    cancelText: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        fontWeight: '700',
        color: COLORS.textSecondary,
        textTransform: 'lowercase',
    },
    confirmText: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        fontWeight: '700',
        color: '#FFF',
        textTransform: 'lowercase',
    },
    destructiveText: {
        color: '#B41E1E',
    },
});
