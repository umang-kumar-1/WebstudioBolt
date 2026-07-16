import * as React from 'react';
import { createPortal } from 'react-dom';
import { useNestedPortalZ, getNestedPortalZFromStore } from '../../utils/modalZIndex';

export interface NestedModalPortalProps {
    children: React.ReactNode;
    layer?: number;
    className?: string;
    onBackdropClick?: () => void;
    backdropClassName?: string;
}

/** Portals a nested modal overlay above the current ModalManager stack. */
export const NestedModalPortal: React.FC<NestedModalPortalProps> = ({
    children,
    layer = 0,
    className = 'fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200',
    onBackdropClick,
    backdropClassName = 'absolute inset-0',
}) => {
    const zIndex = useNestedPortalZ(layer);

    return createPortal(
        <div className={className} style={{ zIndex }}>
            {onBackdropClick && (
                <div className={backdropClassName} onClick={onBackdropClick} aria-hidden />
            )}
            {children}
        </div>,
        document.body
    );
};
