import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '@/theme/theme';
import AuthCanvas from '@/features/film-my-day/components/canvas/AuthCanvas';
import {
    buildDecoRectLayout,
    buildDecoCircleLayout,
} from '@/features/film-my-day/components/canvas/canvasUtils';


const decoRects = buildDecoRectLayout();
const decoCircles = buildDecoCircleLayout();
const ALL_DECO = [...decoRects, ...decoCircles];
const BG_COLORS: [string, string, string] = ['#FDFCF0', '#F7F4E9', '#E9DFB4'];


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
        <View style={{ flex: 1, backgroundColor: '#E9DFB4' }}>
            <AuthCanvas bgColors={BG_COLORS} decoItems={ALL_DECO}>

                {/* Top gradient fade */}
                <LinearGradient
                    colors={['rgba(255,255,255,0.82)', 'rgba(255,255,255,0.0)']}
                    locations={[0, 1]}
                    style={styles.topGradient}
                    pointerEvents="none"
                />

                {/* Content */}
                <View style={styles.container}>

                    {/* Icon */}
                    <View style={styles.iconRing}>
                        <Ionicons name="mail-unread-outline" size={36} color={COLORS.primary} />
                    </View>

                    {/* Heading */}
                    <Text style={styles.title}>{'check your\ninbox.'}</Text>

                    {/* Subtext */}
                    <Text style={styles.subtitle}>
                        we've sent a verification link to
                    </Text>
                    <Text style={styles.emailText}>{email}</Text>

                    <Text style={styles.body}>
                        open the email and tap the link to complete your sign up. come back here once you're verified.
                    </Text>

                </View>

                {/* Bottom actions */}
                <View style={styles.bottomBlock}>

                    {/* Resend link — sits above the button */}
                    <TouchableOpacity
                        style={styles.resendLink}
                        onPress={handleResend}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.resendText}>
                            Didn't get it?{'  '}
                            <Text style={styles.resendTextBold}>Resend email →</Text>
                        </Text>
                    </TouchableOpacity>

                    {/* Primary CTA */}
                    <TouchableOpacity
                        style={styles.button}
                        onPress={onSignInPress}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>GO TO SIGN IN</Text>
                    </TouchableOpacity>

                </View>

            </AuthCanvas>
        </View>
    );
};


const styles = StyleSheet.create({

    topGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: Platform.OS === 'ios' ? 160 : 140,
        zIndex: 1,
    },

    container: {
        flex: 1,
        paddingHorizontal: SPACING.xl,
        paddingTop: Platform.OS === 'ios' ? 120 : 100,
        zIndex: 2,
    },

    iconRing: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderWidth: 1.5,
        borderColor: 'rgba(44,39,32,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xl,
    },

    title: {
        fontSize: FONT_SIZES.xxl,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        letterSpacing: -1,
        lineHeight: 46,
        marginBottom: SPACING.xxl,
        textAlign: 'left',
    },

    subtitle: {
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.regular,
        color: 'rgba(44,39,32,0.5)',
        textAlign: 'left',
        marginBottom: SPACING.xs,
    },

    emailText: {
        fontSize: FONT_SIZES.md,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        textAlign: 'left',
        marginBottom: SPACING.lg,
    },

    body: {
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.regular,
        color: 'rgba(44,39,32,0.5)',
        textAlign: 'left',
        lineHeight: 22,
    },

    // ── Bottom block ──
    bottomBlock: {
        paddingHorizontal: SPACING.xl,
        paddingBottom: Platform.OS === 'ios' ? SPACING.xxl : SPACING.xl,
        gap: SPACING.md,
        zIndex: 2,
    },

    // Resend — flows above button in normal layout
    resendLink: {
        alignItems: 'center',
        paddingVertical: SPACING.sm,
    },
    resendText: {
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.regular,
        color: 'rgba(44,39,32,0.5)',
    },
    resendTextBold: {
        fontFamily: FONTS.semibold,
        color: COLORS.primary,
    },

    button: {
        backgroundColor: COLORS.primary,
        paddingVertical: 18,
        borderRadius: 999,
        alignItems: 'center',
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
        letterSpacing: 1.5,
    },
});


export default VerifyEmailScreen;