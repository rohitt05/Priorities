import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PreferencesContextType {
    hapticsEnabled: boolean;
    setHapticsEnabled: (enabled: boolean) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

const HAPTICS_PREF_KEY = 'pref_haptics_enabled';

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hapticsEnabled, setHapticsEnabledState] = useState(true);

    useEffect(() => {
        const loadPrefs = async () => {
            try {
                const savedHaptics = await AsyncStorage.getItem(HAPTICS_PREF_KEY);
                if (savedHaptics !== null) {
                    setHapticsEnabledState(savedHaptics === 'true');
                }
            } catch (error) {
                console.error('Error loading haptics preference:', error);
            }
        };
        loadPrefs();
    }, []);

    const setHapticsEnabled = async (enabled: boolean) => {
        try {
            setHapticsEnabledState(enabled);
            await AsyncStorage.setItem(HAPTICS_PREF_KEY, enabled.toString());
        } catch (error) {
            console.error('Error saving haptics preference:', error);
        }
    };

    return (
        <PreferencesContext.Provider value={{ hapticsEnabled, setHapticsEnabled }}>
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
