import React, { useMemo, useEffect, useState } from 'react';
import {
    View,
    StyleSheet,
    StatusBar,
    Animated as RNAnimated,
    BackHandler,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView, GestureDetector } from 'react-native-gesture-handler';
import Reanimated from 'react-native-reanimated';

import { useLocalSearchParams } from 'expo-router';
import { useBackground, BackgroundProvider } from '@/contexts/BackgroundContext';
import usersData from '@/data/users.json';
import { User } from '@/types/userTypes';
import EditProfileScreen from '@/features/profile/components/EditProfileScreen';
import AddPartnerModal from '@/features/partners/components/AddPartnerModal';

import { CURRENT_USER_ID, PARTNER_KEY, BG_OPACITY } from '@/features/profile/utils/profileConstants';
import { hexToRgba } from '@/features/profile/utils/profileUtils';
import { useProfilePull } from '@/features/profile/hooks/useProfilePull';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { PartnerSection } from '@/features/profile/components/PartnerSection';
import YourPriorities from '@/features/profile/components/yourpriorities';

function ProfileScreenContent() {
    const { userId } = useLocalSearchParams<{ userId?: string }>();
    const effectiveUserId = userId || CURRENT_USER_ID;
    const isOwner = effectiveUserId === CURRENT_USER_ID;

    const { bgColor, prevBgColor, colorAnim, handleColorChange } = useBackground();
    const [isEditing, setIsEditing] = useState(false);
    const [isAddPartnerVisible, setIsAddPartnerVisible] = useState(false);
    const [savedPartnerUniqueUserId, setSavedPartnerUniqueUserId] = useState<string | null>(null);

    const triggerEditMode = () => {
        setIsEditing(true);
    };

    const {
        pullY,
        panGesture,
        headerAnimatedStyle,
        imageScaleStyle,
        partnerContainerStyle,
    } = useProfilePull(isOwner ? triggerEditMode : () => { });

    const handleCloseEdit = () => {
        setIsEditing(false);
    };

    useEffect(() => {
        const onBackPress = () => {
            if (isEditing) {
                handleCloseEdit();
                return true;
            }
            return false;
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isEditing]);

    const currentUser = useMemo(() => {
        const user = (usersData as User[]).find((u) => u.uniqueUserId === effectiveUserId);
        return user || (usersData[0] as User);
    }, [effectiveUserId]);

    const handleRemovePartner = async () => {
        try {
            await AsyncStorage.removeItem(PARTNER_KEY);
            setSavedPartnerUniqueUserId(null);
        } catch (e) {
            console.error('Failed to remove partner:', e);
        }
    };

    useEffect(() => {
        const loadPartner = async () => {
            try {
                const stored = await AsyncStorage.getItem(PARTNER_KEY);
                if (stored) setSavedPartnerUniqueUserId(stored);
            } catch { }
        };
        loadPartner();
    }, []);

    const partnerUser = useMemo(() => {
        if (!savedPartnerUniqueUserId) return null;
        return (usersData as User[]).find((u) => u.uniqueUserId === savedPartnerUniqueUserId) || null;
    }, [savedPartnerUniqueUserId]);

    const lightDominantColor = useMemo(
        () =>
            currentUser ? hexToRgba(currentUser.dominantColor, BG_OPACITY) : 'rgba(255,255,255,1)',
        [currentUser]
    );

    const solidDominantColor = useMemo(
        () =>
            currentUser ? hexToRgba(currentUser.dominantColor, 0.85) : 'rgba(255,255,255,0.85)',
        [currentUser]
    );

    useEffect(() => {
        if (lightDominantColor) handleColorChange(lightDominantColor);
    }, [lightDominantColor, handleColorChange]);

    const animatedBgColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [prevBgColor, bgColor],
    });

    const animatedCapsuleColor = colorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [
            prevBgColor.replace(/[\d.]+\)$/, '0.85)'),
            solidDominantColor,
        ],
    });

    if (!currentUser) return null;

    const relationshipLabel = (currentUser.relationship || '').trim() || 'My person';

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar barStyle="dark-content" />
            <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: animatedBgColor }]} />

            <GestureDetector gesture={panGesture}>
                <Reanimated.View style={styles.container}>
                    <ProfileHeader
                        user={currentUser}
                        isOwner={isOwner}
                        headerAnimatedStyle={headerAnimatedStyle}
                        imageScaleStyle={imageScaleStyle}
                    />

                    {/* New priorities stats section */}
                    <YourPriorities user={currentUser} />

                    {isOwner && (
                        <PartnerSection
                            partnerUser={partnerUser}
                            relationshipLabel={relationshipLabel}
                            animatedBgColor={animatedBgColor}
                            animatedCapsuleColor={animatedCapsuleColor}
                            pullY={pullY}
                            partnerContainerStyle={partnerContainerStyle}
                            onAddPartner={() => setIsAddPartnerVisible(true)}
                            onRemovePartner={handleRemovePartner}
                        />
                    )}

                    <View style={styles.contentBody} />
                </Reanimated.View>
            </GestureDetector>

            {isEditing && <EditProfileScreen user={currentUser} onBack={handleCloseEdit} />}

            <AddPartnerModal
                visible={isAddPartnerVisible}
                onClose={() => setIsAddPartnerVisible(false)}
                currentUserUniqueUserId={CURRENT_USER_ID}
                onSelectPartner={(userId) => {
                    setSavedPartnerUniqueUserId(userId);
                    AsyncStorage.setItem(PARTNER_KEY, userId).catch(() => { });
                }}
            />
        </GestureHandlerRootView>
    );
}

export default function ProfileScreen() {
    return (
        <BackgroundProvider>
            <ProfileScreenContent />
        </BackgroundProvider>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    contentBody: {
        flex: 1,
        paddingTop: 35,
        paddingHorizontal: 24,
    },
});
