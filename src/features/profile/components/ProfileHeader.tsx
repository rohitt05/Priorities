// src/features/profile/components/ProfileHeader.tsx

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { COLORS } from '@/theme/theme';
import { User } from '@/types/userTypes';


interface ProfileHeaderProps {
    user: User;
    isOwner?: boolean;
    headerAnimatedStyle: any;
    imageScaleStyle: any;
}


export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
    user,
    isOwner = false,
    headerAnimatedStyle,
    imageScaleStyle,
}) => {
    const router = useRouter();

    return (
        <Reanimated.View style={[styles.imageHeader, headerAnimatedStyle]}>
            <Reanimated.Image
                source={{ uri: user.profilePicture }}
                style={[styles.profileImage, imageScaleStyle]}
                resizeMode="cover"
            />

            {/* Top gradient — dark → transparent behind the icon bar */}
            <LinearGradient
                colors={['rgba(0,0,0,0.65)', 'transparent']}
                locations={[0, 1]}
                style={styles.gradientTop}
                pointerEvents="none"
            />


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

    /*
     * Top gradient — rgba(0,0,0,0.65) at top edge fading to transparent.
     * Covers 30% of header height for a deeper shadow behind the icon bar.
     * zIndex 2 keeps it below the SafeAreaView (zIndex 10) so icons stay tappable.
     */
    gradientTop: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: '30%',
        zIndex: 2,
    },

    headerSafeOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 10,
    },
    iconButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },

    /*
     * Name centered absolutely between icons.
     * left/right 60 = icon width (40) + horizontal padding (20).
     */
    nameCenterSlot: {
        position: 'absolute',
        left: 60,
        right: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    name: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.surfaceLight,
        textShadowColor: 'rgba(0, 0, 0, 0.4)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
        letterSpacing: -0.2,
    },
});
