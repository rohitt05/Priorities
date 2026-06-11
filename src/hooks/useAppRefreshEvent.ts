// src/hooks/useAppRefreshEvent.ts
/**
 * React hook — subscribe to an AppRefreshOrchestrator event.
 *
 * Automatically unsubscribes on unmount.
 *
 * Example:
 *   useAppRefreshEvent('priority-requests', () => reload(), [reload]);
 */

import { useEffect } from 'react';
import { appRefreshOrchestrator, AppRefreshEvent } from '@/services/AppRefreshOrchestrator';

/**
 * @param event    The orchestrator event to listen to.
 * @param callback Called whenever the event fires.  Keep it stable
 *                 (e.g. wrap in useCallback) or pass its deps as `deps`.
 * @param deps     Extra deps passed to the inner useEffect so the subscription
 *                 is re-registered when they change.
 */
export function useAppRefreshEvent(
    event: AppRefreshEvent,
    callback: (payload?: any) => void,
    deps: readonly any[] = []
): void {
    useEffect(() => {
        return appRefreshOrchestrator.on(event, callback);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event, ...deps]);
}
