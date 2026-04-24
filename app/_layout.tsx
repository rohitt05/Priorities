import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { registerGlobals } from '@livekit/react-native-webrtc';
registerGlobals();
import { TextEncoder, TextDecoder } from 'text-encoding';
if (typeof global.TextEncoder === 'undefined') {
    // @ts-ignore
    global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
    // @ts-ignore
    global.TextDecoder = TextDecoder;
}
if (typeof DOMException === 'undefined') {
    // @ts-ignore
    global.DOMException = class extends Error {
        constructor(message: string, name: string) {
            super(message);
            this.name = name;
        }
    };
}
if (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'undefined') {
    // @ts-ignore
    navigator.userAgent = 'ReactNative';
}
if (typeof global !== 'undefined' && (global as any).event === 'undefined') {
    // @ts-ignore
    (global as any).event = undefined;
}

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
import { PreferencesProvider } from '@/contexts/PreferencesContext';
import { useIncomingCall } from '@/features/calls/useIncomingCall';
import { registerForPushNotificationsAsync, unregisterPushNotifications } from '@/services/pushNotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

SplashScreen.preventAutoHideAsync();

export default function Layout() {
    const [session, setSession] = useState<Session | null>(null);
    const [sessionLoaded, setSessionLoaded] = useState(false);
    const segments = useSegments();
    useIncomingCall(session?.user?.id);

    const [loaded, error] = useFonts({
        'DancingScript-Regular': require('../assets/fonts/DancingScript-Regular.ttf'),
        'DancingScript-Medium': require('../assets/fonts/DancingScript-Medium.ttf'),
        'DancingScript-SemiBold': require('../assets/fonts/DancingScript-SemiBold.ttf'),
        'DancingScript-Bold': require('../assets/fonts/DancingScript-Bold.ttf'),
    });

    useEffect(() => {
        const initSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setSessionLoaded(true);
            if (session?.user?.id) {
                const pushPref = await AsyncStorage.getItem('pref_push_notifications_enabled');
                const isPushEnabled = pushPref === null || pushPref === 'true';
                if (isPushEnabled) {
                    registerForPushNotificationsAsync(session.user.id);
                } else {
                    unregisterPushNotifications(session.user.id);
                }
            }
        };
        initSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            if (session?.user?.id) {
                const pushPref = await AsyncStorage.getItem('pref_push_notifications_enabled');
                const isPushEnabled = pushPref === null || pushPref === 'true';
                if (isPushEnabled) {
                    registerForPushNotificationsAsync(session.user.id);
                } else {
                    unregisterPushNotifications(session.user.id);
                }
            }
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
            <PreferencesProvider>
                <BackgroundProvider>
                    <PrioritiesRefreshProvider>
                        <VoiceNoteRecordingProvider>
                            <Stack screenOptions={{ headerShown: false }} />
                        </VoiceNoteRecordingProvider>
                    </PrioritiesRefreshProvider>
                </BackgroundProvider>
            </PreferencesProvider>
        </GestureHandlerRootView>
    );
}
