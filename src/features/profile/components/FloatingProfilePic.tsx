// src/features/profile/components/FloatingProfilePic.tsx

import React, { useState } from 'react';
import {
    View,
    StyleSheet,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { UserAvatar } from '@/components/ui/UserAvatar';
import Reanimated, {
    useAnimatedStyle,
    type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { HEADER_HEIGHT } from '@/features/profile/utils/profileConstants';
import ProfileMediaModal from './ProfileMediaModal';
import { MediaItem } from '@/types/mediaTypes';

interface FloatingProfilePicProps {
    profilePicture: string;
    pullY: SharedValue<number>;
    scrollY?: SharedValue<number>;
    capsuleFadeStyle?: any;
}

export default function FloatingProfilePic({
    profilePicture,
    pullY,
    capsuleFadeStyle,
}: FloatingProfilePicProps) {
    const { triggerHaptic } = useHapticFeedback();
    const [viewerVisible, setViewerVisible] = useState(false);

    // Just follow the pull gesture — no bob
    const floatingStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: pullY.value }],
    }));

    const handlePress = () => {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
        setViewerVisible(true);
    };

    const mediaItems: MediaItem[] = [
        {
            id: 'profile_pic',
            type: 'photo',
            uri: profilePicture,
            thumbUri: profilePicture,
            timestamp: undefined, // undefined prevents the date header from showing in modal
        }
    ];

    return (
        <>
            <Reanimated.View
                style={[styles.container, capsuleFadeStyle, floatingStyle]}
            >
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handlePress}
                >
                    <View style={styles.avatarRing}>
                        <UserAvatar
                            uri={profilePicture}
                            style={styles.profileImage}
                        />
                    </View>
                </TouchableOpacity>
            </Reanimated.View>

            <ProfileMediaModal
                visible={viewerVisible}
                initialIndex={0}
                mediaItems={mediaItems}
                onClose={() => setViewerVisible(false)}
                isOwner={false} // Disable deletion from this viewer
                hideOptions={true} // Hide the dots button
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: HEADER_HEIGHT - 54,
        left: 20,
        zIndex: 20,
    },
    avatarRing: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',

    },
    profileImage: {
        width: 88,
        height: 88,
        borderRadius: 44,
    },
});
