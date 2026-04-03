import React, { useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Modal,
    TouchableWithoutFeedback,
    Dimensions,
    Animated,
    PanResponder,
    Easing,
    Alert,
    Platform,
    Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { COLORS, FONTS } from '@/theme/theme';
import { filmService } from '@/services/filmService';
import { MediaItem } from '@/types/mediaTypes';

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = 280;
const SWIPE_THRESHOLD = 50;

interface MediaOptionsBottomSheetProps {
    isVisible: boolean;
    onClose: () => void;
    mediaItem: MediaItem | null;
    isOwner?: boolean;
    onDeleteSuccess?: (id: string) => void;
}

const MediaOptionsBottomSheet = ({ isVisible, onClose, mediaItem, isOwner, onDeleteSuccess }: MediaOptionsBottomSheetProps) => {
    const panY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

    useEffect(() => {
        if (isVisible) {
            Animated.spring(panY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 0,
                speed: 15
            }).start();
        } else {
            panY.setValue(SHEET_HEIGHT);
        }
    }, [isVisible]);

    const handleClose = () => {
        Animated.timing(panY, {
            toValue: SHEET_HEIGHT,
            duration: 200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }).start(() => {
            onClose();
        });
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy > 5;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) panY.setValue(gestureState.dy);
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > SWIPE_THRESHOLD || gestureState.vy > 0.5) {
                    handleClose();
                } else {
                    Animated.spring(panY, {
                        toValue: 0,
                        bounciness: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    const handleSave = async () => {
        if (!mediaItem?.uri) return;
        
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('permission required', 'we need access to your gallery to save this film.');
                return;
            }

            // For remote URIs, we first download to a temp file
            const fileExtension = mediaItem.type === 'video' ? 'mp4' : 'jpg';
            const fileUri = `${FileSystem.cacheDirectory}temp_media.${fileExtension}`;
            
            const downloadRes = await FileSystem.downloadAsync(mediaItem.uri, fileUri);
            
            if (downloadRes.status === 200) {
                await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
                Alert.alert('saved', 'film saved to your gallery!');
            } else {
                throw new Error('download failed');
            }
        } catch (err) {
            console.error('save error:', err);
            Alert.alert('error', 'could not save to gallery. please try again.');
        } finally {
            handleClose();
        }
    };

    const handleDelete = () => {
        if (!mediaItem?.id) return;

        Alert.alert(
            'delete film',
            'are you sure? this will remove the film from your profile forever.',
            [
                { text: 'cancel', style: 'cancel' },
                { 
                    text: 'delete', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await filmService.deleteFilm(mediaItem.id);
                            onDeleteSuccess?.(mediaItem.id);
                            handleClose();
                        } catch (err) {
                            console.error('delete error:', err);
                            Alert.alert('error', 'could not delete film.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <Modal
            visible={isVisible}
            transparent={true}
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent={true}
        >
            <View style={styles.overlayContainer}>
                <TouchableWithoutFeedback onPress={handleClose}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>

                <Animated.View
                    style={[
                        styles.modalCard,
                        {
                            transform: [{ translateY: panY }],
                        }
                    ]}
                    {...panResponder.panHandlers}
                >
                    <View style={styles.handleBar} />
                    
                    <View style={styles.optionsContainer}>
                        <TouchableOpacity style={styles.optionItem} onPress={handleSave}>
                            <View style={styles.iconWrapper}>
                                <Ionicons name="download-outline" size={22} color={COLORS.text} />
                            </View>
                            <Text style={styles.optionText}>save to phone</Text>
                        </TouchableOpacity>

                        {isOwner && (
                            <>
                                <View style={styles.divider} />

                                <TouchableOpacity style={styles.optionItem} onPress={handleDelete}>
                                    <View style={styles.iconWrapper}>
                                        <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                                    </View>
                                    <Text style={[styles.optionText, { color: '#FF3B30' }]}>delete</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

export default MediaOptionsBottomSheet;

const styles = StyleSheet.create({
    overlayContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: 12,
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modalCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        overflow: 'hidden',
        paddingTop: 12,
        paddingBottom: 8,
    },
    handleBar: {
        width: 36,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: 'rgba(0,0,0,0.1)',
        alignSelf: 'center',
        marginBottom: 8,
    },
    optionsContainer: {
        paddingHorizontal: 8,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    iconWrapper: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 8,
    },
    optionText: {
        fontSize: 17,
        fontFamily: FONTS.medium,
        color: COLORS.text,
        textTransform: 'lowercase',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginVertical: 4,
        marginHorizontal: 16,
    },
});
