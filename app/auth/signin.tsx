import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Animated, Easing, Keyboard } from 'react-native';
import { signIn } from '@/services/authService';
import { router } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '@/theme/theme';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export default function SignInScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
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
            // Layout automatically catches session change
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Sign In Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <LinearGradient colors={['#FDFCF0', '#F7F4E9', '#E9DFB4']} style={StyleSheet.absoluteFillObject} />
            
            <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <View style={styles.header}>
                    <Text style={styles.title}>priorities.</Text>
                    <Text style={styles.subtitle}>Welcome back to your private space.</Text>
                </View>

                <View style={styles.card}>
                    <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
                    
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Email Address</Text>
                        <TextInput 
                            style={styles.input} 
                            placeholder="hello@example.com" 
                            placeholderTextColor="rgba(44,39,32,0.4)"
                            value={email} 
                            onChangeText={setEmail} 
                            autoCapitalize="none" 
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput 
                            style={styles.input} 
                            placeholder="••••••••" 
                            placeholderTextColor="rgba(44,39,32,0.4)"
                            value={password} 
                            onChangeText={setPassword} 
                            secureTextEntry 
                        />
                    </View>

                    <TouchableOpacity 
                        style={[styles.button, loading && { opacity: 0.7 }]} 
                        onPress={handleSignIn} 
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>{loading ? 'Accessing...' : 'Sign In'}</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.linkButton} onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/auth/signup');
                }}>
                    <Text style={styles.linkText}>Create a new account</Text>
                </TouchableOpacity>
            </Animated.View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: {
        flex: 1,
        paddingHorizontal: SPACING.xl,
        justifyContent: 'center',
    },
    header: {
        marginBottom: SPACING.xxl,
        alignItems: 'center',
    },
    title: { 
        fontSize: FONT_SIZES.xxl, 
        fontFamily: FONTS.bold, 
        color: COLORS.primary, 
        letterSpacing: -1.5,
        marginBottom: SPACING.sm,
    },
    subtitle: {
        fontSize: FONT_SIZES.md,
        fontFamily: FONTS.medium,
        color: COLORS.textSecondary,
        letterSpacing: 0.2,
    },
    card: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)',
        padding: SPACING.xl,
        backgroundColor: 'rgba(255,255,255,0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
    },
    inputContainer: {
        marginBottom: SPACING.lg,
    },
    label: {
        fontSize: 13,
        fontFamily: FONTS.semibold,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    input: { 
        borderBottomWidth: 1.5, 
        borderColor: 'rgba(44,39,32,0.15)', 
        paddingVertical: SPACING.md, 
        fontSize: FONT_SIZES.lg,
        fontFamily: FONTS.regular,
        color: COLORS.primary,
    },
    button: { 
        backgroundColor: COLORS.primary, 
        paddingVertical: 18, 
        borderRadius: 16, 
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
    linkButton: { 
        alignItems: 'center', 
        padding: SPACING.lg,
        marginTop: SPACING.xl,
    },
    linkText: { 
        color: COLORS.textSecondary, 
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.medium,
    }
});
