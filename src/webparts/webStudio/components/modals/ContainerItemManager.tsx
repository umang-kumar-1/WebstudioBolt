import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore, getItemTranslation, getTranslation, getGlobalDefaultImage } from '../../store';
import { getNestedPortalZFromStore } from '../../utils/modalZIndex';
import { resolveGalleryDefaultImage } from '../../utils/defaultImageUrl';
import { translateText } from '../../services/geminiService';
import { ContainerItem, LanguageCode } from '../../types';
import { GenericModal, ConfirmDeleteDialog, EditTrigger, ItemEditorChangeOrderButton, TaggedOrderChangeContext, SortByHelpIcon } from './SharedModals';
import { MODAL_Z } from '../../utils/modalZIndex';
import JoditRichTextEditor from '../JoditEditor';
import {
    Monitor, List as ListIcon, Pencil, Trash2, X,
    Image as ImageIcon, Search, ChevronDown, ArrowDownAZ, ArrowUpAZ,
    Wand2, Upload, Copy, Check, Hash, CheckCircle, AlertTriangle, Plus
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { SharePointMetadataFooter } from '../common/SharePointMetadataFooter';
import { ItemTaggingLookupFields } from '../common/ItemTaggingLookupFields';
import TooltipMenu from '../common/TooltipMenu';
import { useValidatedField } from '../common/ValidatedTextField';
import { ActionButtonStyleEditor } from '../common/ActionButtonStyleEditor';
import { pickActionButtonStyleFields, serializeActionButtonStyleFields } from '../../utils/actionButtonStyle';
import { getOptionalEnabledLanguages, LANGUAGE_DISPLAY_NAMES } from '../../utils/siteLanguages';
import { TranslationLanguagesEmptyState } from '../common/TranslationLanguagesEmptyState';
import EditorImageTabPanel from '../common/EditorImageTabPanel';

const DUMMY_IMAGE = "";

// --- HELPERS ---
const stripHtml = (html: string) => {
    if (!html) return "";
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
};

// --- SUB-COMPONENT: CREATE MODAL ---
export const CreateContainerItemModal = ({ onSave, onCancel }: { onSave: (title: string) => void, onCancel: () => void }) => {
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
                    <h3 className="text-lg font-bold text-[var(--primary-color)]">{getTranslation('TITLE_CREATE_CONTAINER_ITEM', currentLanguage)}</h3>
                    <div className="flex items-center gap-2">
                        <TooltipMenu ComponentId={'13828'} />
                        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                    </div>
                </div>
                <form onSubmit={handleCreate} noValidate>
                <div className="p-8 space-y-4">
                    <div>
                        <label htmlFor={titleField.fieldId} className="sr-only">{getTranslation('PLACEHOLDER_ITEM_TITLE', currentLanguage)}</label>
                        <input
                            {...titleField.inputProps}
                            placeholder={getTranslation('PLACEHOLDER_ITEM_TITLE', currentLanguage)}
                            autoFocus
                        />
                        {titleField.ErrorMessage}
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3">
                    <button type="button" onClick={onCancel} className="px-6 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-bold hover:bg-gray-100 rounded-sm">
                        {getTranslation('BTN_CANCEL', currentLanguage)}
                    </button>
                    <button type="submit" className="px-6 py-2 bg-[var(--btn-primary-bg)] text-white hover:opacity-90 text-sm font-bold rounded-sm shadow-sm transition-colors">
                        {getTranslation('BTN_CREATE', currentLanguage)}
                    </button>
                </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

// --- SUB-COMPONENT: EDITOR ---
const SOURCE_LANG: LanguageCode = 'en';

export const ContainerItemEditor = ({
    item,
    containerId,
    onSave,
    onCancel,
    onDelete,
    changeOrderContext,
}: {
    item: any;
    containerId?: string;
    onSave: (item: any) => void;
    onCancel: () => void;
    onDelete?: (id: string) => void;
    changeOrderContext?: TaggedOrderChangeContext | null;
}) => {
    const { images, uploadImage, currentLanguage, pages, currentPageId, siteConfig } = useStore();
    const optionalTranslationLanguages = useMemo(
        () => getOptionalEnabledLanguages(siteConfig),
        [siteConfig?.languages]
    );
    const translationLanguage = optionalTranslationLanguages[0] ?? null;
    const translationLanguageLabel = translationLanguage
        ? (LANGUAGE_DISPLAY_NAMES[translationLanguage] ?? translationLanguage.toUpperCase())
        : '';
    const showTranslationTab = optionalTranslationLanguages.length > 0;
    const [activeTab, setActiveTab] = useState('BASIC');
    useEffect(() => {
        if (activeTab === 'TRANSLATION' && !showTranslationTab) {
            setActiveTab('BASIC');
        }
    }, [activeTab, showTranslationTab]);
    const [isTranslating, setIsTranslating] = useState(false);
    const scopedBtnConfig = (containerId && item.btnConfig && item.btnConfig[containerId]) ? item.btnConfig[containerId] : null;
    const initialActionButtonStyle = pickActionButtonStyleFields(scopedBtnConfig || item);
    const [formData, setFormData] = useState<any>({
        id: item.id || 0,
        title: getItemTranslation(item, SOURCE_LANG, 'title') || '',
        status: item.status || 'Draft',
        sortOrder: item.sortOrder || 0,
        description: getItemTranslation(item, SOURCE_LANG, 'description') || '',
        imageUrl: item.imageUrl || getGlobalDefaultImage(),
        imageName: item.imageName || '',
        btnConfig: item.btnConfig || {},
        btnEnabled: scopedBtnConfig ? scopedBtnConfig.btnEnabled : (item.btnEnabled || false),
        btnName: scopedBtnConfig ? scopedBtnConfig.btnName : (item.btnName || ''),
        btnLinkType: scopedBtnConfig ? scopedBtnConfig.btnLinkType : (item.btnLinkType || 'url'),
        btnUrl: scopedBtnConfig ? scopedBtnConfig.btnUrl : (item.btnUrl || ''),
        btnContainerId: scopedBtnConfig ? scopedBtnConfig.btnContainerId : (item.btnContainerId || ''),
        btnTargetContainerTitle: scopedBtnConfig ? scopedBtnConfig.btnTargetContainerTitle : (item.btnTargetContainerTitle || ''),
        ...initialActionButtonStyle,
        translations: item.translations || { en: { title: '', description: '', btnName: '' } },
    });

    const handleSave = () => {
        const payload = { ...formData };
        // Editable fields are always English source; keep translations.en aligned on save.
        payload.translations = {
            ...(payload.translations || {}),
            en: {
                ...(payload.translations?.en || {}),
                title: payload.title || '',
                description: payload.description || '',
                btnName: payload.btnName || ''
            }
        };
        if (containerId) {
            // Update override config
            payload.btnConfig = {
                ...(payload.btnConfig || {}),
                [containerId]: {
                    btnEnabled: formData.btnEnabled,
                    btnName: formData.btnName,
                    btnLinkType: formData.btnLinkType,
                    btnUrl: formData.btnUrl,
                    btnContainerId: formData.btnContainerId,
                    btnTargetContainerTitle: formData.btnTargetContainerTitle,
                    ...serializeActionButtonStyleFields(formData),
                }
            };
            // Restore root properties to original item values to avoid global contamination
            payload.btnEnabled = item.btnEnabled;
            payload.btnName = item.btnName;
            payload.btnLinkType = item.btnLinkType;
            payload.btnUrl = item.btnUrl;
            payload.btnContainerId = item.btnContainerId;
            payload.btnTargetContainerTitle = item.btnTargetContainerTitle;
        }
        onSave(payload);
    };

    // Update Helpers
    const updateField = (key: string, val: any) => setFormData((p: any) => ({ ...p, [key]: val }));
    const patchFormData = (patch: Record<string, unknown>) => setFormData((p: any) => ({ ...p, ...patch }));
    const updateTranslation = (lang: string, key: string, val: string) => setFormData((p: any) => ({ ...p, translations: { ...p.translations, [lang]: { ...p.translations?.[lang], [key]: val } } }));

    const allContainers = pages.flatMap(p => (p.containers || []).map(c => ({
        ...c,
        pageName: p.title[currentLanguage] || p.title.en,
        isCurrentPage: p.id === currentPageId
    })));

    const suggestTranslation = async () => {
        if (!translationLanguage) return;
        setIsTranslating(true);
        try {
            const translatedTitle = await translateText(formData.title, translationLanguage);
            const translatedDesc = await translateText(formData.description, translationLanguage);
            const translatedBtnName = formData.btnName ? await translateText(formData.btnName, translationLanguage) : '';

            if (translatedTitle || translatedDesc || translatedBtnName) {
                setFormData((p: any) => ({
                    ...p,
                    translations: {
                        ...p.translations,
                        [translationLanguage]: {
                            ...p.translations?.[translationLanguage],
                            ...(translatedTitle ? { title: translatedTitle } : {}),
                            ...(translatedDesc ? { description: translatedDesc } : {}),
                            ...(translatedBtnName ? { btnName: translatedBtnName } : {}),
                        }
                    }
                }));
            }
        } catch (error) {
            console.error("Translation Error", error);
        } finally {
            setIsTranslating(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in zoom-in-95 duration-200" style={{ zIndex: getNestedPortalZFromStore(10) }}>
            <div className="bg-white w-[1000px] shadow-2xl rounded-sm border border-gray-300 flex flex-col h-[90vh] min-h-[90vh] max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0 gap-4">
                    <h3 className="font-bold text-[var(--primary-color)] min-w-0 truncate flex-1">{getTranslation('TITLE_EDIT_CONTAINER_ITEM', currentLanguage)} - {formData.title}</h3>
                    <div className="flex items-center gap-3 shrink-0">
                        <TooltipMenu ComponentId={'13830'} />
                        <button onClick={onCancel} className="text-gray-400 hover:text-red-500"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="flex border-b border-gray-200 px-6 bg-white flex-shrink-0 gap-6">
                    {[
                        { id: 'BASIC', label: getTranslation('TAB_BASIC_INFO', currentLanguage) },
                        { id: 'IMAGE', label: getTranslation('TAB_IMAGE_INFO', currentLanguage) },
                        ...(showTranslationTab ? [{ id: 'TRANSLATION', label: getTranslation('TAB_TRANSLATION', currentLanguage) }] : []),
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
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_TITLE', currentLanguage)}</label>
                                    <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formData.title} onChange={e => updateField('title', e.target.value)} />
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
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_ORIGINAL_DESC', currentLanguage)}</label>
                                <JoditRichTextEditor
                                    value={formData.description}
                                    onChange={(newValue: any) => updateField('description', newValue)}
                                    placeholder={getTranslation('PLACEHOLDER_ITEM_DESC', currentLanguage) || "A brief description of the item."}
                                    height={200}
                                />
                            </div>

                            <ItemTaggingLookupFields itemId={String(formData.id)} listName="ContainerItems" />

                            {/* Action Button Config */}
                            <div className="bg-gray-50 border border-gray-200 rounded-sm p-3 space-y-4 mt-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">{getTranslation('LABEL_ACTION_BUTTON', currentLanguage)}</h4>
                                    <div
                                        className="flex items-center gap-2 cursor-pointer select-none"
                                        onClick={() => updateField('btnEnabled', !formData.btnEnabled)}
                                    >
                                        <span className="text-xs font-medium text-gray-500">{formData.btnEnabled ? 'Enabled' : 'Disabled'}</span>
                                        <div className={`w-10 h-6 border-2 transition-colors flex items-center justify-center ${formData.btnEnabled ? 'bg-[var(--primary-color)] border-[var(--primary-color)]' : 'bg-white border-gray-300'}`}>
                                            {formData.btnEnabled && <Check className="w-4 h-4 text-white" />}
                                        </div>
                                    </div>
                                </div>

                                {formData.btnEnabled && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {/* Button Name */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_BUTTON_NAME', currentLanguage)}</label>
                                            <input
                                                className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                                value={formData.btnName || ''}
                                                onChange={e => updateField('btnName', e.target.value)}
                                                placeholder="e.g. Read More"
                                            />
                                        </div>

                                        {/* Link Type Toggle */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_LINK_TYPE', currentLanguage)}</label>
                                            <div className="flex rounded-sm border border-gray-300 overflow-hidden">
                                                <button
                                                    type="button"
                                                    onClick={() => updateField('btnLinkType', 'url')}
                                                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${(!formData.btnLinkType || formData.btnLinkType === 'url')
                                                        ? 'bg-[var(--btn-primary-bg)] text-white'
                                                        : 'bg-white text-gray-500 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    URL / External
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => updateField('btnLinkType', 'container')}
                                                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${formData.btnLinkType === 'container'
                                                        ? 'bg-[var(--btn-primary-bg)] text-white'
                                                        : 'bg-white text-gray-500 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    Go to Container
                                                </button>
                                            </div>
                                        </div>

                                        {/* URL Input */}
                                        {(!formData.btnLinkType || formData.btnLinkType === 'url') && (
                                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_BUTTON_URL', currentLanguage)}</label>
                                                <input
                                                    className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                                    value={formData.btnUrl || ''}
                                                    onChange={e => updateField('btnUrl', e.target.value)}
                                                    placeholder={getTranslation('PLACEHOLDER_URL_GENERIC', currentLanguage)}
                                                />
                                            </div>
                                        )}

                                        {/* Container Picker */}
                                        {formData.btnLinkType === 'container' && (
                                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_SELECT_TARGET_CONTAINER', currentLanguage)}</label>
                                                {allContainers.length === 0 ? (
                                                    <div className="text-xs text-gray-400 italic p-2.5 border border-dashed border-gray-300 rounded-sm">
                                                        {getTranslation('MSG_NO_CONTAINERS_ON_SITE', currentLanguage)}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        <select
                                                            className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none bg-white"
                                                            value={formData.btnContainerId || ''}
                                                            onChange={e => {
                                                                const selected = allContainers.find(c => c.id === e.target.value);
                                                                updateField('btnContainerId', e.target.value);
                                                                if (selected && !formData.btnTargetContainerTitle) {
                                                                    updateField('btnTargetContainerTitle', selected.title || '');
                                                                }
                                                            }}
                                                        >
                                                            <option value="">— Container auswaehlen —</option>
                                                            <optgroup label="Current Page">
                                                                {allContainers.filter(c => c.isCurrentPage).map(c => (
                                                                    <option key={c.id} value={c.id}>
                                                                        {c.title || `[${c.type}]`}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                            <option value="custom">Other Container</option>
                                                        </select>

                                                        {formData.btnContainerId === 'custom' && (
                                                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_ENTER_CONTAINER_TITLE', currentLanguage)}</label>
                                                                <div className="relative">
                                                                    <input
                                                                        className={`w-full border p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none ${formData.btnTargetContainerTitle && allContainers.some(c => c.title === formData.btnTargetContainerTitle)
                                                                            ? 'border-green-500 bg-green-50'
                                                                            : formData.btnTargetContainerTitle ? 'border-amber-500 bg-amber-50' : 'border-gray-300'
                                                                            }`}
                                                                        value={formData.btnTargetContainerTitle || ''}
                                                                        onChange={e => updateField('btnTargetContainerTitle', e.target.value)}
                                                                        placeholder="Type the exact title or heading..."
                                                                    />
                                                                    {formData.btnTargetContainerTitle && (
                                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                                            {allContainers.some(c => c.title === formData.btnTargetContainerTitle) ? (
                                                                                <CheckCircle className="w-4 h-4 text-green-600" />
                                                                            ) : (
                                                                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <p className="text-[10px] mt-1 italic">
                                                                    {allContainers.some(c => c.title === formData.btnTargetContainerTitle)
                                                                        ? <span className="text-green-600 font-medium">{getTranslation('MSG_CONTAINER_MATCHED_SUCCESS', currentLanguage)}</span>
                                                                        : <span className="text-gray-400">{getTranslation('MSG_ENTER_EXACT_TITLE_MATCH', currentLanguage)}</span>
                                                                    }
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <ActionButtonStyleEditor
                                            settings={formData}
                                            onFieldChange={updateField}
                                            onMultiChange={(patch) => setFormData((p: any) => ({ ...p, ...patch }))}
                                            currentLanguage={currentLanguage}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* IMAGE INFORMATION */}
                    {activeTab === 'IMAGE' && (
                        <EditorImageTabPanel
                            uploadImage={uploadImage}
                            images={images}
                            folderId="Pictures"
                            titleForNaming={formData.title}
                            namingFallback="Container Item"
                            imageUrl={formData.imageUrl || ''}
                            imageName={formData.imageName || ''}
                            updateField={updateField}
                            patchFormData={patchFormData}
                            activeTab={activeTab}
                            currentLanguage={currentLanguage}
                            getGlobalDefaultImage={getGlobalDefaultImage}
                        />
                    )}

                    {/* TRANSLATION */}
                    {activeTab === 'TRANSLATION' && (
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            {!translationLanguage ? (
                                <TranslationLanguagesEmptyState />
                            ) : (
                            <>
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex gap-8 text-xs font-bold text-gray-500 uppercase">
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-none bg-gray-300"></span> {getTranslation('LABEL_ORIGINAL', currentLanguage)}</div>
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-none bg-blue-600"></span> {getTranslation('LABEL_TRANSLATION', currentLanguage)} ({translationLanguageLabel})</div>
                                </div>
                                <button onClick={suggestTranslation} disabled={isTranslating} className={`text-[var(--primary-color)] text-xs font-bold flex items-center gap-2 hover:underline ${isTranslating ? 'opacity-50 cursor-wait' : ''}`}>
                                    <Wand2 className={`w-3 h-3 ${isTranslating ? 'animate-pulse' : ''}`} /> {isTranslating ? getTranslation('MSG_TRANSLATING', currentLanguage) : getTranslation('BTN_SUGGEST_AI', currentLanguage)}
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                {/* Left: Original */}
                                <div className="space-y-4 opacity-70 pointer-events-none">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_TITLE', currentLanguage)}</label>
                                        <input className="w-full border border-gray-300 p-2 text-sm bg-gray-50" value={formData.title} readOnly />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_DESCRIPTION', currentLanguage)}</label>
                                        <div className="border border-gray-300 p-2 bg-gray-50 min-h-[150px]">
                                            <div className="text-sm" dangerouslySetInnerHTML={{ __html: formData.description }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_BUTTON_NAME', currentLanguage)}</label>
                                        <input className="w-full border border-gray-300 p-2 text-sm bg-gray-50" value={formData.btnName || ''} readOnly />
                                    </div>
                                </div>

                                {/* Right: Translation */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_TRANSLATED_TITLE', currentLanguage)}</label>
                                        <input
                                            className="w-full border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            placeholder={getTranslation('PLACEHOLDER_ITEM_TITLE', currentLanguage)}
                                            value={formData.translations[translationLanguage]?.title || ''}
                                            onChange={e => updateTranslation(translationLanguage, 'title', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_TRANSLATED_DESC', currentLanguage)}</label>
                                        <JoditRichTextEditor
                                            value={formData.translations[translationLanguage]?.description || ''}
                                            onChange={(newValue: any) => updateTranslation(translationLanguage, 'description', newValue)}
                                            placeholder={getTranslation('PLACEHOLDER_TRANSLATED_DESCRIPTION', currentLanguage)}
                                            height={150}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_TRANSLATED', currentLanguage)} {getTranslation('LABEL_BUTTON_NAME', currentLanguage)}</label>
                                        <input
                                            className="w-full border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            value={formData.translations[translationLanguage]?.btnName || ''}
                                            onChange={e => updateTranslation(translationLanguage, 'btnName', e.target.value)}
                                            placeholder={getTranslation('LABEL_BUTTON_NAME_PLACEHOLDER', currentLanguage)}
                                        />
                                    </div>
                                </div>
                            </div>
                            </>
                            )}
                        </div>
                    )}
                </div>

                {/* Fixed Footer with Metadata & Actions */}
                <div className="flex-shrink-0 bg-white border-t border-gray-100 px-6 py-3">
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex-1">
                            <SharePointMetadataFooter
                                listTitle="ContainerItems"
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
                            <button onClick={onCancel} className="px-8 py-2 border border-gray-300 bg-white text-gray-800 text-sm font-bold hover:bg-gray-50 transition-colors rounded-sm tracking-wide">
                                {getTranslation('BTN_CANCEL', currentLanguage)}
                            </button>
                            <button onClick={() => handleSave()} className="px-8 py-2 bg-[var(--btn-primary-bg)] text-white text-sm font-bold shadow-sm hover:opacity-90 transition-all rounded-sm capitalize tracking-wide">
                                {getTranslation('BTN_SAVE', currentLanguage)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN MANAGER ---
export const ContainerItemManager = ({ onClose }: any) => {
    const { containerItems, addContainerItem, updateContainerItem, deleteContainerItem, currentLanguage } = useStore();
    const [view, setView] = useState<'VISUAL' | 'LIST'>('VISUAL');
    const [showCreate, setShowCreate] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'sortOrder', direction: 'asc' });

    // Handle Create Init
    const handleCreateInit = async (title: string) => {
        const newItem: ContainerItem = {
            id: `ci_${Date.now()}`,
            title: title,
            status: 'Draft',
            sortOrder: containerItems.length > 0 ? Math.max(...containerItems.map(i => i.sortOrder)) + 1 : 0,
            description: '',
            imageUrl: '',
            translations: { en: { title: '', description: '' } },
        };
        const addedItem = await addContainerItem(newItem);
        setShowCreate(false);
        setEditingItem(addedItem || newItem);
    };

    const handleSaveEdit = (item: any) => {
        updateContainerItem(item);
        setEditingItem(null);
    };

    const handleDelete = (id: string) => {
        deleteContainerItem(id);
        setDeleteId(null);
        setEditingItem(null);
    };

    const allItems = [...containerItems];

    // Sort & Filter
    const sortedItems = [...allItems].sort((a, b) => {
        const valA = (a as any)[sortConfig.key];
        const valB = (b as any)[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    const filteredItems = sortedItems.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const toggleSort = () => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }));

    const customFooter = (
        <button onClick={onClose} className="px-6 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-bold hover:bg-gray-100 rounded-sm flex items-center gap-1">
            {getTranslation('BTN_CLOSE', currentLanguage)} <EditTrigger labelKey="BTN_CLOSE" size="w-3.5 h-3.5" />
        </button>
    );

    return (
        <GenericModal
            className="container-item-management-popup"
            title={getTranslation('CONTAINER_ITEM_MGMT', currentLanguage)}
            onClose={onClose}
            width="w-[80vw] min-w-[80vw] max-w-[80vw]"
            noFooter={true}
            customFooter={customFooter}
            headerIcons={
                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500 mr-2 hidden md:inline">{getTranslation('MSG_CONTAINER_ITEM_DESC', currentLanguage)} <EditTrigger labelKey="MSG_CONTAINER_ITEM_DESC" size="w-3.5 h-3.5" color="var(--primary-color)" /></span>
                    <div className="flex border border-[var(--primary-color)] rounded-sm overflow-hidden shadow-sm h-8">
                        <button onClick={() => setView('VISUAL')} className={`px-3 text-xs font-bold flex items-center gap-2 transition-colors ${view === 'VISUAL' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-blue-50'}`}><Monitor className="w-3 h-3" /> {getTranslation('LABEL_VISUAL_VIEW', currentLanguage)}</button>
                        <button onClick={() => setView('LIST')} className={`px-3 text-xs font-bold flex items-center gap-2 transition-colors ${view === 'LIST' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-blue-50'}`}><ListIcon className="w-3 h-3" /> {getTranslation('LABEL_LIST_VIEW', currentLanguage)}</button>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col h-full bg-white">
                {/* Toolbar */}
                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0 gap-4">
                    <div className="flex-1 max-w-lg relative group">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 z-10" />
                        <input
                            placeholder={getTranslation('LABEL_SEARCH_ITEMS', currentLanguage)}
                            className="border border-gray-300 py-2 pl-10 pr-9 text-sm w-full focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded-sm relative z-0"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors z-10"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span>{getTranslation('LABEL_SORT_BY', currentLanguage)}</span>
                            <SortByHelpIcon />
                            <div className="relative inline-flex shrink-0">
                                <select
                                    className="border border-gray-300 py-2 pl-3 pr-8 text-sm rounded-sm bg-white focus:ring-1 focus:ring-[var(--primary-color)] outline-none cursor-pointer w-[9.75rem] max-w-full"
                                    style={{
                                        appearance: 'none',
                                        WebkitAppearance: 'none',
                                        MozAppearance: 'none',
                                        backgroundImage: 'none',
                                    }}
                                    value={sortConfig.key}
                                    onChange={(e) => setSortConfig(prev => ({ ...prev, key: e.target.value }))}
                                >
                                    <option value="sortOrder">{getTranslation('LABEL_SORT_ORDER', currentLanguage)}</option>
                                    <option value="title">{getTranslation('LABEL_TITLE', currentLanguage)}</option>
                                </select>
                                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
                            </div>
                            <button
                                type="button"
                                onClick={toggleSort}
                                className="p-1.5 border border-gray-300 rounded-sm hover:bg-[var(--brand-light)]"
                                style={{ color: 'var(--primary-color)' }}
                                title={sortConfig.direction === 'asc' ? getTranslation('BTN_SORT_ASCENDING', currentLanguage) : getTranslation('BTN_SORT_DESCENDING', currentLanguage)}
                            >
                                {sortConfig.direction === 'asc' ? <ArrowUpAZ className="w-4 h-4" /> : <ArrowDownAZ className="w-4 h-4" />}
                            </button>
                        </div>

                        <button onClick={() => setShowCreate(true)} className="bg-[var(--btn-primary-bg)] text-white px-4 py-2 text-sm font-bold hover:opacity-90 shadow-sm rounded-sm flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            {getTranslation('BTN_ADD_ITEM', currentLanguage)}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
                    {view === 'VISUAL' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredItems.map((n: any) => (
                                <div key={n.id} className="bg-white border border-gray-200 shadow-sm hover:shadow-lg transition-all group relative flex flex-col rounded-sm overflow-hidden min-h-[140px]">
                                    <div className="flex h-full">
                                        <div className="w-32 bg-gray-100 flex items-center justify-center relative overflow-hidden border-r border-gray-100">
                                            <img
                                                src={n.imageUrl || DUMMY_IMAGE}
                                                alt={n.title}
                                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center'); }}
                                            />
                                            {(!n.imageUrl) && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <ImageIcon className="w-10 h-10 text-gray-300" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 flex-1 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{getItemTranslation(n, currentLanguage, 'title')}</h4>
                                                    <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide rounded-full inline-block ${n.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-yellow-400 text-yellow-900'}`}>{n.status}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 mb-2">
                                                    Order: {n.sortOrder}
                                                </div>
                                                <p className="text-xs text-gray-500 line-clamp-2 mb-2">{stripHtml(getItemTranslation(n, currentLanguage, 'description') || 'No description provided.')}</p>
                                            </div>

                                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setEditingItem(n)} className="p-1 hover:bg-blue-50 rounded-sm" style={{ color: 'var(--icon-color)' }}><Pencil className="w-3 h-3" /></button>
                                                <button onClick={() => setDeleteId(n.id)} className="p-1 hover:bg-red-50 hover:text-red-600 rounded-sm text-[var(--icon-color)]"><Trash2 className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-200 shadow-sm rounded-sm overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 text-gray-600 border-b border-gray-200 text-xs font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="p-4 w-20 text-center">{getTranslation('LABEL_IMAGE', currentLanguage)}</th>
                                        <th className="p-4">{getTranslation('LABEL_TITLE', currentLanguage)}</th>
                                        <th className="p-4 w-32">{getTranslation('LABEL_SORT_ORDER', currentLanguage)}</th>
                                        <th className="p-4 w-32">{getTranslation('LABEL_STATUS', currentLanguage)}</th>
                                        <th className="p-4 text-right w-32">{getTranslation('LABEL_ACTIONS', currentLanguage)}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredItems.map((n: any) => (
                                        <tr key={n.id} className="hover:bg-[var(--brand-light)] transition-colors group">
                                            <td className="p-3 text-center">
                                                <div className="w-10 h-10 bg-gray-100 rounded-sm mx-auto flex items-center justify-center overflow-hidden border border-gray-200">
                                                    <img
                                                        src={n.imageUrl || DUMMY_IMAGE}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                    />
                                                    {(!n.imageUrl) && <ImageIcon className="w-5 h-5 text-gray-300" />}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-bold text-gray-800 text-sm mb-1">{getItemTranslation(n, currentLanguage, 'title')}</div>
                                            </td>
                                            <td className="p-3 text-gray-500">
                                                {n.sortOrder}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full inline-block ${n.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-yellow-400 text-yellow-900'}`}>
                                                    {n.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setEditingItem(n)} className="p-1.5 hover:bg-blue-50 rounded-sm" style={{ color: 'var(--icon-color)' }}><Pencil className="w-4 h-4" /></button>
                                                    <button onClick={() => setDeleteId(n.id)} className="p-1.5 hover:text-red-600 hover:bg-red-50 rounded-sm text-[var(--icon-color)]"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {showCreate && <CreateContainerItemModal onSave={handleCreateInit} onCancel={() => setShowCreate(false)} />}
            {editingItem && <ContainerItemEditor item={editingItem} onSave={handleSaveEdit} onCancel={() => setEditingItem(null)} onDelete={(id: string) => setDeleteId(id)} />}
            {deleteId && (
                <ConfirmDeleteDialog
                    title={getTranslation('DIALOG_DELETE_ITEM_TITLE', currentLanguage)}
                    message={getTranslation('DIALOG_DELETE_ITEM_MESSAGE', currentLanguage)}
                    onConfirm={() => handleDelete(deleteId)}
                    onCancel={() => setDeleteId(null)}
                />
            )}
        </GenericModal>
    );
};
