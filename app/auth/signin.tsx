// app/auth/signin.tsx

import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    Alert, KeyboardAvoidingView, Platform, Animated, Easing,
    Keyboard, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signIn } from '@/services/authService';
import { router } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '@/theme/theme';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import AuthCanvas from '@/features/film-my-day/components/canvas/AuthCanvas';
import {
    buildDecoRectLayout,
    buildDecoCircleLayout,
} from '@/features/film-my-day/components/canvas/canvasUtils';


const { height: SH } = Dimensions.get('window');

const decoRects = buildDecoRectLayout();
const decoCircles = buildDecoCircleLayout();
const decoItems = [...decoRects, ...decoCircles];

const BG_COLORS: [string, string, string] = ['#FDFCF0', '#F7F4E9', '#E9DFB4'];


export default function SignInScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1, duration: 600,
                useNativeDriver: true, easing: Easing.out(Easing.cubic),
            }),
            Animated.timing(slideAnim, {
                toValue: 0, duration: 600,
                useNativeDriver: true, easing: Easing.out(Easing.cubic),
            }),
        ]).start();
    }, []);

    const handleSignIn = async () => {
        if (!email || !password) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Keyboard.dismiss();
        setLoading(true);
        try {
            await signIn(email, password);
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Sign In Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthCanvas bgColors={BG_COLORS} decoItems={decoItems} defaultScale={1}>

            {/* ── TOP 30% HERO HEADER ── */}
            <View style={styles.heroArea} pointerEvents="none">
                <LinearGradient
                    colors={['rgba(255,255,255,0.92)', 'rgba(255,255,255,0.60)', 'rgba(255,255,255,0)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                />

                <View style={styles.appNameWrapper}>
                    <Text style={styles.appNameShadow} pointerEvents="none">
                        priorities.
                    </Text>
                    <Text style={styles.appName} pointerEvents="none">
                        priorities.
                    </Text>
                </View>

                <Text style={styles.tagline} pointerEvents="none">
                    for the people who matter
                </Text>
            </View>

            {/* ── FORM AREA ── */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.kavWrapper}
                keyboardVerticalOffset={0}
                pointerEvents="box-none"
            >
                <Animated.View
                    style={[
                        styles.content,
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                    ]}
                    pointerEvents="box-none"
                >
                    {/* Email */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label} pointerEvents="none">email address</Text>
                        <TextInput
                            style={[styles.input, styles.inputBorder]}
                            placeholder="hello@example.com"
                            placeholderTextColor={`${COLORS.primary}55`}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    {/* Password */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label} pointerEvents="none">password</Text>
                        <View style={styles.passwordRow}>
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="••••••••"
                                placeholderTextColor={`${COLORS.primary}55`}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setShowPassword(prev => !prev);
                                }}
                                style={styles.eyeButton}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color={`${COLORS.primary}99`}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Sign In button */}
                    <TouchableOpacity
                        style={[styles.button, loading && { opacity: 0.7 }]}
                        onPress={handleSignIn}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>
                            {loading ? 'Accessing...' : 'Sign In'}
                        </Text>
                    </TouchableOpacity>

                </Animated.View>
            </KeyboardAvoidingView>

            {/* ── LINK — outside KAV, pinned to screen bottom ── */}
            <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/auth/signup');
                }}
                activeOpacity={0.6}
            >
                <Text style={styles.linkText}>create a new account</Text>
                <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={COLORS.primary}
                    style={styles.linkArrow}
                />
            </TouchableOpacity>

        </AuthCanvas>
    );
}


const styles = StyleSheet.create({

    /* ── HERO HEADER ── */
    heroArea: {
        height: SH * 0.30,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: SPACING.xl * 2.5,
        overflow: 'hidden',
    },

    appNameWrapper: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },

    appNameShadow: {
        position: 'absolute',
        fontFamily: 'DancingScript-Bold',
        fontSize: 74,
        letterSpacing: -1,
        color: COLORS.primary,
        opacity: 0.20,
        transform: [{ translateX: 5 }, { translateY: 6 }],
    },

    appName: {
        fontFamily: FONTS.bold,
        fontSize: 60,
        letterSpacing: -1,
        color: COLORS.primary,
    },

    tagline: {
        fontFamily: FONTS.medium,
        fontSize: 11.5,
        color: COLORS.textSecondary,
        letterSpacing: 2.2,
        marginTop: SPACING.sm,
        opacity: 0.65,
        fontStyle: 'italic',
    },

    /* ── FORM ── */
    kavWrapper: {
        flex: 1,
        paddingBottom: Platform.OS === 'ios' ? 96 : 80,
    },

    content: {
        flex: 1,
        paddingHorizontal: SPACING.xl,
        justifyContent: 'center',
        paddingTop: SPACING.xl * 2,
    },

    inputContainer: {
        marginBottom: SPACING.lg,
    },

    label: {
        fontSize: 18,
        fontFamily: FONTS.semibold,
        color: COLORS.primary,
        marginBottom: SPACING.xs,
        letterSpacing: 0.8,
        opacity: 0.85,
    },

    input: {
        paddingVertical: SPACING.md,
        fontSize: FONT_SIZES.lg,
        fontFamily: FONTS.regular,
        color: COLORS.primary,
    },

    inputBorder: {
        borderBottomWidth: 1.5,
        borderColor: `${COLORS.primary}99`,
    },

    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1.5,
        borderColor: `${COLORS.primary}99`,
    },

    eyeButton: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.md,
        justifyContent: 'center',
        alignItems: 'center',
    },

    button: {
        backgroundColor: COLORS.primary,
        paddingVertical: 18,
        borderRadius: 999,
        alignItems: 'center',
        marginTop: SPACING.lg,
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

    /* ── LINK ── */
    linkButton: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 48 : 32,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: SPACING.md,
    },

    linkText: {
        color: COLORS.primary,
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.medium,
        opacity: 0.55,
    },

    linkArrow: {
        opacity: 0.55,
    },
});