import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Text, Dimensions, Animated as RNAnimated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    type SharedValue,
} from 'react-native-reanimated';

const { height } = Dimensions.get('window');
const HEADER_HEIGHT = height * 0.55;
const BUBBLE_BORDER_COLOR = 'rgba(0,0,0,0.08)';

const AnimatedPath = RNAnimated.createAnimatedComponent(Path);

interface PartnerUser {
    profilePicture: string;
}

interface FloatingPartnerIconProps {
    partnerUser: PartnerUser;
    relationshipLabel: string;
    animatedBgColor: any;
    pullY: SharedValue<number>;
}

export default function FloatingPartnerIcon({ partnerUser, relationshipLabel, animatedBgColor, pullY }: FloatingPartnerIconProps) {
    const translateY = useSharedValue(0);

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

    const floatingStyle = useAnimatedStyle(() => {
        return { transform: [{ translateY: translateY.value }] };
    });

    const partnerContainerStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: pullY.value }],
        };
    });

    return (
        <Reanimated.View style={[styles.floatingPartnerContainer, partnerContainerStyle]}>
            <View style={styles.partnerContent}>
                <Image source={{ uri: partnerUser.profilePicture }} style={styles.partnerImage} />
                <View style={styles.heartBadge}>
                    <Ionicons name="heart" size={16} color="#f30808ff" />
                </View>
                <Reanimated.View style={[styles.dialogueWrapper, floatingStyle]}>
                    <View style={styles.solidBacking}>
                        <RNAnimated.View style={[styles.dialogueBox, { backgroundColor: animatedBgColor }]}>
                            <Text style={styles.dialogueText} numberOfLines={1} ellipsizeMode="tail">
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
                        <RNAnimated.View style={[styles.tailHiderPatch, { backgroundColor: animatedBgColor }]} />
                    </View>
                </Reanimated.View>
            </View>
        </Reanimated.View>
    );
}

const styles = StyleSheet.create({
    floatingPartnerContainer: {
        position: 'absolute',
        top: HEADER_HEIGHT,
        right: 24,
        zIndex: 20,
        marginTop: -28,
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
});
