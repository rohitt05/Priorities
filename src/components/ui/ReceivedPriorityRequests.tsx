import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions, Pressable, TextInput } from 'react-native';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
    useAnimatedStyle,
    interpolate,
    Extrapolate,
    SharedValue
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '@/theme/theme';
import { acceptPriorityRequest, declinePriorityRequest } from '@/services/priorityService';
import { getCurrentUserId } from '@/services/authService';
import { usePrioritiesRefresh } from '@/contexts/PrioritiesRefreshContext';
import { UserAvatar } from '@/components/ui/UserAvatar';



const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ITEM_HEIGHT = 86;



interface RequestItem {
    id: string;
    sender_id: string;
    created_at: string;
    status: string;
    profiles: {
        id: string;
        unique_user_id: string;
        name: string;
        profile_picture: string;
        dominant_color: string;
    } | null;
}



interface ItemProps {
    item: RequestItem;
    index: number;
    scrollY: SharedValue<number>;
    onAccept: (item: RequestItem) => void;
    onDecline: (id: string) => void;
}



const RequestItemCard = ({ item, index, scrollY, onAccept, onDecline }: ItemProps) => {
    const user = item.profiles;

    const animatedStyle = useAnimatedStyle(() => {
        const HEADER_HEIGHT = 50;
        const itemPosition = HEADER_HEIGHT + (index * ITEM_HEIGHT);
        const relativePosition = itemPosition - scrollY.value;

        const opacity = interpolate(
            relativePosition,
            [-ITEM_HEIGHT, 0, HEADER_HEIGHT, SCREEN_HEIGHT * 0.6, SCREEN_HEIGHT * 0.75],
            [0, 1, 1, 1, 0],
            Extrapolate.CLAMP
        );
        const scale = interpolate(
            relativePosition,
            [-ITEM_HEIGHT, 0, SCREEN_HEIGHT * 0.2, SCREEN_HEIGHT * 0.35],
            [0.9, 1, 1, 0.9],
            Extrapolate.CLAMP
        );
        const translateY = interpolate(
            relativePosition,
            [-ITEM_HEIGHT, 0, SCREEN_HEIGHT * 0.3],
            [ITEM_HEIGHT * 0.5, 0, 20],
            Extrapolate.CLAMP
        );

        return { opacity, transform: [{ scale }, { translateY }] };
    });

    if (!user) return null;

    return (
        <Animated.View style={[styles.itemCard, animatedStyle]}>
            <View style={styles.avatarContainer}>
                <UserAvatar uri={user.profile_picture} style={styles.avatar} />
            </View>
            <View style={styles.textContent}>
                <Text style={styles.nameText}>{user.name}</Text>
                <Text style={styles.timeText}>@{user.unique_user_id}</Text>
            </View>
            <View style={styles.actionsContainer}>
                <Pressable style={styles.declineButton} onPress={() => onDecline(item.id)}>
                    <Ionicons name="close-circle-outline" size={24} color="rgba(0, 0, 0, 0.4)" />
                </Pressable>
                <Pressable style={styles.acceptButton} onPress={() => onAccept(item)}>
                    <Text style={styles.acceptText}>Accept</Text>
                </Pressable>
            </View>
        </Animated.View>
    );
};



const ReceivedPriorityRequests = ({
    requests,
    opacity,
    onRequestsChange,
    onRelationshipOpen,
    onRelationshipClose,
}: {
    requests: RequestItem[];
    opacity: SharedValue<number>;
    onRequestsChange: (updated: RequestItem[]) => void;
    onRelationshipOpen?: () => void;
    onRelationshipClose?: () => void;
}) => {
    const [currentRequests, setCurrentRequests] = React.useState(requests);
    const [pendingItem, setPendingItem] = React.useState<RequestItem | null>(null);
    const [relationshipLabel, setRelationshipLabel] = React.useState('');
    const [isAccepting, setIsAccepting] = React.useState(false);
    const { triggerRefresh } = usePrioritiesRefresh();

    React.useEffect(() => {
        setCurrentRequests(requests);
    }, [requests]);

    const scrollY = useSharedValue(0);
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => { scrollY.value = event.contentOffset.y; },
    });

    const removeRequest = (id: string) => {
        const updated = currentRequests.filter(r => r.id !== id);
        setCurrentRequests(updated);
        onRequestsChange(updated);
    };

    const handleAcceptTap = (item: RequestItem) => {
        setPendingItem(item);
        setRelationshipLabel('');
        onRelationshipOpen?.();
    };

    const handleConfirmAccept = async () => {
        if (!pendingItem) return;
        setIsAccepting(true);
        try {
            const currentUserId = await getCurrentUserId();
            await acceptPriorityRequest(
                pendingItem.id,
                pendingItem.sender_id,
                currentUserId,
                relationshipLabel || undefined
            );
            removeRequest(pendingItem.id);
            triggerRefresh();
            setPendingItem(null);
            setRelationshipLabel('');
            onRelationshipClose?.();
        } catch (err) {
            console.error('Accept error:', err);
        } finally {
            setIsAccepting(false);
        }
    };

    const handleDecline = async (id: string) => {
        try {
            await declinePriorityRequest(id);
            removeRequest(id);
        } catch (err) {
            console.error('Decline error:', err);
        }
    };

    const listAnimatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: interpolate(opacity.value, [0, 1], [10, 0]) }]
    }));

    const renderHeader = () => (
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Priority Requests</Text>
            <View style={styles.badge}>
                <Text style={styles.badgeText}>{currentRequests.length}</Text>
            </View>
        </View>
    );

    return (
        <Animated.View style={[styles.container, listAnimatedStyle]}>
            <Animated.FlatList
                data={currentRequests}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={renderHeader}
                renderItem={({ item, index }) => (
                    <RequestItemCard
                        item={item}
                        index={index}
                        scrollY={scrollY}
                        onAccept={handleAcceptTap}
                        onDecline={handleDecline}
                    />
                )}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />

            {pendingItem && (
                <View style={styles.relationshipOverlay}>
                    <Text style={styles.relTitle}>
                        Who is {pendingItem.profiles?.name} to you?
                    </Text>
                    <TextInput
                        style={styles.relInput}
                        placeholder="e.g. Best Friend, Sister, Mentor..."
                        placeholderTextColor="rgba(61, 42, 71, 0.4)"
                        value={relationshipLabel}
                        onChangeText={setRelationshipLabel}
                        autoFocus
                    />
                    <View style={styles.relButtons}>
                        <Pressable
                            style={styles.cancelButton}
                            onPress={() => {
                                setPendingItem(null);
                                setRelationshipLabel('');
                                onRelationshipClose?.();
                            }}
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [styles.confirmButton, { opacity: pressed || isAccepting ? 0.7 : 1 }]}
                            onPress={handleConfirmAccept}
                            disabled={isAccepting}
                        >
                            <Text style={styles.confirmText}>
                                {isAccepting ? 'Accepting...' : 'Accept & Save'}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            )}

            <LinearGradient
                colors={['#FDFCF0', 'rgba(253, 252, 240, 0)']}
                style={styles.topGradient}
                pointerEvents="none"
            />
            <LinearGradient
                colors={['rgba(253, 252, 240, 0)', 'rgba(253, 252, 240, 0.95)', '#FDFCF0']}
                style={styles.bottomGradient}
                pointerEvents="none"
            />
        </Animated.View>
    );
};



const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 80,
        left: 20,
        right: 20,
        bottom: 30,
        zIndex: 2500,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 10,
    },
    headerTitle: {
        fontFamily: FONTS.bold,
        fontSize: 16,
        color: COLORS.primary,
        opacity: 0.9,
    },
    badge: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 8,
    },
    badgeText: {
        color: COLORS.background,
        fontSize: 10,
        fontFamily: FONTS.bold,
    },
    listContent: {
        paddingBottom: 300,
        paddingTop: 40,
    },
    itemCard: {
        height: ITEM_HEIGHT - 6,
        backgroundColor: 'rgba(255, 255, 255, 0.45)',
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        marginBottom: 6,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#eee',
    },
    timeText: {
        fontFamily: FONTS.regular,
        fontSize: 11,
        color: COLORS.textSecondary,
        opacity: 0.7,
        marginTop: 2,
    },
    textContent: {
        flex: 1,
        marginLeft: 15,
    },
    nameText: {
        fontFamily: FONTS.bold,
        fontSize: 16,
        color: COLORS.primary,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    declineButton: {
        marginRight: 10,
        padding: 4,
    },
    acceptButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    acceptText: {
        color: COLORS.background,
        fontFamily: FONTS.bold,
        fontSize: 13,
    },
    relationshipOverlay: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        backgroundColor: COLORS.secondary,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        shadowColor: '#433D35',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
        zIndex: 3000,
    },
    relTitle: {
        fontFamily: FONTS.bold,
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.primary,
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    relInput: {
        height: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 15,
        fontFamily: FONTS.regular,
        color: COLORS.primary,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
    },
    relButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    cancelButton: {
        flex: 1,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    cancelText: {
        color: COLORS.primary,
        fontFamily: FONTS.bold,
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    confirmButton: {
        flex: 2,
        backgroundColor: COLORS.primary,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmText: {
        color: COLORS.background,
        fontFamily: FONTS.bold,
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    topGradient: {
        position: 'absolute',
        top: -1, left: -10, right: -10,
        height: 60,
        zIndex: 2600,
    },
    bottomGradient: {
        position: 'absolute',
        bottom: -1, left: -10, right: -10,
        height: 120,
        zIndex: 2600,
    },
});



export default ReceivedPriorityRequests;