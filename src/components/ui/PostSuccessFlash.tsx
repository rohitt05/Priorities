// src/components/ui/PostSuccessFlash.tsx
// Fullscreen flash shown after a film or message is successfully posted.
// Matches the app's cream/charcoal aesthetic then auto-dismisses.
import React, { useEffect, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Animated,
    Dimensions,
    StatusBar,
} from 'react-native';
import { COLORS, FONTS } from '@/theme/theme';

const { width, height } = Dimensions.get('window');

interface PostSuccessFlashProps {
    /** Whether it's a Film of the Day post (true) or a message send (false) */
    isFilm: boolean;
    /** Name of recipient when sending a message */
    recipientName?: string;
    /** Called when the flash animation finishes — navigate home here */
    onDismiss: () => void;
}

const PostSuccessFlash: React.FC<PostSuccessFlashProps> = ({
    isFilm,
    recipientName,
    onDismiss,
}) => {
    const flashOpacity = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.92)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // 1. Flash the cream background in
        Animated.parallel([
            Animated.timing(flashOpacity, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 140,
                friction: 9,
                useNativeDriver: true,
            }),
        ]).start(() => {
            // 2. Fade in the label
            Animated.timing(textOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start(() => {
                // 3. Hold for 700ms then fade out everything
                setTimeout(() => {
                    Animated.timing(flashOpacity, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }).start(() => onDismiss());
                }, 700);
            });
        });
    }, []);

    const label = isFilm
        ? 'Film of the Day\nposted.'
        : `Sent to\n${recipientName ?? 'them'}.`;

    return (
        <Animated.View
            style={[
                styles.container,
                { opacity: flashOpacity },
            ]}
            pointerEvents="none"
        >
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            <Animated.View
                style={[
                    styles.inner,
                    { transform: [{ scale: scaleAnim }] },
                ]}
            >
                {/* Dot accent */}
                <View style={styles.dot} />

                <Animated.Text
                    style={[styles.label, { opacity: textOpacity }]}
                    numberOfLines={2}
                >
                    {label}
                </Animated.Text>

                {/* Subtle rule */}
                <View style={styles.rule} />

                <Animated.Text style={[styles.sub, { opacity: textOpacity }]}>
                    {isFilm ? '24 hrs · visible to your priorities' : 'disappears after they view it'}
                </Animated.Text>
            </Animated.View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        width,
        height,
        backgroundColor: COLORS.background,   // '#FDFCF0' cream
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
    },
    inner: {
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primary,       // '#433D35' charcoal
        marginBottom: 20,
    },
    label: {
        fontSize: 32,
        fontFamily: FONTS.bold,
        fontWeight: '800',
        color: COLORS.text,                    // '#2C2720' ink black
        textAlign: 'center',
        lineHeight: 38,
        letterSpacing: -0.5,
    },
    rule: {
        width: 32,
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 16,
    },
    sub: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,           // '#7C7267' faded ink
        textAlign: 'center',
        letterSpacing: 0.8,
        textTransform: 'lowercase',
    },
});

export default PostSuccessFlash;
