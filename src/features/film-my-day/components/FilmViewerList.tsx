import React, { useMemo, useEffect } from 'react';
import { StyleSheet, View, Text, Image, Dimensions } from 'react-native';
import { FONTS } from '@/theme/theme';
import { User } from '@/types/domain';
import usersData from '@/data/users.json';
import Animated, { 
    useAnimatedStyle, 
    withSpring, 
    useSharedValue,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { ScrollView } from 'react-native-gesture-handler';



const { width: SW } = Dimensions.get('window');

interface FilmViewerListProps {
    viewerIds: string[];
    accent: string;
    visible: boolean;
}

const FilmViewerList: React.FC<FilmViewerListProps> = ({ viewerIds, accent, visible }) => {
    const anim = useSharedValue(0);

    useEffect(() => {
        anim.value = withSpring(visible ? 1 : 0, {
            damping: 30,
            stiffness: 140,
            mass: 1.2,
        });
    }, [visible]);

    const viewers = useMemo(() => {
        return viewerIds
            .map(id => (usersData as User[]).find(u => u.uniqueUserId === id))
            .filter((u): u is User => !!u);
    }, [viewerIds]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: interpolate(anim.value, [0, 1], [40, 0]) }
            ],
            opacity: anim.value,
            width: interpolate(anim.value, [0, 1], [0, SW - 85]),
        };
    });

    if (viewers.length === 0) return null;

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <View style={styles.listWrapper}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    <View style={styles.viewerRow}>
                        {viewers.map((user, idx) => (
                            <View key={user.uniqueUserId} style={[styles.viewerItem, { zIndex: viewers.length - idx }]}>
                                <View style={styles.avatarContainer}>
                                    <Image 
                                        source={{ uri: user.profilePicture }} 
                                        style={styles.avatar} 
                                    />
                                </View>
                                <Text style={styles.viewerName} numberOfLines={1}>
                                    {user.name.split(' ')[0]}
                                </Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 85,
        justifyContent: 'center',
        // Removed negative margin to avoid clipping issues
        marginRight: 0, 
    },
    listWrapper: {
        flex: 1,
        flexDirection: 'row',
    },
    scrollContent: {
        alignItems: 'center',
        paddingLeft: 0, // Removed left margin properly
        paddingRight: 15, 
    },
    viewerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        // Pull it down slightly to line up with the icon's visual center
        marginTop: 10, 
    },
    viewerItem: {
        alignItems: 'center',
        marginHorizontal: 8,
        width: 60,
    },
    avatarContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 26,
    },
    viewerName: {
        fontFamily: FONTS.bold,
        fontSize: 11,
        color: '#111',
        textAlign: 'center',
        marginTop: 6,
        letterSpacing: 0.3,
    },
});

export default FilmViewerList;
