import React, { createContext, useContext } from 'react';

export interface ContainerEditorLockState {
    /** Hide layout, styling, identity, and other design/technical settings (Site Admin + template). */
    hideDesignSettings: boolean;
    /** Super Admin is authoring a reusable section template — full settings access. */
    isTemplateEditorMode: boolean;
}

const defaultState: ContainerEditorLockState = {
    hideDesignSettings: false,
    isTemplateEditorMode: false,
};

export const ContainerEditorLockContext = createContext<ContainerEditorLockState>(defaultState);

export const ContainerEditorLockProvider: React.FC<{
    value: ContainerEditorLockState;
    children: React.ReactNode;
}> = ({ value, children }) => (
    <ContainerEditorLockContext.Provider value={value}>{children}</ContainerEditorLockContext.Provider>
);

export const useContainerEditorLock = (): ContainerEditorLockState =>
    useContext(ContainerEditorLockContext);
