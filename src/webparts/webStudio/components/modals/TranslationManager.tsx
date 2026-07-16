
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore, getTranslation } from '../../store';
import { useNestedPortalZ, getNestedPortalZFromStore } from '../../utils/modalZIndex';
import { GenericModal, EditTrigger, OpenOOTBButton } from './SharedModals';
import JoditRichTextEditor from '../JoditEditor';
import { translateText } from '../../services/geminiService';
import { X, Search, Globe, Wand2, Save, Loader2 } from 'lucide-react';
import TooltipMenu from '../common/TooltipMenu';
import { getOptionalEnabledLanguages, LANGUAGE_DISPLAY_NAMES } from '../../utils/siteLanguages';

const LANGUAGE_META: Record<string, { label: string; flag: string }> = {
    de: { label: 'German', flag: '🇩🇪' },
    fr: { label: 'French', flag: '🇫🇷' },
    es: { label: 'Spanish', flag: '🇪🇸' },
    en: { label: 'English', flag: '🇬🇧' }
};

// --- EDIT TRANSLATION SUB-MODAL ---
const EditTranslationPopup = ({
    item,
    langCode,
    langLabel,
    fields,
    onClose,
    onSave
}: {
    item: any,
    langCode: string,
    langLabel: string,
    fields: any[],
    onClose: () => void,
    onSave: (val: any) => void
}) => {
    const { currentLanguage } = useStore();
    const [formData, setFormData] = useState<any>(() => {
        const initial: any = {};
        fields.forEach(f => {
            // Get original value
            let original = '';
            if (f.key === 'readMoreText') {
                // Special handling for readMore.text
                original = item.fullItem?.readMore?.text || '';
            } else if (f.subPath) {
                original = item.fullItem?.[f.subPath]?.[f.key] || '';
            } else {
                original = item.fullItem?.[f.key] || item.original || '';
            }

            // Get translation value
            let translation = '';
            if (item.fullItem?.translations?.[langCode]) {
                const val = item.fullItem.translations[langCode];
                if (typeof val === 'string') {
                    if (f.key === 'title') translation = val;
                } else {
                    translation = val[f.key] || '';
                }
            } else if (item.translations?.[langCode]) {
                // For dictionary items
                translation = item.translations[langCode] || '';
            }

            initial[f.key] = { original, translation };
        });
        return initial;
    });

    const [isSuggesting, setIsSuggesting] = useState<string | null>(null);

    const handleAI = async () => {
        setIsSuggesting('all');

        // Translate all fields
        for (const field of fields) {
            const original = formData[field.key].original;
            if (original) {
                const suggestion = await translateText(original, langLabel);
                if (suggestion) {
                    setFormData((prev: any) => ({
                        ...prev,
                        [field.key]: { ...prev[field.key], translation: suggestion }
                    }));
                }
            }
        }

        setIsSuggesting(null);
    };

    const handleFieldChange = (fieldKey: string, value: string) => {
        setFormData((prev: any) => ({
            ...prev,
            [fieldKey]: { ...prev[fieldKey], translation: value }
        }));
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(0) }}>
            <div className="bg-white w-[1000px] shadow-2xl rounded-sm border border-gray-300 flex flex-col relative h-[50vh]">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-[var(--primary-color)]">
                            {getTranslation('TITLE_EDIT_TRANSLATION', currentLanguage)}
                        </h3>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleAI}
                            disabled={isSuggesting !== null}
                            className={`text-[var(--primary-color)] text-sm font-bold flex items-center gap-2 hover:underline ${isSuggesting !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSuggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                            {isSuggesting ? getTranslation('MSG_TRANSLATING', currentLanguage) : getTranslation('BTN_SUGGEST_AI', currentLanguage)}
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="overflow-y-auto p-8 bg-white">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex gap-8 text-xs font-bold text-gray-500 uppercase">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                                {getTranslation('LABEL_ORIGINAL', currentLanguage)}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                {getTranslation('LABEL_TRANSLATION', currentLanguage)} ({langCode.toUpperCase()})
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        {/* Left Column: Original */}
                        <div className="space-y-4 opacity-70 pointer-events-none">
                            {fields.map(field => (
                                <div key={`orig-${field.key}`}>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">{field.label}</label>
                                    {field.type === 'rich' ? (
                                        <div className="border border-gray-300 p-2 bg-gray-50 min-h-[150px]">
                                            <div className="text-sm" dangerouslySetInnerHTML={{ __html: formData[field.key].original }}></div>
                                        </div>
                                    ) : field.type === 'textarea' ? (
                                        <textarea
                                            className="w-full border border-gray-300 p-2 text-sm bg-gray-50 min-h-[100px] resize-none"
                                            value={formData[field.key].original}
                                            readOnly
                                        />
                                    ) : (
                                        <input
                                            className="w-full border border-gray-300 p-2 text-sm bg-gray-50"
                                            value={formData[field.key].original}
                                            readOnly
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Right Column: Translation */}
                        <div className="space-y-4">
                            {fields.map(field => (
                                <div key={`trans-${field.key}`}>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">
                                        {getTranslation('LABEL_TRANSLATED', currentLanguage)} {field.label}
                                    </label>
                                    {field.type === 'rich' ? (
                                        <JoditRichTextEditor
                                            value={formData[field.key].translation}
                                            onChange={(newValue: string) => handleFieldChange(field.key, newValue)}
                                            placeholder={`Enter translated ${field.label.toLowerCase()}...`}
                                            height={150}
                                        />
                                    ) : field.type === 'textarea' ? (
                                        <textarea
                                            className="w-full border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none min-h-[100px] resize-none"
                                            value={formData[field.key].translation}
                                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                            placeholder={`Enter translated ${field.label.toLowerCase()}...`}
                                        />
                                    ) : (
                                        <input
                                            className="w-full border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                            value={formData[field.key].translation}
                                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                            placeholder={`Enter a ${field.label}`}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3 sticky bottom-0 z-10">
                    <button type="button" onClick={onClose} className="btn-secondary inline-flex items-center justify-center gap-2 transition-colors">
                        {getTranslation('BTN_CANCEL', currentLanguage)}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const result: any = {};
                            Object.keys(formData).forEach(k => {
                                result[k] = formData[k].translation;
                            });
                            onSave(result);
                        }}
                        className="btn-primary inline-flex items-center justify-center gap-2 capitalize transition-opacity hover:opacity-90"
                    >
                        <Save className="w-4 h-4" /> {getTranslation('BTN_SAVE', currentLanguage)}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};


// --- MAIN MODAL ---
export const TranslationManager = ({ onClose }: { onClose: () => void }) => {
    const {
        translationItems, updateTranslationItem, siteConfig, news, events, documents, pages,
        currentLanguage, activeTranslationSource, setTranslationSource, translationSources,
        contactQueries, updateNews, updateEvent, updateDocument, updatePage, updateContainer,
        updateNavItem, updateFooterConfig, saveGlobalSettings // Added updateNavItem, updateFooterConfig, saveGlobalSettings
    } = useStore();

    // Use store state for sourceList
    const sourceList = activeTranslationSource;
    const setSourceList = (val: string) => setTranslationSource(val);

    const [targetLang, setTargetLang] = useState('de');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingItem, setEditingItem] = useState<any | null>(null);

    // --- DATA LOADING LOGIC ---
    const displayedItems = useMemo(() => {
        let items: { id: string, original: string, fullItem: any }[] = [];

        switch (sourceList) {
            case 'TopNavigation':
                items = siteConfig.navigation.map(n => ({ id: n.id, original: n.title, fullItem: n }));
                break;
            case 'SmartPages':
                items = pages.map(p => ({ id: p.id, original: typeof p.title === 'string' ? p.title : (p.title.en || p.title.de || ''), fullItem: p }));
                break;
            case 'News':
                items = news.map(n => ({ id: n.id, original: n.title, fullItem: n }));
                break;
            case 'Events':
                items = events.map(e => ({ id: e.id, original: e.title, fullItem: e }));
                break;
            case 'Documents':
                items = documents.map(d => ({ id: d.id, original: d.title, fullItem: d }));
                break;
            case 'Containers':
                pages.forEach(p => {
                    p.containers.forEach(c => {
                        if (c.content.title?.en) items.push({ id: c.id, original: c.content.title.en, fullItem: c });
                        else if (c.title) items.push({ id: c.id, original: c.title, fullItem: c });
                    });
                });
                break;
            case 'ContactQueries':
                items = (contactQueries || []).map((q: any) => ({ id: q.id, original: q.email || 'Contact Query', fullItem: q }));
                break;
            case 'Labels':
                // Use dictionary directly or from store items
                (translationItems || []).filter(t => t.sourceList === 'Labels').forEach(t => {
                    items.push({ id: t.id, original: t.original, fullItem: t });
                });
                break;
            case 'GlobalSettings':
                // 1. Site Name? (Optional, skipping for now as per focused request on Footer)

                // 2. Footer Columns
                siteConfig.footer.columns.forEach(col => {
                    items.push({ id: `footer_col_${col.id}`, original: col.title, fullItem: { ...col, type: 'FooterColumn' } });
                    col.links.forEach(link => {
                        items.push({ id: `footer_link_${link.id}`, original: link.label, fullItem: { ...link, type: 'FooterLink', parentId: col.id } });
                    });
                });

                // 3. Footer Bottom Links (Privacy/Impress etc.)
                (siteConfig.footer.bottomLinks || []).forEach(link => {
                    items.push({
                        id: `footer_bottom_link_${link.id}`,
                        original: link.label,
                        fullItem: { ...link, type: 'FooterBottomLink' }
                    });
                });

                // 4. Sub Footer Text
                if (siteConfig.footer.subFooterText) {
                    items.push({
                        id: 'footer_sub',
                        original: siteConfig.footer.subFooterText,
                        fullItem: {
                            id: 'footer_sub',
                            type: 'SubFooterText',
                            translations: siteConfig.footer.translations,
                            modified: siteConfig.footer.modified
                        }
                    });
                }

                // 5. Copyright
                if (siteConfig.footer.copyright) {
                    items.push({
                        id: 'footer_copyright',
                        original: siteConfig.footer.copyright.en,
                        fullItem: {
                            id: 'footer_copyright',
                            type: 'FooterCopyright',
                            // Copyright is MultilingualText, so we treat it differently or map it
                            translations: siteConfig.footer.copyright,
                            modified: siteConfig.footer.modified
                        }
                    });
                }
                break;
            default:
                break;
        }

        // MERGE: Source Data + Existing translations
        return items.map(src => {
            const existing = (translationItems || []).find(
                t => t.id === src.id && t.sourceList === sourceList
            ) as any;

            // Extract translations from fullItem if available
            const extractedTranslations: any = {};
            if (src.fullItem?.translations) {
                Object.keys(src.fullItem.translations).forEach(lang => {
                    const transValue = src.fullItem.translations[lang];
                    // Check if it's an object with title (News/Events) or a direct string (TopNav)
                    if (typeof transValue === 'string') {
                        extractedTranslations[lang] = transValue;
                    } else if (transValue?.title) {
                        extractedTranslations[lang] = transValue.title;
                    } else if (src.fullItem.type === 'SubFooterText' && transValue?.subFooterText) {
                        extractedTranslations[lang] = transValue.subFooterText;
                    }
                });
            } else if (src.fullItem.type === 'FooterCopyright') {
                // Copyright is directly a MultilingualText object: { en: '...', de: '...' }
                // We can just use the fullItem.translations which we set to siteConfig.footer.copyright
                // Wait, for Copyright logic above: translations: siteConfig.footer.copyright
                // So here src.fullItem.translations IS the { en, de, ... } object.
                Object.keys(src.fullItem.translations).forEach(lang => {
                    const val = src.fullItem.translations[lang];
                    if (typeof val === 'string') extractedTranslations[lang] = val;
                });
            }

            // Determine Source Date
            const srcDate = src.fullItem?.modified || src.fullItem?.modifiedDate || src.fullItem?.lastUpdated;
            // Determine translation date
            const transDate = existing?.lastUpdated;

            let finalDate = '-';

            // Pick the latest date
            if (srcDate && transDate) {
                const d1 = new Date(srcDate).getTime();
                const d2 = new Date(transDate).getTime();
                finalDate = !isNaN(d1) && !isNaN(d2) && d1 > d2 ? srcDate : transDate;
            } else if (srcDate) {
                finalDate = srcDate;
            } else if (transDate) {
                finalDate = transDate;
            }

            if (existing) {
                // Keep source item identity/original text stable in the table.
                // Merge persisted dictionary translations with live item translations.
                const mergedTranslations = { ...existing.translations, ...extractedTranslations };

                return {
                    ...existing,
                    id: src.id,
                    sourceList,
                    original: src.original,
                    fullItem: src.fullItem,
                    translations: mergedTranslations,
                    lastUpdated: finalDate
                };
            }

            // If not found in translation storage, return a placeholder derived from source
            return {
                id: src.id,
                sourceList,
                original: src.original,
                translations: extractedTranslations,
                lastUpdated: finalDate,
                fullItem: src.fullItem
            } as any;
        });

    }, [sourceList, siteConfig, news, events, documents, pages, translationItems, contactQueries]) as any[];

    // Apply Search Filter
    const filteredItems = displayedItems.filter(item => {
        const matchesSearch = searchQuery === '' ||
            (item.original && item.original.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (item.id && item.id.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesSearch;
    });

    const targetLanguages = useMemo(
        () => getOptionalEnabledLanguages(siteConfig).map((code) => ({
            code,
            label: LANGUAGE_DISPLAY_NAMES[code] || LANGUAGE_META[code]?.label || code,
            flag: LANGUAGE_META[code]?.flag || '🌐',
        })),
        [siteConfig.languages]
    );

    const activeLang = targetLanguages.find(l => l.code === targetLang) || targetLanguages[0];

    // Keep selected target language valid whenever site language config changes.
    useEffect(() => {
        if (targetLanguages.length === 0) return;
        if (!targetLanguages.some(l => l.code === targetLang)) {
            setTargetLang(targetLanguages[0].code);
        }
    }, [targetLang, targetLanguages]);

    const handleSaveTranslation = (result: any) => {
        if (!editingItem) return;

        // 1. If it's a content list, update the fullItem in its specific store list
        if (sourceList === 'News' || sourceList === 'Events' || sourceList === 'Documents' || sourceList === 'SmartPages' || sourceList === 'Containers' || sourceList === 'TopNavigation') {
            const fullItem = editingItem.fullItem;
            if (fullItem) {
                // Prepare updated item
                const updatedItem = { ...fullItem };

                // Handle News/Events/Documents structure
                if (sourceList === 'News' || sourceList === 'Events' || sourceList === 'Documents') {
                    if (!updatedItem.translations) updatedItem.translations = {};
                    if (!updatedItem.translations[targetLang]) updatedItem.translations[targetLang] = {};

                    Object.keys(result).forEach(key => {
                        if (key.startsWith('seo_')) {
                            if (!updatedItem.seo) updatedItem.seo = {};
                            // Actually, SEO in translations? 
                            // Usually SEO fields are just en/de/fr/es in the SEO object?
                            // Let's check how NewsManager does it.
                            // NewsManager uses translations[lang] for title/desc.
                        }
                        updatedItem.translations[targetLang][key] = result[key];
                    });
                }

                // Call store update
                if (sourceList === 'News') updateNews(updatedItem);
                if (sourceList === 'Events') updateEvent(updatedItem);
                if (sourceList === 'Documents') updateDocument(updatedItem);
                if (sourceList === 'SmartPages') {
                    // SmartPages uses MultilingualText for title
                    if (result.title) updatedItem.title[targetLang] = result.title;
                    updatePage(updatedItem);
                }
                if (sourceList === 'Containers') {
                    // Container content
                    if (!updatedItem.content) updatedItem.content = {};
                    Object.keys(result).forEach(key => {
                        if (!updatedItem.content[key]) updatedItem.content[key] = {};
                        updatedItem.content[key][targetLang] = result[key];
                    });
                    updateContainer(updatedItem.pageId, updatedItem);
                }
                if (sourceList === 'TopNavigation') {
                    if (!updatedItem.translations) updatedItem.translations = {};
                    // Ensure translations object exists for targetLang
                    // TopNav translations are flat Record<string, string> in store, not nested like News
                    // based on types.ts: translations?: Record<string, string>;

                    // However, in this component (EditTranslationPopup), we might be getting back a structure.
                    // Let's verify how result is passed.
                    // result is { key: translation } e.g. { title: "Hola" }

                    if (result.title) {
                        updatedItem.translations[targetLang] = result.title;
                    }

                    updateNavItem(updatedItem);
                }
            }
        } else if (sourceList === 'GlobalSettings') {
            // Handle Footer items
            const fullItem = editingItem.fullItem;
            const newFooter = { ...siteConfig.footer };
            const val = result.title; // 'title' is the field key from getFieldsForSource

            if (fullItem.type === 'FooterColumn') {
                // Find and update column
                newFooter.columns = newFooter.columns.map(c => {
                    if (c.id === fullItem.id) {
                        const translations = c.translations || {};
                        return { ...c, translations: { ...translations, [targetLang]: val }, modified: new Date().toISOString() };
                    }
                    return c;
                });
            } else if (fullItem.type === 'FooterLink') {
                // Find and update link
                newFooter.columns = newFooter.columns.map(c => {
                    if (c.id === fullItem.parentId) {
                        return {
                            ...c,
                            links: c.links.map(l => {
                                if (l.id === fullItem.id) {
                                    const translations = l.translations || {};
                                    return { ...l, translations: { ...translations, [targetLang]: val }, modified: new Date().toISOString() };
                                }
                                return l;
                            })
                        };
                    }
                    return c;
                });
            } else if (fullItem.type === 'SubFooterText') {
                if (!newFooter.translations) newFooter.translations = {};
                if (!newFooter.translations[targetLang]) newFooter.translations[targetLang] = {};
                newFooter.translations[targetLang].subFooterText = val;
                newFooter.modified = new Date().toISOString();
            } else if (fullItem.type === 'FooterBottomLink') {
                newFooter.bottomLinks = (newFooter.bottomLinks || []).map((l: any) => {
                    if (String(l.id) === String(fullItem.id)) {
                        const translations = l.translations || {};
                        return { ...l, translations: { ...translations, [targetLang]: val } };
                    }
                    return l;
                });
                newFooter.modified = new Date().toISOString();
            } else if (fullItem.type === 'FooterCopyright') {
                newFooter.copyright = { ...newFooter.copyright, [targetLang]: val };
                newFooter.modified = new Date().toISOString();
            }

            updateFooterConfig(newFooter);
            saveGlobalSettings('site');
        }

        // 2. Always update the Global Dictionary too for consistency (the primary field)
        const primaryVal = result.title || result.label || Object.values(result)[0];
        updateTranslationItem(editingItem.id, sourceList, editingItem.original, targetLang, primaryVal as string);

        setEditingItem(null);
    };

    // --- FIELD CONFIGURATION ---
    const getFieldsForSource = (source: string) => {
        switch (source) {
            case 'News':
                return [
                    { key: 'title', label: 'Title', type: 'text' },
                    { key: 'description', label: 'Description', type: 'rich' },
                    { key: 'readMoreText', label: 'Read More Text', type: 'text' }
                ];
            case 'Events':
                return [
                    { key: 'title', label: 'Title', type: 'text' },
                    { key: 'description', label: 'Description', type: 'rich' },
                    { key: 'location', label: 'Location', type: 'text' },
                    { key: 'readMoreText', label: 'Read More Text', type: 'text' }
                ];
            case 'SmartPages':
                return [
                    { key: 'title', label: 'Page Title', type: 'text' }
                ];
            case 'Containers':
                return [
                    { key: 'title', label: 'Title', type: 'text' },
                    { key: 'heading', label: 'Heading', type: 'text' },
                    { key: 'subheading', label: 'Subheading', type: 'text' }
                ];
            case 'Documents':
                return [
                    { key: 'title', label: 'Document Title', type: 'text' },
                    { key: 'description', label: 'Description', type: 'rich' }
                ];
            default:
                return [
                    { key: 'title', label: 'Translation', type: 'text' }
                ];
            case 'TopNavigation':
                return [
                    { key: 'title', label: 'Navigation Title', type: 'text' }
                ];
            case 'GlobalSettings':
                return [
                    { key: 'title', label: 'Translation', type: 'text' }
                ];
        }
    };

    const customFooter = (
        <div className="flex justify-between w-full items-center">
            <OpenOOTBButton listTitle="TranslationDictionary" />
            <button
                type="button"
                onClick={onClose}
                className="btn-secondary inline-flex items-center justify-center gap-2 transition-colors"
            >
                {getTranslation('BTN_CLOSE', currentLanguage)} <EditTrigger labelKey="BTN_CLOSE" />
            </button>
        </div>
    );

    return (
        <GenericModal
            className="translation-popup"
            title={getTranslation('CONTENT_TRANS', currentLanguage)}
            onClose={onClose}
            width="w-[80vw] min-w-[80vw] max-w-[80vw]"
            noFooter={false}
            customFooter={customFooter}
            headerIcons={<TooltipMenu ComponentId={'734'} />} // Only standard close
        >
            <div className="flex flex-col h-[75vh] bg-white">
                {/* Controls */}
                <div className="p-6 border-b border-gray-200 bg-white">
                    <div className="flex flex-col lg:flex-row lg:items-end gap-6">

                        {/* SELECT LIST */}
                        <div className="flex-1 min-w-[220px]">
                            <label className="text-xs font-bold text-[var(--primary-color)] uppercase mb-2 flex items-center gap-1">
                                <span className="w-3 h-3 border border-gray-400 flex items-center justify-center text-[8px] rounded-sm">+</span>
                                {getTranslation('LBL_SELECT_LIST', currentLanguage)}
                            </label>

                            <select
                                className="w-full h-10 border border-gray-300 px-3 text-sm font-semibold text-gray-800 focus:ring-1 focus:ring-[var(--primary-color)] outline-none bg-white rounded"
                                value={sourceList}
                                onChange={(e) => setSourceList(e.target.value)}
                            >
                                {(translationSources || []).map(list => (
                                    <option key={list} value={list}>{list}</option>
                                ))}
                            </select>
                        </div>

                        {/* TARGET LANGUAGE */}
                        <div className="flex-1 min-w-[220px]">
                            <label className="text-xs font-bold text-[var(--primary-color)] uppercase mb-2 flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                {getTranslation('LABEL_TRANSLATION_TARGET', currentLanguage)}
                            </label>

                            <div className="relative">
                                <select
                                    className="w-full h-10 border border-gray-300 pl-10 pr-8 text-sm font-semibold text-gray-800 focus:ring-1 focus:ring-[var(--primary-color)] outline-none bg-white appearance-none rounded disabled:bg-gray-100 disabled:text-gray-400"
                                    value={targetLang}
                                    onChange={(e) => setTargetLang(e.target.value as any)}
                                    disabled={targetLanguages.length === 0}
                                >
                                    {targetLanguages.length === 0 ? (
                                        <option value="">{getTranslation('MSG_NO_OPTIONAL_LANGUAGES', currentLanguage)}</option>
                                    ) : (
                                        targetLanguages.map(l => (
                                            <option key={l.code} value={l.code}>{l.label}</option>
                                        ))
                                    )}
                                </select>

                                {/* FLAG */}
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-base leading-none">
                                    {activeLang?.flag || '🌐'}
                                </span>

                                {/* Dropdown Arrow */}
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
                                    ▼
                                </div>
                            </div>
                        </div>

                        {/* SEARCH */}
                        <div className="flex-1 min-w-[280px]">
                            <label className="text-xs font-bold text-[var(--primary-color)] uppercase mb-2 flex items-center gap-1">
                                <Search className="w-3 h-3" />
                                {getTranslation('LBL_SEARCH', currentLanguage)}
                            </label>

                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder={getTranslation('PLACEHOLDER_SEARCH_TRANSLATIONS', currentLanguage)}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-10 border border-gray-300 pl-10 pr-10 text-sm text-gray-600 focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded"
                                />

                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                        title="Clear search"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* SEED BUTTON */}
                        {/* <div className="flex-shrink-0 w-full lg:w-auto">
                            <button
                                onClick={seedTranslations}
                                className="w-full lg:w-auto h-10 px-6 border border-[var(--primary-color)] text-[var(--primary-color)] text-sm font-bold rounded hover:bg-[var(--primary-color)] hover:text-white shadow-sm transition-all flex items-center gap-2"
                                title="Seed missing labels from INITIAL_UI_LABELS"
                            >
                                <Wand2 className="w-4 h-4" /> Seed Labels
                            </button>
                        </div> */}

                        {/* UPDATE BUTTON */}
                        {/* <div className="flex-shrink-0 w-full lg:w-auto">
                            <button
                                onClick={syncTranslations}
                                className="w-full lg:w-auto h-10 px-6 bg-[var(--primary-color)] text-white text-sm font-bold rounded hover:opacity-90 shadow-sm transition-opacity"
                            >
                                {getTranslation('BTN_UPDATE', currentLanguage)}
                            </button>
                        </div> */}

                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase sticky top-0 z-10 border-b border-gray-200">
                            <tr>
                                <th className="py-3 px-6 w-24">ID</th>
                                <th className="py-3 px-6 w-1/3">{getTranslation('LABEL_ORIGINAL', currentLanguage)} <EditTrigger labelKey="LABEL_ORIGINAL" color="#93c5fd" size="w-3 h-3" /></th>
                                <th className="py-3 px-6">{getTranslation('LABEL_TRANSLATION', currentLanguage)} <EditTrigger labelKey="LABEL_TRANSLATION" color="#93c5fd" size="w-3 h-3" /></th>
                                <th className="py-3 px-6 w-40">{getTranslation('LABEL_MODIFIED', currentLanguage)} <EditTrigger labelKey="LABEL_MODIFIED" color="#93c5fd" size="w-3 h-3" /></th>
                                <th className="py-3 px-6 w-40 text-right">{getTranslation('LABEL_ACTIONS', currentLanguage)} <EditTrigger labelKey="LABEL_ACTIONS" color="#93c5fd" size="w-3 h-3" /></th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {filteredItems.map(item => (
                                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
                                    <td className="py-4 px-6 text-gray-500 font-mono text-xs">{item.id}</td>
                                    <td className="py-4 px-6 font-bold text-gray-800">{item.original}</td>
                                    <td className="py-4 px-6">
                                        <div className="flex gap-2">
                                            {targetLanguages.map(lang => (
                                                item.translations?.[lang.code] ? (
                                                    <span key={lang.code} className="inline-flex items-center px-1.5 py-0.5 border border-gray-200 bg-white text-[10px] font-bold text-gray-700 uppercase">
                                                        <span className="mr-1">{lang.flag}</span> {lang.code.toUpperCase()}
                                                    </span>
                                                ) : null
                                            ))}
                                            {!targetLanguages.some(lang => !!item.translations?.[lang.code]) && <span className="text-gray-400 text-xs italic">{getTranslation('LABEL_NONE', currentLanguage)}</span>}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-gray-500 text-xs">
                                        {item.lastUpdated && item.lastUpdated !== '-'
                                            ? (() => {
                                                const dateStr = item.lastUpdated;
                                                let date: Date;

                                                if (!dateStr) return '-';

                                                // Handle various formats
                                                if (typeof dateStr === 'string' && dateStr.includes('/')) {
                                                    const parts = dateStr.split('/');
                                                    if (parts.length === 3) {
                                                        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                                                    } else {
                                                        date = new Date(dateStr);
                                                    }
                                                } else {
                                                    date = new Date(dateStr);
                                                }

                                                if (isNaN(date.getTime())) return item.lastUpdated;

                                                const day = String(date.getDate()).padStart(2, '0');
                                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                                const year = date.getFullYear();
                                                return `${day}/${month}/${year}`;
                                            })()
                                            : '-'
                                        }
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <button
                                            onClick={() => setEditingItem(item)}
                                            className="inline-flex items-center gap-1 px-4 py-1.5 border border-[var(--primary-color)] text-[var(--primary-color)] text-xs font-bold rounded-full hover:bg-[var(--brand-light)] transition-colors"
                                        >
                                            {/* <Info className="w-3 h-3" /> */}
                                             {getTranslation('BTN_EDIT', currentLanguage)}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-gray-400 italic">
                                        {getTranslation('MSG_NO_ITEMS_FOUND', currentLanguage)}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sub Modal */}
            {editingItem && (
                <EditTranslationPopup
                    item={editingItem}
                    langCode={targetLang}
                    langLabel={activeLang.label}
                    fields={getFieldsForSource(sourceList)}
                    onClose={() => setEditingItem(null)}
                    onSave={handleSaveTranslation}
                />
            )}
        </GenericModal>
    );
};
