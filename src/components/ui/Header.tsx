import { StyleSheet, Text, View, Pressable, Animated } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '@/theme/theme';
import { useBackground } from '@/contexts/BackgroundContext';

export default function Header() {
    const insets = useSafeAreaInsets();
    const { bgColor, prevBgColor, colorAnim } = useBackground();

    return (
        <BlurView intensity={80} tint="light" style={styles.wrapper}>
            {/* Dynamic Color Backdrop Layer */}
            <View style={StyleSheet.absoluteFill}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor, opacity: 0.25 }]} />
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            backgroundColor: prevBgColor,
                            opacity: colorAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.25, 0]
                            })
                        }
                    ]}
                />
            </View>

            <View style={[styles.container, { paddingTop: Math.max(insets.top, SPACING.xl) }]}>
                <Text style={styles.logo}>priorities</Text>
                <Link href="/profile" asChild>
                    <Pressable style={styles.profileButton}>
                        <Ionicons name="person-outline" size={28} color={COLORS.primary} />
                    </Pressable>
                </Link>
            </View>
        </BlurView>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        overflow: 'hidden',
    },
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.xl, // Increased height
    },
    logo: {
        fontSize: 32,
        fontFamily: FONTS.bold,
        fontWeight: '800', // Extra bold for "sober" impact
        color: COLORS.primary, // Charcoal Ink
        letterSpacing: -1,
    },
    profileButton: {
        padding: 4,
    }
});
