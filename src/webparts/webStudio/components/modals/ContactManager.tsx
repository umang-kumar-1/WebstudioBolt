import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore, getTranslation, getItemTranslation, getGlobalDefaultImage } from '../../store';
import { getNestedPortalZFromStore } from '../../utils/modalZIndex';
import { withImageCacheBust } from '../../utils/imageCache';
import { ContactItem } from '../../types';
import { GenericModal, ConfirmDeleteDialog, OpenOOTBButton, EditTrigger, ItemEditorChangeOrderButton, TaggedOrderChangeContext, SortByHelpIcon } from './SharedModals';
import { MODAL_Z } from '../../utils/modalZIndex';
import JoditRichTextEditor from '../JoditEditor';
import { SharePointMetadataFooter } from '../common/SharePointMetadataFooter';
import { ItemTaggingLookupFields } from '../common/ItemTaggingLookupFields';
import { Search, Plus, Trash2, X, Image as ImageIcon, Monitor, List as ListIcon, Pencil, ChevronDown, ArrowUpAZ, ArrowDownAZ, CheckCircle, AlertTriangle, Wand2 } from 'lucide-react';
import TooltipMenu from '../common/TooltipMenu';
import { useValidatedField } from '../common/ValidatedTextField';
import EditorImageTabPanel from '../common/EditorImageTabPanel';
import { translateText } from '../../services/geminiService';
import { ActionButtonStyleEditor } from '../common/ActionButtonStyleEditor';
import { FontWeightSelect } from '../common/FontWeightSelect';
import { pickActionButtonStyleFields, serializeActionButtonStyleFields } from '../../utils/actionButtonStyle';
import { getOptionalEnabledLanguages, LANGUAGE_DISPLAY_NAMES } from '../../utils/siteLanguages';
import { TranslationLanguagesEmptyState } from '../common/TranslationLanguagesEmptyState';

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

// ==================== Create Contact Modal ====================
export const CreateContactModal = ({ onSave, onCancel }: { onSave: (contact: ContactItem) => void, onCancel: () => void }) => {
    const { currentLanguage } = useStore();
    const fullNameField = useValidatedField(getTranslation('MSG_REQ_TITLE', currentLanguage));
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    const handleCreate = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!fullNameField.validate()) return;

        const id = `temp_${Date.now()}`;
        const newContact: ContactItem = {
            id,
            fullName: fullNameField.value.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            status: 'Draft',
            sortOrder: 0,
            jobTitle: '',
            company: '',
            email: '',
            phone: '',
            description: '',
            imageUrl: '',
            imageName: '',
            translations: {}
        };

        onSave(newContact);
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in zoom-in-95 duration-200" style={{ zIndex: getNestedPortalZFromStore(0) }}>
            <div className="bg-white w-[500px] h-[400px] min-h-[400px] max-h-[400px] shadow-2xl rounded-sm border border-gray-300 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-white">
                    <h3 className="text-lg font-bold text-[var(--primary-color)]">{getTranslation('TITLE_CREATE_CONTACT', currentLanguage)}</h3>
                    <div className="flex items-center gap-4">
                        <TooltipMenu ComponentId={'654'} />
                        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleCreate} noValidate className="flex flex-col flex-1 overflow-hidden">
                {/* Body */}
                <div className="p-8 space-y-4 overflow-y-auto">
                    <div>
                        <label htmlFor={fullNameField.fieldId} className="block text-xs font-bold text-gray-500 uppercase mb-2">
                            {getTranslation('LABEL_TITLE', currentLanguage)} <span className="text-red-500" aria-hidden="true">*</span>
                        </label>
                        <input
                            {...fullNameField.inputProps}
                            type="text"
                            placeholder={getTranslation('PLACEHOLDER_CONTACT_NAME', currentLanguage)}
                        />
                        {fullNameField.ErrorMessage}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                {getTranslation('LABEL_FIRST_NAME', currentLanguage)}
                                <EditTrigger labelKey="LABEL_FIRST_NAME" className="ml-2" />
                            </label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder={getTranslation('PLACEHOLDER_FIRST_NAME', currentLanguage)}
                                className="w-full border border-gray-300 p-3 text-sm outline-none rounded-sm transition-shadow focus:border-[var(--primary-color)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                {getTranslation('LABEL_LAST_NAME', currentLanguage)}
                                <EditTrigger labelKey="LABEL_LAST_NAME" className="ml-2" />
                            </label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder={getTranslation('PLACEHOLDER_LAST_NAME', currentLanguage)}
                                className="w-full border border-gray-300 p-3 text-sm outline-none rounded-sm transition-shadow focus:border-[var(--primary-color)]"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-bold hover:bg-gray-100 rounded-sm"
                    >
                        {getTranslation('BTN_CANCEL', currentLanguage)}
                    </button>
                    <button
                        type="submit"
                        className="px-6 py-2 bg-[var(--btn-primary-bg)] text-white hover:opacity-90 text-sm font-bold rounded-sm shadow-sm transition-colors"
                    >
                        {getTranslation('BTN_CREATE', currentLanguage)}
                    </button>
                </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

const DUMMY_IMAGE = "";

const stripHtml = (html: string) => {
    if (!html) return "";
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
};


// ==================== Contact Editor ====================
export const ContactEditor = ({
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
    const { images, uploadImage, currentLanguage, pages, currentPageId, updateContainer, siteConfig } = useStore();
    const optionalTranslationLanguages = useMemo(
        () => getOptionalEnabledLanguages(siteConfig),
        [siteConfig?.languages]
    );
    const translationLanguage = optionalTranslationLanguages[0] ?? null;
    const translationLanguageLabel = translationLanguage
        ? (LANGUAGE_DISPLAY_NAMES[translationLanguage] ?? translationLanguage.toUpperCase())
        : '';
    const showTranslationTab = optionalTranslationLanguages.length > 0;
    const scopedContainer = containerId
        ? pages.flatMap(p => p.containers || []).find(c => String(c.id) === String(containerId))
        : undefined;
    const scopedTypography = scopedContainer?.settings || {};
    const [isTranslating, setIsTranslating] = useState(false);
    const [activeTab, setActiveTab] = useState('BASIC');
    useEffect(() => {
        if (activeTab === 'TRANSLATION' && !showTranslationTab) {
            setActiveTab('BASIC');
        }
    }, [activeTab, showTranslationTab]);
    const scopedBtnConfig = (containerId && item.btnConfig && item.btnConfig[containerId]) ? item.btnConfig[containerId] : null;
    const initialActionButtonStyle = pickActionButtonStyleFields(scopedBtnConfig || item);
    const [formData, setFormData] = useState<any>({
        id: item.id || 0,
        fullName: item.fullName || '',
        firstName: item.firstName || '',
        lastName: item.lastName || '',
        status: item.status || 'Draft',
        sortOrder: item.sortOrder || 0,
        jobTitle: item.jobTitle || '',
        company: item.company || '',
        email: item.email || '',
        phone: item.phone || '',
        description: item.description || '',
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
        fullNameFontSize: scopedTypography.fullNameFontSize || item.fullNameFontSize || '',
        fullNameFontWeight: scopedTypography.fullNameFontWeight || item.fullNameFontWeight || '',
        fullNameLineHeight: scopedTypography.fullNameLineHeight || item.fullNameLineHeight || '',
        fullNameColor: scopedTypography.fullNameColor || item.fullNameColor || '',
        jobTitleFontSize: scopedTypography.jobTitleFontSize || item.jobTitleFontSize || '',
        jobTitleFontWeight: scopedTypography.jobTitleFontWeight || item.jobTitleFontWeight || '',
        jobTitleLineHeight: scopedTypography.jobTitleLineHeight || item.jobTitleLineHeight || '',
        jobTitleColor: scopedTypography.jobTitleColor || item.jobTitleColor || '',
        translations: item.translations || { en: { fullName: '', firstName: '', lastName: '', jobTitle: '', description: '', btnName: '' } },
    });
    useEffect(() => {
        if (item && item.id && !String(item.id).startsWith('temp_')) {
            const nextScopedBtnConfig = (containerId && item.btnConfig && item.btnConfig[containerId]) ? item.btnConfig[containerId] : null;
            const nextActionButtonStyle = pickActionButtonStyleFields(nextScopedBtnConfig || item);
            setFormData((p: any) => ({
                ...p,
                ...item,
                id: item.id,
                btnEnabled: nextScopedBtnConfig ? nextScopedBtnConfig.btnEnabled : (item.btnEnabled || false),
                btnName: nextScopedBtnConfig ? nextScopedBtnConfig.btnName : (item.btnName || ''),
                btnLinkType: nextScopedBtnConfig ? nextScopedBtnConfig.btnLinkType : (item.btnLinkType || 'url'),
                btnUrl: nextScopedBtnConfig ? nextScopedBtnConfig.btnUrl : (item.btnUrl || ''),
                btnContainerId: nextScopedBtnConfig ? nextScopedBtnConfig.btnContainerId : (item.btnContainerId || ''),
                btnTargetContainerTitle: nextScopedBtnConfig ? nextScopedBtnConfig.btnTargetContainerTitle : (item.btnTargetContainerTitle || ''),
                ...nextActionButtonStyle,
                // Keep typography values sourced from current container settings.
                fullNameFontSize: scopedTypography.fullNameFontSize || item.fullNameFontSize || '',
                fullNameFontWeight: scopedTypography.fullNameFontWeight || item.fullNameFontWeight || '',
                fullNameLineHeight: scopedTypography.fullNameLineHeight || item.fullNameLineHeight || '',
                fullNameColor: scopedTypography.fullNameColor || item.fullNameColor || '',
                jobTitleFontSize: scopedTypography.jobTitleFontSize || item.jobTitleFontSize || '',
                jobTitleFontWeight: scopedTypography.jobTitleFontWeight || item.jobTitleFontWeight || '',
                jobTitleLineHeight: scopedTypography.jobTitleLineHeight || item.jobTitleLineHeight || '',
                jobTitleColor: scopedTypography.jobTitleColor || item.jobTitleColor || ''
            }));
        }
    }, [item, scopedTypography, containerId]);


    const updateField = (key: string, val: any) => setFormData((p: any) => ({ ...p, [key]: val }));
    const patchFormData = (patch: Record<string, unknown>) => setFormData((p: any) => ({ ...p, ...patch }));
    const updateUebersetzung = (lang: string, key: string, val: string) => setFormData((p: any) => ({
        ...p,
        translations: {
            ...(p.translations || {}),
            [lang]: {
                ...(p.translations?.[lang] || {}),
                [key]: val
            }
        }
    }));

    const suggestUebersetzung = async () => {
        if (isTranslating || !translationLanguage) return;

        setIsTranslating(true);
        try {
            const [fullName, firstName, lastName, company, jobTitle, description, btnName] = await Promise.all([
                formData.fullName ? translateText(formData.fullName, translationLanguage) : '',
                formData.firstName ? translateText(formData.firstName, translationLanguage) : '',
                formData.lastName ? translateText(formData.lastName, translationLanguage) : '',
                formData.company ? translateText(formData.company, translationLanguage) : '',
                formData.jobTitle ? translateText(formData.jobTitle, translationLanguage) : '',
                formData.description ? translateText(formData.description, translationLanguage) : '',
                formData.btnName ? translateText(formData.btnName, translationLanguage) : ''
            ]);

            setFormData((p: any) => ({
                ...p,
                translations: {
                    ...(p.translations || {}),
                    [translationLanguage]: {
                        ...(p.translations?.[translationLanguage] || {}),
                        ...(fullName ? { fullName } : {}),
                        ...(firstName ? { firstName } : {}),
                        ...(lastName ? { lastName } : {}),
                        ...(company ? { company } : {}),
                        ...(jobTitle ? { jobTitle } : {}),
                        ...(description ? { description } : {}),
                        ...(btnName ? { btnName } : {})
                    }
                }
            }));
        } catch (error) {
            console.error('AI contact translation failed:', error);
        } finally {
            setIsTranslating(false);
        }
    };

    const allContainers = pages.flatMap(p => (p.containers || []).map(c => ({
        ...c,
        pageName: p.title[currentLanguage] || p.title.en,
        isCurrentPage: p.id === currentPageId
    })));

    const handleSave = () => {
        const payload = { ...formData };
        if (containerId && scopedContainer) {
            // Section-level typography: apply to all contact cards in this container.
            updateContainer(
                scopedContainer.pageId || currentPageId,
                {
                    ...scopedContainer,
                    settings: {
                        ...scopedContainer.settings,
                        fullNameFontSize: formData.fullNameFontSize || '',
                        fullNameFontWeight: formData.fullNameFontWeight || '',
                        fullNameLineHeight: formData.fullNameLineHeight || '',
                        fullNameColor: formData.fullNameColor || '',
                        jobTitleFontSize: formData.jobTitleFontSize || '',
                        jobTitleFontWeight: formData.jobTitleFontWeight || '',
                        jobTitleLineHeight: formData.jobTitleLineHeight || '',
                        jobTitleColor: formData.jobTitleColor || ''
                    }
                }
            );
        }
        const actionButtonStyleFields = serializeActionButtonStyleFields(formData);
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
                    ...actionButtonStyleFields,
                }
            };
            // Restore root properties to original item values to avoid global contamination
            payload.btnEnabled = item.btnEnabled;
            payload.btnName = item.btnName;
            payload.btnLinkType = item.btnLinkType;
            payload.btnUrl = item.btnUrl;
            payload.btnContainerId = item.btnContainerId;
            payload.btnTargetContainerTitle = item.btnTargetContainerTitle;
        } else {
            Object.assign(payload, actionButtonStyleFields);
        }
        onSave(payload);
    };



    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in zoom-in-95 duration-200" style={{ zIndex: getNestedPortalZFromStore(10) }}>
            <div className="bg-white w-[80vw] min-w-[80vw] max-w-[80vw] shadow-2xl rounded-sm border border-gray-300 flex flex-col h-[90vh] min-h-[90vh] max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0 gap-4">
                    <h3 className="font-bold text-[var(--primary-color)] min-w-0 truncate flex-1">
                        {getTranslation('TITLE_EDIT_CONTACT', currentLanguage)} - {formData.fullName}
                        <EditTrigger labelKey="TITLE_EDIT_CONTACT" className="ml-2" />
                    </h3>
                    <div className="flex items-center gap-3 shrink-0">
                        <TooltipMenu ComponentId={'618'} />
                        <button onClick={onCancel} className="text-gray-400 hover:text-red-500"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-6 bg-white flex-shrink-0 gap-6">
                    {[
                        { id: 'BASIC', label: getTranslation('TAB_BASIC_INFO', currentLanguage) },
                        { id: 'SETTINGS', label: getTranslation('LABEL_SETTINGS', currentLanguage) },
                        ...(showTranslationTab ? [{ id: 'TRANSLATION', label: getTranslation('TAB_TRANSLATION', currentLanguage) }] : []),
                        { id: 'IMAGE', label: getTranslation('TAB_IMAGE_INFO', currentLanguage) }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === tab.id ? 'border-[var(--primary-color)] text-[var(--primary-color)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="p-8 overflow-y-auto flex-1 bg-gray-50/50">
                    {/* BASIC INFORMATION */}
                    {activeTab === 'BASIC' && (
                        <div className="space-y-6">
                            <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                            {getTranslation('LABEL_FIRST_NAME', currentLanguage)}
                                            <EditTrigger labelKey="LABEL_FIRST_NAME" className="ml-2" />
                                        </label>
                                        <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formData.firstName} onChange={e => updateField('firstName', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                            {getTranslation('LABEL_LAST_NAME', currentLanguage)}
                                            <EditTrigger labelKey="LABEL_LAST_NAME" className="ml-2" />
                                        </label>
                                        <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formData.lastName} onChange={e => updateField('lastName', e.target.value)} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                            {getTranslation('LABEL_FULL_NAME', currentLanguage)}
                                            <EditTrigger labelKey="LABEL_FULL_NAME" className="ml-2" />
                                        </label>
                                        <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formData.fullName} onChange={e => updateField('fullName', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                            {getTranslation('LABEL_COMPANY', currentLanguage)}
                                            <EditTrigger labelKey="LABEL_COMPANY" className="ml-2" />
                                        </label>
                                        <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formData.company} onChange={e => updateField('company', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                            {getTranslation('LABEL_JOB_TITLE', currentLanguage)}
                                            <EditTrigger labelKey="LABEL_JOB_TITLE" className="ml-2" />
                                        </label>
                                        <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formData.jobTitle} onChange={e => updateField('jobTitle', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                            {getTranslation('LABEL_EMAIL', currentLanguage)}
                                            <EditTrigger labelKey="LABEL_EMAIL" className="ml-2" />
                                        </label>
                                        <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" type="email" value={formData.email} onChange={e => updateField('email', e.target.value)} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                            {getTranslation('LABEL_SORT_ORDER', currentLanguage)}
                                            <EditTrigger labelKey="LABEL_SORT_ORDER" className="ml-2" />
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input className="w-32 border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none shrink-0" type="number" value={formData.sortOrder} onChange={e => updateField('sortOrder', parseInt(e.target.value) || 0)} />
                                            <ItemEditorChangeOrderButton
                                                context={changeOrderContext}
                                                activeItemId={formData.id}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_DESCRIPTION', currentLanguage)}</label>
                                    <div className="border border-gray-300 rounded-sm overflow-hidden">
                                        <JoditRichTextEditor
                                            value={formData.description}
                                            onChange={(newValue: any) => updateField('description', newValue)}
                                            height={300}
                                        />
                                    </div>
                                </div>

                                <ItemTaggingLookupFields itemId={String(formData.id)} listName="Contacts" />

                                {/* Action Button Config */}
                                <div className="bg-gray-50 border border-gray-200 rounded-sm p-5 space-y-4 mt-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">
                                            {getTranslation('LABEL_ACTION_BUTTON', currentLanguage)}
                                            <EditTrigger labelKey="LABEL_ACTION_BUTTON" className="ml-2" />
                                        </h4>
                                        <div
                                            className="flex items-center gap-2 cursor-pointer select-none"
                                            onClick={() => updateField('btnEnabled', !formData.btnEnabled)}
                                        >
                                            <span className="text-xs font-medium text-gray-500">{formData.btnEnabled ? getTranslation('LABEL_ENABLED', currentLanguage) : getTranslation('LABEL_DISABLED', currentLanguage)}</span>
                                            <div className={`w-9 h-5 rounded-full relative transition-colors ${formData.btnEnabled ? 'bg-[var(--primary-color)]' : 'bg-gray-300'}`}>
                                                <div
                                                    className="w-4 h-4 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform"
                                                    style={{ left: formData.btnEnabled ? '18px' : '2px' }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {formData.btnEnabled && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                            {/* Button Name */}
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                    {getTranslation('LABEL_BUTTON_NAME', currentLanguage)}
                                                    <EditTrigger labelKey="LABEL_BUTTON_NAME" className="ml-2" />
                                                </label>
                                                <input
                                                    className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                                    value={formData.btnName || ''}
                                                    onChange={e => updateField('btnName', e.target.value)}
                                                    placeholder={getTranslation('LABEL_BUTTON_NAME', currentLanguage)}
                                                />
                                            </div>

                                            {/* Link Type Toggle */}
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                                    {getTranslation('LABEL_LINK_TYPE', currentLanguage)}
                                                    <EditTrigger labelKey="LABEL_LINK_TYPE" className="ml-2" />
                                                </label>
                                                <div className="flex rounded-sm border border-gray-300 overflow-hidden">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateField('btnLinkType', 'url')}
                                                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${(!formData.btnLinkType || formData.btnLinkType === 'url')
                                                            ? 'bg-[var(--btn-primary-bg)] text-white'
                                                            : 'bg-white text-gray-500 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {getTranslation('LABEL_EXTERNAL_URL', currentLanguage)}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateField('btnLinkType', 'container')}
                                                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${formData.btnLinkType === 'container'
                                                            ? 'bg-[var(--btn-primary-bg)] text-white'
                                                            : 'bg-white text-gray-500 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {getTranslation('LABEL_GO_TO_CONTAINER', currentLanguage)}
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
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                        {getTranslation('LABEL_SELECT_TARGET_CONTAINER', currentLanguage)}
                                                        <EditTrigger labelKey="LABEL_SELECT_TARGET_CONTAINER" className="ml-2" />
                                                    </label>
                                                    {allContainers.length === 0 ? (
                                                        <div className="text-xs text-gray-400 italic p-2.5 border border-dashed border-gray-300 rounded-sm">
                                                            {getTranslation('MSG_NO_CONTAINERS', currentLanguage)}
                                                            <EditTrigger labelKey="MSG_NO_CONTAINERS" className="ml-2" />
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
                                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                                        {getTranslation('LABEL_ENTER_CONTAINER_TITLE', currentLanguage)}
                                                                        <EditTrigger labelKey="LABEL_ENTER_CONTAINER_TITLE" className="ml-2" />
                                                                    </label>
                                                                    <div className="relative">
                                                                        <input
                                                                            className={`w-full border p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none ${formData.btnTargetContainerTitle && allContainers.some(c => c.title === formData.btnTargetContainerTitle)
                                                                                ? 'border-green-500 bg-green-50'
                                                                                : formData.btnTargetContainerTitle ? 'border-amber-500 bg-amber-50' : 'border-gray-300'
                                                                                }`}
                                                                            value={formData.btnTargetContainerTitle || ''}
                                                                            onChange={e => updateField('btnTargetContainerTitle', e.target.value)}
                                                                            placeholder={getTranslation('LABEL_ENTER_CONTAINER_TITLE', currentLanguage)}
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
                                                                            ? <span className="text-green-600 font-medium">✓ {getTranslation('MSG_CONTAINER_MATCHED', currentLanguage)} <EditTrigger labelKey="MSG_CONTAINER_MATCHED" size="w-3 h-3" /></span>
                                                                            : <span className="text-gray-400">{getTranslation('MSG_MAP_EXACT_TITLE', currentLanguage)} <EditTrigger labelKey="MSG_MAP_EXACT_TITLE" size="w-3 h-3" /></span>
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



                        </div>
                    )}

                    {/* TYPOGRAPHY SETTINGS */}
                    {activeTab === 'SETTINGS' && (
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm space-y-6">
                            <h4 className="font-bold text-gray-800 border-b pb-2 text-xs uppercase tracking-wider">{getTranslation('LABEL_TYPOGRAPHY_OPTIONS', currentLanguage)}</h4>

                            <div className="grid grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_FULL_NAME_FONT_SIZE', currentLanguage)}</label>
                                    <div className="flex items-center border border-gray-300 rounded-sm overflow-hidden">
                                        <input type="number" min={8} max={120} className="flex-1 p-2.5 text-sm outline-none" value={formData.fullNameFontSize || ''} onChange={e => updateField('fullNameFontSize', e.target.value ? Number(e.target.value) : '')} />
                                        <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l h-full flex items-center">px</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_FULL_NAME_FONT_WEIGHT', currentLanguage)}</label>
                                    <FontWeightSelect
                                        value={formData.fullNameFontWeight}
                                        defaultValue="700"
                                        currentLanguage={currentLanguage}
                                        className="w-full border border-gray-300 p-2.5 text-sm rounded-sm outline-none"
                                        includeEmptyOption
                                        emptyOptionLabel="—"
                                        onChange={(value) => updateField('fullNameFontWeight', value ? Number(value) : '')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_FULL_NAME_LINE_HEIGHT', currentLanguage)}</label>
                                    <div className="flex items-center border border-gray-300 rounded-sm overflow-hidden">
                                        <input type="number" min={8} max={200} className="flex-1 p-2.5 text-sm outline-none" value={formData.fullNameLineHeight || ''} onChange={e => updateField('fullNameLineHeight', e.target.value ? Number(e.target.value) : '')} />
                                        <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l h-full flex items-center">px</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_FULL_NAME_COLOR', currentLanguage)}</label>
                                    <ColorPicker value={formData.fullNameColor || '#223f70'} onChange={(v) => updateField('fullNameColor', v)} />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_JOB_TITLE_FONT_SIZE', currentLanguage)}</label>
                                    <div className="flex items-center border border-gray-300 rounded-sm overflow-hidden">
                                        <input type="number" min={8} max={120} className="flex-1 p-2.5 text-sm outline-none" value={formData.jobTitleFontSize || ''} onChange={e => updateField('jobTitleFontSize', e.target.value ? Number(e.target.value) : '')} />
                                        <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l h-full flex items-center">px</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_JOB_TITLE_FONT_WEIGHT', currentLanguage)}</label>
                                    <FontWeightSelect
                                        value={formData.jobTitleFontWeight}
                                        defaultValue="400"
                                        currentLanguage={currentLanguage}
                                        className="w-full border border-gray-300 p-2.5 text-sm rounded-sm outline-none"
                                        includeEmptyOption
                                        emptyOptionLabel="—"
                                        onChange={(value) => updateField('jobTitleFontWeight', value ? Number(value) : '')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_JOB_TITLE_LINE_HEIGHT', currentLanguage)}</label>
                                    <div className="flex items-center border border-gray-300 rounded-sm overflow-hidden">
                                        <input type="number" min={8} max={200} className="flex-1 p-2.5 text-sm outline-none" value={formData.jobTitleLineHeight || ''} onChange={e => updateField('jobTitleLineHeight', e.target.value ? Number(e.target.value) : '')} />
                                        <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l h-full flex items-center">px</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_JOB_TITLE_COLOR', currentLanguage)}</label>
                                    <ColorPicker value={formData.jobTitleColor || '#6b7280'} onChange={(v) => updateField('jobTitleColor', v)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TRANSLATION */}
                    {activeTab === 'TRANSLATION' && (
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            {!translationLanguage ? (
                                <TranslationLanguagesEmptyState />
                            ) : (
                            <>
                            <div className="flex justify-end items-center mb-6">
                                <button
                                    onClick={suggestUebersetzung}
                                    disabled={isTranslating}
                                    className={`text-[var(--primary-color)] text-xs font-bold flex items-center gap-2 hover:underline ${isTranslating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Wand2 className={`w-3 h-3 ${isTranslating ? 'animate-pulse' : ''}`} />
                                    {isTranslating ? getTranslation('MSG_TRANSLATING', currentLanguage) : getTranslation('BTN_SUGGEST_AI', currentLanguage)}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-12">
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{getTranslation('LABEL_FULL_NAME', currentLanguage)}</label>
                                        <div className="p-3 border border-gray-100 bg-gray-50/50 rounded-sm text-sm text-gray-600 min-h-[42px] flex items-center">
                                            {formData.fullName || <span className="text-gray-300 italic">{getTranslation('MSG_NO_TITLE', currentLanguage)}</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{getTranslation('LABEL_FIRST_NAME', currentLanguage)}</label>
                                        <div className="p-3 border border-gray-100 bg-gray-50/50 rounded-sm text-sm text-gray-600 min-h-[42px] flex items-center">
                                            {formData.firstName || <span className="text-gray-300 italic">-</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{getTranslation('LABEL_LAST_NAME', currentLanguage)}</label>
                                        <div className="p-3 border border-gray-100 bg-gray-50/50 rounded-sm text-sm text-gray-600 min-h-[42px] flex items-center">
                                            {formData.lastName || <span className="text-gray-300 italic">-</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{getTranslation('LABEL_COMPANY', currentLanguage)}</label>
                                        <div className="p-3 border border-gray-100 bg-gray-50/50 rounded-sm text-sm text-gray-600 min-h-[42px] flex items-center">
                                            {formData.company || <span className="text-gray-300 italic">-</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{getTranslation('LABEL_JOB_TITLE', currentLanguage)}</label>
                                        <div className="p-3 border border-gray-100 bg-gray-50/50 rounded-sm text-sm text-gray-600 min-h-[42px] flex items-center">
                                            {formData.jobTitle || <span className="text-gray-300 italic">-</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{getTranslation('LABEL_DESCRIPTION', currentLanguage)}</label>
                                        <div className="p-4 border border-gray-100 bg-gray-50/50 rounded-sm text-sm text-gray-600 min-h-[200px] prose prose-sm max-w-none shadow-inner" dangerouslySetInnerHTML={{ __html: formData.description || '<span class="text-gray-300 italic">-</span>' }} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{getTranslation('LABEL_BUTTON_NAME', currentLanguage)}</label>
                                        <div className="p-3 border border-gray-100 bg-gray-50/50 rounded-sm text-sm text-gray-600 min-h-[42px] flex items-center">
                                            {formData.btnName || <span className="text-gray-300 italic">-</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-2">{getTranslation('LABEL_FULL_NAME', currentLanguage)} ({translationLanguageLabel})</label>
                                        <input
                                            className="w-full border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none rounded-sm transition-all"
                                            value={formData.translations?.[translationLanguage]?.fullName || ''}
                                            onChange={e => updateUebersetzung(translationLanguage, 'fullName', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-2">{getTranslation('LABEL_FIRST_NAME', currentLanguage)} ({translationLanguageLabel})</label>
                                        <input
                                            className="w-full border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none rounded-sm transition-all"
                                            value={formData.translations?.[translationLanguage]?.firstName || ''}
                                            onChange={e => updateUebersetzung(translationLanguage, 'firstName', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-2">{getTranslation('LABEL_LAST_NAME', currentLanguage)} ({translationLanguageLabel})</label>
                                        <input
                                            className="w-full border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none rounded-sm transition-all"
                                            value={formData.translations?.[translationLanguage]?.lastName || ''}
                                            onChange={e => updateUebersetzung(translationLanguage, 'lastName', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-2">{getTranslation('LABEL_COMPANY', currentLanguage)} ({translationLanguageLabel})</label>
                                        <input
                                            className="w-full border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none rounded-sm transition-all"
                                            value={formData.translations?.[translationLanguage]?.company || ''}
                                            onChange={e => updateUebersetzung(translationLanguage, 'company', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-2">{getTranslation('LABEL_JOB_TITLE', currentLanguage)} ({translationLanguageLabel})</label>
                                        <input
                                            className="w-full border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none rounded-sm transition-all"
                                            value={formData.translations?.[translationLanguage]?.jobTitle || ''}
                                            onChange={e => updateUebersetzung(translationLanguage, 'jobTitle', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-2">{getTranslation('LABEL_DESCRIPTION', currentLanguage)} ({translationLanguageLabel})</label>
                                        <JoditRichTextEditor
                                            value={formData.translations?.[translationLanguage]?.description || ''}
                                            onChange={(newValue: any) => updateUebersetzung(translationLanguage, 'description', newValue)}
                                            height={200}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-2">{getTranslation('LABEL_BUTTON_NAME', currentLanguage)} ({translationLanguageLabel})</label>
                                        <input
                                            className="w-full border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none rounded-sm transition-all"
                                            value={formData.translations?.[translationLanguage]?.btnName || ''}
                                            onChange={e => updateUebersetzung(translationLanguage, 'btnName', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            </>
                            )}
                        </div>
                    )}

                    {activeTab === 'IMAGE' && (
                        <EditorImageTabPanel
                            uploadImage={uploadImage}
                            images={images}
                            folderId="Contacts"
                            titleForNaming={formData.fullName}
                            namingFallback="Contact"
                            imageUrl={formData.imageUrl || ''}
                            imageName={formData.imageName || ''}
                            updateField={updateField}
                            patchFormData={patchFormData}
                            activeTab={activeTab}
                            currentLanguage={currentLanguage}
                            getGlobalDefaultImage={getGlobalDefaultImage}
                            preserveExistingImageName
                            metadata={{ Title: formData.fullName || 'Contact' }}
                        />
                    )}

                </div>

                {/* Fixed Footer with Metadata & Actions */}
                <div className="flex-shrink-0 bg-white border-t border-gray-100 px-6 py-3">
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex-1">
                            <SharePointMetadataFooter
                                listTitle="Contacts"
                                itemId={formData.id}
                                itemTitle={formData.fullName || formData.title}
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
                            <button
                                onClick={onCancel}
                                className="px-8 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-bold hover:bg-gray-100 rounded-sm tracking-wide transition-colors"
                            >
                                {getTranslation('BTN_CANCEL', currentLanguage)}
                            </button>
                            <button onClick={() => handleSave()} className="px-8 py-2 bg-[var(--btn-primary-bg)] text-white text-sm font-bold shadow-sm hover:opacity-90 transition-all rounded-sm capitalize tracking-wide">
                                {getTranslation('BTN_SAVE', currentLanguage)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// ==================== Contact Manager ====================
export const ContactManager = ({ onClose }: { onClose: () => void }) => {
    const { contacts, addContact, updateContact, deleteContact, currentLanguage } = useStore();
    const [view, setView] = useState<'VISUAL' | 'LIST'>('VISUAL');
    const [showCreate, setShowCreate] = useState(false);
    const [editingItem, setEditingItem] = useState<ContactItem | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ContactItem, direction: 'asc' | 'desc' }>({ key: 'fullName', direction: 'asc' });

    const handleCreateInit = async (contact: ContactItem) => {
        await addContact(contact);
        setShowCreate(false);
    };

    const handleSaveEdit = (item: ContactItem) => {
        updateContact(item);
        setEditingItem(null);
    };

    const handleDelete = () => {
        if (deleteId) {
            deleteContact(deleteId);
            setDeleteId(null);
            setEditingItem(null);
        }
    };

    const toggleSort = () => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }));

    const sortedContacts = [...contacts].sort((a, b) => {
        const valA = a[sortConfig.key] || '';
        const valB = b[sortConfig.key] || '';
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const filteredContacts = sortedContacts.filter(c =>
        c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.jobTitle && c.jobTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.company && c.company.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const customFooter = (
        <div className="flex justify-between w-full items-center">
            <OpenOOTBButton listTitle="Contacts" />
            <button onClick={onClose} className="px-6 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-bold hover:bg-gray-100 rounded-sm flex items-center gap-1">
                {getTranslation('BTN_CLOSE', currentLanguage)} <EditTrigger labelKey="BTN_CLOSE" size="w-3.5 h-3.5" />
            </button>
        </div>
    );

    return (
        <GenericModal
            title={getTranslation('CONTACT_MGMT', currentLanguage)}
            onClose={onClose}
            width="w-[80vw] min-w-[80vw] max-w-[80vw]"
            noFooter={true}
            customFooter={customFooter}
            headerIcons={
                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500 mr-2 hidden md:inline">{getTranslation('MSG_CONTACT_DESC', currentLanguage)} <EditTrigger labelKey="MSG_CONTACT_DESC" size="w-3.5 h-3.5" color="var(--primary-color)" /></span>
                    <div className="flex border border-[var(--primary-color)] rounded-sm overflow-hidden shadow-sm h-8">
                        <button onClick={() => setView('VISUAL')} className={`px-3 text-xs font-bold flex items-center gap-2 transition-colors ${view === 'VISUAL' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-blue-50'}`}><Monitor className="w-3 h-3" /> {getTranslation('LABEL_VISUAL_VIEW', currentLanguage)}</button>
                        <button onClick={() => setView('LIST')} className={`px-3 text-xs font-bold flex items-center gap-2 transition-colors ${view === 'LIST' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-blue-50'}`}><ListIcon className="w-3 h-3" /> {getTranslation('LABEL_LIST_VIEW', currentLanguage)}</button>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col h-[600px] bg-white">
                {/* Toolbar */}
                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0 gap-4">
                    <div className="flex-1 max-w-lg relative group">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 z-10" />
                        <input
                            placeholder={getTranslation('LABEL_SEARCH_CONTACTS', currentLanguage)}
                            className="border border-gray-300 p-2.5 pl-10 pr-9 text-sm w-full focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded-sm relative z-0"
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
                                    onChange={(e) => setSortConfig(prev => ({ ...prev, key: e.target.value as keyof ContactItem }))}
                                >
                                    <option value="fullName">{getTranslation('LABEL_FULL_NAME', currentLanguage)}</option>
                                    <option value="jobTitle">{getTranslation('LABEL_JOB_TITLE', currentLanguage)}</option>
                                    <option value="status">{getTranslation('LABEL_STATUS', currentLanguage)}</option>
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
                            {getTranslation('BTN_ADD_CONTACT', currentLanguage)}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
                    {filteredContacts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                            <Plus className="w-12 h-12 opacity-20" />
                            <p className="font-bold">{searchQuery ? getTranslation('MSG_NO_CONTACTS_MATCH', currentLanguage) : getTranslation('MSG_NO_CONTACTS_YET', currentLanguage)}</p>
                            <p className="text-sm">
                                {getTranslation('MSG_CONTACT_DESC', currentLanguage)}
                                <EditTrigger labelKey="MSG_CONTACT_DESC" size="w-3.5 h-3.5" className="ml-2" />
                            </p>
                        </div>
                    ) : view === 'VISUAL' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredContacts.map(contact => (
                                <div
                                    key={contact.id}
                                    className="bg-white border border-gray-200 shadow-sm hover:shadow-lg transition-all group relative flex flex-col rounded-sm overflow-hidden min-h-[140px]"
                                    onClick={() => setEditingItem(contact)}
                                >
                                    <div className="flex h-full cursor-pointer">
                                        <div className="w-32 bg-gray-100 flex items-center justify-center relative overflow-hidden border-r border-gray-100">
                                            <img
                                                key={withImageCacheBust(contact.imageUrl, contact.imageCacheToken || contact.modifiedDate || contact.id)}
                                                src={withImageCacheBust(contact.imageUrl, contact.imageCacheToken || contact.modifiedDate || contact.id) || DUMMY_IMAGE}
                                                alt={contact.fullName}
                                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('bg-gray-200'); }}
                                            />
                                            {(!contact.imageUrl) && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <ImageIcon className="w-10 h-10 text-gray-300" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 flex-1 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{getItemTranslation(contact, currentLanguage, 'fullName')}</h4>
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${contact.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-yellow-400 text-yellow-900'}`}>
                                                        {contact.status === 'Published'
                                                            ? getTranslation('STATUS_PUBLISHED', currentLanguage)
                                                            : getTranslation('STATUS_DRAFT', currentLanguage)}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-bold text-[var(--primary-color)] mb-1 line-clamp-1">{getItemTranslation(contact, currentLanguage, 'jobTitle')}</p>
                                                <p className="text-xs text-gray-500 line-clamp-2 mb-2">{stripHtml(getItemTranslation(contact, currentLanguage, 'description') || 'No description provided.')}</p>
                                            </div>
                                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); setEditingItem(contact); }} className="p-1 hover:bg-blue-50 rounded-sm" style={{ color: 'var(--icon-color)' }}><Pencil className="w-3 h-3" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); setDeleteId(contact.id); }} className="p-1 hover:bg-red-50 hover:text-red-600 rounded-sm text-[var(--icon-color)]"><Trash2 className="w-3 h-3" /></button>
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
                                        <th className="p-4 w-20 text-center">Image</th>
                                        <th className="p-4">Name & Position</th>
                                        <th className="p-4 w-32">Status</th>
                                        <th className="p-4 text-right w-32">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredContacts.map(contact => (
                                        <tr key={contact.id} className="hover:bg-blue-50 transition-colors group cursor-pointer" onClick={() => setEditingItem(contact)}>
                                            <td className="p-3">
                                                <div className="w-10 h-10 bg-gray-100 rounded-sm mx-auto flex items-center justify-center overflow-hidden border border-gray-200">
                                                    <img src={withImageCacheBust(contact.imageUrl, contact.imageCacheToken || contact.modifiedDate || contact.id) || DUMMY_IMAGE} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                                    {!contact.imageUrl && <ImageIcon className="w-5 h-5 text-gray-300" />}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-bold text-gray-800 text-sm mb-0.5">{getItemTranslation(contact, currentLanguage, 'fullName')}</div>
                                                <div className="text-xs text-gray-500">{getItemTranslation(contact, currentLanguage, 'jobTitle')}</div>
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full inline-block ${contact.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-yellow-400 text-yellow-900'}`}>
                                                    {contact.status === 'Published'
                                                        ? getTranslation('STATUS_PUBLISHED', currentLanguage)
                                                        : getTranslation('STATUS_DRAFT', currentLanguage)}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={(e) => { e.stopPropagation(); setEditingItem(contact); }} className="p-1.5 hover:bg-blue-50 rounded-sm" style={{ color: 'var(--icon-color)' }}><Pencil className="w-4 h-4" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(contact.id); }} className="p-1.5 hover:text-red-600 hover:bg-red-50 rounded-sm text-[var(--icon-color)]"><Trash2 className="w-4 h-4" /></button>
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

            {/* Sub-Modals */}
            {showCreate && <CreateContactModal onSave={handleCreateInit} onCancel={() => setShowCreate(false)} />}
            {editingItem && <ContactEditor item={editingItem} onSave={handleSaveEdit} onCancel={() => setEditingItem(null)} onDelete={(id: string) => setDeleteId(id)} />}
            {deleteId && (
                <ConfirmDeleteDialog
                    title={getTranslation('DIALOG_DELETE_CONTACT_TITLE', currentLanguage)}
                    message={getTranslation('DIALOG_DELETE_CONTACT_MESSAGE', currentLanguage)}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteId(null)}
                />
            )}
        </GenericModal>
    );
};
