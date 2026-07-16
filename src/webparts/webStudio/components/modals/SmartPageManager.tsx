
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore, getLocalizedText, getTranslation, getGlobalDefaultImage } from '../../store';
import { getNestedPortalZFromStore } from '../../utils/modalZIndex';
import { resolveGalleryDefaultImage } from '../../utils/defaultImageUrl';
import { translateText } from '../../services/geminiService';
import { Page, MultilingualText } from '../../types';
import { MODAL_Z } from '../../utils/modalZIndex';
import JoditRichTextEditor from '../JoditEditor';
import {
    X, Wand2, Check, Image as ImageIcon, Pencil,
    Upload, Copy, Search, Globe
} from 'lucide-react';
import { SharePointMetadataFooter } from '../common/SharePointMetadataFooter';
import TooltipMenu from '../common/TooltipMenu';
import EditorImageTabPanel from '../common/EditorImageTabPanel';
import { ItemTaggingLookupFields } from '../common/ItemTaggingLookupFields';
import { getOptionalEnabledLanguages, LANGUAGE_DISPLAY_NAMES } from '../../utils/siteLanguages';
import { canPublishContent, canManageSeoSettings } from '../../utils/templatePermissions';
import { TranslationLanguagesEmptyState } from '../common/TranslationLanguagesEmptyState';

export const SmartPageEditor = ({
    item,
    onSave,
    onCancel,
    onDelete
}: {
    item: Page,
    onSave: (p: Page) => void,
    onCancel: () => void,
    onDelete?: (id: string) => void
}) => {
    const { currentLanguage, images, uploadImage, siteConfig, webStudioUserRole } = useStore();
    const hidePublishingControls = !canPublishContent(webStudioUserRole);
    const showSeoTab = canManageSeoSettings(webStudioUserRole);
    const optionalTranslationLanguages = useMemo(
        () => getOptionalEnabledLanguages(siteConfig),
        [siteConfig?.languages]
    );
    const translationLanguage = optionalTranslationLanguages[0] ?? null;
    const translationTargetLabel = translationLanguage
        ? (LANGUAGE_DISPLAY_NAMES[translationLanguage] ?? translationLanguage.toUpperCase())
        : '';
    const showTranslationTab = optionalTranslationLanguages.length > 0;
    const [activeTab, setActiveTab] = useState<'BASIC' | 'IMAGE' | 'SEO' | 'TRANSLATION'>('BASIC');
    useEffect(() => {
        if (activeTab === 'TRANSLATION' && !showTranslationTab) {
            setActiveTab('BASIC');
        }
        if (activeTab === 'SEO' && !showSeoTab) {
            setActiveTab('BASIC');
        }
    }, [activeTab, showTranslationTab, showSeoTab]);
    const [formData, setFormData] = useState<Page>({ ...item });
    const [isTranslating, setIsTranslating] = useState(false);

    // Sync formData when item changes (Fixes "previously opened modal" bug)
    useEffect(() => {
        setFormData({ ...item });
    }, [item]);

    const updateField = (field: keyof Page, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
    const patchFormData = (patch: Record<string, unknown>) => {
        setFormData(prev => ({ ...prev, ...patch }));
    };

    const updateTitle = (lang: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            title: { ...prev.title, [lang]: value }
        }));
    };

    const updateSeo = (field: 'title' | 'description' | 'keywords', value: string) => {
        setFormData(prev => ({
            ...prev,
            seo: { ...(prev.seo || { title: '', description: '', keywords: '' }), [field]: value }
        }));
    };

    const handleSave = () => {
        onSave({
            ...formData,
            status: hidePublishingControls ? (item.status || formData.status || 'Draft') : formData.status,
            modifiedDate: new Date().toISOString()
        });
    };

    const suggestSeo = () => {
        const baseTitle = getLocalizedText(formData.title, 'en');
        const siteName = (siteConfig.name || '').trim();
        const seoTitle = siteName ? `${baseTitle} | ${siteName}` : baseTitle;
        const plainDescription = (formData.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        updateSeo('title', seoTitle);
        updateSeo(
            'description',
            plainDescription
                ? plainDescription.slice(0, 160)
                : `Learn more about ${baseTitle}${siteName ? ` at ${siteName}` : ''}.`
        );
        updateSeo('keywords', `${baseTitle.toLowerCase().split(' ').join(', ')}, ${siteName || 'corporate'}, info`);
    };

    const suggestUebersetzungData = async () => {
        if (!translationLanguage) return;
        setIsTranslating(true);
        try {
            const translatedTitle = await translateText(formData.title.en, translationLanguage);
            const translatedDesc = formData.description ? await translateText(formData.description, translationLanguage) : '';

            if (translatedTitle) {
                setFormData(prev => ({
                    ...prev,
                    title: { ...prev.title, [translationLanguage]: translatedTitle },
                    description: translatedDesc || prev.description
                }));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsTranslating(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in zoom-in-95 duration-200" style={{ zIndex: getNestedPortalZFromStore(0) }}>
            <div className="bg-white w-[80vw] min-w-[80vw] max-w-[80vw] shadow-2xl rounded-sm border border-gray-300 flex flex-col h-[90vh] min-h-[90vh] max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0">
                    <h3 className="text-xl font-bold text-[var(--primary-color)]">
                        {getTranslation('TITLE_EDIT_PAGE_INFO', currentLanguage)} - {getLocalizedText(formData.title, currentLanguage)}
                    </h3>
                    <div className="flex items-center gap-4">
                        <TooltipMenu ComponentId={'13828'} />
                        <button onClick={onCancel} className="text-gray-400 hover:text-red-500 transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-6 bg-white flex-shrink-0 gap-6">
                    {[
                        { id: 'BASIC', label: getTranslation('TAB_BASIC_INFO', currentLanguage) },
                        { id: 'IMAGE', label: getTranslation('TAB_IMAGE_INFO', currentLanguage) },
                        ...(showSeoTab ? [{ id: 'SEO', label: getTranslation('TAB_SEO', currentLanguage) }] : []),
                        ...(showTranslationTab ? [{ id: 'TRANSLATION', label: getTranslation('TAB_TRANSLATION', currentLanguage) }] : []),
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === tab.id ? 'border-[var(--primary-color)] text-[var(--primary-color)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="p-8 overflow-y-auto flex-1 bg-gray-50/50">
                    {activeTab === 'BASIC' && (
                        <div className="space-y-6 bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_TITLE_ENGLISH', currentLanguage)}</label>
                                    <input
                                        className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                        value={formData.title.en}
                                        onChange={e => updateTitle('en', e.target.value)}
                                    />
                                </div>
                                {!hidePublishingControls && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_STATUS', currentLanguage)}</label>
                                    <select
                                        className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none bg-white"
                                        value={formData.status}
                                        onChange={e => updateField('status', e.target.value)}
                                    >
                                        <option value="Draft">{getTranslation('LABEL_DRAFT', currentLanguage)}</option>
                                        <option value="Published">{getTranslation('LABEL_PUBLISHED', currentLanguage)}</option>
                                    </select>
                                </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_SLUG_URL_PATH', currentLanguage)}</label>
                                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 p-2.5 rounded-sm">
                                        <Globe className="w-4 h-4 text-gray-400" />
                                        <input
                                            className="w-full bg-transparent text-sm outline-none text-gray-600 font-mono"
                                            value={formData.slug}
                                            readOnly
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_SORT_ORDER', currentLanguage)}</label>
                                        <input
                                            type="number"
                                            className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            value={formData.sortOrder || 0}
                                            onChange={e => updateField('sortOrder', parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div className="flex items-center pt-5 gap-2">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-[var(--primary-color)] rounded-sm border-gray-300"
                                            checked={formData.isHomePage}
                                            onChange={e => updateField('isHomePage', e.target.checked)}
                                        />
                                        <label className="text-sm font-bold text-gray-700">{getTranslation('LABEL_SET_AS_HOME', currentLanguage)}</label>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_ORIGINAL_DESC', currentLanguage)}</label>
                                <JoditRichTextEditor
                                    value={formData.description || ''}
                                    onChange={(newValue: any) => updateField('description', newValue)}
                                    placeholder={getTranslation('PLACEHOLDER_ORIGINAL_DESCRIPTION', currentLanguage)}
                                    height={200}
                                />
                            </div>

                            <ItemTaggingLookupFields itemId={String(formData.id)} listName="SmartPages" />
                        </div>
                    )}

                    {activeTab === 'IMAGE' && (
                        <EditorImageTabPanel
                            uploadImage={uploadImage}
                            images={images}
                            folderId="SmartPages"
                            titleForNaming={getLocalizedText(formData.title, 'en')}
                            namingFallback="Page"
                            imageUrl={formData.imageUrl || ''}
                            imageName={formData.imageName || ''}
                            updateField={updateField}
                            patchFormData={patchFormData}
                            activeTab={activeTab}
                            currentLanguage={currentLanguage}
                            getGlobalDefaultImage={getGlobalDefaultImage}
                            urlLabelKey="LABEL_THUMBNAIL_IMAGE_URL"
                        />
                    )}

                    {activeTab === 'SEO' && (
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm space-y-6">
                            <div className="flex justify-end">
                                <button onClick={suggestSeo} className="bg-[var(--btn-primary-bg)] text-white px-4 py-2 text-xs font-bold flex items-center gap-2 hover:opacity-90 shadow-sm transition-all rounded-sm active:scale-95">
                                    <Wand2 className="w-3 h-3" /> {getTranslation('BTN_SUGGEST_AI', currentLanguage)}
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_SEO_TITLE', currentLanguage)}</label>
                                    <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm outline-none focus:ring-1 focus:ring-[var(--primary-color)]" value={formData.seo?.title || ''} onChange={e => updateSeo('title', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_META_DESC', currentLanguage)}</label>
                                    <textarea className="w-full border border-gray-300 p-2.5 text-sm rounded-sm outline-none h-24 resize-none focus:ring-1 focus:ring-[var(--primary-color)]" value={formData.seo?.description || ''} onChange={e => updateSeo('description', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_KEYWORDS', currentLanguage)}</label>
                                    <input className="w-full border border-gray-300 p-2.5 text-sm rounded-sm outline-none focus:ring-1 focus:ring-[var(--primary-color)]" value={formData.seo?.keywords || ''} onChange={e => updateSeo('keywords', e.target.value)} placeholder={getTranslation('PLACEHOLDER_SEO_KEYWORDS_EXAMPLE', currentLanguage)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'TRANSLATION' && (
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            {!translationLanguage ? (
                                <TranslationLanguagesEmptyState />
                            ) : (
                        <>
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex gap-8 text-xs font-bold text-gray-500 uppercase">
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-300"></span> {getTranslation('LABEL_ORIGINAL_ENGLISH', currentLanguage)}</div>
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-600"></span> {getTranslation('LABEL_TRANSLATION', currentLanguage)} ({translationTargetLabel})</div>
                                </div>
                                <button
                                    onClick={suggestUebersetzungData}
                                    disabled={isTranslating}
                                    className={`text-[var(--primary-color)] text-xs font-bold flex items-center gap-2 hover:underline transition-all ${isTranslating ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                    <Wand2 className={`w-3 h-3 ${isTranslating ? 'animate-pulse' : ''}`} /> {isTranslating ? getTranslation('MSG_TRANSLATING', currentLanguage) : getTranslation('BTN_SUGGEST_AI', currentLanguage)}
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-6 opacity-60">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_TITLE', currentLanguage)}</label>
                                        <div className="p-3 bg-gray-50 border border-gray-100 text-sm rounded-sm text-gray-600 font-medium">{formData.title.en}</div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_ORIGINAL_DESC', currentLanguage)}</label>
                                        <div className="p-3 bg-gray-50 border border-gray-100 text-sm rounded-sm text-gray-600 prose prose-sm max-h-40 overflow-y-auto" dangerouslySetInnerHTML={{ __html: formData.description || '' }} />
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_TRANSLATED_TITLE', currentLanguage)}</label>
                                        <input
                                            className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            value={formData.title[translationLanguage] || ''}
                                            onChange={e => updateTitle(translationLanguage, e.target.value)}
                                            placeholder={getTranslation('PLACEHOLDER_TRANSLATED_TITLE_INPUT', currentLanguage)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_TRANSLATED_DESC', currentLanguage)}</label>
                                        <JoditRichTextEditor
                                            value={formData.description || ''}
                                            onChange={(newValue: any) => updateField('description', newValue)}
                                            placeholder={getTranslation('PLACEHOLDER_TRANSLATED_DESCRIPTION', currentLanguage)}
                                            height={200}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 bg-white border-t border-gray-100 px-8 py-4">
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex-1">
                            <SharePointMetadataFooter
                                listTitle="SmartPages"
                                itemId={formData.id}
                                itemTitle={getLocalizedText(formData.title, currentLanguage)}
                                createdDate={item.createdDate || item.modifiedDate}
                                createdBy={item.createdBy}
                                modifiedDate={item.modifiedDate}
                                modifiedBy={item.modifiedBy}
                                onDelete={() => onDelete?.(formData.id)}
                                onVersionRestore={() => {
                                    useStore.getState().loadFromSharePoint();
                                }}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={onCancel} className="btn-secondary inline-flex items-center justify-center gap-2 transition-colors">
                                {getTranslation('BTN_CANCEL', currentLanguage)}
                            </button>
                            <button type="button" onClick={handleSave} className="btn-primary inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90 active:scale-[0.98]">
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

export const CreateSmartPageModal = ({ onSave, onCancel }: { onSave: (p: Partial<Page>) => void, onCancel: () => void }) => {
    const { currentLanguage } = useStore();
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => {
        setSlug('/' + title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, ''));
    }, [title]);

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!title.trim()) {
            setError(true);
            return;
        }

        onSave({
            title: { en: title, de: title, fr: title, es: title } as MultilingualText,
            slug,
            status: 'Draft',
            containers: [],
            modifiedDate: new Date().toISOString(),
            description: '',
            isHomePage: false,
            imageUrl: '',
            imageName: '',
            sortOrder: 0
        });
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(10) }}>
            <div className="bg-white w-[500px] h-auto max-h-[90vh] shadow-2xl rounded-sm border border-gray-300 flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white flex-shrink-0">
                    <h2 className="text-lg font-bold text-[var(--primary-color)]">{getTranslation('TITLE_CREATE_PAGE', currentLanguage)}</h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-red-500 transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-6 space-y-6 overflow-y-auto">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-sm font-medium flex items-center gap-2">
                                {getTranslation('MSG_REQ_TITLE', currentLanguage)}
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_PAGE_TITLE', currentLanguage)} <span className="text-red-500">*</span></label>
                            <input
                                autoFocus
                                className={`w-full border p-2.5 text-sm rounded-sm outline-none transition-shadow ${error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-[var(--primary-color)]'}`}
                                placeholder={getTranslation('PLACEHOLDER_PAGE_TITLE_EXAMPLE', currentLanguage)}
                                value={title}
                                onChange={e => { setTitle(e.target.value); setError(false); }}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_URL_SLUG', currentLanguage)}</label>
                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 p-2.5 rounded-sm">
                                <Globe className="w-4 h-4 text-gray-400" />
                                <input
                                    className="w-full bg-transparent text-sm outline-none text-gray-600 font-mono"
                                    value={slug}
                                    onChange={e => setSlug(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="p-6 border-t border-gray-100 flex gap-3 flex-shrink-0 bg-gray-50/50">
                        <button type="button" onClick={onCancel} className="btn-secondary flex-1 inline-flex items-center justify-center gap-2 transition-colors">
                            {getTranslation('BTN_CANCEL', currentLanguage)}
                        </button>
                        <button
                            type="submit"
                            className="btn-primary flex-1 inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90 active:scale-[0.98]"
                        >
                            {getTranslation('BTN_CREATE_PAGE', currentLanguage)}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
