import * as Haptics from 'expo-haptics';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useCallback } from 'react';

/**
 * useHapticFeedback: Hook to trigger haptics only if enabled in preferences
 */
export function useHapticFeedback() {
    const { hapticsEnabled } = usePreferences();

    const triggerHaptic = useCallback((style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
        if (hapticsEnabled) {
            Haptics.impactAsync(style);
        }
    }, [hapticsEnabled]);

    const triggerNotificationHaptic = useCallback((type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
        if (hapticsEnabled) {
            Haptics.notificationAsync(type);
        }
    }, [hapticsEnabled]);

    const triggerSelectionHaptic = useCallback(() => {
        if (hapticsEnabled) {
            Haptics.selectionAsync();
        }
    }, [hapticsEnabled]);

    return {
        triggerHaptic,
        triggerNotificationHaptic,
        triggerSelectionHaptic,
        hapticsEnabled
    };
}

/**
 * hapticManager: Static object for non-hook usage, but it needs to be initialized with settings
 * Usually it's better to use the hook.
 */
