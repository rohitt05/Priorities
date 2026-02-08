import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Animated,
    TouchableOpacity,
    Pressable,
    Dimensions,
    Easing,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Entypo, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface User {
    id: string;
    name: string;
    profilePicture: string;
    birthday: string;
    dominantColor: string;
}

interface TimelineBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    user: User | null;
}

export default function TimelineBottomSheet({ visible, onClose, user }: TimelineBottomSheetProps) {
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const activeColor = user?.dominantColor || '#fff';

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 20,
                    mass: 0.8,
                    stiffness: 140,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: SCREEN_HEIGHT,
                    duration: 250,
                    useNativeDriver: true,
                    easing: Easing.in(Easing.ease),
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    if (!user) return null;

    return (
        <Modal
            transparent
            visible={visible}
            onRequestClose={onClose}
            animationType="none"
            statusBarTranslucent={true}
        >
            <View style={styles.overlayWrapper}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                    <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
                </Pressable>

                <Animated.View
                    style={[
                        styles.sheetContainer,
                        { transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    {/* Background Layer - MATCHING HEADER EXACTLY */}
                    <View style={StyleSheet.absoluteFill}>
                        {/* 1. White Base */}
                        <View style={{ flex: 1, backgroundColor: '#ffffff' }} />

                        {/* 2. Color Overlay (Opacity 0.25 to match Header) */}
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: activeColor, opacity: 0.25 }]} />

                        {/* 3. Blur (Intensity 80 to match Header) */}
                        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
                    </View>

                    <View style={{ paddingBottom: Math.max(insets.bottom, 24) }}>

                        <View style={styles.indicatorWrapper}>
                            <View style={styles.indicator} />
                        </View>

                        <View style={styles.actionsContainer}>

                            <ActionButton
                                icon={<Entypo name="camera" size={20} color="#000" />}
                                label="Share a Moment"
                                color="#000"
                            />

                            <ActionButton
                                icon={<Feather name="user" size={22} color="#000" />}
                                label="View Profile"
                                color="#000"
                            />

                            <View style={styles.separator} />

                            <ActionButton
                                icon={<Feather name="user-x" size={22} color="#000" />}
                                label="Remove from Priorities"
                                color="#000"
                            />

                            <ActionButton
                                icon={<MaterialCommunityIcons name="block-helper" size={20} color="#FF3B30" />}
                                label="Block User"
                                color="#FF3B30"
                                hideArrow
                            />

                        </View>
                    </View>

                    {/* Filler for safe area */}
                    <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, height: 500 }}>
                        <View style={{ flex: 1, backgroundColor: '#fff' }} />
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: activeColor, opacity: 0.25 }]} />
                        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
                    </View>

                </Animated.View>
            </View>
        </Modal>
    );
}

const ActionButton = ({
    icon,
    label,
    color,
    hideArrow
}: {
    icon: any;
    label: string;
    color: string;
    hideArrow?: boolean;
}) => (
    <TouchableOpacity style={styles.actionRow} activeOpacity={0.6}>
        <View style={styles.iconBox}>
            {icon}
        </View>
        <Text style={[styles.actionLabel, { color }]}>{label}</Text>
        {!hideArrow && <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />}
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    overlayWrapper: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    sheetContainer: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 24,
        overflow: 'hidden',
    },
    indicatorWrapper: {
        alignItems: 'center',
        paddingVertical: 14,
    },
    indicator: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    actionsContainer: {
        paddingHorizontal: 24,
        paddingTop: 10,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'transparent',
    },
    iconBox: {
        width: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    actionLabel: {
        flex: 1,
        fontSize: 17,
        fontWeight: '500',
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.08)',
        marginVertical: 12,
    },
});
