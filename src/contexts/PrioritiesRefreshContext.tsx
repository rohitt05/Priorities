import React, { createContext, useContext, useState, useCallback } from 'react';

interface PrioritiesRefreshContextType {
    refreshKey: number;
    triggerRefresh: () => void;
}

const PrioritiesRefreshContext = createContext<PrioritiesRefreshContextType>({
    refreshKey: 0,
    triggerRefresh: () => { },
});

export const PrioritiesRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [refreshKey, setRefreshKey] = useState(0);
    const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);
    return (
        <PrioritiesRefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
            {children}
        </PrioritiesRefreshContext.Provider>
    );
};

export const usePrioritiesRefresh = () => useContext(PrioritiesRefreshContext);