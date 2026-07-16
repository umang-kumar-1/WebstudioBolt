import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore, getLocalizedText, getGlobalTranslation, getTranslation } from '../store';
import {
  buildPreviewSectionHash,
  getPreviewSectionAnchorFromHash,
  navigatePreviewToPage,
} from '../utils/previewNavigation';
import { getNavItemRouteSlug } from '../utils/pageHierarchy';
import { canManagePermissions, isSiteAdmin, isEditor } from '../utils/templatePermissions';
import { getOptionalEnabledLanguages } from '../utils/siteLanguages';
import { ModalType, ViewMode, NavItem, MultilingualText } from '../types';
import { EditTrigger } from './modals/SharedModals';
import {
  Globe, LayoutTemplate, FileText, Calendar, Archive, FileImage,
  Languages, Users, MessageSquare, Paintbrush, ChevronDown,
  ChevronRight, ChevronLeft, Pencil, History, File, CornerDownRight, List as ListIcon, X, Eye, SwatchBook
} from 'lucide-react';

interface SidebarProps {
  mobileOverlay?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

type GlobalMenuItem = {
  icon: React.ElementType;
  labelKey: string;
  modalType: ModalType;
};

const GLOBAL_MENU_ITEMS: GlobalMenuItem[] = [
  { icon: LayoutTemplate, labelKey: 'NAV_MGMT', modalType: ModalType.NAVIGATION },
  { icon: FileText, labelKey: 'NEWS_MGMT', modalType: ModalType.NEWS },
  { icon: Calendar, labelKey: 'EVENT_MGMT', modalType: ModalType.EVENTS },
  { icon: Archive, labelKey: 'DOC_MGMT', modalType: ModalType.DOCUMENTS },
  { icon: LayoutTemplate, labelKey: 'FOOTER_MGMT', modalType: ModalType.FOOTER },
  { icon: Globe, labelKey: 'SITE_MGMT', modalType: ModalType.SITE_MGMT },
  { icon: FileImage, labelKey: 'IMG_MGMT', modalType: ModalType.IMAGES },
  { icon: Languages, labelKey: 'CONTENT_TRANS', modalType: ModalType.TRANSLATION },
  { icon: Users, labelKey: 'PERM_MGMT', modalType: ModalType.PERMISSIONS },
  { icon: MessageSquare, labelKey: 'CONTACT_Q', modalType: ModalType.CONTACT_QUERIES },
  { icon: SwatchBook, labelKey: 'THEME_TEMPLATE_MGMT', modalType: ModalType.THEME_TEMPLATES },
  { icon: Paintbrush, labelKey: 'STYLING', modalType: ModalType.STYLING },
];

const SUPER_ADMIN_ONLY_MENU_KEYS = new Set(['PERM_MGMT', 'STYLING']);
const SITE_ADMIN_ONLY_MENU_KEYS = new Set(['THEME_TEMPLATE_MGMT']);
const EDITOR_ONLY_MENU_KEYS = new Set(['NEWS_MGMT', 'EVENT_MGMT', 'DOC_MGMT', 'CONTACT_Q']);

const getVisibleGlobalMenuItems = (
  isSuperAdminUser: boolean,
  isSiteAdminUser: boolean,
  isEditorUser: boolean,
  siteConfig?: { languages?: import('../types').LanguageCode[] }
): GlobalMenuItem[] =>
  GLOBAL_MENU_ITEMS.filter((item) => {
    if (isEditorUser && !isSuperAdminUser && !isSiteAdminUser) {
      return EDITOR_ONLY_MENU_KEYS.has(item.labelKey);
    }
    if (item.labelKey === 'CONTENT_TRANS') {
      return getOptionalEnabledLanguages(siteConfig || {}).length > 0;
    }
    if (SUPER_ADMIN_ONLY_MENU_KEYS.has(item.labelKey)) {
      return isSuperAdminUser;
    }
    if (SITE_ADMIN_ONLY_MENU_KEYS.has(item.labelKey)) {
      return isSiteAdminUser && !isSuperAdminUser;
    }
    return true;
  });

const getMenuLabel = (
  labelKey: string,
  currentLanguage: string,
  uiLabels: Record<string, MultilingualText>
): string => (
  uiLabels[labelKey]
    ? (uiLabels[labelKey][currentLanguage as keyof MultilingualText] || uiLabels[labelKey]['en'])
    : labelKey
);

/** Icon-only rail button with fixed-position portal tooltip (avoids overflow clipping). */
const SidebarRailButton: React.FC<{
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}> = ({ icon: Icon, label, onClick, isActive = false }) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  const showTooltip = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTooltipPos({
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltipPos(null);
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={onClick}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className={`ws-sidebar-rail-btn group${isActive ? ' ws-sidebar-rail-btn--active' : ''}`}
        aria-label={label}
      >
        <Icon className="ws-sidebar-rail-btn__icon" aria-hidden="true" />
      </button>
      {tooltipPos && typeof document !== 'undefined' && createPortal(
        <span
          className="ws-sidebar-rail-tooltip-fixed"
          role="tooltip"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          {label}
        </span>,
        document.body
      )}
    </>
  );
};

// --- Shared Accordion Component ---
interface SidebarAccordionProps {
  icon: React.ElementType;
  label: string;
  editLabelKey?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

// Standardized visual design for accordions (Icon + Title Left, Chevron Right)
const SidebarAccordion: React.FC<SidebarAccordionProps> = ({ icon: Icon, label, editLabelKey, isOpen, onToggle, children }) => {
  return (
    <div className="border-b border-[var(--sidebar-border-color)]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors group relative hover:bg-[var(--sidebar-hover-bg)]"
        style={{
          backgroundColor: isOpen ? 'var(--sidebar-active-bg)' : undefined,
          color: isOpen ? 'var(--sidebar-active-text-color)' : 'var(--sidebar-text)',
        }}
      >
        {/* Active Indicator Line */}
        {isOpen && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1"
            style={{ backgroundColor: 'var(--sidebar-active-indicator-color)' }}
          />
        )}

        <div className="flex items-center gap-3 min-w-0">
          {/* Icon aligned left */}
          <Icon className={`w-4 h-4 flex-shrink-0 ${isOpen ? 'text-[var(--sidebar-active-text-color)]' : 'text-[var(--sidebar-icon-color)]'}`} />

          {/* Text */}
          <span className={`text-xs font-bold uppercase tracking-wider truncate select-none ${isOpen ? 'text-[var(--sidebar-active-text-color)]' : 'text-[var(--sidebar-text)]'}`}>
            {label}
          </span>

          {/* Edit Trigger next to text */}
          {editLabelKey && (
            <div onClick={(e) => e.stopPropagation()} className="flex items-center">
              <EditTrigger labelKey={editLabelKey} className={isOpen ? 'text-[var(--sidebar-active-text-color)]' : ''} />
            </div>
          )}
        </div>

        {/* Chevron aligned right */}
        {isOpen ? (
          <ChevronDown className={`w-5 h-5 flex-shrink-0 ml-2 ${isOpen ? 'text-[var(--sidebar-active-text-color)]' : 'text-gray-400 group-hover:text-gray-600'}`} />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 flex-shrink-0 ml-2" />
        )}
      </button>

      {isOpen && (
        <div className="py-2 bg-[var(--sidebar-bg)] border-t border-dashed border-[var(--sidebar-border-color)]">
          {children}
        </div>
      )}
    </div>
  );
};

// --- Reusable Global Item ---
const GlobalItem = ({ icon: Icon, labelKey, modalType }: GlobalMenuItem) => {
  const { openModal, currentLanguage, uiLabels } = useStore();
  const label = getMenuLabel(labelKey, currentLanguage, uiLabels);

  return (
    <div className="group flex items-center justify-between px-4 py-2.5 text-sm text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] cursor-pointer transition-colors border-l-2 border-transparent hover:border-[var(--sidebar-border-color)]">
      <div className="flex items-center gap-3 min-w-0" onClick={() => openModal(modalType)}>
        <Icon className="w-4 h-4 text-[var(--sidebar-icon-color)] flex-shrink-0 opacity-80 group-hover:opacity-100" />
        <span className="font-medium truncate">{label}</span>
      </div>
      <EditTrigger labelKey={labelKey} />
    </div>
  );
};

const CollapsedSidebarRail: React.FC<{
  onExpandToPages: () => void;
  menuItems: GlobalMenuItem[];
  editorOnly?: boolean;
}> = ({ onExpandToPages, menuItems, editorOnly = false }) => {
  const { openModal, viewMode, toggleViewMode, currentLanguage, uiLabels } = useStore();

  const getLabel = (key: string) => getTranslation(key, currentLanguage);

  return (
    <div className="ws-editor-sidebar-rail flex-1 flex flex-col min-h-0">
      <div className="ws-editor-sidebar-rail-scroll flex-1 overflow-y-auto admin-scroll py-2">
        <div className="ws-editor-sidebar-rail-section" role="navigation" aria-label={getLabel('SITE_GLOBALS')}>
          {menuItems.map((item) => (
            <SidebarRailButton
              key={item.labelKey}
              icon={item.icon}
              label={getMenuLabel(item.labelKey, currentLanguage, uiLabels)}
              onClick={() => openModal(item.modalType)}
            />
          ))}
        </div>

        {!editorOnly && (
        <>
        <div className="ws-editor-sidebar-rail-divider" aria-hidden="true" />

        <div className="ws-editor-sidebar-rail-section" role="group" aria-label={getLabel('PAGE_PREVIEW')}>
          <SidebarRailButton
            icon={Eye}
            label={getLabel('PAGE_PREVIEW')}
            onClick={() => { if (viewMode !== ViewMode.PREVIEW) toggleViewMode(); }}
            isActive={viewMode === ViewMode.PREVIEW}
          />
          <SidebarRailButton
            icon={Pencil}
            label={getLabel('EDIT_MODE')}
            onClick={() => { if (viewMode !== ViewMode.EDIT) toggleViewMode(); }}
            isActive={viewMode === ViewMode.EDIT}
          />
        </div>

        <div className="ws-editor-sidebar-rail-divider" aria-hidden="true" />

        <div className="ws-editor-sidebar-rail-section">
          <SidebarRailButton
            icon={History}
            label={getTranslation('TITLE_VERSION_HISTORY', currentLanguage)}
            onClick={() => openModal(ModalType.VERSION_HISTORY)}
          />
          <SidebarRailButton
            icon={File}
            label={getLabel('SECTION_PAGE_INFO')}
            onClick={() => openModal(ModalType.PAGE_INFO)}
          />
          <SidebarRailButton
            icon={LayoutTemplate}
            label={getLabel('PAGES')}
            onClick={onExpandToPages}
          />
        </div>
        </>
        )}
      </div>
    </div>
  );
};

// --- Recursive Nav Item Component ---
interface SidebarNavItemProps {
  item: NavItem;
  level: number;
  allItems: NavItem[];
  currentPageId: string;
  onSelect: (id: string) => void;
  lastClickedId: string | null;
  setLastClickedId: (id: string | null) => void;
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({ item, level, allItems, currentPageId, onSelect, lastClickedId, setLastClickedId }) => {
  const { translationItems, currentLanguage, pages } = useStore();
  const children = allItems.filter(n => n.parentId === item.id).sort((a, b) => a.order - b.order);
  const isPage = item.type === 'Page' && item.pageId;
  const isContainer = item.type === 'Container' && item.containerId && item.pageId;

  // The link is "active/enabled" only if it's the current page (for page type)
  // OR if it's the specific item that was just clicked (for sections)
  const isActive = (isPage && item.pageId === currentPageId && !lastClickedId) || (lastClickedId === item.id);

  const localizedTitle = getGlobalTranslation(
    item.id,
    translationItems,
    currentLanguage,
    item.title
  );

  const handleClick = () => {
    setLastClickedId(item.id);
    if (isContainer && item.pageId && item.containerId) {
      // Match PreviewArea top nav: section DOM ids come from slugified container title, not `container-{id}`.
      const isSamePage = String(item.pageId) === String(currentPageId);
      if (!isSamePage) {
        onSelect(item.pageId);
      }
      const delay = isSamePage ? 50 : 250;
      setTimeout(() => {
        const target = pages.find(p => String(p.id) === String(item.pageId));
        if (!target) return;
        const targetContainer = target.containers.find(c => String(c.id) === String(item.containerId));
        const title = targetContainer?.title || '';
        const anchor = title ? title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/-+/g, '-') : `container-${item.containerId}`;
        const pageRoute = item.type === 'Page'
          ? getNavItemRouteSlug(allItems, pages, item.id)
          : (target.slug || '/');
        const resolvedUrl = buildPreviewSectionHash(pageRoute, anchor);
        const anchorId = getPreviewSectionAnchorFromHash(resolvedUrl) || anchor;
        let containerElem =
          document.getElementById(anchorId) ||
          document.getElementById(`container-${item.containerId}`) ||
          (document.querySelector(`[data-container-id="${item.containerId}"]`) as HTMLElement | null);
        if (containerElem) {
          containerElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
          window.history.pushState(null, '', resolvedUrl);
        }
      }, delay);
    } else if (isPage && item.pageId) {
      setLastClickedId(null);
      const routeSlug = getNavItemRouteSlug(allItems, pages, item.id);
      navigatePreviewToPage(item.pageId, pages, onSelect, routeSlug);
    }
  };

  return (
    <>
      <div
        onClick={handleClick}
        className={`flex items-center gap-2 px-4 py-2 text-sm cursor-pointer transition-all border-l-2 hover:bg-[var(--sidebar-hover-bg)]`}
        style={{
          paddingLeft: `${16 + (level * 16)}px`,
          backgroundColor: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
          color: isActive ? 'var(--sidebar-active-text-color)' : (item.isVisible ? 'var(--sidebar-text-muted)' : 'var(--sidebar-text-muted) opacity-50'),
          borderLeftColor: isActive ? 'var(--sidebar-active-indicator-color)' : 'transparent',
          fontWeight: isActive ? 600 : 400
        }}
      >
        {/* Visual Cue for Child */}
        {level > 0 && <CornerDownRight className="w-3 h-3 opacity-30" />}

        {item.type === 'Page' ? (
          <File className="w-3 h-3 opacity-50" />
        ) : item.type === 'Container' ? (
          <ListIcon className="w-3 h-3 opacity-50" />
        ) : (
          <Globe className="w-3 h-3 opacity-30" />
        )}

        <span className="flex-1 truncate">{localizedTitle}</span>

        {isActive && <div className="w-1.5 h-1.5 rounded-none" style={{ backgroundColor: 'var(--sidebar-active-indicator-color)' }}></div>}
      </div>
      {children.map(child => (
        <SidebarNavItem key={child.id} item={child} level={level + 1} allItems={allItems} currentPageId={currentPageId} onSelect={onSelect} lastClickedId={lastClickedId} setLastClickedId={setLastClickedId} />
      ))}
    </>
  );
};


export const Sidebar: React.FC<SidebarProps> = ({
  mobileOverlay = false,
  mobileOpen = false,
  onMobileClose,
}) => {
  const {
    viewMode, toggleViewMode,
    pages, currentPageId, setCurrentPage,
    openModal, currentLanguage,
    siteConfig,
    webStudioUserRole,
  } = useStore();

  const isSuperAdminUser = canManagePermissions(webStudioUserRole);
  const isSiteAdminUser = isSiteAdmin(webStudioUserRole);
  const isEditorUser = isEditor(webStudioUserRole);
  const isEditorOnlyView = isEditorUser && !isSuperAdminUser && !isSiteAdminUser;
  const visibleGlobalMenuItems = getVisibleGlobalMenuItems(isSuperAdminUser, isSiteAdminUser, isEditorUser, siteConfig);

  const [isGlobalsOpen, setIsGlobalsOpen] = useState(true);
  const [isPagesOpen, setIsPagesOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const activePage = pages.find(p => p.id === currentPageId);

  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const getLabel = (key: string) => {
    return getTranslation(key, currentLanguage);
  };

  const navItems = siteConfig.navigation;
  const rootNavItems = navItems.filter(n => n.parentId === 'root').sort((a, b) => a.order - b.order);

  const sidebarWidthClass = mobileOverlay
    ? 'ws-editor-sidebar-mobile'
    : (isSidebarCollapsed ? 'ws-editor-sidebar--collapsed' : 'w-72');

  const sidebarOpenClass = mobileOverlay && mobileOpen ? 'ws-editor-sidebar-open' : '';
  const showCollapsedRail = isSidebarCollapsed && !mobileOverlay;

  const handleExpandToPages = () => {
    setIsSidebarCollapsed(false);
    setIsPagesOpen(true);
  };

  return (
    <div
      className={`ws-editor-sidebar ${sidebarWidthClass} ${sidebarOpenClass} flex flex-col h-screen shadow-lg flex-shrink-0 transition-all duration-300`}
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        color: 'var(--sidebar-text)',
        borderRight: mobileOverlay ? 'none' : '1px solid var(--sidebar-border-color)'
      }}
    >
      {/* Brand & Language Switcher */}
      <div
        className={`flex items-center ${showCollapsedRail ? 'justify-center px-2 h-16' : 'justify-between px-4 h-16'} relative flex-shrink-0`}
        style={{ borderBottom: '1px solid var(--sidebar-border-color)' }}
      >
        {showCollapsedRail ? (
          <>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(false)}
              className="ws-sidebar-rail-brand"
              aria-label={getLabel('APP_TITLE')}
              title={getLabel('APP_TITLE')}
            >
              <Globe className="w-5 h-5" strokeWidth={2.5} aria-hidden="true" />
            </button>
            {/* Expand chevron in collapsed header — disabled; globe click expands sidebar
            <SidebarRailButton
              icon={ChevronRight}
              label="Expand sidebar"
              onClick={() => setIsSidebarCollapsed(false)}
            />
            */}
          </>
        ) : (
          <>
            <div className="flex items-center min-w-0">
              <div
                className="w-8 h-8 flex items-center justify-center mr-3"
                style={{ backgroundColor: 'var(--sidebar-button-color)', color: '#ffffff' }}
              >
                <Globe className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col min-w-0">
                <h6 className="font-bold leading-tight flex items-center gap-1 min-w-0" style={{ color: 'var(--sidebar-text)' }}>
                  <span className="truncate">{getLabel('APP_TITLE')}</span>
                  <EditTrigger labelKey="APP_TITLE" className="flex-shrink-0 ml-1" />
                  <span style={{ color: 'var(--sidebar-icon-color)' }} className="align-top text-[10px] flex-shrink-0">®</span>
                </h6>
                <span className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1 min-w-0" style={{ color: 'var(--sidebar-text-muted)' }}>
                  <span className="truncate">{getLabel('APP_SUBTITLE')}</span>
                  <EditTrigger labelKey="APP_SUBTITLE" className="flex-shrink-0" />
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {mobileOverlay && (
                <button
                  onClick={onMobileClose}
                  className="w-8 h-8 flex items-center justify-center hover:bg-[var(--sidebar-hover-bg)] transition-colors"
                  title="Close menu"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} />
                </button>
              )}
              {!mobileOverlay && (
              <button
                onClick={() => {
                  setIsSidebarCollapsed(true);
                }}
                className="w-8 h-8 flex items-center justify-center hover:bg-[var(--sidebar-hover-bg)] transition-colors"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} />
              </button>
              )}
            </div>
          </>
        )}
      </div>

      {showCollapsedRail && (
        <CollapsedSidebarRail
          onExpandToPages={handleExpandToPages}
          menuItems={visibleGlobalMenuItems}
          editorOnly={isEditorOnlyView}
        />
      )}

      {(!isSidebarCollapsed || mobileOverlay) && <div className="flex-1 overflow-y-auto admin-scroll">

        {/* 1. Site Globals Accordion */}
        <SidebarAccordion
          icon={Globe}
          label={getLabel('SITE_GLOBALS')}
          editLabelKey="SITE_GLOBALS"
          isOpen={isGlobalsOpen}
          onToggle={() => setIsGlobalsOpen(!isGlobalsOpen)}
        >
          {visibleGlobalMenuItems.map((item) => (
            <GlobalItem key={item.labelKey} {...item} />
          ))}
        </SidebarAccordion>

        {!isEditorOnlyView && (
        <>
        {/* 2. Page Preview / Edit Mode Toggle */}
        <div className="px-4 py-4 border-b border-[var(--sidebar-border-color)]">
          <div className="flex shadow-sm overflow-hidden border border-[var(--sidebar-border-color)]">
            <button
              onClick={toggleViewMode}
              className={`flex-1 px-2 py-2 text-xs font-bold tracking-wide transition-colors flex items-center justify-center gap-1 min-w-0
                ${viewMode === ViewMode.PREVIEW
                  ? 'text-white'
                  : 'bg-white hover:bg-gray-50'}`}
              style={{
                backgroundColor: viewMode === ViewMode.PREVIEW ? 'var(--sidebar-button-color)' : undefined,
                color: viewMode === ViewMode.PREVIEW ? '#ffffff' : 'var(--sidebar-text-muted)'
              }}
            >
              <span className="truncate">{getLabel('PAGE_PREVIEW')}</span>
              <EditTrigger
                labelKey="PAGE_PREVIEW"
                className={viewMode === ViewMode.PREVIEW ? "text-white/70 hover:text-white" : ""}
                color={viewMode === ViewMode.PREVIEW ? '#ffffff' : 'var(--icon-color)'}
              />
            </button>
            <button
              onClick={toggleViewMode}
              className={`flex-1 px-2 py-2 text-xs font-bold tracking-wide transition-colors flex items-center justify-center gap-1 min-w-0
                ${viewMode === ViewMode.EDIT
                  ? 'text-white'
                  : 'bg-white hover:bg-gray-50'}`}
              style={{
                backgroundColor: viewMode === ViewMode.EDIT ? 'var(--sidebar-button-color)' : undefined,
                color: viewMode === ViewMode.EDIT ? '#ffffff' : 'var(--sidebar-text-muted)'
              }}
            >
              <span className="truncate">{getLabel('EDIT_MODE')}</span>
              <EditTrigger
                labelKey="EDIT_MODE"
                className={viewMode === ViewMode.EDIT ? "text-white/70 hover:text-white" : ""}
                color={viewMode === ViewMode.EDIT ? '#ffffff' : 'var(--icon-color)'}
              />
            </button>
          </div>
        </div>

        {/* 3. Page Info Section */}
        <div className="px-4 py-6 border-b border-[var(--sidebar-border-color)]">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 opacity-80" style={{ color: 'var(--sidebar-text)' }}>
              {getLabel('SECTION_PAGE_INFO')} <EditTrigger labelKey="SECTION_PAGE_INFO" />
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => openModal(ModalType.VERSION_HISTORY)}
                className="p-1 hover:bg-gray-100 text-[var(--sidebar-text-muted)] transition-colors"
                title={getTranslation('TITLE_VERSION_HISTORY', currentLanguage)}
              >
                <History className="w-3 h-3" />
              </button>
              <button
                onClick={() => openModal(ModalType.PAGE_INFO)}
                className="p-1 hover:bg-gray-100 transition-colors"
                title={getTranslation('TITLE_EDIT_PAGE_INFO', currentLanguage)}
              >
                <Pencil className="w-3 h-3" style={{ color: 'var(--icon-color)' }} />
              </button>
            </div>
          </div>

          <div className="space-y-1.5 text-xs" style={{ color: 'var(--sidebar-text-muted)' }}>
            <p className="flex justify-between">
              <span className="font-semibold opacity-70 flex items-center gap-1">{getLabel('LABEL_TITLE')}: <EditTrigger labelKey="LABEL_TITLE" /></span>
              <span style={{ color: 'var(--sidebar-text)' }}>{getLocalizedText(activePage?.title || '', currentLanguage)}</span>
            </p>
            <p className="flex justify-between items-center">
              <span className="font-semibold opacity-70 flex items-center gap-1">{getLabel('LABEL_STATUS')}: <EditTrigger labelKey="LABEL_STATUS" /></span>
              <span className={`px-1.5 py-0.5 rounded-none text-[10px] font-bold ${activePage?.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {activePage?.status}
              </span>
            </p>
            <p className="flex justify-between">
              <span className="font-semibold opacity-70 flex items-center gap-1">{getLabel('LABEL_MODIFIED')}: <EditTrigger labelKey="LABEL_MODIFIED" /></span>
              <span>{new Date(activePage?.modifiedDate || '').toLocaleDateString()}</span>
            </p>
          </div>
        </div>

        {/* 4. Pages Accordion (Now Rendering Navigation Hierarchy) */}
        <SidebarAccordion
          icon={LayoutTemplate}
          label={getLabel('PAGES')}
          editLabelKey="PAGES"
          isOpen={isPagesOpen}
          onToggle={() => setIsPagesOpen(!isPagesOpen)}
        >
          <div className="space-y-0.5 mt-1 pb-2">
            {rootNavItems.length > 0 ? (
              rootNavItems.map(item => (
                <SidebarNavItem
                  key={item.id}
                  item={item}
                  level={0}
                  allItems={navItems}
                  currentPageId={currentPageId}
                  onSelect={setCurrentPage}
                  lastClickedId={lastClickedId}
                  setLastClickedId={setLastClickedId}
                />
              ))
            ) : (
              <div className="px-4 py-2 text-xs italic opacity-50">No published pages found in navigation.</div>
            )}
          </div>
        </SidebarAccordion>

        </>
        )}

      </div>}
    </div>
  );
};
