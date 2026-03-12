import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    ActivityIndicator,
    Animated,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import VideoPlayer from './VideoPlayer';
import PhotoViewer from './PhotoViewer';
import AudioPlayer from './AudioPlayer';
import EmojiScatterOverlay from '@/features/timeline/components/EmojiScatterOverlay';
import { MediaItem } from '@/types/mediaTypes';
import { COLORS, SPACING, FONTS } from '@/theme/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ViewMessageModalProps {
    visible: boolean;
    media: {
        type: 'video' | 'image' | 'voice';
        uri: string;
        durationSec?: number;
    } | null;
    userName: string;
    userColor: string;
    onClose: () => void;
}

export const ViewMessageModal = ({ visible, media, userName, userColor, onClose }: ViewMessageModalProps) => {
    const [isClosing, setIsClosing] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isEmojiVisible, setIsEmojiVisible] = useState(false);

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

    const mediaItem: MediaItem = {
        id: 'temp_message',
        type: media.type === 'voice' ? 'audio' : (media.type === 'video' ? 'video' : 'photo'),
        uri: media.uri,
        sender: 'them',
        timestamp: new Date().toISOString(),
        durationSec: media.durationSec,
    };

    // Helper to get a very light version of the color for the background
    const lightColor = userColor + '20'; // 12% opacity hex

    // Generate a pseudo-random stable time based on username
    const timeOptions = ['5m ago', '12m ago', '25m ago', '45m ago', '1h ago', '2h ago', '4h ago'];
    const timeIndex = userName.length % timeOptions.length;
    const timeAgo = timeOptions[timeIndex];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <View style={styles.backdrop}>
                <LinearGradient
                    colors={[`${userColor}B0`, `${userColor}50`, 'rgba(0,0,0,0.85)']}
                    style={StyleSheet.absoluteFill}
                />
                <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.01)" translucent />
                
                {/* Backdrop press to close */}
                <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

                {/* Main Content Wrapper allowing overflow */}
                <View style={styles.contentWrapper}>
                    {/* Header: Name half in/out, Time strictly outside/above */}
                    <View style={styles.absoluteHeader}>
                        <Text style={[styles.userNameAbsolute, { color: userColor }]}>{userName}</Text>
                        <Text style={styles.timeTextAbsolute}>{timeAgo}</Text>
                    </View>

                    <View style={[styles.cardContainer, media.type === 'voice' && styles.cardContainerAudio]}>
                    {/* Dominant Color Gradient Background */}
                    <LinearGradient
                        colors={[userColor, lightColor, '#FFFFFF']}
                        style={StyleSheet.absoluteFill}
                    />
                    
                    {/* Background Media */}
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
                        {media.type === 'image' && (
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

                {/* Details Outside the Card */}
                <View style={styles.outsideContainer}>
                    {/* Emoji Button at the bottom with circle glass padding */}
                    <TouchableOpacity onPress={(() => setIsEmojiVisible(true))} style={styles.emojiButtonGlass}>
                        <Text style={styles.emojiIcon}>😊</Text>
                    </TouchableOpacity>
                </View>
            </View>

                {/* Emoji Overlay */}
                <EmojiScatterOverlay
                    visible={isEmojiVisible}
                    onClose={() => setIsEmojiVisible(false)}
                    onSelect={(emoji) => {
                        console.log('Selected emoji:', emoji);
                        setIsEmojiVisible(false);
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardContainer: {
        width: SCREEN_WIDTH * 0.9,
        height: SCREEN_HEIGHT * 0.72,
        borderRadius: 32,
        overflow: 'hidden',
        backgroundColor: '#000', // Black background to force hardware clip for Android surfaces
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
        top: -30, // Centers the 60px line height exactly at the top edge of the modal
        left: -10, 
        flexDirection: 'row',
        alignItems: 'flex-start', // Align to top
        zIndex: 100,
        elevation: 10,
        width: '100%', 
    },
    userNameAbsolute: {
        fontSize: 54,
        lineHeight: 60, // Spans from -30 to +30 (Perfectly half in, half out of the 0 top boundary)
        fontFamily: 'DancingScript-Bold',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 8,
    },
    timeTextAbsolute: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        lineHeight: 20, // Spans from -30 to -10 (Entirely outside and above the 0 top boundary)
        fontFamily: FONTS.bold,
        textTransform: 'lowercase',
        marginLeft: 4, // Tightly bind closely next to the sender name
        marginTop: 5, // Visual tweak
    },
    emojiButtonGlass: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.15)', // Glassy
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
