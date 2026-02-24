import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { User } from '@/types/userTypes';
import usersData from '@/data/users.json';
import { COLORS, SPACING, FONTS, FONT_SIZES } from '@/theme/theme';
import { CURRENT_USER_ID } from '@/features/profile/utils/profileConstants';

type YourPrioritiesProps = {
    user: User;
};

export const YourPriorities: React.FC<YourPrioritiesProps> = ({ user }) => {
    const router = useRouter();

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
                >
                    {prioritiesList.slice(0, 10).map((u: User, index: number) => (
                        <TouchableOpacity
                            key={u.uniqueUserId}
                            style={styles.itemContainer}
                            activeOpacity={0.7}
                            onPress={() => {
                                router.push({
                                    pathname: '/profile',
                                    params: { userId: u.uniqueUserId }
                                });
                            }}
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
                        </TouchableOpacity>
                    ))}
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
        paddingTop: 15,
        paddingBottom: 10,
        alignItems: 'center',
    },
    itemContainer: {
        position: 'relative',
        width: 60,
        height: 60,
    },
    rankNumber: {
        position: 'absolute',
        top: -8,
        left: -12,
        fontSize: 28,
        fontFamily: FONTS.bold,
        fontWeight: '900',
        color: COLORS.secondary,
        textShadowColor: COLORS.background,
        textShadowOffset: { width: 1.5, height: 1.5 },
        textShadowRadius: 1,
        zIndex: 1, // Changed to 1 (Lower than cardContent)
        includeFontPadding: false,
    },
    cardContent: {
        zIndex: 10, // Changed to 10 (Higher than rankNumber)
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
