import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Reanimated, {
    useAnimatedStyle,
    interpolate,
    Extrapolation,
    SharedValue,
    useAnimatedProps,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Entypo } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/theme/theme';
import { User } from '@/types/domain';
import { HEADER_HEIGHT } from '@/features/profile/utils/profileConstants';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface ProfileStickyBarProps {
    user: User;
    isOwner?: boolean;
    isActuallyOwner?: boolean;
    scrollY: SharedValue<number>;
    animatedBarColor: any;
    onActionPress?: () => void;
}

const AnimatedText = Reanimated.createAnimatedComponent(Text);
const AnimatedIonicons = Reanimated.createAnimatedComponent(Ionicons);
const AnimatedEntypo = Reanimated.createAnimatedComponent(Entypo);

export const ProfileStickyBar: React.FC<ProfileStickyBarProps> = ({
    user,
    isOwner = false,
    isActuallyOwner = false,
    scrollY,
    animatedBarColor,
    onActionPress,
}) => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const headerHeight = insets.top + 60;
    const fadeEnd = HEADER_HEIGHT - headerHeight;
    const fadeStart = fadeEnd - 40;
    const colorStart = fadeEnd - 10;
    const colorEnd = fadeEnd + 18;

    const barBgStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [fadeStart, fadeEnd],
            [0, 1],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    const titleAnimatedStyle = useAnimatedStyle(() => {
        const progress = interpolate(
            scrollY.value,
            [colorStart, colorEnd],
            [0, 1],
            Extrapolation.CLAMP
        );
        return {
            color: progress < 0.92 ? COLORS.primary : '#FFFFFF',
            opacity: interpolate(progress, [0, 0.7, 1], [0.92, 0.97, 1], Extrapolation.CLAMP),
        } as any;
    });

    const leftIconAnimatedProps = useAnimatedProps(() => {
        const progress = interpolate(
            scrollY.value,
            [colorStart, colorEnd],
            [0, 1],
            Extrapolation.CLAMP
        );
        return {
            color: progress < 0.92 ? COLORS.primary : '#FFFFFF',
        } as any;
    });

    const settingsAnimatedProps = useAnimatedProps(() => {
        const progress = interpolate(
            scrollY.value,
            [colorStart, colorEnd],
            [0, 1],
            Extrapolation.CLAMP
        );
        return {
            color: progress < 0.92 ? COLORS.primary : '#FFFFFF',
        } as any;
    });

    const settingsAnimatedStyle = useAnimatedStyle(() => {
        const progress = interpolate(
            scrollY.value,
            [colorStart, colorEnd],
            [0, 1],
            Extrapolation.CLAMP
        );
        return {
            opacity: interpolate(progress, [0, 0.7, 1], [0.94, 0.98, 1], Extrapolation.CLAMP),
        };
    });

    const dotsAnimatedProps = useAnimatedProps(() => {
        const progress = interpolate(
            scrollY.value,
            [colorStart, colorEnd],
            [0, 1],
            Extrapolation.CLAMP
        );
        return {
            color: progress < 0.92 ? COLORS.primary : '#FFFFFF',
        } as any;
    });

    const renderRightIcon = () => {
        if (isOwner) {
            return (
                <Link href="/settings" asChild>
                    <TouchableOpacity
                        style={styles.iconButton}
                        hitSlop={12}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Open settings"
                    >
                        <Reanimated.View style={settingsAnimatedStyle}>
                            <AnimatedIonicons animatedProps={settingsAnimatedProps} name="settings-outline" size={24} />
                        </Reanimated.View>
                    </TouchableOpacity>
                </Link>
            );
        }

        if (isActuallyOwner) {
            return <View style={styles.iconButton} />;
        }

        return (
            <TouchableOpacity
                style={styles.iconButton}
                hitSlop={12}
                onPress={onActionPress}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Profile actions"
            >
                <AnimatedEntypo animatedProps={dotsAnimatedProps} name="dots-two-horizontal" size={24} />
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { height: headerHeight, paddingTop: insets.top }]} pointerEvents="box-none">
            <Reanimated.View style={[StyleSheet.absoluteFill, barBgStyle]} pointerEvents="none">
                <UserAvatar
                    uri={user.profilePicture}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
                <LinearGradient
                    colors={['rgba(0,0,0,0.4)', 'transparent']}
                    style={styles.bottomGradient}
                    pointerEvents="none"
                />
            </Reanimated.View>

            <View style={styles.headerRow} pointerEvents="box-none">
                <TouchableOpacity
                    style={styles.iconButton}
                    hitSlop={12}
                    onPress={() => router.back()}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <AnimatedIonicons animatedProps={leftIconAnimatedProps} name="close" size={24} />
                </TouchableOpacity>

                <View style={styles.nameCenterSlot} pointerEvents="none">
                    <AnimatedText
                        style={[styles.name, titleAnimatedStyle]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        accessible={true}
                        accessibilityRole="header"
                    >
                        {user.name}
                    </AnimatedText>
                </View>

                {renderRightIcon()}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    bottomGradient: {
        position: 'absolute',
        bottom: -10,
        left: 0,
        right: 0,
        height: 10,
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
        minWidth: 40,
        minHeight: 40,
    },
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
        color: COLORS.primary,
        textShadowColor: 'rgba(0, 0, 0, 0.4)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
        letterSpacing: -0.2,
    },
});