
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore, getTranslation, getItemTranslation, getGlobalDefaultImage } from '../../store';
import { getNestedPortalZFromStore } from '../../utils/modalZIndex';
import { resolveGalleryDefaultImage } from '../../utils/defaultImageUrl';
import { translateText } from '../../services/geminiService';
import { Container, LanguageCode, SliderImageSettings, SliderItem, ContainerType } from '../../types';
import { DEFAULT_SLIDER_IMAGE_SETTINGS } from '../../utils/sliderImageRadius';
import { parseSliderImageSettings } from '../../utils/sliderImageRadius';
import { isImageTextSliderContainer, isSettingsGroupEditable, isSettingsPathEditable, isFieldEditableForRole, hasSiteAdminSliderSettingsAccess, isTemplateRestrictedEditor, resolveContainerEditableFields, isContentEditorFieldEditable, canPublishContent, EditorAccessConfig } from '../../utils/templatePermissions';
import { buildImageTextSliderDisplayItems, createImageTextSlideEntry, DEFAULT_SLIDE_ADJUSTMENTS, isSliderLayoutToken, resolveEffectiveSlideDesign, sanitizeSliderSubtitleForDisplay, getSliderSplitMediaClassName } from '../../utils/sliderLayout';
import { GenericModal, TabButton, ConfirmDeleteDialog, EditTrigger, OpenOOTBButton, TaggedItemsOrderModal, TaggedOrderApplyResult, TaggedOrderChangeContext, ItemEditorChangeOrderButton } from './SharedModals';
import { TemplateLockedBanner } from './SaveAsTemplateModal';
import { SharePointMetadataFooter } from '../common/SharePointMetadataFooter';
import { ItemTaggingLookupFields } from '../common/ItemTaggingLookupFields';
import JoditRichTextEditor from '../JoditEditor';
import {
    Plus, X, GripVertical, Image as ImageIcon, Trash2, Copy, Pencil,
    ArrowUpDown, ChevronLeft, ChevronRight, Eye, Save,
    Link as LinkIcon, Circle, Square, Sliders, Upload, Hash,
    Search, Wand2, Check,
    AlignCenter, AlignLeft, AlignRight
} from 'lucide-react';
import TooltipMenu from '../common/TooltipMenu';
import { useValidatedField } from '../common/ValidatedTextField';
import { useOptimizedImageUpload } from '../../../../hooks/useOptimizedImageUpload';
import EditorImageTabPanel from '../common/EditorImageTabPanel';
import { applyBaseHeaderFieldUpdate } from '../../utils/containerContentHelpers';
import { getSlideDefaultHeightLabel, resolveSlideImageHeight } from '../../utils/slideImageHeight';
import { getOptionalEnabledLanguages } from '../../utils/siteLanguages';
import { sortTaggedSliderItems } from '../../utils/dataGridContentSort';
import ManagedImageEditorBridge from '../common/ManagedImageEditorBridge';
import { SectionCustomizationEditor } from './ContainerEditor';

// Images are now fetched from SharePoint Picture Library dynamically

// --- NOTE: Slider items are fully dynamic via SharePoint (no hardcoded defaults) ---

// --- HELPER COMPONENTS ---

const ColorPicker = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => (
    <div className="flex items-center gap-2 w-full">
        <div className="relative w-10 h-10 rounded-sm overflow-hidden border border-gray-300 bg-white shadow-sm flex-shrink-0">
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <div className="w-full h-full" style={{ backgroundColor: value }} />
        </div>
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 h-10 border border-gray-300 px-3 text-sm rounded-sm font-mono uppercase outline-none"
            placeholder="#HEX"
        />
    </div>
);

const VisibilityToggle = ({
    checked,
    onCheckedChange,
    ariaLabel,
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

const VisualSelector = ({ label, value, onChange, options }: { label: string, value: any, onChange: (val: any) => void, options: { value: any, label: string, icon?: any, text?: string }[] }) => (
    <div className="mb-6">
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{label}</label>
        <div className="flex bg-gray-100 p-1 rounded-sm gap-1">
            {options.map((opt) => (
                <button
                    key={opt.value.toString()}
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

const resolveTypographyColor = (colorSetting?: string, customHex?: string, defaultColor: string = 'text-[var(--primary-color)]'): { className?: string; style?: React.CSSProperties } => {
    if (!colorSetting || colorSetting === 'site') return { className: defaultColor };
    if (colorSetting === 'black') return { className: 'text-black', style: { color: '#000000' } };
    if (colorSetting === 'white') return { className: 'text-white', style: { color: '#ffffff' } };
    if (colorSetting === 'custom') return { style: { color: customHex || '#333333' } };
    return { className: defaultColor };
};

const getExactLanguageText = (value: any, language: string): string => {
    if (!value) return '';
    if (typeof value === 'string') return language === 'en' ? value : '';
    if (typeof value === 'object') {
        const exact = value[language];
        return typeof exact === 'string' ? exact : '';
    }
    return '';
};

const normalizeSliderLetterCase = (rawValue: any): 'uppercase' | 'lowercase' | 'capitalize' | 'normal-case' => {
    const value = String(rawValue || '').trim().toLowerCase();
    if (!value || value === 'none' || value === 'normal-case' || value === 'sentence' || value === 'sentence case') return 'normal-case';
    if (value === 'uppercase') return 'uppercase';
    if (value === 'lowercase') return 'lowercase';
    if (value === 'capitalize' || value === 'title' || value === 'title case') return 'capitalize';
    return 'normal-case';
};

const toPxValue = (value: any): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const raw = String(value).trim();
    if (!raw) return undefined;
    return raw.endsWith('px') ? raw : `${raw}px`;
};

const getSliderHeadingPreviewStyle = (settings: any): React.CSSProperties => {
    const preset = String(settings?.titleStyle || '').trim().toLowerCase();
    const presetFontSize = preset === 'h1'
        ? '42px'
        : preset === 'h2'
            ? '32px'
            : preset === 'h3'
                ? '24px'
                : preset === 'h4'
                    ? '20px'
                    : preset === 'h5'
                        ? '16px'
                        : preset === 'h6'
                            ? '14px'
                            : preset === 'paragraph'
                                ? '14px'
                                : undefined;

    return {
        fontFamily: 'var(--font-family-secondary, sans-serif)',
        fontSize: toPxValue(settings?.titleFontSize) || presetFontSize || '1.875rem',
        ...(settings?.titleFontWeight ? { fontWeight: settings.titleFontWeight } : {}),
        ...(toPxValue(settings?.titleLineHeight) ? { lineHeight: toPxValue(settings?.titleLineHeight) } : {}),
    };
};

const SLIDER_EDITOR_SOURCE_LANG = 'en';

const ImagePicker = ({ value, onChange }: { value: string, onChange: (url: string, name: string) => void }) => {
    const [tab, setTab] = useState<'LIB' | 'URL' | 'UPLOAD'>('LIB');
    const { images, uploadImage, currentLanguage } = useStore();
    const imageUpload = useOptimizedImageUpload(uploadImage);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const uploaded = await imageUpload.uploadFile(file, 'Containers');
        if (uploaded) {
            onChange((uploaded as { url: string }).url, (uploaded as { name: string }).name);
        }
    };

    return (
        <div className="bg-gray-50 border border-gray-200 rounded-sm p-4">
            <div className="flex gap-4 border-b border-gray-200 mb-4">
                {['LIB', 'URL', 'UPLOAD'].map((t, i) => {
                    const label = t === 'LIB' ? getTranslation('TAB_EXISTING_IMAGES', currentLanguage) :
                        t === 'URL' ? getTranslation('TAB_IMAGE_URL', currentLanguage) :
                            getTranslation('TAB_UPLOAD_IMAGE', currentLanguage);
                    return (
                        <button key={t} onClick={() => setTab(t as any)} className={`pb-2 text-xs font-bold uppercase ${tab === t ? 'text-[var(--primary-color)] border-b-2 border-[var(--primary-color)]' : 'text-gray-500'}`}>{label}</button>
                    );
                })}
            </div>

            {tab === 'LIB' && (
                <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1">
                    {images.map((img) => (
                        <div key={img.id} className="relative group aspect-square">
                            <img
                                src={img.url}
                                onClick={() => onChange(img.url, img.name)}
                                className={`w-full h-full object-cover cursor-pointer border-2 transition-all ${value === img.url ? 'border-[var(--primary-color)]' : 'border-transparent hover:border-gray-300'}`}
                                title={img.name}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                <span className="text-[10px] text-white font-bold uppercase">{getTranslation('BTN_SELECT', currentLanguage)}</span>
                            </div>
                        </div>
                    ))}
                    {images.length === 0 && (
                        <div className="col-span-5 text-center py-8 text-gray-400">
                            <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-xs italic">{getTranslation('MSG_NO_LIB_IMAGES', currentLanguage)}</p>
                        </div>
                    )}
                </div>
            )}

            {tab === 'URL' && (
                <div className="flex gap-2">
                    <input className="flex-1 border p-2 text-sm rounded-sm" placeholder={getTranslation('PLACEHOLDER_URL_GENERIC', currentLanguage)} value={value} onChange={e => {
                        const val = e.target.value;
                        const name = val.split('/').pop()?.split('?')[0] || '';
                        onChange(val, name);
                    }} />
                </div>
            )}

            {tab === 'UPLOAD' && (
                <div className="space-y-2">
                    <label className={`flex flex-col items-center justify-center h-20 border-2 border-dashed border-gray-300 rounded-sm transition-colors ${imageUpload.isBusy ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:bg-gray-100'}`}>
                        <Upload className="w-5 h-5 text-gray-400" />
                        <span className="text-xs text-gray-500 mt-1 uppercase font-bold">{imageUpload.isBusy ? 'Optimizing…' : getTranslation('MSG_CLICK_TO_UPLOAD', currentLanguage)}</span>
                        <input type="file" className="hidden" onChange={(e) => { handleUpload(e).catch(console.error); }} accept="image/*" disabled={imageUpload.isBusy} />
                    </label>
                </div>
            )}
        </div>
    );
};

const stripHtml = (html: string) => {
    if (!html) return "";
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
};

// --- SUB-COMPONENT: CREATE SLIDER ITEM MODAL ---
const SLIDER_RADIUS_PRESETS = [
    { value: 'none', labelKey: 'LABEL_SHARP', icon: Square },
    { value: 'sm', labelKey: 'LABEL_SMALL', icon: Square },
    { value: 'lg', labelKey: 'LABEL_ROUNDED', icon: Square },
    { value: 'full', labelKey: 'LABEL_CIRCLE', icon: Circle },
    { value: 'custom', labelKey: 'LABEL_CUSTOM', icon: Sliders },
] as const;

export const SliderImageRadiusEditor = ({
    imageSettings,
    onChange,
    currentLanguage,
    includeCircle = true,
    headingLabel,
}: {
    imageSettings?: SliderImageSettings;
    onChange: (settings: SliderImageSettings) => void;
    currentLanguage: LanguageCode;
    includeCircle?: boolean;
    headingLabel?: string;
}) => {
    const settings = imageSettings || DEFAULT_SLIDER_IMAGE_SETTINGS;
    const radiusPresets = useMemo(
        () => (includeCircle ? SLIDER_RADIUS_PRESETS : SLIDER_RADIUS_PRESETS.filter((preset) => preset.value !== 'full')),
        [includeCircle]
    );

    const updatePreset = (preset: SliderImageSettings['radiusPreset']) => {
        onChange({
            ...settings,
            radiusPreset: preset,
            radiusCustom: settings.radiusCustom || { ...DEFAULT_SLIDER_IMAGE_SETTINGS.radiusCustom },
        });
    };

    const updateCorner = (corner: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight', value: string) => {
        onChange({
            ...settings,
            radiusPreset: 'custom',
            radiusCustom: {
                ...(settings.radiusCustom || {}),
                [corner]: value,
            },
        });
    };

    const activePreset = settings.radiusPreset || 'none';
    const normalizedActivePreset = (!includeCircle && activePreset === 'full') ? 'lg' : activePreset;

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                    {headingLabel || getTranslation('LABEL_IMAGE_CORNER_RADIUS', currentLanguage)}
                </label>
                <div className="flex bg-gray-100 p-1 rounded-sm gap-1">
                    {radiusPresets.map((preset) => {
                        const Icon = preset.icon;
                        return (
                            <button
                                key={preset.value}
                                type="button"
                                onClick={() => updatePreset(preset.value)}
                                className={`flex-1 py-2 px-2 text-xs font-bold flex items-center justify-center gap-2 rounded-sm transition-all min-w-0 ${normalizedActivePreset === preset.value
                                    ? 'bg-white text-[var(--primary-color)] shadow-sm ring-1 ring-[var(--primary-color)]'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                title={getTranslation(preset.labelKey, currentLanguage)}
                            >
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{getTranslation(preset.labelKey, currentLanguage)}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {settings.radiusPreset === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                    {([
                        { key: 'topLeft', labelKey: 'LABEL_RADIUS_TOP_LEFT' },
                        { key: 'topRight', labelKey: 'LABEL_RADIUS_TOP_RIGHT' },
                        { key: 'bottomLeft', labelKey: 'LABEL_RADIUS_BOTTOM_LEFT' },
                        { key: 'bottomRight', labelKey: 'LABEL_RADIUS_BOTTOM_RIGHT' },
                    ] as const).map((corner) => (
                        <div key={corner.key}>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                {getTranslation(corner.labelKey, currentLanguage)}
                            </label>
                            <input
                                className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                value={settings.radiusCustom?.[corner.key] || ''}
                                onChange={(e) => updateCorner(corner.key, e.target.value)}
                                placeholder={getTranslation('PLACEHOLDER_RADIUS_VALUE', currentLanguage)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const SLIDE_LAYOUT_OPTIONS = [
    { id: 'text_overlay', labelKey: 'LAYOUT_TEXT_OVERLAY', icon: <div className="w-full h-8 bg-gray-200 relative"><div className="absolute inset-2 bg-gray-400 opacity-50"></div></div> },
    { id: 'solid_color', labelKey: 'LAYOUT_SOLID_COLOR', icon: <div className="w-full h-8 bg-gray-400 flex items-center justify-center"><div className="w-1/2 h-2 bg-white"></div></div> },
    { id: 'split_left_img', labelKey: 'LAYOUT_SPLIT_LEFT', icon: <div className="flex w-full h-8"><div className="w-1/2 bg-gray-300"></div><div className="w-1/2 bg-gray-100"></div></div> },
    { id: 'split_right_img', labelKey: 'LAYOUT_SPLIT_RIGHT', icon: <div className="flex w-full h-8"><div className="w-1/2 bg-gray-100"></div><div className="w-1/2 bg-gray-300"></div></div> },
] as const;

export const SlideLayoutSelector = ({
    value,
    onChange,
    currentLanguage,
}: {
    value: string;
    onChange: (layout: string) => void;
    currentLanguage: LanguageCode;
}) => (
    <div className="grid grid-cols-2 gap-4">
        {SLIDE_LAYOUT_OPTIONS.map((layout) => (
            <button
                key={layout.id}
                type="button"
                onClick={() => onChange(layout.id)}
                className={`border rounded-sm p-3 transition-all flex flex-col items-center gap-2 ${value === layout.id ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)] bg-[var(--brand-light)]' : 'border-gray-200 hover:border-[var(--primary-color)]'}`}
            >
                {layout.icon}
                <span className="text-[10px] font-bold text-gray-600">{getTranslation(layout.labelKey, currentLanguage)}</span>
            </button>
        ))}
    </div>
);

export const SlideImageBehaviorEditor = ({
    imageHeightMode,
    imageCustomHeight,
    adjustments,
    containerSettings,
    currentLanguage,
    onImageHeightModeChange,
    onImageCustomHeightChange,
    onAdjustmentChange,
}: {
    imageHeightMode: string;
    imageCustomHeight: string;
    adjustments: typeof DEFAULT_SLIDE_ADJUSTMENTS;
    containerSettings?: Record<string, unknown>;
    currentLanguage: LanguageCode;
    onImageHeightModeChange: (mode: string) => void;
    onImageCustomHeightChange: (value: string) => void;
    onAdjustmentChange: (key: keyof typeof DEFAULT_SLIDE_ADJUSTMENTS, value: number) => void;
}) => {
    const defaultSlideHeightLabel = getSlideDefaultHeightLabel(containerSettings);
    return (
        <div className="space-y-4">
            <div>
                <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-2">{getTranslation('LABEL_HERO_IMAGE_HEIGHT', currentLanguage)}</h5>
                <div className="grid grid-cols-3 gap-2">
                    <button
                        type="button"
                        onClick={() => onImageHeightModeChange('default')}
                        className={`py-2 text-xs font-bold border rounded-sm transition-colors ${(imageHeightMode || 'default') === 'default' ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                    >
                        {`Default (${defaultSlideHeightLabel})`}
                    </button>
                    <button
                        type="button"
                        onClick={() => onImageHeightModeChange('full')}
                        className={`py-2 text-xs font-bold border rounded-sm transition-colors ${imageHeightMode === 'full' ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                    >
                        {getTranslation('LABEL_FULL_SCREEN_MINUS_NAV', currentLanguage)}
                    </button>
                    <button
                        type="button"
                        onClick={() => onImageHeightModeChange('custom')}
                        className={`py-2 text-xs font-bold border rounded-sm transition-colors ${imageHeightMode === 'custom' ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                    >
                        Custom
                    </button>
                </div>
                {imageHeightMode === 'custom' && (
                    <div className="mt-3">
                        <input
                            type="text"
                            className="w-full border border-gray-300 p-2 text-sm rounded-sm bg-white focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                            placeholder={getTranslation('PLACEHOLDER_HERO_CUSTOM_HEIGHT', currentLanguage)}
                            value={imageCustomHeight || ''}
                            onChange={(e) => onImageCustomHeightChange(e.target.value)}
                        />
                        <p className="mt-1 text-[11px] text-gray-500">
                            {getTranslation('MSG_HERO_HEIGHT_HELPER', currentLanguage)}
                        </p>
                    </div>
                )}
            </div>
            <div className="pt-4 border-t border-gray-100">
                <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-3">{getTranslation('SECTION_IMAGE_ADJUSTMENTS', currentLanguage)}</h5>
                <div className="grid grid-cols-2 gap-6">
                    <div><div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>{getTranslation('LABEL_ZOOM', currentLanguage)}</span><span>{adjustments.zoom}x</span></div><input type="range" min="1" max="2" step="0.1" value={adjustments.zoom} onChange={(e) => onAdjustmentChange('zoom', parseFloat(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]" /></div>
                    <div><div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>{getTranslation('LABEL_ROTATE', currentLanguage)}</span><span>{adjustments.rotate}°</span></div><input type="range" min="0" max="360" step="90" value={adjustments.rotate} onChange={(e) => onAdjustmentChange('rotate', parseInt(e.target.value, 10))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]" /></div>
                    <div><div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>{getTranslation('LABEL_BRIGHTNESS', currentLanguage)}</span><span>{adjustments.brightness}%</span></div><input type="range" min="50" max="150" value={adjustments.brightness} onChange={(e) => onAdjustmentChange('brightness', parseInt(e.target.value, 10))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]" /></div>
                    <div><div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>{getTranslation('LABEL_CONTRAST', currentLanguage)}</span><span>{adjustments.contrast}%</span></div><input type="range" min="50" max="150" value={adjustments.contrast} onChange={(e) => onAdjustmentChange('contrast', parseInt(e.target.value, 10))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]" /></div>
                </div>
            </div>
        </div>
    );
};

export const CreateSliderItemModal = ({ onSave, onCancel }: { onSave: (title: string) => void, onCancel: () => void }) => {
    const { currentLanguage } = useStore();
    const titleField = useValidatedField(getTranslation('MSG_REQ_TITLE', currentLanguage));

    const handleCreate = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!titleField.validate()) return;
        onSave(titleField.value.trim());
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in zoom-in-95 duration-200" style={{ zIndex: getNestedPortalZFromStore(0) }}>
            <div className="bg-white w-[500px] shadow-2xl rounded-sm border border-gray-300 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-white">
                    <h3 className="text-lg font-bold text-[var(--primary-color)]">
                        {getTranslation('TITLE_CREATE_SLIDER_ITEM', currentLanguage)}
                        <EditTrigger labelKey="TITLE_CREATE_SLIDER_ITEM" className="ml-2" />
                    </h3>
                    <div className="flex items-center gap-4">
                        <TooltipMenu ComponentId={'16263'} />
                        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                    </div>
                </div>
                <form onSubmit={handleCreate} noValidate>
                <div className="p-8 space-y-4">
                    <div>
                        <label htmlFor={titleField.fieldId} className="sr-only">{getTranslation('PLACEHOLDER_SLIDER_ITEM_TITLE', currentLanguage)}</label>
                        <input
                            {...titleField.inputProps}
                            placeholder={getTranslation('PLACEHOLDER_SLIDER_ITEM_TITLE', currentLanguage)}
                            autoFocus
                        />
                        {titleField.ErrorMessage}
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3">
                    <button type="button" onClick={onCancel} className="px-6 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-bold hover:bg-gray-100 rounded-sm flex items-center gap-2">
                        {getTranslation('BTN_CANCEL', currentLanguage)} <EditTrigger labelKey="BTN_CANCEL" />
                    </button>
                    <button type="submit" className="px-6 py-2 bg-[var(--btn-primary-bg)] text-white hover:opacity-90 text-sm font-bold rounded-sm shadow-sm transition-colors flex items-center gap-2">
                        {getTranslation('BTN_CREATE', currentLanguage)} <EditTrigger labelKey="BTN_CREATE" />
                    </button>
                </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

// --- SUB-COMPONENT: SLIDER ITEM EDITOR ---
export const SliderItemEditor = ({
    item,
    onSave,
    onCancel,
    onDelete,
    changeOrderContext,
}: {
    item: any;
    onSave: (item: any) => void;
    onCancel: () => void;
    onDelete?: (id: string) => void;
    changeOrderContext?: TaggedOrderChangeContext | null;
}) => {
    const { images, uploadImage, currentLanguage, siteConfig, webStudioUserRole } = useStore();
    const hidePublishingControls = !canPublishContent(webStudioUserRole);
    const translationLanguage = useMemo(
        () => getOptionalEnabledLanguages(siteConfig)[0] ?? null,
        [siteConfig?.languages]
    );
    const [activeTab, setActiveTab] = useState('BASIC');
    const [isTranslating, setIsTranslating] = useState(false);
    const [formData, setFormData] = useState<any>({
        id: item.id || 0,
        title: item.title || '',
        subtitle: isSliderLayoutToken(item.subtitle) ? '' : (item.subtitle || ''),
        description: item.description || '',
        status: item.status || 'Draft',
        sortOrder: item.sortOrder || 0,
        ctaText: item.ctaText || '',
        ctaUrl: item.ctaUrl || '',
        imageUrl: item.imageUrl || getGlobalDefaultImage(),
        imageName: item.imageName || '',
        translations: item.translations || { en: { title: '', subtitle: '', description: '', ctaText: '' } },
    });

    useEffect(() => {
        if (!item?.id) return;
        setFormData({
            id: item.id || 0,
            title: item.title || '',
            subtitle: isSliderLayoutToken(item.subtitle) ? '' : (item.subtitle || ''),
            description: item.description || '',
            status: item.status || 'Draft',
            sortOrder: item.sortOrder || 0,
            ctaText: item.ctaText || '',
            ctaUrl: item.ctaUrl || '',
            imageUrl: item.imageUrl || getGlobalDefaultImage(),
            imageName: item.imageName || '',
            imageCacheToken: item.imageCacheToken,
            translations: item.translations || { en: { title: '', subtitle: '', description: '', ctaText: '' } },
        });
    }, [item?.id]);

    // Update Helpers
    const updateField = (key: string, val: any) => setFormData((p: any) => ({ ...p, [key]: val }));
    const patchFormData = (patch: Record<string, unknown>) => setFormData((p: any) => ({ ...p, ...patch }));
    const updateUebersetzung = (lang: string, key: string, val: string) => setFormData((p: any) => ({ ...p, translations: { ...p.translations, [lang]: { ...p.translations?.[lang], [key]: val } } }));

    const suggestUebersetzung = async () => {
        setIsTranslating(true);
        try {
            const [translatedTitle, translatedSubtitle, translatedDesc] = await Promise.all([
                formData.title ? translateText(formData.title, translationLanguage) : '',
                formData.subtitle ? translateText(formData.subtitle, translationLanguage) : '',
                formData.description ? translateText(formData.description, translationLanguage) : '',
            ]);

            setFormData((p: any) => ({
                ...p,
                translations: {
                    ...p.translations,
                    [translationLanguage]: {
                        ...p.translations?.[translationLanguage],
                        title: translatedTitle || p.translations?.[translationLanguage]?.title || '',
                        subtitle: translatedSubtitle || p.translations?.[translationLanguage]?.subtitle || '',
                        description: translatedDesc || p.translations?.[translationLanguage]?.description || '',
                    }
                }
            }));
        } catch (error) {
            console.error("Uebersetzung Error", error);
        } finally {
            setIsTranslating(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in zoom-in-95 duration-200" style={{ zIndex: getNestedPortalZFromStore(10) }}>
            <div className="bg-white w-[80vw] min-w-[80vw] max-w-[80vw] shadow-2xl rounded-sm border border-gray-300 flex flex-col h-[90vh] min-h-[90vh] max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0 gap-4">
                    <h3 className="font-bold text-[var(--primary-color)] min-w-0 truncate flex-1">
                        {getTranslation('TITLE_EDIT_SLIDER_ITEM', currentLanguage)} - {formData.title}
                        <EditTrigger labelKey="TITLE_EDIT_SLIDER_ITEM" className="ml-2" />
                    </h3>
                    <div className="flex items-center gap-3 shrink-0">
                        <TooltipMenu ComponentId={'16264'} />
                        <button onClick={onCancel} className="text-gray-400 hover:text-red-500"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="flex border-b border-gray-200 px-6 bg-white flex-shrink-0 gap-6">
                    {[
                        { id: 'BASIC', label: getTranslation('TAB_BASIC_INFO', currentLanguage) },
                        { id: 'IMAGE', label: getTranslation('TAB_IMAGE_INFO', currentLanguage) },
                        { id: 'TRANSLATION', label: getTranslation('TAB_TRANSLATION', currentLanguage) }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === tab.id ? 'border-b-[var(--primary-color)] text-[var(--primary-color)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-1 bg-gray-50/50">

                    {/* BASIC INFORMATION */}
                    {activeTab === 'BASIC' && (
                        <div className="space-y-6 bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                        {getTranslation('LABEL_TITLE', currentLanguage)}
                                        <EditTrigger labelKey="LABEL_TITLE" className="ml-2" />
                                    </label>
                                    <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formData.title} onChange={e => updateField('title', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                        {getTranslation('LABEL_SUBTITLE', currentLanguage)}
                                        <EditTrigger labelKey="LABEL_SUBTITLE" className="ml-2" />
                                    </label>
                                    <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formData.subtitle} onChange={e => updateField('subtitle', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_SORT_ORDER', currentLanguage)}</label>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1 min-w-0">
                                            <input type="number" className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formData.sortOrder} onChange={e => updateField('sortOrder', parseInt(e.target.value) || 0)} />
                                            <Hash className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                        <ItemEditorChangeOrderButton
                                            context={changeOrderContext}
                                            activeItemId={formData.id}
                                        />
                                    </div>
                                </div>
                                {!hidePublishingControls && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_STATUS', currentLanguage)}</label>
                                    <select className="w-full border border-gray-300 p-2.5 text-sm rounded-sm bg-white focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formData.status} onChange={e => updateField('status', e.target.value)}>
                                        <option value="Draft">{getTranslation('LABEL_DRAFT', currentLanguage)}</option>
                                        <option value="Published">{getTranslation('LABEL_PUBLISHED', currentLanguage)}</option>
                                    </select>
                                </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_ORIGINAL_DESC', currentLanguage)}</label>
                                <JoditRichTextEditor
                                    value={formData.description}
                                    onChange={(newValue: any) => updateField('description', newValue)}
                                    placeholder={getTranslation('PLACEHOLDER_ITEM_DESC', currentLanguage) || "A brief description of the slide."}
                                    height={200}
                                />
                            </div>

                            <ItemTaggingLookupFields itemId={String(formData.id)} listName="ImageSlider" />
                        </div>
                    )}

                    {activeTab === 'IMAGE' && (
                        <EditorImageTabPanel
                            uploadImage={uploadImage}
                            images={images}
                            folderId="Pictures"
                            titleForNaming={formData.title}
                            namingFallback="Slider"
                            imageUrl={formData.imageUrl || ''}
                            imageName={formData.imageName || ''}
                            updateField={updateField}
                            patchFormData={patchFormData}
                            activeTab={activeTab}
                            currentLanguage={currentLanguage}
                            getGlobalDefaultImage={getGlobalDefaultImage}
                            showImageNameEditTrigger
                        />
                    )}

                    {/* TRANSLATION */}
                    {activeTab === 'TRANSLATION' && (
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex gap-8 text-xs font-bold text-gray-500 uppercase">
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-300"></span> {getTranslation('LABEL_ORIGINAL', currentLanguage)}</div>
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[var(--primary-color)]"></span> {getTranslation('LABEL_TRANSLATION', currentLanguage)} ({translationLanguage.toUpperCase()})</div>
                                </div>
                                <button onClick={suggestUebersetzung} disabled={isTranslating} className={`text-[var(--primary-color)] text-xs font-bold flex items-center gap-2 hover:underline ${isTranslating ? 'opacity-50 cursor-wait' : ''}`}>
                                    <Wand2 className={`w-3 h-3 ${isTranslating ? 'animate-pulse' : ''}`} /> {isTranslating ? getTranslation('MSG_TRANSLATING', currentLanguage) : getTranslation('BTN_SUGGEST_AI', currentLanguage)}
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-12">
                                {/* Left: Original */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{getTranslation('LABEL_TITLE', currentLanguage)}</label>
                                        <div className="p-3 border border-gray-100 bg-gray-50/50 rounded-sm text-sm text-gray-600 min-h-[42px] flex items-center">
                                            {formData.title || <span className="text-gray-300 italic">{getTranslation('MSG_NO_TITLE', currentLanguage)}</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{getTranslation('LABEL_SUBTITLE', currentLanguage)}</label>
                                        <div className="p-3 border border-gray-100 bg-gray-50/50 rounded-sm text-sm text-gray-600 min-h-[42px] flex items-center">
                                            {formData.subtitle || <span className="text-gray-300 italic">{getTranslation('MSG_NO_SUBTITLE', currentLanguage)}</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{getTranslation('LABEL_DESCRIPTION', currentLanguage)}</label>
                                        <div className="p-4 border border-gray-100 bg-gray-50/50 rounded-sm text-sm text-gray-600 min-h-[200px] prose prose-sm max-w-none shadow-inner" dangerouslySetInnerHTML={{ __html: formData.description || `<p class="text-gray-300 italic">${getTranslation('MSG_NO_DESCRIPTION', currentLanguage)}</p>` }} />
                                    </div>
                                </div>

                                {/* Right: Uebersetzung */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-2">{getTranslation('LABEL_TRANSLATED_TITLE', currentLanguage)}</label>
                                        <input
                                            className="w-full border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none rounded-sm transition-all"
                                            placeholder={getTranslation('PLACEHOLDER_TRANSLATED_TITLE', currentLanguage)}
                                            value={formData.translations[translationLanguage]?.title || ''}
                                            onChange={e => updateUebersetzung(translationLanguage, 'title', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-2">{getTranslation('LABEL_SUBTITLE', currentLanguage)}</label>
                                        <input
                                            className="w-full border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none rounded-sm transition-all"
                                            placeholder={getTranslation('PLACEHOLDER_TRANSLATED_SUBTITLE', currentLanguage)}
                                            value={formData.translations[translationLanguage]?.subtitle || ''}
                                            onChange={e => updateUebersetzung(translationLanguage, 'subtitle', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-2">{getTranslation('LABEL_TRANSLATED_DESC', currentLanguage)}</label>
                                        <JoditRichTextEditor
                                            value={formData.translations[translationLanguage]?.description || ''}
                                            onChange={(newValue: any) => updateUebersetzung(translationLanguage, 'description', newValue)}
                                            placeholder={getTranslation('PLACEHOLDER_TRANSLATED_DESC', currentLanguage)}
                                            height={200}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Fixed Footer with Metadata & Actions */}
                <div className="flex-shrink-0 bg-white border-t border-gray-100 px-6 py-3">
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex-1">
                            <SharePointMetadataFooter
                                listTitle="ImageSlider"
                                itemId={formData.id}
                                itemTitle={formData.title}
                                createdDate={item.createdDate}
                                createdBy={item.createdBy}
                                modifiedDate={item.modifiedDate}
                                modifiedBy={item.modifiedBy}
                                onDelete={onDelete ? () => onDelete(formData.id) : undefined}
                                onVersionRestore={() => {
                                    useStore.getState().loadFromSharePoint();
                                }}
                            />
                        </div>
                        <div className="flex gap-3 flex-shrink-0 items-center">
                            <button onClick={onCancel} className="px-8 py-2 border border-gray-300 bg-white text-gray-800 text-sm font-bold hover:bg-gray-50 transition-colors rounded-sm tracking-wide flex items-center gap-2">
                                {getTranslation('BTN_CANCEL', currentLanguage)} <EditTrigger labelKey="BTN_CANCEL" />
                            </button>
                            <button onClick={() => onSave(hidePublishingControls ? { ...formData, status: item.status || 'Draft' } : formData)} className="px-8 py-2 bg-[var(--btn-primary-bg)] text-white text-sm font-bold shadow-sm hover:opacity-90 transition-all rounded-sm capitalize tracking-wide flex items-center gap-2">
                                {getTranslation('BTN_SAVE', currentLanguage)} <EditTrigger labelKey="BTN_SAVE" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- SUB-MODAL: EDIT SLIDE ---
// Strictly isolated component for editing a single slide
export const EditSlideModal = ({
    slideId,
    allSlides,
    containerSettings = {},
    onSave,
    onClose,
    onDelete,
    lockSlideDesign = false,
}: {
    slideId: string,
    allSlides: any[],
    containerSettings?: any,
    onSave: (id: string, data: any) => void,
    onClose: () => void,
    onDelete: (id: string) => void,
    lockSlideDesign?: boolean,
}) => {
    const { currentLanguage, siteConfig } = useStore();
    const translationLanguage = useMemo(
        () => getOptionalEnabledLanguages(siteConfig)[0] ?? null,
        [siteConfig?.languages]
    );
    const initialIndex = allSlides.findIndex(s => s.id === slideId);
    const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    const slide = allSlides[currentIndex];
    const effectiveDesign = resolveEffectiveSlideDesign(slide, containerSettings, {
        preferTemplateDefaults: lockSlideDesign,
    });

    const [activeTab, setActiveTab] = useState('BASIC');
    const [isTranslating, setIsTranslating] = useState(false);
    const [formState, setFormState] = useState<any>({
        id: slide?.id,
        title: slide?.title || '',
        subtitle: sanitizeSliderSubtitleForDisplay(slide?.subtitle || slide?.sub || ''),
        desc: slide?.desc || '',
        image: slide?.image || slide?.img || '',
        url: slide?.url || '',
        layout: slide?.layout || '',
        cta: slide?.cta || '',
        adjustments: slide?.adjustments || { zoom: 1, rotate: 0, brightness: 100, contrast: 100 },
        imageHeightMode: slide?.imageHeightMode || 'default',
        imageCustomHeight: slide?.imageCustomHeight || '',
        translations: slide?.translations || { en: { title: '', subtitle: '', description: '', ctaText: '' } },
        imageName: slide?.imageName || slide?.name || ''
    });

    useEffect(() => {
        if (slide) {
            setFormState({
                id: slide.id,
                title: slide.title || '',
                subtitle: sanitizeSliderSubtitleForDisplay(slide.subtitle || slide.sub || ''),
                desc: slide.desc || '',
                image: slide.image || slide.img || '',
                url: slide.url || '',
                layout: slide.layout || '',
                cta: slide.cta || '',
                adjustments: slide.adjustments || { zoom: 1, rotate: 0, brightness: 100, contrast: 100 },
                imageHeightMode: slide.imageHeightMode || 'default',
                imageCustomHeight: slide.imageCustomHeight || '',
                translations: slide.translations || { en: { title: '', subtitle: '', description: '', ctaText: '' } },
                imageName: slide.imageName || slide.name || ''
            });
        }
    }, [slide?.id, currentIndex]); // Stability fix: only reset if ID or index specifically changes

    const defaultSlideHeightLabel = getSlideDefaultHeightLabel(containerSettings);
    const previewDesign = lockSlideDesign ? effectiveDesign : {
        layout: formState.layout || effectiveDesign.layout,
        imageHeightMode: formState.imageHeightMode || effectiveDesign.imageHeightMode,
        imageCustomHeight: formState.imageCustomHeight ?? effectiveDesign.imageCustomHeight,
        adjustments: formState.adjustments || effectiveDesign.adjustments,
    };
    const previewSlideHeight = useMemo(
        () => resolveSlideImageHeight(previewDesign, containerSettings, siteConfig),
        [previewDesign.imageHeightMode, previewDesign.imageCustomHeight, containerSettings, siteConfig]
    );

    const handleNext = () => setCurrentIndex((prev) => (prev + 1) % allSlides.length);
    const handlePrev = () => setCurrentIndex((prev) => (prev - 1 + allSlides.length) % allSlides.length);

    const updateForm = (key: string, val: any) => setFormState((prev: any) => ({ ...prev, [key]: val }));
    const updateAdjustment = (key: string, val: any) => setFormState((prev: any) => ({ ...prev, adjustments: { ...prev.adjustments, [key]: val } }));
    const updateUebersetzung = (lang: string, key: string, val: string) => setFormState((p: any) => ({ ...p, translations: { ...p.translations, [lang]: { ...p.translations?.[lang], [key]: val } } }));

    const suggestUebersetzung = async () => {
        setIsTranslating(true);
        try {
            const [translatedTitle, translatedSubtitle, translatedDesc, translatedCta] = await Promise.all([
                formState.title ? translateText(formState.title, translationLanguage) : '',
                formState.subtitle ? translateText(formState.subtitle, translationLanguage) : '',
                formState.desc ? translateText(formState.desc, translationLanguage) : '',
                formState.cta ? translateText(formState.cta, translationLanguage) : ''
            ]);

            setFormState((p: any) => ({
                ...p,
                translations: {
                    ...p.translations,
                    [translationLanguage]: {
                        ...p.translations?.[translationLanguage],
                        title: translatedTitle || p.translations?.[translationLanguage]?.title || '',
                        subtitle: translatedSubtitle || p.translations?.[translationLanguage]?.subtitle || '',
                        description: translatedDesc || p.translations?.[translationLanguage]?.description || '',
                        ctaText: translatedCta || p.translations?.[translationLanguage]?.ctaText || ''
                    }
                }
            }));
        } catch (error) {
            console.error("Uebersetzung Error", error);
        } finally {
            setIsTranslating(false);
        }
    };

    const handleSaveClick = () => {
        const payload = lockSlideDesign
            ? {
                ...formState,
                layout: effectiveDesign.layout,
                imageHeightMode: effectiveDesign.imageHeightMode,
                imageCustomHeight: effectiveDesign.imageCustomHeight,
                adjustments: { ...effectiveDesign.adjustments },
            }
            : formState;
        onSave(slide.id, payload);
        onClose();
    };

    const handleDeleteClick = () => {
        onDelete(slide.id);
        if (allSlides.length <= 1) onClose();
        else {
            setDeleteConfirm(false);
            setCurrentIndex(0);
        }
    };

    if (!slide) return null;

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in zoom-in-95 duration-200" style={{ zIndex: getNestedPortalZFromStore(20) }}>
            <div className="bg-white w-[95vw] h-[95vh] shadow-2xl rounded-sm border border-gray-300 flex flex-col overflow-hidden relative">

                {/* Header */}
                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0">
                    <h3 className="text-xl font-bold text-[var(--primary-color)]">
                        {getTranslation('TITLE_EDIT_SLIDE', currentLanguage)} - {formState.title || getTranslation('LABEL_UNTITLED_SLIDE', currentLanguage)}
                        <EditTrigger labelKey="TITLE_EDIT_SLIDE" className="ml-2" />
                    </h3>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 bg-gray-100 rounded-sm p-1">
                            <button onClick={handlePrev} className="p-1 hover:bg-white rounded-sm transition-colors text-gray-600"><ChevronLeft className="w-5 h-5" /></button>
                            <span className="text-xs font-bold text-gray-500 px-2 min-w-[120px] text-center">{getTranslation('LABEL_EDITING_SLIDE', currentLanguage)} {currentIndex + 1} {getTranslation('LABEL_OF', currentLanguage)} {allSlides.length}</span>
                            <button onClick={handleNext} className="p-1 hover:bg-white rounded-sm transition-colors text-gray-600"><ChevronRight className="w-5 h-5" /></button>
                        </div>
                        <TooltipMenu ComponentId={'1042'} />
                        <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors"><X className="w-6 h-6" /></button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-8 bg-white flex-shrink-0 gap-6">
                    {[
                        { id: 'BASIC', label: getTranslation('TAB_BASIC_INFO', currentLanguage) },
                        { id: 'TRANSLATION', label: getTranslation('TAB_TRANSLATION', currentLanguage) }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === tab.id ? 'border-b-[var(--primary-color)] text-[var(--primary-color)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
                    <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* LEFT: FORM */}
                        <div className="space-y-8">
                            {activeTab === 'BASIC' ? (
                                <>
                                    {/* Identity */}
                                    <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                            <EditTrigger labelKey="SECTION_SLIDE_IDENTITY" />
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{getTranslation('SECTION_SLIDE_IDENTITY', currentLanguage)}</h4>
                                        </div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">{getTranslation('LABEL_SLIDE_NAME', currentLanguage)}</label>
                                        <input className="w-full border border-gray-300 p-2 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formState.title} onChange={(e) => updateForm('title', e.target.value)} placeholder={getTranslation('PLACEHOLDER_SLIDE_NAME', currentLanguage)} />
                                    </div>

                                    {/* Layout — template-level when locked */}
                                    {!lockSlideDesign && (
                                    <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">{getTranslation('SECTION_LAYOUT', currentLanguage)}</h4>
                                        <SlideLayoutSelector
                                            value={formState.layout || effectiveDesign.layout}
                                            onChange={(layout) => updateForm('layout', layout)}
                                            currentLanguage={currentLanguage}
                                        />
                                    </div>
                                    )}

                                    {/* Content */}
                                    <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm space-y-4">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{getTranslation('SECTION_CONTENT', currentLanguage)}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="min-w-0">
                                                <label className="block text-xs font-bold text-gray-700 mb-1">{getTranslation('LABEL_HEADER_TITLE', currentLanguage)}</label>
                                                <input className="w-full border border-gray-300 p-2 text-sm rounded-sm" value={formState.title} onChange={e => updateForm('title', e.target.value)} />
                                            </div>
                                            <div className="min-w-0">
                                                <label className="block text-xs font-bold text-gray-700 mb-1">{getTranslation('LABEL_SUBTITLE', currentLanguage)}</label>
                                                <input className="w-full border border-gray-300 p-2 text-sm rounded-sm" value={formState.subtitle} onChange={e => updateForm('subtitle', e.target.value)} />
                                            </div>
                                        </div>
                                        <div><label className="block text-xs font-bold text-gray-700 mb-1">{getTranslation('LABEL_CTA_BUTTON', currentLanguage)}</label><input className="w-full border border-gray-300 p-2 text-sm rounded-sm" value={formState.cta} onChange={e => updateForm('cta', e.target.value)} /></div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">{getTranslation('LABEL_CONTENT_TEXT', currentLanguage)}</label>
                                            <JoditRichTextEditor
                                                value={formState.desc}
                                                onChange={(val: string) => updateForm('desc', val)}
                                                height={180}
                                                placeholder="Enter content..."
                                            />
                                        </div>
                                    </div>

                                    {/* URL */}
                                    <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2"><LinkIcon className="w-4 h-4" /> {getTranslation('LABEL_URL_OPTIONAL', currentLanguage)}</h4>
                                        <input className="w-full border border-gray-300 p-2 text-sm rounded-sm" value={formState.url} onChange={e => updateForm('url', e.target.value)} placeholder={getTranslation('PLACEHOLDER_URL_GENERIC', currentLanguage)} />
                                    </div>
                                </>
                            ) : (
                                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm space-y-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex gap-8 text-xs font-bold text-gray-500 uppercase">
                                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-300"></span> {getTranslation('LABEL_ORIGINAL', currentLanguage)}</div>
                                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[var(--primary-color)]"></span> {getTranslation('LABEL_TRANSLATION', currentLanguage)} ({translationLanguage.toUpperCase()})</div>
                                        </div>
                                        <button onClick={suggestUebersetzung} disabled={isTranslating} className={`text-[var(--primary-color)] text-xs font-bold flex items-center gap-2 hover:underline ${isTranslating ? 'opacity-50 cursor-wait' : ''}`}>
                                            <Wand2 className={`w-3 h-3 ${isTranslating ? 'animate-pulse' : ''}`} /> {isTranslating ? getTranslation('MSG_TRANSLATING', currentLanguage) : getTranslation('BTN_SUGGEST_AI', currentLanguage)}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-12">
                                        {/* Left: Original */}
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                                                    {getTranslation('LABEL_TITLE', currentLanguage)}
                                                    <EditTrigger labelKey="LABEL_TITLE" className="ml-2" />
                                                </label>
                                                <div className="p-3 border border-gray-100 bg-gray-50/50 rounded-sm text-sm text-gray-600 min-h-[42px] flex items-center">
                                                    {formState.title || <span className="text-gray-300 italic">{getTranslation('MSG_NO_TITLE', currentLanguage)}</span>}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                                                    {getTranslation('LABEL_SUBTITLE', currentLanguage)}
                                                    <EditTrigger labelKey="LABEL_SUBTITLE" className="ml-2" />
                                                </label>
                                                <div className="p-3 border border-gray-100 bg-gray-50/50 rounded-sm text-sm text-gray-600 min-h-[42px] flex items-center">
                                                    {formState.subtitle || <span className="text-gray-300 italic">{getTranslation('MSG_NO_SUBTITLE', currentLanguage)}</span>}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                                                    {getTranslation('LABEL_DESCRIPTION', currentLanguage)}
                                                    <EditTrigger labelKey="LABEL_DESCRIPTION" className="ml-2" />
                                                </label>
                                                <div className="p-4 border border-gray-100 bg-gray-50/50 rounded-sm text-sm text-gray-600 min-h-[200px] prose prose-sm max-w-none shadow-inner" dangerouslySetInnerHTML={{ __html: formState.desc || `<p class="text-gray-300 italic">${getTranslation('MSG_NO_DESCRIPTION', currentLanguage)}</p>` }} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                                                    {getTranslation('LABEL_CTA_BUTTON', currentLanguage)}
                                                    <EditTrigger labelKey="LABEL_CTA_BUTTON" className="ml-2" />
                                                </label>
                                                <div className="p-3 border border-gray-100 bg-gray-50/50 rounded-sm text-sm text-gray-600 min-h-[42px] flex items-center">
                                                    {formState.cta || <span className="text-gray-300 italic">{getTranslation('MSG_NO_CTA_TEXT', currentLanguage)}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Uebersetzung */}
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-2">{getTranslation('LABEL_TRANSLATED_TITLE', currentLanguage)}</label>
                                                <input
                                                    className="w-full border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none rounded-sm transition-all"
                                                    placeholder={getTranslation('PLACEHOLDER_TRANSLATED_TITLE', currentLanguage)}
                                                    value={formState.translations[translationLanguage]?.title || ''}
                                                    onChange={e => updateUebersetzung(translationLanguage, 'title', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-2">{getTranslation('LABEL_SUBTITLE', currentLanguage)}</label>
                                                <input
                                                    className="w-full border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none rounded-sm transition-all"
                                                    placeholder={getTranslation('PLACEHOLDER_TRANSLATED_SUBTITLE', currentLanguage)}
                                                    value={formState.translations[translationLanguage]?.subtitle || ''}
                                                    onChange={e => updateUebersetzung(translationLanguage, 'subtitle', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-2">{getTranslation('LABEL_TRANSLATED_DESC', currentLanguage)}</label>
                                                <JoditRichTextEditor
                                                    value={formState.translations[translationLanguage]?.description || ''}
                                                    onChange={(newValue: any) => updateUebersetzung(translationLanguage, 'description', newValue)}
                                                    placeholder={getTranslation('PLACEHOLDER_TRANSLATED_DESC', currentLanguage)}
                                                    height={200}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-2">{getTranslation('LABEL_CTA_BUTTON', currentLanguage)}</label>
                                                <input
                                                    className="w-full border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none rounded-sm transition-all"
                                                    placeholder={getTranslation('PLACEHOLDER_TRANSLATED_CTA', currentLanguage)}
                                                    value={formState.translations[translationLanguage]?.ctaText || ''}
                                                    onChange={e => updateUebersetzung(translationLanguage, 'ctaText', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT: PREVIEW & IMAGE */}
                        <div className="space-y-8">
                            {/* Live Preview */}
                            {activeTab !== 'TRANSLATION' && (
                                <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm relative">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2"><Eye className="w-4 h-4" /> {getTranslation('SECTION_LIVE_PREVIEW', currentLanguage)}</h4>
                                    <div
                                        className="w-full bg-gray-100 border border-gray-300 overflow-hidden relative group rounded-sm transition-[height] duration-300"
                                        style={{ height: previewSlideHeight, minHeight: '12rem' }}
                                    >
                                        {formState.image && (
                                            <img
                                                src={formState.image}
                                                className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 ${previewDesign.layout === 'split_left_img' || previewDesign.layout === 'split_right_img' ? 'w-1/2' : 'w-full'}`}
                                                style={{
                                                    left: previewDesign.layout === 'split_right_img' ? '50%' : '0',
                                                    filter: `brightness(${previewDesign.adjustments.brightness}%) contrast(${previewDesign.adjustments.contrast}%)`,
                                                    transform: `scale(${previewDesign.adjustments.zoom}) rotate(${previewDesign.adjustments.rotate}deg)`
                                                }}
                                            />
                                        )}
                                        <div className={`absolute p-8 flex flex-col overflow-y-auto custom-scrollbar ${containerSettings.overlayPosition === 'bottom' ? 'justify-end' : 'justify-center'} ${previewDesign.layout === 'text_overlay' || !previewDesign.layout ? `inset-0 bg-black/40 text-white ${containerSettings.align === 'center' ? 'items-center text-center' : containerSettings.align === 'right' ? 'items-end text-right' : 'items-start text-left'}` : ''} ${previewDesign.layout === 'solid_color' ? `inset-0 bg-gray-800 text-white ${containerSettings.align === 'center' ? 'items-center text-center' : containerSettings.align === 'right' ? 'items-end text-right' : 'items-start text-left'}` : ''} ${previewDesign.layout === 'split_left_img' ? 'right-0 top-0 bottom-0 w-1/2 bg-white text-gray-800 items-start text-left pl-12' : ''} ${previewDesign.layout === 'split_right_img' ? 'left-0 top-0 bottom-0 w-1/2 bg-white text-gray-800 items-start text-left pr-12' : ''}`}>
                                            <h2
                                                className={`font-bold mb-2 ${resolveTypographyColor(containerSettings.titleColor, containerSettings.titleCustomColor, 'text-inherit').className || ''} ${normalizeSliderLetterCase(containerSettings.letterCase)}`}
                                                style={{ ...resolveTypographyColor(containerSettings.titleColor, containerSettings.titleCustomColor, 'text-inherit').style, ...getSliderHeadingPreviewStyle(containerSettings) }}
                                            >
                                                {formState.title || getTranslation('LABEL_UNTITLED_SLIDE', currentLanguage)}
                                            </h2>
                                            {formState.subtitle && (
                                                <h3
                                                    className={`font-medium opacity-80 mb-4 ${resolveTypographyColor(containerSettings.subtitleColor || containerSettings.titleColor, containerSettings.subtitleCustomColor || containerSettings.titleCustomColor, 'text-inherit').className || ''}`}
                                                    style={{ fontFamily: 'var(--font-family-base, sans-serif)', ...resolveTypographyColor(containerSettings.subtitleColor || containerSettings.titleColor, containerSettings.subtitleCustomColor || containerSettings.titleCustomColor, 'text-inherit').style, fontSize: containerSettings.subtitleFontSize ? `${containerSettings.subtitleFontSize}px` : '1.25rem' }}
                                                >
                                                    {formState.subtitle}
                                                </h3>
                                            )}
                                            <div
                                                className={`text-sm opacity-70 leading-relaxed ${resolveTypographyColor(containerSettings.descColor || containerSettings.titleColor, containerSettings.descCustomColor || containerSettings.titleCustomColor, 'text-inherit').className || ''}`}
                                                style={{ fontFamily: 'var(--font-family-base, sans-serif)', ...resolveTypographyColor(containerSettings.descColor || containerSettings.titleColor, containerSettings.descCustomColor || containerSettings.titleCustomColor, 'text-inherit').style, fontSize: containerSettings.descFontSize ? `${containerSettings.descFontSize}px` : '0.875rem' }}
                                                dangerouslySetInnerHTML={{ __html: formState.desc }}
                                            />
                                            {formState.cta && <button className="mt-4 px-6 py-2 bg-[var(--btn-primary-bg)] text-white font-bold rounded-sm shadow-sm">{formState.cta}</button>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Image Editor */}
                            {activeTab !== 'TRANSLATION' && (
                                <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> {getTranslation('SECTION_IMAGE_EDITOR', currentLanguage)}</h4>
                                    <ImagePicker value={formState.image} onChange={(u, n) => {
                                        setFormState((prev: any) => ({ ...prev, image: u, imageName: n }));
                                    }} />
                                    {!lockSlideDesign && (
                                    <SlideImageBehaviorEditor
                                        imageHeightMode={formState.imageHeightMode || effectiveDesign.imageHeightMode}
                                        imageCustomHeight={formState.imageCustomHeight || effectiveDesign.imageCustomHeight}
                                        adjustments={formState.adjustments || effectiveDesign.adjustments}
                                        containerSettings={containerSettings}
                                        currentLanguage={currentLanguage}
                                        onImageHeightModeChange={(mode) => updateForm('imageHeightMode', mode)}
                                        onImageCustomHeightChange={(value) => updateForm('imageCustomHeight', value)}
                                        onAdjustmentChange={(key, value) => updateAdjustment(key, value)}
                                    />
                                    )}
                                    {lockSlideDesign && (
                                        <p className="mt-4 text-xs text-gray-500 border-t border-gray-100 pt-4">
                                            {getTranslation('MSG_SLIDE_DESIGN_LOCKED_BY_TEMPLATE', currentLanguage)}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-between items-center flex-shrink-0">
                    <button onClick={() => setDeleteConfirm(true)} className="text-red-500 text-xs font-bold hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" /> {getTranslation('BTN_DELETE_SLIDE', currentLanguage)}</button>
                    <div className="flex items-center gap-4">
                        <button onClick={handleSaveClick} className="px-6 py-2 bg-[var(--btn-primary-bg)] text-white text-sm font-bold rounded-sm shadow-md hover:opacity-90 flex items-center gap-2">
                            {getTranslation('BTN_SAVE_CHANGES', currentLanguage)} <EditTrigger labelKey="BTN_SAVE_CHANGES" />
                        </button>
                    </div>
                </div>

                {deleteConfirm && (
                    <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white p-6 rounded-sm shadow-2xl w-[400px] border border-gray-200">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                                    <Trash2 className="w-6 h-6" />
                                </div>
                                <h4 className="text-lg font-bold text-gray-800 mb-2">{getTranslation('BTN_DELETE_SLIDE', currentLanguage)}</h4>
                                <p className="text-sm text-gray-600 mb-6">{getTranslation('MSG_CONFIRM_DELETE_SLIDE', currentLanguage)}</p>
                                <div className="flex w-full gap-3">
                                    <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-2 border border-gray-300 rounded-sm text-sm font-bold hover:bg-gray-50">
                                        {getTranslation('BTN_CANCEL', currentLanguage)}
                                    </button>
                                    <button onClick={handleDeleteClick} className="flex-1 py-2 bg-red-600 text-white rounded-sm text-sm font-bold hover:bg-red-700 shadow-sm">{getTranslation('BTN_DELETE', currentLanguage)}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

// --- MAIN SLIDER MANAGER COMPONENT ---
export const SliderManager = ({
    onClose = () => undefined,
    embedded = false,
    containerOverride,
    onContainerChange,
    editorAccess,
}: {
    onClose?: () => void;
    embedded?: boolean;
    containerOverride?: Container;
    onContainerChange?: (container: Container) => void;
    editorAccess?: EditorAccessConfig;
}) => {
    const { editingContainerId, pages, updateContainer, deleteContainer, currentLanguage, sliderItems, addSliderItem, updateSliderItem, deleteSliderItem, syncContainerPreview, currentPageId, persistContainerTaggingLookups, webStudioUserRole, sectionTemplates } = useStore();

    // Retrieve the container using editingContainerId (page edit) or an optional draft override (template editor).
    const sliderData = useMemo(() => {
        if (containerOverride) {
            return { container: containerOverride, pageId: containerOverride.pageId || '' };
        }
        if (!editingContainerId) return null;
        // First check the current active page to avoid collisions with duplicate container IDs
        const currentPage = pages.find(p => p.id === currentPageId);
        if (currentPage) {
            const c = currentPage.containers.find(con => con.id === editingContainerId);
            if (c) return { container: c, pageId: currentPage.id };
        }
        // Fallback to checking other pages
        for (const p of pages) {
            if (p.id === currentPageId) continue;
            const c = p.containers.find(con => con.id === editingContainerId);
            if (c) return { container: c, pageId: p.id };
        }
        return null;
    }, [pages, editingContainerId, currentPageId, containerOverride]);

    const [activeTab, setActiveTab] = useState<'SLIDES' | 'SETTINGS' | 'MANAGE_CONTENT'>('SLIDES');
    const [sliderContainer, setSliderContainer] = useState<Container | null>(() => {
        if (!containerOverride) return null;
        const containerCopy = JSON.parse(JSON.stringify(containerOverride)) as Container;
        if (!containerCopy.settings.slides) {
            containerCopy.settings.slides = [];
        }
        if (!containerCopy.settings.taggedItems) {
            containerCopy.settings.taggedItems = [];
        }
        return containerCopy;
    });
    const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
    const [deleteSlideId, setDeleteSlideId] = useState<string | null>(null);
    const [showDeleteSliderConfirm, setShowDeleteSliderConfirm] = useState(false);
    // --- Inhalt verwalten state ---
    const [showCreateSliderItem, setShowCreateSliderItem] = useState(false);
    const [editingSliderItem, setEditingSliderItem] = useState<SliderItem | null>(null);
    const [deleteSliderItemId, setDeleteSliderItemId] = useState<string | null>(null);
    const [showChangeOrderModal, setShowChangeOrderModal] = useState(false);
    const lastEmittedContainerSigRef = useRef('');

    const getContainerSlideSig = (container?: Container | null) => JSON.stringify({
        taggedItems: container?.settings?.taggedItems || [],
        slides: container?.settings?.slides || [],
        content: container?.content || {},
        settings: {
            showHeader: container?.settings?.showHeader,
            showSubheading: container?.settings?.showSubheading,
            showDescription: container?.settings?.showDescription,
            autoplay: container?.settings?.autoplay,
            speed: container?.settings?.speed,
            arrows: container?.settings?.arrows,
            dots: container?.settings?.dots,
            defaultSlideLayout: container?.settings?.defaultSlideLayout,
            slideImageHeightMode: container?.settings?.slideImageHeightMode,
            slideImageCustomHeight: container?.settings?.slideImageCustomHeight,
            slideImageAdjustments: container?.settings?.slideImageAdjustments,
            imageSettings: container?.settings?.imageSettings,
            overlayPosition: container?.settings?.overlayPosition,
        },
    });

    // Initialize State with Fallback Logic (Only on mount or when container changes)
    useEffect(() => {
        if (containerOverride) {
            const incomingSig = getContainerSlideSig(containerOverride);
            if (incomingSig === lastEmittedContainerSigRef.current) {
                return;
            }
            const containerCopy = JSON.parse(JSON.stringify(containerOverride)) as Container;
            if (!containerCopy.settings.slides) {
                containerCopy.settings.slides = [];
            }
            if (!containerCopy.settings.taggedItems) {
                containerCopy.settings.taggedItems = [];
            }
            setSliderContainer(containerCopy);
            return;
        }
        if (sliderData && (!sliderContainer || sliderContainer.id !== sliderData.container.id)) {
            const containerCopy = JSON.parse(JSON.stringify(sliderData.container));

            // Ensure slides array exists (no hardcoded defaults)
            if (!containerCopy.settings.slides) {
                containerCopy.settings.slides = [];
            }

            setSliderContainer(containerCopy);
        }
    }, [sliderData?.container?.id, containerOverride]);

    // Debounced Real-time sync for background preview (page edit only)
    useEffect(() => {
        if (embedded || containerOverride) return;
        if (sliderContainer && sliderData) {
            const timer = setTimeout(() => {
                syncContainerPreview(sliderData.pageId, sliderContainer);
            }, 500); // 500ms debounce
            return () => clearTimeout(timer);
        }
    }, [sliderContainer, sliderData, syncContainerPreview, embedded, containerOverride]);

    useEffect(() => {
        if (!embedded && containerOverride && onContainerChange && sliderContainer) {
            lastEmittedContainerSigRef.current = getContainerSlideSig(sliderContainer);
            onContainerChange(sliderContainer);
            return;
        }
        if (!embedded || !onContainerChange || !sliderContainer) return;
        lastEmittedContainerSigRef.current = getContainerSlideSig(sliderContainer);
        onContainerChange(sliderContainer);
    }, [sliderContainer, embedded, containerOverride, onContainerChange]);

    const isImageTextSlider = sliderContainer ? isImageTextSliderContainer(sliderContainer.settings) : false;
    const taggedIds: any[] = sliderContainer?.settings.taggedItems || [];
    const taggedSliderItems = sliderContainer && isImageTextSlider
        ? buildImageTextSliderDisplayItems(sliderContainer.settings, sliderItems)
        : taggedIds
            .map((tid) => sliderItems.find(item => String(item.id) === String(tid)))
            .filter(Boolean) as SliderItem[];

    const activeContainer = sliderContainer || sliderData?.container || containerOverride || null;
    const resolvedEditorAccess = useMemo((): EditorAccessConfig => {
        if (editorAccess) return editorAccess;
        if (!activeContainer) return { role: webStudioUserRole };
        return {
            role: webStudioUserRole,
            editableFields: resolveContainerEditableFields(
                activeContainer.type,
                activeContainer.settings,
                sectionTemplates.find((t) => t.id === activeContainer.settings?.sectionTemplateId)?.editableFields
            ),
        };
    }, [editorAccess, activeContainer, webStudioUserRole, sectionTemplates]);

    const effectiveEditableFields = (resolvedEditorAccess.editableFields
        ?? activeContainer?.settings?.sectionTemplateEditableFields) as string[] | undefined;
    const isTemplateAuthoring = Boolean(resolvedEditorAccess.isTemplateEditor);
    const settingsRole = isTemplateAuthoring ? 'super_admin' : (resolvedEditorAccess.role || 'super_admin');
    const canPublish = canPublishContent(settingsRole);
    const isTemplateRestricted = activeContainer
        ? isTemplateRestrictedEditor(settingsRole, activeContainer.settings)
        : false;
    const showSettingsTab = !isTemplateRestricted || isTemplateAuthoring || hasSiteAdminSliderSettingsAccess(effectiveEditableFields);

    useEffect(() => {
        if (!showSettingsTab && activeTab === 'SETTINGS') {
            setActiveTab('SLIDES');
        }
    }, [showSettingsTab, activeTab]);

    if (!sliderContainer) return null;
    if (!sliderData && !containerOverride) return null;

    // Derived type for global slide filtering
    const sliderType = isImageTextSlider ? 'img_text' : 'img_gallery';

    // Use slides from local state (which might now contain defaults)
    const slides = sliderContainer.settings.slides || [];

    const restrictSettings = isTemplateRestricted && !isTemplateAuthoring;
    const allowGroup = (group: string) => !restrictSettings
        || isSettingsGroupEditable(settingsRole, group, ContainerType.SLIDER, effectiveEditableFields);
    const allowField = (fieldKey: string) => !restrictSettings
        || (settingsRole === 'super_admin'
            ? isFieldEditableForRole(settingsRole, fieldKey, effectiveEditableFields)
            : isContentEditorFieldEditable(settingsRole, ContainerType.SLIDER, fieldKey, effectiveEditableFields));
    const allowSettingsPath = (path: string) => !restrictSettings
        || isSettingsPathEditable(settingsRole, path, ContainerType.SLIDER, effectiveEditableFields);
    const showGeneralSettings = isTemplateAuthoring || !restrictSettings
        || allowField('content.title')
        || allowField('content.subtitle')
        || allowField('content.description')
        || allowGroup('displayOptions')
        || allowGroup('layoutBehavior')
        || allowGroup('typography');
    const canManageSlideQueue = !isTemplateRestricted || allowField('settings.taggedItems');
    const canEditSlideContent = canManageSlideQueue
        || allowField('content.title')
        || allowField('content.subtitle')
        || allowField('content.description');

    const canEditSlideDesign = isTemplateAuthoring || (
        !isTemplateRestricted
        || isSettingsGroupEditable(settingsRole, 'slideDesign', ContainerType.SLIDER, effectiveEditableFields)
    );
    const lockSlideDesignInEditor = !canEditSlideDesign;

    const templateSlideAdjustments = (sliderContainer.settings.slideImageAdjustments || DEFAULT_SLIDE_ADJUSTMENTS) as typeof DEFAULT_SLIDE_ADJUSTMENTS;

    const sortedTaggedSliderItems = useMemo(
        () => sortTaggedSliderItems(taggedSliderItems, taggedIds, sliderContainer.settings, currentLanguage),
        [
            taggedSliderItems,
            taggedIds,
            sliderContainer,
            sliderContainer.settings.sortField,
            sliderContainer.settings.sortDirection,
            currentLanguage,
        ]
    );

    const saveChanges = async () => {
        if (embedded) {
            if (sliderContainer && onContainerChange) {
                onContainerChange(sliderContainer);
            }
            return;
        }
        if (sliderContainer && sliderData) {
            await updateContainer(sliderData.pageId, sliderContainer);
        } else if (sliderContainer && containerOverride?.pageId) {
            await updateContainer(containerOverride.pageId, sliderContainer);
        }
        onClose();
    };

    const handleApplyTaggedOrder = async ({ orderedIds }: TaggedOrderApplyResult) => {
        setSliderContainer((prev) => {
            if (!prev) return null;
            const settings: any = { ...prev.settings, taggedItems: orderedIds };
            const slides = settings.slides;
            if (slides && Array.isArray(slides)) {
                const orderIndex = new Map(orderedIds.map((id, i) => [String(id), i]));
                settings.slides = [...slides].sort((a: any, b: any) => {
                    const ai = orderIndex.get(String(a.id)) ?? 9999;
                    const bi = orderIndex.get(String(b.id)) ?? 9999;
                    return ai - bi;
                });
            }
            return { ...prev, settings };
        });
    };

    const sliderTaggedOrderChangeContext: TaggedOrderChangeContext | undefined = (() => {
        if (!sliderContainer) return undefined;
        const containerSlides: any[] = sliderContainer.settings.slides || [];
        const containerTagged: string[] = (sliderContainer.settings.taggedItems || []).map((id: any) => String(id));

        let orderedIds: string[] = [];
        if (containerTagged.length > 0) {
            orderedIds = containerTagged;
        } else if (containerSlides.length > 0) {
            orderedIds = containerSlides.map((slide: any) => String(slide.id));
        } else {
            return undefined;
        }

        if (orderedIds.length < 2) return undefined;

        const items = orderedIds.map((id) => {
            const spItem = sliderItems.find((entry) => String(entry.id) === String(id));
            const slideMeta = containerSlides.find((slide: any) => String(slide.id) === String(id));
            const title =
                (spItem ? getItemTranslation(spItem, currentLanguage, 'title') : '') ||
                slideMeta?.title ||
                id;
            return {
                id: String(id),
                title,
                imageUrl: spItem?.imageUrl || slideMeta?.image || slideMeta?.img,
                status: spItem?.status,
            };
        });

        return {
            taggedIds: orderedIds,
            items,
            onApply: handleApplyTaggedOrder,
        };
    })();

    const handleDeleteSlider = async () => {
        if (!sliderData) return;
        await deleteContainer(sliderData.pageId, sliderData.container.id);
        onClose();
    };

    const updateSliderSetting = (key: string, val: any) => {
        setSliderContainer(prev => {
            if (!prev) return null;
            return { ...prev, settings: { ...prev.settings, [key]: val } };
        });
    };

    const updateSliderBaseField = (contentKey: string, val: string, legacySettingKey?: string) => {
        setSliderContainer(prev => {
            if (!prev) return null;
            return applyBaseHeaderFieldUpdate(prev, contentKey, val, legacySettingKey);
        });
    };

    // --- Slider Item Actions (SharePoint-backed) ---
    const handleCreateSliderItem = async (title: string) => {
        const tempId = `slider_${Date.now()}`;
        const newItem: SliderItem = {
            id: tempId,
            title: title,
            subtitle: '',
            description: '',
            status: 'Draft',
            sortOrder: sliderItems.length + 1,
            ctaText: '',
            ctaUrl: '',
            imageUrl: '',
            imageName: '',
            translations: { en: { title: title, subtitle: '', description: '', ctaText: '' } },
            itemType: sliderType
        };

        await addSliderItem(newItem);
        setShowCreateSliderItem(false);
    };

    const handleSaveSliderItem = async (item: SliderItem) => {
        const itemWithItemType = { ...item, itemType: item.itemType || sliderType };
        const isNew = !sliderItems.find((s) => s.id === item.id);

        if (isNew) {
            await addSliderItem(itemWithItemType);
        } else {
            // Refresh slide metadata only when the item is already tagged to this container
            setSliderContainer(prev => {
                if (!prev) return null;
                const existingTagged: any[] = prev.settings.taggedItems ? [...prev.settings.taggedItems] : [];
                const existingSlides: any[] = prev.settings.slides ? [...prev.settings.slides] : [];

                const isTagged = existingTagged.map(tid => String(tid)).includes(String(item.id));
                if (!isTagged) return prev;

                const slideIdx = existingSlides.findIndex(s => String(s.id) === String(item.id));
                const slideEntry = {
                    id: item.id,
                    title: item.title || 'New Slide',
                    subtitle: isSliderLayoutToken(item.subtitle) ? '' : (item.subtitle || ''),
                    desc: item.description || '',
                    image: item.imageUrl || '',
                    imageName: item.imageName || '',
                    cta: item.ctaText || '',
                    layout: 'text_overlay',
                    url: item.ctaUrl || '',
                    imageHeightMode: 'default',
                    imageCustomHeight: '',
                    adjustments: { zoom: 1, rotate: 0, brightness: 100, contrast: 100 }
                };

                const newSlides = [...existingSlides];
                if (slideIdx >= 0) {
                    newSlides[slideIdx] = { ...newSlides[slideIdx], ...slideEntry };
                } else {
                    newSlides.push(slideEntry);
                }

                return {
                    ...prev,
                    settings: {
                        ...prev.settings,
                        slides: newSlides
                    }
                };
            });
            updateSliderItem(itemWithItemType);
        }
        setEditingSliderItem(null);
    };

    const handleDeleteSliderItem = (id: string) => {
        const existingItem = sliderItems.find((entry) => String(entry.id) === String(id));
        if (existingItem && !Number.isNaN(Number(id))) {
            deleteSliderItem(id);
        }

        // Remove from both tagged items list and slides metadata in a single functional update
        setSliderContainer(prev => {
            if (!prev) return null;
            const updatedTagged = (prev.settings.taggedItems || []).filter((tid: any) => String(tid) !== String(id));
            const updatedSlides = (prev.settings.slides || []).filter((s: any) => String(s.id) !== String(id));

            return {
                ...prev,
                settings: {
                    ...prev.settings,
                    taggedItems: updatedTagged,
                    slides: updatedSlides
                }
            };
        });

        setDeleteSliderItemId(null);
        setEditingSliderItem(null);
    };

    // --- Slide Actions ---
    const addSlide = () => {
        const newSlide = {
            id: `slide_${Date.now()}`,
            title: '', subtitle: '', desc: '', image: '', cta: '',
            layout: '', url: '',
            imageHeightMode: 'default', imageCustomHeight: '',
            adjustments: { zoom: 1, rotate: 0, brightness: 100, contrast: 100 }
        };
        updateSliderSetting('slides', [...slides, newSlide]);
    };

    const updateSlideData = (id: string, data: any) => {
        const newSlides = slides.map((s: any) => s.id === id ? data : s);
        updateSliderSetting('slides', newSlides);

        if (isImageTextSlider) {
            const existingItem = sliderItems.find((s: any) => s.id === id);

            // Ensure translations update correctly for current language instead of blowing out SP item
            const updatedUebersetzungs: any = existingItem?.translations ? { ...existingItem.translations } : { en: {} };
            if (!updatedUebersetzungs[currentLanguage]) {
                updatedUebersetzungs[currentLanguage] = {};
            }
            updatedUebersetzungs[currentLanguage].title = data.title || '';
            updatedUebersetzungs[currentLanguage].subtitle = sanitizeSliderSubtitleForDisplay(data.subtitle || '');
            updatedUebersetzungs[currentLanguage].description = data.desc || '';
            updatedUebersetzungs[currentLanguage].ctaText = data.buttonText || data.cta || '';

            const spItem: any = {
                ...(existingItem || {}),
                id: id,
                title: data.title || '',
                subtitle: sanitizeSliderSubtitleForDisplay(data.subtitle || ''),
                description: data.desc || '',
                imageUrl: data.image || data.img || '',
                imageName: data.imageName || '',
                ctaText: data.buttonText || data.cta || '',
                ctaUrl: data.buttonLink || data.url || '',
                status: canPublish ? 'Published' : (existingItem?.status || 'Draft'),
                sortOrder: newSlides.findIndex((s: any) => s.id === id) + 1,
                itemType: existingItem?.itemType || sliderType,
                translations: updatedUebersetzungs
            };
            updateSliderItem(spItem);
        }
    };

    // Actual delete logic
    const performDeleteSlide = (id: string) => {
        const existingItem = sliderItems.find((entry) => String(entry.id) === String(id));
        if (isImageTextSlider && existingItem && !Number.isNaN(Number(id))) {
            deleteSliderItem(id);
        }

        // Unified cleanup of local state
        setSliderContainer(prev => {
            if (!prev) return null;
            const updatedTagged = (prev.settings.taggedItems || []).filter((tid: any) => String(tid) !== String(id));
            const updatedSlides = (prev.settings.slides || []).filter((s: any) => String(s.id) !== String(id));

            return {
                ...prev,
                settings: {
                    ...prev.settings,
                    taggedItems: updatedTagged,
                    slides: updatedSlides
                }
            };
        });
    };

    // Requests deletion from List View (opens confirmation)
    const requestDeleteSlide = (id: string) => {
        setDeleteSlideId(id);
    };

    const duplicateSlide = (id: string) => {
        const src = slides.find((s: any) => s.id === id);
        if (src) {
            const copy = { ...src, id: `slide_${Date.now()}_copy`, title: `${src.title} (Copy)` };
            updateSliderSetting('slides', [...slides, copy]);
        }
    };

    const handleAddImageTextSlide = () => {
        const id = `slide_${Date.now()}`;
        const slideTitle = getTranslation('LABEL_NEW_SLIDE', currentLanguage);
        const slideEntry = createImageTextSlideEntry(id, slideTitle, sliderContainer?.settings);

        setSliderContainer((prev) => {
            if (!prev) return null;
            const existingTagged: string[] = [...(prev.settings.taggedItems || [])].map(String);
            const existingSlides = [...(prev.settings.slides || [])];
            return {
                ...prev,
                settings: {
                    ...prev.settings,
                    taggedItems: existingTagged.includes(id) ? existingTagged : [...existingTagged, id],
                    slides: existingSlides.some((slide: any) => String(slide.id) === id)
                        ? existingSlides
                        : [...existingSlides, slideEntry],
                },
            };
        });

        void addSliderItem({
            id,
            title: slideTitle,
            subtitle: '',
            description: '',
            status: 'Draft',
            sortOrder: sliderItems.length + 1,
            ctaText: '',
            ctaUrl: '',
            imageUrl: '',
            imageName: '',
            itemType: sliderType,
            translations: { en: { title: slideTitle, subtitle: '', description: '', ctaText: '' } },
        }).then((addedItem) => {
            if (!addedItem?.id || String(addedItem.id) === id) return;
            const realId = String(addedItem.id);
            setSliderContainer((prev) => {
                if (!prev) return null;
                const remapId = (value: unknown) => (String(value) === id ? realId : String(value));
                return {
                    ...prev,
                    settings: {
                        ...prev.settings,
                        taggedItems: (prev.settings.taggedItems || []).map(remapId),
                        slides: (prev.settings.slides || []).map((slide: any) => (
                            String(slide.id) === id ? { ...slide, id: realId } : slide
                        )),
                    },
                };
            });
        });
    };

    // --- Drag & Drop (Isolated) ---
    const handleDrop = (sourceId: string, targetId: string) => {
        if (sourceId === targetId) return;

        setSliderContainer(prev => {
            if (!prev) return null;
            const newSettings = { ...prev.settings };

            // Reorder 'slides' metadata array
            if (newSettings.slides) {
                const slidesCopy = [...newSettings.slides];
                const dragIdx = slidesCopy.findIndex((s: any) => String(s.id) === String(sourceId));
                const hoverIdx = slidesCopy.findIndex((s: any) => String(s.id) === String(targetId));
                if (dragIdx >= 0 && hoverIdx >= 0) {
                    const [moved] = slidesCopy.splice(dragIdx, 1);
                    slidesCopy.splice(hoverIdx, 0, moved);
                    newSettings.slides = slidesCopy;
                }
            }

            // Reorder 'taggedItems' array (the source of truth for Image/Text sliders)
            if (newSettings.taggedItems) {
                const taggedCopy = [...newSettings.taggedItems];
                const dragIdx = taggedCopy.findIndex((tid: any) => String(tid) === String(sourceId));
                const hoverIdx = taggedCopy.findIndex((tid: any) => String(tid) === String(targetId));
                if (dragIdx >= 0 && hoverIdx >= 0) {
                    const [moved] = taggedCopy.splice(dragIdx, 1);
                    taggedCopy.splice(hoverIdx, 0, moved);
                    newSettings.taggedItems = taggedCopy;
                }
            }

            return { ...prev, settings: newSettings };
        });
    };

    const editorBody = (
            <>
                <div className="flex flex-col h-full bg-white">
                    {isTemplateRestricted && !isTemplateAuthoring && (
                        <TemplateLockedBanner className="mx-6 mt-4 shrink-0" />
                    )}
                    <div className="flex border-b border-gray-200 px-6 bg-white">
                        <TabButton active={activeTab === 'SLIDES'} label={getTranslation('TAB_SLIDES', currentLanguage)} onClick={() => setActiveTab('SLIDES')} />
                        {showSettingsTab && (
                            <TabButton active={activeTab === 'SETTINGS'} label={getTranslation('TAB_SETTINGS', currentLanguage)} onClick={() => setActiveTab('SETTINGS')} />
                        )}
                        {/* Always show Inhalt verwalten for both slider types, but it will be filtered internally */}
                        {(sliderType !== 'img_text' &&
                            <TabButton active={activeTab === 'MANAGE_CONTENT'} label={getTranslation('TAB_MANAGE_CONTENT', currentLanguage) || "Inhalt verwalten"} onClick={() => setActiveTab('MANAGE_CONTENT')} />
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
                        {activeTab === 'SLIDES' && (
                            <div className="w-full space-y-6">
                                <div className="flex justify-between items-center mb-4 gap-3">
                                    <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2 min-w-0">
                                        {getTranslation('LABEL_SLIDE_QUEUE', currentLanguage)}
                                        <EditTrigger
                                            labelKey="LABEL_SLIDE_QUEUE"
                                            title={getTranslation('HELP_SLIDE_QUEUE', currentLanguage)}
                                        />
                                    </h4>
                                    <div className="flex items-center gap-2 shrink-0">
                                    {canManageSlideQueue && sliderTaggedOrderChangeContext && (
                                        <button
                                            type="button"
                                            onClick={() => setShowChangeOrderModal(true)}
                                            className="px-3 py-1.5 border border-gray-300 bg-white text-gray-700 text-[10px] font-bold uppercase rounded-sm hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] transition-colors"
                                        >
                                            {getTranslation('BTN_CHANGE_ORDER', currentLanguage)}
                                        </button>
                                    )}
                                    {canManageSlideQueue && (isImageTextSlider ? (
                                        <button
                                            type="button"
                                            onClick={handleAddImageTextSlide}
                                            className="bg-[var(--btn-primary-bg)] text-white px-4 py-2 text-sm font-bold rounded-sm hover:opacity-90 flex items-center gap-2 shadow-sm transition-transform active:scale-95"
                                        >
                                            <Plus className="w-4 h-4" /> {getTranslation('BTN_ADD_SLIDE', currentLanguage)}
                                        </button>
                                    ) : (
                                        <button onClick={addSlide} className="bg-[var(--btn-primary-bg)] text-white px-4 py-2 text-sm font-bold rounded-sm hover:opacity-90 flex items-center gap-2 shadow-sm transition-transform active:scale-95"><Plus className="w-4 h-4" /> {getTranslation('BTN_ADD_SLIDE', currentLanguage)}</button>
                                    ))}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {isImageTextSlider ? (
                                        /* Image/Text Slider: show only tagged items */
                                        <>
                                            {sortedTaggedSliderItems.length === 0 && <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-sm bg-gray-50 text-gray-400">{getTranslation('MSG_NO_SLIDES', currentLanguage)}</div>}
                                            {sortedTaggedSliderItems.map((item) => (
                                                <div
                                                    key={item.id}
                                                    draggable={canManageSlideQueue}
                                                    onDragStart={(e) => { if (!canManageSlideQueue) return; e.dataTransfer.setData('slideId', String(item.id)); }}
                                                    onDragOver={(e) => canManageSlideQueue && e.preventDefault()}
                                                    onDrop={(e) => { if (!canManageSlideQueue) return; const srcId = e.dataTransfer.getData('slideId'); handleDrop(srcId, String(item.id)); }}
                                                    className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex gap-4 items-center group hover:shadow-md transition-all cursor-default"
                                                >
                                                    {canManageSlideQueue && (
                                                    <div className="cursor-move text-gray-300 hover:text-gray-600"><GripVertical className="w-5 h-5" /></div>
                                                    )}
                                                    <div className="w-16 h-12 bg-gray-100 border border-gray-200 flex-shrink-0 overflow-hidden rounded-sm">
                                                        {item.imageUrl
                                                            ? <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.title} />
                                                            : <div className="w-full h-full" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-sm text-gray-800 truncate">{getItemTranslation(item, currentLanguage, 'title')}</div>
                                                        <div className="text-xs text-gray-500 truncate">{sanitizeSliderSubtitleForDisplay(getItemTranslation(item, currentLanguage, 'subtitle')) || getItemTranslation(item, currentLanguage, 'description') || '—'}</div>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        {canPublish && (
                                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${item.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {item.status === 'Published' ? getTranslation('LABEL_PUBLISHED', currentLanguage) : getTranslation('LABEL_DRAFT', currentLanguage)}
                                                        </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        {canEditSlideContent && (
                                                        <button onClick={() => {
                                                            const exists = slides.find((s: any) => s.id === item.id);
                                                            if (!exists) {
                                                                const newSlides = [...slides, {
                                                                    id: item.id,
                                                                    title: getItemTranslation(item, currentLanguage, 'title'),
                                                                    desc: getItemTranslation(item, currentLanguage, 'description'),
                                                                    image: item.imageUrl,
                                                                    cta: item.ctaText,
                                                                    url: item.ctaUrl,
                                                                    layout: '',
                                                                    adjustments: { zoom: 1, rotate: 0, brightness: 100, contrast: 100 }
                                                                }];
                                                                updateSliderSetting('slides', newSlides);
                                                            }
                                                            setEditingSlideId(item.id);
                                                        }} className="p-2 hover:text-white rounded-sm transition-all hover:bg-[var(--edit-icon-bg,#2563eb)]" title={getTranslation('BTN_EDIT', currentLanguage)}><Pencil className="w-4 h-4" style={{ color: 'var(--icon-color)' }} /></button>
                                                        )}
                                                        {canManageSlideQueue && (
                                                        <button onClick={() => requestDeleteSlide(item.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-all" title={getTranslation('BTN_DELETE', currentLanguage)}><Trash2 className="w-4 h-4" /></button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    ) : (
                                        /* Image Gallery Carousel: show local slides array */
                                        <>
                                            {slides.map((slide: any, idx: number) => (
                                                <div
                                                    key={slide.id}
                                                    draggable
                                                    onDragStart={(e) => { e.dataTransfer.setData('slideId', slide.id); }}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={(e) => { const srcId = e.dataTransfer.getData('slideId'); handleDrop(srcId, slide.id); }}
                                                    className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex gap-4 items-center group hover:shadow-md transition-all cursor-default"
                                                >
                                                    <div className="cursor-move text-gray-300 hover:text-gray-600"><GripVertical className="w-5 h-5" /></div>
                                                    <div className="w-16 h-12 bg-gray-100 border border-gray-200 flex-shrink-0 overflow-hidden rounded-sm relative">
                                                        {slide.image || slide.img ? <img src={slide.image || slide.img} className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-sm text-gray-800 truncate">{slide.title || getTranslation('LABEL_UNTITLED_SLIDE', currentLanguage)}</div>
                                                        <div className="text-xs text-gray-500 truncate">{stripHtml(slide.desc) || getTranslation('LABEL_NO_DESCRIPTION', currentLanguage)}</div>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setEditingSlideId(slide.id)} className="p-2 hover:text-white rounded-sm transition-all hover:bg-[var(--edit-icon-bg, #2563eb)]" title={getTranslation('BTN_EDIT', currentLanguage)}><Pencil className="w-4 h-4" style={{ color: 'var(--icon-color)' }} /></button>
                                                        <button onClick={() => duplicateSlide(slide.id)} className="p-2 text-gray-400 hover:text-white rounded-sm transition-all hover:bg-[var(--edit-icon-bg, #2563eb)]" title={getTranslation('BTN_COPY', currentLanguage)}><Copy className="w-4 h-4" /></button>
                                                        <button onClick={() => requestDeleteSlide(slide.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-all" title={getTranslation('BTN_DELETE', currentLanguage)}><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                    <div className="text-gray-300 cursor-move"><ArrowUpDown className="w-4 h-4" /></div>
                                                </div>
                                            ))}
                                            {slides.length === 0 && <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-sm bg-gray-50 text-gray-400">{getTranslation('MSG_NO_SLIDES', currentLanguage)}</div>}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'SETTINGS' && showSettingsTab && (
                            <div className="mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {showGeneralSettings && (
                                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                    <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('SECTION_GENERAL_SETTINGS', currentLanguage)}</h4>
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {allowField('content.title') && (
                                            <div className="space-y-2 min-w-0">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <label className="text-xs font-bold text-gray-500 uppercase shrink-0">{getTranslation('LABEL_SLIDER_TITLE', currentLanguage)}</label>
                                                    {allowGroup('displayOptions') && (
                                                    <div className="flex items-center gap-2 ml-auto shrink-0">
                                                        <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_HEADER', currentLanguage)}</span>
                                                        <VisibilityToggle
                                                            checked={sliderContainer.settings.showHeader !== false}
                                                            onCheckedChange={(v) => updateSliderSetting('showHeader', v)}
                                                            ariaLabel={getTranslation('LABEL_SHOW_HEADER', currentLanguage)}
                                                        />
                                                    </div>
                                                    )}
                                                </div>
                                                {(sliderContainer.settings.showHeader !== false) && (
                                                    <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={getExactLanguageText(sliderContainer.content.title, SLIDER_EDITOR_SOURCE_LANG)} onChange={(e) => updateSliderBaseField('title', e.target.value)} placeholder={getTranslation('PLACEHOLDER_SLIDER_TITLE', currentLanguage)} />
                                                )}
                                            </div>
                                            )}
                                            {allowField('content.subtitle') && (
                                            <div className="space-y-2 min-w-0">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <label className="text-xs font-bold text-gray-500 uppercase shrink-0">
                                                        {getTranslation('LABEL_SUBHEADING', currentLanguage)}
                                                        <EditTrigger labelKey="LABEL_SUBHEADING" className="ml-2" />
                                                    </label>
                                                    {allowGroup('displayOptions') && (
                                                    <div className="flex items-center gap-2 ml-auto shrink-0">
                                                        <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_SUBHEADING', currentLanguage)}</span>
                                                        <VisibilityToggle
                                                            checked={sliderContainer.settings.showSubheading !== false}
                                                            onCheckedChange={(v) => updateSliderSetting('showSubheading', v)}
                                                            ariaLabel={getTranslation('LABEL_SHOW_SUBHEADING', currentLanguage)}
                                                        />
                                                    </div>
                                                    )}
                                                </div>
                                                {(sliderContainer.settings.showSubheading !== false) && (
                                                    <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={getExactLanguageText(sliderContainer.content.subtitle, SLIDER_EDITOR_SOURCE_LANG) || getExactLanguageText(sliderContainer.settings.subheading, SLIDER_EDITOR_SOURCE_LANG)} onChange={(e) => updateSliderBaseField('subtitle', e.target.value, 'subheading')} placeholder={getTranslation('PLACEHOLDER_SUBHEADING', currentLanguage)} />
                                                )}
                                            </div>
                                            )}
                                        </div>
                                        {allowField('content.description') && (
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <label className="text-xs font-bold text-gray-500 uppercase shrink-0">
                                                    {getTranslation('LABEL_DESCRIPTION', currentLanguage)}
                                                    <EditTrigger labelKey="LABEL_DESCRIPTION" className="ml-2" />
                                                </label>
                                                {allowGroup('displayOptions') && (
                                                <div className="flex items-center gap-2 ml-auto shrink-0">
                                                    <span className="text-xs font-medium text-gray-600">{getTranslation('LABEL_SHOW_DESC', currentLanguage)}</span>
                                                    <VisibilityToggle
                                                        checked={sliderContainer.settings.showDescription !== false}
                                                        onCheckedChange={(v) => updateSliderSetting('showDescription', v)}
                                                        ariaLabel={getTranslation('LABEL_SHOW_DESC', currentLanguage)}
                                                    />
                                                </div>
                                                )}
                                            </div>
                                            {(sliderContainer.settings.showDescription !== false) && (
                                                <JoditRichTextEditor
                                                    value={getExactLanguageText(sliderContainer.content.description, SLIDER_EDITOR_SOURCE_LANG) || getExactLanguageText(sliderContainer.settings.description, SLIDER_EDITOR_SOURCE_LANG)}
                                                    onChange={(v: any) => updateSliderBaseField('description', v, 'description')}
                                                    height={150}
                                                />
                                            )}
                                        </div>
                                        )}
                                        {(allowGroup('layoutBehavior') || allowGroup('typography')) && (
                                        <div className="grid grid-cols-2 gap-8">
                                            {allowGroup('layoutBehavior') && (
                                            <VisualSelector
                                                label={getTranslation('LABEL_TEXT_ALIGNMENT', currentLanguage)}
                                                value={sliderContainer.settings.align || 'left'}
                                                onChange={(v) => updateSliderSetting('align', v)}
                                                options={[
                                                    { value: 'left', label: getTranslation('ALIGN_LEFT', currentLanguage), icon: AlignLeft },
                                                    { value: 'center', label: getTranslation('ALIGN_CENTER', currentLanguage), icon: AlignCenter },
                                                    { value: 'right', label: getTranslation('ALIGN_RIGHT', currentLanguage), icon: AlignRight }
                                                ]}
                                            />
                                            )}
                                            {allowGroup('typography') && (
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_LETTER_CASE', currentLanguage)}</label>
                                                <select className="w-full border p-2.5 text-sm rounded-sm bg-white" value={sliderContainer.settings.letterCase || 'uppercase'} onChange={(e) => updateSliderSetting('letterCase', e.target.value)}>
                                                    <option value="none">{getTranslation('LABEL_NONE', currentLanguage)}</option>
                                                    <option value="uppercase">{getTranslation('LABEL_UPPERCASE', currentLanguage)}</option>
                                                    <option value="lowercase">{getTranslation('LABEL_LOWERCASE', currentLanguage)}</option>
                                                    <option value="capitalize">{getTranslation('LABEL_CAPITALIZE', currentLanguage)}</option>
                                                </select>
                                            </div>
                                            )}
                                        </div>
                                        )}
                                    </div>
                                </div>
                                )}

                                {allowGroup('typography') && (
                                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                    <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 uppercase text-xs tracking-wider">{getTranslation('LABEL_TYPOGRAPHY', currentLanguage)}</h4>
                                    <div className="grid grid-cols-3 gap-6 mb-6">
                                        {/* Heading Color */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_HEADING_COLOR', currentLanguage)}</label>
                                            <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={sliderContainer.settings.titleColor || 'site'} onChange={(e) => updateSliderSetting('titleColor', e.target.value)}>
                                                <option value="site">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                                <option value="black">{getTranslation('LABEL_BLACK', currentLanguage)}</option>
                                                <option value="white">{getTranslation('LABEL_WHITE', currentLanguage)}</option>
                                                <option value="custom">{getTranslation('LABEL_CUSTOM_COLOR', currentLanguage)}</option>
                                            </select>
                                            {sliderContainer.settings.titleColor === 'custom' && (
                                                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <ColorPicker value={sliderContainer.settings.titleCustomColor || '#333333'} onChange={(v) => updateSliderSetting('titleCustomColor', v)} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Sub Heading Color */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_SUBHEADING_COLOR', currentLanguage)}</label>
                                            <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={sliderContainer.settings.subtitleColor || 'site'} onChange={(e) => updateSliderSetting('subtitleColor', e.target.value)}>
                                                <option value="site">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                                <option value="black">{getTranslation('LABEL_BLACK', currentLanguage)}</option>
                                                <option value="white">{getTranslation('LABEL_WHITE', currentLanguage)}</option>
                                                <option value="custom">{getTranslation('LABEL_CUSTOM_COLOR', currentLanguage)}</option>
                                            </select>
                                            {sliderContainer.settings.subtitleColor === 'custom' && (
                                                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <ColorPicker value={sliderContainer.settings.subtitleCustomColor || '#666666'} onChange={(v) => updateSliderSetting('subtitleCustomColor', v)} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Description Color */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_DESCRIPTION_COLOR', currentLanguage)}</label>
                                            <select className="w-full border p-2 text-sm rounded-sm bg-white mb-2" value={sliderContainer.settings.descColor || 'site'} onChange={(e) => updateSliderSetting('descColor', e.target.value)}>
                                                <option value="site">{getTranslation('LABEL_SITE_COLOR', currentLanguage)}</option>
                                                <option value="black">{getTranslation('LABEL_BLACK', currentLanguage)}</option>
                                                <option value="white">{getTranslation('LABEL_WHITE', currentLanguage)}</option>
                                                <option value="custom">{getTranslation('LABEL_CUSTOM_COLOR', currentLanguage)}</option>
                                            </select>
                                            {sliderContainer.settings.descColor === 'custom' && (
                                                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <ColorPicker value={sliderContainer.settings.descCustomColor || '#555555'} onChange={(v) => updateSliderSetting('descCustomColor', v)} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Font Sizes */}
                                    <div className="grid grid-cols-3 gap-6">
                                        {/* Title/Heading Size */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_HEADING_SIZE', currentLanguage)}</label>
                                            <div className="flex items-center border rounded-sm overflow-hidden">
                                                <input
                                                    type="number"
                                                    min={8}
                                                    max={120}
                                                    className="flex-1 p-2 text-sm outline-none bg-white font-medium"
                                                    value={sliderContainer.settings.titleFontSize || ''}
                                                    placeholder="e.g. 42"
                                                    onChange={(e) => updateSliderSetting('titleFontSize', e.target.value ? Number(e.target.value) : '')}
                                                />
                                                <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l h-full flex items-center">px</span>
                                            </div>
                                        </div>

                                        {/* Subheading Size */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_SUBHEADING_SIZE', currentLanguage)}</label>
                                            <div className="flex items-center border rounded-sm overflow-hidden">
                                                <input
                                                    type="number"
                                                    min={8}
                                                    max={120}
                                                    className="flex-1 p-2 text-sm outline-none bg-white font-medium"
                                                    value={sliderContainer.settings.subtitleFontSize || ''}
                                                    placeholder="e.g. 24"
                                                    onChange={(e) => updateSliderSetting('subtitleFontSize', e.target.value ? Number(e.target.value) : '')}
                                                />
                                                <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l h-full flex items-center">px</span>
                                            </div>
                                        </div>

                                        {/* Description Size */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_DESCRIPTION_SIZE', currentLanguage)}</label>
                                            <div className="flex items-center border rounded-sm overflow-hidden">
                                                <input
                                                    type="number"
                                                    min={8}
                                                    max={120}
                                                    className="flex-1 p-2 text-sm outline-none bg-white font-medium"
                                                    value={sliderContainer.settings.descFontSize || ''}
                                                    placeholder="e.g. 16"
                                                    onChange={(e) => updateSliderSetting('descFontSize', e.target.value ? Number(e.target.value) : '')}
                                                />
                                                <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l h-full flex items-center">px</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                )}

                                {isImageTextSlider && allowGroup('slideDesign') && (
                                    <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                        <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('SECTION_LAYOUT', currentLanguage)}</h4>
                                        <p className="text-xs text-gray-500 mb-4">{getTranslation('MSG_TEMPLATE_SLIDE_LAYOUT_HINT', currentLanguage)}</p>
                                        <SlideLayoutSelector
                                            value={String(sliderContainer.settings.defaultSlideLayout || 'text_overlay')}
                                            onChange={(layout) => updateSliderSetting('defaultSlideLayout', layout)}
                                            currentLanguage={currentLanguage}
                                        />
                                    </div>
                                )}

                                {isImageTextSlider && allowGroup('slideDesign') && (
                                    <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                        <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('TMPL_FIELD_SLIDE_DESIGN', currentLanguage)}</h4>
                                        <SlideImageBehaviorEditor
                                            imageHeightMode={String(sliderContainer.settings.slideImageHeightMode || 'default')}
                                            imageCustomHeight={String(sliderContainer.settings.slideImageCustomHeight || '')}
                                            adjustments={templateSlideAdjustments}
                                            containerSettings={sliderContainer.settings}
                                            currentLanguage={currentLanguage}
                                            onImageHeightModeChange={(mode) => updateSliderSetting('slideImageHeightMode', mode)}
                                            onImageCustomHeightChange={(value) => updateSliderSetting('slideImageCustomHeight', value)}
                                            onAdjustmentChange={(key, value) => updateSliderSetting('slideImageAdjustments', {
                                                ...templateSlideAdjustments,
                                                [key]: value,
                                            })}
                                        />
                                    </div>
                                )}

                                {allowGroup('layoutBehavior') && (
                                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                    <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('SECTION_AUTOPLAY', currentLanguage)}</h4>
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium text-gray-700">{getTranslation('LABEL_ENABLE_AUTOPLAY', currentLanguage)}</label>
                                            <div onClick={() => updateSliderSetting('autoplay', !sliderContainer.settings.autoplay)} className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${sliderContainer.settings.autoplay ? 'bg-[var(--primary-color)]' : 'bg-gray-300'}`}>
                                                <div className={`w-3 h-3 bg-white rounded-full shadow-sm absolute top-1 transition-all ${sliderContainer.settings.autoplay ? 'left-6' : 'left-1'}`} />
                                            </div>
                                        </div>
                                        {sliderContainer.settings.autoplay && (
                                            <div className="bg-gray-50 p-4 rounded-sm border border-gray-100">
                                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 flex justify-between"><span>{getTranslation('LABEL_SLIDER_SPEED', currentLanguage)}</span><span className="text-[var(--primary-color)]">{sliderContainer.settings.speed || 5}s</span></label>
                                                <input type="range" min="2" max="10" step="1" value={sliderContainer.settings.speed || 5} onChange={(e) => updateSliderSetting('speed', parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                )}

                                {allowGroup('layoutBehavior') && (
                                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                    <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('LABEL_NAVIGATION_CONTROLS', currentLanguage)}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-sm bg-white">
                                            <span className="text-sm font-medium text-gray-700">{getTranslation('LABEL_SHOW_ARROWS', currentLanguage)}</span>
                                            <VisibilityToggle
                                                checked={sliderContainer.settings.arrows !== false}
                                                onCheckedChange={(v) => updateSliderSetting('arrows', v)}
                                                ariaLabel={getTranslation('LABEL_SHOW_ARROWS', currentLanguage)}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-sm bg-white">
                                            <span className="text-sm font-medium text-gray-700">{getTranslation('LABEL_SHOW_DOTS', currentLanguage)}</span>
                                            <VisibilityToggle
                                                checked={sliderContainer.settings.dots !== false}
                                                onCheckedChange={(v) => updateSliderSetting('dots', v)}
                                                ariaLabel={getTranslation('LABEL_SHOW_DOTS', currentLanguage)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                )}

                                {isImageTextSlider && allowGroup('slideDesign') && (
                                    <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                        <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('LABEL_IMAGE_CORNER_RADIUS', currentLanguage)}</h4>
                                        <SliderImageRadiusEditor
                                            imageSettings={parseSliderImageSettings(sliderContainer.settings.imageSettings)}
                                            currentLanguage={currentLanguage}
                                            onChange={(imageSettings) => updateSliderSetting('imageSettings', imageSettings)}
                                        />
                                    </div>
                                )}

                                {allowGroup('cardSettings') && (
                                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                    <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('LABEL_CARD_SETTINGS', currentLanguage)}</h4>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-sm bg-white">
                                            <label className="text-sm font-medium text-gray-700">
                                                {getTranslation('LABEL_ENABLE_READ_MORE_BUTTON', currentLanguage)}
                                            </label>
                                            <VisibilityToggle
                                                checked={!!sliderContainer.settings.enableCardReadMore}
                                                onCheckedChange={(next) => {
                                                    updateSliderSetting('enableCardReadMore', next);
                                                    if (next && !sliderContainer.settings.readMoreBehavior) {
                                                        updateSliderSetting('readMoreBehavior', 'popup');
                                                    }
                                                }}
                                                ariaLabel={getTranslation('LABEL_ENABLE_READ_MORE_BUTTON', currentLanguage)}
                                            />
                                        </div>

                                        {!!sliderContainer.settings.enableCardReadMore && (
                                            <div className="space-y-4">
                                                <VisualSelector
                                                    label={getTranslation('LABEL_READ_MORE_DISPLAY_TYPE', currentLanguage)}
                                                    value={sliderContainer.settings.readMoreDisplayType === 'button' ? 'button' : 'link'}
                                                    onChange={(v) => updateSliderSetting('readMoreDisplayType', v)}
                                                    options={[
                                                        { value: 'link', label: getTranslation('LABEL_READ_MORE_AS_LINK', currentLanguage) },
                                                        { value: 'button', label: getTranslation('LABEL_READ_MORE_AS_BUTTON', currentLanguage) },
                                                    ]}
                                                />
                                                <VisualSelector
                                                    label={getTranslation('LABEL_READ_MORE_BEHAVIOR', currentLanguage)}
                                                    value={sliderContainer.settings.readMoreBehavior || 'popup'}
                                                    onChange={(v) => updateSliderSetting('readMoreBehavior', v)}
                                                    options={[
                                                        { value: 'popup', label: getTranslation('LABEL_READ_MORE_POPUP', currentLanguage) },
                                                        { value: 'expand', label: getTranslation('LABEL_READ_MORE_EXPAND', currentLanguage) },
                                                    ]}
                                                />
                                                <VisualSelector
                                                    label={sliderContainer.settings.readMoreDisplayType === 'button'
                                                        ? getTranslation('LABEL_READ_MORE_BUTTON_SIZE', currentLanguage)
                                                        : getTranslation('LABEL_READ_MORE_LINK_SIZE', currentLanguage)}
                                                    value={sliderContainer.settings.readMoreButtonSize || 'md'}
                                                    onChange={(v) => updateSliderSetting('readMoreButtonSize', v)}
                                                    options={[
                                                        { value: 'sm', label: getTranslation('LABEL_SMALL', currentLanguage) },
                                                        { value: 'md', label: getTranslation('LABEL_MEDIUM', currentLanguage) },
                                                        { value: 'lg', label: getTranslation('LABEL_LARGE', currentLanguage) },
                                                    ]}
                                                />
                                                <VisualSelector
                                                    label={getTranslation('LABEL_READ_MORE_POSITION', currentLanguage)}
                                                    value={sliderContainer.settings.readMoreAlignment === 'center' || sliderContainer.settings.readMoreAlignment === 'right'
                                                        ? sliderContainer.settings.readMoreAlignment
                                                        : 'left'}
                                                    onChange={(v) => updateSliderSetting('readMoreAlignment', v)}
                                                    options={[
                                                        { value: 'left', label: getTranslation('LABEL_LEFT', currentLanguage) },
                                                        { value: 'center', label: getTranslation('LABEL_CENTER', currentLanguage) },
                                                        { value: 'right', label: getTranslation('LABEL_RIGHT', currentLanguage) },
                                                    ]}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                )}

                                {(allowGroup('displayOptions') || allowGroup('slideDesign')) && (
                                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                    <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 text-xs uppercase tracking-wider">{getTranslation('SECTION_TEXT_OVERLAY', currentLanguage)}</h4>
                                    {allowGroup('displayOptions') && (
                                    <div className="grid grid-cols-2 gap-8 mb-6">
                                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-sm"><span className="text-sm font-medium text-gray-700">{getTranslation('LABEL_SHOW_TITLE', currentLanguage)}</span><div onClick={() => updateSliderSetting('showSlideTitle', !sliderContainer.settings.showSlideTitle)} className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${sliderContainer.settings.showSlideTitle !== false ? 'bg-[var(--primary-color)]' : 'bg-gray-300'}`}><div className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm absolute top-0.5 transition-all ${sliderContainer.settings.showSlideTitle !== false ? 'left-5' : 'left-0.5'}`} /></div></div>
                                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-sm"><span className="text-sm font-medium text-gray-700">{getTranslation('LABEL_SHOW_DESC', currentLanguage)}</span><div onClick={() => updateSliderSetting('showSlideDescription', !sliderContainer.settings.showSlideDescription)} className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${sliderContainer.settings.showSlideDescription !== false ? 'bg-[var(--primary-color)]' : 'bg-gray-300'}`}><div className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm absolute top-0.5 transition-all ${sliderContainer.settings.showSlideDescription !== false ? 'left-5' : 'left-0.5'}`} /></div></div>
                                    </div>
                                    )}
                                    {allowGroup('slideDesign') && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_OVERLAY_POS', currentLanguage)}</label>
                                        <div className="flex gap-4">
                                            {[
                                                { id: 'bottom', label: getTranslation('POS_BOTTOM', currentLanguage) },
                                                { id: 'middle', label: getTranslation('POS_MIDDLE', currentLanguage) }
                                            ].map(pos => (
                                                <label key={pos.id} className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-sm cursor-pointer transition-all ${sliderContainer.settings.overlayPosition === pos.id ? 'border-[var(--primary-color)] bg-[var(--brand-light)] text-[var(--primary-color)] font-bold' : 'border-gray-200 hover:bg-gray-50'}`}>
                                                    <input type="radio" name="overlayPos" checked={sliderContainer.settings.overlayPosition === pos.id} onChange={() => updateSliderSetting('overlayPosition', pos.id)} className="hidden" />
                                                    {sliderContainer.settings.overlayPosition === pos.id ? <Circle className="w-3 h-3 fill-current" /> : <Circle className="w-3 h-3 text-gray-400" />} {pos.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    )}
                                </div>
                                )}

                                <SectionCustomizationEditor
                                    settings={sliderContainer.settings}
                                    onChange={updateSliderSetting}
                                    currentLanguage={currentLanguage}
                                />
                            </div>
                        )}

                        {sliderType !== 'img_text' && activeTab === 'MANAGE_CONTENT' && (
                            <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* Header */}
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-800">{getTranslation('TITLE_SLIDER_LIST', currentLanguage)} <EditTrigger labelKey="TITLE_SLIDER_LIST" /></h4>
                                        <p className="text-xs text-gray-400 mt-0.5">{getTranslation('DESC_SLIDER_LIST', currentLanguage)} <EditTrigger labelKey="DESC_SLIDER_LIST" /></p>
                                    </div>
                                    <button
                                        onClick={() => setShowCreateSliderItem(true)}
                                        className="bg-[var(--btn-primary-bg)] text-white px-4 py-2 text-sm font-bold rounded-sm hover:opacity-90 flex items-center gap-2 shadow-sm"
                                    >
                                        <Plus className="w-4 h-4" /> {getTranslation('BTN_ADD_ITEM', currentLanguage)}
                                    </button>
                                </div>

                                {/* Items List */}
                                <div className="space-y-3">
                                    {sliderItems.filter(item => (item.itemType || 'img_text') === sliderType).length === 0 && (
                                        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-sm bg-gray-50">
                                            <ImageIcon className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                                            <p className="text-gray-400 text-sm font-medium">{getTranslation('MSG_NO_SLIDER_ITEMS', currentLanguage)}</p>
                                            <p className="text-gray-300 text-xs mt-1">{getTranslation('MSG_CLICK_ADD_ITEM', currentLanguage)}</p>
                                        </div>
                                    )}
                                    {sliderItems
                                        .filter(item => (item.itemType || 'img_text') === sliderType)
                                        .map((item) => (
                                            <div key={item.id} className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex gap-4 items-center group hover:shadow-md transition-all">
                                                <div className="w-16 h-12 bg-gray-100 border border-gray-200 flex-shrink-0 overflow-hidden rounded-sm relative">
                                                    {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.title} /> : <ImageIcon className="w-6 h-6 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-sm text-gray-800 truncate">{getItemTranslation(item, currentLanguage, 'title')}</div>
                                                    <div className="text-xs text-gray-500 truncate">{getItemTranslation(item, currentLanguage, 'subtitle') || getItemTranslation(item, currentLanguage, 'description') || '—'}</div>
                                                </div>
                                                <div className="flex-shrink-0">
                                                    {canPublish && (
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${item.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {item.status === 'Published' ? getTranslation('LABEL_PUBLISHED', currentLanguage) : getTranslation('LABEL_DRAFT', currentLanguage)}
                                                    </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setEditingSliderItem(item)}
                                                        className="p-2 hover:text-white rounded-sm transition-all hover:bg-[var(--edit-icon-bg,#2563eb)]"
                                                        title={getTranslation('BTN_EDIT', currentLanguage)}
                                                    ><Pencil className="w-4 h-4" style={{ color: 'var(--edit-icon-color)' }} /></button>
                                                    <button
                                                        onClick={() => setDeleteSliderItemId(item.id)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-all"
                                                        title={getTranslation('BTN_DELETE', currentLanguage)}
                                                    ><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {!embedded && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-white flex flex-col gap-4 flex-shrink-0">
                        <div className="flex items-center justify-between gap-6">
                            {sliderContainer.settings?.templateId === 'img_text' ? (
                                <div className="flex-1">
                                    <SharePointMetadataFooter
                                        listTitle="Containers"
                                        itemId={sliderContainer.id}
                                        createdDate={sliderContainer.createdDate}
                                        createdBy={sliderContainer.createdBy}
                                        modifiedDate={sliderContainer.modifiedDate}
                                        modifiedBy={sliderContainer.modifiedBy}
                                        onDelete={() => setShowDeleteSliderConfirm(true)}
                                        onVersionRestore={() => {
                                            useStore.getState().loadFromSharePoint();
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center gap-4">
                                    <OpenOOTBButton listTitle="ImageSlider" />
                                    <button
                                        onClick={() => setShowDeleteSliderConfirm(true)}
                                        className="text-red-500 text-xs font-bold hover:underline flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" /> {getTranslation('BTN_DELETE_SLIDER', currentLanguage)}
                                    </button>
                                </div>
                            )}
                            <div className="flex gap-3 items-center">
                                <button onClick={onClose} className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-50 rounded-sm transition-colors">
                                    {getTranslation('BTN_CANCEL', currentLanguage)}
                                </button>
                                <button onClick={saveChanges} className="px-8 py-2 bg-[var(--btn-primary-bg)] text-white text-sm font-bold shadow-sm hover:opacity-90 rounded-sm flex items-center gap-2">
                                    <Save className="w-4 h-4" /> {getTranslation('BTN_SAVE_CHANGES', currentLanguage)} <EditTrigger labelKey="BTN_SAVE_CHANGES" />
                                </button>
                            </div>
                        </div>
                    </div>
                    )}
                </div>

                {showDeleteSliderConfirm && (
                    <ConfirmDeleteDialog
                        title={getTranslation('BTN_DELETE_SLIDER', currentLanguage)}
                        message={getTranslation('MSG_CONFIRM_DELETE_SLIDER', currentLanguage)}
                        onConfirm={handleDeleteSlider}
                        onCancel={() => setShowDeleteSliderConfirm(false)}
                    />
                )}

                {editingSlideId && (
                    <EditSlideModal
                        key={`edit-slide-${editingSlideId}-${sliderContainer.id}`}
                        slideId={editingSlideId}
                        allSlides={slides}
                        containerSettings={sliderContainer.settings}
                        onSave={updateSlideData}
                        onClose={() => setEditingSlideId(null)}
                        onDelete={performDeleteSlide}
                        lockSlideDesign={lockSlideDesignInEditor}
                    />
                )}

                {deleteSlideId && (
                    <ConfirmDeleteDialog
                        title={getTranslation('BTN_DELETE_SLIDE', currentLanguage)}
                        message={getTranslation('MSG_CONFIRM_DELETE_SLIDE_LIST', currentLanguage)}
                        onConfirm={() => { performDeleteSlide(deleteSlideId); setDeleteSlideId(null); }}
                        onCancel={() => setDeleteSlideId(null)}
                    />
                )}

                {deleteSliderItemId && (
                    <ConfirmDeleteDialog
                        title={getTranslation('TITLE_DELETE_SLIDER_ITEM', currentLanguage)}
                        message={getTranslation('MSG_CONFIRM_DELETE_SLIDER_ITEM', currentLanguage)}
                        onConfirm={() => deleteSliderItemId && handleDeleteSliderItem(deleteSliderItemId)}
                        onCancel={() => setDeleteSliderItemId(null)}
                    />
                )}

                {showCreateSliderItem && (
                    <CreateSliderItemModal
                        onSave={handleCreateSliderItem}
                        onCancel={() => setShowCreateSliderItem(false)}
                    />
                )}

                {editingSliderItem && (
                    <SliderItemEditor
                        key={`edit-slider-item-${editingSliderItem.id}`}
                        item={editingSliderItem}
                        onSave={handleSaveSliderItem}
                        onCancel={() => setEditingSliderItem(null)}
                        onDelete={handleDeleteSliderItem}
                    />
                )}

                {showChangeOrderModal && sliderTaggedOrderChangeContext && (
                    <TaggedItemsOrderModal
                        items={sliderTaggedOrderChangeContext.items}
                        orderedIds={sliderTaggedOrderChangeContext.taggedIds}
                        onApply={handleApplyTaggedOrder}
                        onClose={() => setShowChangeOrderModal(false)}
                    />
                )}
            </>
    );

    return embedded ? (
        <div className="flex flex-col h-full min-h-0 bg-white">{editorBody}</div>
    ) : (
        <GenericModal
            title={getTranslation('SLIDER_MGMT', currentLanguage)}
            onClose={onClose}
            width="w-[80vw] min-w-[80vw] max-w-[80vw]"
            noFooter={true}
            headerIcons={<TooltipMenu ComponentId={'366'} />}
        >
            {editorBody}
        </GenericModal>
    );
};
