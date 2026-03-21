import React, { useEffect, useState, useMemo } from 'react';
import {
    StyleSheet,
    View,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { COLORS } from '@/theme/theme';

let getColors: any = null;
try {
    const ImageColorsModule = require('react-native-image-colors');
    getColors = ImageColorsModule.getColors;
} catch (error) {
    console.warn("react-native-image-colors native module not found. Falling back to default palette.");
}

interface MediaColorPickerProps {
    mediaUri: string;
    mediaType: 'image' | 'video';
    onColorSelect: (color: string) => void;
    selectedColor: string;
}

const MediaColorPicker: React.FC<MediaColorPickerProps> = ({
    mediaUri,
    mediaType,
    onColorSelect,
    selectedColor,
}) => {
    const [extractedColors, setExtractedColors] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Default vibrant fallback palette from theme
    const fallbackPalette = useMemo(() => [
        '#FFFFFF', // Pure White
        '#000000', // Pure Black
        COLORS.PALETTE.coralRed,
        COLORS.PALETTE.peachPuff,
        COLORS.PALETTE.warmSand,
        COLORS.PALETTE.softSage,
        COLORS.PALETTE.steelBlue,
        COLORS.PALETTE.cornflowerLilac,
        COLORS.PALETTE.padua,
    ], []);

    useEffect(() => {
        const extractColors = async () => {
            if (!mediaUri) return;
            setIsLoading(true);

            try {
                let targetUri = mediaUri;

                // Handle Video Thumbnails extraction
                if (mediaType === 'video') {
                    const { uri } = await VideoThumbnails.getThumbnailAsync(mediaUri, {
                        time: 1000,
                    });
                    targetUri = uri;
                }

                if (!getColors) {
                    console.warn("getColors is not available. Using fallback palette.");
                    setExtractedColors(fallbackPalette);
                    return;
                }

                // Extract Palette
                const result = await getColors(targetUri, {
                    fallback: '#ffffff',
                    cache: true,
                    key: targetUri,
                });

                const palette: string[] = ['#FFFFFF', '#000000']; // Always include white/black at start

                if (result.platform === 'android') {
                    if (result.dominant) palette.push(result.dominant);
                    if (result.average) palette.push(result.average);
                    if (result.vibrant) palette.push(result.vibrant);
                    if (result.muted) palette.push(result.muted);
                    if (result.darkMuted) palette.push(result.darkMuted);
                    if (result.lightMuted) palette.push(result.lightMuted);
                    if (result.darkVibrant) palette.push(result.darkVibrant);
                    if (result.lightVibrant) palette.push(result.lightVibrant);
                } else if (result.platform === 'ios') {
                    if (result.primary) palette.push(result.primary);
                    if (result.secondary) palette.push(result.secondary);
                    if (result.detail) palette.push(result.detail);
                    if (result.background) palette.push(result.background);
                }

                // De-duplicate and filter out very similar colors if necessary (simple version)
                const uniquePalette = Array.from(new Set(palette.map(c => c.toUpperCase())));
                
                // Add some default vibrants if the palette is too small
                if (uniquePalette.length < 5) {
                    uniquePalette.push(...fallbackPalette.slice(2, 5).map(c => c.toUpperCase()));
                }

                setExtractedColors(uniquePalette);
            } catch (error) {
                console.error('Error extracting colors:', error);
                setExtractedColors(fallbackPalette);
            } finally {
                setIsLoading(false);
            }
        };

        extractColors();
    }, [mediaUri, mediaType, fallbackPalette]);

    const displayColors = extractedColors.length > 0 ? extractedColors : fallbackPalette;

    return (
        <View style={styles.container}>
            {isLoading && (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="small" color="#FFF" />
                </View>
            )}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {displayColors.map((color, index) => {
                    const isSelected = selectedColor?.toLowerCase() === color?.toLowerCase();
                    const isWhite = color?.toLowerCase() === '#ffffff' || color?.toLowerCase() === '#fff';
                    return (
                        <TouchableOpacity
                            key={`${color}-${index}`}
                            onPress={() => onColorSelect(color)}
                            style={[
                                styles.colorDot,
                                { backgroundColor: color },
                                isWhite && styles.whiteDotBorder,
                                isSelected && styles.selectedDot,
                            ]}
                        />
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 60,
        width: '100%',
        justifyContent: 'center',
    },
    loaderContainer: {
        position: 'absolute',
        left: -20,
        zIndex: 1,
    },
    scrollContent: {
        paddingHorizontal: 10,
        alignItems: 'center',
        gap: 12,
    },
    colorDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    selectedDot: {
        borderColor: '#FFF',
        transform: [{ scale: 1.2 }],
        borderWidth: 3,
    },
    whiteDotBorder: {
        borderColor: 'rgba(0,0,0,0.1)',
    },
});

export default MediaColorPicker;
