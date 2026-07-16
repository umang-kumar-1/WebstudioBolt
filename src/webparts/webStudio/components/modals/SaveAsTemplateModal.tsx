import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { useStore, getTranslation } from '../../store';
import { Container, SectionTemplate } from '../../types';
import { GenericModal } from './SharedModals';
import { MODAL_Z } from '../../utils/modalZIndex';
import {
    getDefaultEditableFields,
    getTemplateSidebarFieldCatalog,
    sanitizeTemplateEditableFields,
} from '../../utils/templatePermissions';

interface SaveAsTemplateModalProps {
    container: Container;
    onClose: () => void;
}

export const SaveAsTemplateModal: React.FC<SaveAsTemplateModalProps> = ({ container, onClose }) => {
    const {
        currentLanguage,
        themeConfig,
        addSectionTemplate,
        sectionTemplates,
    } = useStore();
    const t = (key: string) => getTranslation(key, currentLanguage);

    const fieldCatalog = getTemplateSidebarFieldCatalog(container.type);
    const [title, setTitle] = useState(container.title || container.settings?.containerTitle || '');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<'Draft' | 'Published'>('Draft');
    const [editableFields, setEditableFields] = useState<string[]>(() => getDefaultEditableFields(container.type));
    const [isSaving, setIsSaving] = useState(false);

    const nextSortOrder = useMemo(
        () => sectionTemplates.reduce((max, tmpl) => Math.max(max, tmpl.sortOrder || 0), 0) + 1,
        [sectionTemplates]
    );

    const toggleField = (key: string) => {
        setEditableFields(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleSave = async () => {
        if (!title.trim()) return;
        setIsSaving(true);

        const { sectionTemplateId: _removed, sectionTemplateEditableFields: _removed2, ...settings } = container.settings || {};

        const template: SectionTemplate = {
            id: `tmpl_${Date.now()}`,
            title: title.trim(),
            description: description.trim(),
            containerType: container.type,
            status,
            settings,
            content: { ...(container.content || {}) },
            editableFields: sanitizeTemplateEditableFields(container.type, editableFields),
            sortOrder: nextSortOrder,
        };

        const saved = await addSectionTemplate(template);
        setIsSaving(false);
        if (saved) onClose();
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" style={{ zIndex: MODAL_Z.OVERLAY }}>
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative z-50 w-full max-w-2xl">
                <GenericModal
                    title={t('TITLE_SAVE_AS_TEMPLATE')}
                    onClose={onClose}
                    width="w-full max-w-2xl"
                    heightClass="max-h-[85vh]"
                    bodyOverflow="auto"
                    customFooter={(
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-bold hover:bg-gray-50 rounded-sm"
                            >
                                {t('BTN_CANCEL')}
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={!title.trim() || isSaving}
                                className="px-8 py-2 text-white text-sm font-bold rounded-sm shadow-sm hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
                                style={{ backgroundColor: themeConfig['--primary-color'] }}
                            >
                                <Check className="w-4 h-4" />
                                {t('BTN_SAVE')}
                            </button>
                        </div>
                    )}
                >
                    <div className="p-6 space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('LABEL_TEMPLATE_NAME')}</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('LABEL_TEMPLATE_DESCRIPTION')}</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={3}
                                className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('LABEL_TEMPLATE_STATUS')}</label>
                            <select
                                value={status}
                                onChange={e => setStatus(e.target.value as 'Draft' | 'Published')}
                                className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                            >
                                <option value="Draft">Draft</option>
                                <option value="Published">Published</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('LABEL_EDITABLE_FIELDS')}</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {fieldCatalog.map(field => (
                                    <label
                                        key={field.key}
                                        className="flex items-center gap-2 text-sm border border-gray-200 rounded-sm px-3 py-2 cursor-pointer hover:bg-gray-50"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={editableFields.includes(field.key)}
                                            onChange={() => toggleField(field.key)}
                                        />
                                        <span>{t(field.labelKey)}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </GenericModal>
            </div>
        </div>,
        document.body
    );
};

/** Banner shown in container editors when design settings are template-locked. */
export const TemplateLockedBanner: React.FC<{ className?: string }> = ({ className = '' }) => {
    const { currentLanguage } = useStore();
    const t = (key: string) => getTranslation(key, currentLanguage);
    return (
        <div className={`flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-sm px-3 py-2 ${className}`}>
            <span className="font-semibold shrink-0">🔒</span>
            <span>{t('MSG_TEMPLATE_LOCKED_FIELDS')}</span>
        </div>
    );
};

/** Read-only overlay wrapper for locked design sections. */
export const TemplateFieldLock: React.FC<{
    locked: boolean;
    children: React.ReactNode;
    className?: string;
}> = ({ locked, children, className = '' }) => {
    if (!locked) return <>{children}</>;
    return (
        <div className={`relative ${className}`}>
            <div className="pointer-events-none opacity-60 select-none">{children}</div>
            <div className="absolute inset-0 bg-gray-100/20 rounded-sm" aria-hidden />
        </div>
    );
};
