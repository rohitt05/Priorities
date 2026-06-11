// src/contexts/PrioritiesRefreshContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { appRefreshOrchestrator } from '@/services/AppRefreshOrchestrator';

interface PrioritiesRefreshContextType {
    refreshKey: number;
    triggerRefresh: () => void;
}

const PrioritiesRefreshContext = createContext<PrioritiesRefreshContextType>({
    refreshKey: 0,
    triggerRefresh: () => { },
});

export const PrioritiesRefreshProvider: React.FC<{
    children: React.ReactNode;
    /** Pass the authenticated user's UUID so the orchestrator can start. */
    userId?: string | null;
}> = ({ children, userId }) => {
    const [refreshKey, setRefreshKey] = useState(0);
    const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

    // ── Start the orchestrator once we have a user ID ─────────────────
    useEffect(() => {
        if (!userId) return;

        appRefreshOrchestrator.start(userId);

        // Auto-bump refreshKey whenever priorities or accepted requests change.
        // This propagates to every component that reads `refreshKey` (home
        // screen, YourPriorities, profile tabs, etc.) without them needing
        // their own separate Supabase channel subscriptions.
        const unsubPri = appRefreshOrchestrator.on('priorities', triggerRefresh);

        return () => {
            unsubPri();
        };
    }, [userId, triggerRefresh]);

    // ── Stop the orchestrator when the provider unmounts (sign-out) ───
    useEffect(() => {
        return () => {
            appRefreshOrchestrator.stop();
        };
    }, []);

    return (
        <PrioritiesRefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
            {children}
        </PrioritiesRefreshContext.Provider>
    );
};

export const usePrioritiesRefresh = () => useContext(PrioritiesRefreshContext);