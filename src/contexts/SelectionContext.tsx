import React, { createContext, useContext, useRef, useCallback } from 'react';

type Listener = (isSelected: boolean) => void;

interface SelectionContextType {
    toggle: (id: string) => void;
    subscribe: (id: string, listener: Listener) => () => void;
    isSelected: (id: string) => boolean;
    selectAll: (allIds: string[]) => void;
    getSelectedIds: () => string[];
}

const SelectionContext = createContext<SelectionContextType | null>(null);

export const SelectionProvider = ({ children, onSelectionChange }: { children: React.ReactNode, onSelectionChange?: (ids: string[]) => void }) => {
    const selectedIds = useRef<Set<string>>(new Set());
    const listeners = useRef<Map<string, Set<Listener>>>(new Map());

    const notify = (id: string, state: boolean) => {
        const itemListeners = listeners.current.get(id);
        if (itemListeners) {
            itemListeners.forEach(listener => listener(state));
        }
    };

    const toggle = useCallback((id: string) => {
        const set = selectedIds.current;
        if (set.has(id)) {
            set.delete(id);
            notify(id, false);
        } else {
            set.add(id);
            notify(id, true);
        }
        if (onSelectionChange) onSelectionChange(Array.from(set));
    }, [onSelectionChange]);

    const selectAll = useCallback((allIds: string[]) => {
        const set = selectedIds.current;
        const allSelected = allIds.every(id => set.has(id));

        if (allSelected) {
            set.clear();
            allIds.forEach(id => notify(id, false));
        } else {
            allIds.forEach(id => {
                if (!set.has(id)) {
                    set.add(id);
                    notify(id, true);
                }
            });
        }
        if (onSelectionChange) onSelectionChange(Array.from(set));
    }, [onSelectionChange]);

    const subscribe = useCallback((id: string, listener: Listener) => {
        if (!listeners.current.has(id)) {
            listeners.current.set(id, new Set());
        }
        listeners.current.get(id)!.add(listener);

        // Initial state
        listener(selectedIds.current.has(id));

        return () => {
            const itemListeners = listeners.current.get(id);
            if (itemListeners) {
                itemListeners.delete(listener);
                if (itemListeners.size === 0) {
                    listeners.current.delete(id);
                }
            }
        };
    }, []);

    const isSelected = useCallback((id: string) => selectedIds.current.has(id), []);
    const getSelectedIds = useCallback(() => Array.from(selectedIds.current), []);

    return (
        <SelectionContext.Provider value={{ toggle, subscribe, isSelected, selectAll, getSelectedIds }}>
            {children}
        </SelectionContext.Provider>
    );
};

export const useSelection = () => {
    const context = useContext(SelectionContext);
    if (!context) throw new Error("useSelection must be used within SelectionProvider");
    return context;
};
