// src/features/partners/components/FloatingPartnerIcon.tsx

import React, { useEffect } from 'react';
import {
    View,
    StyleSheet,
    Image,
    Text,
    Dimensions,
    Animated as RNAnimated,
    TouchableOpacity,
    Modal,
    TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedProps,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics'; // enums only
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

import { HEADER_HEIGHT } from '@/features/profile/utils/profileConstants';

const { width } = Dimensions.get('window');
const BUBBLE_BORDER_COLOR = 'rgba(0,0,0,0.08)';

const AnimatedPath = RNAnimated.createAnimatedComponent(Path);

interface PartnerUser {
    uniqueUserId: string;
    profilePicture: string;
}

interface FloatingPartnerIconProps {
    partnerUser: PartnerUser;
    relationshipLabel: string;
    animatedBgColor: any;
    pullY: SharedValue<number>;
    scrollY?: SharedValue<number>;
    capsuleFadeStyle?: any;
    // If true → owner viewing own profile → can tap to navigate + long press to remove
    // If false → someone else viewing this profile → partner icon is display-only
    isOwner: boolean;
    onRemove?: () => void;
}

export default function FloatingPartnerIcon({
    partnerUser,
    relationshipLabel,
    animatedBgColor,
    pullY,
    scrollY,
    capsuleFadeStyle,
    isOwner,
    onRemove,
}: FloatingPartnerIconProps) {
    const router = useRouter();
    const translateY = useSharedValue(0);
    const { triggerHaptic, triggerNotificationHaptic } = useHapticFeedback();
    const [showRemovalMenu, setShowRemovalMenu] = React.useState(false);

    useEffect(() => {
        translateY.value = withRepeat(
            withSequence(
                withTiming(-4, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
                withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) })
            ),
            -1,
            true
        );
    }, [translateY]);

    const floatingStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const partnerContainerStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: pullY.value + (scrollY ? scrollY.value : 0) }
        ],
    }));

    const animatedProps = useAnimatedProps(() => ({
        pointerEvents: (scrollY?.value ?? 0) > 40 ? 'none' : 'auto',
    } as any));

    const handlePress = () => {
        // Only navigate if this is the owner viewing their own profile
        if (!isOwner) return;
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
        router.push({
            pathname: '/profile',
            params: { userId: partnerUser.uniqueUserId },
        });
    };

    const handleLongPress = () => {
        // Only allow removal if this is the owner
        if (!isOwner) return;
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        setShowRemovalMenu(true);
    };

    return (
        <>
            <Reanimated.View
                style={[styles.floatingPartnerContainer, partnerContainerStyle, capsuleFadeStyle]}
                animatedProps={animatedProps}
            >
                <TouchableOpacity
                    activeOpacity={isOwner ? 0.9 : 1}
                    onPress={handlePress}
                    onLongPress={handleLongPress}
                    delayLongPress={400}
                    // Disable touch feedback entirely for non-owners
                    disabled={!isOwner}
                >
                    <View style={styles.partnerContent}>
                        <Image
                            source={{ uri: partnerUser.profilePicture }}
                            style={styles.partnerImage}
                        />
                        <View style={styles.heartBadge}>
                            <Ionicons name="heart" size={16} color="#f30808ff" />
                        </View>
                        <Reanimated.View style={[styles.dialogueWrapper, floatingStyle]}>
                            <View style={styles.solidBacking}>
                                <RNAnimated.View
                                    style={[styles.dialogueBox, { backgroundColor: animatedBgColor }]}
                                >
                                    <Text
                                        style={styles.dialogueText}
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                    >
                                        {relationshipLabel}
                                    </Text>
                                </RNAnimated.View>
                            </View>
                            <View style={styles.curvedTailContainer}>
                                <Svg width={24} height={24} viewBox="0 0 24 24" style={styles.tailSvgBacking}>
                                    <Path d="M0,0 Q12,0 20,20 Q4,12 0,0 Z" fill="white" />
                                </Svg>
                                <Svg width={24} height={24} viewBox="0 0 24 24" style={styles.tailSvgOverlay}>
                                    {/* @ts-ignore */}
                                    <AnimatedPath
                                        d="M0,0 Q12,0 20,20 Q4,12 0,0 Z"
                                        fill={animatedBgColor}
                                        stroke={BUBBLE_BORDER_COLOR}
                                        strokeWidth={1}
                                    />
                                </Svg>
                                <RNAnimated.View
                                    style={[styles.tailHiderPatch, { backgroundColor: animatedBgColor }]}
                                />
                            </View>
                        </Reanimated.View>
                    </View>
                </TouchableOpacity>
            </Reanimated.View>

            {/* Only render removal modal for owner */}
            {isOwner && (
                <Modal
                    visible={showRemovalMenu}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowRemovalMenu(false)}
                >
                    <TouchableWithoutFeedback onPress={() => setShowRemovalMenu(false)}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={styles.menuContainer}>
                                    <TouchableOpacity
                                        style={styles.menuItem}
                                        onPress={() => {
                                            setShowRemovalMenu(false);
                                            triggerNotificationHaptic(
                                                Haptics.NotificationFeedbackType.Success
                                            );
                                            onRemove?.();
                                        }}
                                    >
                                        <View style={styles.menuIconBox}>
                                            <MaterialCommunityIcons
                                                name="heart-broken"
                                                size={20}
                                                color="#FF6B6B"
                                            />
                                        </View>
                                        <Text style={styles.menuItemText}>Remove as Partner</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    floatingPartnerContainer: {
        position: 'absolute',
        top: HEADER_HEIGHT,
        right: 24,
        zIndex: 20,
        marginTop: -32,
    },
    partnerContent: {
        position: 'relative',
    },
    partnerImage: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    heartBadge: {
        position: 'absolute',
        bottom: -2,
        right: -5,
        width: 25,
        height: 25,
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ rotate: '15deg' }],
        zIndex: 25,
    },
    dialogueWrapper: {
        position: 'absolute',
        top: -65,
        right: 12,
        zIndex: 20,
        alignItems: 'flex-end',
    },
    solidBacking: {
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
    },
    dialogueBox: {
        minWidth: 100,
        maxWidth: 160,
        height: 38,
        paddingHorizontal: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: BUBBLE_BORDER_COLOR,
    },
    dialogueText: {
        fontFamily: 'DancingScript-Bold',
        fontSize: 17,
        color: '#2C2720',
        textAlign: 'center',
        includeFontPadding: false,
        marginBottom: 3,
    },
    curvedTailContainer: {
        position: 'absolute',
        bottom: -15,
        right: 18,
        width: 24,
        height: 24,
    },
    tailSvgBacking: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: -2,
    },
    tailSvgOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: -1,
    },
    tailHiderPatch: {
        position: 'absolute',
        top: -2,
        right: 0,
        width: 20,
        height: 6,
        zIndex: 5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        width: width * 0.75,
        maxWidth: 280,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#FFF5F5',
    },
    menuIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#FFE5E5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    menuItemText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FF4757',
    },
});