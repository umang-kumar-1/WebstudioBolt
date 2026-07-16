import React, { useState, useEffect } from 'react';
import { useStore, getLocalizedText, getTranslation, getItemTranslation } from '../../store';
import { NavItem, Page, LanguageCode, SiteConfig } from '../../types';
import { GenericModal, HelpGuideModal, Tooltip, OpenOOTBButton, EditTrigger } from './SharedModals';
import { SharePointMetadataFooter } from '../common/SharePointMetadataFooter';
import { Monitor, List as ListIcon, Plus, GripVertical, EyeOff, Pencil, Trash2, X, Search, Check, ImageIcon, ChevronRight, ChevronDown, AlertTriangle, FileText, Globe, Upload, HelpCircle, Wand2, Building2 } from 'lucide-react';
import { translateText } from '../../services/geminiService';
import TooltipMenu from '../common/TooltipMenu';
import { SiteLanguagesConfiguration } from '../SiteLanguagesConfiguration';
import { getOptionalEnabledLanguages, LANGUAGE_DISPLAY_NAMES } from '../../utils/siteLanguages';
import { useOptimizedImageUpload } from '../../../../hooks/useOptimizedImageUpload';
import ImageOptimizationFeedback from '../../../../components/ImageOptimizationFeedback';
import { isSiteAdmin } from '../../utils/templatePermissions';
import { MODAL_Z } from '../../utils/modalZIndex';
import {
    buildSlugFromNavChain,
    getNavItemRouteSlug,
    resolveParentPageIdForNavItem,
    slugifyTitle,
} from '../../utils/pageHierarchy';

// --- Helper: Get localized nav item title (navigation name, not linked page title) ---
const getNavItemTitle = (item: NavItem, lang: LanguageCode): string => {
    return getItemTranslation(item, lang, 'title') || item.title || 'Untitled';
};

// --- Sub-Modals for Navigation ---
const NavDeleteConfirmation = ({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) => (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: MODAL_Z.CONFIRM }}>
        <div className="bg-white w-[400px] shadow-2xl rounded-sm border border-gray-300 flex flex-col overflow-hidden">
            <div className="p-6 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{getTranslation('TITLE_DELETE_ITEM', useStore.getState().currentLanguage)}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{getTranslation('MSG_DELETE_NAV_ITEM_CONFIRM', useStore.getState().currentLanguage)}</p>
            </div>
            <div className="flex border-t border-gray-200 bg-gray-50">
                <button onClick={onCancel} className="flex-1 py-3 text-sm font-medium text-gray-700 hover:bg-white transition-colors border-r border-gray-200 flex items-center justify-center gap-2">
                    {getTranslation('BTN_CANCEL', useStore.getState().currentLanguage)}
                </button>
                <button onClick={onConfirm} className="flex-1 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors">{getTranslation('BTN_DELETE', useStore.getState().currentLanguage)}</button>
            </div>
        </div>
    </div>
);

const SmartPageSelector = ({ onClose, onSelect }: { onClose: () => void, onSelect: (pageId: string, pageName: string) => void }) => {
    const { pages, currentLanguage } = useStore();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredPages = pages.filter(page => {
        const title = getLocalizedText(page.title, currentLanguage).toLowerCase();
        const url = getLocalizedText(page.title, 'en').replace(/\s/g, '-').toLowerCase();
        return title.includes(searchQuery.toLowerCase()) || url.includes(searchQuery.toLowerCase());
    });

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] animate-in zoom-in-95 duration-200" style={{ zIndex: MODAL_Z.CONFIRM }}>
            <div className="bg-white w-[900px] h-[600px] flex flex-col shadow-2xl rounded-sm border border-gray-300 overflow-hidden">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-white">
                    <h3 className="font-bold text-[var(--primary-color)] text-lg">{getTranslation('TITLE_SELECT_SMARTPAGE', currentLanguage)}</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-3 flex justify-between items-center border-b border-gray-200">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span className="font-medium">{getTranslation('MSG_SHOWING_PAGES_COUNT', currentLanguage).replace('{0}', String(filteredPages.length))}</span>
                        <div className="flex items-center bg-white border border-gray-300 w-64 rounded-sm relative group">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 pointer-events-none opacity-50" style={{ color: 'var(--icon-color)' }} />
                            <input
                                type="text"
                                placeholder={getTranslation('PLACEHOLDER_SEARCH_PAGES', currentLanguage)}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-8 py-1.5 outline-none text-sm bg-transparent"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-2.5 transition-all p-0.5 hover:scale-110 active:scale-95"
                                    title="Clear search"
                                >
                                    <X className="w-3.5 h-3.5 opacity-60 hover:opacity-100 hover:text-red-500 transition-opacity" style={{ color: 'var(--icon-color)' }} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex border-b border-gray-200 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">
                    <div className="w-12 p-3 text-center border-r border-gray-200">#</div>
                    <div className="flex-1 p-3 border-r border-gray-200">{getTranslation('LABEL_PAGE_TITLE_COLUMN', currentLanguage)}</div>
                    <div className="flex-[2] p-3">{getTranslation('LABEL_URL_STRUCTURE', currentLanguage)}</div>
                </div>
                <div className="flex-1 overflow-y-auto bg-white">
                    {filteredPages.length > 0 ? filteredPages.map((page, idx) => (
                        <div key={page.id} className={`flex border-b border-gray-100 hover:bg-[var(--brand-light)] cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                            onClick={() => onSelect(page.id, getLocalizedText(page.title, currentLanguage))}>
                            <div className="w-12 p-3 flex justify-center items-center border-r border-gray-100 text-gray-400">
                                {idx + 1}
                            </div>
                            <div className="flex-1 p-3 border-r border-gray-100 text-sm font-medium text-gray-800 flex items-center">
                                {getLocalizedText(page.title, currentLanguage)}
                            </div>
                            <div className="flex-[2] p-3 text-xs text-gray-500 font-mono truncate flex items-center">
                                .../SitePages/{getLocalizedText(page.title, 'en').replace(/\s/g, '-')}.aspx
                            </div>
                        </div>
                    )) : (
                        <div className="p-12 text-center text-gray-400 italic text-sm">
                            {getTranslation('MSG_NO_PAGES_MATCHING', currentLanguage)} "{searchQuery}"
                        </div>
                    )}
                </div>
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="btn-secondary inline-flex items-center justify-center gap-2 transition-colors">
                        {getTranslation('BTN_CANCEL', currentLanguage)}
                    </button>
                    <button type="button" onClick={onClose} className="btn-primary inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90">{getTranslation('BTN_SAVE', currentLanguage)}</button>
                </div>
            </div>
        </div>
    );
};

const ContainerSelector = ({ onClose, onSelect }: { onClose: () => void, onSelect: (containerId: string, pageId: string) => void }) => {
    const { pages, currentLanguage } = useStore();

    const allContainers = pages.flatMap(p =>
        p.containers.map(c => ({
            pageId: p.id,
            pageName: getLocalizedText(p.title, currentLanguage),
            containerId: c.id,
            containerTitle: getLocalizedText(c.content?.title, currentLanguage) || c.title || `Unnamed Container (${c.type})`,
            type: c.type
        }))
    );

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] animate-in zoom-in-95 duration-200" style={{ zIndex: MODAL_Z.CONFIRM }}>
            <div className="bg-white w-[900px] h-[600px] flex flex-col shadow-2xl rounded-sm border border-gray-300 overflow-hidden">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-white">
                    <h3 className="font-bold text-[var(--primary-color)] text-lg">{getTranslation('TITLE_SELECT_SECTION', currentLanguage)}</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-3 flex justify-between items-center border-b border-gray-200">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span className="font-medium">{getTranslation('MSG_SHOWING_SECTIONS_COUNT', currentLanguage).replace('{0}', String(allContainers.length))}</span>
                    </div>
                </div>
                <div className="flex border-b border-gray-200 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">
                    <div className="w-12 p-3 text-center border-r border-gray-200">#</div>
                    <div className="flex-1 p-3 border-r border-gray-200">{getTranslation('LABEL_SECTION_TITLE', currentLanguage)}</div>
                    <div className="flex-1 p-3">{getTranslation('LABEL_FOUND_ON_PAGE', currentLanguage)}</div>
                </div>
                <div className="flex-1 overflow-y-auto bg-white">
                    {allContainers.map((container, idx) => (
                        <div key={container.containerId} className={`flex border-b border-gray-100 hover:bg-[var(--brand-light)] cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                            onClick={() => onSelect(container.containerId, container.pageId)}>
                            <div className="w-12 p-3 flex justify-center items-center border-r border-gray-100 text-gray-400">
                                {idx + 1}
                            </div>
                            <div className="flex-1 p-3 border-r border-gray-100 text-sm font-medium text-gray-800 flex items-center">
                                {container.containerTitle}
                            </div>
                            <div className="flex-1 p-3 text-xs text-gray-500 font-mono flex items-center">
                                {container.pageName}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="btn-secondary inline-flex items-center justify-center gap-2 transition-colors">{getTranslation('BTN_CANCEL', currentLanguage)}</button>
                    <button type="button" onClick={onClose} className="btn-primary inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90">{getTranslation('BTN_SAVE', currentLanguage)}</button>
                </div>
            </div>
        </div>
    );
};

const ParentSelector = ({ onClose, onSelect, currentParentId }: { onClose: () => void, onSelect: (id: string, title: string) => void, currentParentId: string }) => {
    const { siteConfig } = useStore();
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] animate-in zoom-in-95 duration-200" style={{ zIndex: MODAL_Z.CONFIRM }}>
            <div className="bg-white w-[500px] h-[520px] min-h-[520px] max-h-[520px] shadow-2xl rounded-sm border border-gray-300 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-white">
                    <h3 className="font-bold text-[var(--primary-color)] text-lg">{getTranslation('TITLE_SELECT_PARENT_ITEM', useStore.getState().currentLanguage)}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto max-h-[400px]">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 px-2">{getTranslation('LABEL_NAV_STRUCTURE', useStore.getState().currentLanguage)}</div>
                    <div className="border border-gray-200 rounded-sm overflow-hidden">
                        <div onClick={() => onSelect('root', getTranslation('LABEL_ROOT_LEVEL', useStore.getState().currentLanguage))} className={`px-4 py-3 cursor-pointer text-sm flex items-center gap-3 border-b border-gray-100 transition-colors ${currentParentId === 'root' ? 'bg-[var(--brand-light)] text-[var(--primary-color)] font-bold' : 'hover:bg-gray-50 text-gray-700'}`}>
                            <div className={`w-4 h-4 flex items-center justify-center rounded-full border ${currentParentId === 'root' ? 'border-[var(--primary-color)] bg-[var(--primary-color)]' : 'border-gray-400'}`}>
                                {currentParentId === 'root' && <Check className="w-3 h-3 text-white" />}
                            </div>
                            {getTranslation('LABEL_ROOT_LEVEL', useStore.getState().currentLanguage)}
                        </div>
                        {siteConfig.navigation.map(nav => (
                            <div key={nav.id} onClick={() => onSelect(nav.id, nav.title)} className={`px-4 py-3 cursor-pointer text-sm flex items-center gap-3 border-b border-gray-100 last:border-0 pl-8 transition-colors ${currentParentId === nav.id ? 'bg-[var(--brand-light)] text-[var(--primary-color)] font-bold' : 'hover:bg-gray-50 text-gray-700'}`}>
                                <div className={`w-4 h-4 flex items-center justify-center rounded-full border ${currentParentId === nav.id ? 'border-[var(--primary-color)] bg-[var(--primary-color)]' : 'border-gray-400'}`}>
                                    {currentParentId === nav.id && <Check className="w-3 h-3 text-white" />}
                                </div>
                                {nav.title}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="btn-secondary inline-flex items-center justify-center gap-2 transition-colors">
                        {getTranslation('BTN_CANCEL', useStore.getState().currentLanguage)}
                    </button>
                    <button type="button" onClick={onClose} className="btn-primary inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90">{getTranslation('BTN_SELECT', useStore.getState().currentLanguage)}</button>
                </div>
            </div>
        </div>
    );
};

interface NavItemEditorProps {
    item: Partial<NavItem>;
    isNew: boolean;
    onSave: (item: Partial<NavItem>) => void;
    onCancel: () => void;
    forcedParentId?: string;
}

const NavItemEditor = ({ item, isNew, onSave, onCancel, forcedParentId }: NavItemEditorProps) => {
    const { siteConfig, pages, currentLanguage, deleteNavItem, addPage } = useStore();
    const optionalTranslationLanguages = getOptionalEnabledLanguages(siteConfig);
    const showTranslationTab = optionalTranslationLanguages.length > 0;
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'TRANSLATIONS'>('GENERAL');
    useEffect(() => {
        if (activeTab === 'TRANSLATIONS' && !showTranslationTab) {
            setActiveTab('GENERAL');
        }
    }, [activeTab, showTranslationTab]);
    const [isTranslating, setIsTranslating] = useState(false);
    const [formData, setFormData] = useState<Partial<NavItem>>({
        id: `new_${Date.now()}`,
        parentId: forcedParentId || 'root',
        title: '',
        type: 'Page', // Force default to Page
        isVisible: true,
        openInNewTab: false,
        status: 'Draft', // Default status
        ...item
    });
    useEffect(() => {
        if (item && !isNew) {
            setFormData(prev => ({
                ...prev,
                ...item
            }));
        }
    }, [item, isNew]);

    const [showParentSelector, setShowParentSelector] = useState(false);
    const [showPageSelector, setShowPageSelector] = useState(false);
    const [showContainerSelector, setShowContainerSelector] = useState(false);
    const [parentName, setParentName] = useState('Root');
    const [linkedPageName, setLinkedPageName] = useState('');
    const [linkedContainerName, setLinkedContainerName] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isCreatingSubpage, setIsCreatingSubpage] = useState(false);
    const [pageLinkMode, setPageLinkMode] = useState<'subpage' | 'existing'>('subpage');

    const isChildNav = !!formData.parentId && formData.parentId !== 'root';
    const isCreateNewPageMode = isNew && formData.type === 'Page' && pageLinkMode === 'subpage';
    const parentRouteSlug = isChildNav && formData.parentId
        ? getNavItemRouteSlug(siteConfig.navigation, pages, formData.parentId)
        : '/home';
    const currentPageSegment = formData.title ? slugifyTitle(formData.title) : '';
    const previewSubpageSlug = isChildNav && currentPageSegment && formData.parentId
        ? buildSlugFromNavChain(siteConfig.navigation, pages, formData.parentId, formData.title!)
        : '';
    const previewRootPageSlug = !isChildNav && currentPageSegment
        ? `/${currentPageSegment}`
        : '';

    useEffect(() => {
        if (isNew && formData.type === 'Page') {
            setPageLinkMode('subpage');
        }
    }, [isNew, formData.type]);

    useEffect(() => {
        if (formData.parentId === 'root') setParentName(getTranslation('LABEL_ROOT_LEVEL', currentLanguage));
        else {
            const parent = siteConfig.navigation.find(n => n.id === formData.parentId);
            if (parent) setParentName(parent.title);
        }
        if (formData.pageId) {
            const page = pages.find(p => p.id === formData.pageId);
            if (page) setLinkedPageName(getLocalizedText(page.title, currentLanguage));
        }
        if (formData.containerId) {
            let found = false;
            // First check the associated page if available
            if (formData.pageId) {
                const page = pages.find(p => p.id === formData.pageId);
                if (page) {
                    const c = page.containers.find(x => x.id === formData.containerId);
                    if (c) {
                        setLinkedContainerName(getLocalizedText(c.content?.title, currentLanguage) || c.title || `Container (${c.type})`);
                        found = true;
                    }
                }
            }
            // Fallback to checking other pages
            if (!found) {
                for (const p of pages) {
                    if (p.id === formData.pageId) continue;
                    const c = p.containers.find(x => x.id === formData.containerId);
                    if (c) {
                        setLinkedContainerName(getLocalizedText(c.content?.title, currentLanguage) || c.title || `Container (${c.type})`);
                        found = true;
                        break;
                    }
                }
            }
            if (!found) setLinkedContainerName('');
        }
    }, [formData.parentId, formData.pageId, formData.containerId, siteConfig.navigation, pages, currentLanguage]);

    const suggestUebersetzung = async () => {
        const titleToTranslate = formData.title;
        if (!titleToTranslate) return;
        setIsTranslating(true);
        try {
            const newTrans = { ...(formData.translations || {}) };
            for (const lang of optionalTranslationLanguages) {
                const translated = await translateText(titleToTranslate, lang);
                if (translated) newTrans[lang] = translated;
            }
            setFormData(prev => ({ ...prev, translations: newTrans }));
        } catch (e) {
            console.error('Nav translation failed:', e);
        } finally {
            setIsTranslating(false);
        }
    };

    const handleDelete = () => { if (formData.id) deleteNavItem(formData.id); onCancel(); };

    const handleCreateAndLinkPage = async () => {
        if (!formData.title?.trim()) return;
        setIsCreatingSubpage(true);
        try {
            const slug = isChildNav && formData.parentId
                ? buildSlugFromNavChain(siteConfig.navigation, pages, formData.parentId, formData.title)
                : `/${slugifyTitle(formData.title)}`;
            const parentPageId = isChildNav && formData.parentId
                ? resolveParentPageIdForNavItem(siteConfig.navigation, pages, formData.parentId)
                : undefined;
            const newPage = await addPage({
                id: `new_${Date.now()}`,
                title: { en: formData.title, de: formData.title, fr: formData.title, es: formData.title },
                slug,
                status: 'Draft',
                containers: [],
                modifiedDate: new Date().toISOString(),
                description: '',
                isHomePage: false,
                imageUrl: '',
                imageName: '',
                sortOrder: 0,
                parentPageId,
                createdBy: '',
                modifiedBy: '',
            });
            if (!newPage) return;
            const parentNavId = formData.parentId || 'root';
            const siblings = siteConfig.navigation.filter((n) => n.parentId === parentNavId);
            onSave({
                ...formData,
                type: 'Page',
                pageId: newPage.id,
                order: siblings.length,
            });
        } finally {
            setIsCreatingSubpage(false);
        }
    };

    // Validation Logic
    const canSave = !!formData.title &&
        ((formData.type === 'Page' && (isCreateNewPageMode ? false : !!formData.pageId)) ||
            (formData.type === 'External' && !!formData.url) ||
            (formData.type === 'Container' && !!formData.containerId));

    const canCreateNewPage = isCreateNewPageMode && !!formData.title?.trim() && !isCreatingSubpage;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in zoom-in-95 duration-200" style={{ zIndex: MODAL_Z.CONFIRM }}>
            <div className="bg-white w-[850px] shadow-2xl rounded-sm border border-gray-300 flex flex-col h-[90vh] min-h-[90vh] max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-white">
                    <h3 className="text-xl font-bold text-[var(--primary-color)]">
                        {isNew ? getTranslation('BTN_ADD_NAV_ITEM', currentLanguage) : `${getTranslation('BTN_EDIT', currentLanguage)}: ${item.title}`}
                    </h3>
                    <div className="flex items-center gap-2">
                        <TooltipMenu ComponentId={'449'} />
                        <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-6 bg-white flex-shrink-0 gap-6">
                    {[
                        { id: 'GENERAL', label: getTranslation('TAB_BASIC_INFO', currentLanguage) || 'General' },
                        ...(showTranslationTab ? [{ id: 'TRANSLATIONS', label: getTranslation('TAB_TRANSLATION', currentLanguage) || 'Translation' }] : []),
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === tab.id ? 'border-b-[var(--primary-color)] text-[var(--primary-color)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="p-8 space-y-6 overflow-y-auto flex-1 bg-gray-50/50">

                    {/* GENERAL TAB */}
                    {activeTab === 'GENERAL' && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_PARENT_ITEM', currentLanguage)}</label>
                                <div className="flex gap-0">
                                    <input type="text" readOnly value={parentName} className="flex-1 px-3 py-2 border border-gray-300 bg-white text-gray-700 text-sm rounded-l-sm focus:outline-none" />
                                    <button onClick={() => setShowParentSelector(true)} className="px-4 py-2 bg-[var(--btn-primary-bg)] text-white hover:opacity-90 rounded-r-sm transition-colors border-l border-white/20"><Pencil className="w-4 h-4" /></button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_VISIBILITY_STATUS', currentLanguage)}</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer bg-white px-3 py-2 border border-gray-200 rounded-sm shadow-sm hover:border-[var(--primary-color)] transition-colors flex-1">
                                            <input type="radio" checked={formData.isVisible} onChange={() => setFormData({ ...formData, isVisible: true })} className="text-[var(--primary-color)] focus:ring-[var(--primary-color)]" />
                                            <span className="font-medium">{getTranslation('LABEL_VISIBLE', currentLanguage)}</span>
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer bg-white px-3 py-2 border border-gray-200 rounded-sm shadow-sm hover:border-[var(--primary-color)] transition-colors flex-1">
                                            <input type="radio" checked={!formData.isVisible} onChange={() => setFormData({ ...formData, isVisible: false })} className="text-[var(--primary-color)] focus:ring-[var(--primary-color)]" />
                                            <span className="font-medium">{getTranslation('LABEL_HIDDEN', currentLanguage)}</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_INTERACTION', currentLanguage)}</label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer bg-white px-3 py-2 border border-gray-200 rounded-sm shadow-sm hover:border-[var(--primary-color)] transition-colors">
                                        <input type="checkbox" checked={formData.openInNewTab} onChange={(e) => setFormData({ ...formData, openInNewTab: e.target.checked })} className="rounded-sm text-[var(--primary-color)] focus:ring-[var(--primary-color)]" />
                                        <span className="font-medium">{getTranslation('LABEL_OPEN_LINK_NEW_TAB', currentLanguage)}</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                    {isCreateNewPageMode
                                        ? getTranslation('LABEL_SUBPAGE_CURRENT', currentLanguage)
                                        : getTranslation('LABEL_NAV_TITLE_EN_DEFAULT', currentLanguage)}{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 text-sm rounded-sm focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none bg-white shadow-sm" placeholder={getTranslation('LABEL_TITLE_ENGLISH', currentLanguage)} />
                            </div>

                            <div className="pt-4 border-t border-gray-200">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-3">{getTranslation('LABEL_LINK_DESTINATION', currentLanguage)}</label>

                                <div className="flex flex-col gap-3 mb-4">
                                    {/* Internal SmartPage Option */}
                                    <label className={`flex items-start gap-3 p-4 border rounded-sm cursor-pointer transition-all ${formData.type === 'Page' ? 'border-[var(--primary-color)] bg-blue-50 ring-1 ring-[var(--primary-color)]' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                        <input type="radio" name="linkType" checked={formData.type === 'Page'} onChange={() => setFormData({ ...formData, type: 'Page' })} className="mt-1 text-[var(--primary-color)] focus:ring-[var(--primary-color)]" />
                                        <div>
                                            <span className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                                <FileText className="w-4 h-4 text-[var(--primary-color)]" /> Internal SmartPage (editable)
                                            </span>
                                            <span className="block text-xs text-gray-500 mt-1">{getTranslation('DESC_LINK_SMARTPAGE', currentLanguage)}</span>
                                        </div>
                                    </label>

                                    {/* Container Link Option */}
                                    <label className={`flex items-start gap-3 p-4 border rounded-sm cursor-pointer transition-all ${formData.type === 'Container' ? 'border-[var(--primary-color)] bg-blue-50 ring-1 ring-[var(--primary-color)]' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                        <input type="radio" name="linkType" checked={formData.type === 'Container'} onChange={() => setFormData({ ...formData, type: 'Container' })} className="mt-1 text-[var(--primary-color)] focus:ring-[var(--primary-color)]" />
                                        <div>
                                            <span className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                                <ListIcon className="w-4 h-4 text-[var(--primary-color)]" /> Section (Scroll to)
                                            </span>
                                            <span className="block text-xs text-gray-500 mt-1">{getTranslation('DESC_LINK_SECTION', currentLanguage)}</span>
                                        </div>
                                    </label>

                                    {/* External Link Option */}
                                    <label className={`flex items-start gap-3 p-4 border rounded-sm cursor-pointer transition-all ${formData.type === 'External' ? 'border-orange-300 bg-orange-50 ring-1 ring-orange-300' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                        <input type="radio" name="linkType" checked={formData.type === 'External'} onChange={() => setFormData({ ...formData, type: 'External' })} className="mt-1 text-orange-500 focus:ring-orange-500" />
                                        <div>
                                            <span className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                                <Globe className="w-4 h-4 text-orange-500" /> External Link (not editable)
                                            </span>
                                            <span className="block text-xs text-gray-600 mt-1">
                                                Use only for third-party websites (Google, partners), PDFs, or mailto links.
                                                <br />
                                                <strong className="text-orange-700 flex items-center gap-1 mt-1"><AlertTriangle className="w-4 h-4" /> {getTranslation('MSG_DO_NOT_USE_INTERNAL', currentLanguage)}</strong>
                                            </span>
                                        </div>
                                    </label>
                                </div>

                                {formData.type === 'Page' ? (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {isNew && (
                                            <div className="flex gap-2 p-1 bg-gray-100 rounded-sm border border-gray-200">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPageLinkMode('subpage');
                                                        setFormData((prev) => ({ ...prev, pageId: undefined }));
                                                        setLinkedPageName('');
                                                    }}
                                                    className={`flex-1 px-3 py-2 text-xs font-bold rounded-sm transition-colors ${pageLinkMode === 'subpage' ? 'bg-[var(--btn-primary-bg)] text-white shadow-sm' : 'text-gray-600 hover:bg-white'}`}
                                                >
                                                    {getTranslation(isChildNav ? 'LINK_MODE_SUBPAGE' : 'LINK_MODE_NEW_PAGE', currentLanguage)}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPageLinkMode('existing')}
                                                    className={`flex-1 px-3 py-2 text-xs font-bold rounded-sm transition-colors ${pageLinkMode === 'existing' ? 'bg-[var(--btn-primary-bg)] text-white shadow-sm' : 'text-gray-600 hover:bg-white'}`}
                                                >
                                                    {getTranslation('LINK_MODE_EXISTING_PAGE', currentLanguage)}
                                                </button>
                                            </div>
                                        )}

                                        {isCreateNewPageMode ? (
                                            <div className="p-4 border border-[var(--primary-color)] rounded-sm bg-blue-50/40 space-y-4">
                                                <p className="text-xs text-gray-600">
                                                    {getTranslation(
                                                        isChildNav ? 'DESC_CREATE_SUBPAGE' : 'DESC_CREATE_NEW_PAGE',
                                                        currentLanguage
                                                    )}
                                                </p>
                                                {isChildNav ? (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                                                {getTranslation('LABEL_SUBPAGE_PARENT', currentLanguage)}
                                                            </label>
                                                            <input
                                                                type="text"
                                                                readOnly
                                                                value={parentRouteSlug}
                                                                className="w-full px-3 py-2 border border-gray-300 bg-gray-100 text-gray-700 text-sm font-mono rounded-sm focus:outline-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                                                {getTranslation('LABEL_SUBPAGE_CURRENT', currentLanguage)}
                                                            </label>
                                                            <input
                                                                type="text"
                                                                readOnly
                                                                value={currentPageSegment || '—'}
                                                                className="w-full px-3 py-2 border border-gray-300 bg-gray-100 text-gray-700 text-sm font-mono rounded-sm focus:outline-none"
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                                            {getTranslation('LABEL_URL_SLUG', currentLanguage)}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            value={previewRootPageSlug || '—'}
                                                            className="w-full px-3 py-2 border border-gray-300 bg-gray-100 text-gray-700 text-sm font-mono rounded-sm focus:outline-none"
                                                        />
                                                    </div>
                                                )}
                                                {(previewSubpageSlug || previewRootPageSlug) && (
                                                    <p className="text-xs font-mono text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-sm">
                                                        URL: #{previewSubpageSlug || previewRootPageSlug}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase">{getTranslation('LABEL_SELECTED_SMARTPAGE', currentLanguage)} <span className="text-red-500">*</span></label>
                                                <div className="flex gap-0 relative">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={linkedPageName}
                                                        placeholder="No SmartPage mapped"
                                                        className={`flex-1 px-3 py-2 border text-sm rounded-l-sm focus:outline-none ${!formData.pageId ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300 bg-white text-gray-700'}`}
                                                    />
                                                    {linkedPageName && (
                                                        <button onClick={() => { setLinkedPageName(''); setFormData({ ...formData, pageId: undefined }) }} className="absolute right-12 top-2 text-gray-400 hover:text-red-500">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => setShowPageSelector(true)} className="px-4 py-2 bg-white border border-l-0 border-gray-300 text-gray-600 hover:text-[var(--primary-color)] hover:bg-gray-50 rounded-r-sm transition-colors">
                                                        <Pencil className="w-4 h-4" style={{ color: 'var(--icon-color)' }} />
                                                    </button>
                                                </div>
                                                {!formData.pageId && <p className="text-[10px] text-red-500 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {getTranslation('MSG_SMARTPAGE_REQUIRED', currentLanguage)}</p>}
                                            </>
                                        )}
                                    </div>
                                ) : formData.type === 'Container' ? (
                                    <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase">{getTranslation('LABEL_SELECTED_SECTION', currentLanguage)} <span className="text-red-500">*</span></label>
                                        <div className="flex gap-0 relative">
                                            <input
                                                type="text"
                                                readOnly
                                                value={linkedContainerName}
                                                placeholder="No Section mapped"
                                                className={`flex-1 px-3 py-2 border text-sm rounded-l-sm focus:outline-none ${!formData.containerId ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300 bg-white text-gray-700'}`}
                                            />
                                            {linkedContainerName && (
                                                <button onClick={() => { setLinkedContainerName(''); setFormData({ ...formData, containerId: undefined, pageId: undefined }) }} className="absolute right-12 top-2 text-gray-400 hover:text-red-500">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button onClick={() => setShowContainerSelector(true)} className="px-4 py-2 bg-white border border-l-0 border-gray-300 text-gray-600 hover:text-[var(--primary-color)] hover:bg-gray-50 rounded-r-sm transition-colors">
                                                <Pencil className="w-4 h-4" style={{ color: 'var(--icon-color)' }} />
                                            </button>
                                        </div>
                                        {!formData.containerId && <p className="text-[10px] text-red-500 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {getTranslation('MSG_SECTION_REQUIRED', currentLanguage)}</p>}
                                        <div className="pt-4">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_PUBLISHING_STATUS', currentLanguage)}</label>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 text-sm cursor-pointer bg-white px-3 py-2 border border-gray-200 rounded-sm shadow-sm hover:border-[var(--primary-color)] transition-colors flex-1">
                                                    <input
                                                        type="radio"
                                                        checked={formData.status === 'Published'}
                                                        onChange={() => setFormData({ ...formData, status: 'Published' })}
                                                        className="text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                                                    />
                                                    <span className="font-medium">{getTranslation('LABEL_PUBLISHED', currentLanguage)}</span>
                                                </label>
                                                <label className="flex items-center gap-2 text-sm cursor-pointer bg-white px-3 py-2 border border-gray-200 rounded-sm shadow-sm hover:border-[var(--primary-color)] transition-colors flex-1">
                                                    <input
                                                        type="radio"
                                                        checked={formData.status !== 'Published'}
                                                        onChange={() => setFormData({ ...formData, status: 'Draft' })}
                                                        className="text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                                                    />
                                                    <span className="font-medium">{getTranslation('LABEL_DRAFT', currentLanguage)}</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase">External URL <span className="text-red-500">*</span></label>
                                        <input type="text" value={formData.url || ''} onChange={(e) => setFormData({ ...formData, url: e.target.value })} placeholder="https://example.com or mailto:info@..." className="w-full px-3 py-2 border border-gray-300 text-sm rounded-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none bg-white shadow-sm" />
                                    </div>
                                )}
                            </div>
                        </> /* end GENERAL tab */
                    )}

                    {/* TRANSLATIONS TAB */}
                    {activeTab === 'TRANSLATIONS' && (
                        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                            <div className="flex justify-between items-center mb-6">
                                    <div className="flex gap-4 text-xs font-bold text-gray-500 uppercase">
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-300"></span> {getTranslation('LABEL_ORIGINAL_ENGLISH', currentLanguage)}</div>
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-600"></span> {getTranslation('LABEL_TRANSLATION', currentLanguage)}</div>
                                </div>
                                <button onClick={suggestUebersetzung} disabled={isTranslating || optionalTranslationLanguages.length === 0} className={`text-[var(--primary-color)] text-xs font-bold flex items-center gap-2 hover:underline ${isTranslating ? 'opacity-50 cursor-wait' : ''}`}>
                                    <Wand2 className={`w-3 h-3 ${isTranslating ? 'animate-pulse' : ''}`} /> {isTranslating ? getTranslation('MSG_TRANSLATING', currentLanguage) : getTranslation('BTN_SUGGEST_AI', currentLanguage)}
                                </button>
                            </div>
                            {optionalTranslationLanguages.length > 0 ? (
                                <>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                        <Globe className="w-3.5 h-3.5 text-[var(--primary-color)]" /> {getTranslation('TAB_TRANSLATIONS', currentLanguage)}
                                        <span className="text-[10px] text-gray-400 normal-case font-normal">(Optional — shown when that language is active)</span>
                                    </label>
                                    <div className="grid grid-cols-1 gap-4">
                                        {optionalTranslationLanguages.map(lang => {
                                            const langLabels: Record<string, { flag: string; placeholder: string }> = {
                                                de: { flag: '🇩🇪', placeholder: 'Enter German title...' },
                                                fr: { flag: '🇫🇷', placeholder: 'Entrez le titre en français...' },
                                                es: { flag: '🇪🇸', placeholder: 'Ingrese el título en español...' }
                                            };
                                            const meta = langLabels[lang] || { flag: '🌐', placeholder: `Enter title in ${lang}...` };
                                            const label = LANGUAGE_DISPLAY_NAMES[lang] || lang.toUpperCase();
                                            const currentVal = (formData.translations || {})[lang] || '';
                                            return (
                                                <div key={lang} className="flex items-center gap-3">
                                                    <span className="text-base w-6 text-center flex-shrink-0">{meta.flag}</span>
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{label}</label>
                                                        <input
                                                            type="text"
                                                            value={currentVal}
                                                            onChange={(e) => setFormData({
                                                                ...formData,
                                                                translations: { ...(formData.translations || {}), [lang]: e.target.value }
                                                            })}
                                                            placeholder={meta.placeholder}
                                                            className="w-full px-3 py-2 border border-gray-300 text-sm rounded-sm focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none bg-white shadow-sm"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm italic">{getTranslation('MSG_NO_ADDITIONAL_LANGUAGES', currentLanguage)}</p>
                                    <p className="text-xs mt-1">{getTranslation('MSG_ADD_LANGUAGES_SITE_MANAGER', currentLanguage)}</p>
                                </div>
                            )}
                        </div>
                    )}

                </div>{/* end scrollable body */}

                {/* Footer */}
                <div className="flex-shrink-0 bg-white border-t border-gray-100">
                    {/* Top row: metadata + action buttons */}
                    <div className="px-6 py-4 flex items-center justify-between gap-6">
                        <div className="flex-1">
                            {!isNew && formData.id ? (
                                <SharePointMetadataFooter
                                    listTitle="TopNavigation"
                                    itemId={formData.id}
                                    createdDate={item?.createdDate}
                                    modifiedDate={item?.modifiedDate}
                                    createdBy={item?.createdBy}
                                    modifiedBy={item?.modifiedBy}
                                    onDelete={!isNew ? () => setShowDeleteConfirm(true) : undefined}
                                    onVersionRestore={async () => {
                                        await useStore.getState().loadFromSharePoint();
                                        onCancel();
                                    }}
                                />
                            ) : (
                                <div />
                            )}
                        </div>
                        <div className="flex gap-3 flex-shrink-0 items-center">
                            <button type="button" onClick={onCancel} className="btn-secondary inline-flex items-center justify-center gap-2 transition-colors">
                                {getTranslation('BTN_CANCEL', currentLanguage)}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (isCreateNewPageMode) {
                                        handleCreateAndLinkPage().catch(console.error);
                                    } else if (canSave) {
                                        onSave(formData);
                                    }
                                }}
                                disabled={isCreateNewPageMode ? !canCreateNewPage : !canSave}
                                className={`btn-primary inline-flex items-center justify-center gap-2 transition-opacity capitalize ${(isCreateNewPageMode ? canCreateNewPage : canSave) ? 'hover:opacity-90' : 'opacity-50 cursor-not-allowed'}`}
                            >
                                <Check className="w-4 h-4" /> {isCreateNewPageMode
                                    ? getTranslation(
                                        isChildNav ? 'BTN_CREATE_SUBPAGE' : 'BTN_CREATE_NEW_PAGE',
                                        currentLanguage
                                    )
                                    : getTranslation('BTN_SAVE_CHANGES', currentLanguage)}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub-Selectors */}
                {showParentSelector && <ParentSelector currentParentId={formData.parentId || 'root'} onClose={() => setShowParentSelector(false)} onSelect={(id, _) => { setFormData({ ...formData, parentId: id }); setShowParentSelector(false); }} />}
                {showPageSelector && <SmartPageSelector onClose={() => setShowPageSelector(false)} onSelect={(id, _) => { setFormData({ ...formData, pageId: id }); setShowPageSelector(false); }} />}
                {showContainerSelector && <ContainerSelector onClose={() => setShowContainerSelector(false)} onSelect={(containerId, pageId) => {
                    const page = pages.find(p => p.id === pageId);
                    const container = page?.containers.find(c => String(c.id) === String(containerId));
                    const linkedStatus = container?.status === 'Published' ? 'Published' : 'Draft';
                    setFormData({
                        ...formData,
                        containerId,
                        pageId,
                        status: formData.containerId ? (formData.status || linkedStatus) : linkedStatus,
                    });
                    setShowContainerSelector(false);
                }} />}
                {showDeleteConfirm && <NavDeleteConfirmation onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)} />}
            </div>
        </div>
    );
};

interface NavSubItemProps {
    item: NavItem;
    allItems: NavItem[];
    onEdit: (item: NavItem) => void;
    onAddChild: (id: string) => void;
    currentLanguage?: LanguageCode;
}

const NavSubItem = ({ item, allItems, onEdit, onAddChild, currentLanguage }: NavSubItemProps) => {
    const [hovered, setHovered] = useState(false);
    const children = allItems.filter(n => n.parentId === item.id).sort((a, b) => a.order - b.order);
    const hasChildren = children.length > 0;

    return (
        <div
            className="relative"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Row */}
            <div
                className="px-4 py-2 hover:bg-gray-100 flex items-center justify-between text-sm cursor-pointer transition-colors"
                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            >
                <span className={`${!item.isVisible ? 'opacity-50 line-through decoration-red-400' : (item.type === 'Container' ? 'text-gray-400 opacity-60' : 'text-gray-700')} ${item.type === 'External' ? 'italic text-gray-500' : ''}`}>
                    {getNavItemTitle(item, currentLanguage || 'en')}
                    {item.type === 'External' && <span className="text-[9px] border border-gray-300 px-1 rounded ml-1 not-italic">{getTranslation('LABEL_EXTERNAL_SHORT', currentLanguage || 'en')}</span>}
                    {item.type === 'Container' && (
                        <Tooltip text='This is the "Scroll to" page, which takes you straight to this section on the corresponding page.'>
                            <span className="text-[9px] border border-[var(--primary-color)] px-1 rounded not-italic ml-1 text-[var(--primary-color)] cursor-pointer">{getTranslation('LABEL_SECTION_SHORT', currentLanguage || 'en')}</span>
                        </Tooltip>
                    )}
                    {item.type === 'Container' && item.status !== 'Published' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase bg-yellow-100 text-yellow-800 ml-1 not-italic">
                            {getTranslation('LABEL_DRAFT', currentLanguage || 'en')}
                        </span>
                    )}
                </span>
                <div className="flex items-center gap-1">
                    {hovered && <Pencil className="w-3 h-3 text-gray-400 hover:text-[var(--primary-color)] transition-colors" style={{ color: 'var(--icon-color)' }} />}
                    {(hasChildren || hovered) && (
                        <ChevronRight className={`w-4 h-4 transition-colors ${hovered ? 'text-[var(--primary-color)]' : 'text-gray-400'}`} />
                    )}
                </div>
            </div>

            {/* Flyout — show on hover so sub-children can be added even when none exist yet */}
            {hovered && (
                <div
                    className="absolute left-full top-0 z-[500] min-w-[200px] pl-px"
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                >
                    <div className="bg-white border border-gray-200 shadow-xl rounded-sm py-1 animate-in fade-in zoom-in-95 duration-100">
                        {children.map(child => (
                            <NavSubItem
                                key={child.id}
                                item={child}
                                allItems={allItems}
                                onEdit={onEdit}
                                onAddChild={onAddChild}
                                currentLanguage={currentLanguage}
                            />
                        ))}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onAddChild(item.id); }}
                            className={`w-full text-left px-4 py-2 text-xs text-[var(--primary-color)] hover:bg-[var(--brand-light)] font-bold flex items-center gap-1 transition-colors ${hasChildren ? 'border-t border-gray-100' : ''}`}
                        >
                            <Plus className="w-3 h-3" /> {getTranslation('BTN_ADD_LEVEL', (currentLanguage || 'en') as any)}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const NavPillDropdown = ({ item, allItems, onEdit, onAddChild, currentLanguage }: NavSubItemProps) => {
    const children = allItems.filter(n => n.parentId === item.id).sort((a, b) => a.order - b.order);
    return (
        <div className="relative group/parent inline-block">
            <div
                onClick={() => onEdit(item)}
                className={`px-4 py-2 bg-white border rounded-sm shadow-sm flex items-center gap-2 text-sm font-bold tracking-wide transition-all uppercase cursor-pointer ${!item.isVisible ? 'opacity-60 border-dashed border-red-300 text-gray-500' : 'border-gray-200 hover:border-[var(--primary-color)] text-gray-700 hover:text-[var(--primary-color)]'}`}
            >
                <span>{getNavItemTitle(item, currentLanguage || 'en')}</span>
                {item.type === 'External' && <Globe className="w-3 h-3 text-orange-400" />}
                {item.type === 'Container' && (
                    <Tooltip text='This is the "Scroll to" page, which takes you straight to this section on the corresponding page.'>
                        <ListIcon className="w-3 h-3 text-[var(--primary-color)] cursor-pointer" />
                    </Tooltip>
                )}
                {item.type === 'Container' && item.status !== 'Published' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase bg-yellow-100 text-yellow-800">
                        {getTranslation('LABEL_DRAFT', currentLanguage || 'en')}
                    </span>
                )}
                <Pencil className="w-3 h-3 text-gray-400 ml-1" style={{ color: 'var(--icon-color)' }} />
                {!item.isVisible && <EyeOff className="w-3 h-3 text-red-400" />}
                {children.length > 0 && <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>
            <div className="absolute top-full left-0 hidden group-hover/parent:block pt-1 z-10 min-w-[200px] animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="bg-white border border-gray-200 shadow-xl rounded-sm py-1">
                    {children.map(child => (<NavSubItem key={child.id} item={child} allItems={allItems} onEdit={onEdit} onAddChild={onAddChild} currentLanguage={currentLanguage} />))}
                    <button onClick={() => onAddChild(item.id)} className="w-full text-left px-4 py-2 text-xs text-[var(--primary-color)] hover:bg-[var(--brand-light)] font-bold border-t border-gray-100 flex items-center gap-1 transition-colors">
                        <Plus className="w-3 h-3" /> {getTranslation('BTN_ADD_LEVEL', (currentLanguage || 'en') as any)}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface NavListRowProps {
    item: NavItem;
    level: number;
    allItems: NavItem[];
    pages: Page[];
    onEdit: (item: NavItem) => void;
    onDelete: (id: string) => void;
    currentLanguage?: LanguageCode;
}

const BASE_URL = 'https://political-risk.org/';

const NavListRow = ({ item, level, allItems, pages, onEdit, onDelete, currentLanguage }: NavListRowProps) => {
    const children = allItems.filter(n => n.parentId === item.id).sort((a, b) => a.order - b.order);

    // Build display URL
    const getDisplayUrl = (): string => {
        if (item.type === 'External') {
            return item.url || '—';
        }
        if (item.type === 'Container') {
            return `Section Link (Page: ${pages.find(p => p.id === item.pageId)?.title?.en || '...'})`;
        }
        // Internal SmartPage: nested route from navigation hierarchy
        if (item.type === 'Page' && item.pageId) {
            const routeSlug = getNavItemRouteSlug(allItems, pages, item.id);
            return `${BASE_URL}#${routeSlug}`;
        }
        return '—';
    };

    const displayUrl = getDisplayUrl();
    const isExternal = item.type === 'External';

    return (
        <React.Fragment>
            <tr className="border-b border-gray-100 hover:bg-[var(--brand-light)] group transition-colors relative hover:z-10">
                <td className="py-3 px-4">
                    <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
                        <GripVertical className="w-4 h-4 text-gray-300 cursor-move" />
                        <span className={`text-sm font-medium ${!item.isVisible ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{getNavItemTitle(item, currentLanguage || 'en')}</span>
                        {item.type === 'Container' && item.status !== 'Published' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase bg-yellow-100 text-yellow-800">
                                {getTranslation('LABEL_DRAFT', currentLanguage || 'en')}
                            </span>
                        )}
                        {!item.isVisible && <EyeOff className="w-3 h-3 text-red-400" />}
                    </div>
                </td>
                <td className="py-3 px-4 text-xs font-mono">
                    {item.type === 'Container' ? (
                        <div className="flex items-center gap-2 overflow-visible">
                            <Tooltip text='This is the "Scroll to" page, which takes you straight to this section on the corresponding page.'>
                                <ListIcon className="w-3 h-3 text-gray-400 cursor-pointer" />
                            </Tooltip>
                            <span className="truncate max-w-[320px] text-gray-400 opacity-60 cursor-not-allowed">{displayUrl}</span>
                        </div>
                    ) : (
                        <a
                            href={displayUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1 hover:underline truncate max-w-[400px] ${isExternal ? 'text-orange-600' : 'text-[var(--primary-color)]'
                                }`}
                            title={displayUrl}
                        >
                            {isExternal
                                ? <Globe className="w-3 h-3 flex-shrink-0 text-orange-600" />
                                : <FileText className="w-3 h-3 flex-shrink-0 text-[var(--primary-color)]" />
                            }
                            {displayUrl}
                        </a>
                    )}
                </td>
                <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(item)} className="p-1.5 hover:bg-white rounded-sm border border-transparent hover:border-gray-200 shadow-sm" title={getTranslation('BTN_EDIT', currentLanguage || 'en')}><Pencil className="w-3.5 h-3.5" style={{ color: 'var(--icon-color)' }} /></button>
                        <button onClick={() => onDelete(item.id)} className="p-1.5 text-red-600 hover:bg-white rounded-sm border border-transparent hover:border-red-100 shadow-sm" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                </td>
            </tr>
            {children.map(child => (<NavListRow key={child.id} item={child} level={level + 1} allItems={allItems} pages={pages} onEdit={onEdit} onDelete={onDelete} currentLanguage={currentLanguage} />))}
        </React.Fragment>
    );
};

export const NavigationManager = ({ onClose }: { onClose: () => void }) => {
    const { siteConfig, pages, addNavItem, updateNavItem, updateNavPosition, updateNavAlignment, updateHeaderConfig, updateLogo, deleteNavItem, uploadImage, currentLanguage, webStudioUserRole } = useStore();
    const isSiteAdminUser = isSiteAdmin(webStudioUserRole);
    const [view, setView] = useState<'VISUAL' | 'LIST'>('VISUAL');
    const [editingItem, setEditingItem] = useState<NavItem | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [addingParentId, setAddingParentId] = useState<string | undefined>(undefined);
    const [showHelp, setShowHelp] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const imageUpload = useOptimizedImageUpload(uploadImage);

    const rootItems = siteConfig.navigation
        .filter((n) => n.parentId === 'root')
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const uploaded = await imageUpload.uploadFile(file, 'Logos');
            if (uploaded) {
                updateLogo({ ...siteConfig.logo, url: (uploaded as { url: string }).url });
            }
        } catch (err) {
            console.error("Logo upload failed:", err);
        }
    };

    // --- MIGRATION LOGIC REMOVED to allow External Links ---
    // previously converted all External items to Pages automatically

    const handleSaveItem = async (item: Partial<NavItem>) => {
        const parentId = item.parentId || 'root';
        const siblings = siteConfig.navigation.filter((n) => n.parentId === parentId && (!isAdding || n.id !== item.id));
        const itemWithOrder = { ...item, parentId, order: item.order ?? siblings.length };

        if (isAdding) {
            await addNavItem(itemWithOrder as NavItem);
            setIsAdding(false);
        } else {
            await updateNavItem(itemWithOrder as NavItem);
        }
        setEditingItem(null);
        setIsAdding(false);
        setAddingParentId(undefined);
    };
    const startAdd = (parentId?: string) => { setAddingParentId(parentId || 'root'); setIsAdding(true); setEditingItem(null); };
    const confirmDelete = () => { if (deleteId) { deleteNavItem(deleteId); setDeleteId(null); } };
    const renderLogoSettings = (showPosition: boolean) => (
        <div className="bg-gray-50 p-6 rounded-sm border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-4">{getTranslation('NAV_LOGO_SETTINGS', currentLanguage)}</label>
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{getTranslation('LABEL_SITE_NAME', currentLanguage)}</label>
                    <div className="relative">
                        <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder={getTranslation('PLACEHOLDER_SITE_NAME', currentLanguage)}
                            value={siteConfig.name}
                            onChange={(e) => updateHeaderConfig({ name: e.target.value })}
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none transition-shadow focus:shadow-sm"
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <ImageIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input type="text" placeholder={getTranslation('PLACEHOLDER_LOGO_URL', currentLanguage)} value={siteConfig.logo.url} onChange={(e) => updateLogo({ ...siteConfig.logo, url: e.target.value })} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none transition-shadow focus:shadow-sm" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className={`flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-sm cursor-pointer hover:bg-gray-50 text-gray-500 transition-colors group shadow-sm ${imageUpload.isBusy ? 'opacity-50 cursor-wait' : ''}`}>
                            <Upload className={`w-4 h-4 ${imageUpload.isBusy ? 'animate-pulse' : ''}`} />
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => { handleLogoUpload(e).catch(console.error); }} disabled={imageUpload.isBusy} />
                        </label>
                        <ImageOptimizationFeedback stats={imageUpload.stats} isProcessing={imageUpload.isOptimizing} />
                    </div>
                    <input type="text" placeholder={getTranslation('PLACEHOLDER_LOGO_WIDTH', currentLanguage)} value={siteConfig.logo.width} onChange={(e) => updateLogo({ ...siteConfig.logo, width: e.target.value })} className="w-24 px-3 py-2 border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none transition-shadow focus:shadow-sm" />
                </div>
                {showPosition && (
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{getTranslation('NAV_LOGO_POSITION', currentLanguage)}</label>
                        <div className="flex gap-4">
                            {['left', 'center', 'right'].map(pos => (
                                <label key={pos} className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="logoPos" checked={siteConfig.logo.position === pos} onChange={() => updateLogo({ ...siteConfig.logo, position: pos as any })} className="text-[var(--primary-color)] focus:ring-[var(--primary-color)]" />
                                    <span className="text-sm text-gray-600 capitalize">{getTranslation(pos === 'left' ? 'LABEL_LEFT' : pos === 'center' ? 'LABEL_CENTER' : 'LABEL_RIGHT', currentLanguage)}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const footerContent = (
        <div className="flex justify-between w-full items-center">
            <OpenOOTBButton listTitle="TopNavigation" />
            <button type="button" onClick={onClose} className="btn-secondary inline-flex items-center justify-center gap-2">
                {getTranslation('BTN_CLOSE', currentLanguage)} <EditTrigger labelKey="BTN_CLOSE" />
            </button>
        </div>
    );

    return (
        <GenericModal
            className="navigation-management-popup"
            title={getTranslation('NAV_MGMT', currentLanguage)}
            onClose={onClose}
            width="w-[80vw] min-w-[80vw] max-w-[80vw]"
            noFooter={true}
            customFooter={footerContent}
            headerIcons={
                <div className="flex items-center gap-4">
                    <div className="flex border border-[var(--primary-color)] rounded-sm overflow-hidden shadow-sm">
                        <button type="button" onClick={() => setView('VISUAL')} className={`ws-view-toggle-label-btn px-3 py-1.5 text-xs font-bold flex items-center gap-2 transition-colors ${view === 'VISUAL' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-[var(--brand-light)]'}`}><Monitor className="w-3 h-3" /> {getTranslation('BTN_VISUAL_VIEW', currentLanguage)}</button>
                        <button type="button" onClick={() => setView('LIST')} className={`ws-view-toggle-label-btn px-3 py-1.5 text-xs font-bold flex items-center gap-2 transition-colors ${view === 'LIST' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-[var(--brand-light)]'}`}><ListIcon className="w-3 h-3" /> {getTranslation('BTN_LIST_VIEW', currentLanguage)}</button>
                    </div>
                    <div className="h-5 w-px bg-gray-300"></div>
                    <HelpCircle onClick={() => setShowHelp(true)} className="w-5 h-5 text-gray-400 cursor-pointer hover:text-[var(--primary-color)]" />
                    <TooltipMenu ComponentId={'1805'} />
                </div>
            }
        >
            <div className="space-y-8 h-full flex flex-col pb-8">

                {/* Navigation Items Area */}
                <div className="flex-1">
                    {view === 'VISUAL' ? (
                        <div className="flex flex-wrap items-start gap-3 p-4 bg-white border border-gray-200 rounded-sm min-h-[150px] shadow-sm content-start">
                            {rootItems.map(item => (<NavPillDropdown key={item.id} item={item} allItems={siteConfig.navigation} onEdit={(i) => { setEditingItem(i); setIsAdding(false); }} onAddChild={startAdd} currentLanguage={currentLanguage} />))}
                            <button type="button" onClick={() => startAdd('root')} className="ws-compact-toolbar-btn px-4 py-2 bg-[var(--btn-primary-bg)] text-white text-sm font-bold rounded-sm hover:bg-[var(--btn-primary-hover-bg)] flex items-center gap-2 shadow-sm transition-all active:scale-95">
                                <Plus className="w-4 h-4" /> {getTranslation('BTN_ADD_NAV_ITEM', currentLanguage)}
                            </button>
                        </div>
                    ) : (
                        <div className="border border-gray-200 bg-white rounded-sm shadow-sm">
                            <div className="flex justify-between items-center p-3 border-b border-gray-200 bg-gray-50">
                                <h4 className="text-sm font-bold text-gray-700">{getTranslation('NAV_MGMT', currentLanguage)}</h4>
                                <button type="button" onClick={() => startAdd('root')} className="ws-compact-toolbar-btn ws-compact-toolbar-btn--sm px-3 py-1.5 bg-[var(--btn-primary-bg)] text-white text-xs font-bold rounded-sm hover:bg-[var(--btn-primary-hover-bg)] flex items-center gap-1 shadow-sm transition-colors">
                                    <Plus className="w-3 h-3" /> {getTranslation('BTN_ADD_NAV_ITEM', currentLanguage)}
                                </button>
                            </div>
                            <table className="w-full">
                                <thead className="bg-gray-100 text-xs font-bold text-gray-500 uppercase border-b border-gray-200">
                                    <tr><th className="px-4 py-2 text-left w-1/3">{getTranslation('LABEL_TITLE', currentLanguage)}</th><th className="px-4 py-2 text-left">{getTranslation('LABEL_URL_PAGE', currentLanguage)}</th><th className="px-4 py-2 text-right w-24">{getTranslation('TH_ACTIONS', currentLanguage)}</th></tr>
                                </thead>
                                <tbody>
                                    {rootItems.map(item => (<NavListRow key={item.id} item={item} level={0} allItems={siteConfig.navigation} pages={pages} onEdit={(i) => { setEditingItem(i); setIsAdding(false); }} onDelete={(id) => setDeleteId(id)} currentLanguage={currentLanguage} />))}
                                    {rootItems.length === 0 && (<tr><td colSpan={3} className="p-8 text-center text-gray-400 italic">{getTranslation('MSG_NO_NAV_ITEMS_FOUND', currentLanguage)}</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Global Settings: Site Languages (Super Admin only) */}
                {!isSiteAdminUser && (
                    <div className="pt-8 border-t border-gray-200">
                        <SiteLanguagesConfiguration
                            languages={siteConfig.languages}
                            currentLanguage={currentLanguage}
                            onLanguagesChange={(languages) => updateHeaderConfig({ languages, defaultLanguage: 'en' })}
                        />
                    </div>
                )}

                {/* Configuration Section */}
                <div className="pt-8 border-t border-gray-200">
                    <h3 className="text-sm font-bold text-gray-700 mb-6 uppercase tracking-wider flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-[var(--primary-color)]" /> {getTranslation('NAV_HEADER_CONFIG', currentLanguage)}
                    </h3>
                    {isSiteAdminUser ? (
                        <div className="max-w-2xl">
                            {renderLogoSettings(false)}
                        </div>
                    ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Menu Placement Card */}
                        <div className="bg-gray-50 p-6 rounded-sm border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-4">{getTranslation('NAV_MENU_PLACEMENT', currentLanguage)}</label>
                            <div className="space-y-6">
                                <div className="flex gap-4 flex-wrap">
                                    {[
                                        { id: 'right', labelKey: 'NAV_RIGHT_OF_PAGE' },
                                        { id: 'near_logo', labelKey: 'NAV_NEAR_LOGO' },
                                        { id: 'below_logo', labelKey: 'NAV_NEXT_LINE' }
                                    ].map(opt => (
                                        <label key={opt.id} className={`flex items-center gap-2 cursor-pointer bg-white px-3 py-2 border rounded-sm shadow-sm transition-all ${siteConfig.navPosition === opt.id ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)]' : 'border-gray-200 hover:border-gray-300'}`}>
                                            <input type="radio" name="navPos" checked={siteConfig.navPosition === opt.id} onChange={() => updateNavPosition(opt.id as any)} className="text-[var(--primary-color)] focus:ring-[var(--primary-color)]" />
                                            <span className="text-sm font-medium text-gray-700">{getTranslation(opt.labelKey, currentLanguage)}</span>
                                        </label>
                                    ))}
                                </div>
                                {siteConfig.navPosition === 'below_logo' && (
                                    <div className="animate-in fade-in slide-in-from-top-1 pl-4 border-l-2 border-blue-200">
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{getTranslation('NAV_ROW_ALIGNMENT', currentLanguage)}</label>
                                        <div className="flex gap-4">
                                            {['left', 'center', 'right'].map(align => (
                                                <label key={align} className="flex items-center gap-2 cursor-pointer">
                                                    <input type="radio" name="navAlign" checked={siteConfig.navAlignment === align} onChange={() => updateNavAlignment(align as any)} className="text-[var(--primary-color)] focus:ring-[var(--primary-color)]" />
                                                    <span className="text-sm text-gray-600 capitalize">{getTranslation(align === 'left' ? 'LABEL_LEFT' : align === 'center' ? 'LABEL_CENTER' : 'LABEL_RIGHT', currentLanguage)}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="pt-4 border-t border-gray-200 space-y-4">
                                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 border border-gray-200 rounded-sm shadow-sm w-fit">
                                        <input
                                            type="checkbox"
                                            checked={siteConfig.showBreadcrumb !== false}
                                            onChange={(e) => updateHeaderConfig({ showBreadcrumb: e.target.checked })}
                                            className="text-[var(--primary-color)] focus:ring-[var(--primary-color)] rounded"
                                        />
                                        <span className="text-sm font-medium text-gray-700">{getTranslation('NAV_SHOW_BREADCRUMB', currentLanguage)}</span>
                                    </label>
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase">
                                            {getTranslation('NAV_NAVIGATION_WIDTH', currentLanguage)}
                                        </label>
                                        <select
                                            value={siteConfig.navigationWidth || ''}
                                            onChange={(e) => {
                                                const value = e.target.value as SiteConfig['navigationWidth'] | '';
                                                updateHeaderConfig({
                                                    navigationWidth: value || undefined,
                                                    navigationWidthCustom: value === 'custom' ? siteConfig.navigationWidthCustom : '',
                                                });
                                            }}
                                            className="w-full text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] bg-white p-2 focus:outline-none focus:border-[var(--primary-color)]"
                                        >
                                            <option value="">{getTranslation('NAV_USE_GLOBAL_PAGE_WIDTH', currentLanguage)}</option>
                                            <option value="full">{getTranslation('NAV_FULL_PAGE', currentLanguage)}</option>
                                            <option value="custom">{getTranslation('NAV_PAGE_WIDTH_CUSTOM', currentLanguage)}</option>
                                        </select>
                                        {siteConfig.navigationWidth === 'custom' && (
                                            <input
                                                type="text"
                                                value={siteConfig.navigationWidthCustom || ''}
                                                onChange={(e) => updateHeaderConfig({ navigationWidthCustom: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none bg-white"
                                                placeholder={getTranslation('PLACEHOLDER_PAGE_WIDTH_CUSTOM', currentLanguage)}
                                            />
                                        )}
                                        <p className="text-xs text-gray-500 leading-relaxed">
                                            {getTranslation('NAV_NAVIGATION_WIDTH_HINT', currentLanguage)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Logo Settings Card */}
                        {renderLogoSettings(true)}
                    </div>
                    )}
                </div>
            </div>

            {/* Sub Modals */}
            {(editingItem || isAdding) && (<NavItemEditor item={editingItem || {}} isNew={isAdding} onSave={handleSaveItem} onCancel={() => { setEditingItem(null); setIsAdding(false); setAddingParentId(undefined); }} forcedParentId={addingParentId} />)}
            {showHelp && <HelpGuideModal onClose={() => setShowHelp(false)} />}
            {deleteId && (<NavDeleteConfirmation onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />)}
        </GenericModal>

    );
};