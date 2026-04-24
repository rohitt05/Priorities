import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

const PUSH_PREF_KEY = 'pref_push_notifications_enabled';

// ─── Notification handler — respects user preference ─────────────────────────
Notifications.setNotificationHandler({
    handleNotification: async () => {
        try {
            const pref = await AsyncStorage.getItem(PUSH_PREF_KEY);
            // Default to true if no preference saved yet
            const isEnabled = pref === null || pref === 'true';
            return {
                shouldShowAlert: isEnabled,
                shouldPlaySound: isEnabled,
                shouldSetBadge: false,
                shouldShowBanner: isEnabled,
                shouldShowList: isEnabled,
            };
        } catch {
            // If AsyncStorage fails, default to showing notifications
            return {
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
            };
        }
    },
});

// ─── Register ─────────────────────────────────────────────────────────────────
export async function registerForPushNotificationsAsync(userId: string) {
    console.log('[PushService] Starting push notification registration for user:', userId);

    if (Platform.OS === 'android') {
        console.log('[PushService] Setting Android Notification Channel');
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        console.log('[PushService] Is physical device. Checking permissions...');
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            console.log('[PushService] Permissions not granted yet. Requesting...');
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        console.log('[PushService] Final permission status:', finalStatus);
        if (finalStatus !== 'granted') {
            console.log('[PushService] Permissions DENIED. Cannot get push token.');
            return;
        }

        try {
            const projectId =
                Constants?.expoConfig?.extra?.eas?.projectId ??
                Constants?.easConfig?.projectId;

            console.log('[PushService] Using Expo Project ID:', projectId);
            if (!projectId) {
                console.warn('[PushService] Project ID not found for push notifications');
                return;
            }

            console.log('[PushService] Fetching Expo Push Token from server...');
            const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            console.log('[PushService] Successfully got push token:', tokenData.data);

            console.log('[PushService] Saving push token to Supabase...');
            const { error } = await supabase
                .from('profiles')
                .update({ expo_push_token: tokenData.data })
                .eq('id', userId);

            if (error) {
                console.error('[PushService] Error saving push token to Supabase:', error);
            } else {
                console.log('[PushService] Supabase token update successful!');
            }
        } catch (error) {
            console.error('[PushService] CRITICAL Error getting push token:', error);
        }
    } else {
        console.log('[PushService] Running on simulator/emulator. Push notifications require a physical device.');
    }
}

// ─── Unregister — clears token from Supabase when user disables push ──────────
export async function unregisterPushNotifications(userId: string) {
    console.log('[PushService] Clearing push token for user:', userId);
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ expo_push_token: null })
            .eq('id', userId);

        if (error) {
            console.error('[PushService] Error clearing push token:', error);
        } else {
            console.log('[PushService] Push token cleared successfully.');
        }
    } catch (error) {
        console.error('[PushService] CRITICAL Error clearing push token:', error);
    }
}
