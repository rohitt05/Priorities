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
import * as Haptics from 'expo-haptics';

// Shared constant — always in sync with actual header height
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
    capsuleFadeStyle?: any; // Added for scroll fade
    onRemove?: () => void;
}

export default function FloatingPartnerIcon({
    partnerUser,
    relationshipLabel,
    animatedBgColor,
    pullY,
    scrollY,
    capsuleFadeStyle,
    onRemove,
}: FloatingPartnerIconProps) {
    const router = useRouter();
    const translateY = useSharedValue(0);
    const [showRemovalMenu, setShowRemovalMenu] = React.useState(false);

    // Continuous breathing float on the speech bubble
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

    // Speech bubble breathes up/down
    const floatingStyle = useAnimatedStyle(() => {
        return { transform: [{ translateY: translateY.value }] };
    });

    // Whole container moves with pull-to-edit gesture
    const partnerContainerStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: pullY.value }],
        };
    });

    const animatedProps = useAnimatedProps(() => {
        return {
            pointerEvents: (scrollY?.value ?? 0) > 40 ? 'none' : 'auto'
        } as any;
    });

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
            pathname: '/profile',
            params: { userId: partnerUser.uniqueUserId },
        });
    };

    const handleLongPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowRemovalMenu(true);
    };

    return (
        <>
            <Reanimated.View
                style={[styles.floatingPartnerContainer, partnerContainerStyle, capsuleFadeStyle]}
                animatedProps={animatedProps}
            >
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handlePress}
                    onLongPress={handleLongPress}
                    delayLongPress={400}
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
                                <Svg
                                    width={24}
                                    height={24}
                                    viewBox="0 0 24 24"
                                    style={styles.tailSvgBacking}
                                >
                                    <Path d="M0,0 Q12,0 20,20 Q4,12 0,0 Z" fill="white" />
                                </Svg>
                                <Svg
                                    width={24}
                                    height={24}
                                    viewBox="0 0 24 24"
                                    style={styles.tailSvgOverlay}
                                >
                                    {/* @ts-ignore */}
                                    <AnimatedPath
                                        d="M0,0 Q12,0 20,20 Q4,12 0,0 Z"
                                        fill={animatedBgColor}
                                        stroke={BUBBLE_BORDER_COLOR}
                                        strokeWidth={1}
                                    />
                                </Svg>
                                <RNAnimated.View
                                    style={[
                                        styles.tailHiderPatch,
                                        { backgroundColor: animatedBgColor },
                                    ]}
                                />
                            </View>
                        </Reanimated.View>
                    </View>
                </TouchableOpacity>
            </Reanimated.View>

            <Modal
                visible={showRemovalMenu}
                transparent={true}
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
                                        Haptics.notificationAsync(
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
        </>
    );
}

const styles = StyleSheet.create({
    floatingPartnerContainer: {
        position: 'absolute',
        /*
         * HEADER_HEIGHT is imported from profileConstants (height * 0.63).
         * marginTop: -36 pulls the avatar up to straddle the header's
         * bottom rounded edge — half the avatar (56/2 = 28) plus 8px
         * extra overlap so it sits naturally on the curve.
         */
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
        maxWidth: 140,
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
