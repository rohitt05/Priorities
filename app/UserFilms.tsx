import React, { useState } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity,
    SafeAreaView, StatusBar, Modal, Image, Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/theme/theme';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    interpolateColor,
    useAnimatedScrollHandler,
    interpolate,
    Extrapolation,
    SharedValue
} from 'react-native-reanimated';
import userFilmsData from '@/data/userFilms.json';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = 160;
const STICKY_OFFSET = 100; // How far from top each card sticks

interface UserFilm {
    id: string;
    userId: string;
    mediaUrl: string;
    mediaType: string;
    timestamp: string;
    dayOfWeek: string;
}

// Separate animated card component — required so each card
// gets its own useAnimatedStyle hook (no hooks in loops!)
const AnimatedCard = ({
    film,
    index,
    scrollY,
    assignedColor,
    isLast,
    totalCards,
    onPress,
    formatDate,
    formatTime,
}: {
    film: UserFilm;
    index: number;
    scrollY: SharedValue<number>;
    assignedColor: string;
    isLast: boolean;
    totalCards: number;
    onPress: () => void;
    formatDate: (s: string) => string;
    formatTime: (s: string) => string;
}) => {
    // We add 130 padding to the scroll view, so the natural position in the scroll view coords
    const PADDING_TOP = 130;
    const naturalPosition = PADDING_TOP + index * (CARD_HEIGHT - 80);
    const stickyTop = STICKY_OFFSET + index * 18;

    // The scroll Y value where this card's TOP edge reaches its stickyTop on screen
    const stickStart = Math.max(0, naturalPosition - stickyTop);

    // The stickStart of the LAST card
    const lastNaturalPos = PADDING_TOP + (totalCards - 1) * (CARD_HEIGHT - 80);
    const lastStickyTop = STICKY_OFFSET + (totalCards - 1) * 18;
    const maxStickStart = Math.max(0, lastNaturalPos - lastStickyTop);

    const animatedStyle = useAnimatedStyle(() => {
        let translation = 0;
        if (scrollY.value > stickStart) {
            translation = scrollY.value - stickStart;
        }

        // Cap the sticking so that when the LAST card sticks, they ALL stop translating down.
        // This causes the entire stack to scroll up off the screen together, revealing the bottom space.
        const maxTranslation = Math.max(0, maxStickStart - stickStart);
        const finalTranslateY = Math.min(translation, maxTranslation);

        const scale = interpolate(
            translation,
            [0, CARD_HEIGHT],
            [1, 0.95],
            Extrapolation.CLAMP
        );

        return {
            transform: [{ translateY: finalTranslateY }, { scale }],
        };
    });

    return (
        <Animated.View
            style={[
                styles.card,
                {
                    backgroundColor: assignedColor,
                    zIndex: index + 1,
                    height: isLast ? undefined : CARD_HEIGHT,
                    flex: isLast ? 1 : undefined,
                    minHeight: isLast ? SCREEN_HEIGHT * 0.6 : undefined,
                    marginTop: index === 0 ? 0 : -80,
                    // ✅ We DO NOT put overflow: hidden here anymore, so the tail works!
                },
                animatedStyle,
            ]}
        >
            {/* ✅ Image Wrapper: We hide overflow here so it matches the card's top rounded corners */}
            <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderTopLeftRadius: 40, borderTopRightRadius: 40 }]}>
                <Image
                    source={{ uri: film.mediaUrl }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                />
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.15)' }]} />
            </View>

            {/* ✅ MAGIC TAIL: Back and working! Bleeds infinitely off the bottom screen edge */}
            {isLast && (
                <View
                    style={{
                        position: 'absolute',
                        top: 100,
                        bottom: -1000, // Extends 1000px downward
                        left: 0,
                        right: 0,
                        // We use the image + overlay here too so the tail matches perfectly
                        overflow: 'hidden'
                    }}
                >
                    <Image
                        source={{ uri: film.mediaUrl }}
                        style={{ position: 'absolute', top: -100, left: 0, width: '100%', height: SCREEN_HEIGHT }}
                        resizeMode="cover"
                    />
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.15)' }]} />
                </View>
            )}

            <TouchableOpacity
                activeOpacity={0.9}
                onPress={onPress}
                style={{ flex: 1 }}
            >
                <View style={styles.cardTopRow}>
                    <View style={styles.cardLeft}>
                        <Ionicons
                            name={film.mediaType === 'video' ? 'play-circle' : 'image'}
                            size={24}
                            color="rgba(255,255,255,0.9)"
                        />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.dateText, { color: '#FFF' }]}>{formatDate(film.timestamp)}</Text>
                        <Text style={[styles.timeText, { color: 'rgba(255,255,255,0.8)' }]}>{formatTime(film.timestamp)}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const UserFilms = () => {
    const router = useRouter();
    const { userId, userName, dominantColor } = useLocalSearchParams<{
        userId: string;
        userName: string;
        dominantColor?: string;
    }>();

    const [activeMedia, setActiveMedia] = useState<UserFilm | null>(null);

    const bgColorProgress = useSharedValue(0);
    const scrollY = useSharedValue(0); // 👈 tracks scroll position

    React.useEffect(() => {
        bgColorProgress.value = withTiming(1, { duration: 800 });
    }, []);

    const animatedBgStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            bgColorProgress.value,
            [0, 1],
            ['#000000', dominantColor || '#000000']
        )
    }));

    // Scroll handler — feeds scrollY to all cards
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        }
    });

    const dayBgOpacityStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [0, 80],
            [1, 0],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    let userFilms = (userFilmsData as UserFilm[]).filter(f => f.userId === userId);
    userFilms.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const themeColors = Object.values(COLORS.PALETTE);
    const userColorOffset = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const topDay = userFilms.length > 0 ? userFilms[userFilms.length - 1].dayOfWeek : 'Today';

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <Animated.View style={[styles.container, animatedBgStyle]}>
            <SafeAreaView style={{ flex: 1 }}>
                <StatusBar barStyle="light-content" />

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="close-outline" size={32} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerSubtitle}>WATCHING STORIES</Text>
                        <Text style={styles.headerTitle}>{userName}</Text>
                    </View>
                    <View style={{ width: 44 }} />
                </View>

                {userFilms.length === 0 ? (
                    <View style={styles.content}>
                        <View style={styles.placeholderCard}>
                            <Ionicons name="film-outline" size={64} color="rgba(255,255,255,0.2)" />
                            <Text style={styles.placeholderText}>
                                {userName || 'This user'} hasn't posted a Film of the Day today.
                            </Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.listContainer}>
                        {/* Background for the Huge Day Title that fades out as we scroll */}
                        <Animated.View style={[
                            { position: 'absolute', top: 0, left: 0, right: 0, height: 130, zIndex: 5 },
                            animatedBgStyle,
                            dayBgOpacityStyle
                        ]} />

                        <View style={styles.dayTitleContainer}>
                            <Text style={styles.hugeDayTitle}>{topDay}</Text>
                        </View>

                        {/* ✅ Animated.ScrollView replaces plain ScrollView */}
                        <Animated.ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={[
                                styles.scrollContent,
                                { paddingTop: 130, paddingBottom: 120 }
                            ]}
                            showsVerticalScrollIndicator={false}
                            onScroll={scrollHandler}       // 👈 Reanimated scroll handler
                            scrollEventThrottle={16}       // 👈 60fps updates
                        >
                            {userFilms.map((film, index) => {
                                const assignedColor = themeColors[(index + userColorOffset) % themeColors.length];
                                const isLast = index === userFilms.length - 1;

                                return (
                                    <AnimatedCard
                                        key={film.id}
                                        film={film}
                                        index={index}
                                        scrollY={scrollY}
                                        assignedColor={assignedColor as string}
                                        isLast={isLast}
                                        totalCards={userFilms.length}
                                        onPress={() => setActiveMedia(film)}
                                        formatDate={formatDate}
                                        formatTime={formatTime}
                                    />
                                );
                            })}
                        </Animated.ScrollView>
                    </View>
                )}
            </SafeAreaView>

            {/* Media Modal — unchanged */}
            <Modal
                visible={!!activeMedia}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setActiveMedia(null)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalCloseButton}
                        onPress={() => setActiveMedia(null)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="close-circle" size={40} color="#FFF" />
                    </TouchableOpacity>
                    {activeMedia && (
                        <View style={styles.mediaContainer}>
                            <Image
                                source={{ uri: activeMedia.mediaUrl }}
                                style={styles.fullMedia}
                                resizeMode="contain"
                            />
                            <View style={styles.mediaFooter}>
                                <Text style={styles.mediaDay}>{activeMedia.dayOfWeek}</Text>
                                <Text style={styles.mediaTime}>{formatTime(activeMedia.timestamp)}</Text>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>
        </Animated.View>
    );
};

// Styles remain identical to original — no changes needed
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingHorizontal: 16,
        paddingTop: 10, height: 80,
    },
    backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { alignItems: 'center' },
    headerSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: FONTS.medium, letterSpacing: 2 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: FONTS.bold, letterSpacing: 4, marginTop: 4 },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    placeholderCard: {
        alignItems: 'center', justifyContent: 'center', padding: 40,
        borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.05)', width: '100%',
    },
    placeholderText: {
        color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: FONTS.medium,
        textAlign: 'center', marginTop: 20, lineHeight: 22,
    },
    listContainer: { flex: 1, paddingTop: 0 },
    dayTitleContainer: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 10,
        paddingTop: 20,
    },
    hugeDayTitle: {
        fontSize: 64, fontFamily: FONTS.bold, color: '#FFF',
        marginBottom: 20, letterSpacing: -1, paddingHorizontal: 20,
    },
    scrollView: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 0 },
    card: {
        borderTopLeftRadius: 40, borderTopRightRadius: 40,
        padding: 24, shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.15, shadowRadius: 10,
        elevation: 10, width: '100%',
    },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardLeft: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center', alignItems: 'center',
    },
    dateText: { fontSize: 14, fontFamily: FONTS.bold, color: 'rgba(0,0,0,0.8)' },
    timeText: { fontSize: 12, fontFamily: FONTS.medium, color: 'rgba(0,0,0,0.5)', marginTop: 2 },
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center', alignItems: 'center', paddingTop: 50,
    },
    modalCloseButton: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
    mediaContainer: { width: '100%', height: '80%', justifyContent: 'center', alignItems: 'center' },
    fullMedia: { width: '100%', height: '100%', borderRadius: 20 },
    mediaFooter: {
        position: 'absolute', bottom: 20, alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 10,
        paddingHorizontal: 20, borderRadius: 20,
    },
    mediaDay: { color: '#FFF', fontSize: 18, fontFamily: FONTS.bold },
    mediaTime: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: FONTS.medium, marginTop: 4 },
});

export default UserFilms;
