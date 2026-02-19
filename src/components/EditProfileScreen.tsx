import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    TextInput,
    Image,
    Alert,
    Platform,
    ScrollView,
    ActivityIndicator,
    Modal,
    TouchableWithoutFeedback,
    Dimensions,
    Keyboard,
    Animated,
    PanResponder,
    Easing
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/constants/theme';
import * as ImagePicker from 'expo-image-picker';
import DatePicker from 'react-native-date-picker';

const { height } = Dimensions.get('window');

// THEME CONSTANTS
const TEXT_COLOR = '#2C2720';
const MODAL_HEIGHT_PERCENT = 0.8;
const SHEET_HEIGHT = height * MODAL_HEIGHT_PERCENT;
const HERO_FLEX = 0.7;
const CONTENT_FLEX = 0.3;
const SWIPE_THRESHOLD = 120;

interface User {
    id: string;
    name: string;
    profilePicture: string;
    birthday: string;
    uniqueUserId: string;
}

interface EditProfileProps {
    user: User;
    onBack: () => void;
    onSave?: (updatedUser: User) => Promise<void>;
}

const safeDate = (dateString: string | undefined | null) => {
    if (!dateString) return new Date();
    const parsed = new Date(dateString);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const EditProfileScreen = ({ user, onBack, onSave }: EditProfileProps) => {
    const [name, setName] = useState(user?.name || '');
    const [profileImage, setProfileImage] = useState(user?.profilePicture || '');
    const [birthday, setBirthday] = useState(safeDate(user?.birthday));
    const [openDatePicker, setOpenDatePicker] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // ANIMATION VALUES
    // Initial value is SHEET_HEIGHT (hidden at bottom)
    const panY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
    const keyboardOffset = useRef(new Animated.Value(0)).current;

    // ENTRY ANIMATION
    useEffect(() => {
        Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
            speed: 12
        }).start();
    }, []);

    // CLOSING FUNCTION (Smooth Slide Out)
    const handleClose = () => {
        Animated.timing(panY, {
            toValue: SHEET_HEIGHT, // Slide back down
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }).start(() => {
            onBack(); // Unmount after animation finishes
        });
    };

    // KEYBOARD HANDLING
    useEffect(() => {
        const keyboardWillShow = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                Animated.timing(keyboardOffset, {
                    toValue: -e.endCoordinates.height,
                    duration: 250,
                    useNativeDriver: true,
                }).start();
            }
        );
        const keyboardWillHide = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                Animated.timing(keyboardOffset, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }).start();
            }
        );
        return () => {
            keyboardWillShow.remove();
            keyboardWillHide.remove();
        };
    }, []);

    // PAN RESPONDER (SWIPE DOWN)
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy > 5;
            },
            onPanResponderMove: (_, gestureState) => {
                // Only allow dragging down (positive values)
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > SWIPE_THRESHOLD || gestureState.vy > 0.5) {
                    // Dragged far enough or fast enough -> Close
                    Animated.timing(panY, {
                        toValue: SHEET_HEIGHT,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(onBack);
                } else {
                    // Snap back to open
                    Animated.spring(panY, {
                        toValue: 0,
                        bounciness: 4,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission', 'We need access to photos.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 1,
        });
        if (!result.canceled) {
            setProfileImage(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setIsSaving(true);
        try {
            if (onSave) {
                const dateString = birthday.toISOString().split('T')[0];
                const updatedUser = {
                    ...user,
                    name: name.trim(),
                    profilePicture: profileImage,
                    birthday: dateString,
                };
                await onSave(updatedUser);
            } else {
                await new Promise(r => setTimeout(r, 800));
            }
            handleClose(); // Animate out on save
        } catch (error) {
            Alert.alert('Error', 'Failed to update.');
            setIsSaving(false);
        }
    };

    return (
        <Modal
            visible={true}
            transparent={true}
            animationType="none" // ✅ DISABLE DEFAULT FADE
            onRequestClose={handleClose}
            statusBarTranslucent={true}
        >
            <View style={styles.overlayContainer}>

                {/* 
                    Static Backdrop:
                    This stays solid/constant while you drag the sheet.
                    No opacity animation on this view during swipe.
                */}
                <TouchableWithoutFeedback onPress={() => {
                    Keyboard.dismiss();
                    handleClose();
                }}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>

                {/* ANIMATED SHEET */}
                <Animated.View
                    style={[
                        styles.modalCard,
                        {
                            height: SHEET_HEIGHT,
                            transform: [
                                { translateY: Animated.add(panY, keyboardOffset) }
                            ]
                        }
                    ]}
                    {...panResponder.panHandlers}
                >

                    {/* --- HERO IMAGE (70%) --- */}
                    <View style={{ flex: HERO_FLEX, position: 'relative' }}>
                        <Image
                            source={{ uri: profileImage }}
                            style={StyleSheet.absoluteFillObject}
                            resizeMode="cover"
                        />

                        {/* Header Actions */}
                        <View style={styles.headerOverlay}>
                            <TouchableOpacity onPress={handleClose} disabled={isSaving} hitSlop={20}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>

                            <View style={styles.handleBar} />

                            <TouchableOpacity onPress={handleSave} disabled={isSaving} hitSlop={20}>
                                {isSaving ? (
                                    <ActivityIndicator size="small" color={TEXT_COLOR} />
                                ) : (
                                    <Text style={styles.saveText}>Done</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Floating Repeat Button */}
                        <TouchableOpacity
                            onPress={pickImage}
                            style={styles.floatingRepeatBtn}
                            activeOpacity={0.9}
                        >
                            <Feather name="repeat" size={28} color={TEXT_COLOR} />
                        </TouchableOpacity>

                    </View>

                    {/* --- FORM SECTION (30%) --- */}
                    <View style={{ flex: CONTENT_FLEX, backgroundColor: '#FFF' }}>
                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >

                            {/* Name Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="Your Name"
                                    placeholderTextColor="#C7C7CC"
                                    autoCorrect={false}
                                />
                            </View>

                            <View style={styles.divider} />

                            {/* Birthday Input */}
                            <TouchableOpacity onPress={() => setOpenDatePicker(true)} style={styles.inputGroup}>
                                <Text style={styles.label}>Birthday</Text>
                                <View style={styles.dateButton}>
                                    <Text style={styles.dateText}>
                                        {birthday.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            {/* User ID */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>ID</Text>
                                <Text style={[styles.dateText, { color: '#8E8E93', fontSize: 15 }]}>
                                    {user.uniqueUserId || user.id}
                                </Text>
                                <Feather name="lock" size={12} color="#8E8E93" style={{ marginLeft: 'auto' }} />
                            </View>

                        </ScrollView>
                    </View>
                </Animated.View>
            </View>

            <DatePicker
                modal
                open={openDatePicker}
                date={birthday}
                mode="date"
                onConfirm={(date) => {
                    setOpenDatePicker(false);
                    setBirthday(date);
                }}
                onCancel={() => setOpenDatePicker(false)}
                theme="auto"
            />
        </Modal>
    );
};

export default EditProfileScreen;

const styles = StyleSheet.create({
    overlayContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'transparent',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)', // Static 40% opacity black
    },
    modalCard: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
    },

    // --- FLOATING REPEAT BUTTON ---
    floatingRepeatBtn: {
        position: 'absolute',
        bottom: -32,
        right: 24,
        zIndex: 20,
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: '#FFF',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },

    // --- HEADER OVERLAY ---
    headerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        zIndex: 10,
    },
    handleBar: {
        width: 40,
        height: 5,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.6)',
        alignSelf: 'flex-start',
        marginTop: 8,
    },
    cancelText: {
        fontSize: 17,
        fontFamily: FONTS.medium,
        color: TEXT_COLOR,
    },
    saveText: {
        fontSize: 17,
        fontFamily: FONTS.bold,
        color: TEXT_COLOR,
    },

    // --- CONTENT ---
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 24
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        minHeight: 50
    },
    label: {
        width: 80,
        fontSize: 16,
        fontFamily: FONTS.medium,
        color: '#8E8E93'
    },
    input: {
        flex: 1,
        fontSize: 17,
        fontFamily: FONTS.bold,
        color: TEXT_COLOR,
        padding: 0
    },
    dateButton: { flex: 1, justifyContent: 'center' },
    dateText: { fontSize: 17, fontFamily: FONTS.bold, color: TEXT_COLOR },
    divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)' },
});
