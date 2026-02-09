import React, { useRef } from 'react';
import {
    View,
    Image,
    StyleSheet,
    Dimensions,
    Animated,
    PanResponder,
    PanResponderGestureState,
    Pressable
} from 'react-native';
import { BaseMediaProps } from '../../types/mediaTypes';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PhotoViewerProps extends BaseMediaProps {
    onDragDown?: () => void;
}

export default function PhotoViewer({ mediaItem, onDragDown }: PhotoViewerProps) {
    const scale = useRef(new Animated.Value(1)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    const currentScale = useRef(1);

    scale.addListener(({ value }) => {
        currentScale.current = value;
    });

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState: PanResponderGestureState) => {
                const isZoomed = currentScale.current > 1;
                const isVerticalDrag = Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 10;
                if (isZoomed) return true;
                return isVerticalDrag;
            },
            onPanResponderGrant: () => {
                translateX.stopAnimation();
                translateY.stopAnimation();
            },
            onPanResponderMove: (_, gestureState: PanResponderGestureState) => {
                if (currentScale.current > 1) {
                    translateX.setValue(gestureState.dx);
                    translateY.setValue(gestureState.dy);
                } else {
                    translateX.setValue(gestureState.dx * 0.4);
                    translateY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState: PanResponderGestureState) => {
                if (currentScale.current === 1 && gestureState.dy > 150 && onDragDown) {
                    onDragDown();
                } else {
                    Animated.parallel([
                        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
                        Animated.spring(translateY, { toValue: 0, useNativeDriver: true })
                    ]).start();
                }
            }
        })
    ).current;

    const lastTap = useRef<number | null>(null);
    const handleDoubleTap = () => {
        const now = Date.now();
        if (lastTap.current && now - lastTap.current < 300) {
            const newScale = currentScale.current === 1 ? 2 : 1;
            Animated.spring(scale, { toValue: newScale, useNativeDriver: true }).start();
        }
        lastTap.current = now;
    };

    if (!mediaItem?.uri) return null;

    return (
        <Animated.View
            {...panResponder.panHandlers}
            style={[
                styles.container,
                { transform: [{ translateX }, { translateY }, { scale }] }
            ]}
        >
            <Pressable
                onPress={handleDoubleTap}
                style={styles.innerContainer}
            >
                <Image
                    source={{ uri: mediaItem.uri }}
                    style={styles.image}
                    resizeMode="contain"
                />
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent'
    },
    innerContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    },
    image: {
        width: '100%',
        height: '100%'
    }
});
