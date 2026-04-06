import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
    ActivityIndicator, KeyboardAvoidingView, Platform, Animated,
    Keyboard, Easing, Modal, FlatList, Dimensions
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { signUp } from '@/services/authService';
import { isHandleAvailable } from '@/services/profileService';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import DatePicker from 'react-native-date-picker';
import VerifyEmailScreen from './VerifyEmailScreen';
import AuthCanvas from '@/features/film-my-day/components/canvas/AuthCanvas';
import {
    buildDecoRectLayout,
    buildDecoCircleLayout,
} from '@/features/film-my-day/components/canvas/canvasUtils';


const { width: SW, height: SH } = Dimensions.get('window');

const decoRects = buildDecoRectLayout();
const decoCircles = buildDecoCircleLayout();
const ALL_DECO = [...decoRects, ...decoCircles];
const BG_COLORS: [string, string, string] = ['#FDFCF0', '#F7F4E9', '#E9DFB4'];

const PALETTE = Object.values(COLORS.PALETTE);

const GENDER_OPTIONS = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Non-binary', value: 'non-binary' },
    { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

const STEPS = [
    { key: 'name', label: 'what should we\ncall you?' },
    { key: 'handle', label: 'pick a unique\nhandle.' },
    { key: 'email', label: 'your email\naddress.' },
    { key: 'password', label: 'create a\npassword.' },
    { key: 'birthday', label: 'when is your\nbirthday?' },
    { key: 'gender', label: 'how do you\nidentify?' },
];

const TEXT_INPUT_STEPS = ['name', 'handle', 'email', 'password'];

// ── Wave config ────────────────────────────────────────────────────────────
const WAVE_H = 24;
const WAVE_AMP = 6;
const WAVE_PERIOD = 22;

function buildWavePath(totalWidth: number): string {
    let d = `M 0 ${WAVE_H / 2}`;
    let x = 0;
    while (x < totalWidth + WAVE_PERIOD) {
        const cp1x = x + WAVE_PERIOD / 4;
        const cp1y = WAVE_H / 2 - WAVE_AMP;
        const cp2x = x + (WAVE_PERIOD * 3) / 4;
        const cp2y = WAVE_H / 2 + WAVE_AMP;
        const ex = x + WAVE_PERIOD;
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${ex} ${WAVE_H / 2}`;
        x += WAVE_PERIOD;
    }
    return d;
}

// ── WavyProgressBar ────────────────────────────────────────────────────────
// Strategy: render two identical SVGs stacked absolutely on top of each other.
// The background SVG is full width (faint color).
// The foreground SVG is also full width but its *container* View is animated
// from 0 → target width with overflow:hidden — this clips the colored wave.
interface WavyProgressProps {
    stepIndex: number;
    totalSteps: number;
    totalWidth: number;
}

function WavyProgressBar({ stepIndex, totalSteps, totalWidth }: WavyProgressProps) {
    const animWidth = useRef(
        new Animated.Value((totalWidth * 1) / totalSteps)
    ).current;
    const wavePath = buildWavePath(totalWidth);

    useEffect(() => {
        const target = (totalWidth * (stepIndex + 1)) / totalSteps;
        Animated.timing(animWidth, {
            toValue: target,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false, // width animation cannot use native driver
        }).start();
    }, [stepIndex, totalWidth, totalSteps]);

    return (
        <View style={{ width: totalWidth, height: WAVE_H }}>

            {/* Background wave — full width, faint */}
            <Svg
                width={totalWidth}
                height={WAVE_H}
                style={StyleSheet.absoluteFill}
            >
                <Path
                    d={wavePath}
                    stroke="rgba(44,39,32,0.13)"
                    strokeWidth={2.8}
                    fill="none"
                    strokeLinecap="round"
                />
            </Svg>

            {/* Foreground wave — same SVG but its View is clipped by animated width */}
            <Animated.View
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: animWidth,   // ← this is what animates
                    height: WAVE_H,
                    overflow: 'hidden', // ← this clips the SVG naturally
                }}
            >
                <Svg width={totalWidth} height={WAVE_H}>
                    <Path
                        d={wavePath}
                        stroke={COLORS.primary}
                        strokeWidth={2.8}
                        fill="none"
                        strokeLinecap="round"
                    />
                </Svg>
            </Animated.View>

        </View>
    );
}
// ──────────────────────────────────────────────────────────────────────────


export default function SignUpScreen() {
    const [stepIndex, setStepIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [progressBarWidth, setProgressBarWidth] = useState(0);

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
    const inputRef = useRef<TextInput>(null);

    const currentStepObj = STEPS[stepIndex];

    // ── Keyboard listener ─────────────────────────────────────────────────
    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => { show.remove(); hide.remove(); };
    }, []);
    // ─────────────────────────────────────────────────────────────────────

    const formatDateForDB = (date: Date): string => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const formatDateForDisplay = (date: Date): string =>
        date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

    const maxBirthdayDate = new Date();
    maxBirthdayDate.setFullYear(maxBirthdayDate.getFullYear() - 13);

    const selectedGenderLabel = GENDER_OPTIONS.find(g => g.value === gender)?.label || '';

    const animateTransition = (direction: 'next' | 'prev', callback: () => void) => {
        const offset = direction === 'next' ? -50 : 50;
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: offset, duration: 200, useNativeDriver: true, easing: Easing.in(Easing.cubic) }),
        ]).start(() => {
            callback();
            slideAnim.setValue(direction === 'next' ? 50 : -50);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
            ]).start(() => {
                const newIndex = direction === 'next' ? stepIndex + 1 : stepIndex - 1;
                const newStepKey = STEPS[newIndex]?.key;
                if (newStepKey && TEXT_INPUT_STEPS.includes(newStepKey)) {
                    setTimeout(() => inputRef.current?.focus(), 50);
                }
            });
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
            setDone(true);
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Sign Up failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <VerifyEmailScreen
                email={email}
                onSignInPress={() => router.replace('/auth/signin')}
            />
        );
    }

    const renderInput = () => {
        switch (currentStepObj.key) {
            case 'name':
                return (
                    <TextInput
                        ref={inputRef}
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
                        ref={inputRef}
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
                        ref={inputRef}
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
                    <View style={styles.passwordRow}>
                        <TextInput
                            ref={inputRef}
                            style={[styles.input, { flex: 1, borderBottomWidth: 0 }]}
                            placeholder="••••••••"
                            placeholderTextColor="rgba(44,39,32,0.4)"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            autoFocus
                        />
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowPassword(p => !p);
                            }}
                            style={styles.eyeButton}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={22}
                                color={`${COLORS.primary}99`}
                            />
                        </TouchableOpacity>
                    </View>
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

    // ── Keyboard-aware bottom block ───────────────────────────────────────
    const renderBottomBlock = () => {
        if (keyboardVisible) {
            return (
                <View style={styles.bottomBlock}>
                    <View style={styles.keyboardButtonRow}>
                        <TouchableOpacity
                            style={styles.goBackButton}
                            onPress={prevStep}
                            activeOpacity={0.75}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
                            <Text style={styles.goBackText}>Go back</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.arrowButton, loading && { opacity: 0.7 }]}
                            onPress={nextStep}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading
                                ? <ActivityIndicator color={COLORS.surface} size="small" />
                                : <Ionicons name="arrow-forward" size={22} color={COLORS.surface} />
                            }
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.bottomBlock}>
                <TouchableOpacity
                    style={[styles.button, loading && { opacity: 0.7 }]}
                    onPress={nextStep}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    {loading
                        ? <ActivityIndicator color={COLORS.surface} />
                        : (
                            <Text style={styles.buttonText}>
                                {stepIndex === STEPS.length - 1 ? 'Finish & Enter' : 'CONTINUE'}
                            </Text>
                        )
                    }
                </TouchableOpacity>
            </View>
        );
    };
    // ─────────────────────────────────────────────────────────────────────

    return (
        <View style={{ flex: 1, backgroundColor: '#E9DFB4' }}>
            <AuthCanvas bgColors={BG_COLORS} decoItems={ALL_DECO}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.container}
                >
                    <LinearGradient
                        colors={['rgba(255,255,255,0.82)', 'rgba(255,255,255,0.0)']}
                        locations={[0, 1]}
                        style={styles.topGradient}
                        pointerEvents="none"
                    />

                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={prevStep}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
                        </TouchableOpacity>

                        {/* ── Wavy progress bar ── */}
                        <View
                            style={styles.progressContainer}
                            onLayout={e => setProgressBarWidth(e.nativeEvent.layout.width)}
                        >
                            {progressBarWidth > 0 && (
                                <WavyProgressBar
                                    stepIndex={stepIndex}
                                    totalSteps={STEPS.length}
                                    totalWidth={progressBarWidth}
                                />
                            )}
                        </View>
                    </View>

                    <Animated.View
                        style={[
                            styles.formBlock,
                            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                        ]}
                    >
                        <Text style={styles.title}>{currentStepObj.label}</Text>
                        <View style={styles.inputContainer}>
                            {renderInput()}
                        </View>
                    </Animated.View>

                    <View style={{ flex: 1 }} />

                    {renderBottomBlock()}

                </KeyboardAvoidingView>

                {/* ── Sign-in link pinned to the very bottom ── */}
                {!keyboardVisible && (
                    <TouchableOpacity
                        style={styles.signinLink}
                        onPress={() => router.replace('/auth/signin')}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.signinText}>
                            Already have an account?{'  '}
                            <Text style={styles.signinTextBold}>Sign in →</Text>
                        </Text>
                    </TouchableOpacity>
                )}

            </AuthCanvas>
        </View>
    );
}


const styles = StyleSheet.create({
    container: { flex: 1 },

    topGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: Platform.OS === 'ios' ? 160 : 140,
        zIndex: 1,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: SPACING.md,
        zIndex: 2,
    },
    backButton: {
        width: 44, height: 44, justifyContent: 'center',
    },

    progressContainer: {
        flex: 1,
        height: WAVE_H,
        justifyContent: 'center',
        marginLeft: SPACING.md,
        marginRight: SPACING.xl,
    },

    formBlock: {
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.xl,
        zIndex: 2,
    },
    title: {
        fontSize: FONT_SIZES.xxl,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        marginBottom: SPACING.xxl,
        letterSpacing: -1,
        lineHeight: 46,
        textAlign: 'left',
    },
    inputContainer: {
        marginBottom: SPACING.md,
    },
    input: {
        borderBottomWidth: 1.5,
        borderColor: 'rgba(44,39,32,0.55)',  // was 0.15
        paddingVertical: SPACING.md,
        fontSize: 22,
        fontFamily: FONTS.semibold,
        color: COLORS.primary,
        textAlign: 'left',
    },

    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1.5,
        borderColor: 'rgba(44,39,32,0.55)',  // was 0.15
    },
    eyeButton: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.md,
    },

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

    bottomBlock: {
        paddingHorizontal: SPACING.xl,
        paddingBottom: Platform.OS === 'ios' ? SPACING.xxl : SPACING.xl,
        gap: SPACING.md,
        zIndex: 2,
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

    keyboardButtonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    goBackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: 'rgba(44,39,32,0.15)',
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    goBackText: {
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.semibold,
        color: COLORS.primary,
    },
    arrowButton: {
        width: 56,
        height: 56,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
    },

    signinLink: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 25 : 40,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        zIndex: 10,
    },
    signinText: {
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.regular,
        color: 'rgba(44,39,32,0.5)',
    },
    signinTextBold: {
        fontFamily: FONTS.semibold,
        color: COLORS.primary,
    },
});