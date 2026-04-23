import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Modal,
    TouchableWithoutFeedback,
    Dimensions,
    Animated,
    PanResponder,
    Easing,
    Switch,
    Platform,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/theme/theme';
import { Link } from 'expo-router';
import * as Contacts from 'expo-contacts';
import * as SMS from 'expo-sms';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types/userTypes';
import { updateProfile } from '@/services/profileService';
import { verifyCurrentPassword, changePassword, deleteAccount } from '@/services/authService';
import { CustomAlert } from '@/components/ui/CustomAlert';


const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.8;
const SWIPE_THRESHOLD = 120;
const CONTACT_SYNC_KEY = 'priorities_contact_sync_enabled';


const COUNTRIES = [
    { code: '+91', flag: '🇮🇳', name: 'India' },
    { code: '+1', flag: '🇺🇸', name: 'USA' },
    { code: '+44', flag: '🇬🇧', name: 'UK' },
    { code: '+81', flag: '🇯🇵', name: 'Japan' },
    { code: '+49', flag: '🇩🇪', name: 'Germany' },
    { code: '+33', flag: '🇫🇷', name: 'France' },
    { code: '+1', flag: '🇨🇦', name: 'Canada' },
    { code: '+61', flag: '🇦🇺', name: 'Australia' },
];


interface SecurityBottomSheetProps {
    isVisible: boolean;
    onClose: () => void;
    user: User | null;
}

// Password change step type
type PasswordStep = 'idle' | 'current' | 'new' | 'confirm';


const SecurityBottomSheet = ({ isVisible, onClose, user }: SecurityBottomSheetProps) => {
    // ── Phone state ──
    const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
    const [countryCode, setCountryCode] = useState('+91');
    const [countryFlag, setCountryFlag] = useState('🇮🇳');
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // ── Password change state ──
    const [passwordStep, setPasswordStep] = useState<PasswordStep>('idle');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    // ── Privacy state ──
    const [contactSync, setContactSync] = useState(false);
    const [hiddenMode, setHiddenMode] = useState(false);
    const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [visibleCount, setVisibleCount] = useState(50);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const panY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
    const isScrolling = useRef(false);


    // ── Load persisted contact sync state on mount ──────────────────────────
    useEffect(() => {
        AsyncStorage.getItem(CONTACT_SYNC_KEY).then((val) => {
            if (val === 'true') {
                setContactSync(true);
                handleSyncContacts(true);
            }
        });
    }, []);


    useEffect(() => {
        if (user?.phoneNumber) {
            const matchedCountry = COUNTRIES.find(c => user.phoneNumber?.startsWith(c.code));
            if (matchedCountry) {
                setCountryCode(matchedCountry.code);
                setCountryFlag(matchedCountry.flag);
                setPhoneNumber(user.phoneNumber.slice(matchedCountry.code.length));
            } else {
                setPhoneNumber(user.phoneNumber);
            }
        }
    }, [user]);


    useEffect(() => {
        if (isVisible) {
            Animated.spring(panY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 4,
                speed: 12
            }).start();
        }
    }, [isVisible]);

    // Reset password flow state when sheet closes
    useEffect(() => {
        if (!isVisible) {
            resetPasswordFlow();
        }
    }, [isVisible]);


    const handleClose = () => {
        Animated.timing(panY, {
            toValue: SHEET_HEIGHT,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }).start(() => {
            onClose();
        });
    };


    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return (
                    !isScrolling.current &&
                    gestureState.dy > 20 &&
                    Math.abs(gestureState.dx) < Math.abs(gestureState.dy)
                );
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) panY.setValue(gestureState.dy);
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > SWIPE_THRESHOLD || gestureState.vy > 0.5) {
                    Animated.timing(panY, {
                        toValue: SHEET_HEIGHT,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(onClose);
                } else {
                    Animated.spring(panY, {
                        toValue: 0,
                        bounciness: 4,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;


    // ── Password flow helpers ────────────────────────────────────────────────

    const resetPasswordFlow = () => {
        setPasswordStep('idle');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowCurrentPw(false);
        setShowNewPw(false);
        setShowConfirmPw(false);
        setPasswordError('');
    };

    const handlePasswordStepNext = async () => {
        setPasswordError('');

        if (passwordStep === 'idle') {
            setPasswordStep('current');
            return;
        }

        if (passwordStep === 'current') {
            if (!currentPassword) {
                setPasswordError('please enter your current password.');
                return;
            }
            if (!user?.email) {
                setPasswordError('unable to verify identity. please try again.');
                return;
            }
            setIsChangingPassword(true);
            try {
                await verifyCurrentPassword(user.email, currentPassword);
                setPasswordStep('new');
            } catch {
                setPasswordError('current password is incorrect.');
            } finally {
                setIsChangingPassword(false);
            }
            return;
        }

        if (passwordStep === 'new') {
            if (newPassword.length < 6) {
                setPasswordError('new password must be at least 6 characters.');
                return;
            }
            setPasswordStep('confirm');
            return;
        }

        if (passwordStep === 'confirm') {
            if (confirmPassword !== newPassword) {
                setPasswordError('passwords do not match. try again.');
                setConfirmPassword('');
                return;
            }
            setIsChangingPassword(true);
            try {
                await changePassword(newPassword);
                resetPasswordFlow();
                Alert.alert('password updated', 'your password has been changed successfully.');
            } catch (err: any) {
                setPasswordError(err.message || 'failed to update password. try again.');
            } finally {
                setIsChangingPassword(false);
            }
        }
    };

    const getPasswordStepLabel = (): string => {
        switch (passwordStep) {
            case 'idle': return 'change your password';
            case 'current': return 'current password';
            case 'new': return 'new password';
            case 'confirm': return 'confirm new password';
        }
    };

    const getPasswordStepPlaceholder = (): string => {
        switch (passwordStep) {
            case 'idle': return 'tap to change';
            case 'current': return 'enter current password';
            case 'new': return 'at least 6 characters';
            case 'confirm': return 'repeat new password';
        }
    };

    const getCurrentPasswordValue = (): string => {
        switch (passwordStep) {
            case 'current': return currentPassword;
            case 'new': return newPassword;
            case 'confirm': return confirmPassword;
            default: return '';
        }
    };

    const getCurrentPasswordSetter = () => {
        switch (passwordStep) {
            case 'current': return setCurrentPassword;
            case 'new': return setNewPassword;
            case 'confirm': return setConfirmPassword;
            default: return (_: string) => { };
        }
    };

    const getCurrentShowPw = (): boolean => {
        switch (passwordStep) {
            case 'current': return showCurrentPw;
            case 'new': return showNewPw;
            case 'confirm': return showConfirmPw;
            default: return false;
        }
    };

    const toggleShowPw = () => {
        switch (passwordStep) {
            case 'current': setShowCurrentPw(v => !v); break;
            case 'new': setShowNewPw(v => !v); break;
            case 'confirm': setShowConfirmPw(v => !v); break;
        }
    };

    // ── Step indicator dots ──────────────────────────────────────────────────
    const PasswordStepDots = () => {
        const steps: PasswordStep[] = ['current', 'new', 'confirm'];
        const currentIndex = steps.indexOf(passwordStep);
        if (passwordStep === 'idle') return null;
        return (
            <View style={styles.stepDotsContainer}>
                {steps.map((s, i) => (
                    <View
                        key={s}
                        style={[
                            styles.stepDot,
                            i <= currentIndex && styles.stepDotActive
                        ]}
                    />
                ))}
            </View>
        );
    };


    // ── Contact helpers ──────────────────────────────────────────────────────

    const handleSyncContacts = async (syncing: boolean) => {
        setContactSync(syncing);
        await AsyncStorage.setItem(CONTACT_SYNC_KEY, syncing ? 'true' : 'false');

        if (!syncing) {
            setContacts([]);
            setVisibleCount(50);
            return;
        }

        setIsSyncing(true);
        setVisibleCount(50);
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
                });
                if (data.length > 0) {
                    const validContacts = data.filter(
                        c => c.phoneNumbers && c.phoneNumbers.length > 0
                    );
                    const sorted = validContacts.sort(
                        (a, b) => (a.name || '').localeCompare(b.name || '')
                    );
                    setContacts(sorted);
                }
            } else {
                Alert.alert('Permission denied', 'We need access to your contacts to connect with friends.');
                setContactSync(false);
                await AsyncStorage.setItem(CONTACT_SYNC_KEY, 'false');
            }
        } catch (err) {
            console.error('Failed to fetch contacts:', err);
            setContactSync(false);
            await AsyncStorage.setItem(CONTACT_SYNC_KEY, 'false');
        } finally {
            setIsSyncing(false);
        }
    };


    const handleInvite = async (contact: Contacts.Contact) => {
        if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) return;
        const number = contact.phoneNumbers[0].number;
        if (!number) return;

        const isAvailable = await SMS.isAvailableAsync();
        if (isAvailable) {
            await SMS.sendSMSAsync(
                [number],
                `Hey! Join me on Priorities - the app for our circle. Download it here: https://priorities-app.com`
            );
        } else {
            Alert.alert('SMS unavailable', 'Your device does not support sending SMS.');
        }
    };


    const handleSaveAndDone = async () => {
        if (!user) return;

        const cleanedNumber = phoneNumber.replace(/\D/g, '');

        if (cleanedNumber === '' && user.phoneNumber === null) {
            handleClose();
            return;
        }

        setIsSaving(true);
        try {
            const fullNumber = cleanedNumber ? `${countryCode}${cleanedNumber}` : null;
            await updateProfile(user.id, {
                phone_number: fullNumber,
            });
            handleClose();
        } catch (err) {
            console.error('Failed to update phone number:', err);
            Alert.alert('Error', 'Failed to save phone number. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };


    const handleConfirmDelete = async () => {
        setIsDeleteModalVisible(false);
        setIsDeleting(true);
        try {
            await deleteAccount();
            // Auth listener will handle redirection
        } catch (err: any) {
            setIsDeleting(false);
            Alert.alert('error', err.message || 'failed to delete account. try again.');
        }
    };


    const SecurityOption = ({
        icon,
        label,
        value,
        onValueChange
    }: {
        icon: keyof typeof Ionicons.glyphMap;
        label: string;
        value: boolean;
        onValueChange: (v: boolean) => void;
    }) => (
        <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
                <View style={styles.iconContainer}>
                    <Ionicons name={icon} size={20} color={COLORS.primary} />
                </View>
                <Text style={styles.optionLabel}>{label}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: 'rgba(0,0,0,0.1)', true: COLORS.primary }}
                thumbColor={Platform.OS === 'android' ? '#FFF' : undefined}
            />
        </View>
    );


    return (
        <Modal
            visible={isVisible}
            transparent={true}
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent={true}
        >
            <View style={styles.overlayContainer}>
                <TouchableWithoutFeedback onPress={handleClose}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>

                <Animated.View
                    style={[
                        styles.modalCard,
                        {
                            height: SHEET_HEIGHT,
                            transform: [{ translateY: panY }],
                        }
                    ]}
                    {...panResponder.panHandlers}
                >
                    {/* ── Handle + Title ── */}
                    <View style={styles.header}>
                        <View style={styles.handleBar} />
                        <Text style={styles.title}>security & privacy</Text>
                        <TouchableOpacity
                            style={styles.doneButton}
                            onPress={handleSaveAndDone}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator size="small" color={COLORS.primary} />
                            ) : (
                                <Text style={styles.doneText}>done</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* ── Main scroll ── */}
                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled={true}
                        onScrollBeginDrag={() => { isScrolling.current = true; }}
                        onScrollEndDrag={() => { isScrolling.current = false; }}
                        onMomentumScrollBegin={() => { isScrolling.current = true; }}
                        onMomentumScrollEnd={() => { isScrolling.current = false; }}
                    >
                        {/* ── Account ── */}
                        <View style={styles.section}>
                            <Text style={styles.sectionHeader}>account</Text>
                            <View style={styles.card}>

                                {/* ── Password change row ── */}
                                <TouchableOpacity
                                    style={styles.inputRow}
                                    onPress={() => passwordStep === 'idle' && setPasswordStep('current')}
                                    activeOpacity={passwordStep === 'idle' ? 0.6 : 1}
                                >
                                    <View style={styles.iconContainer}>
                                        <Ionicons name="key-outline" size={20} color={COLORS.primary} />
                                    </View>

                                    {passwordStep === 'idle' ? (
                                        // ── Idle state: just a tappable row ──
                                        <View style={styles.passwordIdleRow}>
                                            <Text style={styles.passwordIdleLabel}>change your password</Text>
                                            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
                                        </View>
                                    ) : (
                                        // ── Active state: input + step indicator ──
                                        <View style={styles.passwordActiveContainer}>
                                            <View style={styles.passwordInputWrapper}>
                                                <View style={styles.passwordStepLabelRow}>
                                                    <Text style={styles.passwordStepLabel}>
                                                        {getPasswordStepLabel()}
                                                    </Text>
                                                    <PasswordStepDots />
                                                </View>
                                                <View style={styles.passwordInputRow}>
                                                    <TextInput
                                                        style={styles.input}
                                                        value={getCurrentPasswordValue()}
                                                        onChangeText={getCurrentPasswordSetter()}
                                                        placeholder={getPasswordStepPlaceholder()}
                                                        placeholderTextColor="#8E8E93"
                                                        secureTextEntry={!getCurrentShowPw()}
                                                        autoFocus
                                                        autoCapitalize="none"
                                                        autoCorrect={false}
                                                    />
                                                    <TouchableOpacity
                                                        onPress={toggleShowPw}
                                                        style={styles.visibilityButton}
                                                    >
                                                        <Ionicons
                                                            name={getCurrentShowPw() ? 'eye-off-outline' : 'eye-outline'}
                                                            size={18}
                                                            color={COLORS.textSecondary}
                                                        />
                                                    </TouchableOpacity>
                                                </View>
                                                {passwordError ? (
                                                    <Text style={styles.passwordErrorText}>{passwordError}</Text>
                                                ) : null}
                                            </View>

                                            <View style={styles.passwordActions}>
                                                <TouchableOpacity
                                                    onPress={resetPasswordFlow}
                                                    style={styles.passwordCancelButton}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <Text style={styles.passwordCancelText}>cancel</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={handlePasswordStepNext}
                                                    style={[
                                                        styles.passwordNextButton,
                                                        isChangingPassword && { opacity: 0.6 }
                                                    ]}
                                                    disabled={isChangingPassword}
                                                >
                                                    {isChangingPassword ? (
                                                        <ActivityIndicator size="small" color="#FFF" />
                                                    ) : (
                                                        <Text style={styles.passwordNextText}>
                                                            {passwordStep === 'confirm' ? 'update' : 'next'}
                                                        </Text>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <View style={styles.divider} />

                                {/* ── Phone number row ── */}
                                <View style={styles.inputRow}>
                                    <View style={styles.iconContainer}>
                                        <Ionicons name="call-outline" size={20} color={COLORS.primary} />
                                    </View>
                                    <TouchableOpacity
                                        style={styles.countryPicker}
                                        onPress={() => setShowCountryPicker(!showCountryPicker)}
                                    >
                                        <Text style={styles.flagText}>{countryFlag}</Text>
                                        <Text style={styles.countryCodeText}>{countryCode}</Text>
                                        <Ionicons name="chevron-down" size={12} color="#8E8E93" />
                                    </TouchableOpacity>
                                    <View style={styles.inputDivider} />
                                    <TextInput
                                        style={styles.input}
                                        value={phoneNumber}
                                        onChangeText={setPhoneNumber}
                                        placeholder="phone number"
                                        placeholderTextColor="#8E8E93"
                                        keyboardType="phone-pad"
                                    />
                                </View>

                                {showCountryPicker && (
                                    <View style={styles.countryList}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            {COUNTRIES.map((c) => (
                                                <TouchableOpacity
                                                    key={c.code + c.name}
                                                    style={styles.countryItem}
                                                    onPress={() => {
                                                        setCountryCode(c.code);
                                                        setCountryFlag(c.flag);
                                                        setShowCountryPicker(false);
                                                    }}
                                                >
                                                    <Text style={styles.countryItemFlag}>{c.flag}</Text>
                                                    <Text style={styles.countryItemCode}>{c.code}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.helperText}>
                                your number is used for recovery and security alerts.
                            </Text>
                        </View>

                        {/* ── Privacy ── */}
                        <View style={styles.section}>
                            <Text style={styles.sectionHeader}>privacy</Text>
                            <View style={styles.card}>
                                <SecurityOption
                                    icon="people-outline"
                                    label="contact sync"
                                    value={contactSync}
                                    onValueChange={handleSyncContacts}
                                />
                                <View style={styles.divider} />
                                <SecurityOption
                                    icon="eye-off-outline"
                                    label="hidden mode"
                                    value={hiddenMode}
                                    onValueChange={setHiddenMode}
                                />
                                <View style={styles.divider} />
                                <Link href="/blocked-users" asChild onPress={onClose}>
                                    <TouchableOpacity style={styles.optionRow}>
                                        <View style={styles.optionLeft}>
                                            <View style={styles.iconContainer}>
                                                <Ionicons name="ban-outline" size={20} color={COLORS.primary} />
                                            </View>
                                            <Text style={styles.optionLabel}>blocked users</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                                    </TouchableOpacity>
                                </Link>

                                <View style={styles.divider} />
                                
                                <TouchableOpacity 
                                    style={styles.optionRow} 
                                    onPress={() => setIsDeleteModalVisible(true)}
                                    disabled={isDeleting}
                                >
                                    <View style={styles.optionLeft}>
                                        <View style={[styles.iconContainer, { backgroundColor: 'rgba(180, 30, 30, 0.05)' }]}>
                                            <Ionicons name="trash-outline" size={20} color="#B41E1E" />
                                        </View>
                                        <Text style={[styles.optionLabel, { color: '#B41E1E' }]}>
                                            {isDeleting ? 'deleting account...' : 'delete account'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.infoGroup}>
                                <Text style={styles.infoText}>
                                    • sync contacts to find and connect with friends who are already here.
                                </Text>
                                <Text style={styles.infoText}>
                                    • when active, your profile won't appear in explore or search results.
                                </Text>
                            </View>

                            {/* ── Contacts list ── */}
                            {contactSync && (
                                <View style={styles.contactListSection}>
                                    <View style={styles.contactListHeader}>
                                        <Text style={styles.contactListTitle}>invite contacts</Text>
                                        {isSyncing && (
                                            <ActivityIndicator size="small" color={COLORS.primary} />
                                        )}
                                    </View>

                                    {contacts.length > 0 ? (
                                        <View style={styles.contactCard}>
                                            <ScrollView
                                                style={styles.contactsScrollView}
                                                showsVerticalScrollIndicator={true}
                                                nestedScrollEnabled={true}
                                                scrollEventThrottle={16}
                                                keyboardShouldPersistTaps="handled"
                                                onScrollBeginDrag={() => { isScrolling.current = true; }}
                                                onScrollEndDrag={() => { isScrolling.current = false; }}
                                                onMomentumScrollBegin={() => { isScrolling.current = true; }}
                                                onMomentumScrollEnd={() => { isScrolling.current = false; }}
                                            >
                                                {contacts.slice(0, visibleCount).map((contact, idx) => (
                                                    <React.Fragment key={(contact as any).id || idx}>
                                                        <View style={styles.contactRow}>
                                                            <View style={styles.contactAvatar}>
                                                                <Text style={styles.contactAvatarText}>
                                                                    {contact.name?.charAt(0).toUpperCase() || '?'}
                                                                </Text>
                                                            </View>
                                                            <View style={styles.contactInfo}>
                                                                <Text style={styles.contactName}>
                                                                    {contact.name}
                                                                </Text>
                                                                <Text style={styles.contactPhone}>
                                                                    {contact.phoneNumbers?.[0]?.number}
                                                                </Text>
                                                            </View>
                                                            <TouchableOpacity
                                                                style={styles.inviteButton}
                                                                onPress={() => handleInvite(contact)}
                                                            >
                                                                <Text style={styles.inviteButtonText}>invite</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                        {idx < Math.min(contacts.length, visibleCount) - 1 && (
                                                            <View style={[styles.divider, { marginLeft: 64 }]} />
                                                        )}
                                                    </React.Fragment>
                                                ))}

                                                {visibleCount < contacts.length && (
                                                    <TouchableOpacity
                                                        style={styles.loadMoreButton}
                                                        onPress={() => setVisibleCount(prev => prev + 50)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={styles.loadMoreText}>
                                                            load more contacts ({contacts.length - visibleCount} left)
                                                        </Text>
                                                        <Ionicons name="chevron-down" size={16} color={COLORS.primary} />
                                                    </TouchableOpacity>
                                                )}
                                            </ScrollView>
                                        </View>
                                    ) : !isSyncing ? (
                                        <View style={styles.noContactsContainer}>
                                            <MaterialIcons
                                                name="people-outline"
                                                size={32}
                                                color={COLORS.textSecondary}
                                                opacity={0.3}
                                            />
                                            <Text style={styles.noContactsText}>
                                                no contacts found with phone numbers
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                            )}
                        </View>

                        {/* Bottom padding */}
                        <View style={{ height: 40 }} />
                    </ScrollView>
                </Animated.View>
            </View>

            <CustomAlert
                visible={isDeleteModalVisible}
                title="delete account?"
                description="this is permanent. your profile, films and priorities will be deleted forever. memories you shared with others will remain in their timelines."
                cancelText="go back"
                confirmText="delete permanently"
                isDestructive={true}
                onCancel={() => setIsDeleteModalVisible(false)}
                onConfirm={handleConfirmDelete}
            />
        </Modal>
    );
};


export default SecurityBottomSheet;


const styles = StyleSheet.create({
    overlayContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modalCard: {
        backgroundColor: '#F8F7F2',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 20,
    },
    header: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 20,
    },
    handleBar: {
        width: 36,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: 'rgba(0,0,0,0.1)',
        marginBottom: 16,
    },
    title: {
        fontSize: 17,
        fontFamily: FONTS.bold,
        fontWeight: '800',
        color: COLORS.text,
        textTransform: 'lowercase',
    },
    doneButton: {
        position: 'absolute',
        right: 20,
        top: 24,
    },
    doneText: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        fontWeight: '700',
    },
    content: {
        paddingHorizontal: 20,
    },
    section: {
        marginBottom: 16,
    },
    sectionHeader: {
        fontSize: 12,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
        textTransform: 'lowercase',
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.05)',
        marginBottom: 8,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.03)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    optionLabel: {
        fontSize: 16,
        fontFamily: FONTS.medium,
        color: COLORS.text,
        textTransform: 'lowercase',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontFamily: FONTS.medium,
        color: COLORS.text,
        padding: 0,
    },
    visibilityButton: {
        padding: 4,
        marginLeft: 8,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginLeft: 60,
    },
    inputDivider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(0,0,0,0.1)',
        marginHorizontal: 12,
    },
    countryPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 4,
    },
    flagText: {
        fontSize: 18,
        marginRight: 6,
    },
    countryCodeText: {
        fontSize: 15,
        fontFamily: FONTS.medium,
        color: COLORS.text,
        marginRight: 4,
    },
    countryList: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#FFF',
        borderRadius: 12,
        marginRight: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    countryItemFlag: {
        fontSize: 16,
        marginRight: 6,
    },
    countryItemCode: {
        fontSize: 13,
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },

    // ── Password flow styles ──
    passwordIdleRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    passwordIdleLabel: {
        fontSize: 16,
        fontFamily: FONTS.medium,
        color: COLORS.text,
        textTransform: 'lowercase',
    },
    passwordActiveContainer: {
        flex: 1,
        paddingVertical: 4,
    },
    passwordInputWrapper: {
        marginBottom: 10,
    },
    passwordStepLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    passwordStepLabel: {
        fontSize: 12,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
        textTransform: 'lowercase',
        letterSpacing: 0.3,
    },
    stepDotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    stepDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(0,0,0,0.12)',
    },
    stepDotActive: {
        backgroundColor: COLORS.primary,
    },
    passwordInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.1)',
        paddingBottom: 6,
    },
    passwordErrorText: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: '#D94F4F',
        marginTop: 6,
        textTransform: 'lowercase',
    },
    passwordActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 4,
    },
    passwordCancelButton: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    passwordCancelText: {
        fontSize: 13,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
        textTransform: 'lowercase',
    },
    passwordNextButton: {
        paddingHorizontal: 18,
        paddingVertical: 7,
        borderRadius: 12,
        backgroundColor: COLORS.primary,
        minWidth: 60,
        alignItems: 'center',
    },
    passwordNextText: {
        fontSize: 13,
        fontFamily: FONTS.bold,
        color: '#FFF',
        textTransform: 'lowercase',
    },

    // ── Info / helper text ──
    infoGroup: {
        marginTop: 12,
        paddingHorizontal: 4,
    },
    infoText: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        lineHeight: 18,
        marginBottom: 4,
        textTransform: 'lowercase',
        opacity: 0.8,
    },
    helperText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 8,
        marginLeft: 4,
        lineHeight: 16,
        textTransform: 'lowercase',
        opacity: 0.8,
    },

    // ── Contacts ──
    contactListSection: {
        marginTop: 24,
        marginBottom: 32,
    },
    contactListHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    contactListTitle: {
        fontSize: 12,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
        textTransform: 'lowercase',
        letterSpacing: 0.5,
    },
    contactCard: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    contactsScrollView: {
        maxHeight: height * 0.4,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    contactAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    contactAvatarText: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
    },
    contactInfo: {
        flex: 1,
    },
    contactName: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: COLORS.text,
        textTransform: 'lowercase',
    },
    contactPhone: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    inviteButton: {
        backgroundColor: 'rgba(0,0,0,0.04)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.04)',
    },
    inviteButtonText: {
        fontSize: 13,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        textTransform: 'lowercase',
    },
    noContactsContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderRadius: 20,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    noContactsText: {
        marginTop: 12,
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    loadMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(0,0,0,0.05)',
        gap: 8,
    },
    loadMoreText: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        textTransform: 'lowercase',
    },
});