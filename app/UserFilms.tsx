import React, { useState } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity,
    StatusBar, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    Extrapolation
} from 'react-native-reanimated';
import { filmService } from '@/services/filmService';
import { Film as UserFilm } from '@/types/domain';

// New Imports
import FilmCard from '../src/features/film-my-day/components/FilmCard';
import FilmMedia from '../src/features/film-my-day/components/FilmMedia';
import FilmStoryModal from '../src/features/film-my-day/components/FilmStoryModal';
import { formatDate, formatTime } from '../src/features/film-my-day/utils/dateUtils';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = 160;
const STICKY_OFFSET = 100;

const UserFilms = () => {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { userId, userName, dominantColor } = useLocalSearchParams<{
        userId: string;
        userName: string;
        dominantColor?: string;
    }>();

    const [modalVisible, setModalVisible] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const bgColorProgress = useSharedValue(0);
    const scrollY = useSharedValue(0);

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

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        }
    });

    const userFilms = React.useMemo(() => {
        const films = filmService.getFilmsByUserId(userId);
        return films.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, [userId]);

    const themeColors = Object.values(COLORS.PALETTE);
    const userColorOffset = React.useMemo(() =>
        userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0),
        [userId]);

    const topDay = React.useMemo(() => {
        if (userFilms.length === 0) return 'Today';
        return new Date(userFilms[userFilms.length - 1].createdAt).toLocaleDateString(undefined, { weekday: 'long' });
    }, [userFilms]);

    const handleCardPress = React.useCallback((index: number) => {
        setActiveIndex(index);
        setModalVisible(true);
    }, []);

    return (
        <Animated.View style={[styles.container, animatedBgStyle]}>
            <View style={{ flex: 1, paddingTop: insets.top + 5 }}>
                <StatusBar barStyle="light-content" />

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back-sharp" size={28} color="#2C2720" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>
                            <Text style={styles.headerSubtitle}>Watching films </Text>
                            {userName}
                        </Text>
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
                        <View style={styles.dayTitleContainer}>
                            <Text style={styles.hugeDayTitleShadow}>{topDay}</Text>
                            <Text style={styles.hugeDayTitle}>{topDay}</Text>
                        </View>

                        <Animated.ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={[
                                styles.scrollContent,
                                { paddingTop: 100, paddingBottom: 250 }
                            ]}
                            showsVerticalScrollIndicator={false}
                            onScroll={scrollHandler}
                            scrollEventThrottle={16}
                            decelerationRate={0.991}
                        >
                            {userFilms.map((film, index) => {
                                const assignedColor = themeColors[(index + userColorOffset) % themeColors.length];
                                const isLast = index === userFilms.length - 1;

                                const maxAllowedStickyTop = SCREEN_HEIGHT - (CARD_HEIGHT * 0.4) - (insets.top + 5) - 60;
                                const totalAvailableSpace = maxAllowedStickyTop - STICKY_OFFSET;
                                const idealGap = 18;
                                const dynamicGap = userFilms.length > 1
                                    ? Math.min(idealGap, totalAvailableSpace / (userFilms.length - 1))
                                    : idealGap;

                                return (
                                    <FilmCard
                                        key={film.id}
                                        film={film}
                                        index={index}
                                        scrollY={scrollY}
                                        assignedColor={assignedColor as string}
                                        isLast={isLast}
                                        totalCards={userFilms.length}
                                        onPress={() => handleCardPress(index)}
                                        dynamicGap={dynamicGap}
                                    />
                                );
                            })}
                        </Animated.ScrollView>
                    </View>
                )}
            </View>

            {/* 
              Persistent Stories Modal 
              Always mounted to enable continuous pre-loading of video players.
              Visibility and interaction are controlled by the visible prop.
            */}
            <FilmStoryModal
                films={userFilms}
                initialIndex={activeIndex}
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
            />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingHorizontal: 16,
        paddingTop: 0, height: 50,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    headerSubtitle: { color: '#2C2720', fontSize: 13, fontFamily: FONTS.medium, letterSpacing: 0.5 },
    headerTitle: { color: '#2C2720', fontSize: 13, fontFamily: FONTS.bold, letterSpacing: 0.5, textAlign: 'center' },
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
        top: -15, left: 0, right: 0,
        zIndex: 10,
        paddingTop: 0,
        height: 100,
        justifyContent: 'center',
    },
    hugeDayTitleShadow: {
        position: 'absolute',
        top: 5, left: 25,
        fontSize: 72, fontFamily: 'DancingScript-Bold', color: '#7C7267',
        opacity: 0.15, letterSpacing: -1,
    },
    hugeDayTitle: {
        fontSize: 56, fontFamily: FONTS.bold, color: '#2C2720',
        letterSpacing: -1, paddingHorizontal: 20,
    },
    scrollView: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 0 },
});

export default UserFilms;
