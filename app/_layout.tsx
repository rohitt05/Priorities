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
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import { VoiceNoteRecordingProvider } from '@/contexts/VoiceNoteRecordingContext';
import { PrioritiesRefreshProvider } from '@/contexts/PrioritiesRefreshContext';
import { BackgroundProvider } from '@/contexts/BackgroundContext';
import { PreferencesProvider } from '@/contexts/PreferencesContext';
import { useIncomingCall } from '@/features/calls/useIncomingCall';
import { useBuzzListener } from '@/features/buzz/useBuzzListener';
import { BuzzToast } from '@/features/buzz/BuzzToast';
import { registerForPushNotificationsAsync, unregisterPushNotifications } from '@/services/pushNotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

SplashScreen.preventAutoHideAsync();

// ── Notification route map ─────────────────────────────────────────────
const handleNotificationRoute = (data: Record<string, any> | undefined) => {
    if (!data?.route) return;
    try {
        router.push(data.route as any);
    } catch (e) {
        console.warn('[Notifications] Failed to navigate to route:', data.route, e);
    }
};

export default function Layout() {
    const [session, setSession] = useState<Session | null>(null);
    const [sessionLoaded, setSessionLoaded] = useState(false);
    const segments = useSegments();

    // ── Global real-time listeners — fire on ANY screen ──────────────────────
    useIncomingCall(session?.user?.id);
    // buzzState carries { isBuzzing, buzzerName, buzzerAvatar, senderId }
    // or null when no buzz is active — fed directly into <BuzzToast>
    const buzzState = useBuzzListener(session?.user?.id);

    const notificationListener = useRef<Notifications.EventSubscription | null>(null);
    const responseListener = useRef<Notifications.EventSubscription | null>(null);

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

    // ── Notification tap listeners ───────────────────────────────────────
    useEffect(() => {
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data as Record<string, any>;
            handleNotificationRoute(data);
        });

        Notifications.getLastNotificationResponseAsync().then(response => {
            if (response) {
                const data = response.notification.request.content.data as Record<string, any>;
                setTimeout(() => handleNotificationRoute(data), 500);
            }
        });

        return () => {
            responseListener.current?.remove();
        };
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
        <ErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <PreferencesProvider>
                    <BackgroundProvider>
                        <PrioritiesRefreshProvider>
                            <VoiceNoteRecordingProvider>
                                <Stack screenOptions={{ headerShown: false }} />

                                {/*
                                  BuzzToast sits OUTSIDE the Stack so it floats
                                  above every screen — home, timelines, profile, all of them.
                                  pointerEvents="none" on the toast ensures it never
                                  blocks the user from interacting with the app below.
                                */}
                                <BuzzToast buzzState={buzzState} />

                            </VoiceNoteRecordingProvider>
                        </PrioritiesRefreshProvider>
                    </BackgroundProvider>
                </PreferencesProvider>
            </GestureHandlerRootView>
        </ErrorBoundary>
    );
}
