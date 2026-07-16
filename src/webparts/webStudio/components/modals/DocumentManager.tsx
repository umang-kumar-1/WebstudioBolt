
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore, getItemTranslation, getLocalizedText, getTranslation, getGlobalDefaultImage } from '../../store';
import { getNestedPortalZFromStore } from '../../utils/modalZIndex';
import { resolveGalleryDefaultImage } from '../../utils/defaultImageUrl';
import { DocumentItem } from '../../types';
import { GenericModal, ConfirmDeleteDialog, HelpGuideDocModal, OpenOOTBButton, SortByHelpIcon, ItemEditorChangeOrderButton, TaggedOrderChangeContext } from './SharedModals';
import { MODAL_Z } from '../../utils/modalZIndex';
import JoditRichTextEditor from '../JoditEditor';
import {
    Monitor, List as ListIcon, Filter, Upload, FileText, Pencil, Trash2, X,
    Search, ChevronDown, ArrowDownAZ, ArrowUpAZ,
    FileSpreadsheet, File, Presentation, Link as LinkIcon,
    HelpCircle, Clock, Check, Copy, Wand2,
    Plus
} from 'lucide-react';
import { IoCalendarOutline as IoCalendarOutlineIcon } from 'react-icons/io5';
const IoCalendarOutline = IoCalendarOutlineIcon as any;
import { createPortal } from 'react-dom';
import { SharePointMetadataFooter } from '../common/SharePointMetadataFooter';
import { ItemTaggingLookupFields } from '../common/ItemTaggingLookupFields';
import TooltipMenu from '../common/TooltipMenu';
import EditorImageTabPanel from '../common/EditorImageTabPanel';
import {
    getDocFileName,
    getFileTypeFromName,
    resolveDocumentType,
} from '../../utils/documentType';
import { getOptionalEnabledLanguages, LANGUAGE_DISPLAY_NAMES } from '../../utils/siteLanguages';
import { canPublishContent } from '../../utils/templatePermissions';
import { TranslationLanguagesEmptyState } from '../common/TranslationLanguagesEmptyState';

// --- HELPERS ---


const stripHtml = (html: string) => {
    if (!html) return "";
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
};

const formatDocumentDateParts = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;
    return {
        dayMonth: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        year: date.toLocaleDateString('en-GB', { year: 'numeric' }),
        time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        fullDate: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    };
};

const DateTimeIconBadge = ({
    Icon,
    children,
    align = 'center',
}: {
    Icon: React.ElementType;
    children: React.ReactNode;
    align?: 'center' | 'start';
}) => (
    <div className={`flex gap-2 min-w-0 ${align === 'start' ? 'items-start' : 'items-center'}`}>
        <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm bg-gray-100 text-gray-500">
            <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 leading-tight text-gray-700">{children}</div>
    </div>
);

const DocumentDateTimeDisplay = ({
    date,
    layout = 'inline',
    emptyLabel = 'No date',
}: {
    date?: string;
    layout?: 'inline' | 'stacked';
    emptyLabel?: string;
}) => {
    const parts = formatDocumentDateParts(date);
    if (!parts) {
        return <span className="text-xs text-gray-400">{emptyLabel}</span>;
    }

    if (layout === 'stacked') {
        return (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <DateTimeIconBadge Icon={IoCalendarOutline} align="start">
                    <div className="text-sm font-medium">{parts.dayMonth}</div>
                    <div className="text-xs text-gray-500">{parts.year}</div>
                </DateTimeIconBadge>
                <DateTimeIconBadge Icon={Clock}>
                    <span className="text-sm font-medium tabular-nums">{parts.time}</span>
                </DateTimeIconBadge>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 gap-2">
            <span className="inline-flex items-center gap-1.5">
                <IoCalendarOutline className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <span>{parts.fullDate}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 flex-shrink-0 text-gray-400" strokeWidth={2} />
                <span className="tabular-nums">{parts.time}</span>
            </span>
        </div>
    );
};

// --- CONSTANTS ---
const DOC_TYPES = ['Word', 'PDF', 'Presentations', 'Excel', 'Link', 'Others'];
const YEARS = ['2020', '2021', '2022', '2023', '2024', '2025'];
const STATUSES = ['Draft', 'Published'];
const DUMMY_IMAGE = "";

// MOCK_GALLERY REMOVED

const DOC_TYPE_VISUAL: Record<string, { color: string; Icon: React.ComponentType<{ style?: React.CSSProperties }> }> = {
    Word: { color: '#1e6cd5', Icon: FileText },
    Excel: { color: '#107c41', Icon: FileSpreadsheet },
    PDF: { color: '#d93025', Icon: File },
    PPT: { color: '#d04423', Icon: Presentation },
    Presentations: { color: '#d04423', Icon: Presentation },
    Link: { color: '#0284c7', Icon: LinkIcon },
    Others: { color: '#d93025', Icon: File },
};

const getDocIcon = (type: string, fileName?: string, size: 'sm' | 'md' = 'md') => {
    const resolved = resolveDocumentType(type, fileName);
    const visual = DOC_TYPE_VISUAL[resolved] || DOC_TYPE_VISUAL.Others;
    const { Icon, color } = visual;
    const iconSize = size === 'sm' ? 24 : 32;

    return (
        <Icon
            style={{ width: iconSize, height: iconSize, color, strokeWidth: 1.75 }}
        />
    );
};

// --- SUB-COMPONENTS ---

// 1. ADD DOCUMENT MODAL
export const AddDocumentModal = ({ onSave, onCancel }: { onSave: (doc: any) => void, onCancel: () => void }) => {
    const { currentLanguage } = useStore();
    const [activeTab, setActiveTab] = useState<'UPLOAD' | 'DRAG' | 'LINK'>('UPLOAD');
    const [isDragging, setIsDragging] = useState(false);
    const [formData, setFormData] = useState({
        itemRank: 5,
        fileName: '',
        docName: '',
        url: '',
        file: null as File | null
    });

    const getFileType = (name: string) => getFileTypeFromName(name);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setFormData({ ...formData, fileName: file.name, file: file });
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            setFormData({ ...formData, fileName: file.name, file: file });
            setActiveTab('UPLOAD');
        }
    };

    const handleSave = () => {
        // Basic validation logic
        if (activeTab === 'UPLOAD' && !formData.fileName) return;
        if (activeTab === 'LINK' && !formData.url) return;

        onSave({
            title: formData.docName || formData.fileName || 'Untitled Document',
            type: activeTab === 'LINK' ? 'Link' : getFileType(formData.fileName),
            itemRank: formData.itemRank,
            url: formData.url,
            status: 'Draft',
            year: new Date().getFullYear().toString(),
            date: new Date().toISOString().split('T')[0],
            file: formData.file || undefined
        });
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in zoom-in-95 duration-200" style={{ zIndex: getNestedPortalZFromStore(0) }}>
            <div className="bg-white w-[600px] max-h-[480px] shadow-2xl rounded-sm border border-gray-300 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-white">
                    <h3 className="text-lg font-bold text-[var(--primary-color)]">{getTranslation('TITLE_ADD_DOC', currentLanguage)}</h3>
                    <div className="flex items-center gap-3">
                        <TooltipMenu ComponentId={'917'} />
                        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex px-6 border-b border-gray-200 gap-6">
                    {([
                        { value: 'UPLOAD' as const, labelKey: 'TAB_UPLOAD_UPPER' },
                        { value: 'DRAG' as const, labelKey: 'TAB_DRAG_DROP' },
                        { value: 'LINK' as const, labelKey: 'TAB_LINK' }
                    ]).map(tab => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setActiveTab(tab.value)}
                            className={`py-3 text-xs font-bold uppercase border-b-2 transition-colors ${activeTab === tab.value ? 'border-[var(--primary-color)] text-[var(--primary-color)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            {getTranslation(tab.labelKey, currentLanguage)}
                        </button>
                    ))}
                </div>

                <div className="p-8 space-y-6">
                    {activeTab === 'UPLOAD' && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_ITEM_RANK', currentLanguage)}</label>
                                <div className="relative">
                                    <select
                                        className="w-full border border-gray-300 p-2.5 text-sm rounded-sm appearance-none outline-none focus:border-[var(--primary-color)] bg-white"
                                        value={formData.itemRank ?? ''}
                                        onChange={e => setFormData({ ...formData, itemRank: (e.target.value === '' ? '' : Number(e.target.value)) as any })}>
                                        <option value="0">(0) No Show</option>
                                        <option value="1">(1) Archive</option>
                                        <option value="2">(2) to be verified</option>
                                        <option value="4">(4) Background Item</option>
                                        <option value="5">(5) Relevant Item</option>
                                        <option value="6">(6) Key Item</option>
                                        <option value="7">(7) Featured Item</option>
                                        <option value="8">(8) Top Highlights</option>

                                    </select>
                                    <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                            <div className="flex gap-0">
                                <label className="px-4 py-2 border border-gray-300 bg-gray-50 text-gray-700 text-sm font-bold hover:bg-gray-100 cursor-pointer rounded-l-sm border-r-0">
                                    {getTranslation('BTN_CHOOSE_FILE', currentLanguage)}
                                    <input type="file" className="hidden" onChange={handleFileChange} />
                                </label>
                                <div className="flex-1 border border-gray-300 p-2 text-sm text-gray-500 italic flex items-center rounded-r-sm gap-2">
                                    {formData.fileName ? (
                                        <>
                                            <div className="scale-75 origin-left">
                                                {getDocIcon(getFileType(formData.fileName), formData.fileName, 'sm')}
                                            </div>
                                            {formData.fileName}
                                        </>
                                    ) : (
                                        getTranslation('MSG_NO_FILE_CHOSEN', currentLanguage)
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_DOC_NAME', currentLanguage)}</label>
                                <input
                                    className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:border-[var(--primary-color)] outline-none"
                                    placeholder={getTranslation('PLACEHOLDER_RENAME_DOC', currentLanguage)}
                                    value={formData.docName}
                                    onChange={e => setFormData({ ...formData, docName: e.target.value })}
                                />
                            </div>
                        </>
                    )}

                    {activeTab === 'DRAG' && (
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-sm h-48 flex flex-col items-center justify-center transition-colors ${isDragging ? 'border-[var(--primary-color)] bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                        >
                            <Upload className={`w-10 h-10 mb-2 ${isDragging ? 'text-[var(--primary-color)]' : 'text-gray-400'}`} />
                            <p className={`text-sm font-bold ${isDragging ? 'text-[var(--primary-color)]' : 'text-gray-600'}`}>
                                {isDragging ? getTranslation('MSG_DROP_FILE', currentLanguage) : getTranslation('MSG_DRAG_DROP', currentLanguage)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">{getTranslation('MSG_SUPPORTED_FILES', currentLanguage)}</p>
                        </div>
                    )}

                    {activeTab === 'LINK' && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_EXTERNAL_URL', currentLanguage)}</label>
                                <input
                                    className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:border-[var(--primary-color)] outline-none"
                                    placeholder="https://"
                                    value={formData.url}
                                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_LINK_NAME', currentLanguage)}</label>
                                <input
                                    className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:border-[var(--primary-color)] outline-none"
                                    placeholder={getTranslation('PLACEHOLDER_DISPLAY_NAME', currentLanguage)}
                                    value={formData.docName}
                                    onChange={e => setFormData({ ...formData, docName: e.target.value })}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3">
                    <button type="button" onClick={onCancel} className="btn-secondary inline-flex items-center justify-center gap-2">{getTranslation('BTN_CANCEL', currentLanguage)}</button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className={`btn-primary inline-flex items-center justify-center gap-2 transition-opacity ${((activeTab === 'UPLOAD' && !formData.fileName) || (activeTab === 'LINK' && !formData.url))
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:opacity-90'
                            }`}
                        disabled={(activeTab === 'UPLOAD' && !formData.fileName) || (activeTab === 'LINK' && !formData.url)}
                    >
                        {getTranslation('BTN_UPLOAD', currentLanguage)}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// 2. EDIT DOCUMENT MODAL (Using NewsEditor Structure)
export const DocumentEditor = ({
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
    const { uploadImage, currentLanguage, uiLabels, images, siteConfig, webStudioUserRole } = useStore();
    const hidePublishingControls = !canPublishContent(webStudioUserRole);
    const optionalTranslationLanguages = useMemo(
        () => getOptionalEnabledLanguages(siteConfig),
        [siteConfig?.languages]
    );
    const translationLanguage = optionalTranslationLanguages[0] ?? null;
    const translationLanguageLabel = translationLanguage
        ? (LANGUAGE_DISPLAY_NAMES[translationLanguage] ?? translationLanguage.toUpperCase())
        : '';
    const showTranslationTab = optionalTranslationLanguages.length > 0;
    const [isTranslating, setIsTranslating] = useState(false);
    const [activeTab, setActiveTab] = useState('BASIC');
    useEffect(() => {
        if (activeTab === 'TRANSLATION' && !showTranslationTab) {
            setActiveTab('BASIC');
        }
    }, [activeTab, showTranslationTab]);
    const [formData, setFormData] = useState<any>({
        ...item,
        name: item.name || item.title, // Initialize name from existing name or title
        imageUrl: item.imageUrl || '',
        imageName: item.imageName || '',
        translations: item.translations || { en: { title: '', description: '', readMoreText: '' } },
    });

    useEffect(() => {
        if (item && item.id && !String(item.id).startsWith('doc_')) {
            setFormData((p: any) => ({
                ...p,
                ...item,
                id: item.id,
                name: item.name || item.title || p.name,
            }));
        }
    }, [item]);

    useEffect(() => {
        let cancelled = false;
        const id = formData.id || item.id;
        if (!id || String(id).startsWith('doc_') || !Number.isFinite(Number(id))) return undefined;
        if (formData.createdDate && formData.modifiedDate) return undefined;

        const applyMetadata = (source: Partial<DocumentItem>) => {
            if (cancelled || !source.createdDate) return;
            setFormData((p: any) => ({
                ...p,
                createdDate: source.createdDate ?? p.createdDate,
                createdBy: source.createdBy ?? p.createdBy,
                modifiedDate: source.modifiedDate ?? p.modifiedDate,
                modifiedBy: source.modifiedBy ?? p.modifiedBy,
            }));
        };

        const fromStore = useStore.getState().documents.find((doc) => doc.id === String(id));
        if (fromStore?.createdDate) {
            applyMetadata(fromStore);
            return undefined;
        }

        void (async () => {
            try {
                const { getDocumentById } = await import(/* webpackChunkName: 'sp-service' */ '../../services/SPService');
                const spItem = await getDocumentById(Number(id));
                applyMetadata({
                    createdBy: spItem.Author?.Title || 'System',
                    modifiedBy: spItem.Editor?.Title || 'System',
                    createdDate: spItem.Created,
                    modifiedDate: spItem.Modified || spItem.Created,
                });
            } catch (error) {
                console.error('Failed to load document metadata:', error);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [formData.id, formData.createdDate, formData.modifiedDate, item.id]);

    const updateField = (key: string, val: any) => setFormData((p: any) => ({ ...p, [key]: val }));
    const patchFormData = (patch: Record<string, unknown>) => setFormData((p: any) => ({ ...p, ...patch }));
    const updateUebersetzung = (lang: string, key: string, val: string) => setFormData((p: any) => ({ ...p, translations: { ...p.translations, [lang]: { ...p.translations?.[lang], [key]: val } } }));

    const suggestUebersetzung = async () => {
        if (!translationLanguage) return;
        setIsTranslating(true);
        try {
            const { translateText } = await import(/* webpackChunkName: 'gemini-service' */ '../../services/geminiService');
            const [translatedTitle, translatedDesc, translatedReadMore] = await Promise.all([
                formData.title ? translateText(formData.title, translationLanguage) : '',
                formData.description ? translateText(formData.description, translationLanguage) : '',
                formData.readMore?.text ? translateText(formData.readMore.text, translationLanguage) : ''
            ]);

            setFormData((p: any) => ({
                ...p,
                translations: {
                    ...p.translations,
                    [translationLanguage]: {
                        ...p.translations?.[translationLanguage],
                        title: translatedTitle || p.translations?.[translationLanguage]?.title || '',
                        description: translatedDesc || p.translations?.[translationLanguage]?.description || '',
                        readMoreText: translatedReadMore || p.translations?.[translationLanguage]?.readMoreText || ''
                    }
                }
            }));
        } catch (error) {
            console.error("Uebersetzung Error", error);
        } finally {
            setIsTranslating(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in zoom-in-95 duration-200" style={{ zIndex: getNestedPortalZFromStore(10) }}>
            <div className="bg-white w-[1000px] shadow-2xl rounded-sm border border-gray-300 flex flex-col h-[90vh] min-h-[90vh] max-h-[90vh] overflow-hidden">
                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0 gap-4">
                    <h3 className="font-bold text-[var(--primary-color)] min-w-0 truncate flex-1">{getLocalizedText(uiLabels.TITLE_EDIT_DOC, currentLanguage)} - {formData.title}</h3>
                    <div className="flex items-center gap-3 shrink-0">
                        <TooltipMenu ComponentId={'942'} />
                        <button onClick={onCancel} className="text-gray-400 hover:text-red-500"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="flex border-b border-gray-200 px-6 bg-white flex-shrink-0 gap-6">
                    {['BASIC INFORMATION', 'IMAGE INFORMATION', ...(showTranslationTab ? ['TRANSLATION'] : [])].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab.split(' ')[0])}
                            className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === tab.split(' ')[0] ? 'border-[var(--primary-color)] text-[var(--primary-color)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            {tab === 'BASIC INFORMATION' ? getLocalizedText(uiLabels.TAB_BASIC_INFO, currentLanguage) :
                                tab === 'IMAGE INFORMATION' ? getLocalizedText(uiLabels.TAB_IMAGE_INFO, currentLanguage) :
                                    getLocalizedText(uiLabels.TAB_TRANSLATION, currentLanguage)}
                        </button>
                    ))}
                </div>

                <div className="p-8 overflow-y-auto flex-1 bg-gray-50/50">
                    {activeTab === 'BASIC' && (
                        <div className="space-y-6 bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_FILE_NAME', currentLanguage)}</label>
                                    <div className="flex items-center border border-gray-300 rounded-sm overflow-hidden bg-white">
                                        <input
                                            className="w-full p-2.5 text-sm outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                                            value={formData.name}
                                            onChange={e => updateField('name', e.target.value)}
                                            title={getTranslation('MSG_RENAME_WARNING', currentLanguage)}
                                        />
                                        {/* <span className="px-3 text-xs text-gray-400 bg-gray-50 border-l border-gray-200 h-full flex items-center">.docx</span> */}
                                    </div>
                                    <span className="text-xs text-gray-500 mt-1">{getTranslation('MSG_RENAME_WARNING', currentLanguage)}</span>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_YEAR', currentLanguage)}</label>
                                    <select className="w-full border border-gray-300 p-2.5 text-sm rounded-sm bg-white" value={formData.year} onChange={e => updateField('year', e.target.value)}>
                                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                {!hidePublishingControls && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_STATUS', currentLanguage)}</label>
                                    <select className="w-full border border-gray-300 p-2.5 text-sm rounded-sm bg-white" value={formData.status} onChange={e => updateField('status', e.target.value)}>
                                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_ITEM_RANK', currentLanguage)}</label>
                                    <select className="w-full border border-gray-300 p-2.5 text-sm rounded-sm bg-white" value={formData.itemRank ?? ''} onChange={e => updateField('itemRank', (e.target.value === '' ? '' : Number(e.target.value)) as any)}>
                                        <option value="">Elementrang auswaehlen</option>
                                        <option value="8">(8) Top Highlights</option>
                                        <option value="7">(7) Featured Item</option>
                                        <option value="6">(6) Key Item</option>
                                        <option value="5">(5) Relevant Item</option>
                                        <option value="4">(4) Background Item</option>
                                        <option value="2">(2) to be verified</option>
                                        <option value="1">(1) Archive</option>
                                        <option value="0">(0) No Show</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_TITLE', currentLanguage)}</label>
                                    <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none" value={formData.title} onChange={e => updateField('title', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_SORT_ORDER', currentLanguage)}</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            className="flex-1 min-w-0 border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            placeholder="0"
                                            value={formData.sortOrder || 0}
                                            onChange={e => updateField('sortOrder', Number(e.target.value))}
                                        />
                                        <ItemEditorChangeOrderButton
                                            context={changeOrderContext}
                                            activeItemId={formData.id}
                                        />
                                    </div>
                                </div>
                            </div>

                            <ItemTaggingLookupFields itemId={String(formData.id)} listName="Documents" />

                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={formData.readMore?.enabled || false} onChange={e => setFormData({ ...formData, readMore: { ...formData.readMore, enabled: e.target.checked } })} className="rounded-sm text-[var(--primary-color)] focus:ring-[var(--primary-color)]" />
                                <label className="text-sm text-gray-700">{getTranslation('LABEL_ADD_READ_MORE', currentLanguage)}</label>
                            </div>

                            {formData.readMore?.enabled && (
                                <div className="grid grid-cols-2 gap-6 pl-6 border-l-2 border-gray-100">
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
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_LINK_TEXT', currentLanguage)}</label>
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
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_DESC', currentLanguage)}</label>
                                <JoditRichTextEditor
                                    value={formData.description}
                                    onChange={(newValue: any) => updateField('description', newValue)}
                                    placeholder={getTranslation('PLACEHOLDER_DESC', currentLanguage)}
                                    height={200}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'IMAGE' && (
                        <EditorImageTabPanel
                            uploadImage={uploadImage}
                            images={images}
                            folderId="Pictures"
                            titleForNaming={formData.title}
                            namingFallback="Document"
                            imageUrl={formData.imageUrl || ''}
                            imageName={formData.imageName || ''}
                            updateField={updateField}
                            patchFormData={patchFormData}
                            activeTab={activeTab}
                            currentLanguage={currentLanguage}
                            getGlobalDefaultImage={getGlobalDefaultImage}
                            emptyStateIcon={<FileText className="w-8 h-8 text-gray-300" />}
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
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-300"></span> {getTranslation('LABEL_ORIGINAL_ENGLISH', currentLanguage)}</div>
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[var(--primary-color)]"></span> {getTranslation('LABEL_TRANSLATION', currentLanguage)} ({translationLanguageLabel})</div>
                                </div>
                                <button onClick={suggestUebersetzung} disabled={isTranslating} className={`bg-purple-100 text-purple-700 px-3 py-1.5 rounded-sm text-xs font-bold flex items-center gap-2 hover:bg-purple-200 transition-colors ${isTranslating ? 'opacity-50 cursor-wait' : ''}`}>
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
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_READ_MORE', currentLanguage)}</label>
                                        <input className="w-full border border-gray-300 p-2 text-sm bg-gray-50" value={formData.readMore?.text || ''} readOnly />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_DESCRIPTION', currentLanguage)}</label>
                                        <div className="border border-gray-300 p-2 bg-gray-50 min-h-[150px]">
                                            <div className="text-sm" dangerouslySetInnerHTML={{ __html: formData.description }}></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Uebersetzung */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_TRANSLATED_TITLE', currentLanguage)}</label>
                                        <input
                                            className="w-full border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            placeholder="Enter translated title..."
                                            value={formData.translations[translationLanguage]?.title || ''}
                                            onChange={e => updateUebersetzung(translationLanguage, 'title', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_TRANSLATED_READ_MORE', currentLanguage)}</label>
                                        <input
                                            className="w-full border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            placeholder="Enter translated read more text..."
                                            value={formData.translations[translationLanguage]?.readMoreText || ''}
                                            onChange={e => updateUebersetzung(translationLanguage, 'readMoreText', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_TRANSLATED_DESC', currentLanguage)}</label>
                                        <JoditRichTextEditor
                                            value={formData.translations[translationLanguage]?.description || ''}
                                            onChange={(newValue: any) => updateUebersetzung(translationLanguage, 'description', newValue)}
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
                                listTitle="Documents"
                                itemId={formData.id}
                                itemTitle={formData.title}
                                createdDate={formData.createdDate}
                                createdBy={formData.createdBy}
                                modifiedDate={formData.modifiedDate}
                                modifiedBy={formData.modifiedBy}
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
                            <button type="button" onClick={() => onSave(hidePublishingControls ? { ...formData, status: item.status || 'Draft' } : formData)} className="btn-primary inline-flex items-center justify-center gap-2 capitalize transition-opacity hover:opacity-90">
                                {getTranslation('BTN_SAVE', currentLanguage)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- MAIN DOCUMENT MANAGER ---
export const DocumentManager = ({ onClose }: any) => {
    const { documents, addDocument, updateDocument, deleteDocument, currentLanguage, uiLabels } = useStore();
    const [view, setView] = useState<'VISUAL' | 'LIST'>('VISUAL');
    const [showFilters, setShowFilters] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'title', direction: 'asc' });
    const [activeFilters, setActiveFilters] = useState({
        types: [] as string[],
        years: [] as string[],
        status: [] as string[]
    });

    // Use documents from store
    const allDocs = [...documents];

    // Filter Logic
    const filteredDocs = allDocs.filter(doc => {
        const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = activeFilters.types.length === 0 || activeFilters.types.includes(doc.type === 'PPT' ? 'Presentations' : doc.type);
        const matchesYear = activeFilters.years.length === 0 || activeFilters.years.includes(doc.year);
        const matchesStatus = activeFilters.status.length === 0 || activeFilters.status.includes(doc.status);
        return matchesSearch && matchesType && matchesYear && matchesStatus;
    }).sort((a, b) => {
        const valA = (a as any)[sortConfig.key];
        const valB = (b as any)[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const toggleFilter = (category: 'types' | 'years' | 'status', value: string) => {
        setActiveFilters(prev => ({
            ...prev,
            [category]: prev[category].includes(value)
                ? prev[category].filter(i => i !== value)
                : [...prev[category], value]
        }));
    };

    const clearFilters = () => setActiveFilters({ types: [], years: [], status: [] });

    const handleSaveDoc = async (doc: DocumentItem) => {
        await (doc.id ? updateDocument(doc) : addDocument({ ...doc, id: `doc_${Date.now()}` }));
        setShowAdd(false);
        setEditingItem(null);
    };

    const handleDelete = (id: string) => {
        deleteDocument(id);
        setDeleteId(null);
        setEditingItem(null);
    };

    const customFooter = (
        <div className="flex justify-between w-full items-center">
            <OpenOOTBButton listTitle="Documents" isLibrary={true} />
            <button type="button" onClick={onClose} className="btn-secondary inline-flex items-center justify-center gap-1">
                {getTranslation('BTN_CLOSE', currentLanguage)}
            </button>
        </div>
    );

    return (
        <GenericModal
            className="document-management-popup"
            title={getLocalizedText(uiLabels.DOC_MGMT, currentLanguage)}
            onClose={onClose}
            width="w-[80vw] min-w-[80vw] max-w-[80vw]"
            noFooter={true}
            customFooter={customFooter}
            headerIcons={
                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500 mr-2 hidden md:inline">{getLocalizedText(uiLabels.DESC_DOC_MGMT, currentLanguage)}</span>
                    <div className="flex border border-[var(--primary-color)] rounded-sm overflow-hidden shadow-sm h-8">
                        <button type="button" onClick={() => setView('VISUAL')} className={`ws-view-toggle-label-btn px-3 text-xs font-bold flex items-center gap-2 transition-colors ${view === 'VISUAL' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-blue-50'}`}><Monitor className="w-3 h-3" /> {getLocalizedText(uiLabels.LABEL_VISUAL_VIEW, currentLanguage)}</button>
                        <button type="button" onClick={() => setView('LIST')} className={`ws-view-toggle-label-btn px-3 text-xs font-bold flex items-center gap-2 transition-colors ${view === 'LIST' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-blue-50'}`}><ListIcon className="w-3 h-3" /> {getLocalizedText(uiLabels.LABEL_LIST_VIEW, currentLanguage)}</button>
                    </div>
                    <HelpCircle onClick={() => setShowHelp(true)} className="w-5 h-5 text-gray-400 cursor-pointer hover:text-[var(--primary-color)]" />
                    <TooltipMenu ComponentId={'759'} />
                </div>
            }
        >
            <div className="flex flex-col h-full bg-white">

                {/* TOP TOOLBAR */}
                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0 gap-4">
                    <div className="flex-1 max-w-lg flex gap-2">
                        <div className="relative flex-1 group">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 z-10" />
                            <input
                                placeholder={getLocalizedText(uiLabels.LABEL_SEARCH_DOCS, currentLanguage)}
                                className="border border-gray-300 p-2.5 pl-10 pr-9 text-sm w-full focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded-sm relative z-0"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors z-10"
                                    title={getLocalizedText(uiLabels.BTN_CLEAR_SEARCH, currentLanguage)}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowFilters(!showFilters)}
                            className={`ws-compact-toolbar-btn px-4 py-2 flex items-center gap-2 text-sm font-bold border rounded-sm transition-colors ${showFilters ? 'bg-[var(--btn-primary-bg)] text-white border-[var(--btn-primary-bg)]' : 'bg-[var(--btn-primary-bg)] text-white hover:bg-opacity-90 border-[var(--btn-primary-bg)]'}`}
                        >
                            <Filter className="w-4 h-4" /> {getTranslation('BTN_FILTERS', currentLanguage)}
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span>{getLocalizedText(uiLabels.LABEL_SORT_BY, currentLanguage)}</span>
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
                                    <option value="title">{getLocalizedText(uiLabels.LABEL_TITLE, currentLanguage)}</option>
                                    <option value="date">{getLocalizedText(uiLabels.LABEL_PUBLISH_DATE, currentLanguage)}</option>
                                    <option value="status">{getLocalizedText(uiLabels.LABEL_STATUS, currentLanguage)}</option>
                                </select>
                                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
                            </div>
                            <button
                                type="button"
                                onClick={() => setSortConfig(p => ({ ...p, direction: p.direction === 'asc' ? 'desc' : 'asc' }))}
                                className="p-1.5 border border-gray-300 rounded-sm hover:bg-[var(--brand-light)]"
                                style={{ color: 'var(--primary-color)' }}
                                title={sortConfig.direction === 'asc' ? getTranslation('BTN_SORT_ASCENDING', currentLanguage) : getTranslation('BTN_SORT_DESCENDING', currentLanguage)}
                            >
                                {sortConfig.direction === 'asc' ? <ArrowUpAZ className="w-4 h-4" /> : <ArrowDownAZ className="w-4 h-4" />}
                            </button>
                        </div>

                        <button type="button" onClick={() => setShowAdd(true)} className="ws-compact-toolbar-btn bg-[var(--btn-primary-bg)] text-white px-4 py-2 text-sm font-bold hover:opacity-90 shadow-sm rounded-sm flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            {getLocalizedText(uiLabels.BTN_ADD_DOCUMENT, currentLanguage)}
                        </button>
                    </div>
                </div>

                {/* FILTER PANEL */}
                {showFilters && (
                    <div className="border-b border-gray-200 bg-gray-50 p-6 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-3 gap-12 text-sm">
                            <div>
                                <h5 className="font-bold text-[var(--primary-color)] mb-3">{getTranslation('LABEL_DOC_TYPES', currentLanguage)}</h5>
                                <div className="space-y-2">
                                    {DOC_TYPES.map(type => (
                                        <label key={type} className="flex items-center gap-2 cursor-pointer hover:text-gray-900 text-gray-600">
                                            <input type="checkbox" className="rounded-sm text-[var(--primary-color)] focus:ring-[var(--primary-color)]" checked={activeFilters.types.includes(type)} onChange={() => toggleFilter('types', type)} />
                                            {type}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h5 className="font-bold text-[var(--primary-color)] mb-3">{getTranslation('LABEL_YEAR', currentLanguage)}</h5>
                                <div className="grid grid-cols-2 gap-2">
                                    {YEARS.map(year => (
                                        <label key={year} className="flex items-center gap-2 cursor-pointer hover:text-gray-900 text-gray-600">
                                            <input type="checkbox" className="rounded-sm text-[var(--primary-color)] focus:ring-[var(--primary-color)]" checked={activeFilters.years.includes(year)} onChange={() => toggleFilter('years', year)} />
                                            {year}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="relative">
                                <h5 className="font-bold text-[var(--primary-color)] mb-3">{getTranslation('LABEL_STATUS', currentLanguage)}</h5>
                                <div className="space-y-2">
                                    {STATUSES.map(status => (
                                        <label key={status} className="flex items-center gap-2 cursor-pointer hover:text-gray-900 text-gray-600">
                                            <input type="checkbox" className="rounded-sm text-[var(--primary-color)] focus:ring-[var(--primary-color)]" checked={activeFilters.status.includes(status)} onChange={() => toggleFilter('status', status)} />
                                            {status}
                                        </label>
                                    ))}
                                </div>
                                <button onClick={clearFilters} className="absolute bottom-0 right-0 px-4 py-2 border border-[var(--primary-color)] text-[var(--primary-color)] text-xs font-bold hover:bg-[var(--brand-light)] rounded-sm flex items-center gap-1">
                                    {getTranslation('BTN_CLEAR_FILTERS', currentLanguage)}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* CONTENT AREA */}
                <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
                    {view === 'VISUAL' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {filteredDocs.map((doc: any) => (
                                <div key={doc.id} className="bg-white border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all rounded-sm flex items-center gap-4 group relative">
                                    <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-sm flex items-center justify-center flex-shrink-0">
                                        {getDocIcon(doc.type, getDocFileName(doc.name, doc.url), 'md')}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-gray-800 truncate pr-4 mb-2">{getItemTranslation(doc, currentLanguage, 'title')}</h4>
                                            <span className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${doc.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {doc.status === 'Published'
                                                    ? getTranslation('STATUS_PUBLISHED', currentLanguage)
                                                    : getTranslation('STATUS_DRAFT', currentLanguage)}
                                            </span>
                                        </div>
                                        <DocumentDateTimeDisplay date={doc.date} layout="inline" />
                                    </div>
                                    <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditingItem(doc)} className="p-1.5 hover:bg-gray-100 rounded-sm" style={{ color: 'var(--icon-color)' }}><Pencil className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => setDeleteId(doc.id)} className="p-1.5 hover:bg-red-50 rounded-sm" style={{ color: 'var(--icon-color)' }}><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-200 shadow-sm rounded-sm overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 text-gray-600 border-b border-gray-200 text-xs font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 w-16 text-center">{getTranslation('LABEL_FILE_TYPE', currentLanguage)}</th>
                                        <th className="px-6 py-4">{getTranslation('LABEL_DOC_NAME', currentLanguage)}</th>
                                        <th className="px-6 py-4 w-52">{getTranslation('LABEL_DATE', currentLanguage)}</th>
                                        <th className="px-6 py-4 w-32">{getTranslation('LABEL_STATUS', currentLanguage)}</th>
                                        <th className="px-6 py-4 text-right w-32">{getTranslation('TH_ACTIONS', currentLanguage)}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredDocs.map((doc: any) => (
                                        <tr key={doc.id} className="hover:bg-[var(--brand-light)] transition-colors group">
                                            <td className="p-3 text-center">
                                                <div className="w-8 h-8 mx-auto flex items-center justify-center">
                                                    {getDocIcon(doc.type, getDocFileName(doc.name, doc.url), 'sm')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-800 text-sm mb-2">{getItemTranslation(doc, currentLanguage, 'title')}</div>
                                                <div className="text-xs text-gray-500 line-clamp-1">{stripHtml(getItemTranslation(doc, currentLanguage, 'description')) || stripHtml(doc.description) || 'No description'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                <DocumentDateTimeDisplay date={doc.date} layout="stacked" />
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full inline-block ${doc.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {doc.status === 'Published'
                                                        ? getTranslation('STATUS_PUBLISHED', currentLanguage)
                                                        : getTranslation('STATUS_DRAFT', currentLanguage)}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setEditingItem(doc)} className="p-1.5 hover:bg-blue-50 rounded-sm" style={{ color: 'var(--icon-color)' }}><Pencil className="w-4 h-4" /></button>
                                                    <button onClick={() => setDeleteId(doc.id)} className="p-1.5 hover:bg-red-50 rounded-sm" style={{ color: 'var(--icon-color)' }}><Trash2 className="w-4 h-4" /></button>
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

            {/* Sub Modals */}
            {showAdd && <AddDocumentModal onSave={handleSaveDoc} onCancel={() => setShowAdd(false)} />}
            {showHelp && <HelpGuideDocModal onClose={() => setShowHelp(false)} />}
            {editingItem && <DocumentEditor item={editingItem} onSave={handleSaveDoc} onCancel={() => setEditingItem(null)} onDelete={(id: string) => setDeleteId(id)} />}
            {deleteId && <ConfirmDeleteDialog title={getLocalizedText(uiLabels.TITLE_DELETE_DOC, currentLanguage)} message={getLocalizedText(uiLabels.MSG_CONFIRM_DELETE_DOC, currentLanguage)} onConfirm={() => handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />}
        </GenericModal>
    );
};
