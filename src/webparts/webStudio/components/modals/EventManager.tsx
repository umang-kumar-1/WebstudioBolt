
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore, getItemTranslation, getTranslation, getGlobalDefaultImage } from '../../store';
import { getNestedPortalZFromStore } from '../../utils/modalZIndex';
import { resolveGalleryDefaultImage } from '../../utils/defaultImageUrl';
import { EventItem } from '../../types';
import { GenericModal, ConfirmDeleteDialog, OpenOOTBButton } from './SharedModals';
import { MODAL_Z } from '../../utils/modalZIndex';
import JoditRichTextEditor from '../JoditEditor';
import moment from 'moment-timezone';
import {
    Monitor, List as ListIcon, Pencil, Trash2, X,
    ImageIcon, Search, ChevronDown, ArrowDownAZ, ArrowUpAZ,
    Wand2, Upload, Copy, Check, Plus
} from 'lucide-react';
import { IoCalendarOutline as IoCalendarOutlineIcon } from 'react-icons/io5';
const IoCalendarOutline = IoCalendarOutlineIcon as any;
import { SharePointMetadataFooter } from '../common/SharePointMetadataFooter';
import { ItemTaggingLookupFields } from '../common/ItemTaggingLookupFields';
import { createPortal } from 'react-dom';
import { translateText } from '../../services/geminiService';
import { EditTrigger, SortByHelpIcon } from './SharedModals';
import TooltipMenu from '../common/TooltipMenu';
import { useValidatedField } from '../common/ValidatedTextField';
import { useOptimizedImageUpload } from '../../../../hooks/useOptimizedImageUpload';
import ImageOptimizationFeedback from '../../../../components/ImageOptimizationFeedback';
import ManagedImageEditorBridge from '../common/ManagedImageEditorBridge';
import { withImageCacheBust } from '../../utils/imageCache';
import { getUniqueImageFileName, renameFileForUpload } from '../../../../utils/imageFileName';
import { getOptionalEnabledLanguages, LANGUAGE_DISPLAY_NAMES } from '../../utils/siteLanguages';
import { canManageSeoSettings } from '../../utils/templatePermissions';
import { TranslationLanguagesEmptyState } from '../common/TranslationLanguagesEmptyState';

const DUMMY_IMAGE = "";

// --- HELPERS ---
const stripHtml = (html: string) => {
    if (!html) return "";
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
};

// --- SUB-COMPONENT: CREATE EVENT MODAL ---
export const CreateEventModal = ({ onSave, onCancel }: { onSave: (title: string) => void, onCancel: () => void }) => {
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
                    <h3 className="text-lg font-bold text-[var(--primary-color)]">{getTranslation('MODAL_CREATE_EVENT', currentLanguage)}</h3>
                    <div className="flex items-center gap-4">
                        <TooltipMenu ComponentId={'977'} />
                        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                    </div>
                </div>
                <form onSubmit={handleCreate} noValidate>
                <div className="p-8 space-y-4">
                    <div>
                        <label htmlFor={titleField.fieldId} className="sr-only">{getTranslation('PH_ENTER_TITLE', currentLanguage)}</label>
                        <input
                            {...titleField.inputProps}
                            placeholder={getTranslation('PH_ENTER_TITLE', currentLanguage)}
                            autoFocus
                        />
                        {titleField.ErrorMessage}
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3">
                    <button type="button" onClick={onCancel} className="btn-secondary inline-flex items-center justify-center gap-2">
                        {getTranslation('BTN_CANCEL', currentLanguage)}
                    </button>
                    <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90">
                        {getTranslation('BTN_CREATE', currentLanguage)}
                    </button>
                </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

// --- SUB-COMPONENT: EDIT EVENT ---
export const EventEditor = ({
    item,
    onSave,
    onCancel,
    onDelete,
}: {
    item: any;
    onSave: (item: any) => void;
    onCancel: () => void;
    onDelete?: (id: string) => void;
}) => {
    const { images, uploadImage, currentLanguage, siteConfig, webStudioUserRole } = useStore();
    const [showImageEditor, setShowImageEditor] = useState(false);
    const optionalTranslationLanguages = useMemo(
        () => getOptionalEnabledLanguages(siteConfig),
        [siteConfig?.languages]
    );
    const translationLanguage = optionalTranslationLanguages[0] ?? null;
    const translationLanguageLabel = translationLanguage
        ? (LANGUAGE_DISPLAY_NAMES[translationLanguage] ?? translationLanguage.toUpperCase())
        : '';
    const showTranslationTab = optionalTranslationLanguages.length > 0;
    const showSeoTab = canManageSeoSettings(webStudioUserRole);
    const imageUpload = useOptimizedImageUpload(uploadImage);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState('BASIC');
    useEffect(() => {
        if (activeTab === 'TRANSLATION' && !showTranslationTab) {
            setActiveTab('BASIC');
        }
        if (activeTab === 'SEO' && !showSeoTab) {
            setActiveTab('BASIC');
        }
    }, [activeTab, showTranslationTab, showSeoTab]);
    const [formData, setFormData] = useState<any>({
        id: item.id || `evt_${Date.now()}`,
        title: item.title || '',
        status: item.status || 'Draft',
        startDate: (item.startDate || new Date().toISOString()).split('T')[0],
        endDate: (item.endDate || item.startDate || new Date().toISOString()).split('T')[0],
        category: item.category || '',
        location: item.location || '',
        description: item.description || '',
        imageUrl: item.imageUrl || getGlobalDefaultImage(),
        imageName: item.imageName || 'EventImage',
        translations: item.translations || { en: { title: '', description: '', category: '', location: '', readMoreText: '' } },
        readMore: item.readMore || { enabled: false, url: '', text: '' },
        seo: item.seo || { title: '', description: '', keywords: '' },
    });

    // Image Tab State
    const [imgTab, setImgTab] = useState<'COPY' | 'UPLOAD' | 'CHOOSE'>('COPY');
    const [searchImg, setSearchImg] = useState('');
    const [copyPastePreviewUrl, setCopyPastePreviewUrl] = useState('');
    const [newImageName, setNewImageName] = useState('');
    const [imagePreviewToken, setImagePreviewToken] = useState(() => Date.now());
    const pasteAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (item && item.id && !String(item.id).startsWith('evt_')) {
            setFormData((p: any) => ({
                ...p,
                ...item,
                id: item.id,
                startDate: item.startDate ? item.startDate.split('T')[0] : p.startDate,
                endDate: item.endDate ? item.endDate.split('T')[0] : (item.startDate ? item.startDate.split('T')[0] : p.endDate)
            }));
        }
    }, [item]);

    // Update Helpers
    const updateField = (key: string, val: any) => setFormData((p: any) => ({ ...p, [key]: val }));
    const updateSeo = (key: string, val: string) => setFormData((p: any) => ({ ...p, seo: { ...p.seo, [key]: val } }));
    const updateTranslation = (lang: string, key: string, val: string) => setFormData((p: any) => ({ ...p, translations: { ...p.translations, [lang]: { ...p.translations?.[lang], [key]: val } } }));
    const getUniqueImageName = (file?: File | null) => {
        const existingNames = [
            ...images.map((img: any) => String(img.name || '')),
            String(formData.imageName || ''),
            String(newImageName || ''),
        ];
        const fallbackBaseName = (formData.title || 'Event').trim();
        return getUniqueImageFileName(file, existingNames, fallbackBaseName);
    };

    // --- IMAGE HANDLERS ---
    const uploadPastedImage = async (file: File) => {
        const uniqueImageName = getUniqueImageName(file);
        setNewImageName(uniqueImageName);
        updateField('imageName', uniqueImageName);
        setIsUploading(true);
        try {
            const prepared = await imageUpload.prepareFile(file);
            const uploadFile = renameFileForUpload(prepared.file, uniqueImageName);
            const uploadedImage = await uploadImage(uploadFile, 'Pictures');
            if (uploadedImage) {
                updateField('imageUrl', uploadedImage.url);
                updateField('imageName', uniqueImageName);
                setNewImageName(uniqueImageName);
                const token = Date.now();
                setImagePreviewToken(token);
                const cacheBustedPreviewUrl = `${uploadedImage.url}${uploadedImage.url.includes('?') ? '&' : '?'}preview=${token}`;
                setCopyPastePreviewUrl(cacheBustedPreviewUrl);
            }
        } finally {
            setIsUploading(false);
        }
    };

    const processClipboardData = async (clipboardData?: DataTransfer | null) => {
        if (!clipboardData) return false;

        const imageItems = Array.from(clipboardData.items || []).filter((clipboardItem) => clipboardItem.type.startsWith('image/'));
        for (const clipboardItem of imageItems) {
            const fileFromItem = clipboardItem.getAsFile();
            if (fileFromItem) {
                await uploadPastedImage(fileFromItem);
                return true;
            }
        }

        const fileFromFiles = Array.from(clipboardData.files || []).find((clipboardFile) => clipboardFile.type.startsWith('image/'));
        if (fileFromFiles) {
            await uploadPastedImage(fileFromFiles);
            return true;
        }

        return false;
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const uploaded = await processClipboardData(e.clipboardData);
        if (uploaded) {
            e.preventDefault();
        }
    };

    useEffect(() => {
        if (activeTab !== 'IMAGE' || imgTab !== 'COPY') return;

        const handleWindowPaste = async (event: ClipboardEvent) => {
            const uploaded = await processClipboardData(event.clipboardData);
            if (uploaded) {
                event.preventDefault();
            }
        };

        window.addEventListener('paste', handleWindowPaste);
        return () => window.removeEventListener('paste', handleWindowPaste);
    }, [activeTab, imgTab]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const uniqueImageName = getUniqueImageName(file);
        setNewImageName(uniqueImageName);
        updateField('imageName', uniqueImageName);
        setIsUploading(true);
        try {
            const prepared = await imageUpload.prepareFile(file);
            const uploadFile = renameFileForUpload(prepared.file, uniqueImageName);
            const uploadedImage = await uploadImage(uploadFile, 'Pictures');
            if (uploadedImage) {
                updateField('imageUrl', uploadedImage.url);
                updateField('imageName', uniqueImageName);
                setNewImageName(uniqueImageName);
                setImagePreviewToken(Date.now());
            }
        } finally {
            setIsUploading(false);
        }
    };

    const handleGallerySelect = (img: any) => {
        updateField('imageUrl', img.url);
        updateField('imageName', img.name);
        setNewImageName(img.name);
        setImagePreviewToken(Date.now());
        setCopyPastePreviewUrl('');
    };

    // Filtered Gallery
    const filteredGallery = images.filter(img => img.name.toLowerCase().includes(searchImg.toLowerCase()));

    // Mock AI Actions
    const suggestSeo = () => {
        updateSeo('title', `Upcoming Event: ${formData.title}`);
        const dateRange = formData.startDate === formData.endDate ? formData.startDate : `${formData.startDate} to ${formData.endDate}`;
        updateSeo('description', `Join us for ${formData.title} on ${dateRange}. ${formData.description.substring(0, 50)}...`);
    };
    const [isTranslating, setIsTranslating] = useState(false);

    const suggestTranslation = async () => {
        if (!translationLanguage) return;
        setIsTranslating(true);
        try {
            const translatedTitle = await translateText(formData.title, translationLanguage);
            const translatedDesc = await translateText(formData.description, translationLanguage);
            const translatedCat = await translateText(formData.category, translationLanguage);
            const translatedLoc = await translateText(formData.location, translationLanguage);
            const translatedReadMore = formData.readMore.text ? await translateText(formData.readMore.text, translationLanguage) : '';

            setFormData((p: any) => ({
                ...p,
                translations: {
                    ...p.translations,
                    [translationLanguage]: {
                        ...p.translations?.[translationLanguage],
                        title: translatedTitle || p.translations?.[translationLanguage]?.title || '',
                        description: translatedDesc || p.translations?.[translationLanguage]?.description || '',
                        category: translatedCat || p.translations?.[translationLanguage]?.category || '',
                        location: translatedLoc || p.translations?.[translationLanguage]?.location || '',
                        readMoreText: translatedReadMore || p.translations?.[translationLanguage]?.readMoreText || ''
                    }
                }
            }));
        } catch (error) {
            console.error(error);
        } finally {
            setIsTranslating(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in zoom-in-95 duration-200" style={{ zIndex: getNestedPortalZFromStore(10) }}>
            <div className="bg-white w-[1000px] shadow-2xl rounded-sm border border-gray-300 flex flex-col h-[90vh] min-h-[90vh] max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0 gap-4">
                    <h3 className="font-bold text-[var(--primary-color)] min-w-0 truncate flex-1">
                        {getTranslation('MODAL_EDIT_EVENT', currentLanguage)} - {formData.title}
                        <EditTrigger labelKey="MODAL_EDIT_EVENT" className="ml-2" />
                    </h3>
                    <div className="flex items-center gap-3 shrink-0">
                        <TooltipMenu ComponentId={'943'} />
                        <button onClick={onCancel} className="text-gray-400 hover:text-red-500"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-6 bg-white flex-shrink-0 gap-6">
                    {[
                        { id: 'BASIC', labelKey: 'TAB_BASIC_INFO' },
                        { id: 'IMAGE', labelKey: 'TAB_IMAGE_INFO' },
                        ...(showSeoTab ? [{ id: 'SEO', labelKey: 'TAB_SEO' }] : []),
                        ...(showTranslationTab ? [{ id: 'TRANSLATION', labelKey: 'TAB_TRANSLATION' }] : []),
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === tab.id ? 'border-[var(--primary-color)] text-[var(--primary-color)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            {getTranslation(tab.labelKey, currentLanguage)}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-1 bg-gray-50/50">

                    {/* BASIC INFORMATION */}
                    {activeTab === 'BASIC' && (
                        <div className="space-y-6 bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_TITLE', currentLanguage)}</label>
                                <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formData.title} onChange={e => updateField('title', e.target.value)} />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_START_DATE', currentLanguage)}</label>
                                    <div className="relative">
                                        <input type="date" className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formData.startDate} onChange={e => updateField('startDate', e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_END_DATE', currentLanguage)}</label>
                                    <div className="relative">
                                        <input type="date" className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formData.endDate} onChange={e => updateField('endDate', e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_CATEGORY', currentLanguage)}</label>
                                    <input
                                        className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                        value={formData.category}
                                        onChange={e => updateField('category', e.target.value)}
                                        placeholder="e.g., Conference, Workshop, Webinar"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_LOCATION', currentLanguage)}</label>
                                    <input
                                        className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                        value={formData.location}
                                        onChange={e => updateField('location', e.target.value)}
                                        placeholder="e.g., Berlin, Germany or Virtual"
                                    />
                                </div>
                            </div>

                            <ItemTaggingLookupFields itemId={String(formData.id)} listName="Events" />

                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={formData.readMore.enabled} onChange={e => setFormData({ ...formData, readMore: { ...formData.readMore, enabled: e.target.checked } })} className="rounded-sm text-[var(--primary-color)] focus:ring-[var(--primary-color)]" />
                                <label className="text-sm text-gray-700">{getTranslation('LABEL_ADD_READ_MORE', currentLanguage)}</label>
                            </div>

                            {formData.readMore.enabled && (
                                <div className="grid grid-cols-2 gap-6 pl-6 border-gray-100">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_LINK_URL', currentLanguage)}</label>
                                        <input
                                            className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            placeholder={getTranslation('PLACEHOLDER_URL_GENERIC', currentLanguage)}
                                            value={formData.readMore.url || ''}
                                            onChange={e => setFormData({ ...formData, readMore: { ...formData.readMore, url: e.target.value } })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                            {getTranslation('LABEL_LINK_TEXT', currentLanguage)}
                                            <EditTrigger labelKey="LABEL_LINK_TEXT" className="ml-2" />
                                        </label>
                                        <input
                                            className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            placeholder="Read More"
                                            value={formData.readMore.text || ''}
                                            onChange={e => setFormData({ ...formData, readMore: { ...formData.readMore, text: e.target.value } })}
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                    {getTranslation('LABEL_ORIGINAL_DESC', currentLanguage)}
                                    <EditTrigger labelKey="LABEL_ORIGINAL_DESC" className="ml-2" />
                                </label>
                                <JoditRichTextEditor
                                    value={formData.description}
                                    onChange={(newValue: any) => updateField('description', newValue)}
                                    placeholder="A brief description of the event."
                                    height={200}
                                />
                            </div>
                        </div>
                    )}

                    {/* IMAGE INFORMATION */}
                    {activeTab === 'IMAGE' && (
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm space-y-6">
                            {/* Top: Current Image */}
                            <div className="flex gap-6 items-start">
                                <div className="w-32 h-32 bg-gray-100 border border-gray-300 flex items-center justify-center relative overflow-hidden flex-shrink-0">
                                    <img
                                        key={`${formData.imageUrl || ''}-${imagePreviewToken}`}
                                        src={withImageCacheBust(formData.imageUrl, imagePreviewToken)}
                                        alt="Current"
                                        className="w-full h-full object-cover"
                                        style={{ display: formData.imageUrl ? 'block' : 'none' }}
                                        onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                    {!formData.imageUrl && <ImageIcon className="w-8 h-8 text-gray-300" />}
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_IMAGE_URL', currentLanguage)}</label>
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 border border-gray-300 p-2 text-sm text-gray-600 rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                                value={formData.imageUrl || ''}
                                                onChange={e => updateField('imageUrl', e.target.value)}
                                                placeholder={getTranslation('PLACEHOLDER_URL_GENERIC', currentLanguage)}
                                            />
                                            <button
                                                onClick={() => {
                                                    const resolvedDefault = resolveGalleryDefaultImage(images);
                                                    if (resolvedDefault) {
                                                        updateField('imageUrl', resolvedDefault.url);
                                                        updateField('imageName', resolvedDefault.name);
                                                    } else {
                                                        updateField('imageUrl', getGlobalDefaultImage());
                                                        updateField('imageName', '');
                                                    }
                                                }}
                                                className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-sm hover:bg-gray-200 transition-colors"
                                            >
                                                {getTranslation('BTN_DEFAULT_IMAGE', currentLanguage)}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_IMAGE_NAME', currentLanguage)}</label>
                                        <input className="w-full border border-gray-300 p-2 text-sm rounded-sm" value={formData.imageName} onChange={e => updateField('imageName', e.target.value)} />
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {formData.imageUrl && (
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
                                            onClick={() => {
                                                updateField('imageUrl', '');
                                                updateField('imageName', '');
                                                setCopyPastePreviewUrl('');
                                                setNewImageName('');
                                                setImagePreviewToken(Date.now());
                                            }}
                                            className="text-xs text-[var(--primary-color)] hover:underline flex items-center gap-1"
                                        >
                                            <X className="w-3 h-3" /> {getTranslation('BTN_CLEAR_IMAGE', currentLanguage)}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom: Selection Tabs */}
                            <div className="border-t border-gray-200 pt-6">
                                <div className="flex gap-6 border-b border-gray-200 mb-4">
                                    {([
                                        { id: 'COPY' as const, labelKey: 'TAB_IMG_COPY' },
                                        { id: 'UPLOAD' as const, labelKey: 'TAB_IMG_UPLOAD' },
                                        { id: 'CHOOSE' as const, labelKey: 'TAB_IMG_CHOOSE' }
                                    ]).map(sub => (
                                        <button
                                            key={sub.id}
                                            type="button"
                                            onClick={() => setImgTab(sub.id)}
                                            className={`pb-2 text-xs font-bold uppercase transition-colors ${imgTab === sub.id ? 'border-b-2 border-[var(--primary-color)] text-[var(--primary-color)]' : 'text-gray-500'}`}
                                        >
                                            {sub.id === 'CHOOSE'
                                                ? `${getTranslation(sub.labelKey, currentLanguage)} (${images.length})`
                                                : getTranslation(sub.labelKey, currentLanguage)}
                                        </button>
                                    ))}
                                </div>

                                {imgTab === 'COPY' && (
                                    <div className="space-y-4">
                                        <div><label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_IMAGE_NAME', currentLanguage)}</label><input className="w-full border border-gray-300 p-2 text-sm rounded-sm" value={newImageName} onChange={e => { setNewImageName(e.target.value); updateField('imageName', e.target.value); }} /></div>
                                        <div
                                            ref={pasteAreaRef}
                                            onPaste={handlePaste}
                                            contentEditable
                                            suppressContentEditableWarning
                                            className="h-32 border-2 border-dashed border-[var(--primary-color)] bg-blue-50 flex flex-col items-center justify-center text-gray-400 text-sm cursor-pointer hover:bg-blue-100 transition-colors relative overflow-hidden"
                                            onClick={() => {
                                                pasteAreaRef.current?.focus();
                                                const selection = window.getSelection();
                                                const range = document.createRange();
                                                if (pasteAreaRef.current && selection) {
                                                    range.selectNodeContents(pasteAreaRef.current);
                                                    range.collapse(true);
                                                    selection.removeAllRanges();
                                                    selection.addRange(range);
                                                }
                                            }}
                                            tabIndex={0}
                                        >
                                            {copyPastePreviewUrl ? (
                                                <>
                                                    <img
                                                        src={withImageCacheBust(copyPastePreviewUrl, formData.id)}
                                                        alt={formData.imageName || 'Pasted image'}
                                                        className="absolute inset-0 w-full h-full object-contain bg-white"
                                                    />
                                                    {(imageUpload.isOptimizing || imageUpload.stats) && (
                                                        <div className="ws-image-opt-overlay-bar absolute inset-x-0 top-0 z-20 px-2 py-1.5">
                                                            <ImageOptimizationFeedback
                                                                stats={imageUpload.stats}
                                                                isProcessing={imageUpload.isOptimizing}
                                                                variant="overlay"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-x-0 bottom-0 z-10 bg-black/70 text-white text-[11px] px-2 py-1 truncate">
                                                        {formData.imageName || 'Pasted image'}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-6 h-6 mb-2 text-[var(--primary-color)] opacity-50" />
                                                    <span className="font-bold text-[var(--primary-color)]">{getTranslation('MSG_CLICK_PASTE_IMAGE', currentLanguage)}</span>
                                                </>
                                            )}
                                        </div>
                                        {!copyPastePreviewUrl && (imageUpload.isOptimizing || imageUpload.stats) && (
                                            <ImageOptimizationFeedback
                                                stats={imageUpload.stats}
                                                isProcessing={imageUpload.isOptimizing}
                                                variant="panel"
                                            />
                                        )}
                                    </div>
                                )}

                                {imgTab === 'UPLOAD' && (
                                    <div className="space-y-4">
                                        <div><label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_IMAGE_NAME', currentLanguage)}</label><input className="w-full border border-gray-300 p-2 text-sm rounded-sm" value={newImageName} onChange={e => { setNewImageName(e.target.value); updateField('imageName', e.target.value); }} /></div>
                                        <div className="flex flex-col items-end gap-2">
                                            <label className={`bg-[var(--btn-primary-bg)] text-white px-4 py-2 text-sm font-bold shadow-sm cursor-pointer hover:opacity-90 rounded-sm flex items-center gap-2 ${(isUploading || imageUpload.isBusy) ? 'opacity-50 cursor-wait' : ''}`}>
                                                <Upload className="w-4 h-4" /> {(isUploading || imageUpload.isBusy) ? (imageUpload.isOptimizing ? 'Optimizing…' : getTranslation('MSG_UPLOADING', currentLanguage)) : getTranslation('BTN_UPLOAD_IMAGE', currentLanguage)}
                                                <input type="file" className="hidden" onChange={(e) => { handleUpload(e).catch(console.error); }} accept="image/*" disabled={isUploading || imageUpload.isBusy} />
                                            </label>
                                            <ImageOptimizationFeedback stats={imageUpload.stats} isProcessing={imageUpload.isOptimizing} />
                                        </div>
                                    </div>
                                )}

                                {imgTab === 'CHOOSE' && (
                                    <div className="flex flex-col h-full">
                                        <div className="relative mb-4 shrink-0">
                                            <input
                                                className="w-full border border-gray-300 py-2 pl-8 pr-8 text-sm rounded-sm focus:outline-none focus:border-[var(--primary-color)]"
                                                placeholder={getTranslation('PH_SEARCH_IMAGES', currentLanguage)}
                                                value={searchImg}
                                                onChange={e => setSearchImg(e.target.value)}
                                            />
                                            <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                                            {searchImg && (
                                                <button
                                                    onClick={() => setSearchImg('')}
                                                    className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                                                    title="Clear search"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Fixed Grid Layout Container */}
                                        <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[400px] border border-gray-100 bg-gray-50/50 p-2 rounded-sm content-start">
                                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 auto-rows-min">
                                                {filteredGallery.map(img => (
                                                    <div
                                                        key={img.id}
                                                        onClick={() => handleGallerySelect(img)}
                                                        className={`
                                                            relative aspect-square cursor-pointer overflow-hidden rounded-sm border-2 transition-all group bg-white shadow-sm
                                                            ${formData.imageUrl === img.url
                                                                ? 'border-[var(--primary-color)] ring-2 ring-[var(--primary-color)] ring-opacity-20 z-10'
                                                                : 'border-transparent hover:border-blue-300 hover:shadow-md'}
                                                        `}
                                                    >
                                                        {/* Image */}
                                                        <img
                                                            src={img.url}
                                                            alt={img.name}
                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                        {!img.url && <div className="absolute inset-0 flex items-center justify-center bg-gray-100"><ImageIcon className="w-6 h-6 text-gray-300" /></div>}

                                                        {/* Selected Indicator */}
                                                        {formData.imageUrl === img.url && (
                                                            <div className="absolute top-1 right-1 bg-[var(--primary-color)] text-white rounded-full p-0.5 shadow-md z-20">
                                                                <Check className="w-3 h-3" />
                                                            </div>
                                                        )}

                                                        {/* Label Overlay */}
                                                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] p-1.5 truncate text-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                            {img.name}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {filteredGallery.length === 0 && (
                                                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
                                                    <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                                                    <span className="text-xs">{getTranslation('MSG_NO_IMAGES', currentLanguage)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* SEO */}
                    {activeTab === 'SEO' && (
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm space-y-6">
                            <div className="flex justify-end">
                                <button onClick={suggestSeo} className="bg-[var(--primary-color)] text-white px-4 py-2 text-xs font-bold flex items-center gap-2 hover:opacity-90 shadow-sm">
                                    <Wand2 className="w-3 h-3" /> {getTranslation('BTN_SUGGEST_AI', currentLanguage)}
                                </button>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_SEO_TITLE', currentLanguage)}</label>
                                <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm" value={formData.seo.title} onChange={e => updateSeo('title', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_META_DESC', currentLanguage)}</label>
                                <JoditRichTextEditor
                                    value={formData.seo.description}
                                    onChange={(val: string) => updateSeo('description', val)}
                                    height={160}
                                    placeholder="Meta description..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_KEYWORDS', currentLanguage)}</label>
                                <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm" value={formData.seo.keywords} onChange={e => updateSeo('keywords', e.target.value)} />
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
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex gap-8 text-xs font-bold text-gray-500 uppercase">
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-300"></span> {getTranslation('LABEL_ORIGINAL', currentLanguage)} (English)</div>
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-600"></span> {getTranslation('LABEL_TRANSLATION_STATE', currentLanguage)} ({translationLanguageLabel})</div>
                                </div>
                                <button onClick={suggestTranslation} disabled={isTranslating} className={`text-[var(--primary-color)] text-xs font-bold flex items-center gap-2 hover:underline ${isTranslating ? 'opacity-50 cursor-wait' : ''}`}>
                                    <Wand2 className={`w-3 h-3 ${isTranslating ? 'animate-pulse' : ''}`} /> {isTranslating ? 'Translating...' : getTranslation('BTN_SUGGEST_AI', currentLanguage)}
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
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_CATEGORY', currentLanguage)}</label>
                                        <input className="w-full border border-gray-300 p-2 text-sm bg-gray-50" value={formData.category || ''} readOnly />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_LOCATION', currentLanguage)}</label>
                                        <input className="w-full border border-gray-300 p-2 text-sm bg-gray-50" value={formData.location || ''} readOnly />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_READ_MORE', currentLanguage)}</label>
                                        <input className="w-full border border-gray-300 p-2 text-sm bg-gray-50" value={formData.readMore.text || ''} readOnly />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_DESC', currentLanguage)}</label>
                                        <div className="border border-gray-300 p-2 bg-gray-50 min-h-[150px]">
                                            <div className="text-sm" dangerouslySetInnerHTML={{ __html: formData.description }}></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Translation */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_TRANS_TITLE', currentLanguage)}</label>
                                        <input
                                            className="w-full border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            placeholder="Enter translated title..."
                                            value={formData.translations[translationLanguage]?.title || ''}
                                            onChange={e => updateTranslation(translationLanguage, 'title', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_TRANS_CAT', currentLanguage)}</label>
                                        <input
                                            className="w-full border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            placeholder="Enter translated category..."
                                            value={formData.translations[translationLanguage]?.category || ''}
                                            onChange={e => updateTranslation(translationLanguage, 'category', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_TRANS_LOC', currentLanguage)}</label>
                                        <input
                                            className="w-full border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            placeholder="Enter translated location..."
                                            value={formData.translations[translationLanguage]?.location || ''}
                                            onChange={e => updateTranslation(translationLanguage, 'location', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_TRANS_READ_MORE', currentLanguage)}</label>
                                        <input
                                            className="w-full border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            placeholder="Enter translated read more text..."
                                            value={formData.translations[translationLanguage]?.readMoreText || ''}
                                            onChange={e => updateTranslation(translationLanguage, 'readMoreText', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_TRANS_DESC', currentLanguage)}</label>
                                        <JoditRichTextEditor
                                            value={formData.translations[translationLanguage]?.description || ''}
                                            onChange={(newValue: any) => updateTranslation(translationLanguage, 'description', newValue)}
                                            placeholder={getTranslation('PLACEHOLDER_TRANSLATED_DESCRIPTION', currentLanguage)}
                                            height={150}
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
                                listTitle="Events"
                                itemId={formData.id}
                                itemTitle={formData.title}
                                itemDescription={formData.description}
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
                            <button type="button" onClick={onCancel} className="btn-secondary inline-flex items-center justify-center gap-2 transition-colors">
                                {getTranslation('BTN_CANCEL', currentLanguage)}
                            </button>
                            <button type="button" disabled={isUploading} onClick={() => onSave(formData)} className="btn-primary inline-flex items-center justify-center gap-2 capitalize transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed">
                                {isUploading ? getTranslation('MSG_UPLOADING', currentLanguage) : getTranslation('BTN_SAVE', currentLanguage)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <ManagedImageEditorBridge
                imageUrl={formData.imageUrl || ''}
                imageName={formData.imageName}
                isOpen={showImageEditor}
                onClose={() => setShowImageEditor(false)}
                onSaved={(url, name) => {
                    updateField('imageUrl', url);
                    updateField('imageName', name);
                    setNewImageName(name);
                    setImagePreviewToken(Date.now());
                }}
            />
        </div>
    );
};

// --- MAIN EVENT MANAGER ---
export const EventManager = ({ onClose }: any) => {
    const { events, addEvent, updateEvent, deleteEvent, currentLanguage } = useStore();
    const [view, setView] = useState<'VISUAL' | 'LIST'>('VISUAL');
    const [showCreate, setShowCreate] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'startDate', direction: 'desc' });
    const [failedImageKeys, setFailedImageKeys] = useState<Set<string>>(new Set());

    const getImageKey = (item: any) => `${item.id}-${item.imageUrl || 'no-image'}`;
    const isImageBroken = (item: any) => failedImageKeys.has(getImageKey(item));
    const markImageBroken = (item: any) => {
        const imageKey = getImageKey(item);
        setFailedImageKeys(prev => {
            if (prev.has(imageKey)) return prev;
            const next = new Set(prev);
            next.add(imageKey);
            return next;
        });
    };

    // Handle Create Init
    const handleCreateInit = async (title: string) => {
        const newItem: EventItem = {
            id: `evt_${Date.now()}`,
            title: title,
            status: 'Draft',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            description: '',
            imageUrl: '',
            readMore: { enabled: false, url: '' },
            translations: { en: { title: '', description: '' } },
            seo: { title: '', description: '', keywords: '' }
        };
        await addEvent(newItem);
        setShowCreate(false);
    };

    const handleSaveEdit = (item: any) => {
        updateEvent(item);
        setEditingItem(null);
    };

    const handleDelete = (id: string) => {
        deleteEvent(id);
        setDeleteId(null);
        setEditingItem(null);
    };

    // Use events from store
    const allEvents = [...events];

    // Sort & Filter
    const sortedEvents = [...allEvents].sort((a, b) => {
        const valA = (a as any)[sortConfig.key];
        const valB = (b as any)[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    const filteredEvents = sortedEvents.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const toggleSort = () => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }));

    const customFooter = (
        <div className="flex justify-between w-full items-center">
            <OpenOOTBButton listTitle="Events" />
            <button type="button" onClick={onClose} className="btn-secondary inline-flex items-center justify-center gap-1">
                {getTranslation('BTN_CLOSE', currentLanguage)}
            </button>
        </div>
    );

    return (
        <GenericModal
            className="event-management-popup"
            title={getTranslation('TITLE_EVENT_MGMT', currentLanguage) || 'Event Management'}
            onClose={onClose}
            width="w-[80vw] min-w-[80vw] max-w-[80vw]"
            noFooter={true}
            customFooter={customFooter}
            headerIcons={
                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500 mr-2 hidden md:inline">{getTranslation('DESC_EVENT_MGMT', currentLanguage)}</span>
                    <div className="flex border border-[var(--primary-color)] rounded-sm overflow-hidden shadow-sm h-8">
                        <button type="button" onClick={() => setView('VISUAL')} className={`ws-view-toggle-label-btn px-3 text-xs font-bold flex items-center gap-2 transition-colors ${view === 'VISUAL' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-blue-50'}`}><Monitor className="w-3 h-3" /> {getTranslation('BTN_VISUAL_VIEW', currentLanguage)}</button>
                        <button type="button" onClick={() => setView('LIST')} className={`ws-view-toggle-label-btn px-3 text-xs font-bold flex items-center gap-2 transition-colors ${view === 'LIST' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-blue-50'}`}><ListIcon className="w-3 h-3" /> {getTranslation('BTN_LIST_VIEW', currentLanguage)}</button>
                    </div>
                    <TooltipMenu ComponentId={'15152'} />
                </div>
            }
        >
            <div className="flex flex-col h-full bg-white">
                {/* Toolbar */}
                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0 gap-4">
                    <div className="flex-1 max-w-lg relative group">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 z-10" />
                        <input
                            placeholder={getTranslation('LABEL_SEARCH_EVENTS', currentLanguage)}
                            className="border border-gray-300 py-2.5 pl-10 pr-9 text-sm w-full focus:ring-1 focus:ring-[var(--primary-color)]  outline-none rounded-sm relative z-0"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors z-10"
                                title="Clear search"
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
                                    <option value="startDate">{getTranslation('LABEL_START_DATE', currentLanguage)}</option>
                                    <option value="title">{getTranslation('LABEL_TITLE', currentLanguage)}</option>
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

                        <button type="button" onClick={() => setShowCreate(true)} className="ws-compact-toolbar-btn bg-[var(--btn-primary-bg)] text-white px-4 py-2 text-sm font-bold hover:opacity-90 shadow-sm rounded-sm flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            {getTranslation('BTN_ADD_EVENT', currentLanguage)}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
                    {view === 'VISUAL' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredEvents.map((n: any) => (
                                <div key={n.id} className="bg-white border border-gray-200 shadow-sm hover:shadow-lg transition-all group relative flex flex-col rounded-sm overflow-hidden min-h-[140px]">
                                    <div className="flex h-full">
                                        <div className="w-32 bg-gray-100 flex items-center justify-center relative overflow-hidden border-r border-gray-100">
                                            {!!n.imageUrl && !isImageBroken(n) && (
                                                <img
                                                    key={n.imageUrl || 'no-image'}
                                                    src={n.imageUrl || DUMMY_IMAGE}
                                                    alt={n.title}
                                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                    onError={() => markImageBroken(n)}
                                                />
                                            )}
                                            {(!n.imageUrl || isImageBroken(n)) && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <ImageIcon className="w-10 h-10 text-gray-300" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 flex-1 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-bold text-gray-800 mb-2 line-clamp-1">{getItemTranslation(n, currentLanguage, 'title')}</h4>
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${n.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-yellow-400 text-yellow-900'}`}>
                                                        {n.status === 'Published'
                                                            ? getTranslation('STATUS_PUBLISHED', currentLanguage)
                                                            : getTranslation('STATUS_DRAFT', currentLanguage)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                                    <IoCalendarOutline className="w-3 h-3" />
                                                    {n.startDate ? moment(n.startDate).locale(currentLanguage).format('DD MMM YYYY') : getTranslation('LABEL_NO_DATE', currentLanguage)}
                                                    {n.endDate && n.endDate !== n.startDate && ` - ${moment(n.endDate).locale(currentLanguage).format('DD MMM YYYY')}`}
                                                </div>
                                                <p className="text-xs text-gray-500 line-clamp-2 mb-2">{stripHtml(getItemTranslation(n, currentLanguage, 'description') || 'No description provided.')}</p>
                                            </div>

                                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setEditingItem(n)} className="p-1 hover:bg-blue-50 rounded-sm" title={getTranslation('BTN_EDIT', currentLanguage)} style={{ color: 'var(--icon-color)' }}><Pencil className="w-3 h-3" /></button>
                                                <button onClick={() => setDeleteId(n.id)} className="p-1 hover:bg-red-50 hover:text-red-600 rounded-sm" title="Delete" style={{ color: 'var(--icon-color)' }}><Trash2 className="w-3 h-3" /></button>
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
                                        <th className="px-3 py-4 w-28">
                                            {getTranslation('LABEL_IMAGE', currentLanguage)}
                                        </th>
                                        <th className="px-6 py-4">
                                            {getTranslation('LABEL_TITLE_DATE', currentLanguage)}
                                        </th>
                                        <th className="px-6 py-4 w-32">
                                            {getTranslation('LABEL_STATUS', currentLanguage)}
                                        </th>
                                        <th className="px-3 py-4 text-right w-36">
                                            {getTranslation('LABEL_ACTIONS', currentLanguage)}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredEvents.map((n: any) => (
                                        <tr key={n.id} className="hover:bg-[var(--brand-light)] transition-colors group">
                                            <td className="p-3">
                                                <div className="w-10 h-10 bg-gray-100 rounded-sm flex items-center justify-center overflow-hidden border border-gray-200">
                                                    {!!n.imageUrl && !isImageBroken(n) && (
                                                        <img
                                                            key={n.imageUrl || 'no-image'}
                                                            src={n.imageUrl || DUMMY_IMAGE}
                                                            className="w-full h-full object-cover"
                                                            onError={() => markImageBroken(n)}
                                                        />
                                                    )}
                                                    {(!n.imageUrl || isImageBroken(n)) && <ImageIcon className="w-5 h-5 text-gray-300" />}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-800 text-sm mb-2">{getItemTranslation(n, currentLanguage, 'title')}</div>
                                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                                    <IoCalendarOutline className="w-3 h-3" />
                                                    {n.startDate ? moment(n.startDate).locale(currentLanguage).format('DD MMM YYYY') : getTranslation('LABEL_NO_DATE', currentLanguage)}
                                                    {n.endDate && n.endDate !== n.startDate && ` - ${moment(n.endDate).locale(currentLanguage).format('DD MMM YYYY')}`}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full inline-block ${n.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-yellow-400 text-yellow-900'}`}>
                                                    {n.status === 'Published'
                                                        ? getTranslation('STATUS_PUBLISHED', currentLanguage)
                                                        : getTranslation('STATUS_DRAFT', currentLanguage)}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setEditingItem(n)} className="p-1.5 hover:bg-blue-50 rounded-sm" style={{ color: 'var(--icon-color)' }}><Pencil className="w-4 h-4" /></button>
                                                    <button onClick={() => setDeleteId(n.id)} className="p-1.5 hover:text-red-600 hover:bg-red-50 rounded-sm" style={{ color: 'var(--icon-color)' }}><Trash2 className="w-4 h-4" /></button>
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
            {showCreate && <CreateEventModal onSave={handleCreateInit} onCancel={() => setShowCreate(false)} />}
            {editingItem && <EventEditor item={editingItem} onSave={handleSaveEdit} onCancel={() => setEditingItem(null)} onDelete={(id: string) => setDeleteId(id)} />}
            {deleteId && <ConfirmDeleteDialog title="Delete Event" message="Are you sure you want to delete this event? This action cannot be undone." onConfirm={() => handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />}
        </GenericModal>
    );
};
