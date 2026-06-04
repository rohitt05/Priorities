// src/features/buzz/BuzzToast.tsx
import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    Animated,
    Easing,
    Dimensions,
} from 'react-native';
import { BuzzState } from './useBuzzListener';
import { COLORS, FONTS, FONT_SIZES } from '@/theme/theme';
import { BlurView } from 'expo-blur';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface BuzzToastProps {
    buzzState: BuzzState | null;
}

export const BuzzToast: React.FC<BuzzToastProps> = ({ buzzState }) => {
    // Slide-in / slide-out from top
    const translateY = useRef(new Animated.Value(-120)).current;
    // Continuous pulse ring while buzzing
    const pulseScale = useRef(new Animated.Value(1)).current;
    const pulseOpacity = useRef(new Animated.Value(0.6)).current;
    const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

    // Entrance / exit animation
    useEffect(() => {
        if (buzzState?.isBuzzing) {
            // Slide in
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                damping: 18,
                stiffness: 200,
            }).start();

            // Start pulse loop on the avatar ring
            pulseScale.setValue(1);
            pulseOpacity.setValue(0.6);
            pulseLoop.current = Animated.loop(
                Animated.parallel([
                    Animated.sequence([
                        Animated.timing(pulseScale, {
                            toValue: 1.5,
                            duration: 500,
                            easing: Easing.out(Easing.ease),
                            useNativeDriver: true,
                        }),
                        Animated.timing(pulseScale, {
                            toValue: 1,
                            duration: 500,
                            easing: Easing.in(Easing.ease),
                            useNativeDriver: true,
                        }),
                    ]),
                    Animated.sequence([
                        Animated.timing(pulseOpacity, {
                            toValue: 0,
                            duration: 500,
                            useNativeDriver: true,
                        }),
                        Animated.timing(pulseOpacity, {
                            toValue: 0.6,
                            duration: 500,
                            useNativeDriver: true,
                        }),
                    ]),
                ])
            );
            pulseLoop.current.start();
        } else {
            // Slide out
            pulseLoop.current?.stop();
            Animated.spring(translateY, {
                toValue: -120,
                useNativeDriver: true,
                damping: 18,
                stiffness: 200,
            }).start();
        }

        return () => {
            pulseLoop.current?.stop();
        };
    }, [buzzState?.isBuzzing]);

    // Keep rendering even when null so exit animation can play
    return (
        <Animated.View
            style={[
                styles.wrapper,
                { transform: [{ translateY }] },
            ]}
            pointerEvents="none" // never blocks touches underneath
        >
            <BlurView intensity={60} tint="light" style={styles.pill}>
                {/* Pulsing ring behind avatar */}
                <View style={styles.avatarContainer}>
                    <Animated.View
                        style={[
                            styles.pulseRing,
                            {
                                transform: [{ scale: pulseScale }],
                                opacity: pulseOpacity,
                            },
                        ]}
                    />
                    {buzzState?.buzzerAvatar ? (
                        <Image
                            source={{ uri: buzzState.buzzerAvatar }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={[styles.avatar, styles.avatarFallback]}>
                            <Text style={styles.avatarFallbackText}>
                                {buzzState?.buzzerName?.[0]?.toUpperCase() ?? '?'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Text */}
                <View style={styles.textContainer}>
                    <Text style={styles.nameText} numberOfLines={1}>
                        {buzzState?.buzzerName ?? ''}
                    </Text>
                    <Text style={styles.subText}>
                        {buzzState?.isMissedBuzz ? 'buzzed you · missed' : 'is buzzing you · ~~~'}
                    </Text>
                </View>

                {/* Buzz wave icon */}
                <Text style={styles.waveEmoji}>📳</Text>
            </BlurView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        top: 56, // below status bar / notch
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 50,
        gap: 12,
        overflow: 'hidden',
        maxWidth: SCREEN_WIDTH * 0.82,
        // Subtle border
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        backgroundColor: 'rgba(255,255,255,0.55)',
    },
    avatarContainer: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseRing: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: COLORS.primary ?? '#4A90D9',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    avatarFallback: {
        backgroundColor: COLORS.primary ?? '#4A90D9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarFallbackText: {
        color: '#fff',
        fontFamily: FONTS.bold,
        fontSize: FONT_SIZES.sm,
    },
    textContainer: {
        flex: 1,
    },
    nameText: {
        fontFamily: FONTS.bold,
        fontSize: FONT_SIZES.sm,
        color: COLORS.text,
        lineHeight: 18,
    },
    subText: {
        fontFamily: FONTS.regular,
        fontSize: 11,
        color: COLORS.textSecondary,
        opacity: 0.75,
        marginTop: 1,
    },
    waveEmoji: {
        fontSize: 20,
    },
});
