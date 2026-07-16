import React, { useState } from 'react';
import { useStore } from '../../store';
import { SmartPageEditor } from './SmartPageManager';
import { ConfirmDeleteDialog } from './SharedModals';

/**
 * PageInfoEditor is a wrapper for SmartPageEditor specifically for the PAGE_INFO modal.
 * It connects to the store to get the active page and provides standard save/cancel/delete handlers.
 */
export const PageInfoEditor = ({ onClose }: { onClose: () => void }) => {
    const { pages, currentPageId, updatePage, deletePage } = useStore();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const activePage = pages.find(p => p.id === currentPageId);

    if (!activePage) return null;

    return (
        <>
            <SmartPageEditor
                item={activePage}
                onSave={(p) => {
                    updatePage(p);
                    onClose();
                }}
                onCancel={onClose}
                onDelete={() => setShowDeleteConfirm(true)}
            />
            {showDeleteConfirm && (
                <ConfirmDeleteDialog
                    onConfirm={() => {
                        deletePage(activePage.id);
                        setShowDeleteConfirm(false);
                        onClose();
                    }}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </>
    );
};
