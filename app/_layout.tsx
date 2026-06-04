import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

if (typeof global.DOMException === 'undefined') {
    global.DOMException = class DOMException extends Error {
        constructor(message?: string, name?: string) {
            super(message);
            this.name = name ?? 'DOMException';
        }
    } as any;
}

// FIX #12: Removed redundant TextEncoder/TextDecoder/navigator.userAgent
// polyfills — covered by Hermes (RN 0.81) and react-native-url-polyfill/auto.
// FIX #1: registerGlobals() moved into useEffect below (no longer at module parse time).
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SubscriptionConfig } from '@/config/subscription';

// FIX #3 & #4: VoiceNoteRecordingProvider removed from root.
// It lives solely inside (tabs)/_layout.tsx where it is actually consumed.
import { BackgroundProvider } from '@/contexts/BackgroundContext';
import { PrioritiesRefreshProvider } from '@/contexts/PrioritiesRefreshContext';
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

// FIX #10: Push registration extracted out of the session critical path.
// Runs 2 seconds after session resolves — does not delay splash screen.
const registerPushIfEnabled = async (userId: string) => {
    try {
        const pushPref = await AsyncStorage.getItem('pref_push_notifications_enabled');
        const isPushEnabled = pushPref === null || pushPref === 'true';
        if (isPushEnabled) {
            registerForPushNotificationsAsync(userId);
        } else {
            unregisterPushNotifications(userId);
        }
    } catch (e) {
        console.warn('[Layout] Failed to check push preference:', e);
    }
};

export default function Layout() {
    const [session, setSession] = useState<Session | null>(null);
    const [sessionLoaded, setSessionLoaded] = useState(false);
    const segments = useSegments();

    // FIX #7: Both hooks gated behind sessionLoaded — they only receive a userId
    // after auth is confirmed, preventing premature subscription and re-subscription.
    useIncomingCall(sessionLoaded ? session?.user?.id : undefined);
    const buzzState = useBuzzListener(sessionLoaded ? session?.user?.id : undefined);

    const responseListener = useRef<Notifications.EventSubscription | null>(null);

    // FIX #1: WebRTC globals initialized lazily in a useEffect, not at module
    // parse time. This removes it from the synchronous JS bundle evaluation phase.
    useEffect(() => {
        const { registerGlobals } = require('@livekit/react-native-webrtc');
        registerGlobals();
        SubscriptionConfig.initializePurchases();
    }, []);

    useEffect(() => {
        const initSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            // FIX #10: setSessionLoaded immediately — splash can hide without
            // waiting for push registration (which now runs separately below).
            setSessionLoaded(true);

            if (session?.user?.id) {
                const userId = session.user.id;
                setTimeout(() => registerPushIfEnabled(userId), 2000);
            }
        };
        initSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user?.id) {
                const userId = session.user.id;
                setTimeout(() => registerPushIfEnabled(userId), 2000);
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

    // FIX #2: Splash screen now only gates on sessionLoaded.
    // Fonts are embedded in app.json (expo.fonts) — loaded natively before JS
    // starts, so they never need to block the splash screen.
    useEffect(() => {
        if (sessionLoaded) {
            SplashScreen.hideAsync();
        }
    }, [sessionLoaded]);

    useEffect(() => {
        if (!sessionLoaded) return;

        const inAuthGroup = segments[0] === 'auth';

        if (!session && !inAuthGroup) {
            router.replace('/auth/signin');
        } else if (session && inAuthGroup) {
            router.replace('/(tabs)');
        }
    }, [session, sessionLoaded, segments]);

    if (!sessionLoaded) {
        return <View style={{ flex: 1, backgroundColor: 'white' }} />;
    }

    // FIX #3 & #4: VoiceNoteRecordingProvider removed.
    // BuzzToast only needs PrioritiesRefreshProvider context (none) — it reads
    // buzzState passed directly as a prop, so no extra providers are needed here.
    return (
        <ErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <BackgroundProvider>
                    <PreferencesProvider>
                        <PrioritiesRefreshProvider>
                            <Stack screenOptions={{ headerShown: false }} />

                            {/*
                              BuzzToast sits OUTSIDE the Stack so it floats
                              above every screen — home, timelines, profile, all of them.
                              pointerEvents="none" on the toast ensures it never
                              blocks the user from interacting with the app below.
                            */}
                            <BuzzToast buzzState={buzzState} />

                        </PrioritiesRefreshProvider>
                    </PreferencesProvider>
                </BackgroundProvider>
            </GestureHandlerRootView>
        </ErrorBoundary>
    );
}
