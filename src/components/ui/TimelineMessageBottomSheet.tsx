// src/components/ui/TimelineMessageBottomSheet.tsx
// Two-dot icon (...) on the bottom-right of each timeline message card.
// Opens a bottom sheet with two options: Delete (receiver only) and Save to phone.
import React, { useRef, useCallback, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Animated,
    Dimensions,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS } from '@/theme/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = 220;

interface TimelineMessageBottomSheetProps {
    /** Supabase message row id */
    messageId: string;
    /** The authenticated user's id — used to check if they are the receiver */
    currentUserId: string;
    /** Whether the current user is the receiver (can delete) */
    isReceiver: boolean;
    /** Public/signed URL of the media to download */
    mediaUri: string;
    /** Media type so we save to the right library bucket */
    mediaType: 'photo' | 'video' | 'voice';
    /** Called after a successful delete so the parent list can refresh */
    onDeleted?: () => void;
}

// ─── Two-dot Trigger ─────────────────────────────────────────────────────────
export const TwoDotIcon: React.FC<{ onPress: () => void }> = ({ onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.6}
        style={styles.twoDotButton}
    >
        {/* Two small vertical dots */}
        <View style={styles.dot} />
        <View style={[styles.dot, { marginTop: 4 }]} />
    </TouchableOpacity>
);

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────
const TimelineMessageBottomSheet: React.FC<TimelineMessageBottomSheetProps> = ({
    messageId,
    currentUserId,
    isReceiver,
    mediaUri,
    mediaType,
    onDeleted,
}) => {
    const [visible, setVisible] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();

    const openSheet = useCallback(() => {
        setVisible(true);
        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 100,
                friction: 12,
                useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
    }, [slideAnim, backdropOpacity]);

    const closeSheet = useCallback(() => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: SHEET_HEIGHT,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => setVisible(false));
    }, [slideAnim, backdropOpacity]);

    // ── DELETE ────────────────────────────────────────────────────────────────
    const handleDelete = useCallback(async () => {
        if (!isReceiver) {
            Alert.alert('Cannot delete', 'Only the receiver can delete a message from the timeline.');
            return;
        }
        Alert.alert(
            'Delete message',
            'This will remove the message from your timeline. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        closeSheet();
                        setIsDeleting(true);
                        try {
                            const { error } = await supabase
                                .from('messages')
                                .delete()
                                .eq('id', messageId)
                                .eq('receiver_id', currentUserId);
                            if (error) throw error;
                            onDeleted?.();
                        } catch (err: any) {
                            Alert.alert('Error', err?.message ?? 'Could not delete message.');
                        } finally {
                            setIsDeleting(false);
                        }
                    },
                },
            ]
        );
    }, [isReceiver, messageId, currentUserId, onDeleted, closeSheet]);

    // ── SAVE TO PHONE ─────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        closeSheet();
        setIsSaving(true);
        try {
            // Ensure permission
            if (!permissionResponse || permissionResponse.status !== 'granted') {
                const { status } = await requestPermission();
                if (status !== 'granted') {
                    Alert.alert('Permission required', 'Please allow media library access to save.');
                    setIsSaving(false);
                    return;
                }
            }

            // Download to a temp file first
            const ext = mediaType === 'video' ? 'mp4' : mediaType === 'voice' ? 'm4a' : 'jpg';
            const localUri = `${FileSystem.cacheDirectory}priorities_save_${Date.now()}.${ext}`;
            const downloadRes = await FileSystem.downloadAsync(mediaUri, localUri);

            if (downloadRes.status !== 200) {
                throw new Error('Download failed');
            }

            // Save to photo library
            const asset = await MediaLibrary.createAssetAsync(downloadRes.uri);
            const albumName = 'Priorities';
            const album = await MediaLibrary.getAlbumAsync(albumName);
            if (album == null) {
                await MediaLibrary.createAlbumAsync(albumName, asset, false);
            } else {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            }
            Alert.alert('Saved', 'Saved to your Priorities album!');
        } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'Could not save media.');
        } finally {
            setIsSaving(false);
        }
    }, [mediaUri, mediaType, permissionResponse, requestPermission, closeSheet]);

    return (
        <>
            {/* Two-dot trigger rendered inline by the parent */}
            <TwoDotIcon onPress={openSheet} />

            {/* Loading overlays (shown outside modal so they're always visible) */}
            {(isDeleting || isSaving) && (
                <View style={styles.loadingBadge}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
            )}

            <Modal
                visible={visible}
                transparent
                animationType="none"
                onRequestClose={closeSheet}
                statusBarTranslucent
            >
                {/* Backdrop */}
                <Animated.View
                    style={[styles.backdrop, { opacity: backdropOpacity }]}
                >
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSheet} activeOpacity={1} />
                </Animated.View>

                {/* Sheet */}
                <Animated.View
                    style={[
                        styles.sheet,
                        { transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    {/* Handle */}
                    <View style={styles.handle} />

                    {/* ── DELETE option (receiver only) ── */}
                    <TouchableOpacity
                        style={styles.option}
                        onPress={handleDelete}
                        activeOpacity={0.7}
                        disabled={!isReceiver}
                    >
                        <View style={[styles.optionIcon, { backgroundColor: 'rgba(255,64,64,0.1)' }]}>
                            <Feather name="trash-2" size={20} color="#FF4040" />
                        </View>
                        <View style={styles.optionText}>
                            <Text style={[styles.optionTitle, { color: '#FF4040' }]}>Delete</Text>
                            <Text style={styles.optionSub}>
                                {isReceiver
                                    ? 'Remove from your timeline'
                                    : 'Only the receiver can delete'}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    {/* ── SAVE option ── */}
                    <TouchableOpacity
                        style={styles.option}
                        onPress={handleSave}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.optionIcon, { backgroundColor: 'rgba(67,61,53,0.08)' }]}>
                            <Ionicons name="download-outline" size={20} color={COLORS.primary} />
                        </View>
                        <View style={styles.optionText}>
                            <Text style={styles.optionTitle}>Save to phone</Text>
                            <Text style={styles.optionSub}>Download to your Priorities album</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Cancel pill */}
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={closeSheet}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </Animated.View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    // Two-dot trigger
    twoDotButton: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.28)',
        borderRadius: 14,
    },
    dot: {
        width: 3.5,
        height: 3.5,
        borderRadius: 2,
        backgroundColor: '#FFF',
    },

    // Loading badge
    loadingBadge: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Backdrop
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },

    // Sheet
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: SHEET_HEIGHT,
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: -4 },
        shadowRadius: 16,
        elevation: 20,
    },
    handle: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.border,
        marginBottom: 16,
    },

    // Options
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 14,
    },
    optionIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionText: { flex: 1 },
    optionTitle: {
        fontSize: 15,
        fontFamily: FONTS.semibold,
        fontWeight: '600',
        color: COLORS.text,
    },
    optionSub: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        marginTop: 1,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 4,
        marginLeft: 56,
    },

    // Cancel
    cancelButton: {
        marginTop: 10,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: {
        fontSize: 14,
        fontFamily: FONTS.medium,
        fontWeight: '500',
        color: COLORS.textSecondary,
        letterSpacing: 0.2,
    },
});

export default TimelineMessageBottomSheet;
