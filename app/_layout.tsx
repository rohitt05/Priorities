import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { View } from 'react-native';
// ✅ IMPORT THIS
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function Layout() {
    const [loaded, error] = useFonts({
        'DancingScript-Regular': require('../assets/fonts/DancingScript-Regular.ttf'),
        'DancingScript-Medium': require('../assets/fonts/DancingScript-Medium.ttf'),
        'DancingScript-SemiBold': require('../assets/fonts/DancingScript-SemiBold.ttf'),
        'DancingScript-Bold': require('../assets/fonts/DancingScript-Bold.ttf'),
    });

    useEffect(() => {
        if (loaded || error) {
            SplashScreen.hideAsync();
        }
    }, [loaded, error]);

    if (!loaded && !error) {
        return <View style={{ flex: 1, backgroundColor: 'white' }} />;
    }

    return (
        // ✅ WRAP EVERYTHING HERE with flex: 1
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack
                screenOptions={{
                    headerShown: false,
                }}
            />
        </GestureHandlerRootView>
    );
}
