import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    Animated,
    Switch,
    Platform,
    Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, FONTS, FONT_SIZES, SPACING } from '@/theme/theme';
import { BackgroundProvider, useBackground } from '@/contexts/BackgroundContext';
import usersData from '@/data/users.json';

const { width } = Dimensions.get('window');

interface User {
    id: string;
    uniqueUserId: string;
    name: string;
    profilePicture: string;
    birthday: string;
    dominantColor: string;
}

const CURRENT_USER_ID = 'rohit123';

type SettingsRowProps = {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string;
    onPress?: () => void;
    right?: 'chevron' | 'none';
    toggle?: {
        value: boolean;
        onValueChange: (v: boolean) => void;
    };
};

function SettingsRow({ icon, label, value, onPress, right = 'chevron', toggle }: SettingsRowProps) {
    const content = (
        <View style={styles.row}>
            <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                    <Ionicons name={icon} size={18} color={COLORS.primary} />
                </View>
                <View style={styles.rowTextWrap}>
                    <Text style={styles.rowLabel}>{label}</Text>
                    {value ? <Text style={styles.rowValue}>{value}</Text> : null}
                </View>
            </View>

            <View style={styles.rowRight}>
                {toggle ? (
                    <Switch
                        value={toggle.value}
                        onValueChange={toggle.onValueChange}
                        trackColor={{ false: 'rgba(44, 39, 32, 0.15)', true: COLORS.primary }}
                        thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                        ios_backgroundColor={'rgba(44, 39, 32, 0.15)'}
                    />
                ) : right === 'chevron' ? (
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                ) : null}
            </View>
        </View>
    );

    if (toggle) return content;

    return (
        <TouchableOpacity activeOpacity={0.75} onPress={onPress} disabled={!onPress}>
            {content}
        </TouchableOpacity>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.card}>
                <BlurView intensity={35} tint="light" style={StyleSheet.absoluteFill} />
                <View style={styles.cardInner}>{children}</View>
            </View>
        </View>
    ); 
}

function SettingsScreenContent() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { bgColor, prevBgColor, colorAnim, handleColorChange } = useBackground();
    const [pushEnabled, setPushEnabled] = useState(true);
    const [hapticsEnabled, setHapticsEnabled] = useState(true);
    const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);

    const currentUser = useMemo(() => {
        const user = (usersData as User[]).find((u) => u.uniqueUserId === CURRENT_USER_ID);
        return user || (usersData[0] as User);
    }, []);

    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    useEffect(() => {
        const BG_OPACITY = 0.35;
        const lightDominantColor = currentUser
            ? hexToRgba(currentUser.dominantColor, BG_OPACITY)
            : COLORS.background;

        handleColorChange(lightDominantColor);

        return () => {
            handleColorChange(COLORS.background);
        };
    }, [currentUser, handleColorChange]);

    const animatedBgColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    const HEADER_HEIGHT = 60 + insets.top; // Approximate height

    return (
        <View style={styles.container}>
            {/* Main Background */}
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: animatedBgColor }]} />

            {/* Content ScrollView - goes UNDER the header */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={[
                    styles.contentContainer,
                    { paddingTop: HEADER_HEIGHT + SPACING.md } // Add padding so content starts below header
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Card Removed */}

                <Section title="account">
                    <SettingsRow icon="person-outline" label="profile" value="edit name, photo" onPress={() => router.push('/profile')} />
                    <View style={styles.divider} />
                    <SettingsRow icon="key-outline" label="security" value="passcode & privacy" onPress={() => { }} />
                </Section>

                <Section title="preferences">
                    <SettingsRow
                        icon="notifications-outline"
                        label="push notifications"
                        toggle={{ value: pushEnabled, onValueChange: setPushEnabled }}
                        right="none"
                    />
                    <View style={styles.divider} />
                    <SettingsRow
                        icon="sparkles-outline"
                        label="haptics"
                        toggle={{ value: hapticsEnabled, onValueChange: setHapticsEnabled }}
                        right="none"
                    />
                    <View style={styles.divider} />
                    <SettingsRow
                        icon="play-outline"
                        label="autoplay videos"
                        toggle={{ value: autoPlayEnabled, onValueChange: setAutoPlayEnabled }}
                        right="none"
                    />
                </Section>

                <Section title="support">
                    <SettingsRow icon="help-circle-outline" label="help" onPress={() => { }} />
                    <View style={styles.divider} />
                    <SettingsRow icon="document-text-outline" label="terms" onPress={() => { }} />
                    <View style={styles.divider} />
                    <SettingsRow icon="shield-checkmark-outline" label="privacy" onPress={() => { }} />
                </Section>

                <TouchableOpacity activeOpacity={0.8} style={styles.dangerButton} onPress={() => { }}>
                    <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                    <Text style={styles.dangerText}>sign out</Text>
                </TouchableOpacity>

                <Text style={styles.footer}>priorities</Text>
            </ScrollView>

            {/* Transparent Gradient Header Overlay */}
            <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
                {/* The gradient background itself */}
                <LinearGradient
                    colors={['rgba(240, 239, 233, 0.95)', 'rgba(240, 239, 233, 0.95)', 'rgba(240, 239, 233, 0)']}
                    locations={[0, 0.6, 1]}
                    style={StyleSheet.absoluteFill}
                />

                <View style={styles.header}>
                    <TouchableOpacity style={styles.iconButton} hitSlop={12} onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>settings</Text>
                    <View style={styles.rightSpacer} />
                </View>
            </View>
        </View>
    );
}

export default function SettingsScreen() {
    return (
        <BackgroundProvider>
            <SettingsScreenContent />
        </BackgroundProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingBottom: SPACING.lg, // Extra space for gradient fade at bottom
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.sm, // Adjust based on your header visual preference
        height: 50,
    },
    iconButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rightSpacer: {
        width: 40,
        height: 40,
    },
    title: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontFamily: FONTS.bold,
        fontWeight: '800',
        color: COLORS.text,
        textTransform: 'lowercase',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.xxl,
    },
    section: {
        marginTop: SPACING.xl,
    },
    sectionTitle: {
        fontSize: 12,
        fontFamily: FONTS.bold,
        fontWeight: '800',
        color: COLORS.textSecondary,
        letterSpacing: 0.6,
        textTransform: 'lowercase',
        marginBottom: 10,
        marginLeft: 4,
    },
    card: {
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.55)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: COLORS.border,
    },
    cardInner: {
        paddingVertical: 8,
    },
    row: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 12,
    },
    rowIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: 'rgba(44,39,32,0.06)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    rowTextWrap: {
        flex: 1,
    },
    rowLabel: {
        fontSize: FONT_SIZES.md,
        fontFamily: FONTS.bold,
        fontWeight: '700',
        color: COLORS.text,
        textTransform: 'lowercase',
    },
    rowValue: {
        marginTop: 2,
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        textTransform: 'lowercase',
    },
    rowRight: {
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: COLORS.border,
        marginLeft: SPACING.lg + 34 + 12,
    },
    dangerButton: {
        marginTop: SPACING.xl,
        height: 54,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.55)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    dangerText: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        fontWeight: '800',
        color: COLORS.error,
        textTransform: 'lowercase',
        letterSpacing: 0.4,
    },
    footer: {
        marginTop: SPACING.xl,
        textAlign: 'center',
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        textTransform: 'lowercase',
    },
});
