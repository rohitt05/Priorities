import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

const PUSH_PREF_KEY = 'pref_push_notifications_enabled';
export const BUZZ_CHANNEL_ID = 'buzz_v2';

// ─── Notification handler — respects user preference ─────────────────────────
Notifications.setNotificationHandler({
    handleNotification: async () => {
        try {
            const pref = await AsyncStorage.getItem(PUSH_PREF_KEY);
            const isEnabled = pref === null || pref === 'true';
            return {
                shouldPlaySound: isEnabled,
                shouldSetBadge: false,
                shouldShowBanner: isEnabled,
                shouldShowList: isEnabled,
            };
        } catch {
            return {
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
            };
        }
    },
});

export async function setupAndroidChannels() {
    if (Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
    });

    await Notifications.setNotificationChannelAsync(BUZZ_CHANNEL_ID, {
        name: 'Buzz Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 450, 120, 450, 120, 450],
        lightColor: '#FF0000',
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: false,
        sound: 'buzz.wav',
    });
}

// ─── Register ─────────────────────────────────────────────────────────────────
export async function registerForPushNotificationsAsync(userId: string) {
    // Android channels must be created before requesting permission or fetching tokens
    await setupAndroidChannels();

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            return;
        }

        try {
            const projectId =
                Constants?.expoConfig?.extra?.eas?.projectId ??
                Constants?.easConfig?.projectId;

            if (!projectId) {
                return;
            }

            const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

            await supabase
                .from('profiles')
                .update({ expo_push_token: tokenData.data })
                .eq('id', userId);
        } catch {
            // Fail silently
        }
    }
}

// ─── Unregister — clears token from Supabase when user disables push ──────────
export async function unregisterPushNotifications(userId: string) {
    try {
        await supabase
            .from('profiles')
            .update({ expo_push_token: null })
            .eq('id', userId);
    } catch {
        // Fail silently
    }
}
