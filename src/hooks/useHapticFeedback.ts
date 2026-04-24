import * as Haptics from 'expo-haptics';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useCallback } from 'react';

// ─── Singleton manager (for use outside React components / in contexts) ───────

/**
 * HapticManager is a module-level singleton that mirrors the user's haptics
 * preference. It is synced by PreferencesContext whenever the preference
 * changes, so any file that imports `hapticManager` will automatically
 * respect the user's setting without needing a hook.
 */
class HapticManager {
    private enabled: boolean = true;

    /** Called by PreferencesContext to keep the singleton in sync. */
    setEnabled(val: boolean) {
        this.enabled = val;
    }

    impact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
        if (this.enabled) Haptics.impactAsync(style).catch(() => {});
    }

    notification(type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) {
        if (this.enabled) Haptics.notificationAsync(type).catch(() => {});
    }

    selection() {
        if (this.enabled) Haptics.selectionAsync().catch(() => {});
    }
}

export const hapticManager = new HapticManager();

// ─── React hook (for use inside React components) ────────────────────────────

/**
 * useHapticFeedback: Hook to trigger haptics only if enabled in preferences.
 * Use this inside React components; use `hapticManager` for contexts/hooks.
 */
export function useHapticFeedback() {
    const { hapticsEnabled } = usePreferences();

    const triggerHaptic = useCallback((style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
        if (hapticsEnabled) {
            Haptics.impactAsync(style).catch(() => {});
        }
    }, [hapticsEnabled]);

    const triggerNotificationHaptic = useCallback((type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
        if (hapticsEnabled) {
            Haptics.notificationAsync(type).catch(() => {});
        }
    }, [hapticsEnabled]);

    const triggerSelectionHaptic = useCallback(() => {
        if (hapticsEnabled) {
            Haptics.selectionAsync().catch(() => {});
        }
    }, [hapticsEnabled]);

    return {
        triggerHaptic,
        triggerNotificationHaptic,
        triggerSelectionHaptic,
        hapticsEnabled,
    };
}
