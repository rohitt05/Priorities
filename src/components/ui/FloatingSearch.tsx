import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Pressable,
    StyleSheet,
    TextInput,
    Dimensions,
    Keyboard,
    Platform,
    Animated as RNAnimated,
    Text,
    Image,
    FlatList,
    InteractionManager,
    StatusBar,
    BackHandler,
    Alert
} from 'react-native';
import ReAnimated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    withTiming,
    interpolate,
    Extrapolate,
    SharedValue
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { COLORS, FONTS } from '@/theme/theme';
import { searchUsers, searchDirectoryUsers } from '@/services/profileService';
import { sendPriorityRequest, getIncomingRequests, acceptPriorityRequest, getMyPriorities } from '@/services/priorityService';
import { getCurrentUserId } from '@/services/authService';
import { usePrioritiesRefresh } from '@/contexts/PrioritiesRefreshContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { supabase } from '@/lib/supabase';



const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');



interface User {
    id: string;
    unique_user_id: string;
    name: string;
    profile_picture: string;
    dominant_color: string;
    partner?: {
        name: string;
        unique_user_id: string;
        profile_picture: string;
    };
}



interface SearchResultCardProps {
    item: User;
    index: number;
    scrollY: SharedValue<number>;
    onPress: (userId: string) => void;
    onAddPress: (user: User) => void;
    hasSentRequest: boolean;
    onAcceptPress: (user: User) => void;
    isAlreadyPriority: boolean;
    isDirectoryTab?: boolean;
}



const SearchResultCard = ({
    item,
    index,
    scrollY,
    onPress,
    onAddPress,
    hasSentRequest,
    onAcceptPress,
    isAlreadyPriority,
    isDirectoryTab,
}: SearchResultCardProps) => {
    const ITEM_H = 80;
    const { height: SCREEN_HEIGHT } = Dimensions.get('window');

    const animatedStyle = useAnimatedStyle(() => {
        const itemPos = index * ITEM_H;
        const relativePos = itemPos - scrollY.value;

        const opacity = interpolate(
            relativePos,
            [-ITEM_H, 0, 50, SCREEN_HEIGHT * 0.6, SCREEN_HEIGHT * 0.75],
            [0, 1, 1, 1, 0],
            Extrapolate.CLAMP
        );

        const scale = interpolate(
            relativePos,
            [-ITEM_H, 0, SCREEN_HEIGHT * 0.6, SCREEN_HEIGHT * 0.75],
            [0.9, 1, 1, 0.9],
            Extrapolate.CLAMP
        );

        return { opacity, transform: [{ scale }] };
    });

    return (
        <ReAnimated.View style={[styles.resultCard, animatedStyle]}>
            <Pressable
                style={[
                    styles.userInfoContainer,
                    isDirectoryTab && { flexDirection: 'row', flex: 1, justifyContent: 'space-between', alignItems: 'center' }
                ]}
                onPress={() => onPress(item.unique_user_id)}
            >
                {isDirectoryTab ? (
                    <>
                        <UserAvatar uri={item.profile_picture} style={styles.resultAvatar} />
                        <View style={[styles.userInfo, { alignItems: 'center', marginHorizontal: 10 }]}>
                            <Text style={styles.userName}>{item.name}</Text>
                            <Text style={[styles.userId, { color: '#ff4d4d', marginTop: 2 }]} numberOfLines={1}>committed to {item.partner?.name}</Text>
                        </View>
                        <UserAvatar uri={item.partner?.profile_picture || ''} style={styles.resultAvatar} />
                    </>
                ) : (
                    <>
                        <UserAvatar uri={item.profile_picture} style={styles.resultAvatar} />
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{item.name}</Text>
                            <Text style={styles.userId}>@{item.unique_user_id}</Text>
                        </View>
                    </>
                )}
            </Pressable>

            {!isDirectoryTab && (
                isAlreadyPriority ? (
                    <Pressable
                        style={({ pressed }) => [
                            styles.resultAcceptButton,
                            styles.viewProfileButton,
                            { transform: [{ scale: pressed ? 0.95 : 1 }] }
                        ]}
                        onPress={() => onPress(item.unique_user_id)}
                    >
                        <Text style={[styles.resultAcceptText, { color: COLORS.primary }]}>
                            View Profile
                        </Text>
                    </Pressable>
                ) : hasSentRequest ? (
                    <Pressable
                        style={({ pressed }) => [
                            styles.resultAcceptButton,
                            styles.acceptButtonHighlight,
                            { transform: [{ scale: pressed ? 0.95 : 1 }] }
                        ]}
                        onPress={() => onAcceptPress(item)}
                    >
                        <Text style={styles.resultAcceptText}>Accept</Text>
                    </Pressable>
                ) : (
                    <Pressable
                        style={({ pressed }) => [
                            styles.resultAcceptButton,
                            { transform: [{ scale: pressed ? 0.95 : 1 }] }
                        ]}
                        onPress={() => onAddPress(item)}
                    >
                        <Text style={styles.resultAcceptText}>Add to Priorities</Text>
                    </Pressable>
                )
            )}
        </ReAnimated.View>
    );
};


const ZigzagScribble = ({ color, opacity, style }: any) => (
    <View style={[{ flexDirection: 'row', height: 14, alignItems: 'center' }, style]}>
        {[...Array(10)].map((_, i) => (
            <View
                key={i}
                style={{
                    width: 10,
                    height: 3,
                    backgroundColor: color,
                    opacity,
                    borderRadius: 2,
                    transform: [
                        { rotate: i % 2 === 0 ? '-30deg' : '30deg' },
                        { translateY: i % 2 === 0 ? 1 : -1 }
                    ],
                    marginLeft: i === 0 ? 0 : -5,
                }}
            />
        ))}
    </View>
);


const FloatingSearch = () => {
    const router = useRouter();
    const isFocused = useIsFocused();
    const { triggerRefresh } = usePrioritiesRefresh();

    const [isExpanded, setIsExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [relationship, setRelationship] = useState('');
    const [hasNewRequests, setHasNewRequests] = useState(false);
    const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isAcceptFlow, setIsAcceptFlow] = useState(false);
    const [pendingAcceptRequest, setPendingAcceptRequest] = useState<any | null>(null);
    const [existingPriorityIds, setExistingPriorityIds] = useState<Set<string>>(new Set());
    const [searchBarHidden, setSearchBarHidden] = useState(false);
    const [activeTab, setActiveTab] = useState<'people' | 'directory'>('people');

    const requestListOpacity = useSharedValue(0);
    const expandAnim = useRef(new RNAnimated.Value(0)).current;
    const keyboardOffset = useRef(new RNAnimated.Value(0)).current;
    const resultsAnim = useRef(new RNAnimated.Value(0)).current;
    const relationshipAnim = useRef(new RNAnimated.Value(0)).current;
    const activeTabAnim = useRef(new RNAnimated.Value(0)).current;
    const inputRef = useRef<TextInput>(null);
    const relInputRef = useRef<TextInput>(null);

    useEffect(() => {
        RNAnimated.spring(activeTabAnim, {
            toValue: activeTab === 'people' ? 0 : 1,
            useNativeDriver: true,
            friction: 8,
            tension: 50,
        }).start();

        // Clear search when switching tabs
        setSearchQuery('');
        setFilteredUsers([]);
        setSelectedUser(null);
    }, [activeTab]);

    const translateX = activeTabAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 150], // 300 / 2
    });



    // ─── Load current user ID on mount ───────────────────────
    useEffect(() => {
        getCurrentUserId()
            .then(setCurrentUserId)
            .catch(console.error);
    }, []);



    // ─── Load incoming requests + existing priorities ─────────
    const loadIncomingRequests = async () => {
        if (!currentUserId) return;
        try {
            const [requests, myPriorities] = await Promise.all([
                getIncomingRequests(currentUserId),
                getMyPriorities(currentUserId),
            ]);
            setIncomingRequests(requests);
            setHasNewRequests(requests.length > 0);
            setExistingPriorityIds(new Set((myPriorities as any[]).filter(p => p?.id).map(p => p.id)));
        } catch (err) {
            console.error('Error loading requests:', err);
        }
    };

    useEffect(() => {
        if (!currentUserId) return;
        
        loadIncomingRequests();

        const channel = supabase
            .channel(`realtime_incoming_requests_${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'priority_requests',
                    filter: `receiver_id=eq.${currentUserId}`,
                },
                () => {
                    loadIncomingRequests();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId]);



    useEffect(() => {
        if (!isFocused && isExpanded) setIsExpanded(false);
    }, [isFocused]);



    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (e) => {
            RNAnimated.spring(keyboardOffset, {
                toValue: e.endCoordinates.height + (Platform.OS === 'ios' ? 20 : 10),
                friction: 8, tension: 40, useNativeDriver: false,
            }).start();
        });
        const hideSub = Keyboard.addListener(hideEvent, () => {
            RNAnimated.spring(keyboardOffset, {
                toValue: 0, friction: 8, tension: 40, useNativeDriver: false,
            }).start();
        });

        return () => { showSub.remove(); hideSub.remove(); };
    }, []);



    useEffect(() => {
        RNAnimated.spring(expandAnim, {
            toValue: isExpanded ? 1 : 0,
            friction: 8, tension: 40, useNativeDriver: false,
        }).start();

        if (isExpanded) {
            setHasNewRequests(false);
            requestListOpacity.value = withTiming(1, { duration: 400 });
            loadIncomingRequests();
            const task = InteractionManager.runAfterInteractions(() => {
                inputRef.current?.focus();
            });
            return () => task.cancel();
        } else {
            requestListOpacity.value = withTiming(0, { duration: 200 });
            Keyboard.dismiss();
            resetSearch();
        }
    }, [isExpanded]);



    const resetSearch = () => {
        setSearchQuery('');
        setFilteredUsers([]);
        setSelectedUser(null);
        setRelationship('');
        setIsAcceptFlow(false);
        setPendingAcceptRequest(null);
        setSearchBarHidden(false);
        setActiveTab('people');
    };



    useEffect(() => {
        RNAnimated.timing(resultsAnim, {
            toValue: (filteredUsers.length > 0 && !selectedUser) ? 1 : 0,
            duration: 200, useNativeDriver: true,
        }).start();
    }, [filteredUsers, selectedUser]);



    useEffect(() => {
        RNAnimated.spring(relationshipAnim, {
            toValue: selectedUser ? 1 : 0,
            friction: 8, tension: 40, useNativeDriver: true,
        }).start();

        if (selectedUser) setTimeout(() => relInputRef.current?.focus(), 100);
    }, [selectedUser]);



    // ─── Search real Supabase profiles ────────────────────────
    const handleSearch = async (text: string) => {
        setSearchQuery(text);
        requestListOpacity.value = withTiming(text.length > 0 ? 0 : 1, { duration: 300 });
        if (text.length > 0) {
            try {
                const excludeIds = currentUserId ? [currentUserId] : [];
                let results;
                if (activeTab === 'directory') {
                    results = await searchDirectoryUsers(text, excludeIds);
                } else {
                    results = await searchUsers(text, excludeIds);
                }
                setFilteredUsers(results as User[]);
            } catch (err) {
                console.error('Search error:', err);
            }
        } else {
            setFilteredUsers([]);
        }
    };



    const handleAddPress = (user: User) => {
        setIsAcceptFlow(false);
        setSelectedUser(user);
    };



    const handleAcceptFromSearch = async (user: User) => {
        if (!currentUserId) return;
        const matchingRequest = incomingRequests.find(
            (req) => req.sender_id === user.id || req.profiles?.id === user.id
        );
        if (!matchingRequest) return;
        setPendingAcceptRequest(matchingRequest);
        setIsAcceptFlow(true);
        setSelectedUser(user);
    };



    useEffect(() => {
        if (!isExpanded) return;
        const onBackPress = () => { setIsExpanded(false); return true; };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => backHandler.remove();
    }, [isExpanded]);



    const resultScrollY = useSharedValue(0);
    const resultScrollHandler = useAnimatedScrollHandler({
        onScroll: (event: any) => { resultScrollY.value = event.contentOffset.y; },
    });



    // ─── Send / Accept priority ───────────────────────────────
    const handleSavePriority = async () => {
        if (!selectedUser || !currentUserId) return;
        setIsSending(true);
        try {
            if (isAcceptFlow && pendingAcceptRequest) {
                await acceptPriorityRequest(
                    pendingAcceptRequest.id,
                    pendingAcceptRequest.sender_id,
                    currentUserId,
                    relationship || undefined
                );
                setIncomingRequests(prev => prev.filter(r => r.id !== pendingAcceptRequest.id));
            } else {
                await sendPriorityRequest(
                    currentUserId,
                    selectedUser.id,
                    relationship || undefined
                );
            }
            triggerRefresh();
            setIsExpanded(false);
            resetSearch();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not complete action');
        } finally {
            setIsSending(false);
        }
    };



    // O(1) lookup sets
    const incomingRequestSenderIds = new Set(
        incomingRequests.map(req => req.sender_id ?? req.profiles?.id)
    );



    const searchBarWidth = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [60, SCREEN_WIDTH - 40],
    });
    const borderRadius = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [30, 20],
    });
    const bottomPosition = RNAnimated.add(new RNAnimated.Value(30), keyboardOffset);
    const overlayOpacity = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });
    const hitSlop = { top: 20, bottom: 20, left: 20, right: 20 };



    return (
        <>
            {/* Fullscreen Blurred Overlay */}
            <RNAnimated.View
                pointerEvents={isExpanded ? 'auto' : 'none'}
                style={[styles.fullscreenOverlay, { opacity: overlayOpacity }]}
            >
                <Pressable style={StyleSheet.absoluteFill}>
                    <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill}>
                        <LinearGradient
                            colors={activeTab === 'directory' 
                                ? ['rgba(255, 240, 245, 0.95)', 'rgba(255, 228, 225, 0.8)', 'rgba(255, 192, 203, 0.5)'] 
                                : ['rgba(253, 252, 240, 0.95)', 'rgba(253, 252, 240, 0.7)', 'rgba(253, 252, 240, 0.4)']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                        />
                        {activeTab === 'directory' && (
                            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                                <Ionicons name="heart" size={140} color="rgba(255, 105, 180, 0.12)" style={{ position: 'absolute', top: 180, left: -30, transform: [{ rotate: '-15deg' }] }} />
                                <Ionicons name="heart" size={90} color="rgba(255, 20, 147, 0.08)" style={{ position: 'absolute', top: 380, right: -15, transform: [{ rotate: '25deg' }] }} />
                                <Ionicons name="heart" size={220} color="rgba(255, 182, 193, 0.15)" style={{ position: 'absolute', bottom: 80, left: 50, transform: [{ rotate: '10deg' }] }} />
                                
                                {/* WDW Header centered in the background theme */}
                                {filteredUsers.length === 0 && (
                                    <View style={styles.wdwHeader}>
                                        <Text style={styles.wdwTitle}>WDW</Text>
                                        <Text style={styles.wdwSubtitle}>who's dating whom</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </BlurView>
                </Pressable>
            </RNAnimated.View>

            {/* Top Tabs — separate element above the header (zIndex 2100 > Header 2000) */}
            {isExpanded && (
                <View style={styles.topTabsWrapper} pointerEvents="box-none">
                    <View style={styles.topTabsContainer}>
                        <Pressable
                            style={styles.tabButton}
                            onPress={() => setActiveTab('people')}
                        >
                            <Text style={[
                                styles.tabText,
                                {
                                    color: activeTab === 'people' ? '#1a1a1a' : '#888888',
                                    fontWeight: activeTab === 'people' ? '700' : '400',
                                }
                            ]}>
                                search people
                            </Text>
                        </Pressable>
                        <Pressable
                            style={styles.tabButton}
                            onPress={() => setActiveTab('directory')}
                        >
                            <Text style={[
                                styles.tabText,
                                {
                                    color: activeTab === 'directory' ? '#1a1a1a' : '#888888',
                                    fontWeight: activeTab === 'directory' ? '700' : '400',
                                }
                            ]}>
                                world directory
                            </Text>
                        </Pressable>

                        {/* Sliding Zigzag Scribble Indicator */}
                        <RNAnimated.View
                            style={[
                                styles.scribbleIndicatorContainer,
                                { transform: [{ translateX }] }
                            ]}
                        >
                            <ZigzagScribble color={COLORS.primary} opacity={1} />
                            <ZigzagScribble
                                color={COLORS.primary}
                                opacity={0.5}
                                style={{ position: 'absolute', top: 2, transform: [{ scale: 0.95 }, { rotate: '1deg' }] }}
                            />
                        </RNAnimated.View>
                    </View>
                </View>
            )}

            {/* Removed ReceivedPriorityRequests from here */}

            {/* Removed ReceivedPriorityRequests from here */}

            <RNAnimated.View
                style={[
                    styles.container,
                    {
                        width: searchBarWidth,
                        borderRadius: borderRadius,
                        bottom: bottomPosition,
                        opacity: searchBarHidden ? 0 : 1,
                        pointerEvents: searchBarHidden ? 'none' : 'auto',
                    }
                ]}
            >
                {/* Relationship Input Overlay */}
                {selectedUser && (
                    <RNAnimated.View
                        style={[
                            styles.relationshipContainer,
                            {
                                opacity: relationshipAnim,
                                transform: [{ translateY: relationshipAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
                            }
                        ]}
                    >
                        <Text style={styles.relTitle}>
                            Who is {selectedUser.name} to you?
                        </Text>
                        <TextInput
                            ref={relInputRef}
                            style={styles.relInput}
                            placeholder="e.g. Best Friend, Sister, Mentor..."
                            placeholderTextColor="rgba(61, 42, 71, 0.4)"
                            value={relationship}
                            onChangeText={setRelationship}
                        />
                        <Pressable
                            style={({ pressed }) => [styles.saveButton, { opacity: pressed || isSending ? 0.7 : 1 }]}
                            onPress={handleSavePriority}
                            disabled={isSending}
                        >
                            <Text style={styles.saveButtonText}>
                                {isSending
                                    ? (isAcceptFlow ? 'Accepting...' : 'Sending...')
                                    : (isAcceptFlow ? 'Accept & Save' : 'Send Request')
                                }
                            </Text>
                        </Pressable>
                    </RNAnimated.View>
                )}


                {/* Results List */}
                {filteredUsers.length > 0 && !selectedUser && (
                    <RNAnimated.View
                        style={[
                            styles.resultsContainer,
                            {
                                opacity: resultsAnim,
                                transform: [{ translateY: resultsAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }]
                            }
                        ]}
                    >
                        <ReAnimated.FlatList
                            data={filteredUsers}
                            keyExtractor={(item: any) => item.id}
                            renderItem={({ item, index }: any) => (
                                <SearchResultCard
                                    item={item}
                                    index={index}
                                    scrollY={resultScrollY}
                                    onPress={(userId) => {
                                        setIsExpanded(false);
                                        resetSearch();
                                        router.push({ pathname: '/profile', params: { userId } });
                                    }}
                                    onAddPress={handleAddPress}
                                    hasSentRequest={incomingRequestSenderIds.has(item.id)}
                                    onAcceptPress={handleAcceptFromSearch}
                                    isAlreadyPriority={existingPriorityIds.has(item.id)}
                                    isDirectoryTab={activeTab === 'directory'}
                                />
                            )}
                            onScroll={resultScrollHandler}
                            scrollEventThrottle={16}
                            contentContainerStyle={styles.resultsListContent}
                            showsVerticalScrollIndicator={false}
                        />
                        <LinearGradient
                            colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0)']}
                            style={styles.resultsTopFade}
                            pointerEvents="none"
                        />
                    </RNAnimated.View>
                )}

                <View style={[styles.searchBar, { paddingRight: isExpanded ? 5 : 0 }]}>
                    {isExpanded && (
                        <TextInput
                            ref={inputRef}
                            style={[styles.input, { marginLeft: 20 }]}
                            placeholder="search unique user id"
                            placeholderTextColor="rgba(255, 255, 255, 0.6)"
                            selectionColor={COLORS.background}
                            value={searchQuery}
                            onChangeText={handleSearch}
                            autoCapitalize="none"
                            editable={!selectedUser}
                        />
                    )}

                    <Pressable
                        style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
                        onPress={() => isExpanded ? (selectedUser ? setSelectedUser(null) : setIsExpanded(false)) : setIsExpanded(true)}
                        hitSlop={hitSlop}
                    >
                        <Ionicons
                            name={isExpanded ? (selectedUser ? 'arrow-back' : 'close') : 'search'}
                            size={28}
                            color={COLORS.background}
                        />
                        {/* Removed newRequestIndicator from here */}
                    </Pressable>
                </View>
            </RNAnimated.View>
        </>
    );
};



const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        right: 20,
        backgroundColor: COLORS.primary,
        zIndex: 3000,
        elevation: 10,
    },
    fullscreenOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1999,
    },
    iconButton: {
        width: 56,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontFamily: FONTS.medium,
        color: COLORS.background,
        marginRight: 10,
        includeFontPadding: false,
    },
    resultsContainer: {
        position: 'absolute',
        bottom: 58,
        left: 0,
        width: SCREEN_WIDTH - 40,
        maxHeight: 400,
        justifyContent: 'flex-end',
    },
    resultsListContent: {
        flexGrow: 1,
        justifyContent: 'flex-end',
        paddingBottom: 4,
    },
    resultCard: {
        height: 74,
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
    resultAcceptButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    acceptButtonHighlight: {
        backgroundColor: '#433D35',
    },
    viewProfileButton: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    resultAcceptText: {
        color: COLORS.background,
        fontFamily: FONTS.bold,
        fontSize: 13,
    },
    resultAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    resultsTopFade: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        zIndex: 10,
    },
    relationshipContainer: {
        position: 'absolute',
        bottom: 70,
        left: 0,
        right: 0,
        width: SCREEN_WIDTH - 40,
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
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
    },
    saveButton: {
        backgroundColor: COLORS.primary,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonText: {
        color: COLORS.background,
        fontFamily: FONTS.bold,
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    resultsList: {
        paddingHorizontal: 5,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0, 0, 0, 0.1)',
        paddingHorizontal: 10,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    userInfo: {
        marginLeft: 12,
        flex: 1,
    },
    userName: {
        fontFamily: FONTS.bold,
        fontSize: 16,
        color: COLORS.primary,
    },
    userId: {
        fontFamily: FONTS.regular,
        fontSize: 11,
        color: COLORS.textSecondary,
        letterSpacing: 0.5,
    },
    addButton: {
        padding: 5,
    },
    userInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    newRequestIndicator: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: COLORS.surface,
        width: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        zIndex: 100,
    },
    topTabsWrapper: {
        position: 'absolute',
        top: 120,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
    },
    topTabsContainer: {
        width: 300,
        height: 50,
        flexDirection: 'row',
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabButton: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabText: {
        fontFamily: FONTS.bold,
        fontSize: 16,
        textTransform: 'lowercase',
    },
    scribbleIndicatorContainer: {
        position: 'absolute',
        bottom: -4,
        width: 150,
        left: 0,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    directoryPlaceholder: {
        backgroundColor: 'rgba(255, 255, 255, 0.45)',
        borderRadius: 30,
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 6,
        minHeight: 250,
    },
    directoryTitle: {
        fontFamily: FONTS.bold,
        fontSize: 18,
        color: COLORS.primary,
        marginBottom: 8,
    },
    directorySubtitle: {
        fontFamily: FONTS.regular,
        fontSize: 13,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
    },
    wdwHeader: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 40,
    },
    wdwTitle: {
        fontFamily: 'DancingScript-Bold',
        fontSize: 64,
        color: '#b5254e',
        opacity: 0.8,
    },
    wdwSubtitle: {
        fontFamily: FONTS.regular,
        fontSize: 16,
        color: '#8b3a5a',
        opacity: 0.6,
        marginTop: -5,
        letterSpacing: 1,
    },
});



export default FloatingSearch;