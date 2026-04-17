// src/features/profile/components/ProfileHeader.tsx

import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import Reanimated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { User } from '@/types/domain';
import { sendPriorityRequest } from '@/services/priorityService';
import { useAuthUser } from '@/features/profile/hooks/useAuthUser';
import { getAvatarSource } from '@/utils/getMediaSource';

// ✅ Type lives here — imported by profile.tsx, no circular deps
export type HeaderAccessState = 'loading' | 'allowed' | 'pending' | 'locked';

interface ProfileHeaderProps {
    user: User;
    isOwner?: boolean;
    headerAnimatedStyle: any;
    imageScaleStyle: any;
    initialAccessState?: HeaderAccessState;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
    user,
    isOwner = false,
    headerAnimatedStyle,
    imageScaleStyle,
    initialAccessState,
}) => {
    const authId = useAuthUser();

    const [accessState, setAccessState] = useState<HeaderAccessState>(
        initialAccessState ?? 'loading'
    );
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (initialAccessState) {
            setAccessState(initialAccessState);
        }
    }, [initialAccessState]);

    const handleSendRequest = async () => {
        if (!authId || !user?.id || isSending) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsSending(true);
        try {
            await sendPriorityRequest(authId, user.id);
            setAccessState('pending');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e: any) {
            if (e?.code === '23505') {
                setAccessState('pending');
            }
        } finally {
            setIsSending(false);
        }
    };

    const isLocked = accessState === 'locked' || accessState === 'pending';

    const rawAvatarSource = getAvatarSource(user.profilePicture);
    const resolvedAvatarSource =
        typeof rawAvatarSource === 'string' ? { uri: rawAvatarSource } : rawAvatarSource;

    return (
        <Reanimated.View style={[styles.imageHeader, headerAnimatedStyle]}>
            <Reanimated.Image
                source={resolvedAvatarSource}
                style={[styles.profileImage, imageScaleStyle]}
                resizeMode="cover"
            />

            <LinearGradient
                colors={['rgba(0,0,0,0.65)', 'transparent']}
                locations={[0, 1]}
                style={styles.gradientTop}
                pointerEvents="none"
            />

            {isLocked && (
                <>
                    <BlurView
                        intensity={55}
                        tint="default"
                        style={StyleSheet.absoluteFill}
                        experimentalBlurMethod="dimezisBlurView"
                    />

                    <View style={styles.blurDimLayer} pointerEvents="none" />

                    <View style={styles.lockOverlay} pointerEvents="box-none">
                        <TouchableOpacity
                            style={styles.lockCta}
                            activeOpacity={0.75}
                            onPress={accessState === 'locked' ? handleSendRequest : undefined}
                            disabled={accessState === 'pending' || isSending}
                        >
                            {isSending ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : accessState === 'pending' ? (
                                <Ionicons
                                    name="checkmark-circle-outline"
                                    size={38}
                                    color="white"
                                    style={styles.ctaIcon}
                                />
                            ) : (
                                <Ionicons
                                    name="add-circle-outline"
                                    size={38}
                                    color="white"
                                    style={styles.ctaIcon}
                                />
                            )}

                            <Text style={styles.lockLabel}>
                                {accessState === 'pending'
                                    ? 'Request sent'
                                    : 'Add them to see more'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </Reanimated.View>
    );
};

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
    profileImage: {
        width: '100%',
        height: '100%',
    },
    gradientTop: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
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
    lockCta: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
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