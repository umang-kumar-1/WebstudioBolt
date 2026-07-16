import React, { useMemo } from 'react';
import { getItemTranslation, getLocalizedText } from '../../store';
import type { LanguageCode, NavItem, Page } from '../../types';
import { FaHome as FaHomeIcon } from 'react-icons/fa';
const FaHome = FaHomeIcon as any;

interface TopNavigationBreadcrumbProps {
  navigation: NavItem[];
  pages: Page[];
  currentPageId: string;
  currentLanguage: LanguageCode;
  onNavigate: (pageId: string) => void;
  /** Offset from viewport top when sticky (standalone below header). Ignored when embeddedInHeader. */
  stickyTop?: number;
  /** When true, breadcrumb scrolls with the sticky site header (no separate sticky layer). */
  embeddedInHeader?: boolean;
  breadcrumbHeight?: string;
  breadcrumbFontSize?: string;
}

const buildParentMap = (items: NavItem[]): Map<string, NavItem | null> => {
  const map = new Map<string, NavItem | null>();
  const visibleItems = items.filter(item => item.isVisible);
  const byId = new Map(visibleItems.map(item => [item.id, item]));

  visibleItems.forEach(item => {
    if (!item.parentId || item.parentId === 'root') {
      map.set(item.id, null);
      return;
    }
    map.set(item.id, byId.get(item.parentId) ?? null);
  });

  return map;
};

const buildItemChain = (item: NavItem, parentMap: Map<string, NavItem | null>): NavItem[] => {
  const chain: NavItem[] = [];
  let current: NavItem | null | undefined = item;
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    current = parentMap.get(current.id) ?? null;
  }

  return chain;
};

export const TopNavigationBreadcrumb: React.FC<TopNavigationBreadcrumbProps> = ({
  navigation,
  pages,
  currentPageId,
  currentLanguage,
  onNavigate,
  stickyTop = 0,
  embeddedInHeader = false,
  breadcrumbHeight = '30px',
  breadcrumbFontSize = '14px'
}) => {
  const homePage = pages.find(page => page.slug === '/') ?? pages[0];

  const breadcrumbItems = useMemo(() => {
    const pageItems = navigation
      .filter(item => item.isVisible && item.type === 'Page' && String(item.pageId) === String(currentPageId))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (pageItems.length === 0) return [];

    const parentMap = buildParentMap(navigation);
    const allChains = pageItems.map(item => buildItemChain(item, parentMap));

    // Prefer deeper hierarchy to preserve top-nav dropdown structure.
    allChains.sort((a, b) => b.length - a.length || (a[a.length - 1]?.order ?? 0) - (b[b.length - 1]?.order ?? 0));
    return allChains[0] ?? [];
  }, [navigation, currentPageId]);

  const activePage = pages.find(page => String(page.id) === String(currentPageId));
  const fallbackTitle = activePage ? getLocalizedText(activePage.title, currentLanguage) : '';
  const isHomeActive = homePage && String(homePage.id) === String(currentPageId);
  const breadcrumbTrail = breadcrumbItems.length > 0
    ? breadcrumbItems
    : (fallbackTitle ? [{ id: 'fallback-current', title: fallbackTitle, pageId: currentPageId } as any] : []);
  const breadcrumbSteps = !isHomeActive && homePage
    ? [{ id: 'home-step', pageId: homePage.id, title: getLocalizedText(homePage.title, currentLanguage) || 'Home' } as any, ...breadcrumbTrail]
    : breadcrumbTrail;

  if (breadcrumbSteps.length === 0 || isHomeActive) return null;

  return (
    <div
      className={`w-full border-b border-[#cfcfcf]${embeddedInHeader ? '' : ' sticky'}`}
      style={{
        backgroundColor: '#ffffff',
        ...(embeddedInHeader ? {} : { top: `${stickyTop}px`, zIndex: 31 }),
        '--ws-breadcrumb-height': breadcrumbHeight || '30px',
        '--ws-breadcrumb-font-size': breadcrumbFontSize || '14px'
      } as any}
    >
      <div className="ws-site-container py-1 ws-breadcrumb-scroll">
        <style>{`
          ul.ws-breadcrumb {
            padding-left: 0 !important;
            margin: 0 !important;
            list-style: none !important;
          }
          .ws-breadcrumb {
            display: inline-flex !important;
            flex-wrap: nowrap !important;
            align-items: stretch !important;
            list-style: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 4px;
            overflow: visible;
            gap: 0 !important;
          }
          .ws-breadcrumb li {
            position: relative;
            display: flex !important;
            align-items: center !important;
            list-style: none !important;
            flex-shrink: 0 !important;
            box-sizing: border-box !important;
            height: var(--ws-breadcrumb-height, 30px);
            background: #dedede;
            padding: 0 8px 0 14px !important;
            cursor: pointer;
            transition: background-color 0.2s ease, color 0.2s ease;
            margin: 0 6px 0 0 !important;
            font-size: var(--ws-breadcrumb-font-size, 14px);
            white-space: nowrap;
          }
          .ws-breadcrumb li:hover {
            background: var(--primary-color);
          }
          .ws-breadcrumb li:hover .ws-breadcrumb-label {
            color: #ffffff !important;
          }
          .ws-breadcrumb li:hover svg {
            color: #ffffff !important;
          }
          .ws-breadcrumb li::after {
            content: '';
            position: absolute;
            right: -6px;
            top: 0;
            width: 0;
            height: 0;
            border-top: calc(var(--ws-breadcrumb-height, 30px) / 2) solid transparent;
            border-bottom: calc(var(--ws-breadcrumb-height, 30px) / 2) solid transparent;
            border-left: 6px solid #dedede;
            z-index: 2;
          }
          .ws-breadcrumb li:hover::after {
            border-left-color: var(--primary-color);
          }
          .ws-breadcrumb li::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            width: 0;
            height: 0;
            border-top: calc(var(--ws-breadcrumb-height, 30px) / 2) solid transparent;
            border-bottom: calc(var(--ws-breadcrumb-height, 30px) / 2) solid transparent;
            border-left: 6px solid #ffffff;
            transform: translateX(-1px);
            z-index: 3;
          }
          .ws-breadcrumb li:first-child {
            padding-left: 6px !important;
            border-radius: 4px 0 0 4px;
            padding-right:4px !important;
          }
          .ws-breadcrumb li:first-child::before {
            content: none;
          }
          .ws-breadcrumb li:last-child {
            margin-right: 0 !important;
            border-radius: 0 4px 4px 0;
          }
          .ws-breadcrumb li:last-child::after {
            content: none;
          }
          .ws-breadcrumb-label {
            line-height: 1;
            white-space: nowrap;
          }
          .ws-breadcrumb-current .ws-breadcrumb-label {
            color: #111111 !important;
            font-weight: 600;
          }
          .ws-breadcrumb-link .ws-breadcrumb-label {
            color: var(--primary-color) !important;
            font-weight: 500;
          }
        `}</style>

        <ul className="ws-breadcrumb">
          {breadcrumbSteps.map((item) => {
            const label = item.id === 'home-step'
              ? (item.title || 'Home')
              : (item.id === 'fallback-current'
                ? fallbackTitle
                : getItemTranslation(item, currentLanguage, 'title'));
            const canNavigate = !!item.pageId && item.id !== 'fallback-current';
            const isCurrentPage = String(item.pageId) === String(currentPageId);

            const isHomeStep = item.id === 'home-step';
            return (
              <li
                key={item.id}
                className={isCurrentPage ? 'ws-breadcrumb-current' : 'ws-breadcrumb-link'}
                onClick={() => canNavigate && onNavigate(String(item.pageId))}
                style={{ cursor: canNavigate ? 'pointer' : 'default' }}
              >
                {isHomeStep ? (
                  <FaHome
                    size={16}
                    style={{ display: 'block', flexShrink: 0, color: 'var(--primary-color)' }}
                  />
                ) : (
                  <span className="ws-breadcrumb-label">{label}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
