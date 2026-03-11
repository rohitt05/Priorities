import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Modal,
    TouchableWithoutFeedback,
    Dimensions,
    Keyboard,
    Animated,
    PanResponder,
    Easing,
    Switch,
    Platform,
    TextInput,
    ScrollView
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING } from '@/theme/theme';
import { Link } from 'expo-router';

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.8;
const SWIPE_THRESHOLD = 120;

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
}

const SecurityBottomSheet = ({ isVisible, onClose }: SecurityBottomSheetProps) => {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [countryCode, setCountryCode] = useState('+91');
    const [countryFlag, setCountryFlag] = useState('🇮🇳');
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [contactSync, setContactSync] = useState(false);
    const [hiddenMode, setHiddenMode] = useState(false);

    const panY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

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
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
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
                    <View style={styles.header}>
                        <View style={styles.handleBar} />
                        <Text style={styles.title}>security & privacy</Text>
                        <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
                            <Text style={styles.doneText}>done</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
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
                            <Text style={styles.helperText}>your number is used for recovery and security alerts.</Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionHeader}>privacy</Text>
                            <View style={styles.card}>
                                <SecurityOption
                                    icon="people-outline"
                                    label="contact sync"
                                    value={contactSync}
                                    onValueChange={setContactSync}
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
                                <Text style={styles.infoText}>• sync contacts to find and connect with friends who are already here.</Text>
                                <Text style={styles.infoText}>• when active, your profile won't appear in explore or search results.</Text>
                            </View>
                        </View>
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
        backgroundColor: '#F8F7F2', // Solid off-white/beige ("darker white shade")
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
        shadowColor: "#000",
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
    optionContainer: {
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
    }
});
