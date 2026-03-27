import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Keyboard, Easing } from 'react-native';
import { signUp } from '@/services/authService';
import { updateProfile, uploadProfilePicture, isHandleAvailable } from '@/services/profileService';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '@/theme/theme';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const PALETTE = Object.values(COLORS.PALETTE);

const STEPS = [
    { key: 'name', label: 'What should we call you?' },
    { key: 'handle', label: 'Pick a unique handle' },
    { key: 'email', label: 'Your email address' },
    { key: 'password', label: 'Create a password' },
    { key: 'birthday', label: 'When is your birthday?' },
    { key: 'picture', label: 'Add a beautiful photo' },
];

export default function SignUpScreen() {
    const [stepIndex, setStepIndex] = useState(0);
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState('');
    const [handle, setHandle] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [birthday, setBirthday] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);

    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const currentStepObj = STEPS[stepIndex];

    const pickImage = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setImageUri(result.assets[0].uri);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const animateTransition = (direction: 'next' | 'prev', callback: () => void) => {
        const offset = direction === 'next' ? -50 : 50;
        Keyboard.dismiss();
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: offset, duration: 200, useNativeDriver: true, easing: Easing.in(Easing.cubic) }),
        ]).start(() => {
            callback();
            slideAnim.setValue(direction === 'next' ? 50 : -50);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
            ]).start();
        });
    };

    const nextStep = async () => {
        if (loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        if (currentStepObj.key === 'name' && !name) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return Alert.alert('Required', 'Please enter your name');
        }
        if (currentStepObj.key === 'handle') {
            if (!handle) return Alert.alert('Required', 'Handle is required');
            setLoading(true);
            const available = await isHandleAvailable(handle).catch(() => false);
            setLoading(false);
            if (!available) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                return Alert.alert('Taken', 'This handle is already in use');
            }
        }
        if (currentStepObj.key === 'email' && (!email || !email.includes('@'))) return Alert.alert('Invalid', 'Valid email required');
        if (currentStepObj.key === 'password' && password.length < 6) return Alert.alert('Short', 'Password must be at least 6 characters');
        
        if (stepIndex < STEPS.length - 1) {
            animateTransition('next', () => setStepIndex(stepIndex + 1));
        } else {
            finalizeSignUp();
        }
    };

    const prevStep = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (stepIndex > 0) {
            animateTransition('prev', () => setStepIndex(stepIndex - 1));
        } else {
            router.back();
        }
    };

    const finalizeSignUp = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLoading(true);
        try {
            // Pick every next 3rd color by counting rows
            const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            const totalUsers = count || 0;
            const skipCount = 3; // jump 3 colors at a time
            const colorIndex = (totalUsers * skipCount) % PALETTE.length;
            const deterministicColor = PALETTE[colorIndex];

            const signupData = await signUp(email, password, name, handle, deterministicColor);
            
            const user = signupData.user;
            if (user) {
                const updates: any = {};
                if (birthday) updates.birthday = birthday;
                
                if (Object.keys(updates).length > 0) {
                    await updateProfile(user.id, updates);
                }

                if (imageUri) {
                    await uploadProfilePicture(user.id, imageUri);
                }
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Will navigate to tabs or login based on layout state
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Sign Up failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    const renderInput = () => {
        switch (currentStepObj.key) {
            case 'name': return <TextInput style={styles.input} placeholder="John Doe" placeholderTextColor="rgba(44,39,32,0.4)" value={name} onChangeText={setName} autoFocus />;
            case 'handle': return <TextInput style={styles.input} placeholder="johndoe" placeholderTextColor="rgba(44,39,32,0.4)" value={handle} onChangeText={setHandle} autoCapitalize="none" autoFocus />;
            case 'email': return <TextInput style={styles.input} placeholder="john@example.com" placeholderTextColor="rgba(44,39,32,0.4)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoFocus />;
            case 'password': return <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="rgba(44,39,32,0.4)" value={password} onChangeText={setPassword} secureTextEntry autoFocus />;
            case 'birthday': return <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="rgba(44,39,32,0.4)" value={birthday} onChangeText={setBirthday} autoFocus />;
            case 'picture': return (
                <View style={styles.imagePickerOuter}>
                    <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
                        {imageUri ? (
                            <Image source={imageUri} style={styles.image} contentFit="cover" transition={300} />
                        ) : (
                            <Feather name="camera" size={36} color={COLORS.textSecondary} />
                        )}
                    </TouchableOpacity>
                    <Text style={styles.imageSubtext}>{imageUri ? 'Looking good!' : 'Tap to select'}</Text>
                </View>
            );
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <LinearGradient colors={['#FDFCF0', '#F7F4E9', '#E9DFB4']} style={StyleSheet.absoluteFillObject} />
            
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={prevStep} hitSlop={{top:20, bottom:20, left:20, right:20}}>
                    <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${((stepIndex + 1) / STEPS.length) * 100}%` }]} />
                </View>
            </View>

            <View style={styles.content}>
                <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }, styles.card]}>
                    <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
                    
                    <Text style={styles.title}>{currentStepObj.label}</Text>
                    
                    <View style={styles.inputContainer}>
                        {renderInput()}
                    </View>

                    <TouchableOpacity 
                        style={[styles.button, loading && { opacity: 0.7 }]} 
                        onPress={nextStep} 
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? <ActivityIndicator color={COLORS.surface} /> : (
                            <Text style={styles.buttonText}>{stepIndex === STEPS.length - 1 ? 'Finish & Enter' : 'Continue'}</Text>
                        )}
                    </TouchableOpacity>

                    {stepIndex === STEPS.length - 1 && !loading && (
                        <TouchableOpacity style={styles.skipButton} onPress={finalizeSignUp}>
                            <Text style={styles.skipText}>Skip for now</Text>
                        </TouchableOpacity>
                    )}
                </Animated.View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: SPACING.md,
    },
    backButton: {
        width: 44, height: 44, justifyContent: 'center',
    },
    progressContainer: {
        flex: 1,
        height: 6,
        backgroundColor: 'rgba(44,39,32,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
        marginLeft: SPACING.md,
        marginRight: SPACING.xl,
    },
    progressBar: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 3,
    },
    content: {
        flex: 1,
        paddingHorizontal: SPACING.xl,
        justifyContent: 'center',
        paddingBottom: 100, // push up
    },
    card: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)',
        padding: SPACING.xl,
        backgroundColor: 'rgba(255,255,255,0.4)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
    },
    title: { 
        fontSize: FONT_SIZES.xl, 
        fontFamily: FONTS.bold, 
        color: COLORS.primary, 
        marginBottom: SPACING.xxl,
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: SPACING.xl,
    },
    input: { 
        borderBottomWidth: 1.5, 
        borderColor: 'rgba(44,39,32,0.15)', 
        paddingVertical: SPACING.md, 
        fontSize: 22,
        fontFamily: FONTS.semibold,
        color: COLORS.primary,
        textAlign: 'center',
    },
    button: { 
        backgroundColor: COLORS.primary, 
        paddingVertical: 18, 
        borderRadius: 16, 
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
        letterSpacing: 1,
    },
    skipButton: {
        alignItems: 'center',
        marginTop: SPACING.lg,
        padding: SPACING.md,
    },
    skipText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.medium,
        fontSize: FONT_SIZES.sm,
    },
    imagePickerOuter: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: SPACING.lg,
    },
    imagePicker: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(255,255,255,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: COLORS.primary,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    imageSubtext: {
        marginTop: SPACING.md,
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.medium,
        color: COLORS.textSecondary,
    }
});
