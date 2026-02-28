import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '@/theme/theme';
import profileFilms from '@/data/profilesfilm.json';
import { MediaItem } from '@/types/mediaTypes';
import ProfileMediaModal from './ProfileMediaModal';
import TimelineVideoPreview from './TimelineVideoPreview';
import { SharedValue } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

// Responsive sizing for the timeline items
const TIMELINE_ITEM_WIDTH = width * 0.40; // Max width for a branch side
const SINGLE_ITEM_HEIGHT = TIMELINE_ITEM_WIDTH * 1.3;

interface FilmsInProfileProps {
    userId: string;
    dominantColor: string;
    scrollY?: SharedValue<number>;
}

export const FilmsInProfile: React.FC<FilmsInProfileProps> = ({ userId, dominantColor, scrollY }) => {
    const [viewerVisible, setViewerVisible] = React.useState(false);
    const [initialViewerIndex, setInitialViewerIndex] = React.useState(0);

    // Map all films to MediaItem structure so MediaViewer can read them
    const allMappedMediaParams = useMemo(() => {
        const films = profileFilms.filter(f => f.userId === userId);
        // Sort chronologically (descending for the timeline layout)
        const sorted = films.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return sorted.map((film): MediaItem => ({
            id: film.id,
            type: film.type === 'image' ? 'photo' : 'video',
            uri: film.uri || film.thumbnail,
            thumbUri: film.thumbnail,
            timestamp: film.timestamp,
        }));
    }, [userId]);

    // Group films by day
    const groupedFilms = useMemo(() => {
        const films = profileFilms.filter(f => f.userId === userId);

        // Group by YYYY-MM-DD
        const groups: Record<string, typeof films> = {};
        films.forEach(film => {
            const dateObj = new Date(film.timestamp);
            const key = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}-${dateObj.getDate()}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(film);
        });

        // Convert to array and sort days descending
        const sortedGroups = Object.keys(groups).map(key => ({
            dateKey: key,
            timestamp: groups[key][0].timestamp, // user first item's exact timestamp for display
            films: groups[key].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return sortedGroups;
    }, [userId]);

    if (groupedFilms.length === 0) return null;

    // Helper to format the date
    const extractDateText = (isoString: string) => {
        const date = new Date(isoString);
        return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' }).toLowerCase()}`;
    };

    const handleMediaPress = (filmId: string) => {
        const index = allMappedMediaParams.findIndex(m => m.id === filmId);
        setInitialViewerIndex(index >= 0 ? index : 0);
        setViewerVisible(true);
    };

    const renderMediaGroup = (films: typeof profileFilms) => {
        const count = films.length;

        if (count === 1) {
            const film = films[0];
            return (
                <TouchableOpacity
                    activeOpacity={0.9}
                    style={[styles.mediaCard, { width: TIMELINE_ITEM_WIDTH, height: SINGLE_ITEM_HEIGHT }]}
                    onPress={() => handleMediaPress(film.id)}
                >
                    {film.type === 'video' ? (
                        <TimelineVideoPreview
                            uri={film.uri || film.thumbnail}
                            thumbnailUri={film.thumbnail}
                            scrollY={scrollY}
                            style={styles.thumbnail}
                        />
                    ) : (
                        <Image source={{ uri: film.thumbnail }} style={styles.thumbnail} />
                    )}
                </TouchableOpacity>
            );
        }

        if (count === 2) {
            return (
                <View style={{ flexDirection: 'row', width: TIMELINE_ITEM_WIDTH, gap: 4, height: TIMELINE_ITEM_WIDTH * 0.8 }}>
                    {films.map(film => (
                        <TouchableOpacity
                            key={film.id}
                            activeOpacity={0.9}
                            style={[styles.mediaCard, { flex: 1, height: '100%' }]}
                            onPress={() => handleMediaPress(film.id)}
                        >
                            {film.type === 'video' ? (
                                <TimelineVideoPreview
                                    uri={film.uri || film.thumbnail}
                                    thumbnailUri={film.thumbnail}
                                    scrollY={scrollY}
                                    style={styles.thumbnail}
                                />
                            ) : (
                                <Image source={{ uri: film.thumbnail }} style={styles.thumbnail} cachePolicy="memory-disk" />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            );
        }

        // 3 or more items - grid layout
        return (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: TIMELINE_ITEM_WIDTH, gap: 4 }}>
                {films.map(film => (
                    <TouchableOpacity
                        key={film.id}
                        activeOpacity={0.9}
                        style={[styles.mediaCard, { width: (TIMELINE_ITEM_WIDTH - 8) / 3, height: (TIMELINE_ITEM_WIDTH - 8) / 3 }]}
                        onPress={() => handleMediaPress(film.id)}
                    >
                        {film.type === 'video' ? (
                            <TimelineVideoPreview
                                uri={film.uri || film.thumbnail}
                                thumbnailUri={film.thumbnail}
                                scrollY={scrollY}
                                style={styles.thumbnail}
                            />
                        ) : (
                            <Image source={{ uri: film.thumbnail }} style={styles.thumbnail} cachePolicy="memory-disk" />
                        )}
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.sectionTitle}>Films</Text>
                <View style={[styles.badge, { backgroundColor: dominantColor + '40' }]}>
                    <Text style={[styles.badgeText, { color: '#2C2720' }]}>
                        {groupedFilms.reduce((acc, curr) => acc + curr.films.length, 0)}
                    </Text>
                </View>
            </View>

            <View style={styles.timelineContainer}>
                {/* Center continuous vertical line */}
                <View style={styles.centerLine} />

                {groupedFilms.map((group, index) => {
                    const isEven = index % 2 === 0; // Even -> Media on Left, Date on Right

                    return (
                        <View key={group.dateKey} style={styles.timelineRow}>

                            {/* LEFT SIDE */}
                            <View style={[styles.halfSide, { alignItems: 'flex-end', paddingRight: 20 }]}>
                                {isEven ? renderMediaGroup(group.films) : (
                                    <Text style={styles.dateText}>{extractDateText(group.timestamp)}</Text>
                                )}
                            </View>

                            {/* CENTER DOT */}
                            <View style={styles.centerDotContainer}>
                                <View style={[styles.centerDot, { backgroundColor: dominantColor }]} />
                            </View>

                            {/* RIGHT SIDE */}
                            <View style={[styles.halfSide, { alignItems: 'flex-start', paddingLeft: 20 }]}>
                                {!isEven ? renderMediaGroup(group.films) : (
                                    <Text style={styles.dateText}>{extractDateText(group.timestamp)}</Text>
                                )}
                            </View>

                        </View>
                    );
                })}
            </View>

            <ProfileMediaModal
                visible={viewerVisible}
                initialIndex={initialViewerIndex}
                mediaItems={allMappedMediaParams}
                onClose={() => setViewerVisible(false)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: SPACING.xl,
        paddingBottom: 40
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.xl,
        paddingHorizontal: 24,
        gap: 8
    },
    sectionTitle: {
        fontFamily: FONTS.bold,
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: {
        fontSize: 10,
        fontFamily: FONTS.bold
    },
    timelineContainer: {
        position: 'relative',
        width: '100%',
        alignItems: 'center',
    },
    centerLine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: COLORS.border,
        left: '50%',
        transform: [{ translateX: -0.5 }],
    },
    timelineRow: {
        flexDirection: 'row',
        width: '100%',
        alignItems: 'center',
        marginBottom: SPACING.xl,
        position: 'relative',
    },
    halfSide: {
        flex: 1,
        justifyContent: 'center',
    },
    centerDotContainer: {
        width: 12,
        height: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background, // Match screen background to clip line
        position: 'absolute',
        left: '50%',
        transform: [{ translateX: -6 }],
        zIndex: 10,
    },
    centerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dateText: {
        fontFamily: FONTS.bold,
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
        opacity: 0.8,
    },
    mediaCard: {
        width: TIMELINE_ITEM_WIDTH,
        height: SINGLE_ITEM_HEIGHT,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: COLORS.surfaceLight,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 6,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    videoIndicator: {
        position: 'absolute',
        top: 8,
        right: 8,
        // Removed backgroundColor, padding, and borderRadius
    },
    videoIndicatorSmall: {
        position: 'absolute',
        top: 4,
        right: 4,
        // Removed backgroundColor, padding, and borderRadius
    },
    iconShadow: {
        // Added text shadow so the white icon remains visible against light video thumbnails
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    }
});

export default FilmsInProfile;
