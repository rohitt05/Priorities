import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { withLayoutContext } from 'expo-router';
import { View, Animated, StyleSheet, Dimensions, Text } from 'react-native';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Header } from '@/components';
import { COLORS, FONTS } from '@/theme/theme';
import { BackgroundProvider, useBackground } from '@/contexts/BackgroundContext';
import { LinearGradient } from 'expo-linear-gradient';

// Import Contexts
import { TabBarVisibilityProvider, useTabBarVisibility } from '@/contexts/TabBarVisibilityContext';
import { UserTimelineProvider } from '@/contexts/UserTimelineContext';
import { VoiceNoteRecordingProvider } from '@/contexts/VoiceNoteRecordingContext';

const { Navigator } = createMaterialTopTabNavigator();
export const MaterialTopTabs = withLayoutContext(Navigator);

const TransparentTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: 'transparent',
    },
};

const ZigzagScribble = ({ color, opacity, style }: any) => (
    <View style={[{ flexDirection: 'row', height: 14, alignItems: 'center' }, style]}>
        {[...Array(10)].map((_, i) => (
            <View
                key={i}
                style={{
                    width: 10,
                    height: 3,
                    backgroundColor: color,
                    opacity,
                    borderRadius: 2,
                    transform: [
                        { rotate: i % 2 === 0 ? '-30deg' : '30deg' },
                        { translateY: i % 2 === 0 ? 1 : -1 }
                    ],
                    marginLeft: i === 0 ? 0 : -5,
                }}
            />
        ))}
    </View>
);

const ScribbleIndicator = ({ state, position, layout }: any) => {
    const tabCount = state.routes.length || 2;
    const tabWidth = layout.width / tabCount;
    const scribbleWidth = 60;
    const centerOffset = (tabWidth - scribbleWidth) / 2;

    const translateX = position.interpolate({
        inputRange: [0, 1],
        outputRange: [0, tabWidth],
    });

    const scaleX = position.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 1.2, 1],
    });

    return (
        <Animated.View
            style={{
                position: 'absolute',
                bottom: -4,
                width: scribbleWidth,
                left: 0,
                transform: [
                    { translateX },
                    { translateX: centerOffset },
                    { scaleX }
                ],
                height: 16,
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            <ZigzagScribble color={COLORS.primary} opacity={1} />
            <ZigzagScribble color={COLORS.primary} opacity={0.5} style={{ position: 'absolute', top: 2, transform: [{ scale: 0.95 }, { rotate: '1deg' }] }} />
        </Animated.View>
    );
};

function TabLayoutContent() {
    const { bgColor, prevBgColor, colorAnim } = useBackground();
    const { width } = Dimensions.get('window');
    const { tabBarAnim } = useTabBarVisibility();

    const TAB_BAR_WIDTH = 200;
    const TAB_BAR_LEFT = (width - TAB_BAR_WIDTH) / 2;

    return (
        <View style={styles.container}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.background }]} />
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

            <ThemeProvider value={TransparentTheme}>
                <View style={styles.content}>
                    <Header />

                    <View style={{ flex: 1 }}>
                        <View style={styles.fadeMask} pointerEvents="none">
                            <LinearGradient
                                colors={['rgba(240, 239, 233, 0.95)', 'rgba(240, 239, 233, 0)']}
                                style={StyleSheet.absoluteFill}
                            />
                        </View>

                        <MaterialTopTabs
                            // @ts-ignore
                            sceneContainerStyle={{ backgroundColor: 'transparent' }}
                            screenOptions={{
                                tabBarStyle: {
                                    position: 'absolute',
                                    top: 0,
                                    left: TAB_BAR_LEFT,
                                    width: TAB_BAR_WIDTH,
                                    zIndex: 100,
                                    backgroundColor: 'transparent',
                                    elevation: 0,
                                    shadowOpacity: 0,
                                    borderBottomWidth: 0,
                                    height: 50,
                                    justifyContent: 'center',
                                    opacity: tabBarAnim as any,
                                    transform: [{
                                        translateY: tabBarAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [-20, 0]
                                        })
                                    }] as any
                                },
                                tabBarIndicatorContainerStyle: {
                                    backgroundColor: 'transparent',
                                    zIndex: 101,
                                    opacity: tabBarAnim as any,
                                },
                                tabBarIndicator: (props) => <ScribbleIndicator {...props} />,
                                tabBarItemStyle: {
                                    padding: 0,
                                    justifyContent: 'center',
                                    width: TAB_BAR_WIDTH / 2,
                                },
                                tabBarContentContainerStyle: {
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                },
                                tabBarActiveTintColor: '#000000',
                                tabBarInactiveTintColor: COLORS.textSecondary,
                                tabBarPressColor: 'transparent',
                                swipeEnabled: true,
                            }}
                        >
                            <MaterialTopTabs.Screen
                                name="index"
                                options={{
                                    title: 'home',
                                    tabBarLabel: ({ focused }: { focused: boolean }) => (
                                        <Text style={{
                                            color: focused ? '#1a1a1a' : '#888888',
                                            fontFamily: FONTS.bold,
                                            fontSize: 16,
                                            fontWeight: focused ? '700' : '400',
                                            textTransform: 'lowercase',
                                        }}>
                                            home
                                        </Text>
                                    )
                                }}
                            />
                            <MaterialTopTabs.Screen
                                name="timelines"
                                options={{
                                    title: 'timeline',
                                    tabBarLabel: ({ focused }: { focused: boolean }) => (
                                        <Text style={{
                                            color: focused ? '#1a1a1a' : '#888888',
                                            fontFamily: FONTS.bold,
                                            fontSize: 16,
                                            fontWeight: focused ? '700' : '400',
                                            textTransform: 'lowercase',
                                        }}>
                                            timeline
                                        </Text>
                                    )
                                }}
                            />
                        </MaterialTopTabs>
                    </View>
                </View>
            </ThemeProvider>
        </View>
    );
}

export default function TabLayout() {
    return (
        <BackgroundProvider>
            <TabBarVisibilityProvider>
                <UserTimelineProvider>
                    <VoiceNoteRecordingProvider>
                        <TabLayoutContent />
                    </VoiceNoteRecordingProvider>
                </UserTimelineProvider>
            </TabBarVisibilityProvider>
        </BackgroundProvider>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1 },
    fadeMask: { position: 'absolute', top: 0, left: 0, right: 0, height: 60, zIndex: 50 }
});
