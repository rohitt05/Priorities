import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '@/theme/theme';

interface VerifyEmailScreenProps {
    email: string;
    onSignInPress: () => void;
}

const VerifyEmailScreen: React.FC<VerifyEmailScreenProps> = ({ email, onSignInPress }) => {
    
    const handleResend = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            const { error } = await supabase.auth.resend({ type: 'signup', email });
            if (error) {
                Alert.alert('Could not resend', error.message);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Sent!', 'Verification email resent.');
            }
        } catch (err: any) {
            Alert.alert('Error', err.message);
        }
    };

    return (
        <View style={styles.verifyContainer}>
            <LinearGradient colors={['#FDFCF0', '#F7F4E9', '#E9DFB4']} style={StyleSheet.absoluteFillObject} />

            <Animated.View style={styles.verifyCard}>
                <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

                {/* Icon */}
                <View style={styles.verifyIconRing}>
                    <Ionicons name="mail-unread-outline" size={40} color={COLORS.primary} />
                </View>

                <Text style={styles.verifyTitle}>Check your inbox</Text>
                <Text style={styles.verifySubtitle}>
                    We've sent a verification link to
                </Text>
                <Text style={styles.verifyEmail}>{email}</Text>
                <Text style={styles.verifyBody}>
                    Open the email and tap the link to complete your sign up. Come back here once you're verified.
                </Text>

                <TouchableOpacity
                    style={styles.button}
                    onPress={onSignInPress}
                    activeOpacity={0.8}
                >
                    <Text style={styles.buttonText}>Go to Sign In</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleResend}
                    activeOpacity={0.7}
                >
                    <Text style={styles.resendText}>Resend email</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    verifyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
    },
    verifyCard: {
        width: '100%',
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)',
        padding: SPACING.xxl,
        backgroundColor: 'rgba(255,255,255,0.4)',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
    },
    verifyIconRing: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderWidth: 2,
        borderColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xl,
    },
    verifyTitle: {
        fontSize: FONT_SIZES.xl,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        letterSpacing: -0.5,
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    verifySubtitle: {
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    verifyEmail: {
        fontSize: FONT_SIZES.md,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        textAlign: 'center',
        marginTop: SPACING.xs,
        marginBottom: SPACING.lg,
    },
    verifyBody: {
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: SPACING.xxl,
        paddingHorizontal: SPACING.sm,
    },
    button: {
        backgroundColor: COLORS.primary,
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        width: '100%',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
    },
    buttonText: {
        color: COLORS.surface,
        fontFamily: FONTS.bold,
        fontSize: FONT_SIZES.md,
        letterSpacing: 1,
    },
    resendButton: {
        marginTop: SPACING.lg,
        padding: SPACING.md,
        alignItems: 'center',
    },
    resendText: {
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.medium,
        color: COLORS.textSecondary,
        textDecorationLine: 'underline',
    },
});

export default VerifyEmailScreen;
