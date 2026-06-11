import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    TextInput,
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
    Easing,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native';
import { Feather, AntDesign, Ionicons } from '@expo/vector-icons';
import { FONTS } from '@/theme/theme';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import DatePicker from 'react-native-date-picker';
import { updateProfile, uploadProfilePicture } from '@/services/profileService';
import { getFilmSource } from '@/utils/getMediaSource';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from '@/lib/supabase';
import { User } from '@/types/userTypes';
import { useProfileVideoUpload } from '@/contexts/ProfileVideoUploadContext';
import { Video as CompressorVideo } from 'react-native-compressor';

const { width: SCREEN_WIDTH, height } = Dimensions.get('window');
const TEXT_COLOR = '#2C2720';
const SHEET_HEIGHT = height * 0.85;
const HERO_FLEX = 0.68;
const CONTENT_FLEX = 0.32;
const SWIPE_THRESHOLD = 120;
const AUTO_CLOSE_MS = 3000; // close modal if upload takes longer than this

interface EditProfileProps {
    user: User;
    onBack: () => void;
    onSave?: (updatedUser: User) => Promise<void>;
}

const safeDate = (d: string | undefined | null) => {
    if (!d) return new Date();
    const p = new Date(d);
    return isNaN(p.getTime()) ? new Date() : p;
};

function VideoPreview({ uri }: { uri: string }) {
    const player = useVideoPlayer(getFilmSource(uri), (p) => {
        p.loop = true;
        p.muted = true;
        p.play();
    });
    return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

// ── Compress image to max 1100px wide, JPEG 0.82 quality ──────
async function compressImage(uri: string): Promise<string> {
    try {
        const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1100 } }],
            { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
        );
        return result.uri;
    } catch {
        return uri; // fallback to original on error
    }
}

// ── Compress video via react-native-compressor ─────────────────
async function compressVideo(uri: string): Promise<string> {
    try {
        const compressed = await CompressorVideo.compress(uri, {
            compressionMethod: 'auto',
            maxSize: 1280,
            minimumFileSizeForCompress: 8, // skip if < 8 MB
        });
        return compressed;
    } catch {
        return uri;
    }
}

const EditProfileScreen = ({ user, onBack, onSave }: EditProfileProps) => {
    const { setUploadStatus, onVideoReadyRef } = useProfileVideoUpload();

    const [name, setName] = useState(user?.name || '');
    const [profileImage, setProfileImage] = useState(user?.profilePicture || '');
    const [profileVideo, setProfileVideo] = useState<string>(user?.profileVideo || '');
    const [birthday, setBirthday] = useState(safeDate(user?.birthday));
    const [openDatePicker, setOpenDatePicker] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [activeSlide, setActiveSlide] = useState(0);

    const carouselRef = useRef<ScrollView>(null);
    const panY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
    const keyboardOffset = useRef(new Animated.Value(0)).current;
    const isHorizontalScrolling = useRef(false);
    const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Entry animation
    useEffect(() => {
        Animated.spring(panY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 12 }).start();
        return () => {
            if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
        };
    }, []);

    const handleClose = (onComplete?: () => void) => {
        Animated.timing(panY, {
            toValue: SHEET_HEIGHT,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }).start(() => { onBack(); onComplete?.(); });
    };

    // Keyboard
    useEffect(() => {
        const show = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => Animated.timing(keyboardOffset, { toValue: -e.endCoordinates.height, duration: 250, useNativeDriver: true }).start()
        );
        const hide = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => Animated.timing(keyboardOffset, { toValue: 0, duration: 250, useNativeDriver: true }).start()
        );
        return () => { show.remove(); hide.remove(); };
    }, []);

    // Pan-to-dismiss (vertical only)
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gs) =>
                !isHorizontalScrolling.current && gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
            onPanResponderMove: (_, gs) => { if (gs.dy > 0) panY.setValue(gs.dy); },
            onPanResponderRelease: (_, gs) => {
                if (gs.dy > SWIPE_THRESHOLD || gs.vy > 0.5) {
                    Animated.timing(panY, { toValue: SHEET_HEIGHT, duration: 200, useNativeDriver: true }).start(onBack);
                } else {
                    Animated.spring(panY, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();
                }
            },
        })
    ).current;

    // Carousel helpers
    const handleCarouselMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        setActiveSlide(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
        isHorizontalScrolling.current = false;
    };
    const goToSlide = (i: number) => {
        carouselRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
        setActiveSlide(i);
    };

    // Pickers
    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to change your profile picture.'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
        if (!res.canceled) setProfileImage(res.assets[0].uri);
    };
    const pickVideo = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to choose a video.'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, allowsEditing: false, quality: 1 });
        if (!res.canceled) setProfileVideo(res.assets[0].uri);
    };

    // ── Main save ──────────────────────────────────────────────
    const handleSave = async () => {
        if (!name.trim()) return;
        setIsSaving(true);

        try {
            const dateString = birthday.toISOString().split('T')[0];
            const hasNewImage = profileImage && !profileImage.startsWith('http');
            const hasNewVideo = profileVideo && !profileVideo.startsWith('http');
            const videoCleared = profileVideo === '' && !!user?.profileVideo;

            // ── Step 1: compress + upload image ──────────────────
            let finalPicUrl = user?.profilePicture;
            if (hasNewImage) {
                setIsCompressing(true);
                const compressedImg = await compressImage(profileImage);
                setIsCompressing(false);
                finalPicUrl = await uploadProfilePicture(user.id, compressedImg);
            }

            // ── Step 2: save non-video fields immediately ─────────
            await updateProfile(user.id, {
                name: name.trim(),
                birthday: dateString,
                ...(finalPicUrl ? { profile_picture: finalPicUrl } : {}),
                ...(videoCleared ? { profile_video: null } : {}),
            });

            // ── Step 2b: delete video from storage if cleared ─────
            if (videoCleared) {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user?.id) {
                        await supabase.storage
                            .from('profile-videos')
                            .remove([`${session.user.id}/profile-video.mp4`]);
                    }
                } catch (e) {
                    console.warn('[deleteVideo storage]', e);
                }
                // Notify profile screen immediately — no need to wait for onSave
                onVideoReadyRef.current?.(null);
            }

            const updatedUser: User = {
                ...user,
                name: name.trim(),
                birthday: dateString,
                profilePicture: finalPicUrl || '',
                profileVideo: videoCleared ? null : (user?.profileVideo ?? undefined),
            };

            // ── Step 3: handle video upload ───────────────────────
            if (hasNewVideo) {
                setIsCompressing(true);

                // Compress video in background-friendly way
                const compressPromise = compressVideo(profileVideo);

                // Start the 3-second auto-close timer now
                let modalAlreadyClosed = false;
                autoCloseTimerRef.current = setTimeout(() => {
                    if (!modalAlreadyClosed) {
                        modalAlreadyClosed = true;
                        // Close modal, switch to background upload mode
                        if (onSave) onSave(updatedUser).catch(() => {}); // save non-video fields
                        setUploadStatus('compressing');
                        handleClose();
                    }
                }, AUTO_CLOSE_MS);

                const compressed = await compressPromise;
                setIsCompressing(false);

                // Kick off the actual upload
                const uploadAndUpdate = async () => {
                    setUploadStatus('uploading');
                    try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session?.user?.id) throw new Error('No auth session');
                        const uid = session.user.id;

                        const filePath = `${uid}/profile-video.mp4`;
                        const response = await fetch(compressed);
                        const arrayBuffer = await response.arrayBuffer();

                        const { error: uploadError } = await supabase.storage
                            .from('profile-videos')
                            .upload(filePath, arrayBuffer, {
                                contentType: 'video/mp4',
                                upsert: true,
                            });
                        if (uploadError) throw uploadError;

                        const { data: { publicUrl } } = supabase.storage
                            .from('profile-videos')
                            .getPublicUrl(filePath);

                        const videoUrl = `${publicUrl}?t=${Date.now()}`;

                        await supabase
                            .from('profiles')
                            .update({ profile_video: videoUrl })
                            .eq('id', uid);

                        // Notify profile screen to update currentUser
                        onVideoReadyRef.current?.(videoUrl);
                        setUploadStatus('done');

                        // Reset to idle after a moment
                        setTimeout(() => setUploadStatus('idle'), 1500);
                        return videoUrl;
                    } catch (err: any) {
                        console.error('[uploadVideo]', err);
                        setUploadStatus('error');
                        Alert.alert('Upload failed', err?.message || 'Could not upload video.');
                        setTimeout(() => setUploadStatus('idle'), 2000);
                        throw err;
                    }
                };

                // If timer hasn't fired yet, run upload and close normally when done
                uploadAndUpdate().then((videoUrl) => {
                    if (!modalAlreadyClosed) {
                        clearTimeout(autoCloseTimerRef.current!);
                        modalAlreadyClosed = true;
                        if (onSave) {
                            const finalUser: User = { ...updatedUser, profileVideo: videoUrl };
                            onSave(finalUser).catch(() => {});
                        }
                        handleClose();
                        setIsSaving(false);
                    }
                }).catch(() => {
                    setIsSaving(false);
                });

                return; // async path — don't fall through to bottom
            }

            // ── No video change path ───────────────────────────────
            if (onSave) await onSave(updatedUser);
            handleClose();
        } catch (error: any) {
            console.error('SAVE ERROR:', error);
            Alert.alert('Error', `Failed to update: ${error?.message || JSON.stringify(error)}`);
            setIsSaving(false);
        }
    };

    const savingLabel = isCompressing ? 'Compressing…' : 'Saving…';

    return (
        <Modal visible={true} transparent={true} animationType="none" onRequestClose={() => handleClose()} statusBarTranslucent={true}>
            <View style={styles.overlayContainer}>
                <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); handleClose(); }}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>

                <Animated.View
                    style={[styles.modalCard, { height: SHEET_HEIGHT, transform: [{ translateY: Animated.add(panY, keyboardOffset) }] }]}
                    {...panResponder.panHandlers}
                >
                    {/* ── HERO CAROUSEL ── */}
                    <View style={{ flex: HERO_FLEX }}>
                        {/* Header */}
                        <View style={styles.headerOverlay} pointerEvents="box-none">
                            <TouchableOpacity onPress={() => handleClose()} disabled={isSaving} hitSlop={20}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <View style={styles.handleBar} />
                            <TouchableOpacity onPress={handleSave} disabled={isSaving} hitSlop={20}>
                                {isSaving
                                    ? <View style={styles.savingRow}><ActivityIndicator size="small" color="#fff" /><Text style={styles.savingLabel}>{savingLabel}</Text></View>
                                    : <Text style={styles.saveText}>Done</Text>
                                }
                            </TouchableOpacity>
                        </View>

                        {/* Carousel */}
                        <ScrollView
                            ref={carouselRef}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            scrollEventThrottle={16}
                            onScrollBeginDrag={() => { isHorizontalScrolling.current = true; }}
                            onMomentumScrollEnd={handleCarouselMomentumEnd}
                            style={{ flex: 1 }}
                        >
                            {/* Slide 1 — Photo */}
                            <View style={styles.slide}>
                                <UserAvatar uri={profileImage} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                                <View style={styles.slideGradient} pointerEvents="none" />
                                <TouchableOpacity onPress={pickImage} style={styles.slidePickBtn} activeOpacity={0.85}>
                                    <AntDesign name="camera" size={17} color="#fff" />
                                    <Text style={styles.slidePickLabel}>Change Photo</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Slide 2 — Video */}
                            <View style={styles.slide}>
                                {profileVideo
                                    ? <VideoPreview uri={profileVideo} />
                                    : (
                                        <View style={styles.videoPlaceholder}>
                                            <Ionicons name="videocam-outline" size={52} color="rgba(255,255,255,0.28)" />
                                            <Text style={styles.videoPlaceholderText}>No profile video yet</Text>
                                            <Text style={styles.videoPlaceholderSub}>This plays on your profile</Text>
                                        </View>
                                    )
                                }
                                <View style={styles.slideGradient} pointerEvents="none" />
                                <View style={styles.videoActions}>
                                    <TouchableOpacity onPress={pickVideo} style={styles.slidePickBtn} activeOpacity={0.85}>
                                        <Ionicons name="videocam-outline" size={17} color="#fff" />
                                        <Text style={styles.slidePickLabel}>{profileVideo ? 'Change Video' : 'Add Video'}</Text>
                                    </TouchableOpacity>
                                    {!!profileVideo && (
                                        <TouchableOpacity onPress={() => setProfileVideo('')} style={[styles.slidePickBtn, styles.removeBtnStyle]} activeOpacity={0.85}>
                                            <Ionicons name="trash-outline" size={16} color="#ff5555" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </ScrollView>

                        {/* Dots */}
                        <View style={styles.dotsRow} pointerEvents="box-none">
                            {[0, 1].map((i) => (
                                <TouchableOpacity key={i} onPress={() => goToSlide(i)} hitSlop={12}>
                                    <View style={[styles.dot, i === activeSlide ? styles.dotActive : styles.dotInactive]} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* ── FORM ── */}
                    <View style={{ flex: CONTENT_FLEX, backgroundColor: '#FFF' }}>
                        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Name</Text>
                                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your Name" placeholderTextColor="#C7C7CC" autoCorrect={false} />
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Birthday</Text>
                                <Text style={[styles.dateText, { color: '#8E8E93', fontSize: 15 }]}>
                                    {birthday.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                </Text>
                                <Feather name="lock" size={12} color="#8E8E93" style={{ marginLeft: 'auto' }} />
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>ID</Text>
                                <Text style={[styles.dateText, { color: '#8E8E93', fontSize: 15 }]}>{user.uniqueUserId || user.id}</Text>
                                <Feather name="lock" size={12} color="#8E8E93" style={{ marginLeft: 'auto' }} />
                            </View>
                        </ScrollView>
                    </View>
                </Animated.View>
            </View>

            <DatePicker modal open={openDatePicker} date={birthday} mode="date"
                onConfirm={(d) => { setOpenDatePicker(false); setBirthday(d); }}
                onCancel={() => setOpenDatePicker(false)} theme="auto" />
        </Modal>
    );
};

export default EditProfileScreen;

const styles = StyleSheet.create({
    overlayContainer: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    modalCard: { backgroundColor: '#0a0a0a', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },

    slide: { width: SCREEN_WIDTH, flex: 1, backgroundColor: '#111', justifyContent: 'flex-end', alignItems: 'center' },
    slideGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 110, backgroundColor: 'transparent' },
    videoPlaceholder: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: '#0f0f0f' },
    videoPlaceholderText: { color: 'rgba(255,255,255,0.28)', fontSize: 14, fontFamily: FONTS.medium, letterSpacing: 0.3 },
    videoPlaceholderSub: { color: 'rgba(255,255,255,0.15)', fontSize: 12, fontFamily: FONTS.regular ?? FONTS.medium, letterSpacing: 0.3 },
    videoActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
    slidePickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(10,10,10,0.65)', borderRadius: 28, paddingHorizontal: 20, paddingVertical: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', marginBottom: 28 },
    removeBtnStyle: { paddingHorizontal: 14, marginBottom: 28 },
    slidePickLabel: { color: '#fff', fontSize: 13, fontFamily: FONTS.medium, letterSpacing: 0.2 },

    dotsRow: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
    dot: { borderRadius: 4, height: 5 },
    dotActive: { width: 22, backgroundColor: 'rgba(255,255,255,0.92)' },
    dotInactive: { width: 6, backgroundColor: 'rgba(255,255,255,0.30)' },

    headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 16, zIndex: 10 },
    handleBar: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)', marginTop: 8 },
    cancelText: { fontSize: 17, fontFamily: FONTS.medium, color: 'rgba(255,255,255,0.8)' },
    saveText: { fontSize: 17, fontFamily: FONTS.bold, color: '#fff' },
    savingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    savingLabel: { fontSize: 13, fontFamily: FONTS.medium, color: 'rgba(255,255,255,0.7)' },

    scrollContent: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 24 },
    inputGroup: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, minHeight: 50 },
    label: { width: 80, fontSize: 16, fontFamily: FONTS.medium, color: '#8E8E93' },
    input: { flex: 1, fontSize: 17, fontFamily: FONTS.bold, color: TEXT_COLOR, padding: 0 },
    dateText: { fontSize: 17, fontFamily: FONTS.bold, color: TEXT_COLOR },
    divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)' },
});
