// src/features/profile/components/yourpriorities.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { User } from '@/types/domain';
import { COLORS, SPACING, FONTS, FONT_SIZES } from '@/theme/theme';
import { getMyPriorities } from '@/services/priorityService';
import { useAuthUser } from '@/features/profile/hooks/useAuthUser';
import { usePrioritiesRefresh } from '@/contexts/PrioritiesRefreshContext';
import { getAvatarSource } from '@/utils/getMediaSource';

type Priority = {
    id: string;
    uniqueUserId: string;
    name: string;
    profilePicture: string;
    dominantColor: string;
    relationship: string | null;
    partnerId: string | null;
    rank: number;
    pinned: boolean;
    priorityRowId: string;
};

type YourPrioritiesProps = {
    user: User;
    onUnauthorizedAccess?: () => void;
};

export const YourPriorities: React.FC<YourPrioritiesProps> = ({ user, onUnauthorizedAccess }) => {
    const router = useRouter();
    const authId = useAuthUser();
    const { refreshKey } = usePrioritiesRefresh();
    const [activeLongPressId, setActiveLongPressId] = useState<string | null>(null);

    const [prioritiesList, setPrioritiesList] = useState<Priority[]>([]);

    // UUIDs of people the VIEWER has in their own priority list
    const [myPriorityIds, setMyPriorityIds] = useState<Set<string>>(new Set());
    const [accessLoaded, setAccessLoaded] = useState(false);

    const isOwner = !!authId && authId === user.id;

    // ── Fetch priorities of the profile being viewed ───────────────────────
    useEffect(() => {
        if (!user.id) return;
        setPrioritiesList([]);
        getMyPriorities(user.id)
            .then((list) => setPrioritiesList(list as Priority[]))
            .catch(() => setPrioritiesList([]));
    }, [user.id, refreshKey]);

    // ── Fetch viewer's own priority UUIDs ──────────────────────────────────
    useEffect(() => {
        if (!authId) return;

        // Owner sees everything unblurred — no need to fetch
        if (isOwner) {
            setMyPriorityIds(new Set());
            setAccessLoaded(true);
            return;
        }

        setAccessLoaded(false);

        getMyPriorities(authId)
            .then((list) => {
                setMyPriorityIds(new Set((list as Priority[]).map((p) => p.id)));
                setAccessLoaded(true);
            })
            .catch(() => {
                setMyPriorityIds(new Set());
                setAccessLoaded(true);
            });
    }, [authId, isOwner, refreshKey]);

    const title = isOwner
        ? 'My Priorities'
        : `${user.name ? user.name.split(' ')[0] : 'Their'}'s Priorities`;

    if (prioritiesList.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>{title}</Text>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    style={styles.scrollView}
                >
                    {prioritiesList.slice(0, 9).map((u, index: number) => {
                        const isBeingPressed = activeLongPressId === u.uniqueUserId;

                        // ✅ Blur this avatar if:
                        // — viewer is NOT the owner AND
                        // — this priority person is NOT in the viewer's own priority list AND
                        // — this priority person is not the viewer themselves
                        const shouldBlur =
                            !isOwner &&
                            accessLoaded &&
                            u.id !== authId &&
                            !myPriorityIds.has(u.id);

                        return (
                            <View
                                key={u.uniqueUserId}
                                style={[styles.itemWrapper, isBeingPressed && { zIndex: 1000 }]}
                            >
                                {isBeingPressed && (
                                    <View style={styles.bubbleGhostWrapper}>
                                        <Reanimated.View
                                            entering={FadeIn.duration(150)}
                                            exiting={FadeOut.duration(100)}
                                            style={styles.labelBubble}
                                        >
                                            <Text style={styles.labelText} numberOfLines={1}>
                                                {u.relationship || u.name?.split(' ')[0] || 'Priority'}
                                            </Text>
                                            <View style={styles.bubbleTail} />
                                        </Reanimated.View>
                                    </View>
                                )}

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.itemContainer,
                                        pressed && { transform: [{ scale: 0.94 }] },
                                    ]}
                                    onPress={() => {
                                        if (!accessLoaded) return;

                                        const canNavigate =
                                            isOwner ||
                                            u.id === authId ||
                                            myPriorityIds.has(u.id);

                                        if (canNavigate) {
                                            router.push({
                                                pathname: '/profile',
                                                params: { userId: u.uniqueUserId },
                                            });
                                        } else {
                                            onUnauthorizedAccess?.();
                                        }
                                    }}
                                    onLongPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                        setActiveLongPressId(u.uniqueUserId);
                                    }}
                                    delayLongPress={200}
                                    onPressOut={() => setActiveLongPressId(null)}
                                >
                                    <View style={styles.cardContent}>
                                        {u.profilePicture ? (
                                            <>
                                                <Image
                                                    source={getAvatarSource(u.profilePicture)}
                                                    style={styles.avatarImage}
                                                    contentFit="cover"
                                                    cachePolicy="memory-disk"
                                                />
                                                {/* ── Blur overlay on avatar ── */}
                                                {shouldBlur && (
                                                    <BlurView
                                                        intensity={55}
                                                        tint="default"
                                                        style={[
                                                            StyleSheet.absoluteFill,
                                                            styles.avatarBlur,
                                                        ]}
                                                        experimentalBlurMethod="dimezisBlurView"
                                                    />
                                                )}
                                            </>
                                        ) : (
                                            <View style={[styles.avatarImage, styles.placeholder]}>
                                                <Text style={styles.initials}>
                                                    {shouldBlur
                                                        ? '?'
                                                        : u.name?.[0]?.toUpperCase() || '?'}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <Text style={styles.rankNumber}>{index + 1}</Text>
                                </Pressable>
                            </View>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: SPACING.md,
    },
    sectionContainer: {
        gap: SPACING.xs,
    },
    sectionTitle: {
        paddingHorizontal: 24,
        fontFamily: FONTS.bold,
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    scrollContent: {
        paddingHorizontal: 30,
        gap: 24,
        paddingTop: 45,
        paddingBottom: 10,
        alignItems: 'center',
    },
    scrollView: {
        marginTop: -35,
        overflow: 'visible',
    },
    itemWrapper: {
        alignItems: 'center',
        position: 'relative',
        width: 60,
    },
    bubbleGhostWrapper: {
        position: 'absolute',
        top: -48,
        width: 1000,
        left: -470,
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 100,
    },
    labelBubble: {
        backgroundColor: COLORS.text,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    labelText: {
        color: COLORS.background,
        fontSize: 11,
        fontFamily: FONTS.bold,
        fontWeight: '700',
        flexShrink: 0,
    },
    bubbleTail: {
        position: 'absolute',
        bottom: -4,
        width: 8,
        height: 8,
        backgroundColor: COLORS.text,
        transform: [{ rotate: '45deg' }],
    },
    itemContainer: {
        position: 'relative',
        width: 60,
        height: 60,
    },
    rankNumber: {
        position: 'absolute',
        bottom: -4,
        right: -8,
        fontSize: 24,
        fontFamily: FONTS.bold,
        fontWeight: '900',
        color: COLORS.secondary,
        textShadowColor: COLORS.background,
        textShadowOffset: { width: 1.5, height: 1.5 },
        textShadowRadius: 1,
        zIndex: 20,
        includeFontPadding: false,
    },
    cardContent: {
        zIndex: 10,
        shadowColor: COLORS.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
        backgroundColor: COLORS.surface,
        borderRadius: 28,
        overflow: 'hidden',      // ✅ needed so BlurView clips to the circle
    },
    avatarImage: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.surfaceLight,
    },
    avatarBlur: {
        borderRadius: 28,        // ✅ matches avatar shape
        zIndex: 5,
    },
    placeholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.secondary,
    },
    initials: {
        fontFamily: FONTS.bold,
        fontSize: FONT_SIZES.md,
        color: COLORS.surface,
    },
});

export default YourPriorities;