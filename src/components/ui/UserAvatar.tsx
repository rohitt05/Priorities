import React from 'react';
import { View, StyleSheet, ImageStyle, ActivityIndicator } from 'react-native';
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
    const isDefault = uri?.startsWith('default:');
    
    if (isDefault) {
        const index = parseInt(uri!.split(':')[1], 10);
        const svgXml = FACE_SVGS[index] || FACE_SVGS[0];
        
        const Container = isReanimated ? Reanimated.View : View;
        
        return (
            <Container style={[style, animatedStyle, { backgroundColor: '#F0EFE9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }]}>
                <SvgXml xml={svgXml} width="100%" height="100%" />
            </Container>
        );
    }

    const ImageComponent = isReanimated ? AnimatedExpoImage : ExpoImage;
    const source = getAvatarSource(uri);

    if (!uri && !isDefault) {
        const Container = isReanimated ? Reanimated.View : View;
        return (
            <Container style={[style, animatedStyle, { backgroundColor: '#F0EFE9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }]}>
                <SvgXml xml={FACE_SVGS[0]} width="100%" height="100%" />
            </Container>
        );
    }

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
