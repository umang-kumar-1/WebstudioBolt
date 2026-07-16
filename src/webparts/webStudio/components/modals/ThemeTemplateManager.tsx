import React, { useMemo, useState } from 'react';
import { Palette, Pencil } from 'lucide-react';
import { useStore, getTranslation, DEFAULT_THEME } from '../../store';
import { ThemeTemplate } from '../../types';
import { DEFAULT_THEME_TEMPLATE_ID, isDefaultThemeTemplate, orderThemeTemplatesWithDefaultFirst } from '../../utils/themeTemplateHelpers';
import { ThemeTemplateCard } from '../common/ThemeTemplateCard';
import { GenericModal } from './SharedModals';

export const ThemeTemplateManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const {
        currentLanguage,
        themeConfig,
        themeTemplates,
        applyThemeTemplate,
    } = useStore();

    const t = (key: string) => getTranslation(key, currentLanguage);
    const primaryColor = themeConfig['--primary-color'];
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isApplying, setIsApplying] = useState(false);

    const templates = useMemo(
        () => orderThemeTemplatesWithDefaultFirst(
            themeTemplates.filter(tmpl => tmpl.status === 'Published'),
            DEFAULT_THEME,
            t('LABEL_DEFAULT_THEME')
        ),
        [themeTemplates, currentLanguage]
    );

    const handleApply = async () => {
        const selected = templates.find(tmpl => tmpl.id === selectedId);
        if (!selected) return;
        setIsApplying(true);
        try {
            await applyThemeTemplate(selected);
            onClose();
        } finally {
            setIsApplying(false);
        }
    };

    const customPublished = templates.filter(tmpl => tmpl.id !== DEFAULT_THEME_TEMPLATE_ID);

    return (
        <GenericModal
            title={t('THEME_TEMPLATE_MGMT')}
            onClose={onClose}
            width="w-[80vw] min-w-[80vw] max-w-[80vw]"
            customFooter={
                <div className="flex justify-between items-center w-full gap-4">
                    <p className="text-xs text-gray-500 hidden sm:block">{t('DESC_THEME_TEMPLATE_MGMT')}</p>
                    <div className="flex gap-3 ml-auto">
                        <button type="button" onClick={onClose} className="btn-secondary">
                            {t('BTN_CANCEL')}
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={!selectedId || isApplying}
                            className="btn-primary shadow-md inline-flex items-center gap-2 disabled:opacity-50"
                        >
                            <Palette className="w-4 h-4" />
                            {isApplying ? t('MSG_SAVING') : t('BTN_APPLY_THEME')}
                        </button>
                    </div>
                </div>
            }
        >
            <div className="min-h-[50vh] max-h-[70vh] overflow-y-auto p-2">
                {customPublished.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4 mb-6 border border-dashed border-gray-200 rounded-sm bg-gray-50">
                        {t('MSG_NO_THEME_TEMPLATES')}
                    </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                    {templates.map((tmpl: ThemeTemplate) => {
                        const isSelected = selectedId === tmpl.id;
                        return (
                            <ThemeTemplateCard
                                key={tmpl.id}
                                template={tmpl}
                                isSelected={isSelected}
                                isSelectable
                                onSelect={() => setSelectedId(tmpl.id)}
                                themePrimaryColor={primaryColor}
                                defaultLabel={t('LABEL_DEFAULT_THEME')}
                            />
                        );
                    })}
                </div>
            </div>
        </GenericModal>
    );
};

/** Gallery for Super Admin theme template CRUD inside Styling Configuration. */
export const ThemeTemplateGallery: React.FC<{
    onCreate: () => void;
    onEdit: (template: ThemeTemplate) => void;
}> = ({ onCreate, onEdit }) => {
    const {
        themeTemplates,
        currentLanguage,
        themeConfig,
        deleteThemeTemplate,
        updateThemeTemplate,
        applyThemeTemplate,
        closeModal,
    } = useStore();

    const t = (key: string) => getTranslation(key, currentLanguage);
    const primaryColor = themeConfig['--primary-color'];
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isApplying, setIsApplying] = useState(false);

    const templates = useMemo(
        () => orderThemeTemplatesWithDefaultFirst(themeTemplates, DEFAULT_THEME, t('LABEL_DEFAULT_THEME')),
        [themeTemplates, currentLanguage]
    );

    const customTemplates = templates.filter(tmpl => !isDefaultThemeTemplate(tmpl));

    const handleTogglePublish = async (tmpl: ThemeTemplate, e: React.MouseEvent) => {
        e.stopPropagation();
        const nextStatus = tmpl.status === 'Published' ? 'Draft' : 'Published';
        await updateThemeTemplate({ ...tmpl, status: nextStatus });
    };

    const handleApply = async () => {
        const selected = templates.find(tmpl => tmpl.id === selectedId);
        if (!selected) return;
        setIsApplying(true);
        try {
            await applyThemeTemplate(selected);
            closeModal();
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
            <div className="flex-1 overflow-y-auto p-8">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">{t('TITLE_THEME_TEMPLATES')}</h3>
                        <p className="text-sm text-gray-500 mt-1">{t('DESC_THEME_TEMPLATE_SUPER')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onCreate}
                        className="px-4 py-2 text-white text-xs font-bold rounded-sm shadow-sm hover:opacity-90"
                        style={{ backgroundColor: primaryColor }}
                    >
                        + {t('BTN_CREATE_THEME_TEMPLATE')}
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                    {templates.map(tmpl => {
                        const isBuiltinDefault = isDefaultThemeTemplate(tmpl);
                        const isSelected = selectedId === tmpl.id;
                        return (
                            <ThemeTemplateCard
                                key={tmpl.id}
                                template={tmpl}
                                isSelected={isSelected}
                                isSelectable
                                onSelect={() => setSelectedId(tmpl.id)}
                                themePrimaryColor={primaryColor}
                                defaultLabel={t('LABEL_DEFAULT_THEME')}
                                footerActions={isBuiltinDefault ? undefined : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onEdit(tmpl); }}
                                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 border border-gray-200 rounded-sm hover:bg-gray-50"
                                        >
                                            <Pencil className="w-3 h-3" /> {t('BTN_EDIT')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => handleTogglePublish(tmpl, e)}
                                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 border border-gray-200 rounded-sm hover:bg-gray-50"
                                        >
                                            {tmpl.status === 'Published' ? t('BTN_UNPUBLISH') : t('BTN_PUBLISH')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); deleteThemeTemplate(tmpl.id); }}
                                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 border border-red-200 text-red-600 rounded-sm hover:bg-red-50 ml-auto"
                                        >
                                            {t('BTN_DELETE')}
                                        </button>
                                    </>
                                )}
                            />
                        );
                    })}
                </div>

                {customTemplates.length === 0 && (
                    <p className="text-sm text-gray-500 mt-8 text-center border border-dashed border-gray-200 rounded-sm bg-white py-6 px-4">
                        {t('MSG_NO_THEME_TEMPLATES_SUPER')}
                    </p>
                )}
            </div>

            <div className="px-8 py-4 border-t border-gray-200 bg-white flex justify-between items-center gap-4 shrink-0">
                <p className="text-xs text-gray-500 hidden sm:block">
                    {selectedId ? t('DESC_THEME_TEMPLATE_MGMT') : t('DESC_THEME_TEMPLATE_SUPER')}
                </p>
                <button
                    type="button"
                    onClick={handleApply}
                    disabled={!selectedId || isApplying}
                    className="btn-primary shadow-md inline-flex items-center gap-2 ml-auto disabled:opacity-50"
                >
                    <Palette className="w-4 h-4" />
                    {isApplying ? t('MSG_SAVING') : t('BTN_APPLY_THEME')}
                </button>
            </div>
        </div>
    );
};
