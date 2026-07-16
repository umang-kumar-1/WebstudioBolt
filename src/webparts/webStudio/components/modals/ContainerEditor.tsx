import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useStore, getLocalizedText, getItemTranslation, getTranslation, getGlobalDefaultImage } from '../../store';
import { getNestedPortalZFromStore } from '../../utils/modalZIndex';
import { resolveGalleryDefaultImage } from '../../utils/defaultImageUrl';
import {
    DEFAULT_HERO_OVERLAY_COLOR,
    isValidHexColor,
    normalizeHexColorInput,
    parseHeroOverlayOpacity,
    toColorInputValue,
} from '../../utils/heroImageOverlay';
import { ActionButtonStyleEditor } from '../common/ActionButtonStyleEditor';
import { FontWeightSelect } from '../common/FontWeightSelect';
import { translateText } from '../../services/geminiService';
import { Container, ContainerType, ImageItem, LanguageCode, SectionTemplate, WebStudioUserRole } from '../../types';
import { getAllLists, getListFields, getListItems, addListItem, updateListItem, deleteListItem } from '../../services/SPService';
import { GenericModal, TabButton, ConfirmDeleteDialog, TaggedOrderApplyResult, TaggedOrderChangeContext, BindPageTitleDescriptionField, SortByHelpIcon } from './SharedModals';
import { MODAL_Z } from '../../utils/modalZIndex';
import { DataGridContentPanel } from './DataGridContentPanel';
import {
    Trash2, AlignCenter, AlignLeft, AlignRight,
    Plus, X, Square, Circle, List as ListIcon,
    Image as ImageIcon, Palette, Type,
    ArrowUp, ArrowDown, Monitor, Globe, Wand2, Smartphone, Tablet,
    ArrowUpAZ, ArrowDownAZ, ChevronDown, Info,
    Upload, Link as LinkIcon, MoreHorizontal, AlignJustify, Check, Copy,
    FileText, AlertCircle, Pencil, Save, FileSpreadsheet, Presentation,
    MapPin, Search, Play
} from 'lucide-react';
import { ContainerEditorLockProvider } from '../../contexts/ContainerEditorLockContext';
import { SaveAsTemplateModal, TemplateLockedBanner } from './SaveAsTemplateModal';
import {
    canManageTemplates,
    canPublishContent,
    canShowFullContainerEditor,
    isTemplateRestrictedEditor,
    isContentLockedEditor,
    EditorAccessConfig,
    hasSiteAdminDataGridSettingsAccess,
    hasSiteAdminSliderSettingsAccess,
    isFieldEditableForRole,
    isSiteAdminTemplateFieldEditable,
    isContentEditorFieldEditable,
    resolveEffectiveEditableFields,
    resolveContainerEditableFields,
    resolveContainerWithLiveTemplate,
    isImageTextSliderContainer,
    isButtonTemplateFieldKey,
    CATEGORY_TO_CONTAINER_TYPE,
    EDITABLE_FIELD_CATALOG,
    getDefaultEditableFields,
    getTemplateSidebarFieldCatalog,
    sanitizeTemplateEditableFields,
    getDefaultTemplateSettingsForCategory,
    normalizeTemplateSettingsForSave,
    isSettingsPathEditable,
    isSettingsGroupEditable,
    TEMPLATE_DATA_SOURCE_OPTIONS,
    toStoredDataGridSource,
    buildCardGridTemplateSettingsForSource,
    getBuiltinPresetSettings,
    hydrateTemplateContentForContainer,
    normalizeSliderTemplateSettings,
    normalizeMapTemplateSettings,
} from '../../utils/templatePermissions';
import { SharePointMetadataFooter } from '../common/SharePointMetadataFooter';
import TooltipMenu from '../common/TooltipMenu';
import { useOptimizedImageUpload } from '../../../../hooks/useOptimizedImageUpload';
import ImageOptimizationFeedback from '../../../../components/ImageOptimizationFeedback';
import ManagedImageEditorBridge from '../common/ManagedImageEditorBridge';

import JoditRichTextEditor from '../JoditEditor';
import {
    HeroTypographyRole,
    HeroTypographyStylePreset,
    HERO_TYPOGRAPHY_STYLE_OPTIONS,
    getHeroTypographyCustomKeys,
    getHeroTypographyStyleSettingKey,
    inferHeroTypographyStyle,
    isHeroTypographyStylePreset,
    resolveHeroTypography,
    CONTACT_FORM_DEFAULT_LETTER_CASE,
    getEffectiveContactFormLetterCase,
    resolveContactFormLetterCaseCss,
    applyContactFormLetterCaseToText,
} from '../../heroTypographyPresets';
import {
    buildHeroDescriptionColorPatch,
    buildHeroSubtitleColorPatch,
    buildHeroTitleColorPatch,
    normalizeHeroColorPreset,
    normalizeHeroDescriptionColorPreset,
    HERO_DESCRIPTION_CUSTOM_DEFAULT,
    buildCardDescColorPatch,
    buildCardSubtitleColorPatch,
    buildCardTitleColorPatch,
    HERO_DESCRIPTION_COLOR_OPTIONS,
    getHeroDescriptionColorSetting,
    getHeroDescriptionCustomColor,
    getHeroSubtitleColorSetting,
    getHeroSubtitleCustomColor,
    getHeroTitleColorSetting,
    getHeroTitleCustomColor,
    getCardDescColorSetting,
    getCardDescCustomColor,
    getCardSubtitleColorSetting,
    getCardSubtitleCustomColor,
    getCardTitleColorSetting,
    getCardTitleCustomColor,
} from '../../heroColorSettings';
import { DEFAULT_SECTION_SPACING_PX } from '../../utils/sectionSpacing';
import {
    CONTENT_SOURCE_LANG,
    TRANSLATION_TARGET_LANG,
    applyBaseHeaderFieldUpdate,
    applyTranslationHeaderFieldUpdate,
    applyBaseSettingsTextField,
    applyTranslationSettingsTextField,
    getExactLanguageText,
    isContainerSectionBindPageEnabled,
} from '../../utils/containerContentHelpers';
import { extractPrimaryFontName, getWebsiteFontOptions } from '../../utils/fontCatalog';
import { getOptionalEnabledLanguages, LANGUAGE_DISPLAY_NAMES } from '../../utils/siteLanguages';
import { isItemCardSource, normalizeDataGridSource } from '../../utils/cardReadMore';
import {
    getDefaultDataGridSortConfig,
    getDataGridSortOptions,
    normalizeContentViewMode,
    normalizeSectionSortField,
    sourceSupportsItemSortOrder,
} from '../../utils/dataGridContentSort';

// Import Reusable Editors
import { NewsEditor, CreateNewsModal } from './NewsManager';
import { EventEditor, CreateEventModal } from './EventManager';
import { DocumentEditor, AddDocumentModal } from './DocumentManager';
import { ContainerItemEditor, CreateContainerItemModal } from './ContainerItemManager';
import { ContactEditor, CreateContactModal } from './ContactManager';
import { SliderManager, SliderItemEditor, CreateSliderItemModal, SliderImageRadiusEditor } from './SliderManager';
import { parseSliderImageSettings, resolveSliderImageRadiusStyle } from '../../utils/sliderImageRadius';
import { SmartPageEditor, CreateSmartPageModal } from './SmartPageManager';

// --- MOCK ASSETS ---


// --- HELPER: DOCUMENT ICONS ---
const getDocIcon = (type: string) => {
    switch (type) {
        case 'Word': return <FileText className="w-8 h-8 text-blue-600 opacity-80" />;
        case 'Excel': return <FileSpreadsheet className="w-8 h-8 text-green-600 opacity-80" />;
        case 'PDF': return <FileText className="w-8 h-8 text-red-500 opacity-80" />;
        case 'PPT':
        case 'Presentations': return <Presentation className="w-8 h-8 text-orange-500 opacity-80" />;
        case 'Link': return <LinkIcon className="w-8 h-8 text-sky-500 opacity-80" />;
        default: return <FileText className="w-8 h-8 text-gray-400 opacity-80" />;
    }
};

// --- SHARED COMPONENTS ---

interface VisualOptionProps {
    label: string;
    icon?: React.ElementType;
    active: boolean;
    onClick: () => void;
    extraClass?: string;
}

const VisualOption = ({ label, icon: Icon, active, onClick, extraClass = "" }: VisualOptionProps) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex-1 py-3 px-2 text-xs font-bold flex flex-col items-center justify-center gap-2 border rounded-sm transition-all ${active ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'} ${extraClass}`}
    >
        {Icon && <Icon className="w-4 h-4" />}
        {label}
    </button>
);

interface VisualSelectorOption {
    value: string | number | boolean;
    label: string;
    text?: string;
    icon?: React.ElementType;
}

interface VisualSelectorProps {
    label: string;
    options: VisualSelectorOption[];
    value: string | number | boolean;
    onChange: (val: string | number | boolean) => void;
}

const VisualSelector = ({ label, options, value, onChange }: VisualSelectorProps) => (
    <div className="mb-6">
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{label}</label>
        <div className="flex bg-gray-100 p-1 rounded-sm gap-1">
            {options.map((opt) => (
                <button
                    key={opt.value.toString()}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={`flex-1 py-2 px-3 text-xs font-bold flex items-center justify-center gap-2 rounded-sm transition-all ${value === opt.value ? 'bg-white text-[var(--primary-color)] shadow-sm ring-1 ring-[var(--primary-color)]' : 'text-gray-500 hover:text-gray-700'}`}
                    title={opt.label}
                >
                    {opt.icon && <opt.icon className="w-4 h-4" />}
                    {opt.text || opt.label}
                </button>
            ))}
        </div>
    </div>
);

/** Scroll area for container editors: padding keeps focus rings clear of the vertical scrollbar */
const EDITOR_SCROLL_CLASS = 'flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-6 pb-8';
const EDITOR_SECTION_CARD = 'bg-white rounded-lg border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.06)]';
const EDITOR_SECTION_HEADER = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 pb-3 mb-5 border-b border-slate-100';
const EDITOR_FIELD_LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-slate-500';
const EDITOR_FIELD_INPUT = 'w-full min-w-0 border border-gray-200 hover:border-gray-300 bg-white p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none transition-colors';
const CONTACT_FORM_SCROLL_CLASS = 'flex-1 overflow-y-auto overflow-x-hidden min-h-0';

const VisibilityToggle = ({
    checked,
    onCheckedChange,
    ariaLabel
}: {
    checked: boolean;
    onCheckedChange: (next: boolean) => void;
    ariaLabel: string;
}) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        onClick={() => onCheckedChange(!checked)}
        className="shrink-0 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] focus-visible:ring-offset-1"
    >
        <span className={`relative block w-9 h-5 rounded-full transition-colors ${checked ? 'bg-[var(--primary-color)]' : 'bg-gray-300'}`}>
            <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-150"
                style={{ left: checked ? '16px' : '2px' }}
            />
        </span>
    </button>
);

type ContainerEditorChildProps = {
    data: Container;
    setData: React.Dispatch<React.SetStateAction<Container>>;
    onClose?: () => void;
    editorAccess: EditorAccessConfig;
};

type SiteAdminFieldDef = {
    fieldKey: string;
    labelKey: string;
    kind: 'content-text' | 'content-rich' | 'settings-text' | 'settings-rich' | 'settings-image' | 'settings-toggle' | 'settings-url';
    contentKey?: string;
    settingsKey?: string;
    legacySettingsKey?: string;
    showToggleKey?: 'showHeader' | 'showSubheading' | 'showDescription';
    /** When set, field is only shown when this returns true (e.g. image fields for image layouts). */
    showWhen?: (settings: Record<string, unknown>) => boolean;
};

const siteAdminHeroUsesImage = (settings: Record<string, unknown>): boolean => {
    const bgType = String(settings.bgType || '').toLowerCase();
    return bgType === 'image' || bgType === 'layout';
};

const SITE_ADMIN_FIELDS_BY_TYPE: Partial<Record<ContainerType, SiteAdminFieldDef[]>> = {
    [ContainerType.HERO]: [
        { fieldKey: 'content.title', labelKey: 'LABEL_HEADING', kind: 'content-text', contentKey: 'title', showToggleKey: 'showHeader' },
        { fieldKey: 'content.subtitle', labelKey: 'LABEL_SUBHEADING', kind: 'content-text', contentKey: 'subtitle', showToggleKey: 'showSubheading' },
        { fieldKey: 'content.description', labelKey: 'LABEL_DESCRIPTION', kind: 'content-rich', contentKey: 'description', showToggleKey: 'showDescription' },
        { fieldKey: 'settings.bgImage', labelKey: 'LABEL_IMAGE', kind: 'settings-image', settingsKey: 'bgImage', showWhen: siteAdminHeroUsesImage },
        { fieldKey: 'settings.btnEnabled', labelKey: 'TMPL_FIELD_BTN_ENABLED', kind: 'settings-toggle', settingsKey: 'btnEnabled' },
        { fieldKey: 'settings.btnName', labelKey: 'LABEL_BUTTON_NAME', kind: 'settings-text', settingsKey: 'btnName', showWhen: (s) => s.btnEnabled !== false },
        { fieldKey: 'settings.btnUrl', labelKey: 'LABEL_BUTTON_URL', kind: 'settings-url', settingsKey: 'btnUrl', showWhen: (s) => s.btnEnabled !== false },
    ],
    [ContainerType.CARD_GRID]: [
        { fieldKey: 'content.title', labelKey: 'LABEL_HEADING', kind: 'content-text', contentKey: 'title', showToggleKey: 'showHeader', legacySettingsKey: 'heading' },
        { fieldKey: 'content.subtitle', labelKey: 'LABEL_SUBHEADING', kind: 'content-text', contentKey: 'subtitle', showToggleKey: 'showSubheading', legacySettingsKey: 'subheading' },
        { fieldKey: 'content.description', labelKey: 'LABEL_DESCRIPTION', kind: 'content-rich', contentKey: 'description', showToggleKey: 'showDescription', legacySettingsKey: 'description' },
    ],
    [ContainerType.SLIDER]: [
        { fieldKey: 'content.title', labelKey: 'LABEL_HEADING', kind: 'content-text', contentKey: 'title', showToggleKey: 'showHeader', legacySettingsKey: 'heading' },
        { fieldKey: 'content.subtitle', labelKey: 'LABEL_SUBHEADING', kind: 'content-text', contentKey: 'subtitle', showToggleKey: 'showSubheading', legacySettingsKey: 'subheading' },
        { fieldKey: 'content.description', labelKey: 'LABEL_DESCRIPTION', kind: 'content-rich', contentKey: 'description', showToggleKey: 'showDescription', legacySettingsKey: 'description' },
    ],
    [ContainerType.CONTACT_FORM]: [
        { fieldKey: 'settings.heading', labelKey: 'LABEL_HEADING', kind: 'settings-text', settingsKey: 'heading' },
        { fieldKey: 'settings.subheading', labelKey: 'LABEL_SUBHEADING', kind: 'settings-text', settingsKey: 'subheading' },
        { fieldKey: 'settings.description', labelKey: 'LABEL_DESCRIPTION', kind: 'settings-rich', settingsKey: 'description' },
        { fieldKey: 'settings.buttonText', labelKey: 'LABEL_BUTTON_TEXT', kind: 'settings-text', settingsKey: 'buttonText' },
    ],
    [ContainerType.CONTAINER_SECTION]: [
        { fieldKey: 'content.title', labelKey: 'LABEL_HEADING', kind: 'content-text', contentKey: 'title' },
        { fieldKey: 'settings.body', labelKey: 'LABEL_DESCRIPTION', kind: 'settings-rich', settingsKey: 'body' },
    ],
    [ContainerType.TABLE]: [
        { fieldKey: 'settings.title', labelKey: 'LABEL_HEADING', kind: 'settings-text', settingsKey: 'title' },
    ],
    [ContainerType.MAP]: [
        { fieldKey: 'settings.title', labelKey: 'LABEL_HEADING', kind: 'settings-text', settingsKey: 'title' },
    ],
};

/** Site Admins only see basic content fields — no layout, typography, or data-source settings. */
const SiteAdminRestrictedEditor: React.FC<{
    data: Container;
    setData: React.Dispatch<React.SetStateAction<Container>>;
    role: WebStudioUserRole;
    editableFields: string[];
    currentLanguage: LanguageCode;
    showTemplateBanner?: boolean;
    settingsPanel?: React.ReactNode | null;
}> = ({ data, setData, role, editableFields, currentLanguage, showTemplateBanner = false, settingsPanel = null }) => {
    const { siteConfig } = useStore();
    const optionalTranslationLanguages = useMemo(
        () => getOptionalEnabledLanguages(siteConfig),
        [siteConfig?.languages]
    );
    const showTranslationTab = optionalTranslationLanguages.length > 0;
    const [activeTab, setActiveTab] = useState<'CONTENT' | 'SETTINGS' | 'IMAGE' | 'TRANSLATION'>('CONTENT');
    const showSettingsTab = Boolean(settingsPanel);
    const allFields = SITE_ADMIN_FIELDS_BY_TYPE[data.type] || [];
    const contentTabFields = allFields.filter((field) => field.kind !== 'settings-image');
    const imageTabFields = allFields.filter((field) => field.kind === 'settings-image');
    const supportsImageTab = imageTabFields.length > 0;

    const isFieldPermitted = (field: SiteAdminFieldDef): boolean =>
        (isContentEditorFieldEditable(role, data.type, field.fieldKey, editableFields))
        && (!field.showWhen || field.showWhen(data.settings));

    const imageTabEnabled = imageTabFields.some(isFieldPermitted);
    const anyContentPermitted = contentTabFields.some(isFieldPermitted);

    useEffect(() => {
        if (activeTab === 'IMAGE' && !imageTabEnabled) {
            setActiveTab('CONTENT');
        }
        if (activeTab === 'SETTINGS' && !showSettingsTab) {
            setActiveTab('CONTENT');
        }
    }, [activeTab, imageTabEnabled, showSettingsTab]);
    const translationTarget: LanguageCode = TRANSLATION_TARGET_LANG;

    const updateSetting = (key: string, val: unknown) => {
        setData((prev) => ({ ...prev, settings: { ...prev.settings, [key]: val } }));
    };

    const updateContentValue = (contentKey: string, val: string, legacySettingsKey?: string) => {
        setData((prev) => applyBaseHeaderFieldUpdate(prev, contentKey, val, legacySettingsKey));
    };

    const updateSettingsTextValue = (settingsKey: string, val: string) => {
        setData((prev) => ({
            ...prev,
            settings: applyBaseSettingsTextField(prev.settings, settingsKey, val),
        }));
    };

    const updateContentTranslation = (contentKey: string, val: string, legacySettingsKey?: string, lang: LanguageCode = translationTarget) => {
        setData((prev) =>
            applyTranslationHeaderFieldUpdate(prev, contentKey, val, legacySettingsKey, lang)
        );
    };

    const updateSettingsTranslation = (settingsKey: string, val: string, lang: LanguageCode = translationTarget) => {
        setData((prev) => ({
            ...prev,
            settings: applyTranslationSettingsTextField(prev.settings, settingsKey, val, lang),
        }));
    };

    const getFieldValue = (field: SiteAdminFieldDef, lang: LanguageCode = CONTENT_SOURCE_LANG): string => {
        if (field.kind.startsWith('content-') && field.contentKey) {
            return getExactLanguageText((data.content as Record<string, unknown>)?.[field.contentKey], lang);
        }
        if (field.settingsKey) {
            return getExactLanguageText((data.settings as Record<string, unknown>)?.[field.settingsKey], lang);
        }
        return '';
    };

    const handleFieldChange = (field: SiteAdminFieldDef, val: string) => {
        if (field.kind.startsWith('content-') && field.contentKey) {
            updateContentValue(field.contentKey, val, field.legacySettingsKey);
            return;
        }
        if (field.settingsKey) {
            if (field.kind === 'settings-url') {
                updateSetting(field.settingsKey, val);
                return;
            }
            updateSettingsTextValue(field.settingsKey, val);
        }
    };

    const renderFieldInput = (field: SiteAdminFieldDef) => {
        if (field.kind === 'settings-image' && field.settingsKey) {
            return (
                <ImagePicker
                    value={String(data.settings[field.settingsKey] || '')}
                    onChange={(val) => updateSetting(field.settingsKey!, val)}
                />
            );
        }
        if (field.kind === 'settings-toggle' && field.settingsKey) {
            return (
                <VisibilityToggle
                    checked={data.settings[field.settingsKey] !== false}
                    onCheckedChange={(v) => updateSetting(field.settingsKey!, v)}
                    ariaLabel={getTranslation(field.labelKey, currentLanguage)}
                />
            );
        }
        if (field.kind === 'content-rich' || field.kind === 'settings-rich') {
            return (
                <JoditRichTextEditor
                    value={getFieldValue(field)}
                    onChange={(val: string) => handleFieldChange(field, val)}
                    height={160}
                    placeholder={getTranslation('LABEL_RICH_TEXT_DESC', currentLanguage)}
                />
            );
        }
        const placeholder =
            field.kind === 'settings-url'
                ? getTranslation('LABEL_BUTTON_URL_PLACEHOLDER', currentLanguage)
                : field.settingsKey === 'btnName'
                    ? getTranslation('LABEL_BUTTON_NAME_PLACEHOLDER', currentLanguage)
                    : undefined;
        return (
            <input
                className={EDITOR_FIELD_INPUT}
                value={getFieldValue(field)}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                placeholder={placeholder}
            />
        );
    };

    const showToggleLabelKey = (toggleKey: SiteAdminFieldDef['showToggleKey']) => {
        if (toggleKey === 'showHeader') return 'LABEL_SHOW_HEADER';
        if (toggleKey === 'showSubheading') return 'LABEL_SHOW_SUBHEADING';
        return 'LABEL_SHOW_DESC';
    };

    const translationFields: UebersetzungField[] = contentTabFields
        .filter(isFieldPermitted)
        .filter((field) => field.kind !== 'settings-toggle' && field.kind !== 'settings-url')
        .map((field) => {
            const label = getTranslation(field.labelKey, currentLanguage);
            const type = field.kind === 'content-rich' || field.kind === 'settings-rich' ? 'rich' as const : 'input' as const;
            if (field.kind.startsWith('content-') && field.contentKey) {
                return {
                    key: field.contentKey,
                    label,
                    type,
                    getValue: (lang: string) => getFieldValue(field, lang as LanguageCode),
                    onChange: (value: string, lang: LanguageCode) => updateContentTranslation(field.contentKey!, value, field.legacySettingsKey, lang),
                };
            }
            return {
                key: field.settingsKey || field.fieldKey,
                label,
                type,
                getValue: (lang: string) => getFieldValue(field, lang as LanguageCode),
                onChange: (value: string, lang: LanguageCode) => field.settingsKey && updateSettingsTranslation(field.settingsKey, value, lang),
            };
        });

    const canEditVisibilityToggle = (toggleKey: 'showHeader' | 'showSubheading' | 'showDescription') =>
        isSettingsPathEditable(role, toggleKey, data.type, editableFields);

    const renderAdminField = (field: SiteAdminFieldDef) => {
        const permitted = isFieldPermitted(field);
        if (!permitted) return null;

        const showToggle = field.showToggleKey;
        const showVisibilityToggle = showToggle && canEditVisibilityToggle(showToggle);
        const isVisible = !showToggle || data.settings[showToggle] !== false;
        const isToggleOnly = field.kind === 'settings-toggle';
        const isImageField = field.kind === 'settings-image';
        const isButtonToggle = field.settingsKey === 'btnEnabled';

        return (
            <div key={field.fieldKey} className="space-y-2 min-w-0">
                {!isImageField && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className={`${EDITOR_FIELD_LABEL} shrink-0`}>
                            {getTranslation(field.labelKey, currentLanguage)}
                        </label>
                        {showVisibilityToggle && (
                            <div className="flex items-center gap-2 ml-auto shrink-0">
                                <span className="text-xs font-medium text-slate-600">
                                    {getTranslation(showToggleLabelKey(showToggle), currentLanguage)}
                                </span>
                                <VisibilityToggle
                                    checked={data.settings[showToggle] !== false}
                                    onCheckedChange={(v) => updateSetting(showToggle, v)}
                                    ariaLabel={getTranslation(showToggleLabelKey(showToggle), currentLanguage)}
                                />
                            </div>
                        )}
                        {isToggleOnly && !isButtonToggle && (
                            <div className="ml-auto shrink-0">
                                {renderFieldInput(field)}
                            </div>
                        )}
                    </div>
                )}
                {isImageField ? renderFieldInput(field) : (!isToggleOnly && isVisible && renderFieldInput(field))}
            </div>
        );
    };

    const displayFields = contentTabFields.filter((field) => field.showToggleKey);
    const inlineDisplayFields = displayFields.filter((field) => field.kind !== 'content-rich' && field.kind !== 'settings-rich');
    const blockDisplayFields = displayFields.filter((field) => field.kind === 'content-rich' || field.kind === 'settings-rich');
    const otherContentFields = contentTabFields.filter((field) => !field.showToggleKey);
    const buttonFields = otherContentFields.filter((field) => isButtonTemplateFieldKey(field.fieldKey));
    const miscContentFields = otherContentFields.filter((field) => !isButtonTemplateFieldKey(field.fieldKey));
    const anyButtonPermitted = buttonFields.some(isFieldPermitted);
    const btnEnabledPermitted = buttonFields.some(
        (field) => field.settingsKey === 'btnEnabled' && isFieldPermitted(field)
    );
    const showButtonDetails = !btnEnabledPermitted || data.settings.btnEnabled !== false;

    return (
        <div className="flex flex-col h-full bg-slate-50/80">
            {showTemplateBanner && <TemplateLockedBanner className="mx-6 mt-4 rounded-md" />}
            <div className="flex border-b border-slate-200 bg-white flex-shrink-0 px-2">
                <TabButton active={activeTab === 'CONTENT'} label={getTranslation('LABEL_MANAGE_CONTENT', currentLanguage)} onClick={() => setActiveTab('CONTENT')} />
                {supportsImageTab && imageTabEnabled && (
                    <TabButton
                        active={activeTab === 'IMAGE'}
                        label={getTranslation('TAB_IMAGE_INFO', currentLanguage)}
                        onClick={() => setActiveTab('IMAGE')}
                    />
                )}
                {showSettingsTab && (
                    <TabButton active={activeTab === 'SETTINGS'} label={getTranslation('LABEL_SETTINGS', currentLanguage)} onClick={() => setActiveTab('SETTINGS')} />
                )}
                {showTranslationTab && (
                    <TabButton active={activeTab === 'TRANSLATION'} label={getTranslation('LABEL_TRANSLATION', currentLanguage)} onClick={() => setActiveTab('TRANSLATION')} />
                )}
            </div>
            <div className={EDITOR_SCROLL_CLASS}>
                {activeTab === 'CONTENT' && (
                    <div className="pt-6 w-full space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className={`${EDITOR_SECTION_CARD} p-6 md:p-8 space-y-8`}>
                            {!anyContentPermitted && (
                                <p className="text-sm text-slate-500 italic text-center py-10">
                                    {getTranslation('MSG_NO_PUBLISHED_TEMPLATES', currentLanguage)}
                                </p>
                            )}
                            {displayFields.some(isFieldPermitted) && (
                                <div>
                                    <h4 className={EDITOR_SECTION_HEADER}>
                                        {getTranslation('LABEL_DISPLAY_OPTIONS', currentLanguage)}
                                    </h4>
                                    {inlineDisplayFields.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                            {inlineDisplayFields.map((field) => renderAdminField(field))}
                                        </div>
                                    )}
                                    <div className="space-y-6">
                                        {blockDisplayFields.map((field) => renderAdminField(field))}
                                    </div>
                                </div>
                            )}
                            {anyButtonPermitted && (
                                <div className={displayFields.some(isFieldPermitted) ? 'pt-2 border-t border-slate-100' : ''}>
                                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--primary-color)] m-0">
                                            {getTranslation('LABEL_ACTION_BUTTON', currentLanguage)}
                                        </h4>
                                        {btnEnabledPermitted && (
                                            <div className="flex items-center gap-2 ml-auto shrink-0">
                                                <span className="text-xs font-medium text-slate-600">
                                                    {data.settings.btnEnabled !== false
                                                        ? getTranslation('LABEL_ENABLED', currentLanguage)
                                                        : getTranslation('LABEL_DISABLED', currentLanguage)}
                                                </span>
                                                <VisibilityToggle
                                                    checked={data.settings.btnEnabled !== false}
                                                    onCheckedChange={(v) => updateSetting('btnEnabled', v)}
                                                    ariaLabel={getTranslation('TMPL_FIELD_BTN_ENABLED', currentLanguage)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    {showButtonDetails && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {buttonFields
                                                .filter((field) => field.settingsKey !== 'btnEnabled')
                                                .map((field) => renderAdminField(field))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {miscContentFields.map((field) => renderAdminField(field))}
                        </div>
                    </div>
                )}
                {activeTab === 'IMAGE' && supportsImageTab && imageTabEnabled && (
                    <div className="pt-6 w-full space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className={`${EDITOR_SECTION_CARD} p-6 md:p-8 space-y-6`}>
                            <h4 className={EDITOR_SECTION_HEADER}>
                                {getTranslation('TAB_IMAGE_INFO', currentLanguage)}
                            </h4>
                            {imageTabFields.map((field) => renderAdminField(field))}
                        </div>
                    </div>
                )}
                {activeTab === 'SETTINGS' && showSettingsTab && settingsPanel}
                {activeTab === 'TRANSLATION' && showTranslationTab && translationFields.length > 0 && (
                    <UebersetzungTab
                        data={data}
                        onUpdate={(key, value) => updateContentTranslation(key, value)}
                        targetLanguages={optionalTranslationLanguages}
                        fields={translationFields}
                    />
                )}
            </div>
        </div>
    );
};


export const SectionCustomizationEditor = ({
    settings,
    onChange,
    currentLanguage,
    showSectionBackground = false
}: {
    settings: any;
    onChange: (key: string, val: any) => void;
    currentLanguage: LanguageCode;
    showSectionBackground?: boolean;
}) => {
    const spacingTopValue = settings.spacingTop !== undefined ? settings.spacingTop : DEFAULT_SECTION_SPACING_PX;
    const spacingBottomValue = settings.spacingBottom !== undefined ? settings.spacingBottom : DEFAULT_SECTION_SPACING_PX;
    const resolvedBgType = settings.bgType || 'none';
    const resolvedBgColor = settings.bgColor || '#ffffff';

    return (
        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
            <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 uppercase text-xs tracking-wider">
                {currentLanguage === 'de' ? 'Abschnitts-Anpassung' : 'Section Customization'}
            </h4>
            <div className={showSectionBackground ? "grid grid-cols-3 gap-6 max-w-3xl items-start" : "grid grid-cols-2 gap-6 max-w-xl items-start"}>
                {showSectionBackground && (
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase">
                            {getTranslation('LABEL_SECTION_BACKGROUND', currentLanguage)}
                        </label>
                        <select
                            className="w-full border p-2 text-sm rounded-sm bg-white mb-2"
                            value={resolvedBgType}
                            onChange={(e) => onChange('bgType', e.target.value)}
                        >
                            <option value="none">{getTranslation('LABEL_NONE', currentLanguage)}</option>
                            <option value="site-color">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                            <option value="color">
                                {currentLanguage === 'de' ? 'Benutzerdefinierte Hintergrundfarbe' :
                                    currentLanguage === 'fr' ? 'Couleur d’arrière-plan personnalisée' :
                                        currentLanguage === 'es' ? 'Color de fondo personalizado' :
                                            'Custom Background Color'}
                            </option>
                        </select>
                        {resolvedBgType === 'color' && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                <ColorPicker value={resolvedBgColor} onChange={(v) => onChange('bgColor', v)} />
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase">
                        {currentLanguage === 'de' ? 'Abschnitts-Abstand oben' :
                            currentLanguage === 'fr' ? 'Espacement haut de section' :
                                currentLanguage === 'es' ? 'Espaciado superior de sección' :
                                    'Section Top Spacing'}
                    </label>
                    <div className="flex items-center border rounded-sm overflow-hidden bg-white">
                        <input
                            type="number"
                            min={0}
                            max={300}
                            className="flex-1 p-2 text-sm outline-none"
                            value={spacingTopValue}
                            onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : 0;
                                onChange('spacingTop', val);
                            }}
                        />
                        <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l h-full flex items-center">px</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase">
                        {currentLanguage === 'de' ? 'Abschnitts-Abstand unten' :
                            currentLanguage === 'fr' ? 'Espacement bas de section' :
                                currentLanguage === 'es' ? 'Espaciado inferior de sección' :
                                    'Section Bottom Spacing'}
                    </label>
                    <div className="flex items-center border rounded-sm overflow-hidden bg-white">
                        <input
                            type="number"
                            min={0}
                            max={300}
                            className="flex-1 p-2 text-sm outline-none"
                            value={spacingBottomValue}
                            onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : 0;
                                onChange('spacingBottom', val);
                            }}
                        />
                        <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l h-full flex items-center">px</span>
                    </div>
                </div>
            </div>
        </div>
    );
};


const ColorPicker = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
    const committed = value || '#000000';
    const swatchValue = toColorInputValue(committed);
    const [textValue, setTextValue] = useState(committed);

    useEffect(() => {
        setTextValue(committed);
    }, [committed]);

    return (
        <div className="flex items-center gap-2 w-full">
            <div className="relative w-10 h-10 rounded-sm overflow-hidden border border-gray-300 bg-white shadow-sm flex-shrink-0">
                <input
                    type="color"
                    value={swatchValue}
                    onChange={(e) => {
                        const next = e.target.value.toUpperCase();
                        onChange(next);
                        setTextValue(next);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-full h-full" style={{ backgroundColor: swatchValue }} />
            </div>
            <input
                type="text"
                value={textValue}
                onChange={(e) => {
                    const next = normalizeHexColorInput(e.target.value);
                    setTextValue(next);
                    if (isValidHexColor(next)) onChange(next);
                }}
                onBlur={() => {
                    if (isValidHexColor(textValue)) {
                        const finalValue = normalizeHexColorInput(textValue);
                        onChange(finalValue);
                        setTextValue(finalValue);
                    } else {
                        setTextValue(swatchValue);
                    }
                }}
                className="flex-1 h-10 border border-gray-300 px-3 text-sm rounded-sm font-mono uppercase outline-none bg-white text-gray-900 focus:ring-1 focus:ring-[var(--primary-color)]"
                placeholder="#HEX"
                spellCheck={false}
            />
        </div>
    );
};

/** Normalize image URLs so gallery paths match saved container bgImage (relative vs absolute, query strings). */
const normalizeImageUrlKey = (url: string): string => {
    const raw = decodeURIComponent(String(url || '').trim().split('?')[0].split('#')[0]);
    if (!raw) return '';
    try {
        if (raw.startsWith('http://') || raw.startsWith('https://')) {
            return new URL(raw).pathname.toLowerCase();
        }
        return (raw.startsWith('/') ? raw : `/${raw}`).toLowerCase();
    } catch {
        return raw.toLowerCase();
    }
};

const findImageByUrl = (gallery: ImageItem[], url: string): ImageItem | undefined => {
    if (!url) return undefined;
    const key = normalizeImageUrlKey(url);
    if (!key) return undefined;
    return gallery.find((img) => normalizeImageUrlKey(img.url || '') === key);
};

const ImagePicker = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
    const [imgTab, setImgTab] = useState<'COPY' | 'UPLOAD' | 'CHOOSE'>('COPY');
    const [searchImg, setSearchImg] = useState('');
    const [imageName, setImageName] = useState('');
    const [showImageEditor, setShowImageEditor] = useState(false);
    const { images, uploadImage, currentLanguage } = useStore();
    const imageUpload = useOptimizedImageUpload(uploadImage);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pasteAreaRef = useRef<HTMLDivElement>(null);

    const selectedImage = useMemo(
        () => findImageByUrl(images, value),
        [images, value]
    );

    const displayImageName = imageName || selectedImage?.name || value.split('/').pop()?.split('?')[0] || '';

    const filteredGallery = useMemo(
        () => images.filter(img => (img.name || '').toLowerCase().includes(searchImg.toLowerCase())),
        [images, searchImg]
    );

    const handleDefaultImage = () => {
        const resolvedDefault = resolveGalleryDefaultImage(images);
        if (resolvedDefault) {
            onChange(resolvedDefault.url);
            setImageName(resolvedDefault.name);
        } else {
            onChange(getGlobalDefaultImage());
            setImageName('');
        }
    };

    const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of Array.from(items)) {
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                if (blob) {
                    e.preventDefault();
                    const uploadedImage = await imageUpload.uploadBlob(blob, 'Pictures');
                    if (uploadedImage) {
                        onChange((uploadedImage as { url: string }).url);
                        setImageName((uploadedImage as { name: string }).name);
                    }
                }
            }
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const uploadedImage = await imageUpload.uploadFile(file, 'Pictures');
        if (uploadedImage) {
            onChange((uploadedImage as { url: string }).url);
            setImageName((uploadedImage as { name: string }).name);
        }
    };

    const handleGallerySelect = (img: ImageItem) => {
        onChange(img.url);
        setImageName(img.name || '');
    };

    const handleClearImage = () => {
        onChange('');
        setImageName('');
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-6 items-start">
                <div className="w-32 h-32 bg-gray-100 border border-gray-300 flex items-center justify-center relative overflow-hidden flex-shrink-0">
                    <img
                        src={value || ''}
                        alt="Current"
                        className="w-full h-full object-cover"
                        style={{ display: value ? 'block' : 'none' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    {!value && <ImageIcon className="w-8 h-8 text-gray-300" />}
                </div>
                <div className="flex-1 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_IMAGE_URL', currentLanguage)}</label>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 border border-gray-300 p-2 text-sm text-gray-600 rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                value={value || ''}
                                onChange={e => onChange(e.target.value)}
                                placeholder={getTranslation('PLACEHOLDER_URL_GENERIC', currentLanguage)}
                            />
                            <button
                                type="button"
                                onClick={handleDefaultImage}
                                className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-sm hover:bg-gray-200 transition-colors"
                            >
                                {getTranslation('BTN_DEFAULT_IMAGE', currentLanguage)}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_IMAGE_NAME', currentLanguage)}</label>
                        <input
                            className="w-full border border-gray-300 p-2 text-sm rounded-sm"
                            value={displayImageName}
                            onChange={e => setImageName(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        {value && (
                            <button
                                type="button"
                                onClick={() => setShowImageEditor(true)}
                                className="text-xs text-[var(--primary-color)] hover:underline inline-flex items-center gap-1"
                            >
                                <Pencil className="w-3 h-3" />
                                {getTranslation('BTN_EDIT', currentLanguage) || 'Edit Image'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleClearImage}
                            className="text-xs text-[var(--primary-color)] hover:underline flex items-center gap-1"
                        >
                            <X className="w-3 h-3" /> {getTranslation('BTN_CLEAR_IMAGE', currentLanguage)}
                        </button>
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
                <div className="flex gap-6 border-b border-gray-200 mb-4">
                    {['COPY & PASTE', 'UPLOAD', 'CHOOSE FROM EXISTING'].map(sub => (
                        <button
                            key={sub}
                            type="button"
                            onClick={() => setImgTab(sub.split(' ')[0] as 'COPY' | 'UPLOAD' | 'CHOOSE')}
                            className={`pb-2 text-xs font-bold uppercase transition-colors ${imgTab === sub.split(' ')[0] ? 'border-b-2 border-[var(--primary-color)] text-[var(--primary-color)]' : 'text-gray-500'}`}
                        >
                            {sub === 'COPY & PASTE' ? getTranslation('TAB_COPY_PASTE', currentLanguage) :
                                sub === 'UPLOAD' ? getTranslation('TAB_UPLOAD_UPPER', currentLanguage) :
                                    `${getTranslation('TAB_CHOOSE_EXISTING', currentLanguage)} (${images.length})`}
                        </button>
                    ))}
                </div>

                {imgTab === 'COPY' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_IMAGE_NAME', currentLanguage)}</label>
                            <input
                                className="w-full border border-gray-300 p-2 text-sm rounded-sm"
                                value={displayImageName}
                                onChange={e => setImageName(e.target.value)}
                            />
                        </div>
                        <div
                            ref={pasteAreaRef}
                            onPaste={(e) => { handlePaste(e).catch(console.error); }}
                            className="h-32 border-2 border-dashed border-[var(--primary-color)] bg-blue-50 flex flex-col items-center justify-center text-gray-400 text-sm cursor-pointer hover:bg-blue-100 transition-colors"
                            onClick={() => pasteAreaRef.current?.focus()}
                            tabIndex={0}
                        >
                            <Copy className="w-6 h-6 mb-2 text-[var(--primary-color)] opacity-50" />
                            <span className="font-bold text-[var(--primary-color)]">{getTranslation('MSG_CLICK_PASTE_IMAGE', currentLanguage)}</span>
                        </div>
                    </div>
                )}

                {imgTab === 'UPLOAD' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_IMAGE_NAME', currentLanguage)}</label>
                            <input
                                className="w-full border border-gray-300 p-2 text-sm rounded-sm"
                                value={displayImageName}
                                onChange={e => setImageName(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className={`bg-[var(--btn-primary-bg)] text-white px-4 py-2 text-sm font-bold shadow-sm cursor-pointer hover:opacity-90 rounded-sm flex items-center gap-2 ${imageUpload.isBusy ? 'opacity-50 cursor-wait' : ''}`}
                                disabled={imageUpload.isBusy}
                            >
                                <Upload className="w-4 h-4" /> {imageUpload.isBusy ? (imageUpload.isOptimizing ? 'Optimizing…' : 'Uploading...') : 'Upload Image'}
                            </button>
                            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { handleUpload(e).catch(console.error); }} accept="image/*" disabled={imageUpload.isBusy} />
                            <ImageOptimizationFeedback stats={imageUpload.stats} isProcessing={imageUpload.isOptimizing} />
                        </div>
                    </div>
                )}

                {imgTab === 'CHOOSE' && (
                    <div className="flex flex-col h-full">
                        <div className="relative mb-4 shrink-0">
                            <input
                                className="w-full border border-gray-300 py-2 pl-8 pr-8 text-sm rounded-sm focus:outline-none focus:border-[var(--primary-color)]"
                                placeholder={getTranslation('PLACEHOLDER_SEARCH_IMAGES', currentLanguage)}
                                value={searchImg}
                                onChange={e => setSearchImg(e.target.value)}
                            />
                            <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                            {searchImg && (
                                <button
                                    type="button"
                                    onClick={() => setSearchImg('')}
                                    className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                                    title="Clear search"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[400px] border border-gray-100 bg-gray-50/50 p-2 rounded-sm content-start">
                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 auto-rows-min">
                                {filteredGallery.map(img => (
                                    <div
                                        key={img.id}
                                        onClick={() => handleGallerySelect(img)}
                                        className={`
                                            relative aspect-square cursor-pointer overflow-hidden rounded-sm border-2 transition-all group bg-white shadow-sm
                                            ${value === img.url
                                                ? 'border-[var(--primary-color)] ring-2 ring-[var(--primary-color)] ring-opacity-20 z-10'
                                                : 'border-transparent hover:border-blue-300 hover:shadow-md'}
                                        `}
                                    >
                                        <img
                                            src={img.url}
                                            alt={img.name}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                        {!img.url && <div className="absolute inset-0 flex items-center justify-center bg-gray-100"><ImageIcon className="w-6 h-6 text-gray-300" /></div>}

                                        {value === img.url && (
                                            <div className="absolute top-1 right-1 bg-[var(--btn-primary-bg)] text-white rounded-none p-0.5 shadow-md z-20">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        )}

                                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] p-1.5 truncate text-center z-10">
                                            {img.name}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {filteredGallery.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
                                    <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                                    <span className="text-xs">{getTranslation('MSG_NO_LIB_IMAGES', currentLanguage)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <ManagedImageEditorBridge
                imageUrl={value || ''}
                imageName={displayImageName}
                isOpen={showImageEditor}
                onClose={() => setShowImageEditor(false)}
                onSaved={(url, name) => {
                    onChange(url);
                    setImageName(name);
                }}
            />
        </div>
    );
};

type UebersetzungField = {
    key: string;
    label: string;
    type: 'input' | 'textarea' | 'rich';
    getValue?: (lang: string) => string;
    onChange?: (value: string, lang: LanguageCode) => void;
};

const UebersetzungTab = ({
    data,
    onUpdate,
    fields,
    targetLanguages,
}: {
    data: Container;
    onUpdate: (key: string, value: string, lang?: LanguageCode) => void;
    fields: UebersetzungField[];
    targetLanguages?: LanguageCode[];
}) => {
    const { currentLanguage, siteConfig } = useStore();
    const languages = useMemo(() => {
        const configured = targetLanguages && targetLanguages.length > 0
            ? targetLanguages
            : getOptionalEnabledLanguages(siteConfig);
        return configured.length > 0 ? configured : (['de'] as LanguageCode[]);
    }, [targetLanguages, siteConfig?.languages]);
    const [activeLanguage, setActiveLanguage] = useState<LanguageCode>(languages[0]);
    const [isTranslating, setIsTranslating] = useState(false);

    useEffect(() => {
        if (!languages.includes(activeLanguage)) {
            setActiveLanguage(languages[0]);
        }
    }, [languages, activeLanguage]);

    const getDefaultValue = (key: string, lang: string) => {
        const item = data.content[key];
        if (!item) return '';
        return getExactLanguageText(item, lang as LanguageCode);
    };

    const getFieldValue = (field: UebersetzungField, lang: string) => {
        if (field.getValue) return field.getValue(lang);
        return getDefaultValue(field.key, lang);
    };

    const setFieldValue = (field: UebersetzungField, value: string, lang: LanguageCode) => {
        if (field.onChange) {
            field.onChange(value, lang);
            return;
        }
        onUpdate(field.key, value, lang);
    };

    const handleSuggestAI = async () => {
        setIsTranslating(true);
        try {
            for (const field of fields) {
                const originalVal = getFieldValue(field, 'en');
                if (originalVal) {
                    const translated = await translateText(originalVal, activeLanguage);
                    if (translated) {
                        setFieldValue(field, translated, activeLanguage);
                    }
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsTranslating(false);
        }
    };

    const activeLanguageLabel = LANGUAGE_DISPLAY_NAMES[activeLanguage] || activeLanguage.toUpperCase();

    return (
        <div className="flex flex-col h-full bg-white animate-in fade-in duration-300">
            <div className="flex justify-between items-center py-4 border-b border-gray-200 bg-gray-50/50 px-4 gap-4">
                <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-4 h-4 text-[var(--primary-color)] shrink-0" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{getTranslation('LABEL_TRANSLATION_MANAGER', currentLanguage)}</span>
                </div>
                {languages.length > 1 && (
                    <div className="flex flex-wrap gap-1 justify-end">
                        {languages.map((lang) => (
                            <button
                                key={lang}
                                type="button"
                                onClick={() => setActiveLanguage(lang)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-sm border transition-colors ${activeLanguage === lang
                                    ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)]'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                {LANGUAGE_DISPLAY_NAMES[lang] || lang.toUpperCase()}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/2 bg-gray-50 border-r border-gray-200 p-8 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-6"><div className="w-2 h-2 rounded-none bg-gray-400"></div><h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{getTranslation('LABEL_ORIGINAL_ENGLISH', currentLanguage)}</h4></div>
                    <div className="space-y-6">
                        {fields.map(field => (
                            <div key={`orig_${field.key}`}>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">{field.label}</label>
                                {field.type === 'rich' ? (
                                    <div className="w-full p-3 bg-gray-100 border border-gray-200 rounded-sm text-sm text-gray-600 min-h-[100px]">
                                        <div className="text-sm" dangerouslySetInnerHTML={{ __html: getFieldValue(field, 'en') || '' }}></div>
                                    </div>
                                ) : field.type === 'textarea' ? (
                                    <div className="w-full p-3 bg-gray-100 border border-gray-200 rounded-sm text-sm text-gray-600 min-h-[100px] whitespace-pre-wrap select-text">{getFieldValue(field, 'en') || <span className="opacity-50">{getTranslation('LABEL_EMPTY', currentLanguage)}</span>}</div>
                                ) : (
                                    <div className="w-full p-3 bg-gray-100 border border-gray-200 rounded-sm text-sm text-gray-600 select-text">{getFieldValue(field, 'en') || <span className="opacity-50">{getTranslation('LABEL_EMPTY', currentLanguage)}</span>}</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="w-1/2 bg-white p-8 overflow-y-auto relative">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2 mb-6"><div className="w-2 h-2 rounded-none bg-[var(--primary-color)]"></div><h4 className="text-xs font-bold text-[var(--primary-color)] uppercase tracking-wider">{getTranslation('LABEL_TRANSLATED', currentLanguage)} ({activeLanguageLabel})</h4></div>
                        <button onClick={handleSuggestAI} disabled={isTranslating} className={`text-[var(--primary-color)] text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50 px-3 py-1.5 rounded-sm transition-colors border border-transparent hover:border-blue-100 ${isTranslating ? 'opacity-50 cursor-wait' : ''}`}>
                            <Wand2 className={`w-3 h-3 ${isTranslating ? 'animate-pulse' : ''}`} /> {isTranslating ? 'Translating...' : getTranslation('LABEL_SUGGEST_WITH_AI', currentLanguage)}
                        </button>
                    </div>
                    <div className="space-y-6">
                        {fields.map(field => (
                            <div key={`trans_${field.key}_${activeLanguage}`}>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">{getTranslation('LABEL_TRANSLATED', currentLanguage)} {field.label}</label>
                                {field.type === 'rich' ? (
                                    <JoditRichTextEditor
                                        value={getFieldValue(field, activeLanguage)}
                                        onChange={(val: string) => setFieldValue(field, val, activeLanguage)}
                                        placeholder={`Enter ${field.label} translation...`}
                                        height={150}
                                    />
                                ) : field.type === 'textarea' ? (
                                    <textarea className="w-full p-3 border border-gray-300 rounded-sm text-sm text-gray-800 focus:ring-1 focus:ring-[var(--primary-color)] outline-none min-h-[100px] resize-y placeholder:text-gray-300" value={getFieldValue(field, activeLanguage)} onChange={(e) => setFieldValue(field, e.target.value, activeLanguage)} placeholder={`Enter ${field.label} translation...`} />
                                ) : (
                                    <input className="w-full p-3 border border-gray-300 rounded-sm text-sm text-gray-800 focus:ring-1 focus:ring-[var(--primary-color)] outline-none placeholder:text-gray-300" value={getFieldValue(field, activeLanguage)} onChange={(e) => setFieldValue(field, e.target.value, activeLanguage)} placeholder={`Enter ${field.label} translation...`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const HERO_LINE_HEIGHT_PX_OPTIONS = Array.from({ length: 100 }, (_, i) => i + 1);

const HeroTypographyStyleColumn = ({
    role,
    styleLabelKey,
    customSectionLabelKey,
    settings,
    updateSetting,
    currentLanguage,
}: {
    role: HeroTypographyRole;
    styleLabelKey: string;
    customSectionLabelKey: string;
    settings: Record<string, any>;
    updateSetting: (key: string, val: any) => void;
    currentLanguage: LanguageCode;
}) => {
    const styleSettingKey = getHeroTypographyStyleSettingKey(role);
    const customKeys = getHeroTypographyCustomKeys(role);
    const storedStyle = settings[styleSettingKey];
    const inferredStyle = inferHeroTypographyStyle(settings, role);

    const [activeStyle, setActiveStyle] = useState<HeroTypographyStylePreset>(() =>
        isHeroTypographyStylePreset(storedStyle) ? storedStyle : inferredStyle
    );

    useEffect(() => {
        if (isHeroTypographyStylePreset(storedStyle)) {
            setActiveStyle(storedStyle);
        }
    }, [storedStyle]);

    const showCustomPanel = activeStyle === 'custom';

    const lineHeightRaw = settings[customKeys.lineHeight];
    const lineHeightPx = (() => {
        if (lineHeightRaw === '' || lineHeightRaw == null || lineHeightRaw === 'auto') return null;
        const n = Number(String(lineHeightRaw).replace(/px$/i, ''));
        return Number.isFinite(n) && n >= 1 && n <= 100 ? n : null;
    })();
    const lineHeightSelectValue = lineHeightPx == null ? 'auto' : String(lineHeightPx);

    const setStyle = (style: HeroTypographyStylePreset) => {
        setActiveStyle(style);
        updateSetting(styleSettingKey, style);
    };

    return (
        <div className="min-w-0">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                {getTranslation(styleLabelKey, currentLanguage)}
            </label>
            <select
                className="w-full border p-2 text-sm rounded-sm bg-white"
                value={activeStyle}
                onChange={(e) => setStyle(e.target.value as HeroTypographyStylePreset)}
            >
                {HERO_TYPOGRAPHY_STYLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {getTranslation(opt.labelKey, currentLanguage)}
                    </option>
                ))}
            </select>

            {showCustomPanel && (
                <div className="mt-3 p-3 border border-gray-200 rounded-sm bg-white space-y-3 animate-in fade-in duration-200">
                    <label className="block text-xs font-normal uppercase tracking-wide text-[var(--primary-color)]">
                        {getTranslation(customSectionLabelKey, currentLanguage)}
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                                {getTranslation('LABEL_FONT_SIZE', currentLanguage)}
                            </label>
                            <div className="flex items-center border rounded-sm overflow-hidden bg-white">
                                <input
                                    type="number"
                                    min={8}
                                    max={120}
                                    className="flex-1 p-2 text-sm outline-none"
                                    value={settings[customKeys.fontSize] ?? ''}
                                    placeholder="e.g. 45"
                                    onChange={(e) => updateSetting(customKeys.fontSize, e.target.value ? Number(e.target.value) : '')}
                                />
                                <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l h-full flex items-center">px</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                                {getTranslation('LABEL_FONT_WEIGHT', currentLanguage)}
                            </label>
                            <FontWeightSelect
                                value={settings[customKeys.fontWeight]}
                                defaultValue="400"
                                currentLanguage={currentLanguage}
                                className="w-full border p-2 text-sm rounded-sm bg-white"
                                includeEmptyOption
                                emptyOptionLabel="—"
                                onChange={(value) => updateSetting(customKeys.fontWeight, value ? Number(value) : '')}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                                {getTranslation('LABEL_LINE_HEIGHT', currentLanguage)}
                            </label>
                            <select
                                className="w-full border p-2 text-sm rounded-sm bg-white"
                                value={lineHeightSelectValue}
                                onChange={(e) => {
                                    if (e.target.value === 'auto') {
                                        updateSetting(customKeys.lineHeight, '');
                                    } else {
                                        updateSetting(customKeys.lineHeight, Number(e.target.value));
                                    }
                                }}
                            >
                                <option value="auto">{getTranslation('LABEL_LINE_HEIGHT_AUTO', currentLanguage)}</option>
                                {HERO_LINE_HEIGHT_PX_OPTIONS.map((px) => (
                                    <option key={px} value={px}>{px}px</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- 1. HEADER / HERO EDITOR ---
const HeroSiteAdminSettingsPanel: React.FC<{
    data: Container;
    setData: React.Dispatch<React.SetStateAction<Container>>;
    currentLanguage: LanguageCode;
    permitSettings: (settingsPath: string) => boolean;
}> = ({ data, setData, currentLanguage, permitSettings }) => {
    const showHeroDesign = permitSettings('bgType') || permitSettings('heroHeightMode') || permitSettings('layoutVariant');
    const showTypography = permitSettings('titleColor') || permitSettings('align') || permitSettings('letterCase');

    const updateSetting = (key: string, val: unknown) => {
        setData((prev) => ({ ...prev, settings: { ...prev.settings, [key]: val } }));
    };

    const updateHeroDesign = (bgType: string) => {
        const templateId =
            bgType === 'color' ? 'color_header'
                : bgType === 'image' ? 'hero_img'
                    : bgType === 'layout' ? 'visual_text'
                        : 'page_content';
        setData((prev) => ({
            ...prev,
            settings: { ...prev.settings, bgType, templateId },
        }));
    };

    const updateHeroTitleColor = (preset: string, customHex?: string) => {
        setData((prev) => ({
            ...prev,
            settings: { ...prev.settings, ...buildHeroTitleColorPatch(preset, customHex, prev.settings) },
        }));
    };
    const updateHeroSubtitleColor = (preset: string, customHex?: string) => {
        setData((prev) => ({
            ...prev,
            settings: { ...prev.settings, ...buildHeroSubtitleColorPatch(preset, customHex, prev.settings) },
        }));
    };
    const updateHeroDescriptionColor = (preset: string, customHex?: string) => {
        setData((prev) => ({
            ...prev,
            settings: { ...prev.settings, ...buildHeroDescriptionColorPatch(preset, customHex, prev.settings) },
        }));
    };

    const heroTitleColorSetting = getHeroTitleColorSetting(data.settings);
    const heroTitleCustomColor = getHeroTitleCustomColor(data.settings);
    const heroSubtitleColorSetting = getHeroSubtitleColorSetting(data.settings);
    const heroSubtitleCustomColor = getHeroSubtitleCustomColor(data.settings);
    const heroDescriptionColorSetting = getHeroDescriptionColorSetting(data.settings);
    const heroDescriptionCustomColor = getHeroDescriptionCustomColor(data.settings);
    const defaultHeroLetterCase =
        data.settings.templateId === 'page_content' ? 'sentence' : 'uppercase';
    const defaultHeroHeightRaw = String(data.settings.heroDefaultHeight || '600').trim();
    const defaultHeroHeightLabel = /[a-z%]/i.test(defaultHeroHeightRaw) ? defaultHeroHeightRaw : `${defaultHeroHeightRaw}px`;

    if (!showHeroDesign && !showTypography) {
        return null;
    }

    return (
        <div className="pt-6 w-full space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {showHeroDesign && (
                <div className={`${EDITOR_SECTION_CARD} p-6 md:p-8 space-y-6`}>
                    <h4 className={EDITOR_SECTION_HEADER}>{getTranslation('LABEL_TEMPLATE_DESIGN', currentLanguage)}</h4>
                    <div className="flex flex-wrap gap-4 mb-4">
                        <VisualOption label={getTranslation('HERO_TMPL_TEXT_HEADER', currentLanguage)} active={data.settings.bgType === 'none'} onClick={() => updateHeroDesign('none')} />
                        <VisualOption label={getTranslation('HERO_TMPL_COLOR_BG', currentLanguage)} active={data.settings.bgType === 'color'} onClick={() => updateHeroDesign('color')} />
                        <VisualOption label={getTranslation('HERO_TMPL_IMAGE_BG', currentLanguage)} active={data.settings.bgType === 'image'} onClick={() => updateHeroDesign('image')} />
                        <VisualOption label={getTranslation('HERO_TMPL_IMAGE_TEXT', currentLanguage)} active={data.settings.bgType === 'layout'} onClick={() => updateHeroDesign('layout')} />
                    </div>

                    {data.settings.bgType === 'layout' && permitSettings('layoutVariant') && (
                        <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                            <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 uppercase text-xs tracking-wider">{getTranslation('HERO_TMPL_IMAGE_TEXT', currentLanguage)}</h4>
                            <div className="flex flex-wrap gap-4">
                                <VisualOption
                                    label={getTranslation('LABEL_IMG_LEFT_TEXT_RIGHT', currentLanguage)}
                                    active={data.settings.layoutVariant === 'img_left'}
                                    onClick={() => updateSetting('layoutVariant', 'img_left')}
                                    icon={() => (
                                        <div className="flex w-full h-8 border border-gray-300 rounded-sm overflow-hidden">
                                            <div className="w-1/2 bg-[var(--primary-color)] opacity-50" />
                                            <div className="w-1/2 bg-gray-100" />
                                        </div>
                                    )}
                                />
                                <VisualOption
                                    label={getTranslation('LABEL_TEXT_LEFT_IMG_RIGHT', currentLanguage)}
                                    active={data.settings.layoutVariant === 'img_right'}
                                    onClick={() => updateSetting('layoutVariant', 'img_right')}
                                    icon={() => (
                                        <div className="flex w-full h-8 border border-gray-300 rounded-sm overflow-hidden">
                                            <div className="w-1/2 bg-gray-100" />
                                            <div className="w-1/2 bg-[var(--primary-color)] opacity-50" />
                                        </div>
                                    )}
                                />
                            </div>
                        </div>
                    )}

                    {data.settings.bgType === 'color' && permitSettings('bgColor') && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-sm">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_BACKGROUND_COLOR', currentLanguage)}</label>
                            <ColorPicker value={String(data.settings.bgColor || '#ffffff')} onChange={(v) => updateSetting('bgColor', v)} />
                        </div>
                    )}

                    {(data.settings.bgType === 'image' || data.settings.bgType === 'layout') && permitSettings('bgImage') && (
                        <div className="mt-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_IMAGE', currentLanguage)}</label>
                            <ImagePicker value={String(data.settings.bgImage || '')} onChange={(v) => updateSetting('bgImage', v)} />
                        </div>
                    )}

                    {(data.settings.bgType === 'image' || data.settings.bgType === 'layout') && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <SliderImageRadiusEditor
                                imageSettings={parseSliderImageSettings(data.settings.imageSettings)}
                                currentLanguage={currentLanguage}
                                onChange={(imageSettings) => updateSetting('imageSettings', imageSettings)}
                            />
                        </div>
                    )}

                    {data.settings.bgType === 'image' && (permitSettings('heroOverlayColor') || permitSettings('heroOverlayOpacity')) && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-sm">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-3">
                                {getTranslation('LABEL_HERO_IMAGE_OVERLAY', currentLanguage)}
                            </label>
                            <div className="grid grid-cols-2 gap-6 items-end">
                                {permitSettings('heroOverlayColor') && (
                                    <div className="min-w-0">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                            {getTranslation('LABEL_OVERLAY_COLOR', currentLanguage)}
                                        </label>
                                        <ColorPicker
                                            value={String(data.settings.heroOverlayColor || DEFAULT_HERO_OVERLAY_COLOR)}
                                            onChange={(v) => updateSetting('heroOverlayColor', v)}
                                        />
                                    </div>
                                )}
                                {permitSettings('heroOverlayOpacity') && (
                                    <div className="min-w-0">
                                        <div className="flex justify-between text-xs text-gray-500 mb-2">
                                            <span className="font-bold uppercase">{getTranslation('LABEL_OPACITY', currentLanguage)}</span>
                                            <span>{parseHeroOverlayOpacity(data.settings.heroOverlayOpacity).toFixed(2)}</span>
                                        </div>
                                        <div className="h-10 flex items-center">
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.01"
                                                value={parseHeroOverlayOpacity(data.settings.heroOverlayOpacity)}
                                                onChange={(e) => updateSetting('heroOverlayOpacity', parseFloat(e.target.value))}
                                                className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {permitSettings('heroHeightMode') && (
                        <div className="mt-6 p-4 bg-gray-50 rounded-sm">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-3">{getTranslation('LABEL_HERO_IMAGE_HEIGHT', currentLanguage)}</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button type="button" onClick={() => updateSetting('heroHeightMode', 'default')} className={`py-2 text-xs font-bold border rounded-sm transition-colors ${(data.settings.heroHeightMode || 'default') === 'default' ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                                    {`Default (${defaultHeroHeightLabel})`}
                                </button>
                                <button type="button" onClick={() => updateSetting('heroHeightMode', 'full')} className={`py-2 text-xs font-bold border rounded-sm transition-colors ${(data.settings.heroHeightMode || 'default') === 'full' ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                                    {getTranslation('LABEL_FULL_SCREEN_MINUS_NAV', currentLanguage)}
                                </button>
                                <button type="button" onClick={() => updateSetting('heroHeightMode', 'custom')} className={`py-2 text-xs font-bold border rounded-sm transition-colors ${(data.settings.heroHeightMode || 'default') === 'custom' ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                                    Custom
                                </button>
                            </div>
                            {(data.settings.heroHeightMode || 'default') === 'custom' && permitSettings('heroCustomHeight') && (
                                <div className="mt-3">
                                    <input type="text" className="w-full border p-2 text-sm rounded-sm bg-white" placeholder={getTranslation('PLACEHOLDER_HERO_CUSTOM_HEIGHT', currentLanguage)} value={String(data.settings.heroCustomHeight || '')} onChange={(e) => updateSetting('heroCustomHeight', e.target.value)} />
                                    <p className="mt-1 text-[11px] text-gray-500">{getTranslation('MSG_HERO_HEIGHT_HELPER', currentLanguage)}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {showTypography && (
                <div className={`${EDITOR_SECTION_CARD} p-6 md:p-8 space-y-6`}>
                    <h4 className={EDITOR_SECTION_HEADER}>{getTranslation('LABEL_TYPOGRAPHY', currentLanguage)}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        {permitSettings('titleColor') && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_HEADING_COLOR', currentLanguage)}</label>
                                <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={heroTitleColorSetting} onChange={(e) => updateHeroTitleColor(e.target.value)}>
                                    <option value="site">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                    <option value="black">{getTranslation('LABEL_BLACK', currentLanguage)}</option>
                                    <option value="white">{getTranslation('LABEL_WHITE', currentLanguage)}</option>
                                    <option value="custom">{getTranslation('LABEL_CUSTOM_COLOR', currentLanguage)}</option>
                                </select>
                                {heroTitleColorSetting === 'custom' && (
                                    <ColorPicker value={heroTitleCustomColor} onChange={(v) => updateHeroTitleColor('custom', v)} />
                                )}
                            </div>
                        )}
                        {permitSettings('subtitleColor') && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_SUBHEADING_COLOR', currentLanguage)}</label>
                                <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={heroSubtitleColorSetting} onChange={(e) => updateHeroSubtitleColor(e.target.value)}>
                                    <option value="site">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                    <option value="black">{getTranslation('LABEL_BLACK', currentLanguage)}</option>
                                    <option value="white">{getTranslation('LABEL_WHITE', currentLanguage)}</option>
                                    <option value="custom">{getTranslation('LABEL_CUSTOM_COLOR', currentLanguage)}</option>
                                </select>
                                {heroSubtitleColorSetting === 'custom' && (
                                    <ColorPicker value={heroSubtitleCustomColor} onChange={(v) => updateHeroSubtitleColor('custom', v)} />
                                )}
                            </div>
                        )}
                        {permitSettings('descColor') && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_DESCRIPTION_COLOR', currentLanguage)}</label>
                                <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={heroDescriptionColorSetting} onChange={(e) => updateHeroDescriptionColor(e.target.value)}>
                                    {HERO_DESCRIPTION_COLOR_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{getTranslation(opt.labelKey, currentLanguage)}</option>
                                    ))}
                                </select>
                                {heroDescriptionColorSetting === 'custom' && (
                                    <ColorPicker value={heroDescriptionCustomColor} onChange={(v) => updateHeroDescriptionColor('custom', v)} />
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 items-start">
                        <HeroTypographyStyleColumn role="title" styleLabelKey="LABEL_HEADING_STYLE" customSectionLabelKey="LABEL_CUSTOM_HEADING_STYLE" settings={data.settings} updateSetting={updateSetting} currentLanguage={currentLanguage} />
                        <HeroTypographyStyleColumn role="subtitle" styleLabelKey="LABEL_SUBHEADING_STYLE" customSectionLabelKey="LABEL_CUSTOM_SUBHEADING_STYLE" settings={data.settings} updateSetting={updateSetting} currentLanguage={currentLanguage} />
                        <HeroTypographyStyleColumn role="description" styleLabelKey="LABEL_DESCRIPTION_STYLE" customSectionLabelKey="LABEL_CUSTOM_DESCRIPTION_STYLE" settings={data.settings} updateSetting={updateSetting} currentLanguage={currentLanguage} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {permitSettings('letterCase') && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_HEADING_LETTER_CASE', currentLanguage)}</label>
                                <select className="w-full border p-2 text-sm rounded-sm bg-white" value={String(data.settings.letterCase || defaultHeroLetterCase)} onChange={(e) => updateSetting('letterCase', e.target.value)}>
                                    <option value="uppercase">{getTranslation('LABEL_UPPERCASE', currentLanguage)}</option>
                                    <option value="lowercase">{getTranslation('LABEL_LOWERCASE', currentLanguage)}</option>
                                    <option value="sentence">{getTranslation('LABEL_SENTENCE_CASE', currentLanguage)}</option>
                                    <option value="title">{getTranslation('LABEL_TITLE_CASE', currentLanguage)}</option>
                                </select>
                            </div>
                        )}
                        {permitSettings('align') && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_CONTENT_ALIGNMENT', currentLanguage)}</label>
                                <div className="flex border rounded-sm overflow-hidden">
                                    {(['left', 'center', 'right'] as const).map((align) => (
                                        <button key={align} type="button" onClick={() => updateSetting('align', align)} className={`flex-1 py-2 flex justify-center ${data.settings.align === align ? 'bg-[var(--primary-color)] text-white' : 'bg-white hover:bg-gray-50'}`}>
                                            {align === 'left' ? <AlignLeft className="w-4 h-4" /> : (align === 'center' ? <AlignCenter className="w-4 h-4" /> : <AlignRight className="w-4 h-4" />)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const HeroEditor = ({ data, setData, onClose, editorAccess }: ContainerEditorChildProps) => {
    const [activeTab, setActiveTab] = useState<'CONTENT' | 'SETTINGS' | 'TRANSLATION'>('CONTENT');
    const isRestrictedEditor = !canShowFullContainerEditor(editorAccess.role, data.settings);
    const showTemplateDesignBanner = isRestrictedEditor && Boolean(data.settings?.sectionTemplateId);
    const effectiveEditableFields = useMemo(
        () => editorAccess.editableFields ?? [],
        [editorAccess.editableFields]
    );
    const permitSettings = (settingsPath: string) =>
        !isRestrictedEditor || isSettingsPathEditable(editorAccess.role, settingsPath, data.type, effectiveEditableFields);
    const permitField = (fieldKey: string) =>
        !isRestrictedEditor || isContentEditorFieldEditable(editorAccess.role, data.type, fieldKey, effectiveEditableFields);
    const fieldShell = (allowed: boolean) => (!allowed ? 'hidden' : '');
    const hasHeroSettingsAccess = isRestrictedEditor && editorAccess.role === 'site_admin' && (
        isSettingsGroupEditable('site_admin', 'heroDesign', data.type, effectiveEditableFields) ||
        isSettingsGroupEditable('site_admin', 'typography', data.type, effectiveEditableFields)
    );
    const showHeroSettingsTab = !isRestrictedEditor || hasHeroSettingsAccess;

    const { currentLanguage, pages, currentPageId, siteConfig } = useStore();
    const optionalTranslationLanguages = useMemo(
        () => getOptionalEnabledLanguages(siteConfig),
        [siteConfig?.languages]
    );
    const showTranslationTab = optionalTranslationLanguages.length > 0;

    // All containers on the current page, excluding this container itself
    const currentPage = pages.find(p => p.id === currentPageId);
    const siblingContainers = (currentPage?.containers || []).filter(c => c.id !== data.id);

    // Ensure bgType matches template design (org templates may only store templateId)
    useEffect(() => {
        const tid = data.settings.templateId as string | undefined;
        if (!data.settings.bgType) {
            if (tid === 'color_header') updateSetting('bgType', 'color');
            else if (tid === 'hero_img') updateSetting('bgType', 'image');
            else if (tid === 'visual_text') updateSetting('bgType', 'layout');
            else updateSetting('bgType', 'none');
        }
        if (!data.settings.heroHeightMode) {
            updateSetting('heroHeightMode', data.settings.minHeight === 'full' ? 'full' : 'default');
        }
    }, []);

    const heroTranslationTarget: LanguageCode = 'de';

    const updateContentSource = (key: string, val: string) => {
        // ✅ Use functional update to always read latest state and avoid stale closure overwrites during AI translation
        setData((prev: Container) => ({
            ...prev,
            content: { ...prev.content, [key]: { ...(prev.content[key] as any), [CONTENT_SOURCE_LANG]: val } }
        }));
    };

    const updateContentTranslation = (key: string, val: string, lang?: LanguageCode) => {
        const targetLang = lang || heroTranslationTarget;
        setData((prev: Container) => ({
            ...prev,
            content: { ...prev.content, [key]: { ...(prev.content[key] as any), [targetLang]: val } }
        }));
    };

    const updateSetting = (key: string, val: any) => {
        setData((prev: Container) => ({ ...prev, settings: { ...prev.settings, [key]: val } }));
    };

    const updateHeroDesign = (bgType: string) => {
        const templateId =
            bgType === 'color' ? 'color_header'
                : bgType === 'image' ? 'hero_img'
                    : bgType === 'layout' ? 'visual_text'
                        : 'page_content';
        setData((prev: Container) => ({
            ...prev,
            settings: { ...prev.settings, bgType, templateId },
        }));
    };

    const updateHeroTitleColor = (preset: string, customHex?: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: { ...prev.settings, ...buildHeroTitleColorPatch(preset, customHex, prev.settings) },
        }));
    };
    const updateHeroSubtitleColor = (preset: string, customHex?: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: { ...prev.settings, ...buildHeroSubtitleColorPatch(preset, customHex, prev.settings) },
        }));
    };
    const updateHeroDescriptionColor = (preset: string, customHex?: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: { ...prev.settings, ...buildHeroDescriptionColorPatch(preset, customHex, prev.settings) },
        }));
    };
    const heroTitleColorSetting = getHeroTitleColorSetting(data.settings);
    const heroTitleCustomColor = getHeroTitleCustomColor(data.settings);
    const heroSubtitleColorSetting = getHeroSubtitleColorSetting(data.settings);
    const heroSubtitleCustomColor = getHeroSubtitleCustomColor(data.settings);
    const heroDescriptionColorSetting = getHeroDescriptionColorSetting(data.settings);
    const heroDescriptionCustomColor = getHeroDescriptionCustomColor(data.settings);
    const defaultHeroLetterCase =
        data.settings.templateId === 'page_content' ? 'sentence' : 'uppercase';
    const defaultHeroHeightRaw = String(data.settings.heroDefaultHeight || '600').trim();
    const defaultHeroHeightLabel = /[a-z%]/i.test(defaultHeroHeightRaw) ? defaultHeroHeightRaw : `${defaultHeroHeightRaw}px`;

    return (
        <div className="flex flex-col h-full bg-white">
            {showTemplateDesignBanner && <TemplateLockedBanner className="mx-4 mt-4" />}
            <div className="flex border-b border-gray-200 bg-gray-50">
                <TabButton active={activeTab === 'CONTENT'} label={getTranslation('LABEL_MANAGE_CONTENT', currentLanguage)} onClick={() => setActiveTab('CONTENT')} />
                {showHeroSettingsTab && (
                    <TabButton active={activeTab === 'SETTINGS'} label={getTranslation('LABEL_SETTINGS', currentLanguage)} onClick={() => setActiveTab('SETTINGS')} />
                )}
                {showTranslationTab && (
                    <TabButton active={activeTab === 'TRANSLATION'} label={getTranslation('LABEL_TRANSLATION', currentLanguage)} onClick={() => setActiveTab('TRANSLATION')} />
                )}
            </div>

            <div className={EDITOR_SCROLL_CLASS}>
                {activeTab === 'CONTENT' && (
                    <div className="py-3 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {!isRestrictedEditor && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_CONTAINER_TITLE_INTERNAL', currentLanguage)}</label>
                                    <input className="w-full border p-2.5 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded-sm" value={data.title || ''} onChange={(e) => setData({ ...data, title: e.target.value })} placeholder={getTranslation('LABEL_INTERNAL_TITLE_PLACEHOLDER', currentLanguage)} />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className={`space-y-2 min-w-0 ${fieldShell(permitField('content.title') || permitSettings('showHeader'))}`} aria-hidden={!permitField('content.title') && !permitSettings('showHeader')}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <label className="text-xs font-bold text-gray-500 uppercase shrink-0">{getTranslation('LABEL_HEADING', currentLanguage)}</label>
                                    <div className={`flex items-center gap-2 ml-auto shrink-0 ${fieldShell(permitSettings('showHeader'))}`} aria-hidden={!permitSettings('showHeader')}>
                                        <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_HEADER', currentLanguage)}</span>
                                        <VisibilityToggle
                                            checked={data.settings.showHeader !== false}
                                            onCheckedChange={(v) => updateSetting('showHeader', v)}
                                            ariaLabel={getTranslation('LABEL_SHOW_HEADER', currentLanguage)}
                                        />
                                    </div>
                                </div>
                                {(data.settings.showHeader !== false) && permitField('content.title') && (
                                    <input
                                        className="w-full min-w-0 border p-2.5 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded-sm"
                                        value={getExactLanguageText(data.content.title, CONTENT_SOURCE_LANG)}
                                        onChange={(e) => updateContentSource('title', e.target.value)}
                                    />
                                )}
                            </div>
                            <div className={`space-y-2 min-w-0 ${fieldShell(permitField('content.subtitle') || permitSettings('showSubheading'))}`} aria-hidden={!permitField('content.subtitle') && !permitSettings('showSubheading')}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <label className="text-xs font-bold text-gray-500 uppercase shrink-0">{getTranslation('LABEL_SUBHEADING', currentLanguage)} ({getTranslation('LABEL_OPTIONAL', currentLanguage)})</label>
                                    <div className={`flex items-center gap-2 ml-auto shrink-0 ${fieldShell(permitSettings('showSubheading'))}`} aria-hidden={!permitSettings('showSubheading')}>
                                        <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_SUBHEADING', currentLanguage)}</span>
                                        <VisibilityToggle
                                            checked={data.settings.showSubheading !== false}
                                            onCheckedChange={(v) => updateSetting('showSubheading', v)}
                                            ariaLabel={getTranslation('LABEL_SHOW_SUBHEADING', currentLanguage)}
                                        />
                                    </div>
                                </div>
                                {(data.settings.showSubheading !== false) && permitField('content.subtitle') && (
                                    <input
                                        className="w-full min-w-0 border p-2.5 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded-sm"
                                        value={getExactLanguageText(data.content.subtitle, CONTENT_SOURCE_LANG)}
                                        onChange={(e) => updateContentSource('subtitle', e.target.value)}
                                    />
                                )}
                            </div>
                        </div>

                        <div className={`space-y-2 ${fieldShell(permitField('content.description') || permitSettings('showDescription'))}`} aria-hidden={!permitField('content.description') && !permitSettings('showDescription')}>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <label className="text-xs font-bold text-gray-500 uppercase shrink-0">{getTranslation('LABEL_DESCRIPTION', currentLanguage)} ({getTranslation('LABEL_RICH_TEXT', currentLanguage)})</label>
                                <div className={`flex items-center gap-2 ml-auto shrink-0 ${fieldShell(permitSettings('showDescription'))}`} aria-hidden={!permitSettings('showDescription')}>
                                    <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_DESC', currentLanguage)}</span>
                                    <VisibilityToggle
                                        checked={data.settings.showDescription !== false}
                                        onCheckedChange={(v) => updateSetting('showDescription', v)}
                                        ariaLabel={getTranslation('LABEL_SHOW_DESC', currentLanguage)}
                                    />
                                </div>
                            </div>
                            {(data.settings.showDescription !== false) && permitField('content.description') && (
                                <JoditRichTextEditor
                                    value={getExactLanguageText(data.content.description, CONTENT_SOURCE_LANG)}
                                    onChange={(val: string) => updateContentSource('description', val)}
                                    height={200}
                                    placeholder={getTranslation('LABEL_RICH_TEXT_DESC', currentLanguage)}
                                />
                            )}
                        </div>

                        {/* Button Configuration */}
                        <div className={`bg-gray-50 border border-gray-200 rounded-sm py-4 px-3 space-y-4 ${fieldShell(permitField('settings.btnEnabled') || permitField('settings.btnName') || permitField('settings.btnUrl'))}`} aria-hidden={!permitField('settings.btnEnabled') && !permitField('settings.btnName') && !permitField('settings.btnUrl')}>
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">{getTranslation('LABEL_ACTION_BUTTON', currentLanguage)}</h4>
                                <div
                                    className="flex items-center gap-2 cursor-pointer select-none"
                                    onClick={() => updateSetting('btnEnabled', !data.settings.btnEnabled)}
                                >
                                    <span className="text-xs font-medium text-gray-500">{data.settings.btnEnabled ? getTranslation('LABEL_ENABLED', currentLanguage) : getTranslation('LABEL_DISABLED', currentLanguage)}</span>
                                    <div className={`w-9 h-5 rounded-full relative transition-colors ${data.settings.btnEnabled ? 'bg-[var(--primary-color)]' : 'bg-gray-300'}`}>
                                        <div
                                            className="w-4 h-4 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform"
                                            style={{ left: data.settings.btnEnabled ? '16px' : '2px' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {data.settings.btnEnabled && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {/* Button Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_BUTTON_NAME', currentLanguage)}</label>
                                        <input
                                            className="w-full border p-2.5 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded-sm"
                                            value={getExactLanguageText(data.settings.btnName, CONTENT_SOURCE_LANG)}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setData((prev: Container) => ({
                                                    ...prev,
                                                    settings: {
                                                        ...prev.settings,
                                                        btnName: (typeof prev.settings.btnName === 'object' && prev.settings.btnName !== null)
                                                            ? { ...(prev.settings.btnName as Record<string, string>), [CONTENT_SOURCE_LANG]: val }
                                                            : val
                                                    }
                                                }));
                                            }}
                                            placeholder={getTranslation('LABEL_BUTTON_NAME_PLACEHOLDER', currentLanguage)}
                                        />
                                    </div>

                                    {/* Link Type Toggle */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_LINK_TYPE', currentLanguage)}</label>
                                        <div className="flex rounded-sm border border-gray-200 overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => updateSetting('btnLinkType', 'url')}
                                                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${(!data.settings.btnLinkType || data.settings.btnLinkType === 'url')
                                                    ? 'bg-[var(--primary-color)] text-white'
                                                    : 'bg-white text-gray-500 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {getTranslation('LABEL_EXTERNAL_URL', currentLanguage)}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateSetting('btnLinkType', 'container')}
                                                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${data.settings.btnLinkType === 'container'
                                                    ? 'bg-[var(--primary-color)] text-white'
                                                    : 'bg-white text-gray-500 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {getTranslation('LABEL_GO_TO_CONTAINER', currentLanguage)}
                                            </button>
                                        </div>
                                    </div>

                                    {/* URL Input — shown when Link Type is 'url' */}
                                    {(!data.settings.btnLinkType || data.settings.btnLinkType === 'url') && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_BUTTON_URL', currentLanguage)}</label>
                                            <input
                                                className="w-full border p-2.5 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded-sm"
                                                value={data.settings.btnUrl || ''}
                                                onChange={(e) => updateSetting('btnUrl', e.target.value)}
                                                placeholder={getTranslation('LABEL_BUTTON_URL_PLACEHOLDER', currentLanguage)}
                                            />
                                        </div>
                                    )}

                                    {/* Container Picker — shown when Link Type is 'container' */}
                                    {data.settings.btnLinkType === 'container' && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_TARGET_CONTAINER', currentLanguage)}</label>
                                            {siblingContainers.length === 0 ? (
                                                <div className="text-xs text-gray-400 italic p-2.5 border border-dashed border-gray-200 rounded-sm">
                                                    {getTranslation('LABEL_NO_CONTAINERS_FOUND', currentLanguage)}
                                                </div>
                                            ) : (
                                                <select
                                                    className="w-full border p-2.5 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded-sm bg-white"
                                                    value={data.settings.btnContainerId || ''}
                                                    onChange={(e) => updateSetting('btnContainerId', e.target.value)}
                                                >
                                                    <option value="">{getTranslation('LABEL_SELECT_CONTAINER', currentLanguage)}</option>
                                                    {siblingContainers.map(c => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.title || `[${c.type}]`} ({c.id})
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    )}

                                    <ActionButtonStyleEditor
                                        settings={data.settings}
                                        onFieldChange={updateSetting}
                                        onMultiChange={(patch) => setData((prev: Container) => ({
                                            ...prev,
                                            settings: { ...prev.settings, ...patch },
                                        }))}
                                        currentLanguage={currentLanguage}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'SETTINGS' && showHeroSettingsTab && (
                    <div className="py-3 space-y-8 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 uppercase text-xs tracking-wider">{getTranslation('LABEL_TEMPLATE_DESIGN', currentLanguage)}</h4>
                            <div className="flex gap-4 mb-4">
                                <VisualOption label={getTranslation('HERO_TMPL_TEXT_HEADER', currentLanguage)} active={data.settings.bgType === 'none'} onClick={() => updateHeroDesign('none')} />
                                <VisualOption label={getTranslation('HERO_TMPL_COLOR_BG', currentLanguage)} active={data.settings.bgType === 'color'} onClick={() => updateHeroDesign('color')} />
                                <VisualOption label={getTranslation('HERO_TMPL_IMAGE_BG', currentLanguage)} active={data.settings.bgType === 'image'} onClick={() => updateHeroDesign('image')} />
                                <VisualOption label={getTranslation('HERO_TMPL_IMAGE_TEXT', currentLanguage)} active={data.settings.bgType === 'layout'} onClick={() => updateHeroDesign('layout')} />
                            </div>

                            {data.settings.bgType === 'layout' && (
                                <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                                    <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 uppercase text-xs tracking-wider">{getTranslation('HERO_TMPL_IMAGE_TEXT', currentLanguage)}</h4>
                                    <div className="flex gap-4">
                                        <VisualOption
                                            label={getTranslation('LABEL_IMG_LEFT_TEXT_RIGHT', currentLanguage)}
                                            active={data.settings.layoutVariant === 'img_left'}
                                            onClick={() => updateSetting('layoutVariant', 'img_left')}
                                            icon={() => (
                                                <div className="flex w-full h-8 border border-gray-300 rounded-sm overflow-hidden">
                                                    <div className="w-1/2 bg-[var(--primary-color)] opacity-50"></div>
                                                    <div className="w-1/2 bg-gray-100"></div>
                                                </div>
                                            )}
                                        />
                                        <VisualOption
                                            label={getTranslation('LABEL_TEXT_LEFT_IMG_RIGHT', currentLanguage)}
                                            active={data.settings.layoutVariant === 'img_right'}
                                            onClick={() => updateSetting('layoutVariant', 'img_right')}
                                            icon={() => (
                                                <div className="flex w-full h-8 border border-gray-300 rounded-sm overflow-hidden">
                                                    <div className="w-1/2 bg-gray-100"></div>
                                                    <div className="w-1/2 bg-[var(--primary-color)] opacity-50"></div>
                                                </div>
                                            )}
                                        />
                                    </div>
                                </div>
                            )}

                            {data.settings.bgType === 'color' && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-sm">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_BACKGROUND_COLOR', currentLanguage)}</label>
                                    <ColorPicker value={data.settings.bgColor || '#ffffff'} onChange={(v) => updateSetting('bgColor', v)} />
                                </div>
                            )}

                            {(data.settings.bgType === 'image' || data.settings.bgType === 'layout') && (
                                <div className="mt-4">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_IMAGE', currentLanguage)}</label>
                                    <ImagePicker value={data.settings.bgImage || ''} onChange={(v) => updateSetting('bgImage', v)} />
                                </div>
                            )}

                            {data.settings.bgType === 'image' && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <SliderImageRadiusEditor
                                        imageSettings={parseSliderImageSettings(data.settings.imageSettings)}
                                        currentLanguage={currentLanguage}
                                        onChange={(imageSettings) => updateSetting('imageSettings', imageSettings)}
                                    />
                                </div>
                            )}

                            {data.settings.bgType === 'layout' && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <SliderImageRadiusEditor
                                        imageSettings={parseSliderImageSettings(data.settings.imageSettings)}
                                        currentLanguage={currentLanguage}
                                        onChange={(imageSettings) => updateSetting('imageSettings', imageSettings)}
                                    />
                                </div>
                            )}

                            {data.settings.bgType === 'image' && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-sm">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-3">
                                        {getTranslation('LABEL_HERO_IMAGE_OVERLAY', currentLanguage)}
                                    </label>
                                    <div className="grid grid-cols-2 gap-6 items-end">
                                        <div className="min-w-0">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                                {getTranslation('LABEL_OVERLAY_COLOR', currentLanguage)}
                                            </label>
                                            <ColorPicker
                                                value={data.settings.heroOverlayColor || DEFAULT_HERO_OVERLAY_COLOR}
                                                onChange={(v) => updateSetting('heroOverlayColor', v)}
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex justify-between text-xs text-gray-500 mb-2">
                                                <span className="font-bold uppercase">{getTranslation('LABEL_OPACITY', currentLanguage)}</span>
                                                <span>{parseHeroOverlayOpacity(data.settings.heroOverlayOpacity).toFixed(2)}</span>
                                            </div>
                                            <div className="h-10 flex items-center">
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.01"
                                                    value={parseHeroOverlayOpacity(data.settings.heroOverlayOpacity)}
                                                    onChange={(e) => updateSetting('heroOverlayOpacity', parseFloat(e.target.value))}
                                                    className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-6 p-4 bg-gray-50 rounded-sm">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-3">{getTranslation('LABEL_HERO_IMAGE_HEIGHT', currentLanguage)}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => updateSetting('heroHeightMode', 'default')}
                                        className={`py-2 text-xs font-bold border rounded-sm transition-colors ${(data.settings.heroHeightMode || 'default') === 'default' ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                                    >
                                        {`Default (${defaultHeroHeightLabel})`}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateSetting('heroHeightMode', 'full')}
                                        className={`py-2 text-xs font-bold border rounded-sm transition-colors ${(data.settings.heroHeightMode || 'default') === 'full' ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                                    >
                                        {getTranslation('LABEL_FULL_SCREEN_MINUS_NAV', currentLanguage)}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateSetting('heroHeightMode', 'custom')}
                                        className={`py-2 text-xs font-bold border rounded-sm transition-colors ${(data.settings.heroHeightMode || 'default') === 'custom' ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                                    >
                                        Custom
                                    </button>
                                </div>
                                {(data.settings.heroHeightMode || 'default') === 'custom' && (
                                    <div className="mt-3">
                                        <input
                                            type="text"
                                            className="w-full border p-2 text-sm rounded-sm bg-white"
                                            placeholder={getTranslation('PLACEHOLDER_HERO_CUSTOM_HEIGHT', currentLanguage)}
                                            value={data.settings.heroCustomHeight || ''}
                                            onChange={(e) => updateSetting('heroCustomHeight', e.target.value)}
                                        />
                                        <p className="mt-1 text-[11px] text-gray-500">
                                            {getTranslation('MSG_HERO_HEIGHT_HELPER', currentLanguage)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 uppercase text-xs tracking-wider">{getTranslation('LABEL_TYPOGRAPHY', currentLanguage)}</h4>
                            <div className="grid grid-cols-3 gap-6 mb-6">
                                {/* Heading Color */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_HEADING_COLOR', currentLanguage)}</label>
                                    <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={heroTitleColorSetting} onChange={(e) => updateHeroTitleColor(e.target.value)}>
                                        <option value="site">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                        <option value="black">{getTranslation('LABEL_BLACK', currentLanguage)}</option>
                                        <option value="white">{getTranslation('LABEL_WHITE', currentLanguage)}</option>
                                        <option value="custom">{getTranslation('LABEL_CUSTOM_COLOR', currentLanguage)}</option>
                                    </select>
                                    {heroTitleColorSetting === 'custom' && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                            <ColorPicker value={heroTitleCustomColor} onChange={(v) => updateHeroTitleColor('custom', v)} />
                                        </div>
                                    )}
                                </div>

                                {/* Sub Heading Color */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_SUBHEADING_COLOR', currentLanguage)}</label>
                                    <select
                                        className="w-full border p-2 text-sm rounded-sm bg-white mb-2"
                                        value={heroSubtitleColorSetting}
                                        onChange={(e) => updateHeroSubtitleColor(e.target.value)}
                                    >
                                        <option value="site">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                        <option value="black">{getTranslation('LABEL_BLACK', currentLanguage)}</option>
                                        <option value="white">{getTranslation('LABEL_WHITE', currentLanguage)}</option>
                                        <option value="custom">{getTranslation('LABEL_CUSTOM_COLOR', currentLanguage)}</option>
                                    </select>
                                    {heroSubtitleColorSetting === 'custom' && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                            <ColorPicker
                                                value={heroSubtitleCustomColor}
                                                onChange={(v) => updateHeroSubtitleColor('custom', v)}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Description Color */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_DESCRIPTION_COLOR', currentLanguage)}</label>
                                    <select
                                        className="w-full border p-2 text-sm rounded-sm bg-white mb-2"
                                        value={heroDescriptionColorSetting}
                                        onChange={(e) => updateHeroDescriptionColor(e.target.value)}
                                    >
                                        {HERO_DESCRIPTION_COLOR_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {getTranslation(opt.labelKey, currentLanguage)}
                                            </option>
                                        ))}
                                    </select>
                                    {heroDescriptionColorSetting === 'custom' && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                            <ColorPicker
                                                value={heroDescriptionCustomColor}
                                                onChange={(v) => updateHeroDescriptionColor('custom', v)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-6 mb-6 items-start">
                                <HeroTypographyStyleColumn
                                    role="title"
                                    styleLabelKey="LABEL_HEADING_STYLE"
                                    customSectionLabelKey="LABEL_CUSTOM_HEADING_STYLE"
                                    settings={data.settings}
                                    updateSetting={updateSetting}
                                    currentLanguage={currentLanguage}
                                />
                                <HeroTypographyStyleColumn
                                    role="subtitle"
                                    styleLabelKey="LABEL_SUBHEADING_STYLE"
                                    customSectionLabelKey="LABEL_CUSTOM_SUBHEADING_STYLE"
                                    settings={data.settings}
                                    updateSetting={updateSetting}
                                    currentLanguage={currentLanguage}
                                />
                                <HeroTypographyStyleColumn
                                    role="description"
                                    styleLabelKey="LABEL_DESCRIPTION_STYLE"
                                    customSectionLabelKey="LABEL_CUSTOM_DESCRIPTION_STYLE"
                                    settings={data.settings}
                                    updateSetting={updateSetting}
                                    currentLanguage={currentLanguage}
                                />
                            </div>


                            {/* Alignment & Letter Case */}
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_CONTENT_ALIGNMENT', currentLanguage)}</label>
                                    <div className="flex border rounded-sm overflow-hidden">
                                        {['left', 'center', 'right'].map(align => (
                                            <button key={align} onClick={() => updateSetting('align', align)} className={`ws-content-align-btn flex-1 py-2 flex justify-center ${data.settings.align === align ? 'bg-[var(--primary-color)] text-white' : 'bg-white hover:bg-gray-50'}`}>
                                                {align === 'left' ? <AlignLeft className="w-4 h-4" /> : (align === 'center' ? <AlignCenter className="w-4 h-4" /> : <AlignRight className="w-4 h-4" />)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_HEADING_LETTER_CASE', currentLanguage)}</label>
                                    <select className="w-full border p-2 text-sm rounded-sm bg-white" value={data.settings.letterCase || defaultHeroLetterCase} onChange={(e) => updateSetting('letterCase', e.target.value)}>
                                        <option value="uppercase">{getTranslation('LABEL_UPPERCASE', currentLanguage)}</option>
                                        <option value="lowercase">{getTranslation('LABEL_LOWERCASE', currentLanguage)}</option>
                                        <option value="sentence">{getTranslation('LABEL_SENTENCE_CASE', currentLanguage)}</option>
                                        <option value="title">{getTranslation('LABEL_TITLE_CASE', currentLanguage)}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <SectionCustomizationEditor
                            settings={data.settings}
                            onChange={updateSetting}
                            currentLanguage={currentLanguage}
                        />
                    </div>
                )}

                {activeTab === 'TRANSLATION' && showTranslationTab && (
                    <UebersetzungTab
                        data={data}
                        onUpdate={updateContentTranslation}
                        targetLanguages={optionalTranslationLanguages}
                        fields={[
                            { key: 'title', label: getTranslation('LABEL_HEADING', currentLanguage), type: 'input' },
                            { key: 'subtitle', label: getTranslation('LABEL_SUBHEADING', currentLanguage), type: 'input' },
                            { key: 'description', label: getTranslation('LABEL_DESCRIPTION', currentLanguage), type: 'rich' },
                            {
                                key: 'btnName',
                                label: getTranslation('LABEL_BUTTON_NAME', currentLanguage),
                                type: 'input',
                                getValue: (language: string) => getExactLanguageText(data.settings.btnName, language as LanguageCode),
                                onChange: (value: string, lang: LanguageCode) => setData((prev: Container) => ({
                                    ...prev,
                                    settings: {
                                        ...prev.settings,
                                        btnName: (typeof prev.settings.btnName === 'object' && prev.settings.btnName !== null)
                                            ? { ...prev.settings.btnName, [lang]: value }
                                            : { en: String(prev.settings.btnName || ''), [lang]: value }
                                    }
                                }))
                            }
                        ]}
                    />
                )}
            </div>
        </div>
    );
};

// --- 2. DATA GRID EDITOR (Strict Implementation) ---

const DataGridEditor = ({ data, setData, onClose, editorAccess }: ContainerEditorChildProps) => {
    const [activeTab, setActiveTab] = useState<'CONTENT' | 'SETTINGS' | 'TRANSLATION'>('CONTENT');
    const isRestrictedEditor = !canShowFullContainerEditor(editorAccess.role, data.settings);
    const showTemplateDesignBanner = isRestrictedEditor && Boolean(data.settings?.sectionTemplateId);
    const effectiveEditableFields = useMemo(
        () => editorAccess.editableFields ?? [],
        [editorAccess.editableFields]
    );
    const permitField = (fieldKey: string) =>
        !isRestrictedEditor || isContentEditorFieldEditable(editorAccess.role, data.type, fieldKey, effectiveEditableFields);
    const permitSettings = (settingsPath: string) =>
        !isRestrictedEditor || isSettingsPathEditable(editorAccess.role, settingsPath, data.type, effectiveEditableFields);
    const fieldShell = (allowed: boolean) => (!allowed ? 'hidden' : '');
    const canEditPanelSort = permitSettings('ordering');
    const canEditPanelView = permitSettings('contentViewMode');
    const hidePanelDisplayControls = isRestrictedEditor && !canEditPanelSort && !canEditPanelView;
    const persistPanelDisplay = !isRestrictedEditor || canEditPanelSort || canEditPanelView;
    const canEditTaggedItems = permitSettings('taggedItems');
    const canChangeDataSource = Boolean(editorAccess.isTemplateEditor) || data.id === 'template_draft';
    const canPublish = canPublishContent(editorAccess.role);

    const handleDataSourceChange = (rawSource: string) => {
        const nextSource = toStoredDataGridSource(rawSource);
        setData((prev: Container) => ({
            ...prev,
            settings: {
                ...prev.settings,
                source: nextSource,
                taggedItems: [],
                showAllWithoutTagging: false,
            },
        }));
    };

    const {
        news, events, documents, pages, containerItems, contacts, sliderItems,
        addNews, addEvent, addDocument, addContainerItem, addContact, addSliderItem, addPage,
        updateNews, updateEvent, updateDocument, updatePage, updateContainerItem, updateContact, updateSliderItem,
        deleteNews, deleteEvent, deleteDocument, deleteContainerItem, deleteContact, deleteSliderItem, deletePage,
        currentLanguage, persistContainerTaggingLookups, triggerTaggingSuccess,
        themeConfig, siteConfig,
    } = useStore();
    const websiteFontOptions = useMemo(() => {
        const options = getWebsiteFontOptions({ themeConfig, siteConfig });
        const current = String(data.settings.cardTitleFontFamily || '').trim();
        if (!current) return options;
        const currentName = extractPrimaryFontName(current);
        const alreadyListed = options.some(
            (option) =>
                option.cssValue === current ||
                option.name.toLowerCase() === currentName.toLowerCase()
        );
        if (alreadyListed) return options;
        return [{ name: currentName || current, cssValue: current, source: 'custom' as const }, ...options];
    }, [themeConfig, siteConfig, data.settings.cardTitleFontFamily]);
    const translationTarget: LanguageCode = TRANSLATION_TARGET_LANG;

    // Internal State for Modals
    const [showCreate, setShowCreate] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null); // For editing source item
    const [deleteId, setDeleteId] = useState<string | null>(null);
    // Strict Behavior: Setting updates trigger immediate save via parent wrapper (which syncs to store)
    const updateSetting = (key: string, val: any) => {
        setData((prev: Container) => {
            const nextSettings: any = { ...prev.settings, [key]: val };
            if (key === 'bgColor') nextSettings.backgroundColor = val;
            if (key === 'bgImage') nextSettings.backgroundImage = val;
            if (key === 'bgType' && val === 'site-color') nextSettings.backgroundColor = 'site-color';
            if (key === 'bgType' && val === 'color' && nextSettings.backgroundColor === 'site-color') {
                nextSettings.backgroundColor = nextSettings.bgColor || '#ffffff';
            }
            if (key === 'cardBgColor') nextSettings.cardBackgroundColor = val;
            if (key === 'cardBgType' && val === 'site-color') nextSettings.cardBackgroundColor = 'site-color';
            if (key === 'cardBgType' && val === 'color' && nextSettings.cardBackgroundColor === 'site-color') {
                nextSettings.cardBackgroundColor = nextSettings.cardBgColor || '#ffffff';
            }
            return { ...prev, settings: nextSettings };
        });
    };

    const resolvedBgColor = data.settings.bgColor || data.settings.backgroundColor || '#ffffff';
    const resolvedBgImage = data.settings.bgImage || data.settings.backgroundImage || '';
    const bgTypeNormalized = String(data.settings.bgType || '').toLowerCase();
    const resolvedBgType = ((bgTypeNormalized === 'none' || bgTypeNormalized === 'color' || bgTypeNormalized === 'image' || bgTypeNormalized === 'site-color' || bgTypeNormalized === 'site' || bgTypeNormalized === 'sitecolor')
        ? ((bgTypeNormalized === 'site' || bgTypeNormalized === 'sitecolor') ? 'site-color' : bgTypeNormalized)
        : (
            data.settings.backgroundColor === 'site-color'
                ? 'site-color'
                : ((data.settings.bgImage || data.settings.backgroundImage) ? 'image' : ((data.settings.bgColor || data.settings.backgroundColor) ? 'color' : 'none'))
        )) as 'none' | 'color' | 'site-color' | 'image';

    const updateSectionDisplay = (patch: Record<string, unknown>) =>
        setData((prev: Container) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
    const updateHeroTitleColor = (preset: string, customHex?: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: { ...prev.settings, ...buildHeroTitleColorPatch(preset, customHex, prev.settings) },
        }));
    };
    const updateHeroSubtitleColor = (preset: string, customHex?: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: { ...prev.settings, ...buildHeroSubtitleColorPatch(preset, customHex, prev.settings) },
        }));
    };
    const updateHeroDescriptionColor = (preset: string, customHex?: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: { ...prev.settings, ...buildHeroDescriptionColorPatch(preset, customHex, prev.settings) },
        }));
    };
    const heroTitleColorSetting = getHeroTitleColorSetting(data.settings);
    const heroTitleCustomColor = getHeroTitleCustomColor(data.settings);
    const heroSubtitleColorSetting = getHeroSubtitleColorSetting(data.settings);
    const heroSubtitleCustomColor = getHeroSubtitleCustomColor(data.settings);
    const heroDescriptionColorSetting = getHeroDescriptionColorSetting(data.settings);
    const heroDescriptionCustomColor = getHeroDescriptionCustomColor(data.settings);
    const cardTitleColorSetting = getCardTitleColorSetting(data.settings);
    const cardTitleCustomColor = getCardTitleCustomColor(data.settings);
    const cardDescColorSetting = getCardDescColorSetting(data.settings);
    const cardDescCustomColor = getCardDescCustomColor(data.settings);
    const cardSubtitleColorSetting = getCardSubtitleColorSetting(data.settings);
    const cardSubtitleCustomColor = getCardSubtitleCustomColor(data.settings);
    const updateCardTitleColor = (preset: string, customHex?: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: { ...prev.settings, ...buildCardTitleColorPatch(preset, customHex, prev.settings) },
        }));
    };
    const updateCardDescColor = (preset: string, customHex?: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: { ...prev.settings, ...buildCardDescColorPatch(preset, customHex, prev.settings) },
        }));
    };
    const updateCardSubtitleColor = (preset: string, customHex?: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: { ...prev.settings, ...buildCardSubtitleColorPatch(preset, customHex, prev.settings) },
        }));
    };
    const resolvedCardBgColor = data.settings.cardBgColor || data.settings.cardBackgroundColor || '#ffffff';
    const cardBgTypeNormalized = String(data.settings.cardBgType || '').toLowerCase();
    const resolvedCardBgType = ((cardBgTypeNormalized === 'none' || cardBgTypeNormalized === 'color' || cardBgTypeNormalized === 'site-color' || cardBgTypeNormalized === 'site' || cardBgTypeNormalized === 'sitecolor')
        ? ((cardBgTypeNormalized === 'site' || cardBgTypeNormalized === 'sitecolor') ? 'site-color' : cardBgTypeNormalized)
        : (
            data.settings.cardBackgroundColor === 'site-color'
                ? 'site-color'
                : ((data.settings.cardBgColor || data.settings.cardBackgroundColor) ? 'color' : 'none')
        )) as 'none' | 'color' | 'site-color';
    const updateContent = (key: string, val: string) => {
        const legacyKey = key === 'title' ? 'heading' : undefined;
        setData((prev: Container) => applyBaseHeaderFieldUpdate(prev, key, val, legacyKey));
    };

    const updateUebersetzungContent = (key: string, val: string) => {
        const contentKey = key === 'subheading' ? 'subtitle' : key;
        const legacyKey =
            key === 'title' ? 'heading' : key === 'subheading' ? 'subheading' : key === 'description' ? 'description' : undefined;
        setData((prev: Container) =>
            applyTranslationHeaderFieldUpdate(prev, contentKey, val, legacyKey, translationTarget)
        );
    };

    const updateBaseHeaderField = (contentKey: string, val: string, legacySettingKey?: string) => {
        setData((prev: Container) => applyBaseHeaderFieldUpdate(prev, contentKey, val, legacySettingKey));
    };

    const getGridHeaderTranslationValue = (contentKey: string, legacySettingKey?: string, language?: LanguageCode): string => {
        const lang = (language || translationTarget) as LanguageCode;
        const contentField = (data.content as any)?.[contentKey];
        if (contentField !== undefined && contentField !== null) {
            return getExactLanguageText(contentField, lang);
        }
        if (legacySettingKey) {
            return getExactLanguageText((data.settings as any)?.[legacySettingKey], lang);
        }
        return '';
    };

    const updateGridHeaderTranslationValue = (
        contentKey: string,
        value: string,
        legacySettingKey?: string,
        lang?: LanguageCode
    ) => {
        const targetLang = lang || translationTarget;
        setData((prev: Container) =>
            applyTranslationHeaderFieldUpdate(prev, contentKey, value, legacySettingKey, targetLang)
        );
    };

    // Data Source Management — for SLIDER containers, default to 'ImageSlider'
    const source = data.settings.source || (data.type === ContainerType.SLIDER ? 'ImageSlider' : 'News');
    const isCardsContainer = data.type === ContainerType.CARD_GRID;
    const normalizedSource = normalizeDataGridSource(source);
    const isNewsOrEventSource = normalizedSource === 'News' || normalizedSource === 'Event';
    const supportsCardReadMore = isItemCardSource(source);

    useEffect(() => {
        const defaultConfig = getDefaultDataGridSortConfig(source);
        const normalizedSortField = normalizeSectionSortField(source, data.settings.sortField as string | undefined);
        const normalizedViewMode = normalizeContentViewMode(data.settings.contentViewMode as string | undefined);
        const invalidStoredSortField =
            !!data.settings.sortField &&
            normalizeSectionSortField(source, data.settings.sortField as string) !== data.settings.sortField;
        const needsUpdate =
            !data.settings.sortField ||
            !data.settings.sortDirection ||
            invalidStoredSortField ||
            !data.settings.contentViewMode;

        if (needsUpdate) {
            setData((prev: Container) => ({
                ...prev,
                settings: {
                    ...prev.settings,
                    sortField: normalizedSortField,
                    sortDirection: prev.settings.sortDirection || defaultConfig.direction,
                    contentViewMode: prev.settings.contentViewMode ? normalizedViewMode : 'grid',
                },
            }));
        }
    }, [source]);
    let sourceData: any[] = [];
    if (source === 'News') sourceData = news;
    else if (source === 'Event') sourceData = events;
    else if (source === 'Document') sourceData = documents;
    else if (source === 'Smart Pages' || source === 'SmartPages') sourceData = pages;
    else if (source === 'Contact') sourceData = contacts;
    else if (source === 'Container Items') sourceData = containerItems;
    else if (source === 'ImageSlider') sourceData = sliderItems;

    const taggedIds = data.settings.taggedItems || [];
    const showAllWithoutTagging = !!data.settings.showAllWithoutTagging;

    const getContainerSource = (container: Container) => {
        if (container.settings?.source) return normalizeDataGridSource(container.settings.source);
        if (container.type === ContainerType.SLIDER) return 'ImageSlider';
        return undefined;
    };

    const isTaggedElsewhere = (id: string, overrideCurrent?: string[]) => {
        return pages.some(page => page.containers.some(container => {
            const containerSource = getContainerSource(container);
            if (!containerSource || containerSource !== normalizedSource) return false;
            const tagged = container.id === data.id ? (overrideCurrent || container.settings?.taggedItems) : container.settings?.taggedItems;
            return Array.isArray(tagged) && tagged.includes(id);
        }));
    };

    const getSourceStepLabel = (plural = false) => {
        if (source === 'Contact') return 'Contact';
        if (source === 'Container Items') return 'Container Items';
        if (source === 'ImageSlider') return 'Slider Items';
        if (normalizedSource === 'Smart Pages') return 'Smart Pages';
        if (source === 'News') return 'News';
        if (source === 'Event') return plural ? 'Events' : 'Events';
        if (source === 'Document') return plural ? 'Documents' : 'Document';
        return plural ? `${source}s` : source;
    };

    const availableItems = sourceData.filter((item: any) => !taggedIds.some((tid: string) => String(tid) === String(item.id)));
    const taggedItems = showAllWithoutTagging
        ? sourceData
        : taggedIds.map((id: string) => sourceData.find((item: any) => String(item.id) === String(id))).filter(Boolean);

    // Validation
    const columns = data.settings.columns || 3;
    const minItemsRequired = source === 'ImageSlider' ? 2 : columns;
    const isValidationFailed = !showAllWithoutTagging && taggedItems.length < minItemsRequired;
    const handleApplyTaggedOrder = async ({ orderedIds }: TaggedOrderApplyResult) => {
        const updatedContainer: Container = { ...data, settings: { ...data.settings, taggedItems: orderedIds } };
        setData(updatedContainer);
        await persistTagging(updatedContainer);
    };

    const buildTaggedOrderChangeContext = (): TaggedOrderChangeContext | undefined => {
        if (!sourceSupportsItemSortOrder(source) || showAllWithoutTagging || taggedIds.length < 2) return undefined;
        const titleKey = (source === 'Contacts' || source === 'Contact') ? 'fullName' : 'title';
        return {
            taggedIds: taggedIds.map((id: string) => String(id)),
            items: taggedItems.map((entry: any) => ({
                id: String(entry.id),
                title: getItemTranslation(entry, currentLanguage, titleKey),
                imageUrl: entry.imageUrl,
                status: entry.status,
            })),
            onApply: handleApplyTaggedOrder,
        };
    };

    const taggedOrderChangeContext = buildTaggedOrderChangeContext();

    const resolveContainerPageId = (): string | undefined => (
        data.pageId || pages.find((page) => page.containers.some((container) => container.id === data.id))?.id
    );

    const persistTagging = async (updatedContainer: Container) => {
        const pageId = resolveContainerPageId();
        if (pageId) {
            await persistContainerTaggingLookups(pageId, updatedContainer);
        }
    };

    // --- Actions ---

    const suppressSuccess = { suppressSuccess: true };

    const handleTag = async (id: string) => {
        if (taggedIds.includes(id)) return;
        const newTagged = [...taggedIds, id];
        const updatedContainer: Container = { ...data, settings: { ...data.settings, taggedItems: newTagged } };
        setData(updatedContainer);
        await persistTagging(updatedContainer);

        const item = sourceData.find((i: any) => i.id === id);
        if (canPublish && item && item.status !== 'Published') {
            const updated = { ...item, status: 'Published' };
            if (source === 'News') await updateNews(updated, suppressSuccess);
            else if (source === 'Event') await updateEvent(updated, suppressSuccess);
            else if (source === 'Document') await updateDocument(updated, suppressSuccess);
            else if (source === 'Container Items') await updateContainerItem(updated, suppressSuccess);
            else if (source === 'Contact') await updateContact(updated, suppressSuccess);
            else if (source === 'ImageSlider') await updateSliderItem(updated, suppressSuccess);
            else if (normalizedSource === 'Smart Pages') await updatePage(updated, suppressSuccess);
        }
        triggerTaggingSuccess('tagged');
    };

    const handleUntag = async (id: string) => {
        const newTagged = taggedIds.filter((tid: string) => tid !== id);
        const updatedContainer: Container = { ...data, settings: { ...data.settings, taggedItems: newTagged } };
        setData(updatedContainer);
        await persistTagging(updatedContainer);

        const item = sourceData.find((i: any) => i.id === id);
        if (canPublish && item && item.status !== 'Draft') {
            const stillTagged = isTaggedElsewhere(id, newTagged);
            if (!stillTagged) {
                const updated = { ...item, status: 'Draft' };
                if (source === 'News') await updateNews(updated, suppressSuccess);
                else if (source === 'Event') await updateEvent(updated, suppressSuccess);
                else if (source === 'Document') await updateDocument(updated, suppressSuccess);
                else if (source === 'Container Items') await updateContainerItem(updated, suppressSuccess);
                else if (source === 'Contact') await updateContact(updated, suppressSuccess);
                else if (source === 'ImageSlider') await updateSliderItem(updated, suppressSuccess);
                else if (normalizedSource === 'Smart Pages') await updatePage(updated, suppressSuccess);
            }
        }
        triggerTaggingSuccess('untagged');
    };

    // --- Create New Item Logic ---
    const handleCreateInit = async (title: string | any) => {
        // 1. Create item in Source
        let newItem: any;
        const baseId = `${source.toLowerCase().substring(0, 3)}_${Date.now()}`;

        if (source === 'News') {
            newItem = { id: baseId, title, status: 'Draft', publishDate: new Date().toISOString(), description: '', imageUrl: '', readMore: { enabled: true }, translations: {} };
            await addNews(newItem);
        } else if (source === 'Event') {
            newItem = { id: baseId, title, status: 'Draft', startDate: new Date().toISOString(), endDate: new Date().toISOString(), description: '', imageUrl: '', readMore: { enabled: true }, translations: {} };
            await addEvent(newItem);
        } else if (source === 'Document') {
            if (typeof title === 'object') {
                newItem = { id: baseId, ...title, translations: {} };
            } else {
                newItem = { id: baseId, title, status: 'Draft', date: new Date().toISOString(), type: 'PDF', year: '2025', description: '', translations: {} };
            }
            const addedDoc = await addDocument(newItem);
            if (addedDoc) {
                newItem.id = addedDoc.id;
            }
        } else if (source === 'Container Items') {
            newItem = { id: baseId, title, status: 'Draft', sortOrder: 0, description: '', imageUrl: '', readMore: { enabled: false, url: '', text: '' }, translations: {}, seo: {} };
            await addContainerItem(newItem);
        } else if (source === 'Contact') {
            if (typeof title === 'object') {
                newItem = title;
                await addContact(newItem);
            }
        } else if (source === 'ImageSlider') {
            newItem = {
                id: `slider_${Date.now()}`,
                title,
                subtitle: '',
                description: '',
                status: 'Draft',
                sortOrder: sliderItems.length + 1,
                ctaText: '',
                ctaUrl: '',
                imageUrl: '',
                imageName: '',
                translations: { en: { title, subtitle: '', description: '', ctaText: '' } }
            };
            const added = await addSliderItem(newItem);
            newItem = added || newItem;
        } else if (normalizedSource === 'Smart Pages') {
            if (typeof title === 'object') {
                newItem = title;
                const added = await addPage(newItem);
                if (added) newItem = added;
            }
        }

        // 2. Automatically tag new items (except slider items — user tags explicitly from connect list)
        if (newItem && source !== 'ImageSlider') {
            await handleTag(newItem.id);
        }
        setShowCreate(false);
    };

    // --- Edit Item Logic ---
    const handleSaveEdit = (item: any) => {
        if (source === 'News') updateNews(item);
        else if (source === 'Event') updateEvent(item);
        else if (source === 'Document') updateDocument(item);
        else if (source === 'Container Items') updateContainerItem(item);
        else if (source === 'Contact') updateContact(item);
        else if (source === 'ImageSlider') updateSliderItem(item);
        else if (normalizedSource === 'Smart Pages') updatePage(item);
        setEditingItem(null);
    };

    const permitGroup = (groupKey: string) =>
        !isRestrictedEditor || (editorAccess.role === 'site_admin' && isSettingsGroupEditable('site_admin', groupKey, data.type, effectiveEditableFields));

    const optionalTranslationLanguages = useMemo(
        () => getOptionalEnabledLanguages(siteConfig),
        [siteConfig?.languages]
    );
    const showTranslationTab = optionalTranslationLanguages.length > 0;
    const canEditTypography = permitGroup('typography');
    const canEditCardStyle = permitGroup('cardStyle');
    const canEditSlideDesign = permitGroup('slideDesign') || permitSettings('imageSettings');
    const canEditLayoutBorder = permitSettings('border') || permitSettings('imgPos');
    const canEditContentAlign = permitSettings('align') || permitSettings('contentAlign');
    const canEditDisplayOptions = !isRestrictedEditor
        || permitGroup('displayOptions')
        || permitField('content.title')
        || permitField('content.subtitle')
        || permitField('content.description');
    const canEditLayoutBehavior = !isRestrictedEditor || permitGroup('layoutBehavior');
    const canEditCardSettings = !isRestrictedEditor || permitGroup('cardSettings');
    const showLayoutConfigCard = !isRestrictedEditor || canEditLayoutBehavior || canEditCardSettings;
    const showDesignSettingsCard = !isRestrictedEditor
        || canEditDisplayOptions
        || canEditSlideDesign
        || canEditTypography
        || canEditCardStyle;

    const hasSiteAdminSettingsAccess = !isRestrictedEditor
        || hasSiteAdminDataGridSettingsAccess(data.type, effectiveEditableFields);

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {showTemplateDesignBanner && <TemplateLockedBanner className="mx-4 mt-4" />}
            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
                <TabButton active={activeTab === 'CONTENT'} label={getTranslation('LABEL_MANAGE_CONTENT', currentLanguage)} onClick={() => setActiveTab('CONTENT')} />
                {hasSiteAdminSettingsAccess && (
                    <TabButton active={activeTab === 'SETTINGS'} label={getTranslation('LABEL_SETTINGS', currentLanguage)} onClick={() => setActiveTab('SETTINGS')} />
                )}
                {showTranslationTab && (
                    <TabButton active={activeTab === 'TRANSLATION'} label={getTranslation('LABEL_TRANSLATION', currentLanguage)} onClick={() => setActiveTab('TRANSLATION')} />
                )}
            </div>

            <div className={EDITOR_SCROLL_CLASS}>
                {activeTab === 'CONTENT' && (
                    <div className="pt-4 w-full space-y-8">
                        {showAllWithoutTagging && (
                            <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-sm text-sm flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                {getTranslation('LABEL_SHOW_ALL_WITHOUT_TAGGING_HINT', currentLanguage)}
                            </div>
                        )}
                        {isValidationFailed && (
                            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-sm text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="w-4 h-4" />
                                {getTranslation('LABEL_MIN_ITEMS_REQUIRED', currentLanguage).replace('{0}', minItemsRequired.toString())}
                            </div>
                        )}

                        {/* Section 1: Create */}
                        {canEditTaggedItems && (
                            <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wider text-[var(--primary-color)]">{getTranslation('LABEL_CREATE_NEW_STEP', currentLanguage).replace('{0}', source === 'Contact' ? 'Contact' : (source === 'Container Items' ? 'Container Item' : source === 'ImageSlider' ? 'Slider Item' : normalizedSource === 'Smart Pages' ? 'Smart Pages' : source))}</h4>
                                    <div className="text-gray-400 text-xs italic mt-1">
                                        {source === 'ImageSlider'
                                            ? getTranslation('LABEL_CREATE_NEW_DESC_SLIDER', currentLanguage)
                                            : getTranslation('LABEL_CREATE_NEW_DESC', currentLanguage).replace('{0}', source === 'ImageSlider' ? 'Image Slider' : source)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            setShowCreate(true);
                                        }}
                                        className="bg-[var(--primary-color)] text-white px-4 py-2 text-xs font-bold rounded-sm flex items-center gap-2 hover:opacity-90 shadow-sm transition-transform active:scale-95"
                                    >
                                        <Plus className="w-4 h-4" /> {getTranslation('LABEL_CREATE_NEW_BUTTON', currentLanguage).replace('{0}', source === 'ImageSlider' ? 'Slider Item' : source)}
                                    </button>
                                </div>
                            </div>
                        )}

                        {canEditTaggedItems && (
                            <div className={`grid grid-cols-2 gap-8 h-[600px] ${showAllWithoutTagging ? 'opacity-60 pointer-events-none' : ''}`}>
                                <DataGridContentPanel
                                    key={`connect-${source}`}
                                    panelKey="connect"
                                    title={getTranslation('LABEL_CONNECT_EXISTING_STEP', currentLanguage).replace('{0}', getSourceStepLabel())}
                                    count={availableItems.length}
                                    countBadgeVariant="muted"
                                    items={availableItems}
                                    source={source}
                                    currentLanguage={currentLanguage}
                                    variant="available"
                                    containerSettings={data.settings}
                                    persistDisplayToSection={persistPanelDisplay}
                                    hideSectionDisplayControls={hidePanelDisplayControls}
                                    hidePublishingStatus={!canPublish}
                                    onTag={handleTag}
                                    onEdit={setEditingItem}
                                    emptyMessage={getTranslation('LABEL_NO_ITEMS_AVAILABLE', currentLanguage)}
                                />

                                <DataGridContentPanel
                                    key={`tagged-${source}`}
                                    panelKey="tagged"
                                    title={getTranslation('LABEL_ALREADY_TAGGED_STEP', currentLanguage).replace('{0}', getSourceStepLabel(true))}
                                    count={taggedItems.length}
                                    countBadgeVariant="primary"
                                    items={taggedItems}
                                    source={source}
                                    currentLanguage={currentLanguage}
                                    variant="tagged"
                                    containerSettings={data.settings}
                                    persistDisplayToSection={persistPanelDisplay}
                                    hideSectionDisplayControls={hidePanelDisplayControls}
                                    hidePublishingStatus={!canPublish}
                                    onUpdateSectionDisplay={updateSectionDisplay}
                                    taggedIds={taggedIds}
                                    onUntag={handleUntag}
                                    onEdit={setEditingItem}
                                    emptyMessage={getTranslation('LABEL_NO_ITEMS_TAGGED', currentLanguage)}
                                />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'SETTINGS' && hasSiteAdminSettingsAccess && (
                    <div className="pt-4 w-full space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                        {showDesignSettingsCard && (
                            <div className="bg-white p-8 border border-gray-200 shadow-sm rounded-sm space-y-8">

                                {/* Display Options */}
                                {canEditDisplayOptions && (
                                    <div>
                                        <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('LABEL_DISPLAY_OPTIONS', currentLanguage)}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                            <div className={`space-y-2 min-w-0 ${fieldShell(permitField('content.title') || permitSettings('showHeader'))}`} aria-hidden={!permitField('content.title') && !permitSettings('showHeader')}>
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <label className="text-xs font-bold text-gray-500 uppercase shrink-0">{getTranslation('LABEL_HEADING', currentLanguage)}</label>
                                                    <div className={`flex items-center gap-2 ml-auto shrink-0 ${fieldShell(permitSettings('showHeader'))}`} aria-hidden={!permitSettings('showHeader')}>
                                                        <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_HEADER', currentLanguage)}</span>
                                                        <VisibilityToggle
                                                            checked={data.settings.showHeader !== false}
                                                            onCheckedChange={(v) => updateSetting('showHeader', v)}
                                                            ariaLabel={getTranslation('LABEL_SHOW_HEADER', currentLanguage)}
                                                        />
                                                    </div>
                                                </div>
                                                {(data.settings.showHeader !== false) && permitField('content.title') && (
                                                    <input
                                                        className="w-full min-w-0 border p-2 text-sm rounded-sm"
                                                        value={getExactLanguageText(data.content.title, CONTENT_SOURCE_LANG)}
                                                        onChange={(e) => updateContent('title', e.target.value)}
                                                    />
                                                )}
                                            </div>
                                            <div className={`space-y-2 min-w-0 ${fieldShell(permitField('content.subtitle') || permitSettings('showSubheading'))}`} aria-hidden={!permitField('content.subtitle') && !permitSettings('showSubheading')}>
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <label className="text-xs font-bold text-gray-500 uppercase shrink-0">{getTranslation('LABEL_SUBHEADING', currentLanguage)}</label>
                                                    <div className={`flex items-center gap-2 ml-auto shrink-0 ${fieldShell(permitSettings('showSubheading'))}`} aria-hidden={!permitSettings('showSubheading')}>
                                                        <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_SUBHEADING', currentLanguage)}</span>
                                                        <VisibilityToggle
                                                            checked={data.settings.showSubheading !== false}
                                                            onCheckedChange={(v) => updateSetting('showSubheading', v)}
                                                            ariaLabel={getTranslation('LABEL_SHOW_SUBHEADING', currentLanguage)}
                                                        />
                                                    </div>
                                                </div>
                                                {(data.settings.showSubheading !== false) && permitField('content.subtitle') && (
                                                    <input
                                                        className="w-full min-w-0 border p-2 text-sm rounded-sm"
                                                        value={getExactLanguageText(data.content.subtitle, CONTENT_SOURCE_LANG)}
                                                        onChange={e => updateBaseHeaderField('subtitle', e.target.value, 'subheading')}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <div className={`space-y-2 ${fieldShell(permitField('content.description') || permitSettings('showDescription'))}`} aria-hidden={!permitField('content.description') && !permitSettings('showDescription')}>
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <label className="text-xs font-bold text-gray-500 uppercase shrink-0">{getTranslation('LABEL_DESCRIPTION', currentLanguage)}</label>
                                                <div className={`flex items-center gap-2 ml-auto shrink-0 ${fieldShell(permitSettings('showDescription'))}`} aria-hidden={!permitSettings('showDescription')}>
                                                    <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_DESC', currentLanguage)}</span>
                                                    <VisibilityToggle
                                                        checked={data.settings.showDescription !== false}
                                                        onCheckedChange={(v) => updateSetting('showDescription', v)}
                                                        ariaLabel={getTranslation('LABEL_SHOW_DESC', currentLanguage)}
                                                    />
                                                </div>
                                            </div>
                                            {(data.settings.showDescription !== false) && permitField('content.description') && (
                                                <JoditRichTextEditor
                                                    value={getExactLanguageText(data.content.description, CONTENT_SOURCE_LANG)}
                                                    onChange={(val: string) => updateBaseHeaderField('description', val, 'description')}
                                                    height={160}
                                                    placeholder={getTranslation('LABEL_RICH_TEXT_DESC', currentLanguage)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {source === 'ImageSlider' && data.settings.templateId === 'img_gallery' && canEditSlideDesign && (
                                    <div className="pt-4 border-t border-gray-100 mt-4">
                                        <SliderImageRadiusEditor
                                            imageSettings={parseSliderImageSettings(data.settings.imageSettings)}
                                            currentLanguage={currentLanguage}
                                            onChange={(imageSettings) => updateSetting('imageSettings', imageSettings)}
                                        />
                                    </div>
                                )}

                                {/* Typography Options */}
                                {canEditTypography && (
                                    <div className="pt-4 border-t border-gray-100 mt-4">
                                        <h4 className="font-bold text-gray-800 pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('LABEL_TYPOGRAPHY_OPTIONS', currentLanguage)}</h4>
                                        <div className="grid grid-cols-3 gap-6 mb-6">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_HEADING_COLOR', currentLanguage)}</label>
                                                <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={heroTitleColorSetting} onChange={(e) => updateHeroTitleColor(e.target.value)}>
                                                    <option value="site">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                                    <option value="black">{getTranslation('LABEL_BLACK', currentLanguage)}</option>
                                                    <option value="white">{getTranslation('LABEL_WHITE', currentLanguage)}</option>
                                                    <option value="custom">{getTranslation('LABEL_CUSTOM_COLOR', currentLanguage)}</option>
                                                </select>
                                                {heroTitleColorSetting === 'custom' && (
                                                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <ColorPicker value={heroTitleCustomColor} onChange={(v) => updateHeroTitleColor('custom', v)} />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_SUBHEADING_COLOR', currentLanguage)}</label>
                                                <select
                                                    className="w-full border p-2 text-sm rounded-sm bg-white mb-2"
                                                    value={heroSubtitleColorSetting}
                                                    onChange={(e) => updateHeroSubtitleColor(e.target.value)}
                                                >
                                                    <option value="site">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                                    <option value="black">{getTranslation('LABEL_BLACK', currentLanguage)}</option>
                                                    <option value="white">{getTranslation('LABEL_WHITE', currentLanguage)}</option>
                                                    <option value="custom">{getTranslation('LABEL_CUSTOM_COLOR', currentLanguage)}</option>
                                                </select>
                                                {heroSubtitleColorSetting === 'custom' && (
                                                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <ColorPicker value={heroSubtitleCustomColor} onChange={(v) => updateHeroSubtitleColor('custom', v)} />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_DESCRIPTION_COLOR', currentLanguage)}</label>
                                                <select
                                                    className="w-full border p-2 text-sm rounded-sm bg-white mb-2"
                                                    value={heroDescriptionColorSetting}
                                                    onChange={(e) => updateHeroDescriptionColor(e.target.value)}
                                                >
                                                    {HERO_DESCRIPTION_COLOR_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {getTranslation(opt.labelKey, currentLanguage)}
                                                        </option>
                                                    ))}
                                                </select>
                                                {heroDescriptionColorSetting === 'custom' && (
                                                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <ColorPicker value={heroDescriptionCustomColor} onChange={(v) => updateHeroDescriptionColor('custom', v)} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-6 mb-6 items-start">
                                            <HeroTypographyStyleColumn
                                                role="title"
                                                styleLabelKey="LABEL_HEADING_STYLE"
                                                customSectionLabelKey="LABEL_CUSTOM_HEADING_STYLE"
                                                settings={data.settings}
                                                updateSetting={updateSetting}
                                                currentLanguage={currentLanguage}
                                            />
                                            <HeroTypographyStyleColumn
                                                role="subtitle"
                                                styleLabelKey="LABEL_SUBHEADING_STYLE"
                                                customSectionLabelKey="LABEL_CUSTOM_SUBHEADING_STYLE"
                                                settings={data.settings}
                                                updateSetting={updateSetting}
                                                currentLanguage={currentLanguage}
                                            />
                                            <HeroTypographyStyleColumn
                                                role="description"
                                                styleLabelKey="LABEL_DESCRIPTION_STYLE"
                                                customSectionLabelKey="LABEL_CUSTOM_DESCRIPTION_STYLE"
                                                settings={data.settings}
                                                updateSetting={updateSetting}
                                                currentLanguage={currentLanguage}
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-6 mb-6 items-start">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_HEADING_LETTER_CASE', currentLanguage)}</label>
                                                <select
                                                    className="w-full border p-2 text-sm rounded-sm bg-white"
                                                    value={data.settings.letterCase || 'uppercase'}
                                                    onChange={(e) => updateSetting('letterCase', e.target.value)}
                                                >
                                                    <option value="uppercase">{getTranslation('LABEL_UPPERCASE', currentLanguage)}</option>
                                                    <option value="lowercase">{getTranslation('LABEL_LOWERCASE', currentLanguage)}</option>
                                                    <option value="sentence">{getTranslation('LABEL_SENTENCE_CASE', currentLanguage)}</option>
                                                    <option value="title">{getTranslation('LABEL_TITLE_CASE', currentLanguage)}</option>
                                                </select>
                                            </div>
                                            <div></div>
                                            <div></div>
                                        </div>
                                    </div>
                                )}

                                {/* Card Style — typography for individual card items */}
                                {canEditCardStyle && (
                                    <div className="pt-4 border-t border-gray-100 mt-4">
                                        <h4 className="font-bold text-gray-800 pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('SECTION_CARD_STYLE', currentLanguage)}</h4>
                                        {/* Row 1: card title — color, style, letter case */}
                                        <div className="grid grid-cols-3 gap-6 mb-6 items-start">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_CARD_TITLE_COLOR', currentLanguage)}</label>
                                                <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={cardTitleColorSetting} onChange={(e) => updateCardTitleColor(e.target.value)}>
                                                    <option value="site">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                                    <option value="black">{getTranslation('LABEL_BLACK', currentLanguage)}</option>
                                                    <option value="white">{getTranslation('LABEL_WHITE', currentLanguage)}</option>
                                                    <option value="custom">{getTranslation('LABEL_CUSTOM_COLOR', currentLanguage)}</option>
                                                </select>
                                                {cardTitleColorSetting === 'custom' && (
                                                    <ColorPicker value={cardTitleCustomColor} onChange={(v) => updateCardTitleColor('custom', v)} />
                                                )}
                                            </div>
                                            <HeroTypographyStyleColumn
                                                role="cardTitle"
                                                styleLabelKey="LABEL_CARD_TITLE_STYLE"
                                                customSectionLabelKey="LABEL_CUSTOM_CARD_TITLE_STYLE"
                                                settings={data.settings}
                                                updateSetting={updateSetting}
                                                currentLanguage={currentLanguage}
                                            />
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_CARD_LETTER_CASE', currentLanguage)}</label>
                                                <select
                                                    className="w-full border p-2 text-sm rounded-sm bg-white"
                                                    value={data.settings.cardLetterCase || 'uppercase'}
                                                    onChange={(e) => updateSetting('cardLetterCase', e.target.value)}
                                                >
                                                    <option value="uppercase">{getTranslation('LABEL_UPPERCASE', currentLanguage)}</option>
                                                    <option value="lowercase">{getTranslation('LABEL_LOWERCASE', currentLanguage)}</option>
                                                    <option value="sentence">{getTranslation('LABEL_SENTENCE_CASE', currentLanguage)}</option>
                                                    <option value="title">{getTranslation('LABEL_TITLE_CASE', currentLanguage)}</option>
                                                    <option value="none">{getTranslation('LABEL_NONE', currentLanguage)}</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-6 mb-6 items-start">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_CARD_TITLE_FONT_FAMILY', currentLanguage)}</label>
                                                <select
                                                    className="w-full border p-2 text-sm rounded-sm bg-white"
                                                    value={data.settings.cardTitleFontFamily || ''}
                                                    onChange={(e) => updateSetting('cardTitleFontFamily', e.target.value)}
                                                >
                                                    <option value="">{getTranslation('LABEL_CARD_TITLE_FONT_DEFAULT', currentLanguage)}</option>
                                                    {websiteFontOptions.map((option) => (
                                                        <option key={option.name} value={option.cssValue} style={{ fontFamily: option.cssValue }}>
                                                            {option.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        {/* Row 1b: card subtitle — color, style, letter case */}
                                        <div className="grid grid-cols-3 gap-6 mb-6 items-start">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_CARD_SUBTITLE_COLOR', currentLanguage)}</label>
                                                <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={cardSubtitleColorSetting} onChange={(e) => updateCardSubtitleColor(e.target.value)}>
                                                    {HERO_DESCRIPTION_COLOR_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {getTranslation(opt.labelKey, currentLanguage)}
                                                        </option>
                                                    ))}
                                                </select>
                                                {cardSubtitleColorSetting === 'custom' && (
                                                    <ColorPicker value={cardSubtitleCustomColor} onChange={(v) => updateCardSubtitleColor('custom', v)} />
                                                )}
                                            </div>
                                            <HeroTypographyStyleColumn
                                                role="cardSubtitle"
                                                styleLabelKey="LABEL_CARD_SUBTITLE_STYLE"
                                                customSectionLabelKey="LABEL_CUSTOM_CARD_SUBTITLE_STYLE"
                                                settings={data.settings}
                                                updateSetting={updateSetting}
                                                currentLanguage={currentLanguage}
                                            />
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_CARD_SUBTITLE_LETTER_CASE', currentLanguage)}</label>
                                                <select
                                                    className="w-full border p-2 text-sm rounded-sm bg-white"
                                                    value={data.settings.cardSubtitleLetterCase || 'none'}
                                                    onChange={(e) => updateSetting('cardSubtitleLetterCase', e.target.value)}
                                                >
                                                    <option value="uppercase">{getTranslation('LABEL_UPPERCASE', currentLanguage)}</option>
                                                    <option value="lowercase">{getTranslation('LABEL_LOWERCASE', currentLanguage)}</option>
                                                    <option value="sentence">{getTranslation('LABEL_SENTENCE_CASE', currentLanguage)}</option>
                                                    <option value="title">{getTranslation('LABEL_TITLE_CASE', currentLanguage)}</option>
                                                    <option value="none">{getTranslation('LABEL_NONE', currentLanguage)}</option>
                                                </select>
                                            </div>
                                        </div>
                                        {/* Row 2: card description & title rows */}
                                        <div className="grid grid-cols-3 gap-6 items-start">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_CARD_DESCRIPTION_COLOR', currentLanguage)}</label>
                                                <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={cardDescColorSetting} onChange={(e) => updateCardDescColor(e.target.value)}>
                                                    {HERO_DESCRIPTION_COLOR_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {getTranslation(opt.labelKey, currentLanguage)}
                                                        </option>
                                                    ))}
                                                </select>
                                                {cardDescColorSetting === 'custom' && (
                                                    <ColorPicker value={cardDescCustomColor} onChange={(v) => updateCardDescColor('custom', v)} />
                                                )}
                                            </div>
                                            <HeroTypographyStyleColumn
                                                role="cardDesc"
                                                styleLabelKey="LABEL_CARD_DESCRIPTION_STYLE"
                                                customSectionLabelKey="LABEL_CUSTOM_CARD_DESCRIPTION_STYLE"
                                                settings={data.settings}
                                                updateSetting={updateSetting}
                                                currentLanguage={currentLanguage}
                                            />
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                                    {currentLanguage === 'de' ? 'Karten-Titel Zeilen' :
                                                        currentLanguage === 'fr' ? 'Lignes de titre de la carte' :
                                                            currentLanguage === 'es' ? 'Filas del título de la tarjeta' :
                                                                'Card Title Rows'}
                                                </label>
                                                <select
                                                    className="w-full border p-2 text-sm rounded-sm bg-white"
                                                    value={data.settings.cardTitleRows || '0'}
                                                    onChange={(e) => updateSetting('cardTitleRows', e.target.value)}
                                                >
                                                    <option value="0">
                                                        {currentLanguage === 'de' ? 'Unbegrenzt' :
                                                            currentLanguage === 'fr' ? 'Illimité' :
                                                                currentLanguage === 'es' ? 'Ilimitado' :
                                                                    'Unlimited'}
                                                    </option>
                                                    <option value="1">
                                                        {currentLanguage === 'de' ? '1 Zeile' :
                                                            currentLanguage === 'fr' ? '1 ligne' :
                                                                currentLanguage === 'es' ? '1 fila' :
                                                                    '1 Row'}
                                                    </option>
                                                    <option value="2">
                                                        {currentLanguage === 'de' ? '2 Zeilen' :
                                                            currentLanguage === 'fr' ? '2 lignes' :
                                                                currentLanguage === 'es' ? '2 filas' :
                                                                    '2 Rows'}
                                                    </option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-6 mt-6 items-start">
                                            {isCardsContainer && (
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_CARD_BACKGROUND', currentLanguage)}</label>
                                                    <select
                                                        className="w-full border p-2 text-sm rounded-sm bg-white mb-2"
                                                        value={resolvedCardBgType}
                                                        onChange={(e) => updateSetting('cardBgType', e.target.value)}
                                                    >
                                                        <option value="none">{getTranslation('LABEL_NONE', currentLanguage)}</option>
                                                        <option value="site-color">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                                        <option value="color">
                                                            {currentLanguage === 'de' ? 'Benutzerdefinierte Hintergrundfarbe' :
                                                                currentLanguage === 'fr' ? 'Couleur d’arrière-plan personnalisée' :
                                                                    currentLanguage === 'es' ? 'Color de fondo personalizado' :
                                                                        'Custom Background Color'}
                                                        </option>
                                                    </select>
                                                    {resolvedCardBgType === 'color' && (
                                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                            <ColorPicker value={resolvedCardBgColor} onChange={(v) => updateSetting('cardBgColor', v)} />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_CARD_TITLE_FONT_FAMILY', currentLanguage)}</label>
                                                <select
                                                    className="w-full border p-2 text-sm rounded-sm bg-white"
                                                    value={data.settings.cardTitleFontFamily || ''}
                                                    onChange={(e) => updateSetting('cardTitleFontFamily', e.target.value)}
                                                >
                                                    <option value="">{getTranslation('LABEL_CARD_TITLE_FONT_DEFAULT', currentLanguage)}</option>
                                                    {websiteFontOptions.map((option) => (
                                                        <option key={option.name} value={option.cssValue} style={{ fontFamily: option.cssValue }}>
                                                            {option.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Layout, card settings & technical options */}
                        {showLayoutConfigCard && (
                            <div className="bg-white p-8 border border-gray-200 shadow-sm rounded-sm space-y-8">
                                {canEditLayoutBehavior && (
                                    <div>
                                        <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('LABEL_LAYOUT_BEHAVIOR', currentLanguage)}</h4>
                                        {source === 'ImageSlider' ? (
                                            <>
                                                {permitSettings('align') && (
                                                    <VisualSelector
                                                        label={getTranslation('LABEL_CONTAINER_HEADER_ALIGNMENT', currentLanguage)}
                                                        value={data.settings.align || 'left'}
                                                        onChange={(v: any) => updateSetting('align', v)}
                                                        options={[
                                                            { value: 'left', label: getTranslation('LABEL_LEFT', currentLanguage), icon: AlignLeft },
                                                            { value: 'center', label: getTranslation('LABEL_CENTER', currentLanguage), icon: AlignCenter },
                                                            { value: 'right', label: getTranslation('LABEL_RIGHT', currentLanguage), icon: AlignRight }
                                                        ]}
                                                    />
                                                )}
                                                {permitSettings('contentAlign') && (
                                                    <VisualSelector
                                                        label={getTranslation('LABEL_SLIDE_CONTENT_ALIGNMENT', currentLanguage)}
                                                        value={data.settings.contentAlign || 'left'}
                                                        onChange={(v: any) => updateSetting('contentAlign', v)}
                                                        options={[
                                                            { value: 'left', label: getTranslation('LABEL_LEFT', currentLanguage), icon: AlignLeft },
                                                            { value: 'center', label: getTranslation('LABEL_CENTER', currentLanguage), icon: AlignCenter },
                                                            { value: 'right', label: getTranslation('LABEL_RIGHT', currentLanguage), icon: AlignRight }
                                                        ]}
                                                    />
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <div className={fieldShell(canEditContentAlign)} aria-hidden={!canEditContentAlign}>
                                                    <VisualSelector label={getTranslation('LABEL_CONTENT_ALIGNMENT', currentLanguage)} value={data.settings.align || 'left'} onChange={(v: any) => updateSetting('align', v)} options={[{ value: 'left', label: getTranslation('LABEL_LEFT', currentLanguage), icon: AlignLeft }, { value: 'center', label: getTranslation('LABEL_CENTER', currentLanguage), icon: AlignCenter }, { value: 'right', label: getTranslation('LABEL_RIGHT', currentLanguage), icon: AlignRight }]} />
                                                </div>
                                                {isCardsContainer && (
                                                    <div className={fieldShell(canEditContentAlign)} aria-hidden={!canEditContentAlign}>
                                                        <VisualSelector
                                                            label={getTranslation('LABEL_CARD_CONTAINER_ALIGNMENT', currentLanguage)}
                                                            value={data.settings.cardAlign || 'left'}
                                                            onChange={(v: any) => updateSetting('cardAlign', v)}
                                                            options={[
                                                                { value: 'left', label: getTranslation('LABEL_LEFT', currentLanguage), icon: AlignLeft },
                                                                { value: 'center', label: getTranslation('LABEL_CENTER', currentLanguage), icon: AlignCenter },
                                                                { value: 'right', label: getTranslation('LABEL_RIGHT', currentLanguage), icon: AlignRight }
                                                            ]}
                                                        />
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {data.settings.templateId !== 'img_gallery' && (
                                            <div className={fieldShell(permitSettings('columns'))} aria-hidden={!permitSettings('columns')}>
                                                <VisualSelector label={getTranslation('LABEL_COLUMNS', currentLanguage)} value={data.settings.columns || 3} onChange={(v: any) => updateSetting('columns', v)} options={[{ value: 1, label: `1 ${getTranslation('LABEL_COLUMN', currentLanguage)}`, icon: Smartphone }, { value: 2, label: `2 ${getTranslation('LABEL_COLUMNS', currentLanguage)}`, icon: Tablet }, { value: 3, label: `3 ${getTranslation('LABEL_COLUMNS', currentLanguage)}`, icon: Monitor }]} />
                                            </div>
                                        )}
                                        <div className={fieldShell(permitSettings('ordering'))} aria-hidden={!permitSettings('ordering')}>
                                            <VisualSelector
                                                label={getTranslation('LABEL_ORDERING_TYPE', currentLanguage)}
                                                value={data.settings.ordering || '123'}
                                                onChange={(v: any) => updateSetting('ordering', v)}
                                                options={[
                                                    { value: '123', label: '123' },
                                                    { value: 'III', label: 'I II III' },
                                                    { value: 'IIIII', label: 'IIIII', icon: AlignJustify },
                                                    { value: 'ABC', label: 'ABC' },
                                                    { value: 'abc', label: 'abc' },
                                                    { value: 'dots', label: '...', icon: MoreHorizontal },
                                                    { value: 'none', label: getTranslation('LABEL_NONE', currentLanguage), icon: X }
                                                ]}
                                            />
                                        </div>
                                        <div className={`${data.settings.templateId === 'img_gallery' ? 'block' : 'grid grid-cols-2 gap-8'} ${fieldShell(canEditLayoutBorder)}`} aria-hidden={!canEditLayoutBorder}>
                                            <VisualSelector label={getTranslation('LABEL_CARD_BORDER', currentLanguage)} value={data.settings.border || 'sharp'} onChange={(v: any) => updateSetting('border', v)} options={[{ value: 'sharp', label: getTranslation('LABEL_SHARP', currentLanguage), icon: Square }, { value: 'rounded', label: getTranslation('LABEL_ROUNDED', currentLanguage), icon: Square }, { value: 'none', label: getTranslation('LABEL_NONE', currentLanguage), icon: X }]} />
                                            {data.settings.templateId !== 'img_gallery' && (
                                                <VisualSelector
                                                    label={getTranslation('LABEL_IMAGE_POSITION', currentLanguage)}
                                                    value={data.settings.imgPos || 'top'}
                                                    onChange={(v: any) => updateSetting('imgPos', v)}
                                                    options={[
                                                        { value: 'top', label: getTranslation('LABEL_TOP', currentLanguage), icon: AlignCenter },
                                                        { value: 'left', label: getTranslation('LABEL_LEFT', currentLanguage), icon: AlignLeft },
                                                        { value: 'right', label: getTranslation('LABEL_RIGHT', currentLanguage), icon: AlignRight },
                                                        { value: 'none', label: getTranslation('LABEL_NONE', currentLanguage), icon: X }
                                                    ]}
                                                />
                                            )}
                                        </div>
                                        {data.settings.templateId !== 'img_gallery' && (
                                            <VisualSelector
                                                label={getTranslation('LABEL_IMAGE_BORDER_SECTION', currentLanguage)}
                                                value={data.settings.imgBorder || (['sharp', 'rounded', 'circle', 'halfcircle'].includes(data.settings.border) ? data.settings.border : 'sharp')}
                                                onChange={(v: any) => updateSetting('imgBorder', v)}
                                                options={[
                                                    { value: 'sharp', label: getTranslation('LABEL_SHARP_CORNERS', currentLanguage), icon: Square },
                                                    { value: 'rounded', label: getTranslation('LABEL_ROUNDED_CORNERS', currentLanguage), icon: Square },
                                                    { value: 'circle', label: getTranslation('LABEL_CIRCLE', currentLanguage), icon: Circle },
                                                    { value: 'halfcircle', label: getTranslation('LABEL_HALFCIRCLE', currentLanguage), icon: Circle }
                                                ]}
                                            />
                                        )}
                                        {data.settings.templateId !== 'img_gallery' && (
                                            <div className={fieldShell(permitSettings('contentViewMode'))} aria-hidden={!permitSettings('contentViewMode')}>
                                                <VisualSelector label={getTranslation('LABEL_CARD_LAYOUT', currentLanguage)} value={data.settings.layout || 'grid'} onChange={(v: any) => updateSetting('layout', v)} options={[{ value: 'grid', label: getTranslation('LABEL_GRID', currentLanguage), icon: Monitor }, { value: 'slider', label: getTranslation('LABEL_SLIDER', currentLanguage), icon: ListIcon }]} />
                                            </div>
                                        )}

                                        {data.settings.templateId !== 'img_gallery' && normalizedSource === 'Smart Pages' && (
                                            <VisualSelector
                                                label={getTranslation('LABEL_SMART_PAGE_CARD_LINK_TARGET', currentLanguage)}
                                                value={data.settings.smartPageOpenInNewTab ? 'new' : 'current'}
                                                onChange={(v: string) => updateSetting('smartPageOpenInNewTab', v === 'new')}
                                                options={[
                                                    { value: 'current', label: getTranslation('LABEL_OPEN_IN_CURRENT_TAB', currentLanguage), icon: Monitor },
                                                    { value: 'new', label: getTranslation('LABEL_OPEN_IN_NEW_TAB', currentLanguage), icon: Globe },
                                                ]}
                                            />
                                        )}

                                        {data.settings.templateId !== 'img_gallery' && (normalizedSource === 'News' || normalizedSource === 'Event') && (
                                            <VisualSelector
                                                label={currentLanguage === 'de' ? 'Karten-Titel Aktion' :
                                                    currentLanguage === 'fr' ? 'Action du titre de la carte' :
                                                        currentLanguage === 'es' ? 'Acción de título de tarjeta' :
                                                            'Card Title Action'}
                                                value={data.settings.cardTitleOpenPanel ? 'panel' : 'none'}
                                                onChange={(v: string) => updateSetting('cardTitleOpenPanel', v === 'panel')}
                                                options={[
                                                    { value: 'none', label: currentLanguage === 'de' ? 'Keine Aktion (Standard)' : 'No Action (Default)', icon: X },
                                                    { value: 'panel', label: currentLanguage === 'de' ? 'Details-Panel öffnen' : 'Open Details Panel', icon: Monitor },
                                                ]}
                                            />
                                        )}

                                        {data.settings.templateId !== 'img_gallery' && normalizedSource !== 'Smart Pages' && (
                                            <div className={`pt-2 border-t border-gray-100 ${fieldShell(permitSettings('ordering'))}`} aria-hidden={!permitSettings('ordering')}>
                                                <div className="flex items-center gap-2 text-xs text-gray-600 mb-2 flex-nowrap">
                                                    <span className="whitespace-nowrap">{getTranslation('LABEL_SORT_BY', currentLanguage)} ({getTranslation('LABEL_SETTINGS', currentLanguage)})</span>
                                                    <SortByHelpIcon variant="cards" />
                                                    <div className="relative inline-flex shrink-0">
                                                        <select
                                                            className="border border-gray-300 py-2 pl-3 pr-8 text-sm rounded-sm bg-white focus:ring-1 focus:ring-[var(--primary-color)] outline-none cursor-pointer w-[9.75rem] max-w-full"
                                                            style={{
                                                                appearance: 'none',
                                                                WebkitAppearance: 'none',
                                                                MozAppearance: 'none',
                                                                backgroundImage: 'none',
                                                            }}
                                                            value={normalizeSectionSortField(source, data.settings.sortField as string | undefined)}
                                                            onChange={(e) => updateSetting('sortField', e.target.value)}
                                                        >
                                                            {getDataGridSortOptions(source, currentLanguage, getTranslation).map((option) => (
                                                                <option key={option.key} value={option.key}>{option.label}</option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateSetting('sortDirection', data.settings.sortDirection === 'asc' ? 'desc' : 'asc')}
                                                        className="p-1.5 border border-gray-300 rounded-sm hover:bg-[var(--brand-light)]"
                                                        style={{ color: 'var(--primary-color)' }}
                                                        title={
                                                            (data.settings.sortDirection || getDefaultDataGridSortConfig(source).direction) === 'asc'
                                                                ? getTranslation('BTN_SORT_ASCENDING', currentLanguage)
                                                                : getTranslation('BTN_SORT_DESCENDING', currentLanguage)
                                                        }
                                                    >
                                                        {(data.settings.sortDirection || getDefaultDataGridSortConfig(source).direction) === 'asc'
                                                            ? <ArrowUpAZ className="w-4 h-4" />
                                                            : <ArrowDownAZ className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {(source === 'ImageSlider' || data.settings.layout === 'slider') && (
                                            <>
                                                {(source === 'ImageSlider' && data.settings.templateId === 'img_gallery') ? (
                                                    <div className="bg-gray-50 p-6 border border-gray-200 rounded-sm space-y-6">
                                                        <div>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <label className="text-xs font-bold text-gray-500 uppercase">{getTranslation('LABEL_SPEED_AUTOPLAY', currentLanguage)}</label>
                                                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => updateSetting('autoplay', !data.settings.autoplay)}>
                                                                    <span className="text-xs">{getTranslation('LABEL_AUTOPLAY', currentLanguage)}</span>
                                                                    <div className={`w-8 h-4 rounded-full relative transition-colors ${data.settings.autoplay ? 'bg-[var(--primary-color)]' : 'bg-gray-300'}`}>
                                                                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform ${data.settings.autoplay ? 'left-4.5' : 'left-0.5'}`} style={{ left: data.settings.autoplay ? '18px' : '2px' }} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4 bg-white p-2.5 border border-gray-200 rounded-sm shadow-sm ring-1 ring-black/5">
                                                                <input type="range" min="1" max="10" step="1" value={data.settings.speed || 5} onChange={(e) => updateSetting('speed', parseFloat(e.target.value))} className="flex-1 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]" />
                                                                <span className="text-xs font-mono w-8 text-right font-bold text-gray-600">{data.settings.speed || 5}s</span>
                                                            </div>
                                                        </div>

                                                        <div className="pt-4 border-t border-gray-200 space-y-4">
                                                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{getTranslation('LABEL_NAVIGATION_CONTROLS', currentLanguage)}</label>
                                                            <div className="flex flex-col gap-3">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_ARROWS', currentLanguage)}</span>
                                                                    <VisibilityToggle
                                                                        checked={data.settings.arrows !== false}
                                                                        onCheckedChange={(v) => updateSetting('arrows', v)}
                                                                        ariaLabel={getTranslation('LABEL_SHOW_ARROWS', currentLanguage)}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_DOTS', currentLanguage)}</span>
                                                                    <VisibilityToggle
                                                                        checked={data.settings.dots !== false}
                                                                        onCheckedChange={(v) => updateSetting('dots', v)}
                                                                        ariaLabel={getTranslation('LABEL_SHOW_DOTS', currentLanguage)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-gray-50 p-6 border border-gray-200 rounded-sm space-y-6">
                                                        <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                                            <Play className="w-4 h-4" /> {getTranslation('LABEL_SLIDER_CONFIGURATION', currentLanguage)}
                                                        </h4>

                                                        <div className={`grid ${source === 'ImageSlider' ? 'grid-cols-2' : 'grid-cols-1'} gap-8`}>
                                                            {source === 'ImageSlider' && (
                                                                <VisualSelector
                                                                    label={getTranslation('LABEL_SLIDER_STYLE', currentLanguage)}
                                                                    value={data.settings.templateId || 'img_text'}
                                                                    onChange={(v: any) => updateSetting('templateId', v)}
                                                                    options={[
                                                                        { value: 'img_text', label: getTranslation('LABEL_CLASSIC_SLIDER', currentLanguage), icon: Presentation },
                                                                        { value: 'img_gallery', label: getTranslation('LABEL_GALLERY_CAROUSEL', currentLanguage), icon: ImageIcon }
                                                                    ]}
                                                                />
                                                            )}

                                                            <div>
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <label className="text-xs font-bold text-gray-500 uppercase">{getTranslation('LABEL_SPEED_AUTOPLAY', currentLanguage)}</label>
                                                                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => updateSetting('autoplay', !data.settings.autoplay)}>
                                                                        <span className="text-xs">{getTranslation('LABEL_AUTOPLAY', currentLanguage)}</span>
                                                                        <div className={`w-8 h-4 rounded-full relative transition-colors ${data.settings.autoplay ? 'bg-[var(--primary-color)]' : 'bg-gray-300'}`}>
                                                                            <div className={`w-3 h-3 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform ${data.settings.autoplay ? 'left-4.5' : 'left-0.5'}`} style={{ left: data.settings.autoplay ? '16px' : '2px' }} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-4 bg-white p-2.5 border border-gray-200 rounded-sm">
                                                                    <input type="range" min="1" max="10" step="1" value={data.settings.speed || 5} onChange={(e) => updateSetting('speed', parseFloat(e.target.value))} className="flex-1 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]" />
                                                                    <span className="text-xs font-mono w-8 text-right">{data.settings.speed || 5}s</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {source === 'ImageSlider' && (
                                                            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                                                                <div className="space-y-4">
                                                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{getTranslation('LABEL_NAVIGATION_CONTROLS', currentLanguage)}</label>
                                                                    <div className="flex flex-col gap-3">
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_ARROWS', currentLanguage)}</span>
                                                                            <VisibilityToggle
                                                                                checked={data.settings.arrows !== false}
                                                                                onCheckedChange={(v) => updateSetting('arrows', v)}
                                                                                ariaLabel={getTranslation('LABEL_SHOW_ARROWS', currentLanguage)}
                                                                            />
                                                                        </div>
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_DOTS', currentLanguage)}</span>
                                                                            <VisibilityToggle
                                                                                checked={data.settings.dots !== false}
                                                                                onCheckedChange={(v) => updateSetting('dots', v)}
                                                                                ariaLabel={getTranslation('LABEL_SHOW_DOTS', currentLanguage)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-4">
                                                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{getTranslation('LABEL_SLIDE_CONTENT_VISIBILITY', currentLanguage)}</label>
                                                                    <div className="flex flex-col gap-3">
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_TITLES', currentLanguage)}</span>
                                                                            <VisibilityToggle
                                                                                checked={data.settings.showSlideTitle !== false}
                                                                                onCheckedChange={(v) => updateSetting('showSlideTitle', v)}
                                                                                ariaLabel={getTranslation('LABEL_TITLES', currentLanguage)}
                                                                            />
                                                                        </div>
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_DESCRIPTIONS', currentLanguage)}</span>
                                                                            <VisibilityToggle
                                                                                checked={data.settings.showSlideDescription !== false}
                                                                                onCheckedChange={(v) => updateSetting('showSlideDescription', v)}
                                                                                ariaLabel={getTranslation('LABEL_DESCRIPTIONS', currentLanguage)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {source === 'ImageSlider' && data.settings.templateId === 'img_text' && (
                                                            <div className="pt-4 border-t border-gray-200">
                                                                <VisualSelector
                                                                    label={getTranslation('LABEL_CONTENT_OVERLAY_POSITION', currentLanguage)}
                                                                    value={data.settings.overlayPosition || 'center'}
                                                                    onChange={(v: any) => updateSetting('overlayPosition', v)}
                                                                    options={[
                                                                        { value: 'center', label: getTranslation('LABEL_CENTER', currentLanguage), icon: AlignCenter },
                                                                        { value: 'bottom', label: getTranslation('LABEL_BOTTOM', currentLanguage), icon: AlignJustify }
                                                                    ]}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {permitSettings('showAllWithoutTagging') && (
                                            <label className="flex items-start gap-2 mt-4 cursor-pointer group p-3 border border-gray-200 rounded-sm bg-white">
                                                <input
                                                    type="checkbox"
                                                    checked={showAllWithoutTagging}
                                                    onChange={e => updateSetting('showAllWithoutTagging', e.target.checked)}
                                                    className="w-4 h-4 mt-0.5 accent-[var(--primary-color)] cursor-pointer flex-shrink-0"
                                                />
                                                <span className="text-sm text-gray-700 group-hover:text-gray-900 leading-snug">
                                                    {getTranslation('LABEL_SHOW_ALL_WITHOUT_TAGGING', currentLanguage)}
                                                </span>
                                            </label>
                                        )}
                                    </div>
                                )}

                                {/* Card Settings */}
                                {canEditCardSettings && (data.settings.templateId !== 'img_gallery' || source === 'ImageSlider') && (
                                    <div>
                                        <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('LABEL_CARD_SETTINGS', currentLanguage)}</h4>
                                        <div className="space-y-4">
                                            {data.settings.templateId !== 'img_gallery' && (
                                                <label className="flex items-center gap-3 cursor-pointer group p-3 border border-gray-200 rounded-sm bg-white">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!data.settings.useOldCardLayout}
                                                        onChange={e => updateSetting('useOldCardLayout', e.target.checked)}
                                                        className="w-4 h-4 accent-[var(--primary-color)] cursor-pointer"
                                                    />
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-700 group-hover:text-[var(--primary-color)] transition-colors">
                                                            {getTranslation('LABEL_USE_SITE_CARD_LAYOUT', currentLanguage)}
                                                        </span>
                                                    </div>
                                                </label>
                                            )}

                                            {supportsCardReadMore && (
                                                <>
                                                    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-sm bg-white">
                                                        <label className="text-sm font-medium text-gray-700">
                                                            {getTranslation('LABEL_ENABLE_READ_MORE_BUTTON', currentLanguage)}
                                                        </label>
                                                        <VisibilityToggle
                                                            checked={!!data.settings.enableCardReadMore}
                                                            onCheckedChange={(next) => {
                                                                updateSetting('enableCardReadMore', next);
                                                                if (next && !data.settings.readMoreBehavior) {
                                                                    updateSetting('readMoreBehavior', 'popup');
                                                                }
                                                            }}
                                                            ariaLabel={getTranslation('LABEL_ENABLE_READ_MORE_BUTTON', currentLanguage)}
                                                        />
                                                    </div>

                                                    {!!data.settings.enableCardReadMore && (
                                                        <div className="space-y-4">
                                                            <VisualSelector
                                                                label={getTranslation('LABEL_READ_MORE_DISPLAY_TYPE', currentLanguage)}
                                                                value={data.settings.readMoreDisplayType === 'button' ? 'button' : 'link'}
                                                                onChange={(v: any) => updateSetting('readMoreDisplayType', v)}
                                                                options={[
                                                                    { value: 'link', label: getTranslation('LABEL_READ_MORE_AS_LINK', currentLanguage) },
                                                                    { value: 'button', label: getTranslation('LABEL_READ_MORE_AS_BUTTON', currentLanguage) }
                                                                ]}
                                                            />
                                                            <VisualSelector
                                                                label={getTranslation('LABEL_READ_MORE_BEHAVIOR', currentLanguage)}
                                                                value={data.settings.readMoreBehavior || 'popup'}
                                                                onChange={(v: any) => updateSetting('readMoreBehavior', v)}
                                                                options={[
                                                                    { value: 'popup', label: getTranslation('LABEL_READ_MORE_POPUP', currentLanguage) },
                                                                    { value: 'expand', label: getTranslation('LABEL_READ_MORE_EXPAND', currentLanguage) }
                                                                ]}
                                                            />
                                                            <VisualSelector
                                                                label={data.settings.readMoreDisplayType === 'button'
                                                                    ? getTranslation('LABEL_READ_MORE_BUTTON_SIZE', currentLanguage)
                                                                    : getTranslation('LABEL_READ_MORE_LINK_SIZE', currentLanguage)}
                                                                value={data.settings.readMoreButtonSize || 'md'}
                                                                onChange={(v: any) => updateSetting('readMoreButtonSize', v)}
                                                                options={[
                                                                    { value: 'sm', label: getTranslation('LABEL_SMALL', currentLanguage) },
                                                                    { value: 'md', label: getTranslation('LABEL_MEDIUM', currentLanguage) },
                                                                    { value: 'lg', label: getTranslation('LABEL_LARGE', currentLanguage) }
                                                                ]}
                                                            />
                                                            <VisualSelector
                                                                label={getTranslation('LABEL_READ_MORE_POSITION', currentLanguage)}
                                                                value={data.settings.readMoreAlignment === 'center' || data.settings.readMoreAlignment === 'right'
                                                                    ? data.settings.readMoreAlignment
                                                                    : 'left'}
                                                                onChange={(v: any) => updateSetting('readMoreAlignment', v)}
                                                                options={[
                                                                    { value: 'left', label: getTranslation('LABEL_LEFT', currentLanguage) },
                                                                    { value: 'center', label: getTranslation('LABEL_CENTER', currentLanguage) },
                                                                    { value: 'right', label: getTranslation('LABEL_RIGHT', currentLanguage) }
                                                                ]}
                                                            />
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {!isRestrictedEditor && (
                                    <>
                                        {/* Identity */}
                                        <div>
                                            <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('LABEL_CONTAINER_IDENTITY', currentLanguage)}</h4>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_CONTAINER_TITLE_INTERNAL', currentLanguage)}</label>
                                                    <input className="w-full border p-2.5 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded-sm" value={data.title || ''} onChange={(e) => setData({ ...data, title: e.target.value })} placeholder={getTranslation('LABEL_INTERNAL_TITLE_NEWS_EXAMPLE', currentLanguage)} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_DATA_SOURCE', currentLanguage)}</label>
                                                    {canChangeDataSource ? (
                                                        <select
                                                            className="w-full border p-2 text-sm rounded-sm bg-white focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                                            value={
                                                                normalizedSource === 'Smart Pages'
                                                                    ? 'SmartPages'
                                                                    : String(source || 'News')
                                                            }
                                                            onChange={(e) => handleDataSourceChange(e.target.value)}
                                                        >
                                                            {TEMPLATE_DATA_SOURCE_OPTIONS.map((ds) => (
                                                                <option key={ds} value={ds}>
                                                                    {ds === 'Container Items'
                                                                        ? getTranslation('DATA_SOURCE_CONTAINER_ITEMS', currentLanguage)
                                                                        : ds === 'SmartPages'
                                                                            ? 'Smart Pages'
                                                                            : ds}
                                                                </option>
                                                            ))}
                                                            {data.type === ContainerType.SLIDER && (
                                                                <option value="ImageSlider">Image Slider</option>
                                                            )}
                                                        </select>
                                                    ) : (
                                                        <input className="w-full border p-2 text-sm bg-gray-100 text-gray-600 rounded-sm" value={source} readOnly />
                                                    )}
                                                    <label className="flex items-start gap-2 mt-3 cursor-pointer group">
                                                        <input
                                                            type="checkbox"
                                                            checked={showAllWithoutTagging}
                                                            onChange={e => updateSetting('showAllWithoutTagging', e.target.checked)}
                                                            className="w-4 h-4 mt-0.5 accent-[var(--primary-color)] cursor-pointer flex-shrink-0"
                                                        />
                                                        <span className="text-sm text-gray-700 group-hover:text-gray-900 leading-snug">
                                                            {getTranslation('LABEL_SHOW_ALL_WITHOUT_TAGGING', currentLanguage)}
                                                        </span>
                                                    </label>
                                                </div>
                                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_UNIQUE_CONTAINER_ID', currentLanguage)}</label><div className="flex gap-2"><input className="flex-1 border p-2 text-sm bg-gray-100 text-gray-600 rounded-sm" value={data.id} readOnly /><button className="px-3 py-2 border text-xs font-bold bg-white hover:bg-gray-50 rounded-sm">{getTranslation('LABEL_GENERATE', currentLanguage)}</button></div></div>
                                            </div>
                                        </div>

                                        {/* Added to Pages */}
                                        <div>
                                            <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('LABEL_ADDED_TO_PAGES', currentLanguage)}</h4>
                                            <div className="border border-gray-200 p-3 rounded-sm bg-gray-50 text-sm text-gray-500 italic">
                                                Read-only list of pages would appear here.
                                            </div>
                                        </div>

                                    </>
                                )}

                            </div>
                        )}

                        <SectionCustomizationEditor
                            settings={data.settings}
                            onChange={updateSetting}
                            currentLanguage={currentLanguage}
                            showSectionBackground={isCardsContainer}
                        />
                    </div>
                )}

                {activeTab === 'TRANSLATION' && showTranslationTab && (
                    <UebersetzungTab
                        data={data}
                        onUpdate={updateUebersetzungContent}
                        targetLanguages={optionalTranslationLanguages}
                        fields={[
                            {
                                key: 'title',
                                label: getTranslation('LABEL_HEADER_TITLE', currentLanguage),
                                type: 'input',
                                getValue: (language: string) => getGridHeaderTranslationValue('title', 'heading', language as LanguageCode),
                                onChange: (value: string, lang: LanguageCode) => updateGridHeaderTranslationValue('title', value, 'heading', lang)
                            },
                            {
                                key: 'subtitle',
                                label: getTranslation('LABEL_SUBHEADING', currentLanguage),
                                type: 'input',
                                getValue: (language: string) => getGridHeaderTranslationValue('subtitle', 'subheading', language as LanguageCode),
                                onChange: (value: string, lang: LanguageCode) => updateGridHeaderTranslationValue('subtitle', value, 'subheading', lang)
                            },
                            {
                                key: 'description',
                                label: getTranslation('LABEL_DESCRIPTION', currentLanguage),
                                type: 'rich',
                                getValue: (language: string) => getGridHeaderTranslationValue('description', 'description', language as LanguageCode),
                                onChange: (value: string, lang: LanguageCode) => updateGridHeaderTranslationValue('description', value, 'description', lang)
                            }
                        ]}
                    />
                )}
            </div>

            {/* Create Modals */}
            {showCreate && source === 'News' && <CreateNewsModal onSave={handleCreateInit} onCancel={() => setShowCreate(false)} />}
            {showCreate && source === 'Event' && <CreateEventModal onSave={handleCreateInit} onCancel={() => setShowCreate(false)} />}
            {showCreate && source === 'Document' && <AddDocumentModal onSave={handleCreateInit} onCancel={() => setShowCreate(false)} />}
            {showCreate && source === 'Container Items' && <CreateContainerItemModal onSave={handleCreateInit} onCancel={() => setShowCreate(false)} />}
            {showCreate && source === 'Contact' && <CreateContactModal onSave={handleCreateInit} onCancel={() => setShowCreate(false)} />}
            {showCreate && source === 'ImageSlider' && <CreateSliderItemModal onSave={handleCreateInit} onCancel={() => setShowCreate(false)} />}
            {showCreate && normalizedSource === 'Smart Pages' && <CreateSmartPageModal onSave={handleCreateInit} onCancel={() => setShowCreate(false)} />}

            {/* Edit Modals (non-ImageSlider) */}
            {editingItem && normalizedSource === 'News' && (
                <NewsEditor item={editingItem} onSave={handleSaveEdit} onCancel={() => setEditingItem(null)} onDelete={(id: string) => setDeleteId(id)} />
            )}
            {editingItem && normalizedSource === 'Event' && (
                <EventEditor item={editingItem} onSave={handleSaveEdit} onCancel={() => setEditingItem(null)} onDelete={(id: string) => setDeleteId(id)} />
            )}
            {editingItem && normalizedSource === 'Document' && (
                <DocumentEditor item={editingItem} changeOrderContext={taggedOrderChangeContext} onSave={handleSaveEdit} onCancel={() => setEditingItem(null)} onDelete={(id: string) => setDeleteId(id)} />
            )}
            {editingItem && normalizedSource === 'Container Items' && (
                <ContainerItemEditor item={editingItem} containerId={data.id} changeOrderContext={taggedOrderChangeContext} onSave={handleSaveEdit} onCancel={() => setEditingItem(null)} onDelete={(id: string) => setDeleteId(id)} />
            )}
            {editingItem && normalizedSource === 'Contact' && (
                <ContactEditor item={editingItem} containerId={data.id} changeOrderContext={taggedOrderChangeContext} onSave={handleSaveEdit} onCancel={() => setEditingItem(null)} onDelete={(id: string) => setDeleteId(id)} />
            )}
            {editingItem && normalizedSource === 'ImageSlider' && (
                <SliderItemEditor item={editingItem} onSave={handleSaveEdit} onCancel={() => setEditingItem(null)} onDelete={(id: string) => setDeleteId(id)} />
            )}
            {editingItem && normalizedSource === 'Smart Pages' && <SmartPageEditor item={editingItem} onSave={handleSaveEdit} onCancel={() => setEditingItem(null)} onDelete={(id: string) => setDeleteId(id)} />}

            {deleteId && (
                <ConfirmDeleteDialog
                    title={`Delete ${source === 'ImageSlider' ? 'Slider Item' : source}`}
                    message={`Are you sure you want to delete this ${source === 'ImageSlider' ? 'slider item' : source.toLowerCase()}? This action cannot be undone.`}
                    onConfirm={() => {
                        if (source === 'News') deleteNews(deleteId);
                        else if (source === 'Event') deleteEvent(deleteId);
                        else if (source === 'Document') deleteDocument(deleteId);
                        else if (source === 'Container Items') deleteContainerItem(deleteId);
                        else if (source === 'Contact') deleteContact(deleteId);
                        else if (source === 'ImageSlider') deleteSliderItem(deleteId);
                        else if (normalizedSource === 'Smart Pages') deletePage(deleteId);
                        setDeleteId(null);
                        setEditingItem(null);
                    }}
                    onCancel={() => setDeleteId(null)}
                />
            )}
        </div>
    );
};

const contactFormTypographyToStyle = (
    typo: ReturnType<typeof resolveHeroTypography>,
    cssVarKey?: string
): React.CSSProperties => {
    const style: Record<string, string | number> = {};
    if (typo.fontSize) {
        style.fontSize = typo.fontSize;
        if (cssVarKey) style[cssVarKey] = typo.fontSize;
    }
    if (typo.fontWeight != null && typo.fontWeight !== '') {
        style.fontWeight = typo.fontWeight;
    }
    if (typo.lineHeight) {
        style.lineHeight = typo.lineHeight;
    }
    return style as React.CSSProperties;
};

const ContactFormEditor = ({ data, setData, onClose, editorAccess }: ContainerEditorChildProps) => {
    // ... [Previous ContactFormEditor code remains unchanged]
    const [activeTab, setActiveTab] = useState<'TEXT' | 'PREVIEW' | 'TRANSLATION'>('TEXT');
    const [fieldToDelete, setFieldToDelete] = useState<{ id: string; label: string } | null>(null);
    const { currentLanguage, themeConfig, siteConfig } = useStore();
    const showTranslationTab = useMemo(
        () => getOptionalEnabledLanguages(siteConfig).length > 0,
        [siteConfig?.languages]
    );

    // Normalize legacy keys from older saved settings for reliable edit/preview behavior
    const resolvedAlignment = (() => {
        const raw = String(data.settings.alignment || data.settings.align || 'center').toLowerCase();
        if (raw === 'left') return 'left';
        if (raw === 'right') return 'right';
        return 'center';
    })() as 'center' | 'left' | 'right';
    const resolvedBgColor = data.settings.bgColor || data.settings.backgroundColor || '#ffffff';
    const resolvedBgImage = data.settings.bgImage || data.settings.backgroundImage || '';
    const bgTypeNormalized = String(data.settings.bgType || '').toLowerCase();
    const resolvedBgType = ((bgTypeNormalized === 'none' || bgTypeNormalized === 'color' || bgTypeNormalized === 'image' || bgTypeNormalized === 'site-color' || bgTypeNormalized === 'site' || bgTypeNormalized === 'sitecolor')
        ? ((bgTypeNormalized === 'site' || bgTypeNormalized === 'sitecolor') ? 'site-color' : bgTypeNormalized)
        : (
            data.settings.backgroundColor === 'site-color'
                ? 'site-color'
                : ((data.settings.bgImage || data.settings.backgroundImage) ? 'image' : ((data.settings.bgColor || data.settings.backgroundColor) ? 'color' : 'none'))
        )) as 'none' | 'color' | 'site-color' | 'image';
    const resolveTypographyColor = (colorSetting?: string, customHex?: string, defaultColor: string = 'text-[var(--primary-color)]'): { className?: string; style?: React.CSSProperties } => {
        if (!colorSetting || colorSetting === 'site' || colorSetting === 'site-color') return { className: 'text-[var(--primary-color)]' };
        if (colorSetting === 'custom' && customHex) return { style: { color: customHex } };
        if (colorSetting === 'white') return { className: 'text-white' };
        if (colorSetting === 'black') return { className: 'text-black' };
        return { className: defaultColor };
    };

    const updateHeroTitleColor = (preset: string, customHex?: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: { ...prev.settings, ...buildHeroTitleColorPatch(preset, customHex, prev.settings) },
        }));
    };
    const updateHeroSubtitleColor = (preset: string, customHex?: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: { ...prev.settings, ...buildHeroSubtitleColorPatch(preset, customHex, prev.settings) },
        }));
    };
    const updateContactDescColor = (preset: string, customHex?: string) => {
        const normalized = normalizeHeroDescriptionColorPreset(preset) || 'site';
        setData((prev: Container) => {
            const patch: Record<string, any> = { descColor: normalized, descColorType: normalized };
            if (normalized === 'custom') {
                patch.descCustomColor = customHex ?? prev.settings?.descCustomColor ?? HERO_DESCRIPTION_CUSTOM_DEFAULT;
            }
            return { ...prev, settings: { ...prev.settings, ...patch } };
        });
    };
    const updateContactLabelColor = (preset: string, customHex?: string) => {
        const normalized = normalizeHeroColorPreset(preset) || 'site';
        setData((prev: Container) => {
            const patch: Record<string, any> = { labelColor: normalized };
            if (normalized === 'custom') {
                patch.labelCustomColor = customHex ?? prev.settings?.labelCustomColor ?? HERO_DESCRIPTION_CUSTOM_DEFAULT;
            }
            return { ...prev, settings: { ...prev.settings, ...patch } };
        });
    };

    const heroTitleColorSetting = getHeroTitleColorSetting(data.settings);
    const heroTitleCustomColor = getHeroTitleCustomColor(data.settings);
    const heroSubtitleColorSetting = getHeroSubtitleColorSetting(data.settings);
    const heroSubtitleCustomColor = getHeroSubtitleCustomColor(data.settings);
    const contactDescColorSetting =
        normalizeHeroDescriptionColorPreset(data.settings.descColor ?? data.settings.descColorType) || 'site';
    const contactDescCustomColor = data.settings.descCustomColor || HERO_DESCRIPTION_CUSTOM_DEFAULT;
    const contactLabelColorSetting = normalizeHeroColorPreset(data.settings.labelColor) || 'site';
    const contactLabelCustomColor = data.settings.labelCustomColor || HERO_DESCRIPTION_CUSTOM_DEFAULT;
    const contactFormRadiusSettings = parseSliderImageSettings(data.settings.formCardRadiusSettings);
    const contactFormRadiusStyle = resolveSliderImageRadiusStyle(contactFormRadiusSettings);

    const updateSetting = (key: string, val: any) => {
        setData((prev: Container) => {
            const nextSettings: any = { ...prev.settings, [key]: val };

            // Keep legacy aliases in sync for backward compatibility with existing SP data.
            if (key === 'alignment') nextSettings.align = val;
            if (key === 'bgColor') nextSettings.backgroundColor = val;
            if (key === 'bgImage') nextSettings.backgroundImage = val;
            if (key === 'bgType' && val === 'site-color') nextSettings.backgroundColor = 'site-color';
            if (key === 'bgType' && val === 'color' && nextSettings.backgroundColor === 'site-color') {
                nextSettings.backgroundColor = nextSettings.bgColor || '#ffffff';
            }
            return { ...prev, settings: nextSettings };
        });
    };

    const getSourceSettingText = (key: 'heading' | 'subheading' | 'description' | 'buttonText'): string => {
        const value = data.settings[key];
        return getExactLanguageText(value as any, CONTENT_SOURCE_LANG);
    };

    const getPreviewSettingText = (key: 'heading' | 'subheading' | 'description' | 'buttonText'): string => {
        const value = data.settings[key];
        return getLocalizedText(value, currentLanguage);
    };

    const updateSettingText = (key: 'heading' | 'subheading' | 'description' | 'buttonText', value: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: applyBaseSettingsTextField(prev.settings, key, value),
        }));
    };

    const formTranslationTarget: LanguageCode = TRANSLATION_TARGET_LANG;

    const updateTranslatedSetting = (key: 'heading' | 'subheading' | 'description' | 'buttonText', value: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: applyTranslationSettingsTextField(prev.settings, key, value, formTranslationTarget),
        }));
    };

    const normalizeFieldText = (value: string) => value.toLowerCase().trim().replace(/\s+/g, ' ');
    const getLocalizedFieldLabel = (value: string): string => {
        const map: Record<string, string> = {
            'first name': 'LABEL_FIRST_NAME',
            'last name': 'LABEL_LAST_NAME',
            'email': 'LABEL_EMAIL',
            'e-mail': 'LABEL_EMAIL',
            'country': 'LABEL_COUNTRY',
            'message': 'LABEL_MESSAGE'
        };
        const key = map[normalizeFieldText(value || '')];
        return key ? getTranslation(key, currentLanguage) : value;
    };
    const getLocalizedFieldPlaceholder = (value: string): string => {
        const map: Record<string, string> = {
            'e.g. john': 'PLACEHOLDER_FIRST_NAME_EXAMPLE',
            'e.g. doe': 'PLACEHOLDER_LAST_NAME_EXAMPLE',
            'name@example.com': 'PLACEHOLDER_EMAIL_EXAMPLE',
            'country': 'PLACEHOLDER_COUNTRY',
            'your message...': 'PLACEHOLDER_MESSAGE_EXAMPLE'
        };
        const key = map[normalizeFieldText(value || '')];
        return key ? getTranslation(key, currentLanguage) : value;
    };


    const fields = data.settings.fields || [];

    useEffect(() => {
        const rawFields = data.settings.fields || [];
        if (rawFields.some((f: any) => f.type === 'checkbox')) {
            updateSetting('fields', rawFields.map((f: any) => (f.type === 'checkbox' ? { ...f, type: 'text' } : f)));
        }
        if (!data.settings.letterCase) {
            updateSetting('letterCase', CONTACT_FORM_DEFAULT_LETTER_CASE);
        }
    }, []);

    const updateField = (id: string, updates: any) => {
        const newFields = fields.map((f: any) => f.id === id ? { ...f, ...updates } : f);
        updateSetting('fields', newFields);
    };

    const addField = () => {
        const newField = { id: `f_${Date.now()}`, label: 'New Field', type: 'text', placeholder: '', required: false };
        updateSetting('fields', [...fields, newField]);
    };

    const removeField = (id: string) => {
        updateSetting('fields', fields.filter((f: any) => f.id !== id));
        setFieldToDelete(null);
    };

    const updateFieldOption = (fieldId: string, optionIndex: number, value: string) => {
        const field = fields.find((f: any) => f.id === fieldId);
        if (!field) return;
        const options = [...(field.options || [])];
        options[optionIndex] = value;
        updateField(fieldId, { options });
    };

    const addFieldOption = (fieldId: string) => {
        const field = fields.find((f: any) => f.id === fieldId);
        const options = [...(field?.options || []), `Option ${(field?.options?.length || 0) + 1}`];
        updateField(fieldId, { options });
    };

    const removeFieldOption = (fieldId: string, optionIndex: number) => {
        const field = fields.find((f: any) => f.id === fieldId);
        const options = (field?.options || []).filter((_: string, i: number) => i !== optionIndex);
        updateField(fieldId, { options });
    };

    const moveField = (idx: number, direction: 'up' | 'down') => {
        if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === fields.length - 1)) return;
        const newFields = [...fields];
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        [newFields[idx], newFields[swapIdx]] = [newFields[swapIdx], newFields[idx]];
        updateSetting('fields', newFields);
    };

    const PreviewForm = () => {
        const [previewFormData, setPreviewFormData] = useState<Record<string, string>>({});
        const [previewPrivacyAccepted, setPreviewPrivacyAccepted] = useState(false);
        const previewTitleColor = resolveTypographyColor(data.settings.titleColor, data.settings.titleCustomColor);
        const previewSubtitleColor = resolveTypographyColor(data.settings.subtitleColor || data.settings.titleColor, data.settings.subtitleCustomColor || data.settings.titleCustomColor);
        const previewDescColor = resolveTypographyColor(data.settings.descColor || data.settings.titleColor, data.settings.descCustomColor || data.settings.titleCustomColor);
        const titleTypoStyle = contactFormTypographyToStyle(resolveHeroTypography(data.settings, 'title', themeConfig), '--font-size-h2');
        const subtitleTypoStyle = contactFormTypographyToStyle(resolveHeroTypography(data.settings, 'subtitle', themeConfig), '--font-size-p');
        const descTypoStyle = contactFormTypographyToStyle(resolveHeroTypography(data.settings, 'description', themeConfig), '--font-size-p');
        const labelTypoStyle = contactFormTypographyToStyle(resolveHeroTypography(data.settings, 'label', themeConfig), '--font-size-p');
        const previewLabelColor = resolveTypographyColor(data.settings.labelColor, data.settings.labelCustomColor, 'text-gray-500');
        const effectiveLetterCase = getEffectiveContactFormLetterCase(data.settings);
        const headingLetterCaseCss = resolveContactFormLetterCaseCss(effectiveLetterCase);
        const formCardRef = useRef<HTMLDivElement>(null);
        const captchaAnchorRef = useRef<HTMLDivElement>(null);
        const [overlapPx, setOverlapPx] = useState(144);

        const measureContactFormOverlap = useCallback(() => {
            if (!formCardRef.current || !captchaAnchorRef.current) return;
            const cardTop = formCardRef.current.getBoundingClientRect().top;
            const captchaTop = captchaAnchorRef.current.getBoundingClientRect().top;
            setOverlapPx(Math.max(96, Math.ceil(captchaTop - cardTop)));
        }, []);

        useLayoutEffect(() => {
            measureContactFormOverlap();
            const observer = typeof ResizeObserver !== 'undefined'
                ? new ResizeObserver(() => measureContactFormOverlap())
                : null;
            if (formCardRef.current && observer) {
                observer.observe(formCardRef.current);
            }
            window.addEventListener('resize', measureContactFormOverlap);
            return () => {
                observer?.disconnect();
                window.removeEventListener('resize', measureContactFormOverlap);
            };
        }, [fields, measureContactFormOverlap]);

        const contactSectionStyle = { '--ws-contact-overlap': `${overlapPx}px` } as CSSProperties;
        const contactHeroStyle: CSSProperties = {
            backgroundColor: resolvedBgType === 'site-color' ? 'var(--primary-color)' : (resolvedBgType === 'color' ? resolvedBgColor : 'transparent'),
            backgroundImage: resolvedBgType === 'image' && resolvedBgImage ? `url("${resolvedBgImage}")` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
        };
        const headingAlignClass = resolvedAlignment === 'left'
            ? 'text-left'
            : resolvedAlignment === 'right'
                ? 'text-right'
                : 'text-center';

        return (
            <div className="w-full relative ws-contact-form-section" style={contactSectionStyle}>
                <div className="w-full ws-contact-hero relative" style={contactHeroStyle}>
                    {resolvedBgType === 'image' && <div className="absolute inset-0 bg-black/50 z-0"></div>}

                    <div className={`relative z-10 max-w-2xl mx-auto ${headingAlignClass}`}>
                        {(data.settings.showHeader !== false) && getPreviewSettingText('heading') && (
                            <h2 className={`text-3xl ${titleTypoStyle.fontWeight ? '' : 'font-bold'} mb-[12px] break-words leading-tight ${previewTitleColor.className || ''}`}
                                style={{ ...previewTitleColor.style, ...titleTypoStyle, textTransform: headingLetterCaseCss }}>
                                {applyContactFormLetterCaseToText(getPreviewSettingText('heading'), effectiveLetterCase)}
                            </h2>
                        )}
                        {(data.settings.showSubheading !== false) && getPreviewSettingText('subheading') && (
                            <p className={`mb-[20px] ${subtitleTypoStyle.fontWeight ? '' : 'font-medium'} ${previewSubtitleColor.className || ''}`}
                                style={{ ...previewSubtitleColor.style, ...subtitleTypoStyle, textTransform: 'none' }}>
                                {getPreviewSettingText('subheading')}
                            </p>
                        )}
                        {(data.settings.showDescription !== false) && getPreviewSettingText('description') && (
                            <div className={`mt-2 ${previewDescColor.className || ''}`}
                                style={{ ...previewDescColor.style, ...descTypoStyle, textTransform: 'none' }}
                                dangerouslySetInnerHTML={{ __html: getPreviewSettingText('description') }} />
                        )}
                    </div>
                </div>

                <div className="w-full ws-contact-form-overlap relative z-20">
                    <div
                        ref={formCardRef}
                        className="ws-contact-form-width mx-auto bg-white ws-contact-form-card shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 relative"
                        style={{
                            ...contactFormRadiusStyle,
                            ['--ws-contact-card-radius' as any]: contactFormRadiusStyle.borderRadius,
                        }}
                    >
                        <div className="space-y-4">
                            {fields.map((f: any) => (
                                <div key={f.id}>
                                    <label
                                        className={`block mb-1 ws-form-field__label ${previewLabelColor.className || ''}`}
                                        style={{ ...previewLabelColor.style, ...labelTypoStyle }}
                                    >
                                        {getLocalizedFieldLabel(f.label)} {f.required && <span className="text-red-500">*</span>}
                                    </label>
                                    {f.type === 'textarea' ? (
                                        <textarea className="w-full border border-gray-300 p-2 text-sm bg-white rounded-sm resize-none h-24" placeholder={getLocalizedFieldPlaceholder(f.placeholder || '')} disabled />
                                    ) : f.type === 'select' ? (
                                        <select
                                            className="w-full border border-gray-300 p-2 text-sm bg-white rounded-sm outline-none focus:ring-1 focus:ring-[var(--primary-color)] cursor-pointer"
                                            value={previewFormData[f.id] || ''}
                                            onChange={(e) => setPreviewFormData((prev) => ({ ...prev, [f.id]: e.target.value }))}
                                        >
                                            <option value="" disabled>
                                                {getLocalizedFieldPlaceholder(f.placeholder || '') || getTranslation('PLACEHOLDER_SELECT_OPTION', currentLanguage)}
                                            </option>
                                            {(f.options && f.options.length > 0 ? f.options : ['Option 1', 'Option 2', 'Option 3']).map((opt: string, i: number) => (
                                                <option key={`${f.id}-opt-${i}`} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input className="w-full border border-gray-300 p-2 text-sm bg-white rounded-sm" placeholder={getLocalizedFieldPlaceholder(f.placeholder || '')} disabled type={f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : 'text'} />
                                    )}
                                </div>
                            ))}

                            <label className="flex items-start gap-2 mt-4 cursor-pointer group">
                                <div className="relative flex items-center justify-center mt-0.5 w-4 h-4 flex-shrink-0">
                                    <input
                                        type="checkbox"
                                        className={`h-4 w-4 cursor-pointer appearance-none rounded-sm border focus:ring-1 focus:ring-[var(--primary-color)] focus:outline-none transition-colors ${previewPrivacyAccepted ? 'bg-[var(--primary-color)] border-[var(--primary-color)]' : 'border-gray-300 bg-white'}`}
                                        checked={previewPrivacyAccepted}
                                        onChange={(e) => setPreviewPrivacyAccepted(e.target.checked)}
                                    />
                                    {previewPrivacyAccepted && (
                                        <Check className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-white" />
                                    )}
                                </div>
                                <span className="text-sm leading-tight select-none group-hover:text-gray-700" style={{ ...previewLabelColor.style, ...labelTypoStyle }}>
                                    {getTranslation('LABEL_PRIVACY_POLICY_CONSENT', currentLanguage)}
                                </span>
                            </label>

                            <div className="pt-4" ref={captchaAnchorRef}>
                                <label className={`block mb-2 ws-form-field__label ${previewLabelColor.className || ''}`} style={{ ...previewLabelColor.style, ...labelTypoStyle }}>
                                    {getTranslation('LABEL_CAPTCHA', currentLanguage)}
                                </label>
                                <div className="mb-2 flex h-[58px] w-[180px] items-center justify-center rounded-sm border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-500">
                                    Server CAPTCHA image
                                </div>
                                <input
                                    className="w-full border border-gray-300 p-2 text-sm bg-white rounded-sm"
                                    placeholder={getTranslation('PLACEHOLDER_ENTER_CAPTCHA', currentLanguage)}
                                    disabled
                                />
                            </div>

                            <button className="w-full bg-gray-200 text-gray-400 py-3 font-bold text-sm shadow-sm cursor-not-allowed tracking-wider rounded-sm mt-4 opacity-60">
                                {getPreviewSettingText('buttonText') || getTranslation('LABEL_SEND_MESSAGE', currentLanguage)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (!canShowFullContainerEditor(editorAccess.role, data.settings)) {
        return (
            <SiteAdminRestrictedEditor
                data={data}
                setData={setData}
                role={editorAccess.role}
                editableFields={editorAccess.editableFields ?? []}
                currentLanguage={currentLanguage}
                showTemplateBanner={Boolean(data.settings?.sectionTemplateId)}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex border-b border-gray-200 px-6 bg-gray-50">
                <TabButton active={activeTab === 'TEXT'} label={getTranslation('LABEL_FORM_BUILDER', currentLanguage)} onClick={() => setActiveTab('TEXT')} />
                <TabButton active={activeTab === 'PREVIEW'} label={getTranslation('LABEL_LIVE_PREVIEW', currentLanguage)} onClick={() => setActiveTab('PREVIEW')} />
                {showTranslationTab && (
                    <TabButton active={activeTab === 'TRANSLATION'} label={getTranslation('LABEL_TRANSLATION', currentLanguage)} onClick={() => setActiveTab('TRANSLATION')} />
                )}
            </div>

            <div className={CONTACT_FORM_SCROLL_CLASS}>
                {activeTab === 'TEXT' && (
                    <div className="py-6 bg-gray-50 w-full space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Heading Section */}
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <h4 className="font-bold text-gray-700 border-b pb-2 mb-4 uppercase text-xs tracking-wider">{getTranslation('LABEL_TITLE_IDENTITY', currentLanguage)}</h4>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_INTERNAL_TITLE', currentLanguage)}</label>
                                <input className="w-full border p-2 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={data.title || ''} onChange={(e) => setData((prev: Container) => ({ ...prev, title: e.target.value }))} placeholder={getTranslation('LABEL_INTERNAL_TITLE_PLACEHOLDER', currentLanguage)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                <div className="space-y-2 min-w-0">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <label className="text-xs font-bold text-gray-500 uppercase shrink-0">{getTranslation('LABEL_HEADING', currentLanguage)}</label>
                                        <div className="flex items-center gap-2 ml-auto shrink-0">
                                            <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_HEADER', currentLanguage)}</span>
                                            <VisibilityToggle
                                                checked={data.settings.showHeader !== false}
                                                onCheckedChange={(v) => updateSetting('showHeader', v)}
                                                ariaLabel={getTranslation('LABEL_SHOW_HEADER', currentLanguage)}
                                            />
                                        </div>
                                    </div>
                                    {(data.settings.showHeader !== false) && (
                                        <input
                                            className="w-full min-w-0 border p-2 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            value={getSourceSettingText('heading')}
                                            onChange={(e) => updateSettingText('heading', e.target.value)}
                                        />
                                    )}
                                </div>
                                <div className="space-y-2 min-w-0">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <label className="text-xs font-bold text-gray-500 uppercase shrink-0">{getTranslation('LABEL_SUBHEADING', currentLanguage)}</label>
                                        <div className="flex items-center gap-2 ml-auto shrink-0">
                                            <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_SUBHEADING', currentLanguage)}</span>
                                            <VisibilityToggle
                                                checked={data.settings.showSubheading !== false}
                                                onCheckedChange={(v) => updateSetting('showSubheading', v)}
                                                ariaLabel={getTranslation('LABEL_SHOW_SUBHEADING', currentLanguage)}
                                            />
                                        </div>
                                    </div>
                                    {(data.settings.showSubheading !== false) && (
                                        <input
                                            className="w-full min-w-0 border p-2 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            value={getSourceSettingText('subheading')}
                                            onChange={(e) => updateSettingText('subheading', e.target.value)}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2 mb-0">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <label className="text-xs font-bold text-gray-500 uppercase shrink-0">{getTranslation('LABEL_DESCRIPTION', currentLanguage)}</label>
                                    <div className="flex items-center gap-2 ml-auto shrink-0">
                                        <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_DESC', currentLanguage)}</span>
                                        <VisibilityToggle
                                            checked={data.settings.showDescription !== false}
                                            onCheckedChange={(v) => updateSetting('showDescription', v)}
                                            ariaLabel={getTranslation('LABEL_SHOW_DESC', currentLanguage)}
                                        />
                                    </div>
                                </div>
                                {(data.settings.showDescription !== false) && (
                                    <JoditRichTextEditor
                                        value={getSourceSettingText('description')}
                                        onChange={(val: string) => updateSettingText('description', val)}
                                        height={160}
                                        placeholder={getTranslation('LABEL_RICH_TEXT_DESC', currentLanguage)}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Background Section */}
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <h4 className="font-bold text-gray-700 border-b pb-2 mb-4 uppercase text-xs tracking-wider">{getTranslation('LABEL_BACKGROUND', currentLanguage)}</h4>
                            <div className="flex gap-4 mb-4">
                                <VisualOption label={getTranslation('LABEL_NONE', currentLanguage)} icon={X} active={resolvedBgType === 'none'} onClick={() => updateSetting('bgType', 'none')} />
                                <VisualOption label={getTranslation('LABEL_BACKGROUND_COLOR', currentLanguage)} icon={Palette} active={resolvedBgType === 'color'} onClick={() => updateSetting('bgType', 'color')} />
                                <VisualOption label={getTranslation('LABEL_SITE_COLOR', currentLanguage)} icon={Palette} active={resolvedBgType === 'site-color'} onClick={() => updateSetting('bgType', 'site-color')} />
                                <VisualOption label={getTranslation('LABEL_IMAGE', currentLanguage)} icon={ImageIcon} active={resolvedBgType === 'image'} onClick={() => updateSetting('bgType', 'image')} />
                            </div>
                            {resolvedBgType === 'color' && <ColorPicker value={resolvedBgColor} onChange={(v) => updateSetting('bgColor', v)} />}
                            {resolvedBgType === 'image' && <ImagePicker value={resolvedBgImage} onChange={(v) => updateSetting('bgImage', v)} />}

                            <div className="pt-4 border-t border-gray-100 mt-4">
                                <SliderImageRadiusEditor
                                    imageSettings={contactFormRadiusSettings}
                                    currentLanguage={currentLanguage}
                                    includeCircle={false}
                                    headingLabel="Form Corner Radius"
                                    onChange={(imageSettings) => updateSetting('formCardRadiusSettings', imageSettings)}
                                />
                            </div>
                        </div>

                        {/* Typography Section */}
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <h4 className="font-bold text-gray-800 pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('LABEL_TYPOGRAPHY', currentLanguage)}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_HEADING_COLOR', currentLanguage)}</label>
                                    <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={heroTitleColorSetting} onChange={(e) => updateHeroTitleColor(e.target.value)}>
                                        <option value="site">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                        <option value="black">{getTranslation('LABEL_BLACK', currentLanguage)}</option>
                                        <option value="white">{getTranslation('LABEL_WHITE', currentLanguage)}</option>
                                        <option value="custom">{getTranslation('LABEL_CUSTOM_COLOR', currentLanguage)}</option>
                                    </select>
                                    {heroTitleColorSetting === 'custom' && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                            <ColorPicker value={heroTitleCustomColor} onChange={(v) => updateHeroTitleColor('custom', v)} />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_SUBHEADING_COLOR', currentLanguage)}</label>
                                    <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={heroSubtitleColorSetting} onChange={(e) => updateHeroSubtitleColor(e.target.value)}>
                                        <option value="site">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                        <option value="black">{getTranslation('LABEL_BLACK', currentLanguage)}</option>
                                        <option value="white">{getTranslation('LABEL_WHITE', currentLanguage)}</option>
                                        <option value="custom">{getTranslation('LABEL_CUSTOM_COLOR', currentLanguage)}</option>
                                    </select>
                                    {heroSubtitleColorSetting === 'custom' && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                            <ColorPicker value={heroSubtitleCustomColor} onChange={(v) => updateHeroSubtitleColor('custom', v)} />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_DESCRIPTION_COLOR', currentLanguage)}</label>
                                    <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={contactDescColorSetting} onChange={(e) => updateContactDescColor(e.target.value)}>
                                        {HERO_DESCRIPTION_COLOR_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {getTranslation(opt.labelKey, currentLanguage)}
                                            </option>
                                        ))}
                                    </select>
                                    {contactDescColorSetting === 'custom' && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                            <ColorPicker value={contactDescCustomColor} onChange={(v) => updateContactDescColor('custom', v)} />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_LABELS_COLOR', currentLanguage)}</label>
                                    <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={contactLabelColorSetting} onChange={(e) => updateContactLabelColor(e.target.value)}>
                                        <option value="site">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                        <option value="black">{getTranslation('LABEL_BLACK', currentLanguage)}</option>
                                        <option value="white">{getTranslation('LABEL_WHITE', currentLanguage)}</option>
                                        <option value="custom">{getTranslation('LABEL_CUSTOM_COLOR', currentLanguage)}</option>
                                    </select>
                                    {contactLabelColorSetting === 'custom' && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                            <ColorPicker value={contactLabelCustomColor} onChange={(v) => updateContactLabelColor('custom', v)} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 items-start">
                                <HeroTypographyStyleColumn
                                    role="title"
                                    styleLabelKey="LABEL_HEADING_STYLE"
                                    customSectionLabelKey="LABEL_CUSTOM_HEADING_STYLE"
                                    settings={data.settings}
                                    updateSetting={updateSetting}
                                    currentLanguage={currentLanguage}
                                />
                                <HeroTypographyStyleColumn
                                    role="subtitle"
                                    styleLabelKey="LABEL_SUBHEADING_STYLE"
                                    customSectionLabelKey="LABEL_CUSTOM_SUBHEADING_STYLE"
                                    settings={data.settings}
                                    updateSetting={updateSetting}
                                    currentLanguage={currentLanguage}
                                />
                                <HeroTypographyStyleColumn
                                    role="description"
                                    styleLabelKey="LABEL_DESCRIPTION_STYLE"
                                    customSectionLabelKey="LABEL_CUSTOM_DESCRIPTION_STYLE"
                                    settings={data.settings}
                                    updateSetting={updateSetting}
                                    currentLanguage={currentLanguage}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 items-start">
                                <HeroTypographyStyleColumn
                                    role="label"
                                    styleLabelKey="LABEL_LABEL_STYLE"
                                    customSectionLabelKey="LABEL_CUSTOM_LABEL_STYLE"
                                    settings={data.settings}
                                    updateSetting={updateSetting}
                                    currentLanguage={currentLanguage}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_CONTENT_ALIGNMENT', currentLanguage)}</label>
                                    <div className="flex border rounded-sm overflow-hidden">
                                        {(['left', 'center', 'right'] as const).map((align) => (
                                            <button
                                                key={align}
                                                type="button"
                                                onClick={() => updateSetting('alignment', align)}
                                                className={`ws-content-align-btn flex-1 py-2 flex justify-center ${resolvedAlignment === align ? 'bg-[var(--primary-color)] text-white' : 'bg-white hover:bg-gray-50'}`}
                                            >
                                                {align === 'left' ? <AlignLeft className="w-4 h-4" /> : (align === 'center' ? <AlignCenter className="w-4 h-4" /> : <AlignRight className="w-4 h-4" />)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_HEADING_LETTER_CASE', currentLanguage)}</label>
                                    <select
                                        className="w-full border p-2 text-sm rounded-sm bg-white"
                                        value={getEffectiveContactFormLetterCase(data.settings)}
                                        onChange={(e) => updateSetting('letterCase', e.target.value)}
                                    >
                                        <option value="uppercase">{getTranslation('LABEL_UPPERCASE', currentLanguage)}</option>
                                        <option value="lowercase">{getTranslation('LABEL_LOWERCASE', currentLanguage)}</option>
                                        <option value="sentence">{getTranslation('LABEL_SENTENCE_CASE', currentLanguage)}</option>
                                        <option value="title">{getTranslation('LABEL_TITLE_CASE', currentLanguage)}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Fields */}
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <h4 className="font-bold text-gray-700 border-b pb-2 mb-4 uppercase text-xs tracking-wider">{getTranslation('LABEL_INPUT_FIELDS', currentLanguage)}</h4>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 px-2 pb-1">
                                    <div className="w-5 flex-shrink-0" />
                                    <div className="flex-1 grid grid-cols-3 gap-2">
                                        <span className="text-xs font-bold text-gray-500 uppercase">{getTranslation('LABEL_COL_LABEL_TEXT', currentLanguage)}</span>
                                        <span className="text-xs font-bold text-gray-500 uppercase">{getTranslation('LABEL_COL_PLACEHOLDER_TEXT', currentLanguage)}</span>
                                        <span className="text-xs font-bold text-gray-500 uppercase">{getTranslation('LABEL_COL_INPUT_TYPE', currentLanguage)}</span>
                                    </div>
                                    <div className="w-16 flex-shrink-0" />
                                </div>
                                {fields.map((field: any, idx: number) => (
                                    <div key={field.id} className="space-y-2">
                                        <div className="flex items-center gap-2 p-2 border border-gray-200 rounded-sm bg-gray-50 group">
                                            <div className="flex flex-col gap-1 text-gray-300 hover:text-gray-500 flex-shrink-0">
                                                <ArrowUp className="w-3 h-3 cursor-pointer" onClick={() => moveField(idx, 'up')} />
                                                <ArrowDown className="w-3 h-3 cursor-pointer" onClick={() => moveField(idx, 'down')} />
                                            </div>
                                            <div className="flex-1 grid grid-cols-3 gap-2 min-w-0">
                                                <input className="border p-1.5 text-xs rounded-sm bg-white" value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} placeholder={getTranslation('LABEL_FIELD_LABEL', currentLanguage)} />
                                                <input className="border p-1.5 text-xs rounded-sm bg-white" value={field.placeholder} onChange={e => updateField(field.id, { placeholder: e.target.value })} placeholder={getTranslation('LABEL_FIELD_PLACEHOLDER', currentLanguage)} />
                                                <select
                                                    className="border p-1.5 text-xs rounded-sm bg-white"
                                                    value={field.type}
                                                    onChange={e => {
                                                        const type = e.target.value;
                                                        const updates: Record<string, unknown> = { type };
                                                        if (type === 'select' && !(field.options?.length)) {
                                                            updates.options = ['Option 1', 'Option 2', 'Option 3'];
                                                        }
                                                        updateField(field.id, updates);
                                                    }}
                                                >
                                                    <option value="text">{getTranslation('LABEL_TEXT', currentLanguage)}</option>
                                                    <option value="email">{getTranslation('LABEL_EMAIL', currentLanguage)}</option>
                                                    <option value="textarea">{getTranslation('LABEL_LONG_TEXT', currentLanguage)}</option>
                                                    <option value="number">{getTranslation('LABEL_NUMBER', currentLanguage)}</option>
                                                    <option value="select">{getTranslation('LABEL_DROPDOWN', currentLanguage)}</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2 px-2 border-l border-gray-200 flex-shrink-0">
                                                <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })} title={getTranslation('LABEL_REQUIRED', currentLanguage)} />
                                                <button
                                                    type="button"
                                                    onClick={() => setFieldToDelete({ id: field.id, label: field.label || getTranslation('LABEL_FIELD_LABEL', currentLanguage) })}
                                                    className="text-red-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        {field.type === 'select' && (
                                            <div className="ml-7 p-3 border border-blue-100 bg-blue-50/40 rounded-sm space-y-2">
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase">{getTranslation('LABEL_DROPDOWN_OPTIONS', currentLanguage)}</label>
                                                {(field.options || []).map((option: string, optionIndex: number) => (
                                                    <div key={`${field.id}-option-${optionIndex}`} className="flex items-center gap-2">
                                                        <input
                                                            className="flex-1 border p-1.5 text-xs rounded-sm bg-white"
                                                            value={option}
                                                            onChange={e => updateFieldOption(field.id, optionIndex, e.target.value)}
                                                            placeholder={`${getTranslation('LABEL_ADD_OPTION', currentLanguage)} ${optionIndex + 1}`}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFieldOption(field.id, optionIndex)}
                                                            className="text-red-400 hover:text-red-600 p-1"
                                                            title={getTranslation('BTN_DELETE', currentLanguage)}
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => addFieldOption(field.id)}
                                                    className="text-xs font-bold text-[var(--primary-color)] hover:underline flex items-center gap-1"
                                                >
                                                    <Plus className="w-3 h-3" /> {getTranslation('LABEL_ADD_OPTION', currentLanguage)}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <button type="button" onClick={addField} className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-400 text-xs font-bold hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] flex items-center justify-center gap-2 mt-2">
                                    <Plus className="w-3 h-3" /> {getTranslation('LABEL_ADD_FIELD', currentLanguage)}
                                </button>
                            </div>
                        </div>

                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_BUTTON_TEXT', currentLanguage)}</label>
                            <input className="w-full border p-2 text-sm rounded-sm" value={getSourceSettingText('buttonText')} onChange={(e) => updateSettingText('buttonText', e.target.value)} />
                        </div>

                        <SectionCustomizationEditor
                            settings={data.settings}
                            onChange={updateSetting}
                            currentLanguage={currentLanguage}
                        />
                    </div>
                )}

                {activeTab === 'PREVIEW' && (
                    <div className="bg-gray-50 min-h-full w-full">
                        <PreviewForm />
                    </div>
                )}

                {activeTab === 'TRANSLATION' && showTranslationTab && (
                    <UebersetzungTab
                        data={data}
                        onUpdate={() => { }}
                        fields={[
                            {
                                key: 'heading',
                                label: getTranslation('LABEL_HEADER_TITLE', currentLanguage),
                                type: 'input',
                                getValue: (language: string) => getExactLanguageText(data.settings.heading, language as LanguageCode),
                                onChange: (value: string) => updateTranslatedSetting('heading', value)
                            },
                            {
                                key: 'subheading',
                                label: getTranslation('LABEL_SUBHEADING', currentLanguage),
                                type: 'input',
                                getValue: (language: string) => getExactLanguageText(data.settings.subheading, language as LanguageCode),
                                onChange: (value: string) => updateTranslatedSetting('subheading', value)
                            },
                            {
                                key: 'description',
                                label: getTranslation('LABEL_DESCRIPTION', currentLanguage),
                                type: 'rich',
                                getValue: (language: string) => getExactLanguageText(data.settings.description, language as LanguageCode),
                                onChange: (value: string) => updateTranslatedSetting('description', value)
                            },
                            {
                                key: 'buttonText',
                                label: getTranslation('LABEL_BUTTON_TEXT', currentLanguage),
                                type: 'input',
                                getValue: (language: string) => getExactLanguageText(data.settings.buttonText, language as LanguageCode),
                                onChange: (value: string) => updateTranslatedSetting('buttonText', value)
                            }
                        ]}
                    />
                )}

            </div>

            {fieldToDelete && (
                <ConfirmDeleteDialog
                    title={getTranslation('TITLE_CONFIRM_DELETE', currentLanguage)}
                    message={getTranslation('MSG_CONFIRM_DELETE_CONTACT_FIELD', currentLanguage).replace('{0}', fieldToDelete.label)}
                    onConfirm={() => removeField(fieldToDelete.id)}
                    onCancel={() => setFieldToDelete(null)}
                />
            )}
        </div>
    );
};

// --- 4. TABLE EDITOR ---
const TableEditor = ({ data, setData, onClose, editorAccess }: ContainerEditorChildProps) => {
    const [activeTab, setActiveTab] = useState<'DATA' | 'COLUMNS' | 'SETTINGS' | 'TRANSLATION'>('DATA');
    const { currentLanguage, siteConfig } = useStore();
    const showTranslationTab = useMemo(
        () => getOptionalEnabledLanguages(siteConfig).length > 0,
        [siteConfig?.languages]
    );

    const [lists, setLists] = useState<any[]>([]);
    const [fields, setFields] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Form editing state
    const [isEditing, setIsEditing] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    const updateSetting = (key: string, val: any) => setData((prev: Container) => ({ ...prev, settings: { ...prev.settings, [key]: val } }));

    const tableTranslationTarget: LanguageCode = 'de';

    const updateContentSource = (key: string, val: string) => {
        setData((prev: Container) => ({
            ...prev,
            content: {
                ...prev.content,
                [key]: {
                    ...(prev.content[key] as any || { en: '', de: '', fr: '', es: '' }),
                    [CONTENT_SOURCE_LANG]: val
                }
            }
        }));
    };

    const updateContentTranslation = (key: string, val: string) => {
        setData((prev: Container) => ({
            ...prev,
            content: {
                ...prev.content,
                [key]: {
                    ...(prev.content[key] as any || { en: '', de: '', fr: '', es: '' }),
                    [tableTranslationTarget]: val
                }
            }
        }));
    };

    // Legacy compatibility:
    // Some Data Grid containers store heading/subheading/description in settings
    // while newer containers store them in content. Use content first, then fallback
    // to settings so Translation tab always shows existing values.
    const getHeaderTranslationValue = (contentKey: string, legacySettingKey?: string, language?: LanguageCode): string => {
        const lang = (language || tableTranslationTarget) as LanguageCode;
        const contentField = (data.content as any)?.[contentKey];
        if (contentField !== undefined && contentField !== null) {
            return getExactLanguageText(contentField, lang);
        }
        if (legacySettingKey) {
            return getExactLanguageText((data.settings as any)?.[legacySettingKey], lang);
        }
        return '';
    };

    const updateHeaderTranslationValue = (contentKey: string, value: string, legacySettingKey?: string) => {
        setData((prev: Container) => {
            const prevContent = prev.content as any;
            const nextContent = {
                ...prev.content,
                [contentKey]: {
                    ...(prevContent?.[contentKey] || { en: '', de: '', fr: '', es: '' }),
                    [tableTranslationTarget]: value
                }
            };
            const nextSettings: any = { ...prev.settings };
            if (legacySettingKey) {
                const currentLegacyValue = (prev.settings as any)?.[legacySettingKey];
                if (currentLegacyValue === undefined) {
                    return { ...prev, content: nextContent };
                }
                nextSettings[legacySettingKey] = (typeof currentLegacyValue === 'object' && currentLegacyValue !== null)
                    ? { ...currentLegacyValue, [tableTranslationTarget]: value }
                    : { en: String(currentLegacyValue || ''), [tableTranslationTarget]: value };
            }
            return { ...prev, content: nextContent, settings: nextSettings };
        });
    };

    const loadLists = async () => {
        try {
            const _lists = await getAllLists();
            const allowed = ['WKCandidatesInfo', 'GWTBotschaftskuriere'];
            setLists((_lists || []).filter(l => allowed.includes(l.Title)));
        } catch (e) {
            console.error(e);
        }
    };

    const loadListData = async (listTitle: string) => {
        if (!listTitle) {
            setFields([]);
            setItems([]);
            return;
        }
        setLoading(true);
        try {
            const _fields = await getListFields(listTitle);
            const _items = await getListItems(listTitle);

            const allowedColMap: Record<string, string[]> = {
                'WKCandidatesInfo': ['Title', 'Name', 'WKName', 'WKNo', 'Link', 'Image', 'ColumnLevelVerification', 'CopyRight'],
                'GWTBotschaftskuriere': ['Title', 'Country', 'City', 'DeadlineDay', 'DeadlineTime', 'Comment', 'LastSynchronized', 'Link']
            };

            const allowedCols = allowedColMap[listTitle] || [];

            // Filter by non-hidden and also explicitly allowed columns if list title matches our known ones
            const filteredFields = (_fields || []).filter((f: any) => {
                if (allowedColMap[listTitle]) {
                    return allowedCols.includes(f.InternalName);
                }
                return !f.Hidden && !['ContentType', 'Attachments', 'ItemChildCount', 'FolderChildCount', 'AppAuthor', 'AppEditor', 'owshiddenversion', 'ComplianceAssetId'].includes(f.InternalName);
            });

            setFields(filteredFields);
            setItems(_items || []);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadLists();
    }, []);

    useEffect(() => {
        loadListData(data.settings.sourceList);
    }, [data.settings.sourceList]);

    const handleSelectList = (val: string) => {
        updateSetting('sourceList', val);
        updateSetting('selectedColumns', []); // Reset columns
    };

    const toggleColumn = (internalName: string) => {
        const cols = data.settings.selectedColumns || [];
        if (cols.includes(internalName)) {
            updateSetting('selectedColumns', cols.filter((c: string) => c !== internalName));
        } else {
            updateSetting('selectedColumns', [...cols, internalName]);
        }
    };

    const handleSaveItem = async (e: any) => {
        e.preventDefault();
        if (!editingItem || !data.settings.sourceList) return;

        try {
            const payload = { ...editingItem };
            // Clean up SharePoint internal fields
            const toDelete = ['Id', 'ID', 'GUID', 'Created', 'Modified', 'AuthorId', 'EditorId', 'OData__UIVersionString', 'Attachments', 'SM_CreatedDate', 'SM_ModifiedDate'];
            toDelete.forEach(key => delete payload[key]);

            // Format URL fields correctly for SharePoint OData
            fields.forEach(f => {
                if (f.TypeAsString === 'URL') {
                    const val = payload[f.InternalName];
                    if (val && typeof val === 'string') {
                        payload[f.InternalName] = {
                            Url: val,
                            Description: val
                        };
                    } else if (!val) {
                        payload[f.InternalName] = null;
                    }
                }
            });

            if (isEditing && (editingItem.Id || editingItem.ID)) {
                await updateListItem(data.settings.sourceList, editingItem.Id || editingItem.ID, payload);
            } else {
                await addListItem(data.settings.sourceList, payload);
            }
            await loadListData(data.settings.sourceList);
            // Force renderer refresh
            updateSetting('lastUpdated', Date.now());
            setIsEditing(false);
            setEditingItem(null);
        } catch (e) {
            console.error('Error saving item:', e);
            alert("Error saving item. Please check the console for details.");
        }
    };
    const [pendingDeleteItemId, setPendingDeleteItemId] = useState<number | null>(null);

    const handleDeleteItem = async (id: number) => {
        if (!data.settings.sourceList || !id) return;
        try {
            await deleteListItem(data.settings.sourceList, id);
            await loadListData(data.settings.sourceList);
            // Force renderer refresh
            updateSetting('lastUpdated', Date.now());
        } catch (e) {
            console.error(e);
        }
    };

    const moveColumn = (index: number, direction: 'up' | 'down') => {
        const cols = [...(data.settings.selectedColumns || [])];
        if (direction === 'up' && index > 0) {
            [cols[index], cols[index - 1]] = [cols[index - 1], cols[index]];
        } else if (direction === 'down' && index < cols.length - 1) {
            [cols[index], cols[index + 1]] = [cols[index + 1], cols[index]];
        }
        updateSetting('selectedColumns', cols);
    };

    const updateColumnConfig = (colId: string, key: string, val: any) => {
        const configs = { ...(data.settings.columnConfigs || {}) };
        if (!configs[colId]) configs[colId] = {};
        configs[colId] = { ...configs[colId], [key]: val };
        updateSetting('columnConfigs', configs);
    };

    const selectedCols = data.settings.selectedColumns || [];
    const displayFields = selectedCols.map((id: string) => fields.find(f => f.InternalName === id)).filter(Boolean);

    if (!canShowFullContainerEditor(editorAccess.role, data.settings)) {
        return (
            <SiteAdminRestrictedEditor
                data={data}
                setData={setData}
                role={editorAccess.role}
                editableFields={editorAccess.editableFields ?? []}
                currentLanguage={currentLanguage}
                showTemplateBanner={Boolean(data.settings?.sectionTemplateId)}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex border-b border-gray-200 px-6 bg-gray-50">
                <TabButton active={activeTab === 'DATA'} label={getTranslation('LABEL_CONTENT_DATA', currentLanguage)} onClick={() => setActiveTab('DATA')} />
                <TabButton active={activeTab === 'COLUMNS'} label={getTranslation('LABEL_MANAGE_COLUMNS', currentLanguage)} onClick={() => setActiveTab('COLUMNS')} />
                <TabButton active={activeTab === 'SETTINGS'} label={getTranslation('LABEL_TABLE_SETTINGS', currentLanguage)} onClick={() => setActiveTab('SETTINGS')} />
                {showTranslationTab && (
                    <TabButton active={activeTab === 'TRANSLATION'} label={getTranslation('LABEL_TRANSLATION', currentLanguage)} onClick={() => setActiveTab('TRANSLATION')} />
                )}
            </div>

            <div className={`${EDITOR_SCROLL_CLASS} relative`}>
                {activeTab === 'DATA' && (
                    <div className="p-8 space-y-8 bg-gray-50 min-h-full">
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_SELECT_DATA_SOURCE_LIST', currentLanguage)}</label>
                            <select
                                className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                value={data.settings.sourceList}
                                onChange={(e) => handleSelectList(e.target.value)}
                            >
                                <option value="">-- Liste auswaehlen --</option>
                                {lists.map(list => (
                                    <option key={list.Id} value={list.Title}>{list.Title}</option>
                                ))}
                            </select>
                        </div>

                        {data.settings.sourceList && (
                            <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">{getTranslation('LABEL_MANAGE_ROWS', currentLanguage)}</h4>
                                    <button onClick={() => { setIsEditing(true); setEditingItem({}); }} className="bg-[var(--primary-color)] text-white px-3 py-1.5 text-xs font-bold rounded-sm hover:opacity-90 flex items-center gap-1"><Plus className="w-3 h-3" /> {getTranslation('BTN_ADD_RECORD', currentLanguage)}</button>
                                </div>

                                {loading && <div className="p-4 text-sm text-gray-500">{getTranslation('MSG_LOADING_DATA', currentLanguage)}</div>}

                                {!loading && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm border-collapse border border-gray-200">
                                            <thead>
                                                <tr className="bg-gray-50">
                                                    {displayFields.length > 0 ? displayFields.map((f: any) => (
                                                        <th key={f.InternalName} className="border p-2 text-left font-bold text-gray-600">{f.Title}</th>
                                                    )) : <th className="border p-2 text-left font-bold text-gray-400">{getTranslation('MSG_NO_COLUMNS_SELECTED', currentLanguage)}</th>}
                                                    <th className="border p-2 w-20 text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.length > 0 ? items.map((item: any) => (
                                                    <tr key={item.Id || item.ID} className="hover:bg-gray-50">
                                                        {displayFields.length > 0 ? displayFields.map((f: any) => (
                                                            <td key={f.InternalName} className="border p-2 text-gray-700 max-w-xs truncate">
                                                                {(() => {
                                                                    const val = item[f.InternalName];
                                                                    if (!val) return '';
                                                                    if (f.TypeAsString === 'URL') return <span className="text-blue-500 underline truncate block">{val.Url || val}</span>;
                                                                    if (f.TypeAsString === 'DateTime') return new Date(val).toLocaleDateString();
                                                                    if (typeof val === 'object') return val.Title || val.Name || JSON.stringify(val);
                                                                    return String(val);
                                                                })()}
                                                            </td>
                                                        )) : <td className="border p-2"></td>}
                                                        <td className="border p-2 text-center h-full">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button onClick={() => { setIsEditing(true); setEditingItem(item); }} className="text-gray-400 hover:text-blue-500"><Pencil className="w-4 h-4" /></button>
                                                                <button onClick={() => setPendingDeleteItemId(item.Id || item.ID)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )) : <tr><td colSpan={(displayFields.length || 1) + 1} className="p-4 text-center text-gray-400">{getTranslation('MSG_NO_DATA_FOUND_IN_SOURCE', currentLanguage).replace('{0}', data.settings.sourceList || '')}</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {pendingDeleteItemId !== null && (
                    <ConfirmDeleteDialog
                        title={getTranslation('TITLE_CONFIRM_DELETE', currentLanguage)}
                        message={getTranslation('LABEL_DELETE_CONFIRM', currentLanguage)}
                        onConfirm={() => {
                            void handleDeleteItem(pendingDeleteItemId);
                            setPendingDeleteItemId(null);
                        }}
                        onCancel={() => setPendingDeleteItemId(null)}
                    />
                )}

                {activeTab === 'COLUMNS' && (
                    <div className="p-8 space-y-8 bg-gray-50 min-h-full">
                        {!data.settings.sourceList ? (
                            <div className="p-8 text-center text-gray-500">{getTranslation('MSG_SELECT_DATA_SOURCE_FIRST', currentLanguage)}</div>
                        ) : (
                            <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-4">Anzuzeigende Spalten auswaehlen</h4>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    {fields.map((f: any) => (
                                        <label key={f.InternalName} className={`flex items-center gap-3 cursor-pointer p-4 border rounded-sm transition-all ${selectedCols.includes(f.InternalName) ? 'border-[var(--primary-color)] bg-blue-50/30' : 'border-gray-100 h-full bg-white hover:border-gray-300'}`}>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                                                checked={selectedCols.includes(f.InternalName)}
                                                onChange={() => toggleColumn(f.InternalName)}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-gray-800 truncate">{f.Title}</div>
                                                <div className="text-[10px] text-gray-400 font-mono uppercase tracking-tighter truncate">{f.InternalName} ({f.TypeAsString})</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                {selectedCols.length > 0 && (
                                    <div className="mt-10 border-t pt-8">
                                        <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <ListIcon className="w-4 h-4 text-[var(--primary-color)]" />
                                            {getTranslation('LABEL_ACTIVE_COLUMN_ORDER', currentLanguage)}
                                        </h4>
                                        <div className="bg-gray-50 border border-gray-200 rounded-sm divide-y divide-gray-200">
                                            {displayFields.map((f: any, idx: number) => (
                                                <div key={f.InternalName} className="flex items-center justify-between p-3 bg-white first:rounded-t-sm last:rounded-b-sm">
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold">{idx + 1}</span>
                                                        <span className="text-sm font-medium text-gray-700">{f.Title}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-2">
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase">{getTranslation('LABEL_ACTION', currentLanguage)}</label>
                                                            <select
                                                                className="border border-gray-200 rounded-sm p-1 text-[11px] bg-white outline-none focus:border-[var(--primary-color)]"
                                                                value={(data.settings.columnConfigs?.[f.InternalName]?.action) || 'none'}
                                                                onChange={(e) => updateColumnConfig(f.InternalName, 'action', e.target.value)}
                                                            >
                                                                <option value="none">None</option>
                                                                <option value="modal">{getTranslation('OPTION_DETAIL_MODAL', currentLanguage)}</option>
                                                                <option value="link">{getTranslation('OPTION_OPEN_LINK', currentLanguage)}</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex items-center gap-1 border-l pl-3 ml-1">
                                                            <button
                                                                disabled={idx === 0}
                                                                onClick={() => moveColumn(idx, 'up')}
                                                                className="p-1.5 text-gray-400 hover:text-[var(--primary-color)] hover:bg-gray-100 rounded-sm disabled:opacity-20 transition-colors"
                                                            >
                                                                <ArrowUp className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                disabled={idx === displayFields.length - 1}
                                                                onClick={() => moveColumn(idx, 'down')}
                                                                className="p-1.5 text-gray-400 hover:text-[var(--primary-color)] hover:bg-gray-100 rounded-sm disabled:opacity-20 transition-colors"
                                                            >
                                                                <ArrowDown className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'SETTINGS' && (
                    <div className="p-8 bg-gray-50 min-h-full">
                        <div className="mx-auto bg-white p-8 border border-gray-200 shadow-sm rounded-sm space-y-8">
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_INTERNAL_TITLE', currentLanguage)}</label>
                                    <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={data.title || ''} onChange={(e) => setData((prev: Container) => ({ ...prev, title: e.target.value }))} placeholder={getTranslation('LABEL_INTERNAL_TITLE_PLACEHOLDER', currentLanguage)} />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-2">Kopfbereich-Inhalt</h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="min-w-0">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_DISPLAY_TITLE', currentLanguage)}</label>
                                        <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={getExactLanguageText(data.content.title, CONTENT_SOURCE_LANG)} onChange={(e) => updateContentSource('title', e.target.value)} placeholder={getTranslation('LABEL_ENTER_TABLE_TITLE', currentLanguage)} />
                                    </div>
                                    <div className="min-w-0">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_SUBHEADING', currentLanguage)}</label>
                                        <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={getExactLanguageText(data.content.subtitle, CONTENT_SOURCE_LANG)} onChange={(e) => updateContentSource('subtitle', e.target.value)} placeholder={getTranslation('PLACEHOLDER_ENTER_SUBHEADING', currentLanguage)} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_DESCRIPTION', currentLanguage)}</label>
                                    <JoditRichTextEditor
                                        value={getExactLanguageText(data.content.description, CONTENT_SOURCE_LANG)}
                                        onChange={(val: string) => updateContentSource('description', val)}
                                        height={200}
                                        placeholder={getTranslation('PLACEHOLDER_ENTER_RICH_TEXT_DESCRIPTION', currentLanguage)}
                                    />
                                </div>
                            </div>

                            {/* Appearance Settings */}
                            {/* Typography & Appearance Settings */}
                            <div className="grid grid-cols-2 gap-8 border-b pb-8">
                                <div className="space-y-4">
                                    <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2"><Type className="w-4 h-4 text-[#157a44]" /> Title Typography</h4>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_TITLE_ALIGNMENT', currentLanguage)}</label>
                                        <div className="flex bg-gray-100 p-1 rounded-sm w-max">
                                            <button type="button" className={`p-2 rounded-sm ${data.settings.alignment === 'left' ? 'bg-white shadow-sm' : ''}`} onClick={() => updateSetting('alignment', 'left')}><AlignLeft className="w-4 h-4" /></button>
                                            <button type="button" className={`p-2 rounded-sm ${data.settings.alignment === 'center' ? 'bg-white shadow-sm' : ''}`} onClick={() => updateSetting('alignment', 'center')}><AlignCenter className="w-4 h-4" /></button>
                                            <button type="button" className={`p-2 rounded-sm ${data.settings.alignment === 'right' ? 'bg-white shadow-sm' : ''}`} onClick={() => updateSetting('alignment', 'right')}><AlignRight className="w-4 h-4" /></button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_TITLE_FONT_SIZE', currentLanguage)}</label>
                                        <input type="text" className="w-full border border-gray-300 p-2 text-sm rounded-sm" placeholder="e.g. 42px" value={data.settings.titleFontSize || ''} onChange={e => updateSetting('titleFontSize', e.target.value)} />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_TITLE_FONT_WEIGHT', currentLanguage)}</label>
                                        <FontWeightSelect
                                            value={data.settings.titleFontWeight}
                                            defaultValue="700"
                                            currentLanguage={currentLanguage}
                                            className="w-full border border-gray-300 p-2 text-sm rounded-sm"
                                            includeEmptyOption
                                            emptyOptionLabel="—"
                                            onChange={(value) => updateSetting('titleFontWeight', value ? Number(value) : '')}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_TITLE_COLOR', currentLanguage)}</label>
                                        <select className="w-full border border-gray-300 p-2 text-sm rounded-sm mb-2" value={data.settings.titleColorType || 'site-color'} onChange={e => { updateSetting('titleColorType', e.target.value); }}>
                                            <option value="site-color">Site Branding</option>
                                            <option value="custom">Custom Color</option>
                                        </select>
                                        {data.settings.titleColorType === 'custom' && (
                                            <div className="mt-1">
                                                <ColorPicker value={data.settings.titleCustomColor || '#157a44'} onChange={(v) => updateSetting('titleCustomColor', v)} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2"><Type className="w-4 h-4 text-[#157a44]" /> Subtitle & Description</h4>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_SUBTITLE_FONT_SIZE', currentLanguage)}</label>
                                        <input type="text" className="w-full border border-gray-300 p-2 text-sm rounded-sm" placeholder="e.g. 18px" value={data.settings.subtitleFontSize || ''} onChange={e => updateSetting('subtitleFontSize', e.target.value)} />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_SUBTITLE_FONT_WEIGHT', currentLanguage)}</label>
                                        <FontWeightSelect
                                            value={data.settings.subtitleFontWeight}
                                            defaultValue="600"
                                            currentLanguage={currentLanguage}
                                            className="w-full border border-gray-300 p-2 text-sm rounded-sm"
                                            includeEmptyOption
                                            emptyOptionLabel="—"
                                            onChange={(value) => updateSetting('subtitleFontWeight', value ? Number(value) : '')}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_SUBTITLE_COLOR', currentLanguage)}</label>
                                        <ColorPicker
                                            value={data.settings.subtitleCustomColor || '#666666'}
                                            onChange={(v) => {
                                                updateSetting('subtitleColorType', 'custom');
                                                updateSetting('subtitleCustomColor', v);
                                            }}
                                        />
                                    </div>

                                    <div className="pt-2 border-t mt-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_DESCRIPTION_FONT_SIZE', currentLanguage)}</label>
                                        <input type="text" className="w-full border border-gray-300 p-2 text-sm rounded-sm" placeholder="e.g. 16px" value={data.settings.descriptionFontSize || ''} onChange={e => updateSetting('descriptionFontSize', e.target.value)} />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_DESCRIPTION_COLOR', currentLanguage)}</label>
                                        <ColorPicker
                                            value={data.settings.descCustomColor || '#555555'}
                                            onChange={(v) => {
                                                updateSetting('descColorType', 'custom');
                                                updateSetting('descCustomColor', v);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2"><ListIcon className="w-4 h-4 text-[#157a44]" /> Tabelleninhalt-Typografie</h4>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_CONTENT_ALIGNMENT', currentLanguage)}</label>
                                        <div className="flex bg-gray-100 p-1 rounded-sm w-max">
                                            <button type="button" className={`p-2 rounded-sm ${data.settings.contentAlignment === 'left' ? 'bg-white shadow-sm' : ''}`} onClick={() => updateSetting('contentAlignment', 'left')}><AlignLeft className="w-4 h-4" /></button>
                                            <button type="button" className={`p-2 rounded-sm ${data.settings.contentAlignment === 'center' ? 'bg-white shadow-sm' : ''}`} onClick={() => updateSetting('contentAlignment', 'center')}><AlignCenter className="w-4 h-4" /></button>
                                            <button type="button" className={`p-2 rounded-sm ${data.settings.contentAlignment === 'right' ? 'bg-white shadow-sm' : ''}`} onClick={() => updateSetting('contentAlignment', 'right')}><AlignRight className="w-4 h-4" /></button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_TABLE_FONT_SIZE', currentLanguage)}</label>
                                        <select className="w-full border border-gray-300 p-2.5 text-sm rounded-sm" value={data.settings.fontSize || '14px'} onChange={e => updateSetting('fontSize', e.target.value)}>
                                            <option value="12px">Small (12px)</option>
                                            <option value="14px">Normal (14px)</option>
                                            <option value="16px">Large (16px)</option>
                                            <option value="18px">Extra Large (18px)</option>
                                            <option value="20px">Giant (20px)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_TABLE_CONTENT_COLOR', currentLanguage)}</label>
                                        <select className="w-full border border-gray-300 p-2 text-sm rounded-sm mb-2" value={data.settings.contentColorType || 'default'} onChange={e => { updateSetting('contentColorType', e.target.value); }}>
                                            <option value="default">Default (Dark Gray)</option>
                                            <option value="site-color">Site Branding</option>
                                            <option value="custom">Custom Color</option>
                                        </select>
                                        {data.settings.contentColorType === 'custom' && (
                                            <ColorPicker value={data.settings.contentCustomColor || '#555555'} onChange={(v) => updateSetting('contentCustomColor', v)} />
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:gap-8 mb-4">
                                        <div className="flex items-center justify-between gap-3 min-w-[220px] flex-1">
                                            <span className="text-sm font-bold text-gray-700 uppercase tracking-tight">{getTranslation('LABEL_ENABLE_SEARCH_BAR', currentLanguage)}</span>
                                            <VisibilityToggle
                                                checked={!!data.settings.enableGlobalSearch}
                                                onCheckedChange={(v) => updateSetting('enableGlobalSearch', v)}
                                                ariaLabel={getTranslation('LABEL_ENABLE_SEARCH_BAR', currentLanguage)}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between gap-3 min-w-[220px] flex-1">
                                            <span className="text-sm font-bold text-gray-700 uppercase tracking-tight">{getTranslation('LABEL_SHOW_TABLE_TITLE_BAR', currentLanguage)}</span>
                                            <VisibilityToggle
                                                checked={!!data.settings.showTableTitleBar}
                                                onCheckedChange={(v) => updateSetting('showTableTitleBar', v)}
                                                ariaLabel={getTranslation('LABEL_SHOW_TABLE_TITLE_BAR', currentLanguage)}
                                            />
                                        </div>
                                    </div>

                                    {(data.settings.showTableTitleBar || data.settings.enableGlobalSearch) && (
                                        <div className="space-y-4 animate-in fade-in duration-300 bg-gray-50/50 p-4 border border-gray-100 rounded-sm">
                                            <div className="flex items-center justify-between border-b pb-2 mb-4">
                                                <h5 className="text-[10px] font-bold text-[#157a44] uppercase tracking-wider">Darstellung der Kopfleiste</h5>
                                            </div>

                                            {data.settings.showTableTitleBar && (
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_TITLE_BAR_TEXT', currentLanguage)}</label>
                                                    <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={getExactLanguageText(data.content.titleBar, CONTENT_SOURCE_LANG)} onChange={(e) => updateContentSource('titleBar', e.target.value)} placeholder="Enter title bar text (e.g. Postal voting info...)" />
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_BACKGROUND_COLOR', currentLanguage)}</label>
                                                    <ColorPicker
                                                        value={data.settings.headerBarBgColor || (data.settings.enableGlobalSearch ? (data.settings.searchBgColor || '#ededed') : '#157a44')}
                                                        onChange={(v) => {
                                                            updateSetting('headerBarBgColor', v);
                                                            updateSetting('searchBgColor', v);
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_TEXT_COLOR', currentLanguage)}</label>
                                                    <ColorPicker
                                                        value={data.settings.headerBarTextColor || (data.settings.enableGlobalSearch ? (data.settings.searchTextColor || '#333333') : '#ffffff')}
                                                        onChange={(v) => {
                                                            updateSetting('headerBarTextColor', v);
                                                            updateSetting('searchTextColor', v);
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_FONT_SIZE', currentLanguage)}</label>
                                                    <input type="text" className="w-full border border-gray-300 p-2 text-sm rounded-sm" placeholder="e.g. 18px" value={data.settings.headerBarFontSize || (data.settings.enableGlobalSearch ? data.settings.searchFontSize : '') || ''} onChange={e => { updateSetting('headerBarFontSize', e.target.value); updateSetting('searchFontSize', e.target.value); }} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_BAR_WIDTH', currentLanguage)}</label>
                                                    <select className="w-full border border-gray-300 p-2.5 text-sm rounded-sm" value={data.settings.headerBarWidth || 'full'} onChange={e => updateSetting('headerBarWidth', e.target.value)}>
                                                        <option value="full">Full Width</option>
                                                        <option value="table">An Tabellenbreite anpassen</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="pt-4 border-t mt-4 space-y-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={data.settings.enableSorting !== false} onChange={e => updateSetting('enableSorting', e.target.checked)} className="w-4 h-4 rounded text-[#157a44] focus:ring-[#157a44]" />
                                            <span className="text-sm font-bold text-gray-700 uppercase tracking-tight">{getTranslation('LABEL_ENABLE_SORTING', currentLanguage)}</span>
                                        </label>

                                        {data.settings.enableGlobalSearch && (
                                            <div className="animate-in fade-in slide-in-from-top-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_SEARCH_PLACEHOLDER', currentLanguage)}</label>
                                                <input className="w-full border border-gray-300 p-2 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={data.settings.searchPlaceholder || ''} onChange={e => updateSetting('searchPlaceholder', e.target.value)} placeholder={getTranslation('PLACEHOLDER_LOCATION_SEARCH', currentLanguage)} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <SectionCustomizationEditor
                            settings={data.settings}
                            onChange={updateSetting}
                            currentLanguage={currentLanguage}
                        />
                    </div>
                )}

                {activeTab === 'TRANSLATION' && showTranslationTab && (
                    <UebersetzungTab
                        data={data}
                        onUpdate={updateContentTranslation}
                        fields={[
                            {
                                key: 'title',
                                label: getTranslation('LABEL_DISPLAY_TITLE', currentLanguage),
                                type: 'input',
                                getValue: (language: string) => getHeaderTranslationValue('title', 'heading', language as LanguageCode),
                                onChange: (value: string) => updateHeaderTranslationValue('title', value, 'heading')
                            },
                            {
                                key: 'subtitle',
                                label: getTranslation('LABEL_SUBHEADING', currentLanguage),
                                type: 'input',
                                getValue: (language: string) => getHeaderTranslationValue('subtitle', 'subheading', language as LanguageCode),
                                onChange: (value: string) => updateHeaderTranslationValue('subtitle', value, 'subheading')
                            },
                            {
                                key: 'description',
                                label: getTranslation('LABEL_DESCRIPTION', currentLanguage),
                                type: 'rich',
                                getValue: (language: string) => getHeaderTranslationValue('description', 'description', language as LanguageCode),
                                onChange: (value: string) => updateHeaderTranslationValue('description', value, 'description')
                            },
                            { key: 'titleBar', label: 'Text der Tabellentitelleiste', type: 'input' }
                        ]}
                    />
                )}
            </div>

            {/* FULL SCREEN MODAL FOR EDITING/ADDING ITEM */}
            {
                isEditing && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-6 animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(0) }}>
                        <div className="bg-white rounded-md shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b">
                                <h3 className="font-bold text-lg">{editingItem?.Id ? 'Datensatz bearbeiten' : 'Neuen Datensatz hinzufuegen'}</h3>
                                <button type="button" onClick={() => setIsEditing(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                                {displayFields.length === 0 ? (
                                    <p className="text-gray-500 text-sm text-center">Please select fields in the Columns tab first.</p>
                                ) : (
                                    <form id="itemForm" onSubmit={handleSaveItem} className="space-y-4">
                                        {displayFields.map((f: any) => (
                                            <div key={f.InternalName}>
                                                <label className="block text-xs font-bold text-gray-600 mb-1">{f.Title}</label>
                                                {f.InternalName.toLowerCase().includes('image') || f.InternalName.toLowerCase().includes('img') ? (
                                                    <ImagePicker
                                                        value={typeof editingItem[f.InternalName] === 'object' ? (editingItem[f.InternalName]?.Url || '') : (editingItem[f.InternalName] || '')}
                                                        onChange={(val) => setEditingItem({ ...editingItem, [f.InternalName]: val })}
                                                    />
                                                ) : (
                                                    <input
                                                        type={f.TypeAsString === 'DateTime' ? 'datetime-local' : 'text'}
                                                        className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none bg-white"
                                                        value={typeof editingItem[f.InternalName] === 'object' ? (editingItem[f.InternalName]?.Url || '') : (editingItem[f.InternalName] || '')}
                                                        onChange={(e) => setEditingItem({ ...editingItem, [f.InternalName]: e.target.value })}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </form>
                                )}
                            </div>
                            <div className="p-4 border-t flex justify-end gap-3 bg-white">
                                <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2 border rounded-sm font-bold text-sm hover:bg-gray-50">Abbrechen</button>
                                <button type="submit" form="itemForm" className="px-6 py-2 bg-[var(--primary-color)] rounded-sm font-bold text-sm text-white hover:opacity-90">Datensatz speichern</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};


// --- 5. MAP EDITOR ---
const MapEditor = ({ data, setData, onClose, editorAccess }: ContainerEditorChildProps) => {
    const [activeTab, setActiveTab] = useState<'SETTINGS' | 'TRANSLATION'>('SETTINGS');
    const { currentLanguage, siteConfig } = useStore();
    const showTranslationTab = useMemo(
        () => getOptionalEnabledLanguages(siteConfig).length > 0,
        [siteConfig?.languages]
    );

    const updateSetting = (key: string, val: any) => setData((prev: Container) => ({ ...prev, settings: { ...prev.settings, [key]: val } }));

    const mapTranslationTarget: LanguageCode = 'de';

    const updateUebersetzungContent = (key: string, val: string) => {
        setData((prev: Container) => {
            const newContent = { ...prev.content };
            if (!newContent['title']) newContent['title'] = { en: '', de: '', fr: '', es: '' };
            newContent['title'] = { ...(newContent['title'] as any), [mapTranslationTarget]: val };
            return { ...prev, content: newContent };
        });
    };

    if (!canShowFullContainerEditor(editorAccess.role, data.settings)) {
        return (
            <SiteAdminRestrictedEditor
                data={data}
                setData={setData}
                role={editorAccess.role}
                editableFields={editorAccess.editableFields ?? []}
                currentLanguage={currentLanguage}
                showTemplateBanner={Boolean(data.settings?.sectionTemplateId)}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex border-b border-gray-200 px-6 bg-gray-50">
                <TabButton active={activeTab === 'SETTINGS'} label={getTranslation('LABEL_MAP_SETTINGS', currentLanguage)} onClick={() => setActiveTab('SETTINGS')} />
                {showTranslationTab && (
                    <TabButton active={activeTab === 'TRANSLATION'} label={getTranslation('LABEL_TRANSLATION', currentLanguage)} onClick={() => setActiveTab('TRANSLATION')} />
                )}
            </div>

            <div className={EDITOR_SCROLL_CLASS}>
                {activeTab === 'SETTINGS' && (
                    <div className="p-8 bg-gray-50 min-h-full">
                        <div className="mx-auto bg-white p-8 border border-gray-200 shadow-sm rounded-sm space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_INTERNAL_TITLE', currentLanguage)}</label>
                                    <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={data.title || ''} onChange={(e) => setData({ ...data, title: e.target.value })} placeholder={getTranslation('LABEL_INTERNAL_TITLE_PLACEHOLDER', currentLanguage)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_DISPLAY_TITLE', currentLanguage)}</label>
                                    <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={data.settings.title} onChange={(e) => updateSetting('title', e.target.value)} placeholder={getTranslation('LABEL_ENTER_MAP_TITLE', currentLanguage)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_MAP_TYPE', currentLanguage)}</label>
                                    <select className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={data.settings.mapType} onChange={(e) => updateSetting('mapType', e.target.value)}>
                                        <option value="World">{getTranslation('LABEL_WORLD_MAP', currentLanguage)}</option>
                                        <option value="Continent">{getTranslation('LABEL_CONTINENT_MAP', currentLanguage)}</option>
                                        <option value="Country">{getTranslation('LABEL_COUNTRY_MAP', currentLanguage)}</option>
                                        <option value="Briefwahl">{getTranslation('MAP_TYPE_BRIEFWAHL', currentLanguage)}</option>
                                        <option value="Europawahl">{getTranslation('MAP_TYPE_EUROPAWAHL', currentLanguage)}</option>
                                    </select>
                                </div>
                            </div>

                            {data.settings.mapType === 'Continent' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_SELECT_CONTINENT', currentLanguage)}</label>
                                    <select className="w-full border border-gray-300 p-2.5 text-sm rounded-sm" value={data.settings.selectedRegion} onChange={e => updateSetting('selectedRegion', e.target.value)}>
                                        <option value="">-- {getTranslation('LABEL_NONE', currentLanguage)} --</option>
                                        <option value="Europe">{getTranslation('LABEL_EUROPE', currentLanguage)}</option>
                                        <option value="Asia">{getTranslation('LABEL_ASIA', currentLanguage)}</option>
                                        <option value="North America">{getTranslation('LABEL_NORTH_AMERICA', currentLanguage)}</option>
                                        <option value="South America">{getTranslation('LABEL_SOUTH_AMERICA', currentLanguage)}</option>
                                        <option value="Africa">{getTranslation('LABEL_AFRICA', currentLanguage)}</option>
                                        <option value="Oceania">{getTranslation('LABEL_OCEANIA', currentLanguage)}</option>
                                    </select>
                                </div>
                            )}

                            {data.settings.mapType === 'Country' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_SELECT_COUNTRY', currentLanguage)}</label>
                                    <select className="w-full border border-gray-300 p-2.5 text-sm rounded-sm" value={data.settings.selectedRegion} onChange={e => updateSetting('selectedRegion', e.target.value)}>
                                        <option value="">-- {getTranslation('LABEL_NONE', currentLanguage)} --</option>
                                        <option value="USA">{getTranslation('LABEL_USA', currentLanguage)}</option>
                                        <option value="Germany">{getTranslation('LABEL_GERMANY', currentLanguage)}</option>
                                        <option value="France">{getTranslation('LABEL_FRANCE', currentLanguage)}</option>
                                        <option value="UK">{getTranslation('LABEL_UK', currentLanguage)}</option>
                                        <option value="India">{getTranslation('LABEL_INDIA', currentLanguage)}</option>
                                        <option value="China">{getTranslation('LABEL_CHINA', currentLanguage)}</option>
                                    </select>
                                </div>
                            )}

                            {data.settings.mapType === 'Country' && data.settings.selectedRegion === 'India' && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_SELECT_STATE', currentLanguage)}</label>
                                    <select className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={data.settings.selectedState} onChange={e => updateSetting('selectedState', e.target.value)}>
                                        <option value="">-- {getTranslation('LABEL_NONE', currentLanguage)} --</option>
                                        <option value="IN-AN">Andaman and Nicobar Islands</option>
                                        <option value="IN-AP">Andhra Pradesh</option>
                                        <option value="IN-AR">Arunachal Pradesh</option>
                                        <option value="IN-AS">Assam</option>
                                        <option value="IN-BR">Bihar</option>
                                        <option value="IN-CH">Chandigarh</option>
                                        <option value="IN-CT">Chhattisgarh</option>
                                        <option value="IN-DN">Dadra and Nagar Haveli</option>
                                        <option value="IN-DD">Daman and Diu</option>
                                        <option value="IN-DL">Delhi</option>
                                        <option value="IN-GA">Goa</option>
                                        <option value="IN-GJ">Gujarat</option>
                                        <option value="IN-HR">Haryana</option>
                                        <option value="IN-HP">Himachal Pradesh</option>
                                        <option value="IN-JK">Jammu and Kashmir</option>
                                        <option value="IN-JH">Jharkhand</option>
                                        <option value="IN-KA">Karnataka</option>
                                        <option value="IN-KL">Kerala</option>
                                        <option value="IN-LA">Ladakh</option>
                                        <option value="IN-LD">Lakshadweep</option>
                                        <option value="IN-MP">Madhya Pradesh</option>
                                        <option value="IN-MH">Maharashtra</option>
                                        <option value="IN-MN">Manipur</option>
                                        <option value="IN-ML">Meghalaya</option>
                                        <option value="IN-MZ">Mizoram</option>
                                        <option value="IN-NL">Nagaland</option>
                                        <option value="IN-OR">Odisha</option>
                                        <option value="IN-PY">Puducherry</option>
                                        <option value="IN-PB">Punjab</option>
                                        <option value="IN-RJ">Rajasthan</option>
                                        <option value="IN-SK">Sikkim</option>
                                        <option value="IN-TN">Tamil Nadu</option>
                                        <option value="IN-TG">Telangana</option>
                                        <option value="IN-TR">Tripura</option>
                                        <option value="IN-UP">Uttar Pradesh</option>
                                        <option value="IN-UT">Uttarakhand</option>
                                        <option value="IN-WB">West Bengal</option>
                                    </select>
                                </div>
                            )}

                            {data.settings.mapType !== 'Europawahl' && data.settings.mapType !== 'Briefwahl' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_INITIAL_LOCATION_SEARCH', currentLanguage)}</label>
                                    <div className="relative">
                                        <input className="w-full border border-gray-300 p-2.5 pl-9 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={data.settings.locationSearch} onChange={e => updateSetting('locationSearch', e.target.value)} placeholder={getTranslation('LABEL_LOCATION_SEARCH_PLACEHOLDER', currentLanguage)} />
                                        <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <SectionCustomizationEditor
                            settings={data.settings}
                            onChange={updateSetting}
                            currentLanguage={currentLanguage}
                        />
                    </div>
                )}

                {activeTab === 'TRANSLATION' && showTranslationTab && (
                    <UebersetzungTab
                        data={data}
                        onUpdate={updateUebersetzungContent}
                        fields={[{ key: 'title', label: getTranslation('LABEL_MAP_TITLE', currentLanguage), type: 'input' }]}
                    />
                )}
            </div>
        </div>
    );
};

// --- CONTAINER SECTION EDITOR ---
const ContainerSectionEditor = ({ data, setData, editorAccess }: ContainerEditorChildProps) => {
    const [activeTab, setActiveTab] = useState<'CONTENT' | 'SETTINGS' | 'TRANSLATION'>('CONTENT');
    const { currentLanguage, pages, siteConfig } = useStore();
    const showTranslationTab = useMemo(
        () => getOptionalEnabledLanguages(siteConfig).length > 0,
        [siteConfig?.languages]
    );
    const translationTarget: LanguageCode = 'de';
    const page = pages.find((p) => p.id === data.pageId);
    const bindPage = isContainerSectionBindPageEnabled(data.settings);
    const boundPageTitle = getLocalizedText(page?.title, CONTENT_SOURCE_LANG);
    const boundPageDescription = page?.description || '';

    const updateContentSource = (key: string, val: string) => {
        setData((prev: Container) => ({
            ...prev,
            content: { ...prev.content, [key]: { ...(prev.content[key] as any), [CONTENT_SOURCE_LANG]: val } }
        }));
    };

    const updateContentTranslation = (key: string, val: string) => {
        setData((prev: Container) => ({
            ...prev,
            content: { ...prev.content, [key]: { ...(prev.content[key] as any), [translationTarget]: val } }
        }));
    };

    const updateSetting = (key: string, val: any) => {
        setData((prev: Container) => ({ ...prev, settings: { ...prev.settings, [key]: val } }));
    };

    const updateHeroTitleColor = (preset: string, customHex?: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: { ...prev.settings, ...buildHeroTitleColorPatch(preset, customHex, prev.settings) },
        }));
    };

    const updateHeroDescriptionColor = (preset: string, customHex?: string) => {
        setData((prev: Container) => ({
            ...prev,
            settings: { ...prev.settings, ...buildHeroDescriptionColorPatch(preset, customHex, prev.settings) },
        }));
    };

    const heroTitleColorSetting = getHeroTitleColorSetting(data.settings);
    const heroTitleCustomColor = getHeroTitleCustomColor(data.settings);
    const heroDescriptionColorSetting = getHeroDescriptionColorSetting(data.settings);
    const heroDescriptionCustomColor = getHeroDescriptionCustomColor(data.settings);
    const defaultLetterCase = 'uppercase';
    const resolvedAlign = String(data.settings.align || data.settings.alignment || 'left').toLowerCase();
    const showTitleUnderline = data.settings?.showTitleUnderline !== false;
    const displayTitle = bindPage
        ? boundPageTitle.trim()
        : getExactLanguageText(data.content.title, CONTENT_SOURCE_LANG).trim();

    const resolvedBgColor = data.settings.bgColor || data.settings.backgroundColor || '#ffffff';
    const bgTypeNormalized = String(data.settings.bgType || '').toLowerCase();
    const resolvedBgType = ((bgTypeNormalized === 'none' || bgTypeNormalized === 'color' || bgTypeNormalized === 'site-color' || bgTypeNormalized === 'site' || bgTypeNormalized === 'sitecolor')
        ? ((bgTypeNormalized === 'site' || bgTypeNormalized === 'sitecolor') ? 'site-color' : bgTypeNormalized)
        : (
            data.settings.backgroundColor === 'site-color'
                ? 'site-color'
                : ((data.settings.bgColor || data.settings.backgroundColor) ? 'color' : 'none')
        )) as 'none' | 'color' | 'site-color';

    if (!canShowFullContainerEditor(editorAccess.role, data.settings)) {
        return (
            <SiteAdminRestrictedEditor
                data={data}
                setData={setData}
                role={editorAccess.role}
                editableFields={editorAccess.editableFields ?? []}
                currentLanguage={currentLanguage}
                showTemplateBanner={Boolean(data.settings?.sectionTemplateId)}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex border-b border-gray-200 bg-gray-50">
                <TabButton active={activeTab === 'CONTENT'} label={getTranslation('LABEL_MANAGE_CONTENT', currentLanguage)} onClick={() => setActiveTab('CONTENT')} />
                <TabButton active={activeTab === 'SETTINGS'} label={getTranslation('LABEL_SETTINGS', currentLanguage)} onClick={() => setActiveTab('SETTINGS')} />
                {showTranslationTab && (
                    <TabButton active={activeTab === 'TRANSLATION'} label={getTranslation('LABEL_TRANSLATION', currentLanguage)} onClick={() => setActiveTab('TRANSLATION')} />
                )}
            </div>

            <div className={EDITOR_SCROLL_CLASS}>
                {activeTab === 'CONTENT' && (
                    <div className="py-3 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="max-w-2xl">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_CONTAINER_TITLE_INTERNAL', currentLanguage)}</label>
                            <input
                                className="w-full border p-2.5 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded-sm"
                                value={data.title || ''}
                                onChange={(e) => setData({ ...data, title: e.target.value })}
                                placeholder={getTranslation('LABEL_INTERNAL_TITLE_PLACEHOLDER', currentLanguage)}
                            />
                        </div>
                        <BindPageTitleDescriptionField
                            checked={bindPage}
                            onChange={(checked) => updateSetting('bindPageTitleDescription', checked)}
                        />
                        <div className={bindPage ? 'opacity-50 pointer-events-none space-y-6' : 'space-y-6'}>
                            <div className="max-w-2xl">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_HEADING', currentLanguage)}</label>
                                <input
                                    className="w-full border p-2.5 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded-sm"
                                    value={getExactLanguageText(data.content.title, CONTENT_SOURCE_LANG)}
                                    onChange={(e) => updateContentSource('title', e.target.value)}
                                    placeholder={getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_HEADING', currentLanguage)}
                                    disabled={bindPage}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_PAGE_CONTENT_RICH_TEXT', currentLanguage)}</label>
                                <JoditRichTextEditor
                                    value={data.settings?.body || ''}
                                    onChange={(val: string) => updateSetting('body', val)}
                                    height={400}
                                    placeholder={getTranslation('LABEL_WRITE_PAGE_CONTENT_HERE', currentLanguage)}
                                />
                            </div>
                        </div>
                        {bindPage && (boundPageTitle || boundPageDescription) && (
                            <div className="pt-2 border-t border-gray-100">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{getTranslation('LABEL_CONTENT_PREVIEW', currentLanguage)}</p>
                                {boundPageTitle && (
                                    <p className="text-sm font-bold text-gray-800 mb-2">{boundPageTitle}</p>
                                )}
                                {boundPageDescription && (
                                    <div
                                        className="jodit-wysiwyg prose prose-sm max-w-none text-gray-600 text-sm"
                                        dangerouslySetInnerHTML={{ __html: boundPageDescription }}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'SETTINGS' && (
                    <div className="py-3 space-y-8 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 uppercase text-xs tracking-wider">{getTranslation('LABEL_HEADING_BACKGROUND', currentLanguage)}</h4>
                            <div className="grid grid-cols-2 gap-6 max-w-xl">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_HEADING_BACKGROUND', currentLanguage)}</label>
                                    <select
                                        className="w-full border p-2 text-sm rounded-sm bg-white"
                                        value={resolvedBgType}
                                        onChange={(e) => updateSetting('bgType', e.target.value)}
                                    >
                                        <option value="none">{getTranslation('LABEL_NONE', currentLanguage)}</option>
                                        <option value="color">{getTranslation('LABEL_BACKGROUND_COLOR', currentLanguage)}</option>
                                        <option value="site-color">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                    </select>
                                </div>
                                {resolvedBgType === 'color' && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_COLOR_SHORT', currentLanguage)}</label>
                                        <ColorPicker
                                            value={resolvedBgColor}
                                            onChange={(v) => {
                                                updateSetting('bgColor', v);
                                                updateSetting('backgroundColor', v);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                            {displayTitle && (
                                <label className="flex items-center gap-2 cursor-pointer select-none mt-4">
                                    <input
                                        type="checkbox"
                                        checked={showTitleUnderline}
                                        onChange={e => updateSetting('showTitleUnderline', e.target.checked)}
                                        className="focus:ring-1 focus:ring-[var(--primary-color)]"
                                    />
                                    <span className="text-sm text-gray-700">{getTranslation('LABEL_SHOW_TITLE_UNDERLINE', currentLanguage)}</span>
                                </label>
                            )}
                        </div>

                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 uppercase text-xs tracking-wider">{getTranslation('LABEL_TYPOGRAPHY', currentLanguage)}</h4>
                            <div className="grid grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_HEADING_COLOR', currentLanguage)}</label>
                                    <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={heroTitleColorSetting} onChange={(e) => updateHeroTitleColor(e.target.value)}>
                                        <option value="site">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                        <option value="black">{getTranslation('LABEL_BLACK', currentLanguage)}</option>
                                        <option value="white">{getTranslation('LABEL_WHITE', currentLanguage)}</option>
                                        <option value="custom">{getTranslation('LABEL_CUSTOM_COLOR', currentLanguage)}</option>
                                    </select>
                                    {heroTitleColorSetting === 'custom' && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                            <ColorPicker value={heroTitleCustomColor} onChange={(v) => updateHeroTitleColor('custom', v)} />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_DESCRIPTION_COLOR', currentLanguage)}</label>
                                    <select
                                        className="w-full border p-2 text-sm rounded-sm bg-white mb-2"
                                        value={heroDescriptionColorSetting}
                                        onChange={(e) => updateHeroDescriptionColor(e.target.value)}
                                    >
                                        {HERO_DESCRIPTION_COLOR_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {getTranslation(opt.labelKey, currentLanguage)}
                                            </option>
                                        ))}
                                    </select>
                                    {heroDescriptionColorSetting === 'custom' && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                            <ColorPicker value={heroDescriptionCustomColor} onChange={(v) => updateHeroDescriptionColor('custom', v)} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 mb-6 items-start">
                                <HeroTypographyStyleColumn
                                    role="title"
                                    styleLabelKey="LABEL_HEADING_STYLE"
                                    customSectionLabelKey="LABEL_CUSTOM_HEADING_STYLE"
                                    settings={data.settings}
                                    updateSetting={updateSetting}
                                    currentLanguage={currentLanguage}
                                />
                                <HeroTypographyStyleColumn
                                    role="description"
                                    styleLabelKey="LABEL_DESCRIPTION_STYLE"
                                    customSectionLabelKey="LABEL_CUSTOM_DESCRIPTION_STYLE"
                                    settings={data.settings}
                                    updateSetting={updateSetting}
                                    currentLanguage={currentLanguage}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_CONTENT_ALIGNMENT', currentLanguage)}</label>
                                    <div className="flex border rounded-sm overflow-hidden">
                                        {(['left', 'center'] as const).map(align => (
                                            <button
                                                key={align}
                                                type="button"
                                                onClick={() => {
                                                    updateSetting('alignment', align);
                                                    updateSetting('align', align);
                                                }}
                                                className={`ws-content-align-btn flex-1 py-2 flex justify-center ${resolvedAlign === align ? 'bg-[var(--primary-color)] text-white' : 'bg-white hover:bg-gray-50'}`}
                                            >
                                                {align === 'left' ? <AlignLeft className="w-4 h-4" /> : <AlignCenter className="w-4 h-4" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_HEADING_LETTER_CASE', currentLanguage)}</label>
                                    <select
                                        className="w-full border p-2 text-sm rounded-sm bg-white"
                                        value={data.settings.letterCase || defaultLetterCase}
                                        onChange={(e) => updateSetting('letterCase', e.target.value)}
                                    >
                                        <option value="uppercase">{getTranslation('LABEL_UPPERCASE', currentLanguage)}</option>
                                        <option value="lowercase">{getTranslation('LABEL_LOWERCASE', currentLanguage)}</option>
                                        <option value="sentence">{getTranslation('LABEL_SENTENCE_CASE', currentLanguage)}</option>
                                        <option value="title">{getTranslation('LABEL_TITLE_CASE', currentLanguage)}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <SectionCustomizationEditor
                            settings={data.settings}
                            onChange={updateSetting}
                            currentLanguage={currentLanguage}
                        />
                    </div>
                )}

                {activeTab === 'TRANSLATION' && showTranslationTab && (
                    bindPage ? (
                        <div className="py-6 px-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-sm">
                            {getTranslation('TOOLTIP_BIND_PAGE_TITLE_DESCRIPTION', currentLanguage)}
                        </div>
                    ) : (
                        <UebersetzungTab
                            data={data}
                            onUpdate={updateContentTranslation}
                            fields={[
                                { key: 'title', label: getTranslation('LABEL_HEADING', currentLanguage), type: 'input' },
                                {
                                    key: 'body',
                                    label: getTranslation('LABEL_PAGE_CONTENT_RICH_TEXT', currentLanguage),
                                    type: 'rich',
                                    getValue: (lang: string) => {
                                        if (lang === 'en') return data.settings?.body || '';
                                        return data.settings?.translations?.[lang]?.body || '';
                                    },
                                    onChange: (value: string) => {
                                        setData((prev: Container) => ({
                                            ...prev,
                                            settings: {
                                                ...prev.settings,
                                                translations: {
                                                    ...(prev.settings?.translations || {}),
                                                    [translationTarget]: {
                                                        ...(prev.settings?.translations?.[translationTarget] || {}),
                                                        body: value
                                                    }
                                                }
                                            }
                                        }));
                                    }
                                },
                            ]}
                        />
                    )
                )}
            </div>
        </div>
    );
};

export const ContainerEditorModal = ({ onClose }: { onClose: () => void }) => {
    const { editingContainerId, pages, updateContainer, deleteContainer, syncContainerPreview, currentLanguage, currentPageId, webStudioUserRole, sectionTemplates } = useStore();
    const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);

    // 1. Find Container
    const containerData = useMemo(() => {
        if (!editingContainerId) return null;
        // First check the current active page to avoid collisions with duplicate container IDs
        const currentPage = pages.find(p => p.id === currentPageId);
        if (currentPage) {
            const container = currentPage.containers.find(c => c.id === editingContainerId);
            if (container) return { container, pageId: currentPage.id };
        }
        // Fallback to checking other pages
        for (const page of pages) {
            if (page.id === currentPageId) continue;
            const container = page.containers.find(c => c.id === editingContainerId);
            if (container) return { container, pageId: page.id };
        }
        return null;
    }, [editingContainerId, pages, currentPageId]);

    const linkedTemplateSignature = useMemo(() => {
        const templateId = containerData?.container.settings?.sectionTemplateId;
        if (!templateId) return '';
        const template = sectionTemplates.find((t) => t.id === templateId);
        if (!template) return templateId;
        return JSON.stringify({
            id: template.id,
            settings: template.settings,
            content: template.content,
            editableFields: template.editableFields,
            status: template.status,
        });
    }, [containerData?.container.settings?.sectionTemplateId, sectionTemplates]);

    const [localContainer, setLocalContainer] = useState<Container | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const didSaveRef = useRef(false);
    const originalContainerRef = useRef<Container | null>(null);
    const initializedContainerIdRef = useRef<string | null>(null);
    const currentPageIdRef = useRef<string | null>(null);

    // Guard flag: when we push localContainer → store, the store update causes
    // containerData to re-compute. We don't want that to overwrite localContainer.
    const isSyncingPreview = useRef(false);

    const initializedTemplateSignatureRef = useRef<string | null>(null);

    // Init / refresh local state from saved container + live org template.
    useEffect(() => {
        if (isSyncingPreview.current) return;
        if (!editingContainerId || !containerData) {
            if (!editingContainerId) {
                initializedContainerIdRef.current = null;
                initializedTemplateSignatureRef.current = null;
                setLocalContainer(null);
            }
            return;
        }

        const isNewEditorSession = initializedContainerIdRef.current !== editingContainerId;
        const templateChanged = initializedTemplateSignatureRef.current !== linkedTemplateSignature;
        if (!isNewEditorSession && !templateChanged) return;

        const rawSnapshot = JSON.parse(JSON.stringify(containerData.container)) as Container;
        const mergedSnapshot = resolveContainerWithLiveTemplate(rawSnapshot, sectionTemplates);

        originalContainerRef.current = rawSnapshot;
        setLocalContainer(mergedSnapshot);
        initializedContainerIdRef.current = editingContainerId;
        initializedTemplateSignatureRef.current = linkedTemplateSignature;
        currentPageIdRef.current = containerData.pageId;
    }, [editingContainerId, containerData, linkedTemplateSignature, sectionTemplates]);

    // If modal closes without save (cancel, X, or backdrop click), restore original container snapshot.
    useEffect(() => {
        return () => {
            if (!didSaveRef.current && currentPageIdRef.current && originalContainerRef.current) {
                syncContainerPreview(currentPageIdRef.current, JSON.parse(JSON.stringify(originalContainerRef.current)));
            }
        };
    }, []);

    // Live preview: push every localContainer change into the in-memory store
    useEffect(() => {
        if (!localContainer || !containerData) return;
        isSyncingPreview.current = true;
        syncContainerPreview(containerData.pageId, JSON.parse(JSON.stringify(localContainer)));
        // Reset the guard after React has flushed the store update
        const id = window.setTimeout(() => { isSyncingPreview.current = false; }, 0);
        return () => window.clearTimeout(id);
    }, [localContainer]);

    if (!containerData || !localContainer) return null;

    if (localContainer.type === ContainerType.SLIDER && isImageTextSliderContainer(localContainer.settings)) {
        const editableFields = resolveContainerEditableFields(
            localContainer.type,
            localContainer.settings,
            sectionTemplates.find((t) => t.id === localContainer.settings?.sectionTemplateId)?.editableFields
        );
        return (
            <SliderManager
                onClose={onClose}
                editorAccess={{ role: webStudioUserRole, editableFields }}
                containerOverride={localContainer}
                onContainerChange={(updated) => {
                    setLocalContainer(updated);
                    if (containerData?.pageId) {
                        syncContainerPreview(containerData.pageId, JSON.parse(JSON.stringify(updated)));
                    }
                }}
            />
        );
    }

    const editableFields = resolveContainerEditableFields(
        localContainer.type,
        localContainer.settings,
        sectionTemplates.find((t) => t.id === localContainer.settings?.sectionTemplateId)?.editableFields
    );
    const editorAccess = { role: webStudioUserRole, editableFields };
    const showSaveTemplateBtn = canManageTemplates(webStudioUserRole);
    const editorLockState = {
        hideDesignSettings: isContentLockedEditor(webStudioUserRole, localContainer.settings),
        isTemplateEditorMode: false,
    };

    const handleSave = async () => {
        if (!containerData?.pageId || !localContainer) return;
        try {
            didSaveRef.current = true;
            await updateContainer(containerData.pageId, localContainer);
            originalContainerRef.current = JSON.parse(JSON.stringify(localContainer));
            onClose();
        } catch (error) {
            didSaveRef.current = false;
            console.error('Failed to save container:', error);
        }
    };

    const handleDeleteContainer = async () => {
        if (!containerData) return;
        await deleteContainer(containerData.pageId, containerData.container.id);
        onClose();
    };

    // Determine Title based on type
    const getTitle = () => {
        switch (localContainer.type) {
            case ContainerType.HERO: return getTranslation('LABEL_HERO_EDITOR', currentLanguage);
            case ContainerType.SLIDER:
                return isImageTextSliderContainer(localContainer.settings)
                    ? getTranslation('LABEL_SLIDER_MANAGER', currentLanguage)
                    : getTranslation('LABEL_GALLERY_CAROUSEL', currentLanguage);
            case ContainerType.CARD_GRID: return getTranslation('LABEL_DATA_GRID_EDITOR', currentLanguage);
            case ContainerType.CONTACT_FORM: return getTranslation('LABEL_CONTACT_FORM_EDITOR', currentLanguage);
            case ContainerType.TABLE: return getTranslation('LABEL_TABLE_VIEW_EDITOR', currentLanguage);
            case ContainerType.MAP: return getTranslation('LABEL_MAP_EDITOR', currentLanguage);
            case ContainerType.CONTAINER_SECTION: return getTranslation('LABEL_CONTAINER_SECTION_EDITOR', currentLanguage);
            default: return getTranslation('LABEL_CONTAINER_EDITOR', currentLanguage);
        }
    };

    // Render Content
    const renderEditor = () => {
        switch (localContainer.type) {
            case ContainerType.HERO:
                return <HeroEditor data={localContainer} setData={setLocalContainer} onClose={onClose} editorAccess={editorAccess} />;
            case ContainerType.SLIDER:
                return <DataGridEditor data={localContainer} setData={setLocalContainer} onClose={onClose} editorAccess={editorAccess} />;
            case ContainerType.CARD_GRID:
                return <DataGridEditor data={localContainer} setData={setLocalContainer} onClose={onClose} editorAccess={editorAccess} />;
            case ContainerType.CONTACT_FORM:
                return <ContactFormEditor data={localContainer} setData={setLocalContainer} onClose={onClose} editorAccess={editorAccess} />;
            case ContainerType.TABLE:
                return <TableEditor data={localContainer} setData={setLocalContainer} onClose={onClose} editorAccess={editorAccess} />;
            case ContainerType.MAP:
                return <MapEditor data={localContainer} setData={setLocalContainer} onClose={onClose} editorAccess={editorAccess} />;
            case ContainerType.CONTAINER_SECTION:
                return <ContainerSectionEditor data={localContainer} setData={setLocalContainer} editorAccess={editorAccess} />;
            default:
                return <div className="p-8 text-center text-gray-500">{getTranslation('LABEL_EDITOR_NOT_AVAILABLE', currentLanguage)}</div>;
        }
    };

    return (
        <ContainerEditorLockProvider value={editorLockState}>
        <GenericModal
            title={getTitle()}
            onClose={onClose}
            width="w-[80vw] min-w-[80vw] max-w-[80vw]"
            noBodyPadding={localContainer.type === ContainerType.CONTACT_FORM}
            headerIcons={<TooltipMenu ComponentId={'13828'} />}
            customFooter={
                <div className="flex w-full">
                    <div className="flex-1">
                        <SharePointMetadataFooter
                            listTitle="Containers"
                            itemId={localContainer.id}
                            createdDate={localContainer.createdDate}
                            createdBy={localContainer.createdBy}
                            modifiedDate={localContainer.modifiedDate}
                            modifiedBy={localContainer.modifiedBy}
                            onDelete={() => setShowDeleteConfirm(true)}
                            onVersionRestore={async () => {
                                didSaveRef.current = true;
                                await useStore.getState().loadFromSharePoint();
                                onClose();
                            }}
                        />
                    </div>
                    <div className="flex gap-3 flex-shrink-0 items-center">
                        {showSaveTemplateBtn && (
                            <button
                                type="button"
                                onClick={() => setShowSaveAsTemplate(true)}
                                className="px-6 py-2 border border-gray-300 bg-white text-gray-800 text-sm font-bold hover:bg-gray-50 transition-colors rounded-sm tracking-wide"
                            >
                                {getTranslation('BTN_SAVE_AS_TEMPLATE', currentLanguage)}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary inline-flex items-center justify-center gap-2"
                        >
                            {getTranslation('LABEL_CANCEL', currentLanguage)}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="btn-primary inline-flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" /> {getTranslation('LABEL_SAVE_CHANGES', currentLanguage)}
                        </button>
                    </div>
                </div>
            }
        >
            <div className="h-full flex flex-col bg-white">
                <div className="flex-1 overflow-hidden">
                    {renderEditor()}
                </div>
            </div>

            {showDeleteConfirm && (
                <ConfirmDeleteDialog
                    title={getTranslation('LABEL_DELETE_CONTAINER_CONFIRM_TITLE', currentLanguage)}
                    message={getTranslation('LABEL_DELETE_CONTAINER_CONFIRM_MSG', currentLanguage)}
                    onConfirm={handleDeleteContainer}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
            {showSaveAsTemplate && (
                <SaveAsTemplateModal
                    container={localContainer}
                    onClose={() => setShowSaveAsTemplate(false)}
                />
            )}
        </GenericModal>
        </ContainerEditorLockProvider>
    );
};

/** Super Admin full-section editor for creating/editing org templates with all design settings. */
export const SectionTemplateFullEditorModal = ({
    template,
    categoryId,
    onClose,
    onSaved,
}: {
    template?: SectionTemplate | null;
    categoryId: string;
    onClose: () => void;
    onSaved?: (template: SectionTemplate) => void;
}) => {
    const {
        addSectionTemplate,
        updateSectionTemplate,
        sectionTemplates,
        currentLanguage,
        themeConfig,
    } = useStore();
    const t = (key: string) => getTranslation(key, currentLanguage);

    const containerType = CATEGORY_TO_CONTAINER_TYPE[categoryId] || ContainerType.HERO;
    const sectionLabel = t(
        { HEADER: 'TAB_CONTAINER_HEADER', SLIDER: 'TAB_CONTAINER_SLIDER', DATA_GRID: 'TAB_CONTAINER_DATA_GRID', CONTACT_FORM: 'TAB_CONTAINER_CONTACT_FORM', MAP: 'TAB_CONTAINER_MAP', CONTAINER_SECTION: 'TAB_CONTAINER_CONTAINER_SECTION' }[categoryId] || categoryId
    );
    const isEdit = Boolean(template?.id && !String(template.id).startsWith('tmpl_') && !String(template.id).startsWith('builtin_'));
    const isBuiltinDraft = Boolean(template?.id && String(template.id).startsWith('builtin_'));
    const needsDataSourceSetup = categoryId === 'DATA_GRID' && !isEdit && !isBuiltinDraft;
    const needsSliderSetup = categoryId === 'SLIDER' && !isEdit && !isBuiltinDraft;
    const needsMapSetup = categoryId === 'MAP' && !isEdit && !isBuiltinDraft;

    const [wizardStep, setWizardStep] = useState<'setup' | 'editor'>(() =>
        (needsDataSourceSetup || needsSliderSetup || needsMapSetup) ? 'setup' : 'editor'
    );
    const [setupDataSource, setSetupDataSource] = useState('News');
    const [setupCardPreset, setSetupCardPreset] = useState('cards_grid_3');
    const [setupSliderTemplate, setSetupSliderTemplate] = useState('img_gallery');
    const [setupMapPreset, setSetupMapPreset] = useState('map_world');

    const [title, setTitle] = useState(template?.title || '');
    const [description, setDescription] = useState(template?.description || '');
    const [status, setStatus] = useState<'Draft' | 'Published'>(template?.status || 'Draft');
    const [editableFields, setEditableFields] = useState<string[]>(() =>
        sanitizeTemplateEditableFields(
            containerType,
            template?.editableFields ?? getDefaultEditableFields(containerType)
        )
    );
    const [draftContainer, setDraftContainer] = useState<Container>(() => {
        const baseSettings = template?.settings || getDefaultTemplateSettingsForCategory(categoryId);
        const normalizedSettings = containerType === ContainerType.SLIDER
            ? normalizeSliderTemplateSettings(baseSettings)
            : containerType === ContainerType.MAP
                ? normalizeMapTemplateSettings(baseSettings)
                : baseSettings;
        return {
            id: 'template_draft',
            pageId: '',
            type: containerType,
            order: 0,
            isVisible: true,
            status: 'Draft',
            settings: { ...normalizedSettings },
            content: { ...(template?.content || {}) },
        };
    });
    const [isSaving, setIsSaving] = useState(false);

    const sidebarFieldCatalog = useMemo(
        () => getTemplateSidebarFieldCatalog(containerType),
        [containerType]
    );
    const fieldsByCategory = useMemo(() => {
        const groups: Record<string, typeof sidebarFieldCatalog> = {};
        sidebarFieldCatalog.forEach((field) => {
            const cat = field.category || 'content';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(field);
        });
        return groups;
    }, [sidebarFieldCatalog]);
    const templateFieldCategories: Array<{ key: string; labelKey: string }> = [
        { key: 'display', labelKey: 'TMPL_CATEGORY_DISPLAY' },
        { key: 'design', labelKey: 'TMPL_CATEGORY_DESIGN' },
    ];
    const nextSortOrder = useMemo(
        () => sectionTemplates.reduce((max, tmpl) => Math.max(max, tmpl.sortOrder || 0), 0) + 1,
        [sectionTemplates]
    );
    const editorAccess: EditorAccessConfig = { role: 'super_admin', isTemplateEditor: true };

    const cardLayoutPresets = [
        { id: 'cards_grid_3', labelKey: 'TMPL_CARDS_GRID_3_LABEL', descKey: 'TMPL_CARDS_GRID_3_DESC' },
        { id: 'cards_2col', labelKey: 'TMPL_CARDS_2COL_LABEL', descKey: 'TMPL_CARDS_2COL_DESC' },
        { id: 'cards_slider', labelKey: 'TMPL_CARDS_SLIDER_LABEL', descKey: 'TMPL_CARDS_SLIDER_DESC' },
    ];
    const sliderTemplatePresets = [
        { id: 'img_gallery', labelKey: 'TMPL_IMG_GALLERY_LABEL', descKey: 'TMPL_IMG_GALLERY_DESC' },
        { id: 'img_text', labelKey: 'TMPL_IMG_TEXT_LABEL', descKey: 'TMPL_IMG_TEXT_DESC' },
    ];
    const mapTemplatePresets = [
        { id: 'map_world', labelKey: 'TMPL_MAP_WORLD_LABEL', descKey: 'TMPL_MAP_WORLD_DESC' },
        { id: 'map_continent', labelKey: 'TMPL_MAP_CONTINENT_LABEL', descKey: 'TMPL_MAP_CONTINENT_DESC' },
        { id: 'map_country', labelKey: 'TMPL_MAP_COUNTRY_LABEL', descKey: 'TMPL_MAP_COUNTRY_DESC' },
        { id: 'map_briefwahl', labelKey: 'TMPL_MAP_BRIEFWAHL_LABEL', descKey: 'TMPL_MAP_BRIEFWAHL_DESC' },
        { id: 'map_europawahl', labelKey: 'TMPL_MAP_EUROPAWAHL_LABEL', descKey: 'TMPL_MAP_EUROPAWAHL_DESC' },
    ];

    const applySetupAndContinue = () => {
        if (needsDataSourceSetup) {
            setDraftContainer((prev) => ({
                ...prev,
                type: ContainerType.CARD_GRID,
                settings: buildCardGridTemplateSettingsForSource(setupDataSource, setupCardPreset),
            }));
        } else if (needsSliderSetup) {
            const presetSettings = normalizeSliderTemplateSettings({
                ...getBuiltinPresetSettings('SLIDER', setupSliderTemplate),
                source: 'ImageSlider',
                taggedItems: [],
                slides: [],
            });
            setDraftContainer((prev) => ({
                ...prev,
                type: ContainerType.SLIDER,
                settings: presetSettings,
                content: hydrateTemplateContentForContainer(
                    ContainerType.SLIDER,
                    {},
                    presetSettings,
                    {
                        templateTitle: title,
                        labelHeading: t('DEFAULT_PAGE_CONTENT_PREVIEW_HEADING'),
                        labelSubheading: t('DEFAULT_PAGE_CONTENT_PREVIEW_SUBHEADING'),
                        labelDescription: `<p>${t('DEFAULT_PAGE_CONTENT_PREVIEW_BODY')}</p>`,
                    }
                ),
            }));
        } else if (needsMapSetup) {
            const presetSettings = normalizeMapTemplateSettings(getBuiltinPresetSettings('MAP', setupMapPreset));
            setDraftContainer((prev) => ({
                ...prev,
                type: ContainerType.MAP,
                settings: presetSettings,
                content: hydrateTemplateContentForContainer(
                    ContainerType.MAP,
                    {},
                    presetSettings,
                    { templateTitle: title, labelHeading: t('LABEL_ENTER_MAP_TITLE') }
                ),
            }));
        }
        setWizardStep('editor');
    };

    const toggleField = (key: string) => {
        setEditableFields((prev) => {
            const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
            if (containerType === ContainerType.HERO && key === 'settings.btnEnabled') {
                const buttonEnabled = next.includes('settings.btnEnabled');
                setDraftContainer((draft) => ({
                    ...draft,
                    settings: { ...draft.settings, btnEnabled: buttonEnabled },
                }));
            }
            return next;
        });
    };

    const handleSave = async () => {
        if (!title.trim()) return;
        setIsSaving(true);
        const { sectionTemplateId: _a, sectionTemplateEditableFields: _b, ...cleanSettings } = draftContainer.settings || {};
        const normalizedSettings = normalizeTemplateSettingsForSave(
            draftContainer.type,
            cleanSettings,
            sanitizeTemplateEditableFields(containerType, editableFields)
        );

        const payload: SectionTemplate = {
            id: template?.id || `tmpl_${Date.now()}`,
            title: title.trim(),
            description: description.trim(),
            containerType,
            status,
            settings: normalizedSettings,
            content: { ...draftContainer.content },
            editableFields: sanitizeTemplateEditableFields(containerType, editableFields),
            sortOrder: template?.sortOrder ?? nextSortOrder,
        };

        if (isEdit) {
            await updateSectionTemplate(payload);
            onSaved?.(payload);
        } else {
            const saved = await addSectionTemplate(payload);
            if (saved) onSaved?.(saved);
        }
        setIsSaving(false);
        onClose();
    };

    const renderSetupStep = () => (
        <div className="h-full overflow-y-auto bg-gray-50 p-8">
            <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-sm shadow-sm p-8 space-y-8">
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">
                        {needsSliderSetup
                            ? t('TITLE_TEMPLATE_CHOOSE_SLIDER_TYPE')
                            : needsMapSetup
                                ? t('TITLE_TEMPLATE_CHOOSE_MAP_TYPE')
                                : t('TITLE_TEMPLATE_CHOOSE_DATA_SOURCE')}
                    </h3>
                    <p className="text-sm text-gray-500 mt-2">{t('MSG_TEMPLATE_DATA_SOURCE_HINT')}</p>
                </div>

                {needsDataSourceSetup && (
                    <>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                {t('LABEL_DATA_SOURCE')} <span className="text-red-500">*</span>
                            </label>
                            <select
                                className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                value={setupDataSource}
                                onChange={(e) => setSetupDataSource(e.target.value)}
                            >
                                {TEMPLATE_DATA_SOURCE_OPTIONS.map((ds) => (
                                    <option key={ds} value={ds}>
                                        {ds === 'Container Items'
                                            ? t('DATA_SOURCE_CONTAINER_ITEMS')
                                            : ds === 'SmartPages'
                                                ? 'Smart Pages'
                                                : ds}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-3">{t('LABEL_CARD_LAYOUT')}</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {cardLayoutPresets.map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => setSetupCardPreset(preset.id)}
                                        className={`text-left p-4 border rounded-sm transition-all ${setupCardPreset === preset.id ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)] bg-[var(--brand-light)]' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                                    >
                                        <span className="block text-sm font-bold text-gray-800">{t(preset.labelKey)}</span>
                                        <span className="block text-xs text-gray-500 mt-1">{t(preset.descKey)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {needsSliderSetup && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {sliderTemplatePresets.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => setSetupSliderTemplate(preset.id)}
                                className={`text-left p-4 border rounded-sm transition-all ${setupSliderTemplate === preset.id ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)] bg-[var(--brand-light)]' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                            >
                                <span className="block text-sm font-bold text-gray-800">{t(preset.labelKey)}</span>
                                <span className="block text-xs text-gray-500 mt-1">{t(preset.descKey)}</span>
                            </button>
                        ))}
                    </div>
                )}

                {needsMapSetup && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {mapTemplatePresets.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => setSetupMapPreset(preset.id)}
                                className={`text-left p-4 border rounded-sm transition-all ${setupMapPreset === preset.id ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)] bg-[var(--brand-light)]' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                            >
                                <span className="block text-sm font-bold text-gray-800">{t(preset.labelKey)}</span>
                                <span className="block text-xs text-gray-500 mt-1">{t(preset.descKey)}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button type="button" onClick={onClose} className="btn-secondary transition-colors inline-flex items-center justify-center gap-2">
                        {t('BTN_CANCEL')}
                    </button>
                    <button
                        type="button"
                        onClick={applySetupAndContinue}
                        className="btn-primary shadow-sm transition-colors inline-flex items-center justify-center gap-2"
                        style={{ backgroundColor: themeConfig['--primary-color'] }}
                    >
                        {t('BTN_CONTINUE')}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderEditor = () => {
        switch (draftContainer.type) {
            case ContainerType.HERO:
                return <HeroEditor data={draftContainer} setData={setDraftContainer} editorAccess={editorAccess} />;
            case ContainerType.SLIDER:
                if (isImageTextSliderContainer(draftContainer.settings)) {
                    return (
                        <SliderManager
                            embedded
                            containerOverride={draftContainer}
                            onContainerChange={setDraftContainer}
                            editorAccess={editorAccess}
                        />
                    );
                }
                return <DataGridEditor data={draftContainer} setData={setDraftContainer} onClose={onClose} editorAccess={editorAccess} />;
            case ContainerType.CARD_GRID:
                return <DataGridEditor data={draftContainer} setData={setDraftContainer} onClose={onClose} editorAccess={editorAccess} />;
            case ContainerType.CONTACT_FORM:
                return <ContactFormEditor data={draftContainer} setData={setDraftContainer} onClose={onClose} editorAccess={editorAccess} />;
            case ContainerType.CONTAINER_SECTION:
                return <ContainerSectionEditor data={draftContainer} setData={setDraftContainer} editorAccess={editorAccess} />;
            case ContainerType.MAP:
                return <MapEditor data={draftContainer} setData={setDraftContainer} onClose={onClose} editorAccess={editorAccess} />;
            default:
                return null;
        }
    };

    const modalTitle = isEdit
        ? t('TITLE_EDIT_SECTION_TEMPLATE').replace('{section}', sectionLabel)
        : t('TITLE_CREATE_SECTION_TEMPLATE').replace('{section}', sectionLabel);

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" style={{ zIndex: MODAL_Z.EDITOR }} onClick={onClose}>
            <div
                className="relative z-50 bg-white rounded-sm shadow-2xl flex flex-col h-[90vh] w-[90vw] min-w-[1000px] max-w-[1400px] animate-in fade-in zoom-in-95 duration-200 border border-gray-300 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0">
                    <div className="flex flex-col">
                        <h2 className="text-[var(--primary-color)] text-left tracking-tight" style={{ color: themeConfig['--primary-color'] }}>{modalTitle}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{t('LABEL_SECTION_TYPE')}: {sectionLabel}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-700 rounded-sm hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" style={{ color: 'var(--icon-color)' }} />
                    </button>
                </div>
                <div className="flex flex-1 min-h-0 overflow-hidden bg-gray-50/50">
                    {wizardStep === 'editor' && (
                        <aside
                            className="w-80 shrink-0 border-r p-3 overflow-y-auto space-y-5 transition-colors"
                            style={{
                                fontFamily: themeConfig['--font-family-base'],
                                fontSize: themeConfig['--font-size-base'],
                                color: themeConfig['--sidebar-text'],
                                backgroundColor: themeConfig['--sidebar-bg'],
                                borderColor: themeConfig['--sidebar-border-color']
                            }}
                        >
                            <div>
                                <label className="block font-semibold uppercase tracking-wide mb-1.5" style={{ color: themeConfig['--sidebar-text-muted'], fontSize: '0.75em' }}>{t('LABEL_TEMPLATE_NAME')}</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className={EDITOR_FIELD_INPUT}
                                    style={{
                                        borderColor: themeConfig['--sidebar-border-color'],
                                        color: themeConfig['--sidebar-text'],
                                        backgroundColor: themeConfig['--sidebar-bg']
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block font-semibold uppercase tracking-wide mb-1.5" style={{ color: themeConfig['--sidebar-text-muted'], fontSize: '0.75em' }}>{t('LABEL_TEMPLATE_DESCRIPTION')}</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={3}
                                    className={`${EDITOR_FIELD_INPUT} resize-none`}
                                    style={{
                                        borderColor: themeConfig['--sidebar-border-color'],
                                        color: themeConfig['--sidebar-text'],
                                        backgroundColor: themeConfig['--sidebar-bg']
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block font-semibold uppercase tracking-wide mb-1.5" style={{ color: themeConfig['--sidebar-text-muted'], fontSize: '0.75em' }}>{t('LABEL_TEMPLATE_STATUS')}</label>
                                <select
                                    value={status}
                                    onChange={e => setStatus(e.target.value as 'Draft' | 'Published')}
                                    className={EDITOR_FIELD_INPUT}
                                    style={{
                                        borderColor: themeConfig['--sidebar-border-color'],
                                        color: themeConfig['--sidebar-text'],
                                        backgroundColor: themeConfig['--sidebar-bg']
                                    }}
                                >
                                    <option value="Draft">Draft</option>
                                    <option value="Published">Published</option>
                                </select>
                            </div>
                            <div>
                                <label className="block font-semibold uppercase tracking-wide mb-2" style={{ color: themeConfig['--sidebar-text-muted'], fontSize: '0.75em' }}>{t('LABEL_EDITABLE_FIELDS')}</label>
                                <p className="mb-3 leading-snug" style={{ color: themeConfig['--sidebar-text-muted'], fontSize: '0.75em' }}>{t('MSG_TEMPLATE_EDITABLE_FIELDS_HINT')}</p>
                                {categoryId === 'SLIDER' && (
                                    <p className="mb-3 leading-snug pl-2" style={{ color: themeConfig['--sidebar-text-muted'], fontSize: '0.75em', borderColor: themeConfig['--sidebar-border-color'] }}>
                                        {t('MSG_TEMPLATE_SLIDER_PERMISSIONS_HINT')}
                                    </p>
                                )}
                                <div
                                    className={`${EDITOR_SECTION_CARD} p-3 space-y-4 max-h-[min(52vh,28rem)] overflow-y-auto`}
                                    style={{
                                        borderColor: themeConfig['--sidebar-border-color'],
                                        backgroundColor: themeConfig['--sidebar-bg']
                                    }}
                                >
                                    {templateFieldCategories.map(({ key, labelKey }) => {
                                        const fields = fieldsByCategory[key];
                                        if (!fields?.length) return null;
                                        return (
                                            <div key={key}>
                                                <h5 className="font-bold uppercase tracking-wider mb-1.5 px-1" style={{ color: themeConfig['--sidebar-text-muted'], fontSize: '0.75em', opacity: 0.85 }}>{t(labelKey)}</h5>
                                                <div className="space-y-0.5">
                                                    {fields.map((field) => (
                                                        <div
                                                            key={field.key}
                                                            className="flex items-center justify-between gap-2.5 py-1.5 px-1 rounded-md transition-colors hover:bg-[var(--sidebar-hover-bg)]"
                                                            style={{
                                                                color: themeConfig['--sidebar-text'],
                                                                fontSize: '0.85em'
                                                            }}
                                                        >
                                                            <span className="leading-snug">{t(field.labelKey)}</span>
                                                            <VisibilityToggle
                                                                checked={editableFields.includes(field.key)}
                                                                onCheckedChange={() => toggleField(field.key)}
                                                                ariaLabel={t(field.labelKey)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </aside>
                    )}
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                        <div className="flex-1 min-h-0 overflow-hidden">
                            {wizardStep === 'setup' ? renderSetupStep() : renderEditor()}
                        </div>
                    </div>
                </div>
                {wizardStep === 'editor' && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3 rounded-b-sm shrink-0 z-10">
                        <button type="button" onClick={onClose} className="btn-secondary transition-colors inline-flex items-center justify-center gap-2">
                            {t('BTN_CANCEL')}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!title.trim() || isSaving}
                            className="btn-primary shadow-sm transition-colors inline-flex items-center justify-center gap-2"
                            style={{ backgroundColor: themeConfig['--primary-color'] }}
                        >
                            {t('BTN_SAVE')}
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
