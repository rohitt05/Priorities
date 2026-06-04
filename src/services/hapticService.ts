// src/services/hapticService.ts
import { Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

export const BUZZ_PATTERN = [0, 300, 40, 300, 40, 300, 40];

let hapticInterval: NodeJS.Timeout | null = null;

/** Start the looping buzz — keeps vibrating until stopBuzz() is called */
export function startBuzz(): void {
    // 1. Start standard repeat vibration
    Vibration.vibrate([0, 200, 30, 200, 30, 200, 30], true);

    // 2. Clean up any previous interval just in case
    if (hapticInterval) {
        clearInterval(hapticInterval);
    }

    // 3. Fire first heavy impact immediately
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    // 4. Repeatedly fire Heavy impact haptics to generate a very strong, premium tactile "buzz" sensation
    hapticInterval = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, 80);
}

export function stopBuzz(): void {
    Vibration.cancel();
    if (hapticInterval) {
        clearInterval(hapticInterval);
        hapticInterval = null;
    }
}
