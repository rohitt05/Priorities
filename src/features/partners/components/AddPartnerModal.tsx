import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    StyleSheet,
    Text,
    Modal,
    Animated,
    TouchableWithoutFeedback,
    TouchableOpacity,
    Dimensions,
    Easing,
    TextInput,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    GestureHandlerRootView,
    GestureDetector,
    Gesture,
    ScrollView,
} from 'react-native-gesture-handler';
import { useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import Reanimated from 'react-native-reanimated';
import { FontAwesome5 } from '@expo/vector-icons';

import { COLORS, FONTS, FONT_SIZES } from '@/theme/theme';
import { useBackground } from '@/contexts/BackgroundContext';
import usersData from '@/data/users.json';


const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;
const SWIPE_CLOSE_THRESHOLD = 80;

// Top section approximate height: handle + title + searchbar + padding
const TOP_SECTION_HEIGHT = 180;
const LIST_HEIGHT = SHEET_HEIGHT - TOP_SECTION_HEIGHT;


import { User } from '@/types/userTypes';


interface AddPartnerModalProps {
    visible: boolean;
    onClose: () => void;
    currentUserUniqueUserId: string;
    onSelectPartner: (partnerUniqueUserId: string) => void;
}


export default function AddPartnerModal({
    visible,
    onClose,
    currentUserUniqueUserId,
    onSelectPartner,
}: AddPartnerModalProps) {
    const insets = useSafeAreaInsets();
    const { bgColor, prevBgColor, colorAnim } = useBackground();

    const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const swipeY = useSharedValue(0);

    const [searchText, setSearchText] = useState('');
    const [addedId, setAddedId] = useState<string | null>(null);

    const allUsers = (usersData as User[]).filter((u) => u.uniqueUserId !== currentUserUniqueUserId);

    const filteredUsers = allUsers.filter((u) => {
        const q = searchText.trim().toLowerCase();
        if (!q) return true;
        return (
            u.name.toLowerCase().includes(q) ||
            u.uniqueUserId.toLowerCase().includes(q)
        );
    });

    const toOpaque = (color: string) => color.replace(/[\d.]+\)$/, '0.4)');

    const animatedSheetBgColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [toOpaque(prevBgColor), toOpaque(bgColor)],
    });

    useEffect(() => {
        if (visible) {
            swipeY.value = 0;
            setSearchText('');
            setAddedId(null);
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 22,
                    mass: 0.9,
                    stiffness: 160,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            slideAnim.setValue(SHEET_HEIGHT);
            fadeAnim.setValue(0);
        }
    }, [visible]);


    const handleClose = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: SHEET_HEIGHT,
                duration: 220,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(({ finished }) => {
            if (finished) onClose();
        });
    };


    // Swipe only triggers when list is at top (not scrolled)
    const swipeGesture = Gesture.Pan()
        .activeOffsetY([10, 10])
        .onUpdate((event) => {
            if (event.translationY > 0) {
                swipeY.value = event.translationY;
            }
        })
        .onEnd((event) => {
            if (swipeY.value > SWIPE_CLOSE_THRESHOLD || event.velocityY > 800) {
                runOnJS(handleClose)();
            } else {
                swipeY.value = withSpring(0, { damping: 20, stiffness: 180 });
            }
        });


    const renderUser = ({ item }: { item: User }) => {
        const isAdded = addedId === item.uniqueUserId;
        return (
            <View key={item.uniqueUserId} style={styles.userRow}>
                <Image source={{ uri: item.profilePicture }} style={styles.avatar} />
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userHandle}>@{item.uniqueUserId}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.addButton, isAdded && styles.addButtonAdded]}
                    activeOpacity={0.75}
                    onPress={() => {
                        const next = isAdded ? null : item.uniqueUserId;
                        setAddedId(next);
                        if (next) {
                            onSelectPartner(next);
                            handleClose();
                        }
                    }}
                >
                    <Text style={[styles.addButtonText, isAdded && styles.addButtonTextAdded]}>
                        {isAdded ? 'added' : 'add'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };



    if (!visible) return null;


    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            statusBarTranslucent={true}
            onRequestClose={handleClose}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.overlay}>

                    {/* Backdrop */}
                    <TouchableWithoutFeedback onPress={handleClose}>
                        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
                    </TouchableWithoutFeedback>

                    {/* Sheet entry animation */}
                    <Animated.View style={[
                        styles.sheetContainer,
                        { transform: [{ translateY: slideAnim }] }
                    ]}>
                        <Reanimated.View style={[
                            styles.sheetInner,
                            { transform: [{ translateY: swipeY }] }
                        ]}>

                            {/* Layer 1: white base */}
                            <View style={[StyleSheet.absoluteFill, styles.sheetWhiteBase]} />

                            {/* Layer 2: color tint */}
                            <Animated.View
                                style={[
                                    StyleSheet.absoluteFill,
                                    styles.sheetBackground,
                                    { backgroundColor: animatedSheetBgColor }
                                ]}
                            />

                            {/* Handle + title + search — fixed, never scrolls */}
                            <GestureDetector gesture={swipeGesture}>
                                <View style={styles.topSection}>
                                    <View style={styles.handleContainer}>
                                        <View style={styles.handle} />
                                    </View>
                                    <Text style={styles.title}>Add your partner</Text>
                                    <View style={styles.searchBar}>
                                        <TextInput
                                            style={styles.searchInput}
                                            placeholder="who's your partner?"
                                            placeholderTextColor={COLORS.textSecondary}
                                            selectionColor={COLORS.primary}
                                            autoCorrect={false}
                                            autoCapitalize="none"
                                            value={searchText}
                                            onChangeText={setSearchText}
                                        />
                                        <View style={styles.searchIconWrapper}>
                                            <FontAwesome5
                                                name="search"
                                                size={14}
                                                color={COLORS.textSecondary}
                                            />
                                        </View>
                                    </View>
                                </View>
                            </GestureDetector>

                            {/* Scrollable list */}
                            <ScrollView
                                style={[styles.scrollView, { height: LIST_HEIGHT }]}
                                contentContainerStyle={[
                                    styles.scrollContent,
                                    { paddingBottom: Math.max(insets.bottom + 20, 32) }
                                ]}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                bounces={true}
                                scrollEventThrottle={16}
                            >
                                {filteredUsers.length === 0 ? (
                                    <Text style={styles.emptyText}>no one found</Text>
                                ) : (
                                    filteredUsers.map((item) => renderUser({ item }))
                                )}
                            </ScrollView>

                        </Reanimated.View>
                    </Animated.View>

                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}


const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    sheetContainer: {
        height: SHEET_HEIGHT,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
    },
    sheetInner: {
        flex: 1,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
    },
    sheetWhiteBase: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    sheetBackground: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    topSection: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
    },
    handleContainer: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 10,
    },
    handle: {
        width: 44,
        height: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    title: {
        fontSize: FONT_SIZES.lg,
        fontFamily: FONTS.bold,
        fontWeight: '800',
        color: '#2C2720',
        marginTop: 6,
        marginBottom: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(44, 39, 32, 0.06)',
        borderRadius: 18,
        paddingHorizontal: 16,
        height: 48,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchInput: {
        flex: 1,
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.regular,
        color: COLORS.text,
        paddingVertical: 0,
    },
    searchIconWrapper: {
        marginLeft: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: COLORS.surfaceLight,
    },
    userInfo: {
        flex: 1,
        marginLeft: 12,
    },
    userName: {
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.bold,
        fontWeight: '700',
        color: COLORS.text,
    },
    userHandle: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    addButton: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        backgroundColor: 'transparent',
    },
    addButtonAdded: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    addButtonText: {
        fontSize: 12,
        fontFamily: FONTS.bold,
        fontWeight: '700',
        color: COLORS.primary,
        textTransform: 'lowercase',
        letterSpacing: 0.3,
    },
    addButtonTextAdded: {
        color: '#FFFFFF',
    },
    emptyText: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        fontFamily: FONTS.regular,
        marginTop: 32,
    },
});
