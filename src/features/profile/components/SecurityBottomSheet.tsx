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
    Alert,
    ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/theme/theme';
import { Link } from 'expo-router';
import * as Contacts from 'expo-contacts';
import * as SMS from 'expo-sms';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types/userTypes';
import { updateProfile } from '@/services/profileService';


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


const SecurityBottomSheet = ({ isVisible, onClose, user }: SecurityBottomSheetProps) => {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
    const [countryCode, setCountryCode] = useState('+91');
    const [countryFlag, setCountryFlag] = useState('🇮🇳');
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [contactSync, setContactSync] = useState(false);
    const [hiddenMode, setHiddenMode] = useState(false);
    const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

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
            setPhoneNumber(user.phoneNumber);
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
                    gestureState.dy > 8 &&
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


    const handleSyncContacts = async (syncing: boolean) => {
        setContactSync(syncing);
        await AsyncStorage.setItem(CONTACT_SYNC_KEY, syncing ? 'true' : 'false');

        if (!syncing) {
            setContacts([]);
            return;
        }

        setIsSyncing(true);
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
        setIsSaving(true);
        try {
            await updateProfile(user.id, {
                phone_number: phoneNumber ? (countryCode + phoneNumber) : null,
            });
            handleClose();
        } catch (err) {
            console.error('Failed to update phone number:', err);
            handleClose();
        } finally {
            setIsSaving(false);
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
                                <View style={styles.inputRow}>
                                    <View style={styles.iconContainer}>
                                        <Ionicons name="key-outline" size={20} color={COLORS.primary} />
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        value={password}
                                        onChangeText={setPassword}
                                        placeholder="change your passcode"
                                        placeholderTextColor="#8E8E93"
                                        secureTextEntry={!showPassword}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={styles.visibilityButton}
                                    >
                                        <Ionicons
                                            name={showPassword ? "eye-off-outline" : "eye-outline"}
                                            size={20}
                                            color={COLORS.textSecondary}
                                        />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.divider} />
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
                                                {contacts.map((contact, idx) => (
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
                                                        {idx < contacts.length - 1 && (
                                                            <View style={[styles.divider, { marginLeft: 52 }]} />
                                                        )}
                                                    </React.Fragment>
                                                ))}
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
});