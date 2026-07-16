import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { PreviewArea } from './PreviewArea';
import { ModalManager } from './Modals';
import { useStore } from '../store';
import { useSPContext } from '../contexts/SPServiceContext';
import { useMobileViewport } from '../hooks/useMobileViewport';
import { canAccessWebStudioEditor } from '../utils/templatePermissions';
import { Menu, X } from 'lucide-react';
import {
  CUSTOM_FONT_STYLESHEETS,
  extractPrimaryFontName,
  GOOGLE_FONT_STYLESHEETS,
} from '../utils/fontCatalog';
import { LAYOUT_WIDTH_CSS_VARS, normalizeSiteLayoutConfig, syncLayoutWidthCssVars } from '../utils/pageWidth';
import { parsePreviewHashRoute } from '../utils/previewNavigation';

// Hook to sync zustand state to CSS Variables on :root
const useThemeSync = () => {
  const themeConfig = useStore((state) => state.themeConfig);
  const siteConfig = useStore((state) => state.siteConfig);

  useEffect(() => {
    const root = document.documentElement;
    const normalizedSiteConfig = normalizeSiteLayoutConfig(siteConfig);
    const mergedTheme = syncLayoutWidthCssVars(root, normalizedSiteConfig, themeConfig);

    Object.entries(mergedTheme).forEach(([key, value]) => {
      if (LAYOUT_WIDTH_CSS_VARS.includes(key as (typeof LAYOUT_WIDTH_CSS_VARS)[number])) {
        return;
      }
      root.style.setProperty(key, value as string);
    });

    // 2. Auto-load known font stylesheets for selected font families.
    const selectedFontNames = [
      extractPrimaryFontName(themeConfig['--font-family-base']),
      extractPrimaryFontName(themeConfig['--font-family-secondary']),
      extractPrimaryFontName(themeConfig['--font-family-nav']),
      extractPrimaryFontName(siteConfig.headerMenuFontFamily),
      extractPrimaryFontName(siteConfig.headerSubmenuFontFamily),
    ].filter(Boolean);

    const selectedGoogleHrefs = Array.from(
      new Set(
        selectedFontNames
          .map((name) => GOOGLE_FONT_STYLESHEETS[name])
          .filter(Boolean)
      )
    );

    const requiredHrefs = [...CUSTOM_FONT_STYLESHEETS, ...selectedGoogleHrefs];
    const requiredIds = requiredHrefs.map((_, index) => `dynamic-font-import-${index + 1}`);

    const applyFontLink = (id: string, href: string): void => {
      const existingLink = document.getElementById(id) as HTMLLinkElement | null;
      if (!existingLink) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      } else if (existingLink.href !== href) {
        existingLink.href = href;
      }
    };

    requiredHrefs.forEach((href, index) => applyFontLink(requiredIds[index], href));

    // Remove stale font links from old selections/legacy config.
    Array.from(document.querySelectorAll('link[id^="dynamic-font-import-"]')).forEach((node) => {
      if (!requiredIds.includes(node.id)) {
        node.remove();
      }
    });
    const legacyLink = document.getElementById('dynamic-font-import');
    if (legacyLink) legacyLink.remove();

  }, [
    themeConfig,
    siteConfig?.headerWidth,
    siteConfig?.headerWidthCustom,
    siteConfig?.navigationWidth,
    siteConfig?.navigationWidthCustom,
    siteConfig,
  ]);
};

const App: React.FC = () => {
  // Initialize Global Styles
  useThemeSync();

  const isMobileViewport = useMobileViewport();
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);

  useEffect(() => {
    if (!isMobileViewport) {
      setMobileEditorOpen(false);
    }
  }, [isMobileViewport]);

  // Get SharePoint context
  const { isInitialized } = useSPContext();

  // Load SharePoint data on mount (only after initialization)
  const loadFromSharePoint = useStore((state) => state.loadFromSharePoint);
  const isLoading = useStore((state) => state.isLoading);
  const pages = useStore((state) => state.pages);
  const navigation = useStore((state) => state.siteConfig.navigation);
  const setCurrentPage = useStore((state) => state.setCurrentPage);
  const themeConfig = useStore((state) => state.themeConfig);
  const webStudioUserRole = useStore((state) => state.webStudioUserRole);
  const canUseEditor = canAccessWebStudioEditor(webStudioUserRole);

  useEffect(() => {
    if (!canUseEditor) {
      setMobileEditorOpen(false);
    }
  }, [canUseEditor]);

  useEffect(() => {
    // Only load data after SharePoint is initialized
    if (isInitialized) {
      console.log('📊 SharePoint initialized, loading data...');
      loadFromSharePoint();
    }
  }, [isInitialized, loadFromSharePoint]);

  // Routing Logic: Listen for Hash Changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const { pageId, sectionAnchor } = parsePreviewHashRoute(hash, pages, navigation);
      const currentPageId = useStore.getState().currentPageId;
      if (pageId && pageId !== currentPageId) {
        setCurrentPage(pageId);
        if (!sectionAnchor) {
          setTimeout(() => {
            const scrollContainer = document.getElementById('preview-main-scroll');
            if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
          }, 50);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);

    // Initial check when pages are loaded
    if (pages.length > 0 && !useStore.getState().currentPageId) {
      handleHashChange();
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [pages, navigation, setCurrentPage]);

  return (
    <div className={`ws-editor-shell flex h-screen w-full max-w-full bg-gray-100 font-sans text-gray-900 overflow-hidden${canUseEditor ? '' : ' ws-editor-shell--preview-only'}`}>
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white p-8 rounded-lg shadow-2xl flex flex-col items-center gap-4 min-w-[300px]">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-[var(--primary-color)] border-t-transparent"></div>
            <div className="text-center">
              <p className="text-gray-800 font-bold text-lg mb-1">Loading Data...</p>
              <p className="text-gray-500 text-sm">
                Loading pages, navigation and settings...
              </p>
            </div>
          </div>
        </div>
      )}

      {canUseEditor && isMobileViewport && mobileEditorOpen && (
        <button
          type="button"
          className="ws-editor-sidebar-backdrop"
          aria-label="Close editor menu"
          onClick={() => setMobileEditorOpen(false)}
        />
      )}

      {/* Left Sidebar — editors only (Site Admin / Super Admin) */}
      {canUseEditor && (
      <Sidebar
        mobileOverlay={isMobileViewport}
        mobileOpen={mobileEditorOpen}
        onMobileClose={() => setMobileEditorOpen(false)}
      />
      )}

      {/* Main Content Area (Preview) */}
      <main className="ws-editor-preview flex-1 flex flex-col h-full min-w-0 relative" style={{ backgroundColor: themeConfig['--bg-body'] }}>
        {canUseEditor && isMobileViewport && (
          <div className="ws-editor-mobile-bar flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white shrink-0">
            <button
              type="button"
              className="ws-editor-mobile-menu-btn inline-flex items-center justify-center w-10 h-10 rounded-sm border border-gray-200 text-gray-700 hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] transition-colors"
              aria-label={mobileEditorOpen ? 'Close editor menu' : 'Open editor menu'}
              aria-expanded={mobileEditorOpen}
              onClick={() => setMobileEditorOpen((open) => !open)}
            >
              {mobileEditorOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-600 truncate">
              Web Studio
            </span>
          </div>
        )}
        <PreviewArea />
      </main>

      {/* Global Modals — editors only */}
      {canUseEditor && <ModalManager />}
    </div>
  );
};

export default App;