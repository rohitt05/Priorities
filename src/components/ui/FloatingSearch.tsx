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
    BackHandler
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

interface User {
    id: string;
    uniqueUserId: string;
    name: string;
    profilePicture: string;
    dominantColor: string;
}

interface SearchResultCardProps {
    item: User;
    index: number;
    scrollY: SharedValue<number>;
    onPress: (userId: string) => void;
    onAddPress: (user: User) => void;
}

const SearchResultCard = ({ item, index, scrollY, onPress, onAddPress }: SearchResultCardProps) => {
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

        return {
            opacity,
            transform: [{ scale }]
        };
    });

    return (
        <ReAnimated.View style={[styles.resultCard, animatedStyle]}>
            <Pressable
                style={styles.userInfoContainer}
                onPress={() => onPress(item.uniqueUserId)}
            >
                <Image source={{ uri: item.profilePicture }} style={styles.resultAvatar} />
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userId}>@{item.uniqueUserId}</Text>
                </View>
            </Pressable>
            <Pressable
                style={({ pressed }) => [
                    styles.resultAcceptButton,
                    { transform: [{ scale: pressed ? 0.95 : 1 }] }
                ]}
                onPress={() => onAddPress(item)}
            >
                <Text style={styles.resultAcceptText}>Add to Priorities</Text>
            </Pressable>
        </ReAnimated.View>
    );
};
import usersData from '@/data/users.json';
import receivedPriorityRequests from '@/data/receivedPriorityRequests.json';
import ReceivedPriorityRequests from './ReceivedPriorityRequests';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

import { Profile } from '@/types/domain';

interface FloatingSearchProps {
    onAddPriority?: (user: Profile) => void;
}

const FloatingSearch = ({ onAddPriority }: FloatingSearchProps) => {
    const router = useRouter();
    const isFocused = useIsFocused();
    const [isExpanded, setIsExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isFocused && isExpanded) {
            setIsExpanded(false);
        }
    }, [isFocused]);
    const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [relationship, setRelationship] = useState('');
    const [hasNewRequests, setHasNewRequests] = useState(true);
    const CURRENT_USER_ID = "rohit123";
    const myRequests = (receivedPriorityRequests as any)[CURRENT_USER_ID] || [];

    const requestListOpacity = useSharedValue(0);

    const expandAnim = useRef(new RNAnimated.Value(0)).current;
    const keyboardOffset = useRef(new RNAnimated.Value(0)).current;
    const resultsAnim = useRef(new RNAnimated.Value(0)).current;
    const relationshipAnim = useRef(new RNAnimated.Value(0)).current;
    const inputRef = useRef<TextInput>(null);
    const relInputRef = useRef<TextInput>(null);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSubscription = Keyboard.addListener(showEvent, (e) => {
            RNAnimated.spring(keyboardOffset, {
                toValue: e.endCoordinates.height + (Platform.OS === 'ios' ? 20 : 10),
                friction: 8,
                tension: 40,
                useNativeDriver: false,
            }).start();
        });

        const hideSubscription = Keyboard.addListener(hideEvent, () => {
            RNAnimated.spring(keyboardOffset, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: false,
            }).start();
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    useEffect(() => {
        RNAnimated.spring(expandAnim, {
            toValue: isExpanded ? 1 : 0,
            friction: 8,
            tension: 40,
            useNativeDriver: false, // width/borderRadius require JS driver
        }).start();

        if (isExpanded) {
            setHasNewRequests(false);
            requestListOpacity.value = withTiming(1, { duration: 400 });
            // Wait for animation to finish before focusing
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
    };

    useEffect(() => {
        RNAnimated.timing(resultsAnim, {
            toValue: (filteredUsers.length > 0 && !selectedUser) ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [filteredUsers, selectedUser]);

    useEffect(() => {
        RNAnimated.spring(relationshipAnim, {
            toValue: selectedUser ? 1 : 0,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
        }).start();

        if (selectedUser) {
            setTimeout(() => relInputRef.current?.focus(), 100);
        }
    }, [selectedUser]);

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        requestListOpacity.value = withTiming(text.length > 0 ? 0 : 1, { duration: 300 });
        if (text.length > 0) {
            const data = Array.isArray(usersData) ? usersData : (usersData as any).default || [];
            const filtered = data.filter((user: Profile) =>
                user.uniqueUserId.toLowerCase().includes(text.toLowerCase())
            );
            setFilteredUsers(filtered);
        } else {
            setFilteredUsers([]);
        }
    };

    const handleAddPress = (user: Profile) => {
        setSelectedUser(user);
    };


    useEffect(() => {
        if (!isExpanded) return;

        const onBackPress = () => {
            setIsExpanded(false);
            return true; // Prevent default behavior
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => backHandler.remove();
    }, [isExpanded]);

    const resultScrollY = useSharedValue(0);
    const resultScrollHandler = useAnimatedScrollHandler({
        onScroll: (event: any) => {
            resultScrollY.value = event.contentOffset.y;
        },
    });

    const handleSavePriority = () => {
        if (selectedUser && relationship) {
            onAddPriority?.({
                ...selectedUser,
                relationship: relationship
            } as any); // Type cast to allow temporary relationship field
        }
        setIsExpanded(false);
        resetSearch();
    };


    const searchBarWidth = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [60, SCREEN_WIDTH - 40],
    });

    const borderRadius = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [30, 20],
    });

    const hitSlop = { top: 20, bottom: 20, left: 20, right: 20 };

    const bottomPosition = RNAnimated.add(new RNAnimated.Value(30), keyboardOffset);

    const overlayOpacity = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });

    return (
        <>
            {/* Fullscreen Blurred Overlay */}
            <RNAnimated.View
                pointerEvents={isExpanded ? 'auto' : 'none'}
                style={[
                    styles.fullscreenOverlay,
                    { opacity: overlayOpacity }
                ]}
            >
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => setIsExpanded(false)}
                >
                    <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill}>
                        <LinearGradient
                            colors={['rgba(253, 252, 240, 0.95)', 'rgba(253, 252, 240, 0.7)', 'rgba(253, 252, 240, 0.4)']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                        />
                    </BlurView>
                </Pressable>
            </RNAnimated.View>

            {isExpanded && myRequests.length > 0 && (
                <RNAnimated.View
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: keyboardOffset,
                        zIndex: 2500
                    }}
                    pointerEvents="box-none"
                >
                    <ReceivedPriorityRequests
                        requests={myRequests}
                        opacity={requestListOpacity}
                    />
                </RNAnimated.View>
            )}

            <RNAnimated.View
                style={[
                    styles.container,
                    {
                        width: searchBarWidth,
                        borderRadius: borderRadius,
                        bottom: bottomPosition,
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
                                transform: [{
                                    translateY: relationshipAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [20, 0]
                                    })
                                }]
                            }
                        ]}
                    >
                        <Text style={styles.relTitle}>Who is {selectedUser.name} to you?</Text>
                        <TextInput
                            ref={relInputRef}
                            style={styles.relInput}
                            placeholder="e.g. Best Friend, Sister, Mentor..."
                            placeholderTextColor="rgba(61, 42, 71, 0.4)"
                            value={relationship}
                            onChangeText={setRelationship}
                        />
                        <Pressable
                            style={({ pressed }) => [
                                styles.saveButton,
                                { opacity: pressed ? 0.8 : 1 }
                            ]}
                            onPress={handleSavePriority}
                        >
                            <Text style={styles.saveButtonText}>Add to Priorities</Text>
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
                                transform: [{
                                    translateY: resultsAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [10, 0]
                                    })
                                }]
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
                                        router.push({
                                            pathname: '/profile',
                                            params: { userId }
                                        });
                                    }}
                                    onAddPress={handleAddPress}
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

                <View style={[
                    styles.searchBar,
                    { paddingRight: isExpanded ? 5 : 0 } // Sublte right offset when expanded
                ]}>
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
                        style={({ pressed }) => [
                            styles.iconButton,
                            { opacity: pressed ? 0.6 : 1 }
                        ]}
                        onPress={() => isExpanded ? (selectedUser ? setSelectedUser(null) : setIsExpanded(false)) : setIsExpanded(true)}
                        hitSlop={hitSlop}
                    >
                        <Ionicons
                            name={isExpanded ? (selectedUser ? "arrow-back" : "close") : "search"}
                            size={28}
                            color={COLORS.background}
                        />
                        {!isExpanded && hasNewRequests && myRequests.length > 0 && (
                            <View style={styles.newRequestIndicator}>
                                <Ionicons name="add" size={10} color={COLORS.primary} />
                            </View>
                        )}
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
        position: 'absolute',
        width: SCREEN_WIDTH * 1.5,
        height: SCREEN_HEIGHT * 2,
        bottom: -500, // Far enough down to cover everything
        right: -100, // Wide enough to cover everything
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
        justifyContent: 'flex-end', // Push items down to the search bar
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
        borderRadius: 20, // Rounded borders
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
        borderRadius: 12, // Rounded input
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
        borderRadius: 25, // Fully rounded button
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
        borderRadius: 24, // Circular avatar
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
});

export default FloatingSearch;
