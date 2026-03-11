import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { User } from '@/types/domain';
import usersData from '@/data/users.json';
import { COLORS, SPACING, FONTS, FONT_SIZES } from '@/theme/theme';
import { CURRENT_USER_ID } from '@/features/profile/utils/profileConstants';

type YourPrioritiesProps = {
    user: User;
    onUnauthorizedAccess?: () => void;
};

export const YourPriorities: React.FC<YourPrioritiesProps> = ({ user, onUnauthorizedAccess }) => {
    const router = useRouter();
    const [activeLongPressId, setActiveLongPressId] = useState<string | null>(null);

    // Resolve full user objects for priorities
    const prioritiesList = useMemo(() => {
        const list = (user as any).priorities;
        if (!list || !Array.isArray(list)) return [];

        return list
            .map((item) => {
                const id = typeof item === 'string' ? item : item?.uniqueUserId || item?.id;
                return (usersData as User[]).find((u) => u.uniqueUserId === id);
            })
            .filter((u): u is User => !!u);
    }, [user]);

    // Determine title based on whether viewing own profile or another's
    const title = useMemo(() => {
        if (user.uniqueUserId === CURRENT_USER_ID) {
            return "My Priorities";
        }
        const firstName = user.name ? user.name.split(' ')[0] : 'Their';
        return `${firstName}'s Priorities`;
    }, [user]);

    // Current user's priorities for access control
    const currentUserPriorities = useMemo(() => {
        const me = (usersData as User[]).find(u => u.uniqueUserId === CURRENT_USER_ID);
        return me?.priorities || [];
    }, []);

    if (prioritiesList.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.sectionContainer}>
                {/* Dynamic Title */}
                <Text style={styles.sectionTitle}>{title}</Text>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    style={styles.scrollView}
                >
                    {prioritiesList.slice(0, 10).map((u: User, index: number) => {
                        const isBeingPressed = activeLongPressId === u.uniqueUserId;

                        return (
                            <View key={u.uniqueUserId} style={[styles.itemWrapper, isBeingPressed && { zIndex: 1000 }]}>
                                {isBeingPressed && (
                                    <View style={styles.bubbleGhostWrapper}>
                                        <Reanimated.View 
                                            entering={FadeIn.duration(150)}
                                            exiting={FadeOut.duration(100)}
                                            style={styles.labelBubble}
                                        >
                                            <Text style={styles.labelText} numberOfLines={1}>
                                                {u.relationship || 'Friend'}
                                            </Text>
                                            <View style={styles.bubbleTail} />
                                        </Reanimated.View>
                                    </View>
                                )}

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.itemContainer,
                                        pressed && { transform: [{ scale: 0.94 }] }
                                    ]}
                                    onPress={() => {
                                        const canNavigate = 
                                            u.uniqueUserId === CURRENT_USER_ID || 
                                            currentUserPriorities.includes(u.uniqueUserId);

                                        if (canNavigate) {
                                            router.push({
                                                pathname: '/profile',
                                                params: { userId: u.uniqueUserId }
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
                                            <Image source={{ uri: u.profilePicture }} style={styles.avatarImage} />
                                        ) : (
                                            <View style={[styles.avatarImage, styles.placeholder]}>
                                                <Text style={styles.initials}>
                                                    {u.name?.[0]?.toUpperCase() || '?'}
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
        paddingTop: 45, // Enough room for the bubble inside the scroll container
        paddingBottom: 10,
        alignItems: 'center',
    },
    scrollView: {
        marginTop: -35, // Pulls the scroll container up so items stay near the title
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
        left: -470, // (1000 - 60) / 2 = 470. Perfectly centers the 1000px container over the 60px avatar.
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
        bottom: -4, // Moved from top to bottom avoid overlap with label
        right: -8, // Moved from left to right avoid overlap
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
    },
    avatarImage: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.surfaceLight,
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
