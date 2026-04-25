import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

type ConfigId = 'usage' | 'schedule' | 'block_now' | null;

interface SelectionContextType {
    isSelectionVisible: boolean;
    activeConfigId: ConfigId;
    openSelection: () => void;
    closeSelection: () => void;
    setActiveConfigId: (id: ConfigId) => void;
    closeConfig: () => void;
}

export const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export const SelectionProvider = ({ children }: { children: ReactNode }) => {
    const [isSelectionVisible, setIsSelectionVisible] = useState(false);
    const [activeConfigId, setActiveConfigId] = useState<ConfigId>(null);

    const openSelection = useCallback(() => {
        setIsSelectionVisible(true);
    }, []);

    const closeSelection = useCallback(() => {
        setIsSelectionVisible(false);
    }, []);

    const closeConfig = useCallback(() => {
        setActiveConfigId(null);
    }, []);

    const value = useMemo(() => ({
        isSelectionVisible,
        activeConfigId,
        openSelection,
        closeSelection,
        setActiveConfigId,
        closeConfig
    }), [isSelectionVisible, activeConfigId, openSelection, closeSelection, setActiveConfigId, closeConfig]);

    return (
        <SelectionContext.Provider value={value}>
            {children}
        </SelectionContext.Provider>
    );
};

export const useSelection = () => {
    const context = useContext(SelectionContext);
    if (!context) {
        throw new Error('useSelection must be used within a SelectionProvider');
    }
    return context;
};
