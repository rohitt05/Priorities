// src/features/profile/components/ProfileHeader.tsx

import React, { useEffect, useState, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
} from 'react-native';
import Reanimated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { User } from '@/types/domain';
import { BlurView } from 'expo-blur';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { getFilmSource } from '@/utils/getMediaSource';
import { useProfileVideoUpload } from '@/contexts/ProfileVideoUploadContext';
import { FONTS } from '@/theme/theme';

export type HeaderAccessState = 'loading' | 'allowed' | 'pending' | 'locked';

interface ProfileHeaderProps {
    user: User;
    isOwner?: boolean;
    headerAnimatedStyle: any;
    imageScaleStyle: any;
}

// Cycling messages shown while video uploads in background
const UPLOAD_MESSAGES = [
    'Uploading your video…',
    "We're on it…",
    'Almost there…',
    'Hang tight…',
    'Just a moment…',
    'Making it perfect…',
    'Nearly done…',
];

function UploadingOverlay() {
    const [msgIdx, setMsgIdx] = useState(0);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const cycle = () => {
            // Fade out
            Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
                setMsgIdx((i) => (i + 1) % UPLOAD_MESSAGES.length);
                // Fade in
                Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
            });
        };
        const interval = setInterval(cycle, 2400);
        return () => clearInterval(interval);
    }, [fadeAnim]);

    return (
        <View style={uploadStyles.overlay}>
            {/* Subtle dark scrim */}
            <View style={uploadStyles.scrim} />

            <View style={uploadStyles.content}>
                {/* Spinner */}
                <View style={uploadStyles.spinnerRing}>
                    <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />
                </View>

                {/* Cycling message */}
                <Animated.Text style={[uploadStyles.message, { opacity: fadeAnim }]}>
                    {UPLOAD_MESSAGES[msgIdx]}
                </Animated.Text>

                <Text style={uploadStyles.subMessage}>Your video will appear when ready</Text>
            </View>
        </View>
    );
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
    user,
    isOwner = false,
    headerAnimatedStyle,
    imageScaleStyle,
}) => {
    const { uploadStatus } = useProfileVideoUpload();

    const isUploading = uploadStatus === 'uploading' || uploadStatus === 'compressing';

    const player = useVideoPlayer(
        (!isUploading && user.profileVideo) ? getFilmSource(user.profileVideo) : null,
        (p) => { p.loop = true; p.muted = true; p.play(); }
    );

    return (
        <Reanimated.View style={[styles.imageHeader, headerAnimatedStyle]}>
            {/* Main content: uploading overlay OR video OR avatar */}
            {isUploading ? (
                // Show current profile pic as blurred bg while uploading
                <Reanimated.View style={[styles.profileImageContainer, imageScaleStyle]}>
                    <UserAvatar uri={user.profilePicture} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
                    <UploadingOverlay />
                </Reanimated.View>
            ) : user.profileVideo ? (
                <Reanimated.View style={[styles.profileImageContainer, imageScaleStyle]}>
                    <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
                </Reanimated.View>
            ) : (
                <UserAvatar
                    uri={user.profilePicture}
                    style={styles.profileImage}
                    animatedStyle={imageScaleStyle}
                    isReanimated={true}
                    resizeMode="cover"
                />
            )}

            <LinearGradient
                colors={['rgba(0,0,0,0.65)', 'transparent']}
                locations={[0, 1]}
                style={styles.gradientTop}
                pointerEvents="none"
            />
        </Reanimated.View>
    );
};

const uploadStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    content: {
        alignItems: 'center',
        gap: 16,
    },
    spinnerRing: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    message: {
        fontSize: 17,
        fontFamily: FONTS.bold,
        color: '#fff',
        letterSpacing: 0.2,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    subMessage: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: 'rgba(255,255,255,0.45)',
        letterSpacing: 0.2,
    },
});

const styles = StyleSheet.create({
    imageHeader: {
        width: '100%',
        position: 'relative',
        zIndex: 1,
        borderBottomLeftRadius: 25,
        borderBottomRightRadius: 25,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    profileImage: { width: '100%', height: '100%' },
    profileImageContainer: { width: '100%', height: '100%' },
    gradientTop: {
        position: 'absolute',
        left: 0, right: 0, top: 0,
        height: '30%',
        zIndex: 2,
    },
    blurDimLayer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.10)',
        zIndex: 3,
    },
    lockOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockCta: { alignItems: 'center', justifyContent: 'center', gap: 8 },
    ctaIcon: {
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
    lockLabel: {
        color: 'white',
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.1,
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
});