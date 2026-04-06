import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { COLORS } from '@/theme/theme';

const { width, height } = Dimensions.get('window');

export default function AuthBackground({ children }: { children: React.ReactNode }) {
    const anim1 = useRef(new Animated.Value(0)).current;
    const anim2 = useRef(new Animated.Value(0)).current;
    const anim3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const createLoop = (anim: Animated.Value, duration: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, {
                        toValue: 1,
                        duration,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration,
                        useNativeDriver: true,
                    })
                ])
            );
        };

        createLoop(anim1, 15000).start();
        createLoop(anim2, 18000).start();
        createLoop(anim3, 22000).start();
    }, []);

    const t1X = anim1.interpolate({ inputRange: [0, 1], outputRange: [-50, 150] });
    const t1Y = anim1.interpolate({ inputRange: [0, 1], outputRange: [-50, 200] });

    const t2X = anim2.interpolate({ inputRange: [0, 1], outputRange: [width, width - 200] });
    const t2Y = anim2.interpolate({ inputRange: [0, 1], outputRange: [height / 2, height / 2 - 150] });

    const t3X = anim3.interpolate({ inputRange: [0, 1], outputRange: [width / 2 - 100, width / 2 + 100] });
    const t3Y = anim3.interpolate({ inputRange: [0, 1], outputRange: [height, height - 200] });

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#FDFCF0', '#F7F4E9', '#E9DFB4']} style={StyleSheet.absoluteFillObject} />
            
            {/* Animated Deco Bubbles */}
            <Animated.View style={[styles.bubble, styles.b1, { transform: [{ translateX: t1X }, { translateY: t1Y }] }]} />
            <Animated.View style={[styles.bubble, styles.b2, { transform: [{ translateX: t2X }, { translateY: t2Y }] }]} />
            <Animated.View style={[styles.bubble, styles.b3, { transform: [{ translateX: t3X }, { translateY: t3Y }] }]} />

            {/* Heavy blur to make the bubbles look like a soft abstract background */}
            <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFillObject} />

            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    bubble: {
        position: 'absolute',
        borderRadius: 200,
        opacity: 0.65,
    },
    b1: {
        width: 350,
        height: 350,
        backgroundColor: COLORS.PALETTE.peachPuff,
        top: -100,
        left: -100,
    },
    b2: {
        width: 400,
        height: 400,
        backgroundColor: COLORS.PALETTE.skySoft,
        right: -150,
        top: '20%',
    },
    b3: {
        width: 450,
        height: 450,
        backgroundColor: COLORS.PALETTE.lavenderBloom,
        bottom: -200,
        left: '-10%',
    }
});
