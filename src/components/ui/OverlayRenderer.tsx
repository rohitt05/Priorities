// src/components/ui/OverlayRenderer.tsx
// Read-only renderer that mirrors StoryTextItem's exact transform chain.
// x/y are stored as normalized pan-offset fractions (0..1 of card dimensions).
// At render time we de-normalize back to px and apply the same anchor as StoryTextItem:
//   position:'absolute', top:'40%', alignSelf:'center'  → translateX/Y from that anchor.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONTS } from '@/theme/theme';

export interface OverlayTextItem {
    id: string;
    text: string;
    alignment: 'left' | 'center' | 'right';
    // scale stored raw (not normalized — it's device-independent already)
    scale: number;
    // rotation stored raw radians
    rotation: number;
    // x/y stored NORMALIZED: divide by cardWidth/cardHeight at save time, multiply back here
    x: number;
    y: number;
    hasBackground: boolean;
    color: string;
    isBold?: boolean;
}

export interface OverlayData {
    version: 1;
    cardWidth: number;
    cardHeight: number;
    items: OverlayTextItem[];
}

interface Props {
    overlayData: OverlayData | null | undefined;
    containerWidth: number;
    containerHeight: number;
}

const OverlayRenderer: React.FC<Props> = ({ overlayData, containerWidth, containerHeight }) => {
    if (!overlayData?.items?.length || !containerWidth || !containerHeight) return null;

    // Scale factors between capture card and current display card
    const scaleX = containerWidth / (overlayData.cardWidth || containerWidth);
    const scaleY = containerHeight / (overlayData.cardHeight || containerHeight);

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {overlayData.items.map((item) => {
                const isWhite =
                    item.color.toLowerCase() === '#ffffff' ||
                    item.color.toLowerCase() === '#fff';

                // De-normalize: go back to pixels for THIS card size
                const pxX = item.x * overlayData.cardWidth * scaleX;
                const pxY = item.y * overlayData.cardHeight * scaleY;

                return (
                    // Outer: same anchor as StoryTextItem — top:'40%', alignSelf:'center'
                    // Then translateX/translateY from that anchor
                    <View
                        key={item.id}
                        style={[
                            styles.outerWrapper,
                            {
                                transform: [
                                    { translateX: pxX },
                                    { translateY: pxY },
                                    { rotate: `${item.rotation}rad` },
                                ],
                            },
                        ]}
                    >
                        {/* Inner: scale only — mirrors StoryTextItem's innerAnimatedStyle */}
                        <View style={{ transform: [{ scale: item.scale }] }}>
                            <View
                                style={[
                                    styles.textContainer,
                                    item.hasBackground && {
                                        backgroundColor: isWhite
                                            ? 'rgba(255,255,255,0.98)'
                                            : item.color,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.overlayText,
                                        {
                                            textAlign: item.alignment,
                                            color: item.hasBackground
                                                ? isWhite ? '#000' : '#FFF'
                                                : item.color,
                                            textShadowRadius: item.hasBackground ? 0 : 8,
                                            fontFamily: item.isBold ? FONTS.bold : FONTS.regular,
                                            fontWeight: item.isBold ? 'bold' : 'normal',
                                        },
                                    ]}
                                >
                                    {item.text}
                                </Text>
                            </View>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    // Mirrors StoryTextItem textWrapper exactly:
    // position:'absolute', top:'40%', alignSelf:'center'
    // The padding:30 in StoryTextItem is a hit-slop trick — we don't need it for read-only
    outerWrapper: {
        position: 'absolute',
        top: '40%',
        alignSelf: 'center',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    overlayText: {
        color: '#FFF',
        fontSize: 32,
        fontFamily: FONTS.bold,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
});

export default OverlayRenderer;