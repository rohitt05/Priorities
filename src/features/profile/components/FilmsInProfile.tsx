// src/features/profile/components/FilmsInProfile.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '@/theme/theme';
import { filmService, FilmWithMeta } from '@/services/filmService';
import { MediaItem } from '@/types/mediaTypes';
import ProfileMediaModal from './ProfileMediaModal';
import TimelineVideoPreview from './TimelineVideoPreview';
import { SharedValue } from 'react-native-reanimated';
import { getImageSource } from '@/utils/getMediaSource';

const { width } = Dimensions.get('window');

const TIMELINE_ITEM_WIDTH = width * 0.40;
const SINGLE_ITEM_HEIGHT = TIMELINE_ITEM_WIDTH * 1.3;
const STALE_MS = 5 * 60 * 1000; // 5 minutes — don't re-fetch if data is still fresh

interface FilmsInProfileProps {
    userUUID: string;       // creator_id UUID — NOT the @handle
    dominantColor: string;
    scrollY?: SharedValue<number>;
    isOwner?: boolean;
}

export const FilmsInProfile: React.FC<FilmsInProfileProps> = ({ userUUID, dominantColor, scrollY, isOwner }) => {
    const [films, setFilms] = useState<FilmWithMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [initialViewerIndex, setInitialViewerIndex] = useState(0);

    // ── Stale-time ref — tracks when we last fetched for this userUUID ────────
    const lastFetchedAt = useRef<number>(0);
    const lastFetchedUUID = useRef<string>('');

    // ── Fetch ALL films for this profile (no 24hr cutoff) ────────────────────
    useEffect(() => {
        console.warn(`[MountTracker] FilmsInProfile mounted for userUUID: ${userUUID}`);
    }, []);
    useEffect(() => {
        console.log('[FilmsInProfile] MOUNTED');
        return () => console.log('[FilmsInProfile] UNMOUNTED');
    }, []);

    useEffect(() => {
        if (!userUUID) return;

        const now = Date.now();
        const isSameUser = lastFetchedUUID.current === userUUID;
        const isStillFresh = now - lastFetchedAt.current < STALE_MS;

        // Skip the network call if we already have data for this user fetched recently
        if (isSameUser && isStillFresh && films.length > 0) return;

        setLoading(true);
        setFilms([]);
        filmService
            .getAllFilmsByUserId(userUUID)
            .then((data) => {
                setFilms(data);
                lastFetchedAt.current = Date.now();
                lastFetchedUUID.current = userUUID;
            })
            .catch(() => setFilms([]))
            .finally(() => setLoading(false));
    }, [userUUID]);

    // ── Map to MediaItem for the modal viewer ─────────────────────────────────
    const allMappedMediaParams = useMemo((): MediaItem[] =>
        films.map((f) => ({
            id: f.id,
            type: f.type === 'image' ? 'photo' : 'video',
            uri: f.uri,
            thumbUri: f.thumbnail,
            timestamp: f.createdAt,
        })),
        [films]
    );

    // ── Group films by calendar day ───────────────────────────────────────────
    const groupedFilms = useMemo(() => {
        const groups: Record<string, FilmWithMeta[]> = {};

        films.forEach((film) => {
            const d = new Date(film.createdAt);
            const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(film);
        });

        return Object.keys(groups)
            .map((key) => ({
                dateKey: key,
                timestamp: groups[key][0].createdAt,
                films: groups[key],
            }))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [films]);

    const extractDateText = (isoString: string) => {
        const date = new Date(isoString);
        return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' }).toLowerCase()}`;
    };

    const handleMediaPress = (filmId: string) => {
        const index = allMappedMediaParams.findIndex((m) => m.id === filmId);
        setInitialViewerIndex(index >= 0 ? index : 0);
        setViewerVisible(true);
    };

    const renderMediaGroup = (groupFilms: FilmWithMeta[]) => {
        const count = groupFilms.length;

        if (count === 1) {
            const film = groupFilms[0];
            return (
                <TouchableOpacity
                    activeOpacity={0.9}
                    style={[styles.mediaCard, { width: TIMELINE_ITEM_WIDTH, height: SINGLE_ITEM_HEIGHT }]}
                    onPress={() => handleMediaPress(film.id)}
                >
                    {film.type === 'video' ? (
                        <TimelineVideoPreview
                            uri={film.uri}
                            thumbnailUri={film.thumbnail ?? film.uri}
                            scrollY={scrollY}
                            style={styles.mediaThumbnail}
                        />
                    ) : (
                        <Image
                            source={getImageSource(film.thumbnail ?? film.uri)}
                            style={styles.mediaThumbnail}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                        />
                    )}
                </TouchableOpacity>
            );
        }

        if (count === 2) {
            return (
                <View style={{ flexDirection: 'row', width: TIMELINE_ITEM_WIDTH, gap: 4, height: TIMELINE_ITEM_WIDTH * 0.8 }}>
                    {groupFilms.map((film) => (
                        <TouchableOpacity
                            key={film.id}
                            activeOpacity={0.9}
                            style={[styles.mediaCard, { flex: 1, height: '100%' }]}
                            onPress={() => handleMediaPress(film.id)}
                        >
                            {film.type === 'video' ? (
                                <TimelineVideoPreview
                                    uri={film.uri}
                                    thumbnailUri={film.thumbnail ?? film.uri}
                                    scrollY={scrollY}
                                    style={styles.mediaThumbnail}
                                />
                            ) : (
                                <Image
                                    source={getImageSource(film.thumbnail ?? film.uri)}
                                    style={styles.mediaThumbnail}
                                    contentFit="cover"
                                    cachePolicy="memory-disk"
                                />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            );
        }

        // 3+ items — grid
        return (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: TIMELINE_ITEM_WIDTH, gap: 4 }}>
                {groupFilms.map((film) => (
                    <TouchableOpacity
                        key={film.id}
                        activeOpacity={0.9}
                        style={[styles.mediaCard, {
                            width: (TIMELINE_ITEM_WIDTH - 8) / 3,
                            height: (TIMELINE_ITEM_WIDTH - 8) / 3,
                        }]}
                        onPress={() => handleMediaPress(film.id)}
                    >
                        {film.type === 'video' ? (
                            <TimelineVideoPreview
                                uri={film.uri}
                                thumbnailUri={film.thumbnail ?? film.uri}
                                scrollY={scrollY}
                                style={styles.mediaThumbnail}
                            />
                        ) : (
                            <Image
                                source={getImageSource(film.thumbnail ?? film.uri)}
                                style={styles.mediaThumbnail}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                            />
                        )}
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    if (loading) return null;
    if (groupedFilms.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.sectionTitle}>Films</Text>
                <View style={[styles.badge, { backgroundColor: dominantColor + '40' }]}>
                    <Text style={[styles.badgeText, { color: '#2C2720' }]}>
                        {films.length}
                    </Text>
                </View>
            </View>

            <View style={styles.timelineContainer}>
                {/* Center continuous vertical line */}
                <View style={styles.centerLine} />

                {groupedFilms.map((group, index) => {
                    const isEven = index % 2 === 0;

                    return (
                        <View key={group.dateKey} style={styles.timelineRow}>

                            {/* LEFT SIDE */}
                            <View style={[styles.halfSide, { alignItems: 'flex-end', paddingRight: 20 }]}>
                                {isEven
                                    ? renderMediaGroup(group.films)
                                    : <Text style={styles.dateText}>{extractDateText(group.timestamp)}</Text>
                                }
                            </View>

                            {/* CENTER DOT */}
                            <View style={styles.centerDotContainer}>
                                <View style={[styles.centerDot, { backgroundColor: dominantColor }]} />
                            </View>

                            {/* RIGHT SIDE */}
                            <View style={[styles.halfSide, { alignItems: 'flex-start', paddingLeft: 20 }]}>
                                {!isEven
                                    ? renderMediaGroup(group.films)
                                    : <Text style={styles.dateText}>{extractDateText(group.timestamp)}</Text>
                                }
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
                isOwner={isOwner}
                onDeleteSuccess={(id) => {
                    setFilms(prev => prev.filter(f => f.id !== id));
                    // Reset stale timer so next open re-fetches the updated list
                    lastFetchedAt.current = 0;
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: SPACING.xl,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.xl,
        paddingHorizontal: 24,
        gap: 8,
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
        fontFamily: FONTS.bold,
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
        backgroundColor: COLORS.background,
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 6,
    },
    mediaThumbnail: {
        width: '100%',
        height: '100%',
    },
});

export default FilmsInProfile;