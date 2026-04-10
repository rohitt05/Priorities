// src/components/ui/MediaViewer.tsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Animated,
    StatusBar,
    FlatList,
    ListRenderItem,
    Alert,
    PanResponder,
    Image,
    Dimensions,
    Platform,
} from 'react-native';
import { Ionicons, Entypo } from '@expo/vector-icons';
import { useBackground } from '@/contexts/BackgroundContext';
import { supabase } from '@/lib/supabase';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';

import PhotoViewer from './PhotoViewer';
import VideoPlayer from './VideoPlayer';
import AudioPlayer from './AudioPlayer';
import NoteViewer from './NoteViewer';
import CallInfoViewer from './CallInfoViewer';
import MessageMediaItemBottomSheet from './MessageMediaItemBottomSheet';
import { MediaItem } from '@/types/mediaTypes';
import { initiateDeleteRequest } from '@/services/memoryDeleteService';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return '';
    // If it's already formatted like "Apr 9, 2026, 10:02 PM", we need to parse it back or just use it.
    // However, the user wants dd/mm/yy format. 
    // Since formatTimestamp was used before passing here, it might be a string.
    // We'll try to parse it.
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr; // fallback if already a string we can't parse
        const day = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        return `${dd}/${mm}/${yy} ${day}`;
    } catch {
        return dateStr;
    }
};

// Typed AnimatedFlatList — avoids the `unknown` item type that
// Animated.createAnimatedComponent strips when used without a generic.
const AnimatedFlatList = Animated.createAnimatedComponent(
    FlatList<MediaItem>
);


interface MediaViewerProps {
    visible: boolean;
    initialMediaItem: MediaItem | null;
    allMediaItems: MediaItem[];
    onClose: () => void;
    otherUserId?: string;
    otherUserProfilePic?: string;
}

export default function MediaViewer({
    visible,
    initialMediaItem,
    allMediaItems,
    onClose,
    otherUserId,
    otherUserProfilePic,
}: MediaViewerProps) {
    const { bgColor, prevBgColor, colorAnim } = useBackground();

    // ─── Header + dots visibility ────────────────────────────────────────
    const headerOpacity = useRef(new Animated.Value(1)).current;
    const isHeaderVisible = useRef(true);

    const showHeader = useCallback(() => {
        if (isHeaderVisible.current) return;
        isHeaderVisible.current = true;
        Animated.timing(headerOpacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [headerOpacity]);

    const hideHeader = useCallback(() => {
        if (!isHeaderVisible.current) return;
        isHeaderVisible.current = false;
        Animated.timing(headerOpacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [headerOpacity]);

    const handleMediaTap = useCallback(() => {
        if (sheetVisible) return;
        isHeaderVisible.current ? hideHeader() : showHeader();
    }, [hideHeader, showHeader]);
    // ─────────────────────────────────────────────────────────────────────

    // ─── Bottom sheet state ───────────────────────────────────────────────
    const [sheetVisible, setSheetVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [flashMsg, setFlashMsg] = useState<{ title: string, desc: string, isError?: boolean } | null>(null);

    const openSheet = useCallback(() => {
        showHeader();
        setSheetVisible(true);
    }, [showHeader]);

    const closeSheet = useCallback(() => {
        setSheetVisible(false);
    }, []);
    // ─────────────────────────────────────────────────────────────────────

    const backgroundColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    const opacity = useRef(new Animated.Value(0)).current;
    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef<FlatList<MediaItem>>(null);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isListReady, setIsListReady] = useState(false);

    const currentIndexRef = useRef(currentIndex);
    currentIndexRef.current = currentIndex;

    const currentItem = allMediaItems[currentIndex] ?? initialMediaItem;

    const [myProfilePic, setMyProfilePic] = useState<string | null>(null);

    useEffect(() => {
        if (!visible) return;
        const fetchMe = async () => {
            const { data } = await supabase.auth.getSession();
            const myId = data?.session?.user?.id;
            if (myId) {
                const { data: profile } = await supabase.from('profiles').select('profile_picture').eq('id', myId).single();
                if (profile?.profile_picture) {
                    setMyProfilePic(profile.profile_picture);
                }
            }
        };
        fetchMe();
    }, [visible]);

    // ─── Drag down to close logic ───
    const panY = useRef(new Animated.Value(0)).current;
    
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Only capture strictly vertical swipes to not interfere with horizontal flatlist
                return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 20;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) { // only allow dragging down
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 120) {
                    onClose();
                } else {
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                        bounciness: 0,
                    }).start();
                }
            },
        })
    ).current;

    // ─── Derived: can we send a delete request for this item? ─────────────
    // Only show the option when:
    //   a) we have the other user's ID (passed from UserTimelineView)
    //   b) the media was sent BY them (sender === 'them')
    const canRequestDeletion = useMemo(() => {
        if (!otherUserId || !currentItem) return false;
        return currentItem.sender === 'them';
    }, [otherUserId, currentItem]);
    // ─────────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (visible) {
            panY.setValue(0);
            Animated.timing(opacity, {
                toValue: 1,
                duration: 240,
                useNativeDriver: true,
            }).start();
        } else {
            opacity.setValue(0);
            panY.setValue(0);
            setSheetVisible(false);
            setCurrentIndex(0);
            setIsListReady(false);
        }
    }, [visible]);

    useEffect(() => {
        if (!visible || !initialMediaItem || allMediaItems.length === 0 || isListReady) return;
        const idx = allMediaItems.findIndex(item => item.id === initialMediaItem.id);
        const target = idx >= 0 ? idx : 0;
        setCurrentIndex(target);
        setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: target, animated: false });
            setIsListReady(true);
        }, 50);
    }, [visible, initialMediaItem, allMediaItems, isListReady]);

    // ─── Save to camera roll ──────────────────────────────────────────────
    const handleDownload = useCallback(async () => {
        const item = allMediaItems[currentIndexRef.current] ?? initialMediaItem;
        if (!item?.uri) {
            Alert.alert('Nothing to save', 'This item has no media file.');
            return;
        }
        if (item.type !== 'photo' && item.type !== 'video') {
            Alert.alert('Not supported', 'Only photos and videos can be saved to Camera Roll.');
            return;
        }
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission denied', 'Allow access to your Camera Roll in Settings.');
            return;
        }
        setIsSaving(true);
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            let localUri = item.uri;
            if (localUri.startsWith('http')) {
                const ext = item.type === 'video' ? '.mp4' : '.jpg';
                const dest = FileSystem.cacheDirectory + `media_save_${Date.now()}${ext}`;
                const dl = await FileSystem.downloadAsync(localUri, dest);
                localUri = dl.uri;
            }
            await MediaLibrary.saveToLibraryAsync(localUri);
            Alert.alert('Saved', 'Media saved to your Camera Roll.');
        } catch (e) {
            console.error('[MediaViewer] Save failed:', e);
            Alert.alert('Save failed', 'Could not save media. Try again.');
        } finally {
            setIsSaving(false);
        }
    }, [allMediaItems, initialMediaItem]);

    // ─── Request memory deletion (mutual consent — only path to delete) ───
    const handleRequestMemoryDeletion = useCallback(() => {
        const item = allMediaItems[currentIndexRef.current] ?? initialMediaItem;
        if (!item || !otherUserId) return;
        setShowDeleteConfirm(true);
    }, [allMediaItems, initialMediaItem, otherUserId]);

    const executeDeleteRequest = async () => {
        const item = allMediaItems[currentIndexRef.current] ?? initialMediaItem;
        if (!item || !otherUserId) return;

        setIsRequestingDeletion(true);
        setShowDeleteConfirm(false);

        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const result = await initiateDeleteRequest(
                item.id,
                otherUserId,
                item.uri,
            );
            
            switch (result) {
                case 'requested':
                    setFlashMsg({ title: 'Request Sent ✓', desc: 'They will see your request.' });
                    break;
                case 'auto_deleted':
                    setFlashMsg({ title: 'Memory Deleted', desc: 'Removed from both timelines.' });
                    setTimeout(() => onClose(), 2000);
                    break;
                case 'already_pending':
                    setFlashMsg({ title: 'Already Sent', desc: 'Waiting for their response.' });
                    break;
                case 'error':
                    setFlashMsg({ title: 'Oops', desc: 'Could not send request.', isError: true });
                    break;
            }
            setTimeout(() => setFlashMsg(null), 3500);
        } catch (e) {
            setFlashMsg({ title: 'Oops', desc: 'Could not send request.', isError: true });
            setTimeout(() => setFlashMsg(null), 3500);
        } finally {
            setIsRequestingDeletion(false);
        }
    };
    // ─────────────────────────────────────────────────────────────────────

    // Typed as ListRenderItem<MediaItem> so the generic flows correctly
    // into AnimatedFlatList — no more `unknown` item mismatch.
    const renderItem = useCallback<ListRenderItem<MediaItem>>(({ item }) => (
        <TouchableWithoutFeedback onPress={handleMediaTap}>
            <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
                {item.type === 'photo' && (
                    <PhotoViewer mediaItem={item} />
                )}
                {item.type === 'video' && (
                    <VideoPlayer mediaItem={item} />
                )}
                {item.type === 'voice' && (
                    <AudioPlayer mediaItem={item} />
                )}
                {(item.type === 'voice_call' || item.type === 'video_call') && (
                    <CallInfoViewer mediaItem={item} />
                )}
                {!['photo', 'video', 'voice', 'voice_call', 'video_call'].includes(item.type) && (
                    <NoteViewer mediaItem={item} />
                )}
            </View>
        </TouchableWithoutFeedback>
    ), [handleMediaTap]);

    // Typed to match (item: MediaItem) => string — satisfies FlatList<MediaItem>
    const keyExtractor = useCallback<(item: MediaItem) => string>(
        (item) => item.id,
        []
    );

    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: any) => {
            if (viewableItems.length > 0) {
                setCurrentIndex(viewableItems[0].index ?? 0);
            }
        },
        []
    );

    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <StatusBar hidden />
            <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
                <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor }]} />

                <Animated.View
                    {...panResponder.panHandlers}
                    style={[StyleSheet.absoluteFill, { transform: [{ translateY: panY }] }]}
                >
                    <AnimatedFlatList
                    ref={flatListRef}
                    data={allMediaItems}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig.current}
                    scrollEventThrottle={16}
                    onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                        { useNativeDriver: false }
                    )}
                    getItemLayout={(_: any, index: number) => ({
                        length: SCREEN_WIDTH,
                        offset: SCREEN_WIDTH * index,
                        index,
                    })}
                    initialScrollIndex={0}
                    scrollToOverflowEnabled
                />

                    {/* Info Bar at the bottom */}
                    <Animated.View style={[styles.bottomBar, { opacity: headerOpacity }]} pointerEvents="box-none">
                        <View style={styles.barLeftSection}>
                            {currentItem?.sender === 'me' ? (
                                myProfilePic ? (
                                    <Image source={{ uri: myProfilePic }} style={styles.profileCircle} />
                                ) : (
                                    <View style={[styles.profileCircle, { backgroundColor: '#555' }]} />
                                )
                            ) : (
                                otherUserProfilePic ? (
                                    <Image source={{ uri: otherUserProfilePic }} style={styles.profileCircle} />
                                ) : (
                                    <View style={[styles.profileCircle, { backgroundColor: '#555' }]} />
                                )
                            )}
                            <Text style={styles.senderSmallText}>
                                {currentItem?.sender === 'me' ? 'me' : 'them'}
                            </Text>
                        </View>

                        <View style={styles.barCenterSection}>
                            <Text style={styles.barDateText}>
                                {formatDisplayDate(currentItem?.timestamp)}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.barRightSection}
                            onPress={openSheet}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <View style={styles.twoDotsContainer}>
                                <View style={styles.tinyDot} />
                                <View style={styles.tinyDot} />
                            </View>
                        </TouchableOpacity>
                    </Animated.View>

                </Animated.View>

                <MessageMediaItemBottomSheet
                    visible={sheetVisible}
                    onClose={closeSheet}
                    onDownload={handleDownload}
                    onDelete={handleRequestMemoryDeletion}
                    onRequestMemoryDeletion={handleRequestMemoryDeletion}
                    isSaving={isSaving}
                    isDeleting={isRequestingDeletion}
                    canRequestDeletion={canRequestDeletion}
                    isRequestingDeletion={isRequestingDeletion}
                />

                {/* --- CUSTOM CONFIRMATION MODAL OVERYLAY --- */}
                {showDeleteConfirm && (
                    <View style={styles.customModalOverlay}>
                        <TouchableWithoutFeedback onPress={() => setShowDeleteConfirm(false)}>
                            <View style={StyleSheet.absoluteFillObject} />
                        </TouchableWithoutFeedback>
                        <View style={styles.customModalBox}>
                            <View style={styles.customModalIconContainer}>
                                <Ionicons name="trash-outline" size={32} color="#FF3B30" />
                            </View>
                            <Text style={styles.customModalTitle}>Delete Memory?</Text>
                            <Text style={styles.customModalDesc}>
                                You are asking them to delete this memory from both timelines.
                            </Text>
                            
                            <View style={styles.customModalActions}>
                                <TouchableOpacity 
                                    style={[styles.customModalBtn, { backgroundColor: 'rgba(0,0,0,0.05)' }]} 
                                    onPress={() => setShowDeleteConfirm(false)}
                                >
                                    <Text style={[styles.customModalBtnText, { color: '#8E8E93' }]}>Cancel</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={[styles.customModalBtn, { backgroundColor: '#FF3B30' }]}
                                    onPress={executeDeleteRequest}
                                >
                                    <Text style={[styles.customModalBtnText, { color: '#FFF' }]}>Send Request</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                {/* --- FLASH MESSAGE --- */}
                {flashMsg && (
                    <View style={styles.flashMsgContainer} pointerEvents="none">
                        <View style={[styles.flashMsgBox, flashMsg.isError && { borderColor: '#FF3B30', backgroundColor: '#FF3B3015' }]}>
                            <Text style={styles.flashMsgTitle}>{flashMsg.title}</Text>
                            <Text style={styles.flashMsgDesc} numberOfLines={1}>{flashMsg.desc}</Text>
                        </View>
                    </View>
                )}
            </Animated.View>
        </Modal>
    );
}


const styles = StyleSheet.create({
    bottomBar: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 40 : 24,
        left: 0,
        right: 0,
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        zIndex: 100,
    },
    barLeftSection: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    barCenterSection: {
        flex: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    barRightSection: {
        flex: 1,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    profileCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        marginRight: 8,
    },
    senderSmallText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        textTransform: 'lowercase',
        opacity: 0.9,
    },
    barDateText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 14,
        fontWeight: '500',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    twoDotsContainer: {
        flexDirection: 'row',
        gap: 4,
    },
    tinyDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#FFF',
    },
    customModalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
    },
    customModalBox: {
        width: '85%',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    customModalIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 59, 48, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    customModalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1C1C1E',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    customModalDesc: {
        fontSize: 15,
        color: '#8E8E93',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
        paddingHorizontal: 10,
    },
    customModalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    customModalBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    customModalBtnText: {
        fontSize: 16,
        fontWeight: '700',
    },
    flashMsgContainer: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 2500,
    },
    flashMsgBox: {
        backgroundColor: 'rgba(28, 28, 30, 0.95)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    flashMsgTitle: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 2,
    },
    flashMsgDesc: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        fontWeight: '500',
    },
    floatingClose: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 20,
        zIndex: 110,
    },
    pagination: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 110 : 94,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        zIndex: 50,
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.35)',
    },
    dotActive: {
        backgroundColor: '#fff',
        width: 7,
        height: 7,
    },
});
