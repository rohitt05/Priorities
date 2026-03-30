import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

import { VoiceNoteRecordingProvider } from '@/contexts/VoiceNoteRecordingContext';
import { PrioritiesRefreshProvider } from '@/contexts/PrioritiesRefreshContext';
import { BackgroundProvider } from '@/contexts/BackgroundContext';

SplashScreen.preventAutoHideAsync();

export default function Layout() {
    const [session, setSession] = useState<Session | null>(null);
    const [sessionLoaded, setSessionLoaded] = useState(false);
    const segments = useSegments();

    const [loaded, error] = useFonts({
        'DancingScript-Regular': require('../assets/fonts/DancingScript-Regular.ttf'),
        'DancingScript-Medium': require('../assets/fonts/DancingScript-Medium.ttf'),
        'DancingScript-SemiBold': require('../assets/fonts/DancingScript-SemiBold.ttf'),
        'DancingScript-Bold': require('../assets/fonts/DancingScript-Bold.ttf'),
    });

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setSessionLoaded(true);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if ((loaded || error) && sessionLoaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded, error, sessionLoaded]);

    useEffect(() => {
        if (!sessionLoaded) return;

        const inAuthGroup = segments[0] === 'auth';

        if (!session && !inAuthGroup) {
            router.replace('/auth/signin');
        } else if (session && inAuthGroup) {
            router.replace('/(tabs)');
        }
    }, [session, sessionLoaded, segments]);

    if (!loaded && !error) {
        return <View style={{ flex: 1, backgroundColor: 'white' }} />;
    }

    if (!sessionLoaded) {
        return <View style={{ flex: 1, backgroundColor: 'white' }} />;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <BackgroundProvider>
                <PrioritiesRefreshProvider>
                    <VoiceNoteRecordingProvider>
                        <Stack screenOptions={{ headerShown: false }} />
                    </VoiceNoteRecordingProvider>
                </PrioritiesRefreshProvider>
            </BackgroundProvider>
        </GestureHandlerRootView>
    );
}
