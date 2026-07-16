import React, { useMemo } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore, getTranslation } from '../../store';
import { SectionTemplate, ContainerType } from '../../types';
import {
    CATEGORY_TO_CONTAINER_TYPE,
    buildBuiltinPresetDraftTemplate,
    getBuiltinPresetSettings,
    isTemplateManagedCategory,
} from '../../utils/templatePermissions';
import { TemplatePickerCard } from '../common/TemplatePickerCard';

const CATEGORY_LABEL_KEYS: Record<string, string> = {
    HEADER: 'TAB_CONTAINER_HEADER',
    SLIDER: 'TAB_CONTAINER_SLIDER',
    DATA_GRID: 'TAB_CONTAINER_DATA_GRID',
    CONTACT_FORM: 'TAB_CONTAINER_CONTACT_FORM',
    MAP: 'TAB_CONTAINER_MAP',
    CONTAINER_SECTION: 'TAB_CONTAINER_CONTAINER_SECTION',
};

interface SectionTypeTemplateAreaProps {
    categoryId: string;
    isSuperAdmin: boolean;
    selectedTemplateId: string | null;
    onSelect: (template: SectionTemplate) => void;
    onCreateTemplate: () => void;
    onEditTemplate: (template: SectionTemplate) => void;
    onPreviewTemplate: (template: SectionTemplate) => void;
}

/**
 * Per-section org template gallery with skeleton preview cards and Super Admin CRUD.
 */
export const SectionTypeTemplateArea: React.FC<SectionTypeTemplateAreaProps> = ({
    categoryId,
    isSuperAdmin,
    selectedTemplateId,
    onSelect,
    onCreateTemplate,
    onEditTemplate,
    onPreviewTemplate,
}) => {
    const { sectionTemplates, currentLanguage, themeConfig, deleteSectionTemplate, updateSectionTemplate } = useStore();
    const t = (key: string) => getTranslation(key, currentLanguage);
    const primaryColor = themeConfig['--primary-color'];

    if (!isTemplateManagedCategory(categoryId)) return null;

    const containerType = CATEGORY_TO_CONTAINER_TYPE[categoryId];
    const sectionLabel = t(CATEGORY_LABEL_KEYS[categoryId] || categoryId);

    const templatesForSection = useMemo(
        () => sectionTemplates.filter(tmpl => tmpl.containerType === containerType),
        [sectionTemplates, containerType]
    );

    const visibleTemplates = isSuperAdmin
        ? templatesForSection
        : templatesForSection.filter(tmpl => tmpl.status === 'Published');

    const handleTogglePublish = async (tmpl: SectionTemplate, e: React.MouseEvent) => {
        e.stopPropagation();
        const nextStatus = tmpl.status === 'Published' ? 'Draft' : 'Published';
        await updateSectionTemplate({ ...tmpl, status: nextStatus });
    };

    if (visibleTemplates.length === 0 && !isSuperAdmin) {
        return (
            <p className="text-sm text-gray-500 text-center py-12">{t('MSG_NO_PUBLISHED_TEMPLATES')}</p>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
                    {sectionLabel} {t('TITLE_SECTION_TEMPLATES')}
                </h3>
                {isSuperAdmin && (
                    <button
                        type="button"
                        onClick={onCreateTemplate}
                        className="px-4 py-2 text-white text-xs font-bold rounded-sm shadow-sm hover:opacity-90 flex items-center gap-2"
                        style={{ backgroundColor: primaryColor }}
                    >
                        <Plus className="w-3.5 h-3.5" />
                        {t('BTN_CREATE_SECTION_TEMPLATE').replace('{section}', sectionLabel)}
                    </button>
                )}
            </div>

            {visibleTemplates.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-200 rounded-sm bg-white">
                    {t('MSG_NO_SECTION_TEMPLATES_SUPER').replace('{section}', sectionLabel)}
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                    {visibleTemplates.map(tmpl => {
                        const isSelectable = tmpl.status === 'Published';
                        const isSelected = selectedTemplateId === tmpl.id;
                        return (
                            <TemplatePickerCard
                                key={tmpl.id}
                                title={tmpl.title}
                                description={tmpl.description || undefined}
                                containerType={tmpl.containerType}
                                settings={tmpl.settings}
                                isSelected={isSelected}
                                isSelectable={isSelectable}
                                statusBadge={tmpl.status}
                                onSelect={() => onSelect(tmpl)}
                                onPreview={() => onPreviewTemplate(tmpl)}
                                previewLabel={t('BTN_SHOW_PREVIEW')}
                                themePrimaryColor={primaryColor}
                                footerActions={isSuperAdmin ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onEditTemplate(tmpl); }}
                                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 border border-gray-200 rounded-sm hover:bg-gray-50"
                                        >
                                            <Pencil className="w-3 h-3" /> {t('BTN_EDIT')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => handleTogglePublish(tmpl, e)}
                                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 border border-gray-200 rounded-sm hover:bg-gray-50"
                                        >
                                            <Eye className="w-3 h-3" /> {tmpl.status === 'Published' ? t('BTN_UNPUBLISH') : t('BTN_PUBLISH')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); deleteSectionTemplate(tmpl.id); }}
                                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 border border-red-200 text-red-600 rounded-sm hover:bg-red-50 ml-auto"
                                        >
                                            <Trash2 className="w-3 h-3" /> {t('BTN_DELETE')}
                                        </button>
                                    </>
                                ) : undefined}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export interface BuiltinPresetDef {
    id: string;
    labelKey: string;
    descKey: string;
    type: ContainerType;
    previewId: string;
}

interface BuiltinPresetGalleryProps {
    categoryId: string;
    presets: BuiltinPresetDef[];
    selectedPresetId: string | null;
    isSuperAdmin: boolean;
    hasOrgTemplates: boolean;
    onSelect: (preset: BuiltinPresetDef) => void;
    onPreview: (preset: BuiltinPresetDef) => void;
    onEditPreset: (preset: BuiltinPresetDef) => void;
}

/** Built-in preset cards — Super Admins can edit & publish as org templates. */
export const BuiltinPresetGallery: React.FC<BuiltinPresetGalleryProps> = ({
    categoryId,
    presets,
    selectedPresetId,
    isSuperAdmin,
    hasOrgTemplates,
    onSelect,
    onPreview,
    onEditPreset,
}) => {
    const { currentLanguage, themeConfig } = useStore();
    const t = (key: string) => getTranslation(key, currentLanguage);
    const primaryColor = themeConfig['--primary-color'];

    if (!isSuperAdmin || presets.length === 0) return null;

    return (
        <div className={hasOrgTemplates ? 'mt-10 pt-8 border-t border-gray-200' : ''}>
            <h3 className="text-sm font-bold mb-6 uppercase tracking-wide text-gray-500">
                {t('LABEL_BUILTIN_PRESETS')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {presets.map(preset => {
                    const settings = getBuiltinPresetSettings(categoryId, preset.id);
                    return (
                        <TemplatePickerCard
                            key={preset.id}
                            title={t(preset.labelKey)}
                            description={t(preset.descKey)}
                            containerType={preset.type}
                            settings={settings}
                            previewId={preset.previewId}
                            isSelected={selectedPresetId === preset.id}
                            isSelectable
                            onSelect={() => onSelect(preset)}
                            onPreview={() => onPreview(preset)}
                            previewLabel={t('BTN_SHOW_PREVIEW')}
                            themePrimaryColor={primaryColor}
                            footerActions={(
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onEditPreset(preset); }}
                                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 border border-gray-200 rounded-sm hover:bg-gray-50 w-full justify-center"
                                >
                                    <Pencil className="w-3 h-3" /> {t('BTN_EDIT')} / {t('BTN_PUBLISH')}
                                </button>
                            )}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export { buildBuiltinPresetDraftTemplate };
