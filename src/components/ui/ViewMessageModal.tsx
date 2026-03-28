import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    ActivityIndicator,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import VideoPlayer from './VideoPlayer';
import PhotoViewer from './PhotoViewer';
import AudioPlayer from './AudioPlayer';
import EmojiScatterOverlay from '@/features/timeline/components/EmojiScatterOverlay';
import { Message } from '@/types/domain';
import { MediaItem } from '@/types/mediaTypes';
import { COLORS, SPACING, FONTS } from '@/theme/theme';
import { useMediaInbox } from '@/contexts/MediaInboxContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ViewMessageModalProps {
    visible: boolean;
    media: Message | null;
    userName: string;
    userColor: string;
    onClose: () => void;
}

export const ViewMessageModal = ({ visible, media, userName, userColor, onClose }: ViewMessageModalProps) => {
    const [isClosing, setIsClosing] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isEmojiVisible, setIsEmojiVisible] = useState(false);
    const { reactToMessage } = useMediaInbox();

    // Reset state when visible changes
    useEffect(() => {
        if (visible && media) {
            setIsClosing(false);
            setIsReady(false);
            setIsEmojiVisible(false);
        } else {
            setIsReady(false);
        }
    }, [visible, media]);

    const handleMediaReady = () => {
        if (!media || !visible || isReady) return;
        setIsReady(true);
    };

    const handleClose = () => {
        if (isClosing) return;
        setIsClosing(true);
        onClose();
    };

    if (!visible || !media) return null;

    // Map Message (Schema) back to MediaItem (UI Legacy)
    const mediaItem: MediaItem = {
        id: media.id,
        type: media.type === 'voice' ? 'voice' : (media.type === 'video' ? 'video' : 'photo'),
        uri: media.uri || '',
        sender: 'them',
        timestamp: media.sentAt,
        durationSec: media.durationSec,
    };

    // Helper to get a very light version of the color for the background
    const lightColor = userColor + '15'; // ~8% opacity hex

    const formatRelativeTime = (dateString: string) => {
        try {
            const now = new Date();
            const sentAt = new Date(dateString);
            const diffMs = now.getTime() - sentAt.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return 'now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            return `${diffDays}d ago`;
        } catch (e) {
            return 'just now';
        }
    };

    const timeAgo = formatRelativeTime(media.sentAt);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <View style={[
                styles.backdrop,
                media.type === 'voice' ? styles.backdropCentered : styles.backdropShifted
            ]}>
                <LinearGradient
                    colors={[`${userColor}B0`, `${userColor}50`, 'rgba(0,0,0,0.85)']}
                    style={StyleSheet.absoluteFill}
                />
                <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.01)" translucent />

                <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

                <View style={styles.contentWrapper}>
                    <View style={styles.absoluteHeader}>
                        <Text style={[styles.userNameAbsolute, { color: userColor }]}>{userName}</Text>
                        <Text style={styles.timeTextAbsolute}>{timeAgo}</Text>
                    </View>

                    <View style={[styles.cardContainer, media.type === 'voice' && styles.cardContainerAudio]}>
                        <LinearGradient
                            colors={[userColor, lightColor, '#FFFFFF']}
                            style={StyleSheet.absoluteFill}
                        />

                        <View style={styles.mediaContainer}>
                            {media.type === 'video' && (
                                <VideoPlayer
                                    mediaItem={mediaItem}
                                    isFocused={true}
                                    autoPlay={true}
                                    onReady={handleMediaReady}
                                    themeColor={userColor}
                                />
                            )}
                            {(media.type as string === 'photo' || media.type as string === 'image') && (
                                <PhotoViewer mediaItem={mediaItem} onDragDown={handleClose} onReady={handleMediaReady} />
                            )}
                            {media.type === 'voice' && (
                                <View style={styles.voiceOverlay}>
                                    <AudioPlayer
                                        mediaItem={mediaItem}
                                        autoPlay={true}
                                        onReady={handleMediaReady}
                                        themeColor={userColor}
                                    />
                                </View>
                            )}
                        </View>

                        {!isReady && (
                            <View style={styles.loaderContainer}>
                                <ActivityIndicator size="large" color={userColor} />
                            </View>
                        )}
                    </View>

                    <View style={styles.outsideContainer}>
                        <TouchableOpacity onPress={(() => setIsEmojiVisible(true))} style={styles.emojiButtonGlass}>
                            <Text style={styles.emojiIcon}>😊</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <EmojiScatterOverlay
                    visible={isEmojiVisible}
                    onClose={() => setIsEmojiVisible(false)}
                    onSelect={(emoji) => {
                        if (media) {
                            reactToMessage(media.senderId, emoji);
                        }
                        setIsEmojiVisible(false);
                        handleClose();
                    }}
                />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
    },
    backdropCentered: {
        justifyContent: 'center',
    },
    backdropShifted: {
        justifyContent: 'flex-start',
        paddingTop: SCREEN_HEIGHT * 0.11,
    },
    cardContainer: {
        width: SCREEN_WIDTH * 0.9,
        height: SCREEN_HEIGHT * 0.72,
        borderRadius: 32,
        overflow: 'hidden',
        backgroundColor: '#000',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    cardContainerAudio: {
        height: SCREEN_WIDTH * 0.9,
        borderRadius: 32,
    },
    outsideContainer: {
        alignItems: 'center',
        marginTop: 24,
    },
    contentWrapper: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    absoluteHeader: {
        position: 'absolute',
        top: -30,
        left: -10,
        flexDirection: 'row',
        alignItems: 'flex-start',
        zIndex: 100,
        elevation: 10,
        width: '100%',
    },
    userNameAbsolute: {
        fontSize: 54,
        lineHeight: 60,
        fontFamily: 'DancingScript-Bold',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 8,
    },
    timeTextAbsolute: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        lineHeight: 20,
        fontFamily: FONTS.bold,
        textTransform: 'lowercase',
        marginLeft: 4,
        marginTop: 5,
    },
    emojiButtonGlass: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    emojiIcon: {
        fontSize: 32,
    },
    mediaContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 32,
        overflow: 'hidden',
    },
    voiceOverlay: {
        width: '90%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.8)',
        zIndex: 5,
    },
});
