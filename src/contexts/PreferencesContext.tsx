import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hapticManager } from '@/hooks/useHapticFeedback';

interface PreferencesContextType {
    hapticsEnabled: boolean;
    setHapticsEnabled: (enabled: boolean) => Promise<void>;
    pushNotificationsEnabled: boolean;
    setPushNotificationsEnabled: (enabled: boolean) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

const HAPTICS_PREF_KEY = 'pref_haptics_enabled';
const PUSH_PREF_KEY = 'pref_push_notifications_enabled';

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hapticsEnabled, setHapticsEnabledState] = useState(true);
    const [pushNotificationsEnabled, setPushNotificationsEnabledState] = useState(true);

    useEffect(() => {
        const loadPrefs = async () => {
            try {
                const [savedHaptics, savedPush] = await Promise.all([
                    AsyncStorage.getItem(HAPTICS_PREF_KEY),
                    AsyncStorage.getItem(PUSH_PREF_KEY),
                ]);

                if (savedHaptics !== null) {
                    const val = savedHaptics === 'true';
                    setHapticsEnabledState(val);
                    hapticManager.setEnabled(val); // sync singleton on boot
                }

                if (savedPush !== null) {
                    setPushNotificationsEnabledState(savedPush === 'true');
                }
            } catch (error) {
                console.error('Error loading preferences:', error);
            }
        };
        loadPrefs();
    }, []);

    const setHapticsEnabled = async (enabled: boolean) => {
        try {
            setHapticsEnabledState(enabled);
            hapticManager.setEnabled(enabled); // keep singleton in sync
            await AsyncStorage.setItem(HAPTICS_PREF_KEY, enabled.toString());
        } catch (error) {
            console.error('Error saving haptics preference:', error);
        }
    };

    const setPushNotificationsEnabled = async (enabled: boolean) => {
        try {
            setPushNotificationsEnabledState(enabled);
            await AsyncStorage.setItem(PUSH_PREF_KEY, enabled.toString());
        } catch (error) {
            console.error('Error saving push notifications preference:', error);
        }
    };

    return (
        <PreferencesContext.Provider
            value={{
                hapticsEnabled,
                setHapticsEnabled,
                pushNotificationsEnabled,
                setPushNotificationsEnabled,
            }}
        >
            {children}
        </PreferencesContext.Provider>
    );
};

export const usePreferences = () => {
    const context = useContext(PreferencesContext);
    if (context === undefined) {
        throw new Error('usePreferences must be used within a PreferencesProvider');
    }
    return context;
};
