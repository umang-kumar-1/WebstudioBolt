
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore, getLocalizedText, getTranslation } from '../../store';
import { ContainerType, Page, NavItem, LanguageCode } from '../../types';
import { GenericModal, SharedVersionHistoryModal, EditTrigger, Tooltip, OpenOOTBButton } from './SharedModals';
import { MODAL_Z } from '../../utils/modalZIndex';
import { ContainerEditorModal } from './ContainerEditor';
import { SelectHeaderTemplatePopup } from './SelectHeaderTemplatePopup';
import { isImageTextSliderContainer } from '../../utils/templatePermissions';
import { SliderManager } from './SliderManager';
import {
    GripVertical, ExternalLink, ChevronDown,
    Upload, Pencil, Plus, LayoutTemplate, LayoutGrid, Clock, FileText,
    CornerDownRight, Image as ImageIcon, MessageSquare,
    Link as LinkIcon, ChevronUp, List as ListIcon,
    HelpCircle
} from 'lucide-react';
import { CreateSmartPageModal, SmartPageEditor } from './SmartPageManager';
import TooltipMenu from '../common/TooltipMenu';
import { slugToPreviewHash } from '../../utils/previewNavigation';
import { compareContainersByOrder } from '../../utils/containerContentHelpers';
import { getNestedPortalZFromStore } from '../../utils/modalZIndex';

// --- CONSTANTS ---
const DRAG_TYPE_NAV = 'NAV_ITEM';
const DRAG_TYPE_ORPHAN = 'ORPHAN_PAGE';
const DRAG_TYPE_CONTAINER = 'CONTAINER';

// --- HELPERS ---
const getContainerIcon = (type: ContainerType) => {
    switch (type) {
        case ContainerType.HERO: return <LayoutTemplate className="w-5 h-5 text-purple-600" />;
        case ContainerType.CONTACT_FORM: return <MessageSquare className="w-5 h-5 text-orange-600" />;
        case ContainerType.IMAGE_TEXT: return <ImageIcon className="w-5 h-5 text-blue-600" />;
        case ContainerType.SLIDER: return <LayoutGrid className="w-5 h-5 text-pink-600" />;
        case ContainerType.CARD_GRID: return <LayoutGrid className="w-5 h-5 text-indigo-600" />;
        default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
};

const getPagePublicUrl = (page: Page): string => {
    const baseUrl = window.location.href.split('#')[0];
    const hash = slugToPreviewHash(page.slug);
    return hash ? `${baseUrl}${hash}` : baseUrl;
};

const getContainerLabel = (type: ContainerType, lang: LanguageCode) => {
    switch (type) {
        case ContainerType.HERO: return getTranslation('CONTAINER_TYPE_HERO', lang);
        case ContainerType.CONTACT_FORM: return getTranslation('CONTAINER_TYPE_CONTACT_FORM', lang);
        case ContainerType.IMAGE_TEXT: return getTranslation('CONTAINER_TYPE_IMAGE_TEXT', lang);
        case ContainerType.SLIDER: return getTranslation('CONTAINER_TYPE_SLIDER', lang);
        case ContainerType.CARD_GRID: return getTranslation('CONTAINER_TYPE_CARD_GRID', lang);
        case ContainerType.DATA_GRID: return getTranslation('CONTAINER_TYPE_DATA_GRID', lang);
        case ContainerType.TABLE: return getTranslation('CONTAINER_TYPE_TABLE', lang);
        case ContainerType.MAP: return getTranslation('CONTAINER_TYPE_MAP', lang);
        case ContainerType.CONTAINER_SECTION: return getTranslation('CONTAINER_TYPE_CONTAINER_SECTION', lang);
        default: return getTranslation('CONTAINER_TYPE_DEFAULT', lang);
    }
};

const getNavItemTitle = (item: NavItem, lang: LanguageCode): string => {
    if (lang && lang !== 'en' && item.translations && item.translations[lang]) {
        return item.translations[lang];
    }
    const { pages } = useStore.getState();

    // For section links, always prefer the actual container title.
    if (item.type === 'Container' && item.containerId) {
        // First check the associated page if available
        if (item.pageId) {
            const page = pages.find(p => p.id === item.pageId);
            if (page) {
                const linkedContainer = page.containers.find(c => String(c.id) === String(item.containerId));
                if (linkedContainer) {
                    return getLocalizedText(linkedContainer.content?.title, lang) || linkedContainer.title || item.title;
                }
            }
        }
        // Fallback to checking other pages
        for (const page of pages) {
            if (page.id === item.pageId) continue;
            const linkedContainer = page.containers.find(c => String(c.id) === String(item.containerId));
            if (linkedContainer) {
                return getLocalizedText(linkedContainer.content?.title, lang) || linkedContainer.title || item.title;
            }
        }
    }

    // Navigation title is the source of truth for Page/External items — not the linked page title.
    return item.title || 'Untitled';
};

const getNavItemHierarchy = (parentId: string, allItems: NavItem[], lang: LanguageCode, depth: number = 0): string => {
    if (!parentId || parentId === 'root' || depth > 10) return '';
    const parent = allItems.find(n => n.id === parentId);
    if (!parent) return '';
    const parentTitle = getNavItemTitle(parent, lang);
    const prefix = getNavItemHierarchy(parent.parentId, allItems, lang, depth + 1);
    return prefix ? `${prefix} > ${parentTitle}` : parentTitle;
};

const navToggleHelpText = `This toggle controls how you can edit the navigation structure:

- When the toggle is **off** (disabled), you can change the parent of a page (move a page under a new parent).

- When the toggle is **on** (enabled), you can sort pages among their siblings to adjust their order within the current parent.

Switch the toggle to easily swap between changing parent relationships and sorting pages within the same parent.`;

// --- SUB-COMPONENTS ---

// 2. Add Page Modal removed as it's now using CreateSmartPageModal from SmartPageManager


// 3. Navigation Item (Recursive)
interface NavItemCardProps {
    item: NavItem;
    level: number;
    selectedPageId: string | null;
    onSelect: (id: string) => void;
    allItems: NavItem[];
    onDrop: (sourceId: string, targetId: string, type: string) => void;
}

const NavItemCard = ({ item, level, selectedPageId, onSelect, allItems, onDrop }: NavItemCardProps) => {
    const { pages, currentLanguage } = useStore();
    const children = allItems.filter((n: NavItem) => n.parentId === item.id).sort((a: NavItem, b: NavItem) => a.order - b.order);
    const page = pages.find(p => p.id === item.pageId);
    const navDisplayStatus = item.type === 'Container'
        ? (item.status || 'Draft')
        : page?.status;

    const isSelected = page && page.id === selectedPageId;

    const handleDragStart = (e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.setData('type', DRAG_TYPE_NAV);
        e.dataTransfer.setData('id', item.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const type = e.dataTransfer.getData('type');
        const id = e.dataTransfer.getData('id');
        onDrop(id, item.id, type);
    };

    return (
        <div className="select-none">
            <div
                className={`
                    relative flex items-center justify-between p-3 border-b border-gray-100 transition-all hover:z-50
                    ${item.type === 'Container' ? 'cursor-default' : 'cursor-pointer'}
                    ${isSelected && item.type !== 'Container' ? 'bg-blue-50 border-l-4 border-l-[var(--primary-color)]' : 'bg-white hover:bg-gray-50 border-l-4 border-l-transparent'}
                `}
                style={{ paddingLeft: `${16 + (level * 20)}px` }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (item.type !== 'Container' && item.pageId) onSelect(item.pageId);
                }}
                draggable
                onDragStart={handleDragStart}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
            >
                <div className="flex items-center gap-3 overflow-visible">
                    <GripVertical className="w-4 h-4 text-gray-300 cursor-move flex-shrink-0" />
                    {level > 0 && <CornerDownRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                    <div className="flex items-center gap-2 overflow-visible">
                        {item.type === 'Container' && (
                            <Tooltip text='This is the "Scroll to" page, which takes you straight to this section on the corresponding page.'>
                                <ListIcon className="w-3 h-3 text-gray-400" />
                            </Tooltip>
                        )}
                        <span
                            className={`text-sm font-medium truncate max-w-[150px]
                                ${isSelected && item.type !== 'Container' ? 'text-[var(--primary-color)] font-bold' : (item.type === 'Container' ? 'text-gray-400 opacity-80' : 'text-gray-700')}
                            `}
                        >
                            {getNavItemTitle(item, currentLanguage)}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {item.type === 'Container' ? (
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] border border-gray-300 px-1 rounded-sm text-gray-400 font-bold uppercase">{getTranslation('LABEL_SECTION_SHORT', currentLanguage)}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${navDisplayStatus === 'Published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                                {navDisplayStatus}
                            </span>
                        </div>
                    ) : page ? (
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${page.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                                {page.status}
                            </span>
                        </div>
                    ) : (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-sm uppercase flex items-center gap-1"><LinkIcon className="w-3 h-3" /> External</span>
                    )}
                </div>
            </div>
            {children.map((child: NavItem) => (
                <NavItemCard
                    key={child.id}
                    item={child}
                    level={level + 1}
                    selectedPageId={selectedPageId}
                    onSelect={onSelect}
                    allItems={allItems}
                    onDrop={onDrop}
                />
            ))
            }
        </div >
    );
};

// --- MAIN COMPONENT ---
export const SiteManager = ({ onClose }: { onClose: () => void }) => {
    const {
        siteConfig, pages, addPage, updatePage, deletePage, addNavItem, deleteNavItem,
        editingContainerId, setEditingContainerId, reorderContainers,
        updateNavItem, publishPage, currentLanguage,
        isNavLocked, setIsNavLocked
    } = useStore();

    // ... (rest of the state and handlers, no changes needed here but I will skip them for brevity if not affected, 
    // but the tool requires me to provide replacement for the target block. 
    // I will target the component definition start and destructuring first, then specific blocks.)

    // State
    const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
    const [isPageInfoOpen, setIsPageInfoOpen] = useState(true);
    const [isAddingContainer, setIsAddingContainer] = useState(false);
    const [showAddPageModal, setShowAddPageModal] = useState(false);
    const [editingPage, setEditingPage] = useState<Page | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const nestedModalZ = getNestedPortalZFromStore(0);

    const normalizeSlug = (value?: string): string => {
        if (!value) return '';
        const decoded = decodeURIComponent(value.trim());
        if (!decoded) return '';
        if (decoded === '#' || decoded === '/#') return '/';
        const withoutHash = decoded.startsWith('#') ? decoded.slice(1) : decoded;
        return withoutHash.startsWith('/') ? withoutHash : `/${withoutHash}`;
    };

    const getRequestedSlugFromUrl = (): string => {
        const hashSlug = normalizeSlug(window.location.hash);
        if (hashSlug && hashSlug !== '/') return hashSlug;

        const params = new URLSearchParams(window.location.search);
        const querySlug = normalizeSlug(
            params.get('page') ||
            params.get('slug') ||
            params.get('path') ||
            params.get('route') ||
            ''
        );
        if (querySlug && querySlug !== '/') return querySlug;

        return '/';
    };

    // Initial Selection
    useEffect(() => {
        if (!selectedPageId && pages.length > 0) {
            const requestedSlug = getRequestedSlugFromUrl();
            const urlMatchedPage = pages.find(p => normalizeSlug(p.slug) === requestedSlug);
            if (urlMatchedPage) {
                setSelectedPageId(urlMatchedPage.id);
                return;
            }

            const homeNav = siteConfig.navigation.find(n => n.title.toLowerCase() === 'home');
            if (homeNav?.pageId) {
                setSelectedPageId(homeNav.pageId);
                return;
            }

            const homePage = pages.find(p => normalizeSlug(p.slug) === '/');
            if (homePage) {
                setSelectedPageId(homePage.id);
                return;
            }

            setSelectedPageId(pages[0].id);
        }
    }, [pages, siteConfig.navigation, selectedPageId]);

    const activePage = pages.find(p => p.id === selectedPageId);
    const activePagePublicUrl = activePage ? getPagePublicUrl(activePage) : '';

    // Derived Data
    const internalNavItems = siteConfig.navigation.filter(n => (n.type === 'Page' || n.type === 'Container') && pages.some(p => p.id === n.pageId));
    const rootNavItems = internalNavItems.filter(n => n.parentId === 'root').sort((a, b) => a.order - b.order);
    const orphanPages = pages.filter(p => !siteConfig.navigation.some(n => n.pageId === p.id));
    const displayContainers = activePage ? [...activePage.containers].sort(compareContainersByOrder) : [];

    // --- HANDLERS ---

    const handleCreatePage = async (pageData: Partial<Page>) => {
        const addedPage = await addPage(pageData as Page);
        setShowAddPageModal(false);
        if (addedPage) {
            setSelectedPageId(addedPage.id);
            setEditingPage(addedPage);
        }
    };

    const handlePublishPage = () => {
        if (activePage) {
            publishPage(activePage.id);
        }
    };

    // DRAG & DROP LOGIC
    const handleNavDrop = (sourceId: string, targetId: string, type: string) => {
        if (sourceId === targetId) return;

        if (type === DRAG_TYPE_NAV) {
            const sourceItem = siteConfig.navigation.find(n => n.id === sourceId);
            if (!sourceItem) return;

            // Toggle OFF: parent change mode
            if (!isNavLocked) {
                // Allow dropping to root even though there is no target nav item object.
                if (targetId === 'root') {
                    const rootSiblings = siteConfig.navigation
                        .filter(n => n.parentId === 'root' && n.id !== sourceId)
                        .sort((a, b) => a.order - b.order);

                    updateNavItem({
                        ...sourceItem,
                        parentId: 'root',
                        order: rootSiblings.length
                    });
                    return;
                }

                const targetItem = siteConfig.navigation.find(n => n.id === targetId);
                if (!targetItem) return;

                // Prevent invalid cyclical relationship (cannot move a node under its own descendant).
                const isDescendant = (candidateId: string, ancestorId: string): boolean => {
                    let current = siteConfig.navigation.find(n => n.id === candidateId);
                    let guard = 0;
                    while (current && current.parentId !== 'root' && guard < 100) {
                        if (current.parentId === ancestorId) return true;
                        current = siteConfig.navigation.find(n => n.id === current!.parentId);
                        guard += 1;
                    }
                    return false;
                };
                if (targetItem.id === sourceItem.id || isDescendant(targetItem.id, sourceItem.id)) return;

                const targetChildren = siteConfig.navigation
                    .filter(n => n.parentId === targetId && n.id !== sourceId)
                    .sort((a, b) => a.order - b.order);

                updateNavItem({
                    ...sourceItem,
                    parentId: targetId,
                    order: targetChildren.length
                });
                return;
            }

            // Toggle ON: sibling sorting mode
            const targetItem = siteConfig.navigation.find(n => n.id === targetId);
            if (!targetItem) return;
            if (sourceItem.parentId !== targetItem.parentId) return;

            const siblingParentId = sourceItem.parentId;
            const siblings = siteConfig.navigation
                .filter(n => n.parentId === siblingParentId && n.id !== sourceId)
                .sort((a, b) => a.order - b.order);

            const targetIndex = siblings.findIndex(n => n.id === targetId);
            if (targetIndex < 0) return;

            const reordered = [...siblings];
            reordered.splice(targetIndex, 0, { ...sourceItem, parentId: siblingParentId });

            reordered.forEach((item, index) => {
                if (item.order !== index || item.parentId !== siblingParentId) {
                    updateNavItem({ ...item, parentId: siblingParentId, order: index });
                }
            });
        } else if (type === DRAG_TYPE_ORPHAN) {
            // Adding orphan pages is allowed only in parent-change mode.
            if (isNavLocked) return;
            const page = pages.find(p => p.id === sourceId);
            if (page) {
                addNavItem({
                    id: `nav_${Date.now()}`,
                    parentId: targetId,
                    title: getLocalizedText(page.title, currentLanguage),
                    type: 'Page',
                    pageId: page.id,
                    isVisible: true,
                    openInNewTab: false,
                    order: 99
                });
            }
        }
    };

    const handleRootDrop = (e: React.DragEvent) => {
        // Root drop is valid only in parent-change mode.
        if (isNavLocked) return;
        e.preventDefault();
        const type = e.dataTransfer.getData('type');
        const id = e.dataTransfer.getData('id');
        handleNavDrop(id, 'root', type);
    };

    const handleOrphanDrop = (e: React.DragEvent) => {
        if (isNavLocked) return;
        e.preventDefault();
        const type = e.dataTransfer.getData('type');
        const id = e.dataTransfer.getData('id');

        // If dropping a nav item back to orphans, effectively remove it from nav
        if (type === DRAG_TYPE_NAV) {
            deleteNavItem(id);
        }
    };

    const handleContainerDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('type');
        if (type !== DRAG_TYPE_CONTAINER || !activePage) return;

        const sourceIndex = parseInt(e.dataTransfer.getData('index'));
        if (sourceIndex === targetIndex) return;

        const newOrder = [...displayContainers];
        const [moved] = newOrder.splice(sourceIndex, 1);
        newOrder.splice(targetIndex, 0, moved);

        reorderContainers(activePage.id, newOrder.map((c, i) => ({ ...c, order: i })));
    };

    const customFooter = (
        <div className="flex justify-between w-full items-center">
            <OpenOOTBButton listTitle="SmartPages" />
            <button type="button" onClick={onClose} className="btn-secondary inline-flex items-center justify-center gap-2">
                {getTranslation('BTN_CLOSE', currentLanguage)} <EditTrigger labelKey="BTN_CLOSE" />
            </button>
        </div>
    );

    return (
        <GenericModal
            title={getTranslation('SITE_MGMT', currentLanguage)}
            onClose={onClose}
            width="w-[80vw] min-w-[80vw] max-w-[80vw]"
            noFooter={true}
            customFooter={customFooter}
            headerIcons={<TooltipMenu ComponentId={'1109'} />}
        >
            <div className="flex h-full w-full bg-white border-t border-gray-200">

                {/* --- LEFT PANEL --- */}
                <div className="w-[35%] flex flex-col border-r border-gray-200 bg-gray-50/50">

                    {/* Top Navigation Header */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="px-4 h-14 border-b border-gray-200 bg-white flex-shrink-0 flex justify-between items-center shadow-sm z-10">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                {getTranslation('LABEL_TOP_NAV', currentLanguage)} <EditTrigger labelKey="LABEL_TOP_NAV" />
                                {/* <Tooltip text={getTranslation('TOOLTIP_NAV_ORGANIZE', currentLanguage)}>
                                    <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-pointer" />
                                </Tooltip> */}
                            </h3>
                            <div className="flex items-center gap-3">
                                {/* Toggle Switch */}
                                <div
                                    onClick={() => setIsNavLocked(!isNavLocked)}
                                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors duration-200 ${isNavLocked ? 'bg-[var(--btn-primary-bg)]' : 'bg-gray-300'}`} >
                                    <div className={`absolute top-1 bottom-1 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-200 ${isNavLocked ? 'left-6' : 'left-1'}`} />
                                </div>
                                <Tooltip text={navToggleHelpText}>
                                    <HelpCircle className="w-3.5 h-3.5 text-[var(--primary-color)] cursor-pointer" />
                                </Tooltip>

                                {!isNavLocked && (
                                    <Tooltip text={getTranslation('TOOLTIP_ADD_PAGE', currentLanguage)}>
                                        <button
                                            onClick={() => setShowAddPageModal(true)}
                                            className="text-[var(--primary-color)] text-xs font-bold flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded-sm border border-transparent hover:border-blue-100 transition-all"
                                        >
                                            <Plus className="w-3 h-3" /> {getTranslation('BTN_ADD_PAGE', currentLanguage)}
                                        </button>
                                    </Tooltip>
                                )}
                            </div>
                        </div>

                        {/* Nav Tree Canvas */}
                        <div
                            className="flex-1 overflow-y-auto p-2"
                            onDragOver={(e) => { if (!isNavLocked) e.preventDefault(); }}
                            onDrop={handleRootDrop}
                        >
                            <div className="bg-white border border-gray-200 rounded-sm shadow-sm min-h-[50px]">
                                {rootNavItems.map(item => (
                                    <NavItemCard
                                        key={item.id}
                                        item={item}
                                        level={0}
                                        selectedPageId={selectedPageId}
                                        onSelect={setSelectedPageId}
                                        allItems={internalNavItems}
                                        onDrop={handleNavDrop}
                                    />
                                ))}
                                {rootNavItems.length === 0 && (
                                    <div className="text-center p-8 text-gray-400 text-xs italic">
                                        {getTranslation('MSG_NAV_EMPTY', currentLanguage)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {!isNavLocked && (
                        <>
                            {/* Pages Not In Navigation */}
                            <div className="h-[35%] flex flex-col border-t border-gray-200 bg-white">
                                <div className="px-4 h-14 border-b border-gray-200 bg-white flex-shrink-0 flex justify-between items-center shadow-sm z-10">
                                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                        {getTranslation('LABEL_ORPHAN_PAGES', currentLanguage)} <EditTrigger labelKey="LABEL_ORPHAN_PAGES" />
                                    </h3>
                                </div>
                                <div
                                    className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-100/50"
                                    onDragOver={(e) => { if (!isNavLocked) e.preventDefault(); }}
                                    onDrop={handleOrphanDrop}
                                >
                                    {orphanPages.map(page => (
                                        <div
                                            key={page.id}
                                            draggable={!isNavLocked}
                                            onDragStart={(e) => {
                                                if (isNavLocked) return;
                                                e.dataTransfer.setData('type', DRAG_TYPE_ORPHAN);
                                                e.dataTransfer.setData('id', page.id);
                                            }}
                                            onClick={() => setSelectedPageId(page.id)}
                                            className={`
                                                flex justify-between items-center p-3 bg-white border rounded-sm shadow-sm cursor-pointer hover:shadow-md transition-all
                                                ${selectedPageId === page.id ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)]' : 'border-gray-200 hover:border-gray-300'}
                                            `}
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {!isNavLocked && <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />}
                                                <span className="text-sm font-medium text-gray-700 truncate">{getLocalizedText(page.title, currentLanguage)}</span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.open(getPagePublicUrl(page), '_blank', 'noopener,noreferrer');
                                                    }}
                                                    className="flex-shrink-0 p-0.5 rounded-sm hover:bg-blue-50 opacity-50 hover:opacity-100 transition-opacity"
                                                    title={getTranslation('LABEL_OPEN_LINK_NEW_TAB', currentLanguage)}
                                                    aria-label={getTranslation('LABEL_OPEN_LINK_NEW_TAB', currentLanguage)}
                                                >
                                                    <ExternalLink className="w-3 h-3 text-[var(--primary-color)]" />
                                                </button>
                                            </div>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase ${page.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {page.status}
                                            </span>
                                        </div>
                                    ))}
                                    {orphanPages.length === 0 && (
                                        <div className="text-center p-6 text-gray-400 text-xs italic">{getTranslation('MSG_ALL_PAGES_ASSIGNED', currentLanguage)}</div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* --- RIGHT PANEL: PAGE LAYOUT --- */}
                <div className="flex-1 flex flex-col bg-gray-50 h-full relative">
                    {activePage ? (
                        <>
                            {/* Dynamic Header */}
                            <div className="px-6 h-14 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between z-20">
                                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    {getTranslation('LABEL_LAYOUT_FOR', currentLanguage)} <span className="text-[var(--primary-color)]">{getLocalizedText(activePage.title, currentLanguage)}</span>
                                </h3>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-8 pb-32">
                                <div className="w-full space-y-6">

                                    {/* Page Info Card */}
                                    <div className="border border-gray-200 bg-white rounded-sm shadow-sm">
                                        <div
                                            className="px-6 py-3 bg-white border-b border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors relative hover:z-20"
                                            onClick={() => setIsPageInfoOpen(!isPageInfoOpen)}
                                        >
                                            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                                                {getTranslation('SECTION_PAGE_INFO', currentLanguage)} <EditTrigger labelKey="SECTION_PAGE_INFO" />
                                            </h4>
                                            {isPageInfoOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                        </div>

                                        {isPageInfoOpen && (
                                            <div className="p-6 space-y-4">
                                                <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                                                    <span className="text-sm font-bold text-gray-800 flex items-center gap-1">{getTranslation('LABEL_TITLE', currentLanguage)}:</span>
                                                    <span className="text-sm text-gray-600">{getLocalizedText(activePage.title, currentLanguage)}</span>
                                                </div>
                                                <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                                                    <span className="text-sm font-bold text-gray-800 flex items-center gap-1">{getTranslation('TAB_SEO', currentLanguage)}:</span>
                                                    <span className="text-sm text-gray-400 italic">{getTranslation('MSG_NOT_CONFIGURED', currentLanguage)}</span>
                                                </div>
                                                <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                                                    <span className="text-sm font-bold text-gray-800 flex items-center gap-1">{getTranslation('LABEL_STATUS', currentLanguage)}:</span>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block w-max ${activePage.status === 'Published' ? 'bg-green-100 text-green-800' : 'bg-yellow-400 text-yellow-900'}`}>
                                                        {activePage.status}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                                                    <span className="text-sm font-bold text-gray-800 flex items-center gap-1">{getTranslation('LABEL_CONTAINERS_STATUS', currentLanguage)}:</span>
                                                    <span className="text-xs text-gray-500 font-medium">
                                                        {`${activePage.containers.filter(c => c.status === 'Published').length} ${getTranslation('STATUS_PUBLISHED', currentLanguage)} / ${activePage.containers.filter(c => c.status === 'Draft').length} ${getTranslation('STATUS_DRAFT', currentLanguage)}`}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                                                    <span className="text-sm font-bold text-gray-800 flex items-center gap-1">{getTranslation('LABEL_PUBLIC_URL', currentLanguage)}:</span>
                                                    <span className="text-sm font-mono text-gray-500 break-all">{activePagePublicUrl}</span>
                                                </div>
                                                <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                                                    <span className="text-sm font-bold text-gray-800 flex items-center gap-1">{getTranslation('LABEL_PARENT', currentLanguage)}:</span>
                                                    <span className="text-sm text-gray-500 font-medium italic">
                                                        {(() => {
                                                            const navItem = siteConfig.navigation.find(n => n.pageId === activePage.id);
                                                            if (!navItem) return getTranslation('MSG_NOT_IN_NAVIGATION', currentLanguage);
                                                            const parentPath = getNavItemHierarchy(navItem.parentId, siteConfig.navigation, (currentLanguage || 'en') as any);
                                                            const currentTitle = getNavItemTitle(navItem, (currentLanguage || 'en') as any);
                                                            return parentPath ? `${parentPath} > ${currentTitle}` : currentTitle;
                                                        })()}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                                                    <span className="text-sm font-bold text-gray-800 flex items-center gap-1">{getTranslation('LABEL_CREATED', currentLanguage)}:</span>
                                                    <span className="text-sm text-gray-600">
                                                        {activePage.createdDate ? new Date(activePage.createdDate).toLocaleDateString() : 'N/A'}
                                                        {activePage.createdBy && ` ${getTranslation('LBL_BY', currentLanguage)} ${activePage.createdBy}`}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                                                    <span className="text-sm font-bold text-gray-800 flex items-center gap-1">{getTranslation('LABEL_MODIFIED', currentLanguage)}:</span>
                                                    <span className="text-sm text-gray-600">
                                                        {activePage.modifiedDate ? new Date(activePage.modifiedDate).toLocaleDateString() : 'N/A'}
                                                        {activePage.modifiedBy && ` ${getTranslation('LBL_BY', currentLanguage)} ${activePage.modifiedBy}`}
                                                    </span>
                                                </div>
                                                <div className="border-t border-gray-100 pt-4 mt-2 flex justify-between items-center">
                                                    <button onClick={() => setShowHistory(true)} className="text-[var(--primary-color)] text-sm font-medium hover:underline flex items-center gap-1">
                                                        <Clock className="w-4 h-4" /> {getTranslation('BTN_HISTORY', currentLanguage)}
                                                    </button>
                                                    {(() => {
                                                        const hasDraftContainers = activePage.containers.some(c => c.status === 'Draft');
                                                        const isPageDraft = activePage.status === 'Draft';

                                                        if (isPageDraft || hasDraftContainers) {
                                                            return (
                                                                <button
                                                                    onClick={handlePublishPage}
                                                                    className="ws-compact-toolbar-btn px-4 py-2 bg-[var(--btn-primary-bg)] text-white text-sm font-bold rounded-sm shadow-sm hover:opacity-90 flex items-center gap-2"
                                                                >
                                                                    <Upload className="w-4 h-4" />
                                                                    {isPageDraft ? getTranslation('BTN_PUBLISH', currentLanguage) : getTranslation('BTN_PUBLISH_CHANGES', currentLanguage)}
                                                                </button>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Containers List */}
                                    <div className="space-y-4">
                                        {displayContainers.map((container, idx) => (
                                            <div
                                                key={container.id}
                                                draggable
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('type', DRAG_TYPE_CONTAINER);
                                                    e.dataTransfer.setData('index', idx.toString());
                                                }}
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={(e) => handleContainerDrop(e, idx)}
                                                className="bg-white border border-gray-200 rounded-sm shadow-sm flex items-center p-4 group hover:shadow-md transition-shadow cursor-default"
                                            >
                                                <div className="mr-4 cursor-move text-gray-300 hover:text-gray-500">
                                                    <GripVertical className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                                                        {getContainerIcon(container.type)}
                                                        {getLocalizedText(container.content.title, currentLanguage) || getContainerLabel(container.type, currentLanguage).toUpperCase()}
                                                    </h4>
                                                </div>
                                                <div className="mx-4 flex items-center gap-3">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${container.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {container.status}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => setEditingContainerId(container.id)}
                                                    className="p-2 rounded-sm transition-all shadow-sm"
                                                    style={{
                                                        backgroundColor: 'var(--edit-icon-bg, #2563eb)',
                                                        color: 'var(--edit-icon-color, #ffffff)',
                                                    }}
                                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--edit-icon-hover-bg, #1d4ed8)')}
                                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--edit-icon-bg, #2563eb)')}
                                                >
                                                    <Pencil className="w-4 h-4" style={{ color: 'var(--edit-icon-color)' }} />
                                                </button>
                                            </div>
                                        ))}

                                        {displayContainers.length === 0 && (
                                            <div className="text-center p-8 text-gray-400 bg-white border border-dashed border-gray-300 rounded-sm">
                                                {getTranslation('MSG_NO_CONTAINERS', currentLanguage)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Add Container */}
                                    <button
                                        onClick={() => setIsAddingContainer(true)}
                                        className="w-full py-4 border-2 border-dashed border-gray-300 rounded-sm flex items-center justify-center gap-2 text-gray-500 font-bold hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] hover:bg-white transition-all group bg-gray-50/50"
                                    >
                                        <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" /> {getTranslation('BTN_ADD_CONTAINER', currentLanguage)}
                                    </button>

                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <LayoutTemplate className="w-16 h-16 mb-4 opacity-20" />
                            <p className="font-bold text-lg">{getTranslation('MSG_NO_PAGE_SELECTED', currentLanguage)}</p>
                            <p className="text-sm">{getTranslation('MSG_SELECT_PAGE_EDIT', currentLanguage)}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- MODALS --- */}
            {
                isAddingContainer && selectedPageId && (
                    <SelectHeaderTemplatePopup pageId={selectedPageId} onClose={() => setIsAddingContainer(false)} />
                )
            }

            {editingContainerId && createPortal(
                <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" style={{ zIndex: nestedModalZ }}>
                    <div className="absolute inset-0" onClick={() => setEditingContainerId(null)} />
                    <div className="relative z-50">
                        {(() => {
                            const c = activePage?.containers.find(c => c.id === editingContainerId);
                            if (!c) return null;

                            if (c.type === ContainerType.SLIDER && isImageTextSliderContainer(c.settings)) {
                                return <SliderManager onClose={() => setEditingContainerId(null)} />;
                            }
                            return <ContainerEditorModal onClose={() => setEditingContainerId(null)} />;
                        })()}
                    </div>
                </div>,
                document.body
            )}

            {showAddPageModal && <CreateSmartPageModal onSave={handleCreatePage} onCancel={() => setShowAddPageModal(false)} />}

            {showHistory && (
                <SharedVersionHistoryModal
                    listTitle="SmartPages"
                    itemId={selectedPageId || ''}
                    onClose={() => setShowHistory(false)}
                    onVersionRestore={() => void useStore.getState().loadFromSharePoint()}
                />
            )}

            {editingPage && (
                <SmartPageEditor
                    item={editingPage}
                    onSave={(updated) => { updatePage(updated); setEditingPage(null); }}
                    onCancel={() => setEditingPage(null)}
                    onDelete={(id) => { deletePage(id); setEditingPage(null); setSelectedPageId(null); }}
                />
            )}
        </GenericModal >
    );
};
