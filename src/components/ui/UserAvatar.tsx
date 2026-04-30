import React, { useState } from 'react';
import { View, ImageStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import Reanimated from 'react-native-reanimated';
import { Image as ExpoImage } from 'expo-image';
import { FACE_SVGS } from '@/constants/Avatars';
import { getAvatarSource } from '@/utils/getMediaSource';

const AnimatedExpoImage = Reanimated.createAnimatedComponent(ExpoImage);

interface UserAvatarProps {
    uri?: string | null;
    style?: ImageStyle | any;
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
    isReanimated?: boolean;
    animatedStyle?: any;
    fallbackColor?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
    uri,
    style,
    resizeMode = 'cover',
    isReanimated = false,
    animatedStyle,
    fallbackColor = '#E5E5EA',
}) => {
    const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

    const handleLayout = (e: any) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) setContainerSize({ w: width, h: height });
    };

    const isDefault = uri?.startsWith('default:');

    // SVG fallback — rendered for null/undefined uri OR default:N avatar keys
    if (isDefault || !uri) {
        const index = isDefault ? parseInt(uri!.split(':')[1], 10) : 0;
        const svgXml = FACE_SVGS[index] || FACE_SVGS[0];
        const Container = isReanimated ? Reanimated.View : View;

        return (
            <Container
                style={[
                    style,
                    animatedStyle,
                    { backgroundColor: '#F0EFE9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
                ]}
                onLayout={handleLayout}
            >
                {/*
                 * SvgXml cannot resolve percentage widths when the parent itself uses
                 * percentage-based dimensions (e.g. width:'100%', height:'100%').
                 * We measure the container via onLayout and pass explicit pixel values
                 * so the SVG fills correctly in every context — fixed sizes AND
                 * percentage/animated parents alike.
                 */}
                <SvgXml
                    xml={svgXml}
                    width={containerSize ? containerSize.w : '100%'}
                    height={containerSize ? containerSize.h : '100%'}
                />
            </Container>
        );
    }

    // Real photo — just render the image
    const ImageComponent = isReanimated ? AnimatedExpoImage : ExpoImage;
    const source = getAvatarSource(uri);

    return (
        <ImageComponent
            source={source}
            style={[style, animatedStyle]}
            contentFit={resizeMode}
            cachePolicy="disk"
        />
    );
};

export default UserAvatar;
