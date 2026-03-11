import React, { useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    FlatList,
    Animated,
    StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, FONTS, SPACING } from '@/theme/theme';
import { useBackground } from '@/contexts/BackgroundContext';

interface BlockedUser {
    id: string;
    name: string;
    username: string;
}

const MOCK_BLOCKED_USERS: BlockedUser[] = [
    { id: '1', name: 'John Doe', username: '@johndoe' },
    { id: '2', name: 'Jane Smith', username: '@janesmith' },
];

const BlockedUsersScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { bgColor, prevBgColor, colorAnim } = useBackground();

    const animatedBgColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    const renderItem = ({ item }: { item: BlockedUser }) => (
        <View style={styles.userRow}>
            <View style={styles.userInfo}>
                <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{item.name[0]}</Text>
                </View>
                <View>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userHandle}>{item.username}</Text>
                </View>
            </View>
            <TouchableOpacity style={styles.unblockButton}>
                <Text style={styles.unblockText}>unblock</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: animatedBgColor }]} />

            <SafeAreaView style={styles.safeArea} edges={['top']}>
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

                <FlatList
                    data={MOCK_BLOCKED_USERS}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ItemSeparatorComponent={() => <View style={styles.divider} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="shield-outline" size={48} color={COLORS.textSecondary} style={{ opacity: 0.5 }} />
                            <Text style={styles.emptyText}>no blocked users</Text>
                        </View>
                    }
                />
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
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    avatarText: {
        color: '#FFF',
        fontSize: 20,
        fontFamily: FONTS.bold,
    },
    userName: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: COLORS.text,
        textTransform: 'lowercase',
    },
    userHandle: {
        fontSize: 14,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        textTransform: 'lowercase',
        marginTop: 2,
    },
    unblockButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 99,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
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
        marginTop: 100,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 15,
        fontFamily: FONTS.medium,
        color: COLORS.textSecondary,
        textTransform: 'lowercase',
    }
});
