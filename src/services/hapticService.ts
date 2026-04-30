// src/services/hapticService.ts
import { Vibration } from 'react-native';

/**
 * The shared buzz pattern — identical on both sender and receiver
 * so both phones stay perfectly in sync.
 * Format: [delay, vibrate, pause, vibrate, pause, vibrate, pause, vibrate]
 */
export const BUZZ_PATTERN = [0, 500, 200, 500, 200, 500, 200, 800];

/** Start the looping buzz — keeps vibrating until stopBuzz() is called */
export function startBuzz(): void {
    Vibration.vibrate(BUZZ_PATTERN, true); // true = repeat
}

/** Stop the buzz immediately on both sender and receiver */
export function stopBuzz(): void {
    Vibration.cancel();
}
