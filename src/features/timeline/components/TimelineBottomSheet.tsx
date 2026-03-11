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
import { useRouter } from 'expo-router';
import { User } from '@/types/userTypes';
import { COLORS, FONTS } from '@/theme/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');



interface TimelineBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    user: User | null;
}

export default function TimelineBottomSheet({ visible, onClose, user }: TimelineBottomSheetProps) {
    const insets = useSafeAreaInsets();
    const router = useRouter();
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

                        <View style={styles.gridContainer}>
                            <TouchableOpacity 
                                style={styles.gridItem}
                                activeOpacity={0.7}
                                onPress={() => {
                                    onClose();
                                    setTimeout(() => {
                                        router.push({
                                            pathname: '/FilmMyDay',
                                            params: { recipient: user.name, uniqueUserId: user.uniqueUserId }
                                        });
                                    }, 100);
                                }}
                            >
                                <View style={styles.iconContainer}>
                                    <Entypo name="camera" size={24} color="#000" />
                                </View>
                                <Text style={styles.gridLabel}>Share</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.gridItem}
                                activeOpacity={0.7}
                                onPress={() => {
                                    onClose();
                                    setTimeout(() => {
                                        router.push(`/profile?userId=${user.uniqueUserId}`);
                                    }, 100);
                                }}
                            >
                                <View style={styles.iconContainer}>
                                    <Feather name="user" size={26} color="#000" />
                                </View>
                                <Text style={styles.gridLabel}>Profile</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.gridItem}
                                activeOpacity={0.7}
                                onPress={() => {
                                    console.log('Delete entire timeline', user.uniqueUserId);
                                    onClose();
                                }}
                            >
                                <View style={[styles.iconContainer, { borderColor: '#FF3B30', borderWidth: 1 }]}>
                                    <MaterialCommunityIcons name="trash-can-outline" size={26} color="#FF3B30" />
                                </View>
                                <Text style={[styles.gridLabel, { color: '#FF3B30' }]}>Delete</Text>
                            </TouchableOpacity>
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
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    gridItem: {
        width: '33.33%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    gridLabel: {
        fontSize: 12,
        fontFamily: FONTS.bold,
        color: '#1C1917',
        opacity: 0.7,
        textAlign: 'center',
    },
});
