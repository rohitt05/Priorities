import React, { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
    ActivityIndicator, KeyboardAvoidingView, Platform, Animated,
    Keyboard, Easing, Modal, FlatList
} from 'react-native';
import { signUp } from '@/services/authService';
import { isHandleAvailable } from '@/services/profileService';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import DatePicker from 'react-native-date-picker';
import VerifyEmailScreen from './VerifyEmailScreen';


const PALETTE = Object.values(COLORS.PALETTE);

const GENDER_OPTIONS = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Non-binary', value: 'non-binary' },
    { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

const STEPS = [
    { key: 'name', label: 'What should we call you?' },
    { key: 'handle', label: 'Pick a unique handle' },
    { key: 'email', label: 'Your email address' },
    { key: 'password', label: 'Create a password' },
    { key: 'birthday', label: 'When is your birthday?' },
    { key: 'gender', label: 'How do you identify?' },
];


export default function SignUpScreen() {
    const [stepIndex, setStepIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false); // ← shows verify screen after signup

    const [name, setName] = useState('');
    const [handle, setHandle] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [birthdayDate, setBirthdayDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [gender, setGender] = useState('');
    const [showGenderDropdown, setShowGenderDropdown] = useState(false);

    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const currentStepObj = STEPS[stepIndex];

    const formatDateForDB = (date: Date): string => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const formatDateForDisplay = (date: Date): string => {
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const maxBirthdayDate = new Date();
    maxBirthdayDate.setFullYear(maxBirthdayDate.getFullYear() - 13);

    const selectedGenderLabel = GENDER_OPTIONS.find(g => g.value === gender)?.label || '';


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

        if (currentStepObj.key === 'name' && !name.trim()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return Alert.alert('Required', 'Please enter your name');
        }
        if (currentStepObj.key === 'handle') {
            if (!handle.trim()) return Alert.alert('Required', 'Handle is required');
            setLoading(true);
            const available = await isHandleAvailable(handle).catch(() => false);
            setLoading(false);
            if (!available) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                return Alert.alert('Taken', 'This handle is already in use');
            }
        }
        if (currentStepObj.key === 'email' && (!email || !email.includes('@'))) {
            return Alert.alert('Invalid', 'Valid email required');
        }
        if (currentStepObj.key === 'password' && password.length < 6) {
            return Alert.alert('Short', 'Password must be at least 6 characters');
        }
        if (currentStepObj.key === 'birthday' && !birthdayDate) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return Alert.alert('Required', 'Please select your birthday');
        }
        if (currentStepObj.key === 'gender' && !gender) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return Alert.alert('Required', 'Please select how you identify');
        }

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
            const { count } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true });
            const totalUsers = count || 0;
            const skipCount = 3;
            const colorIndex = (totalUsers * skipCount) % PALETTE.length;
            const deterministicColor = PALETTE[colorIndex];

            const signupData = await signUp(email, password, name, handle, deterministicColor);
            const user = signupData.user;
            const session = signupData.session;

            if (user) {
                if (session) {
                    await supabase.auth.setSession({
                        access_token: session.access_token,
                        refresh_token: session.refresh_token,
                    });
                }

                const { error: handleError } = await supabase
                    .from('profiles')
                    .update({ unique_user_id: handle })
                    .eq('id', user.id);
                if (handleError) throw handleError;

                const profileUpdates: Record<string, any> = {
                    name,
                    dominant_color: deterministicColor,
                };
                if (birthdayDate) profileUpdates.birthday = formatDateForDB(birthdayDate);
                if (gender) profileUpdates.gender = gender;

                const { error: updateError } = await supabase
                    .from('profiles')
                    .update(profileUpdates)
                    .eq('id', user.id);
                if (updateError) console.warn('Profile update failed:', updateError.message);
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setDone(true); // ← show verify email screen
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Sign Up failed', error.message);
        } finally {
            setLoading(false);
        }
    };


    // ─── VERIFY EMAIL SCREEN ──────────────────────────────────────────────────
    if (done) {
        return (
            <VerifyEmailScreen 
                email={email}
                onSignInPress={() => router.replace('/auth/signin')}
            />
        );
    }
    // ─────────────────────────────────────────────────────────────────────────


    const renderInput = () => {
        switch (currentStepObj.key) {
            case 'name':
                return (
                    <TextInput
                        style={styles.input}
                        placeholder="John Doe"
                        placeholderTextColor="rgba(44,39,32,0.4)"
                        value={name}
                        onChangeText={setName}
                        autoFocus
                    />
                );
            case 'handle':
                return (
                    <TextInput
                        style={styles.input}
                        placeholder="johndoe"
                        placeholderTextColor="rgba(44,39,32,0.4)"
                        value={handle}
                        onChangeText={setHandle}
                        autoCapitalize="none"
                        autoFocus
                    />
                );
            case 'email':
                return (
                    <TextInput
                        style={styles.input}
                        placeholder="john@example.com"
                        placeholderTextColor="rgba(44,39,32,0.4)"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoFocus
                    />
                );
            case 'password':
                return (
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="rgba(44,39,32,0.4)"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoFocus
                    />
                );

            case 'birthday':
                return (
                    <View style={styles.pickerContainer}>
                        <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowDatePicker(true);
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.dropdownButtonText, !birthdayDate && styles.dropdownPlaceholder]}>
                                {birthdayDate ? formatDateForDisplay(birthdayDate) : 'Select your birthday'}
                            </Text>
                            <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                        </TouchableOpacity>

                        <DatePicker
                            modal
                            open={showDatePicker}
                            date={birthdayDate ?? maxBirthdayDate}
                            mode="date"
                            maximumDate={maxBirthdayDate}
                            minimumDate={new Date(1900, 0, 1)}
                            title="Select your birthday"
                            confirmText="Confirm"
                            cancelText="Cancel"
                            onConfirm={(date) => {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                setBirthdayDate(date);
                                setShowDatePicker(false);
                            }}
                            onCancel={() => setShowDatePicker(false)}
                        />
                    </View>
                );

            case 'gender':
                return (
                    <View style={styles.pickerContainer}>
                        <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowGenderDropdown(true);
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.dropdownButtonText, !gender && styles.dropdownPlaceholder]}>
                                {selectedGenderLabel || 'Select gender'}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
                        </TouchableOpacity>

                        <Modal
                            visible={showGenderDropdown}
                            transparent
                            animationType="fade"
                            onRequestClose={() => setShowGenderDropdown(false)}
                        >
                            <TouchableOpacity
                                style={styles.modalOverlay}
                                activeOpacity={1}
                                onPress={() => setShowGenderDropdown(false)}
                            >
                                <View style={styles.dropdownModal}>
                                    <Text style={styles.dropdownModalTitle}>Select gender</Text>
                                    <FlatList
                                        data={GENDER_OPTIONS}
                                        keyExtractor={item => item.value}
                                        scrollEnabled={false}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity
                                                style={[
                                                    styles.dropdownItem,
                                                    gender === item.value && styles.dropdownItemSelected,
                                                ]}
                                                onPress={() => {
                                                    Haptics.selectionAsync();
                                                    setGender(item.value);
                                                    setShowGenderDropdown(false);
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[
                                                    styles.dropdownItemText,
                                                    gender === item.value && styles.dropdownItemTextSelected,
                                                ]}>
                                                    {item.label}
                                                </Text>
                                                {gender === item.value && (
                                                    <Ionicons name="checkmark" size={18} color={COLORS.surface} />
                                                )}
                                            </TouchableOpacity>
                                        )}
                                        ItemSeparatorComponent={() => <View style={styles.dropdownSeparator} />}
                                    />
                                </View>
                            </TouchableOpacity>
                        </Modal>
                    </View>
                );
        }
    };


    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <LinearGradient colors={['#FDFCF0', '#F7F4E9', '#E9DFB4']} style={StyleSheet.absoluteFillObject} />

            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={prevStep} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
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
                            <Text style={styles.buttonText}>
                                {stepIndex === STEPS.length - 1 ? 'Finish & Enter' : 'Continue'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </KeyboardAvoidingView>
    );
}


const styles = StyleSheet.create({
    container: { flex: 1 },

    // ── Header ──
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

    // ── Card ──
    content: {
        flex: 1,
        paddingHorizontal: SPACING.xl,
        justifyContent: 'center',
        paddingBottom: 100,
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

    // ── Picker / Dropdown ──
    pickerContainer: { marginTop: SPACING.sm },
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1.5,
        borderColor: 'rgba(44,39,32,0.15)',
        borderRadius: 14,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        backgroundColor: 'rgba(255,255,255,0.6)',
    },
    dropdownButtonText: {
        fontSize: FONT_SIZES.md,
        fontFamily: FONTS.semibold,
        color: COLORS.primary,
    },
    dropdownPlaceholder: {
        color: 'rgba(44,39,32,0.4)',
        fontFamily: FONTS.regular,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
    },
    dropdownModal: {
        width: '100%',
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#FDFCF0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 12,
    },
    dropdownModalTitle: {
        fontSize: FONT_SIZES.md,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        textAlign: 'center',
        paddingVertical: SPACING.lg,
        backgroundColor: '#FDFCF0',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(44,39,32,0.08)',
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.xl,
        paddingVertical: 18,
        backgroundColor: '#FDFCF0',
    },
    dropdownItemSelected: { backgroundColor: COLORS.primary },
    dropdownItemText: {
        fontSize: FONT_SIZES.md,
        fontFamily: FONTS.medium,
        color: COLORS.primary,
    },
    dropdownItemTextSelected: {
        color: COLORS.surface,
        fontFamily: FONTS.bold,
    },
    dropdownSeparator: {
        height: 1,
        backgroundColor: 'rgba(44,39,32,0.06)',
        marginHorizontal: SPACING.lg,
    },

    // ── Button ──
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
});