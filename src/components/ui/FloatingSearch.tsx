import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Pressable,
    StyleSheet,
    Animated,
    TextInput,
    Dimensions,
    Keyboard,
    Platform,
    Text,
    Image,
    FlatList,
    InteractionManager
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/theme/theme';
import usersData from '@/data/users.json';

const { width } = Dimensions.get('window');

import { Profile } from '@/types/domain';

interface FloatingSearchProps {
    onAddPriority?: (user: Profile) => void;
}

const FloatingSearch = ({ onAddPriority }: FloatingSearchProps) => {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [relationship, setRelationship] = useState('');

    const expandAnim = useRef(new Animated.Value(0)).current;
    const keyboardOffset = useRef(new Animated.Value(0)).current;
    const resultsAnim = useRef(new Animated.Value(0)).current;
    const relationshipAnim = useRef(new Animated.Value(0)).current;
    const inputRef = useRef<TextInput>(null);
    const relInputRef = useRef<TextInput>(null);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSubscription = Keyboard.addListener(showEvent, (e) => {
            Animated.spring(keyboardOffset, {
                toValue: e.endCoordinates.height + (Platform.OS === 'ios' ? 20 : 10),
                friction: 8,
                tension: 40,
                useNativeDriver: false,
            }).start();
        });

        const hideSubscription = Keyboard.addListener(hideEvent, () => {
            Animated.spring(keyboardOffset, {
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
        Animated.spring(expandAnim, {
            toValue: isExpanded ? 1 : 0,
            friction: 8,
            tension: 40,
            useNativeDriver: false, // width/borderRadius require JS driver
        }).start();

        if (isExpanded) {
            // Wait for animation to finish before focusing
            const task = InteractionManager.runAfterInteractions(() => {
                inputRef.current?.focus();
            });
            return () => task.cancel();
        } else {
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
        Animated.timing(resultsAnim, {
            toValue: (filteredUsers.length > 0 && !selectedUser) ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [filteredUsers, selectedUser]);

    useEffect(() => {
        Animated.spring(relationshipAnim, {
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
        outputRange: [60, width - 40],
    });

    const borderRadius = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [30, 20],
    });

    const hitSlop = { top: 20, bottom: 20, left: 20, right: 20 };

    const bottomPosition = Animated.add(new Animated.Value(30), keyboardOffset);

    return (
        <Animated.View
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
                <Animated.View
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
                </Animated.View>
            )}

            {/* Results List */}
            {filteredUsers.length > 0 && !selectedUser && (
                <Animated.View
                    style={[
                        styles.resultsContainer,
                        {
                            opacity: resultsAnim,
                            width: width - 40,
                            transform: [{
                                translateY: resultsAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [10, 0]
                                })
                            }]
                        }
                    ]}
                >
                    <FlatList
                        data={filteredUsers}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <View style={styles.resultItem}>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.userInfoContainer,
                                        { opacity: pressed ? 0.6 : 1 }
                                    ]}
                                    onPress={() => {
                                        setIsExpanded(false);
                                        resetSearch();
                                        router.push({
                                            pathname: '/profile',
                                            params: { userId: item.uniqueUserId }
                                        });
                                    }}
                                >
                                    <Image source={{ uri: item.profilePicture }} style={styles.avatar} />
                                    <View style={styles.userInfo}>
                                        <Text style={styles.userName}>{item.name}</Text>
                                        <Text style={styles.userId}>@{item.uniqueUserId}</Text>
                                    </View>
                                </Pressable>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.addButton,
                                        { transform: [{ scale: pressed ? 0.9 : 1 }] }
                                    ]}
                                    onPress={() => handleAddPress(item)}
                                >
                                    <Ionicons name="add-circle" size={32} color={COLORS.primary} />
                                </Pressable>
                            </View>
                        )}
                        style={styles.resultsList}
                    />
                </Animated.View>
            )}

            <View style={styles.searchBar}>
                {isExpanded && (
                    <TextInput
                        ref={inputRef}
                        style={styles.input}
                        placeholder="search unique user id..."
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
                </Pressable>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        right: 20,
        backgroundColor: COLORS.primary,
        zIndex: 2000,
        elevation: 10,
        shadowColor: '#433D35',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        overflow: 'visible',
    },
    searchBar: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
    },
    iconButton: {
        width: 30,
        height: 30,
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
        bottom: 70,
        left: 0,
        backgroundColor: COLORS.secondary,
        borderRadius: 20, // Rounded borders
        maxHeight: 320,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        shadowColor: '#433D35',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
        padding: 8,
    },
    relationshipContainer: {
        position: 'absolute',
        bottom: 70,
        left: 0,
        right: 0,
        width: width - 40,
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
});

export default FloatingSearch;
