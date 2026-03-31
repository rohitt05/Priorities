import React, { useCallback, useEffect, useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    FlatList,
    Animated,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, FONTS } from '@/theme/theme';
import { useBackground } from '@/contexts/BackgroundContext';
import { getBlockedUsers, unblockUser, BlockedUser } from '@/services/blockService';

const BlockedUsersScreen = () => {
    const router = useRouter();
    const { bgColor, prevBgColor, colorAnim } = useBackground();

    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [unblockingId, setUnblockingId] = useState<string | null>(null);

    const animatedBgColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    // ── Fetch blocked users ───────────────────────────────────────────────────
    const fetchBlockedUsers = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setIsRefreshing(true);
            const data = await getBlockedUsers();
            setBlockedUsers(data);
        } catch (e) {
            console.error('Failed to fetch blocked users:', e);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchBlockedUsers();
    }, [fetchBlockedUsers]);

    // ── Unblock ───────────────────────────────────────────────────────────────
    const handleUnblock = async (item: BlockedUser) => {
        if (unblockingId) return;
        try {
            setUnblockingId(item.blockedId);
            await unblockUser(item.blockedId);
            // Optimistically remove from list
            setBlockedUsers((prev) => prev.filter((u) => u.blockedId !== item.blockedId));
        } catch (e) {
            console.error('Failed to unblock user:', e);
        } finally {
            setUnblockingId(null);
        }
    };

    // ── Row ───────────────────────────────────────────────────────────────────
    const renderItem = ({ item }: { item: BlockedUser }) => {
        const isProcessing = unblockingId === item.blockedId;

        return (
            <View style={styles.userRow}>
                <View style={styles.userInfo}>
                    {item.profilePicture ? (
                        <Image
                            source={{ uri: item.profilePicture }}
                            style={styles.avatar}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                        />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarText}>
                                {item.name?.[0]?.toUpperCase() ?? '?'}
                            </Text>
                        </View>
                    )}
                    <View style={styles.userTextBlock}>
                        <Text style={styles.userName} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Text style={styles.userHandle} numberOfLines={1}>
                            @{item.uniqueUserId}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.unblockButton, isProcessing && styles.unblockButtonDisabled]}
                    onPress={() => handleUnblock(item)}
                    disabled={!!unblockingId}
                    activeOpacity={0.7}
                >
                    {isProcessing ? (
                        <ActivityIndicator size="small" color={COLORS.text} />
                    ) : (
                        <Text style={styles.unblockText}>unblock</Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: animatedBgColor }]} />

            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                        hitSlop={20}
                    >
                        <Ionicons name="chevron-back" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>blocked users</Text>
                    <View style={styles.headerSpacer} />
                </View>

                {/* Loading */}
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color={COLORS.textSecondary} />
                    </View>
                ) : (
                    <FlatList
                        data={blockedUsers}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={[
                            styles.listContent,
                            blockedUsers.length === 0 && styles.emptyListContent,
                        ]}
                        ItemSeparatorComponent={() => <View style={styles.divider} />}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={() => fetchBlockedUsers(true)}
                                tintColor={COLORS.textSecondary}
                            />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons
                                    name="shield-outline"
                                    size={48}
                                    color={COLORS.textSecondary}
                                    style={{ opacity: 0.4 }}
                                />
                                <Text style={styles.emptyText}>no blocked users</Text>
                                <Text style={styles.emptySubText}>
                                    people you block won't be able to see your priorities
                                </Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>
        </View>
    );
};

export default BlockedUsersScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        height: 60,
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontFamily: FONTS.bold,
        fontWeight: '800',
        color: COLORS.text,
        textTransform: 'lowercase',
    },
    headerSpacer: {
        width: 40,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 4,
    },
    emptyListContent: {
        flex: 1,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarPlaceholder: {
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#FFF',
        fontSize: 20,
        fontFamily: FONTS.bold,
    },
    userTextBlock: {
        flex: 1,
        marginLeft: 14,
    },
    userName: {
        fontSize: 15,
        fontFamily: FONTS.bold,
        color: COLORS.text,
        textTransform: 'lowercase',
    },
    userHandle: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    unblockButton: {
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 99,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        minWidth: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unblockButtonDisabled: {
        opacity: 0.5,
    },
    unblockText: {
        color: COLORS.text,
        fontSize: 13,
        fontFamily: FONTS.bold,
        textTransform: 'lowercase',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(0,0,0,0.08)',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        marginTop: 16,
        fontSize: 15,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
        textTransform: 'lowercase',
    },
    emptySubText: {
        marginTop: 6,
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 40,
        opacity: 0.7,
        textTransform: 'lowercase',
    },
});