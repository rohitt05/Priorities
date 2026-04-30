// src/services/hapticService.ts
import { Vibration } from 'react-native';

/**
 * The shared buzz pattern — identical on both sender and receiver
 * so both phones stay perfectly in sync.
 *
 * Format: [delay, vibrate, pause, vibrate, ...]
 *
 * Stronger pattern: short rapid bursts followed by a longer sustained
 * vibration — feels more like a deliberate "buzz" than a ring.
 */
export const BUZZ_PATTERN = [0, 100, 50, 100, 50, 100, 50, 600, 100, 600];

/** Start the looping buzz — keeps vibrating until stopBuzz() is called */
export function startBuzz(): void {
    Vibration.vibrate(BUZZ_PATTERN, true); // true = repeat
}

/** Stop the buzz immediately */
export function stopBuzz(): void {
    Vibration.cancel();
}
