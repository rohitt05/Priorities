// src/features/partners/components/AddPartnerModal.tsx

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
    ActivityIndicator,
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
import { searchUsers, updateProfile } from '@/services/profileService';
import { getMyPriorities } from '@/services/priorityService';
import { Profile } from '@/types/domain';
import { supabase } from '@/lib/supabase';


const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;
const SWIPE_CLOSE_THRESHOLD = 80;
const TOP_SECTION_HEIGHT = 180;
const LIST_HEIGHT = SHEET_HEIGHT - TOP_SECTION_HEIGHT;


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
    const [results, setResults] = useState<any[]>([]);
    const [priorities, setPriorities] = useState<Profile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isPrioritiesLoading, setIsPrioritiesLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    const toOpaque = (color: string) => color.replace(/[\d.]+\)$/, '0.4)');

    const animatedSheetBgColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [toOpaque(prevBgColor), toOpaque(bgColor)],
    });

    // Fetch existing priorities on open
    useEffect(() => {
        if (!visible) return;
        
        setIsPrioritiesLoading(true);
        supabase.auth.getSession().then(({ data: { session } }) => {
            const authUUID = session?.user?.id;
            if (authUUID) {
                getMyPriorities(authUUID)
                    .then(list => setPriorities(list))
                    .catch(() => setPriorities([]))
                    .finally(() => setIsPrioritiesLoading(false));
            } else {
                setIsPrioritiesLoading(false);
            }
        });
    }, [visible]);

    // Debounced real Supabase search
    useEffect(() => {
        if (!visible) return;
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        if (!searchText.trim()) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        searchTimeout.current = setTimeout(async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const authUUID = session?.user?.id ?? '';
                const data = await searchUsers(searchText.trim(), [authUUID]);
                // Exclude yourself from results
                setResults(data.filter(u => u.unique_user_id !== currentUserUniqueUserId));
            } catch {
                setResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 350);

        return () => {
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
        };
    }, [searchText, visible]);

    useEffect(() => {
        if (visible) {
            swipeY.value = 0;
            setSearchText('');
            setAddedId(null);
            setResults([]);
            setIsSearching(false);
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

    const handleAdd = async (item: any) => {
        if (isSaving) return;
        try {
            setIsSaving(true);
            const { data: { session } } = await supabase.auth.getSession();
            const authUUID = session?.user?.id;
            if (!authUUID) return;

            // item.id = real UUID, item.unique_user_id = @handle text
            await updateProfile(authUUID, { partner_id: item.id });

            setAddedId(item.unique_user_id);
            onSelectPartner(item.unique_user_id);
            handleClose();
        } catch (e) {
            console.error('Failed to set partner:', e);
        } finally {
            setIsSaving(false);
        }
    };

    const renderUser = (item: any) => {
        const isAdded = addedId === item.unique_user_id;
        return (
            <View key={item.unique_user_id} style={styles.userRow}>
                {item.profile_picture ? (
                    <Image source={{ uri: item.profile_picture }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarInitial}>
                            {item.name?.[0]?.toUpperCase() || '?'}
                        </Text>
                    </View>
                )}
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userHandle}>@{item.unique_user_id}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.addButton, isAdded && styles.addButtonAdded]}
                    activeOpacity={0.75}
                    disabled={isSaving}
                    onPress={() => handleAdd(item)}
                >
                    {isSaving && addedId === item.unique_user_id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={[styles.addButtonText, isAdded && styles.addButtonTextAdded]}>
                            {isAdded ? 'added' : 'add'}
                        </Text>
                    )}
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

                    {/* Sheet */}
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
                                            {isSearching
                                                ? <ActivityIndicator size="small" color={COLORS.textSecondary} />
                                                : <FontAwesome5 name="search" size={14} color={COLORS.textSecondary} />
                                            }
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
                                {!searchText.trim() ? (
                                    <View>
                                        <Text style={styles.sectionTitle}>Your Priorities</Text>
                                        {isPrioritiesLoading ? (
                                            <ActivityIndicator size="small" color={COLORS.textSecondary} style={{ marginTop: 20 }} />
                                        ) : priorities.length === 0 ? (
                                            <Text style={styles.emptyText}>no priorities yet</Text>
                                        ) : (
                                            priorities.map((item) => renderUser({
                                                ...item,
                                                profile_picture: item.profilePicture, // Map domain to internal search result shape
                                                unique_user_id: item.uniqueUserId
                                            }))
                                        )}
                                        <Text style={[styles.emptyText, { marginTop: priorities.length > 0 ? 40 : 10 }]}>
                                            or search by name or @handle
                                        </Text>
                                    </View>
                                ) : isSearching ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="small" color={COLORS.textSecondary} />
                                    </View>
                                ) : results.length === 0 ? (
                                    <Text style={styles.emptyText}>no one found</Text>
                                ) : (
                                    results.map((item) => renderUser(item))
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
    sectionTitle: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 10,
        marginBottom: 8,
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
        width: 20,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    loadingContainer: {
        marginTop: 40,
        alignItems: 'center',
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
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.secondary,
    },
    avatarInitial: {
        fontFamily: FONTS.bold,
        fontSize: FONT_SIZES.sm,
        color: '#FFFFFF',
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
        minWidth: 56,
        alignItems: 'center',
        justifyContent: 'center',
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