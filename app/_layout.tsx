import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// ✅ ADD THIS IMPORT
import { VoiceNoteRecordingProvider } from '@/contexts/VoiceNoteRecordingContext';

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
        <GestureHandlerRootView style={{ flex: 1 }}>
            {/* ✅ WRAP THE STACK — sits at root so blur covers the entire app */}
            <VoiceNoteRecordingProvider>
                <Stack
                    screenOptions={{
                        headerShown: false,
                    }}
                />
            </VoiceNoteRecordingProvider>
        </GestureHandlerRootView>
    );
}
