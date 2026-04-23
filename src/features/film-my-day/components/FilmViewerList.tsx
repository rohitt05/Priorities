import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { getAvatarSource } from '@/utils/getMediaSource';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { FONTS } from '@/theme/theme';
import { Profile } from '@/types/domain';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    interpolate,
} from 'react-native-reanimated';
import { ScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

const { width: SW } = Dimensions.get('window');

interface FilmViewerListProps {
    viewers: Profile[];
    likedByIds: Set<string>; // ✅ set of user IDs who liked this film
    accent: string;
    visible: boolean;
}

const FilmViewerList: React.FC<FilmViewerListProps> = ({ viewers, likedByIds, accent, visible }) => {
    const anim = useSharedValue(0);

    useEffect(() => {
        anim.value = withSpring(visible ? 1 : 0, {
            damping: 30,
            stiffness: 140,
            mass: 1.2,
        });
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: interpolate(anim.value, [0, 1], [40, 0]) }],
        opacity: anim.value,
        width: interpolate(anim.value, [0, 1], [0, SW - 85]),
    }));

    // ── Empty state ───────────────────────────────────────────
    if (viewers.length === 0) {
        return (
            <Animated.View style={[styles.container, animatedStyle]}>
                <View style={styles.emptyBanner}>
                    <Ionicons name="eye-off-outline" size={16} color="#433D35" style={{ marginRight: 7, opacity: 0.6 }} />
                    <Text style={styles.emptyText}>No one saw this film yet</Text>
                </View>
            </Animated.View>
        );
    }

    // ── Viewers list ──────────────────────────────────────────
    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <View style={styles.listWrapper}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    <View style={styles.viewerRow}>
                        {viewers.map((user, idx) => {
                            const hasLiked = likedByIds.has(user.id);
                            return (
                                <View key={user.id} style={[styles.viewerItem, { zIndex: viewers.length - idx }]}>
                                    <View style={styles.avatarWrapper}>
                                        <View style={styles.avatarContainer}>
                                            <UserAvatar
                                                uri={user.profilePicture}
                                                style={styles.avatar}
                                            />
                                        </View>
                                        {/* ✅ tilted heart badge if they liked */}
                                        {hasLiked && (
                                            <View style={styles.heartBadge}>
                                                <Ionicons
                                                    name="heart"
                                                    size={13}
                                                    color="#FF3B30"
                                                />
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.viewerName} numberOfLines={1}>
                                        {user.name.split(' ')[0]}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 85,
        justifyContent: 'center',
        marginRight: 0,
    },
    listWrapper: {
        flex: 1,
        flexDirection: 'row',
    },
    scrollContent: {
        alignItems: 'center',
        paddingRight: 15,
    },
    viewerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    viewerItem: {
        alignItems: 'center',
        marginHorizontal: 8,
        width: 60,
    },
    // ✅ wrapper so heart badge can be absolutely positioned over avatar
    avatarWrapper: {
        width: 52,
        height: 52,
    },
    avatarContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 26,
    },
    // ✅ bottom-right corner, tilted 15deg
    heartBadge: {
        position: 'absolute',
        bottom: -2,
        right: -4,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ rotate: '15deg' }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
        elevation: 3,
    },
    viewerName: {
        fontFamily: FONTS.bold,
        fontSize: 11,
        color: '#111',
        textAlign: 'center',
        marginTop: 6,
        letterSpacing: 0.3,
    },
    emptyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.55)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(67,61,53,0.12)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    emptyText: {
        fontFamily: FONTS.bold,
        fontSize: 12.5,
        color: '#433D35',
        opacity: 0.75,
        letterSpacing: 0.3,
    },
});

export default FilmViewerList;