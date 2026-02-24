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
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.5)']}
                locations={[0, 0.9]}
                style={styles.gradientOverlay}
            />
            <SafeAreaView style={styles.headerSafeOverlay}>
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.iconButton} hitSlop={12} onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={24} color="white" />
                    </TouchableOpacity>

                    {isOwner ? (
                        <Link href="/settings" asChild>
                            <TouchableOpacity style={styles.iconButton} hitSlop={12}>
                                <Ionicons name="settings-outline" size={24} color="white" />
                            </TouchableOpacity>
                        </Link>
                    ) : (
                        <View style={{ width: 40 }} />
                    )}
                </View>
            </SafeAreaView>

            <View style={styles.textOverlay}>
                <Text style={styles.name}>{user.name}</Text>
            </View>
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
    profileImage: { width: '100%', height: '100%' },
    gradientOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '25%',
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
        paddingHorizontal: 20,
        marginTop: 10,
    },
    iconButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textOverlay: {
        position: 'absolute',
        bottom: 15,
        left: 24,
        right: 100,
        zIndex: 3,
    },
    name: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.surfaceLight,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
        letterSpacing: -0.2,
    },
});
