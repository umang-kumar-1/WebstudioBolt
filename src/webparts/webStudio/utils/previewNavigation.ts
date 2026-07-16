import type { NavItem, Page } from '../types';
import { findPageByNavRouteSlug, findPageByRouteSlug as findPageByHierarchySlug } from './pageHierarchy';

const isHomeSlug = (slug: string): boolean =>
  !slug || slug === '/' || slug === '/home';

/** Hash fragment for preview routing (slug `/` → `#/home`). */
export const slugToPreviewHash = (slug: string): string => {
  if (isHomeSlug(slug)) return '#/home';
  return slug.startsWith('/') ? `#${slug}` : `#/${slug}`;
};

/** Page-only hash route, e.g. `#/home` or `#/about`. */
export function buildPreviewPageHash(pageSlug: string): string {
  return slugToPreviewHash(pageSlug);
}

/** Section deep link: `#/home#how-we-work` or `#/careers#meet-our-team`. */
export function buildPreviewSectionHash(pageSlug: string, anchor?: string): string {
  const section = (anchor || '').trim();
  if (!section) {
    return buildPreviewPageHash(pageSlug);
  }
  return `${buildPreviewPageHash(pageSlug)}#${encodeURIComponent(section)}`;
}

/** Page hash without nested section (#/home from #/home#how-we-work). */
export function getPreviewPageHashBase(hashValue: string): string {
  if (!hashValue) return '';
  const withoutQuery = hashValue.split('?')[0];
  const nestedIdx = withoutQuery.indexOf('#', 1);
  return nestedIdx > 0 ? withoutQuery.slice(0, nestedIdx) : withoutQuery;
}

export function findPageByRouteSlug(
  pages: Page[],
  slug: string,
  navigation?: NavItem[]
): Page | undefined {
  const normalized = slug.startsWith('/') ? slug : `/${slug || ''}`;
  if (navigation?.length) {
    const navMatch = findPageByNavRouteSlug(navigation, pages, normalized);
    if (navMatch) return navMatch;
  }
  return findPageByHierarchySlug(pages, normalized);
}

/** Section anchor from hash (supports `#/page#section`, legacy `#/?section`, bare `#section`). */
export function getPreviewSectionAnchorFromHash(hashValue: string): string {
  if (!hashValue || hashValue.length <= 1) return '';

  const nestedHashIdx = hashValue.indexOf('#', 1);
  if (nestedHashIdx > 0) {
    return decodeURIComponent(hashValue.slice(nestedHashIdx + 1).split('&')[0]);
  }

  const content = hashValue.slice(1);

  if (content.includes('?')) {
    const queryPart = content.split('?')[1];
    return queryPart ? decodeURIComponent(queryPart.split('&')[0]) : '';
  }

  if (content.startsWith('/') || content === '') {
    return '';
  }

  return decodeURIComponent(content.split('&')[0]);
}

export function hasPreviewSectionInHash(hashValue: string): boolean {
  return !!getPreviewSectionAnchorFromHash(hashValue);
}

export function isPageOnlyPreviewHash(hashValue: string): boolean {
  return !hasPreviewSectionInHash(hashValue);
}

export function parsePreviewHashRoute(
  hashValue: string,
  pages: Page[],
  navigation?: NavItem[]
): { pageId: string | null; sectionAnchor: string; isNotFound: boolean } {
  const sectionAnchor = getPreviewSectionAnchorFromHash(hashValue);

  if (!hashValue) {
    return { pageId: null, sectionAnchor: '', isNotFound: false };
  }

  const cleanHash = getPreviewPageHashBase(hashValue);
  if (cleanHash === '#/home' || cleanHash === '#/' || cleanHash === '#') {
    const homePage = pages.find((p) => p.slug === '/');
    return { pageId: homePage?.id ?? null, sectionAnchor, isNotFound: false };
  }

  if (cleanHash.startsWith('#/')) {
    const slug = cleanHash.slice(1);
    const target = findPageByRouteSlug(pages, slug, navigation);
    return {
      pageId: target?.id ?? null,
      sectionAnchor,
      isNotFound: !target && !sectionAnchor,
    };
  }

  if (sectionAnchor) {
    for (const p of pages) {
      const hasContainer = p.containers.some((c) => {
        const title = c.title || '';
        const slug = title
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '')
          .replace(/-+/g, '-');
        return slug === sectionAnchor || `container-${c.id}` === sectionAnchor;
      });
      if (hasContainer) {
        return { pageId: p.id, sectionAnchor, isNotFound: false };
      }
    }
    return { pageId: null, sectionAnchor, isNotFound: true };
  }

  return { pageId: null, sectionAnchor: '', isNotFound: false };
}

/** Migrate legacy hashes to `#/page#section` format. */
export function migrateLegacyPreviewSectionHash(
  hashValue: string,
  pages?: Page[]
): string | null {
  if (!hashValue) return null;

  const pageBase = getPreviewPageHashBase(hashValue);
  const anchor = getPreviewSectionAnchorFromHash(hashValue);

  if ((pageBase === '#/' || pageBase === '#') && !anchor) {
    return '#/home';
  }

  if (!anchor) return null;

  const hasCompoundSection = hashValue.indexOf('#', 1) > 0;
  if (hasCompoundSection && pageBase === '#/home') {
    return null;
  }

  if (hasCompoundSection && (pageBase === '#/' || pageBase === '#')) {
    return `#/home#${encodeURIComponent(anchor)}`;
  }

  if (hashValue.includes('?') || !hasCompoundSection) {
    let pageSlug = '/';
    if (
      pageBase.startsWith('#/') &&
      pageBase !== '#/' &&
      pageBase !== '#/home'
    ) {
      pageSlug = pageBase.slice(1);
    } else if (pages) {
      const { pageId } = parsePreviewHashRoute(hashValue, pages);
      const page = pages.find((p) => p.id === pageId);
      if (page) pageSlug = page.slug || '/';
    }
    return buildPreviewSectionHash(pageSlug, anchor);
  }

  return null;
}

export function getPreviewScrollRoot(): HTMLElement | null {
  return document.getElementById('preview-main-scroll');
}

export function freezePreviewScrollAtTop(): void {
  const scrollRoot = getPreviewScrollRoot();
  if (scrollRoot) {
    scrollRoot.scrollTop = 0;
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export function scrollPreviewSectionIntoView(
  el: HTMLElement,
  scrollBehavior: ScrollBehavior = 'auto'
): void {
  const scrollRoot = getPreviewScrollRoot();
  if (!scrollRoot) {
    el.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
    return;
  }

  const rootRect = scrollRoot.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const nextTop = Math.max(0, scrollRoot.scrollTop + (elRect.top - rootRect.top));

  if (scrollBehavior === 'auto') {
    scrollRoot.scrollTop = nextTop;
  } else {
    scrollRoot.scrollTo({ top: nextTop, behavior: scrollBehavior });
  }
}

export function findPreviewSectionElement(anchor: string): HTMLElement | null {
  const normalized = decodeURIComponent(anchor || '').trim();
  if (!normalized) return null;

  const containerById = document.querySelector(
    `[data-container-id][id="${normalized}"]`
  ) as HTMLElement | null;
  const allContainers = Array.from(
    document.querySelectorAll('[data-container-id]')
  ) as HTMLElement[];
  const containerByTitle =
    allContainers.find(
      (el) =>
        String(el.getAttribute('data-container-title') || '')
          .toLowerCase()
          .trim() === normalized.toLowerCase()
    ) || null;

  let el: HTMLElement | null =
    containerById ||
    containerByTitle ||
    document.getElementById(normalized) ||
    document.getElementById(`container-${normalized}`);

  if (!el) {
    el = document.querySelector(
      `[data-container-id="${normalized}"]`
    ) as HTMLElement | null;
  }
  if (!el && normalized.startsWith('container-')) {
    const rawId = normalized.replace(/^container-/, '');
    el =
      (document.querySelector(
        `[data-container-id="${rawId}"]`
      ) as HTMLElement | null) || document.getElementById(rawId);
  }
  if (!el && !normalized.startsWith('container-')) {
    el = document.querySelector(
      `[data-container-id="container-${normalized}"]`
    ) as HTMLElement | null;
  }
  return el;
}

export function scrollToPreviewSectionWithRetry(
  anchor: string,
  options?: {
    maxAttempts?: number;
    intervalMs?: number;
    initialDelayMs?: number;
    scrollBehavior?: ScrollBehavior;
  }
): void {
  const maxAttempts = options?.maxAttempts ?? 35;
  const intervalMs = options?.intervalMs ?? 100;
  const initialDelayMs = options?.initialDelayMs ?? 50;
  const scrollBehavior = options?.scrollBehavior ?? 'auto';

  let attempts = 0;
  const tryScroll = (): void => {
    const el = findPreviewSectionElement(anchor);
    if (el) {
      scrollPreviewSectionIntoView(el, scrollBehavior);
      return;
    }
    if (attempts < maxAttempts) {
      attempts += 1;
      setTimeout(tryScroll, intervalMs);
    }
  };
  setTimeout(tryScroll, initialDelayMs);
}

export interface NavigatePreviewToSectionOptions {
  pageId: string;
  anchor: string;
  currentPageId: string;
  pages: Page[];
  setCurrentPage: (id: string) => void;
  setIsPageNotFound?: (value: boolean) => void;
}

/** Instant container navigation (top nav + action buttons). */
export function navigatePreviewToSection(opts: NavigatePreviewToSectionOptions): void {
  const { pageId, anchor, currentPageId, pages, setCurrentPage, setIsPageNotFound } = opts;
  const targetPage = pages.find((p) => String(p.id) === String(pageId));
  if (!targetPage) return;

  const normalizedAnchor = decodeURIComponent(anchor || '').trim();
  if (!normalizedAnchor) return;

  const isCrossPage = String(pageId) !== String(currentPageId);
  const sectionHash = buildPreviewSectionHash(targetPage.slug, normalizedAnchor);
  const base = window.location.href.split('#')[0];
  const nextUrl = `${base}${sectionHash}`;

  if (isCrossPage) {
    freezePreviewScrollAtTop();
    setIsPageNotFound?.(false);
  }

  if (window.location.href !== nextUrl) {
    window.history.pushState({ pageId }, '', nextUrl);
  }

  if (isCrossPage) {
    setCurrentPage(pageId);
    scrollToPreviewSectionWithRetry(normalizedAnchor, {
      initialDelayMs: 80,
      maxAttempts: 40,
      scrollBehavior: 'auto',
    });
  } else {
    const snapSamePage = (): void => {
      const el = findPreviewSectionElement(normalizedAnchor);
      if (el) {
        scrollPreviewSectionIntoView(el, 'auto');
        return;
      }
      scrollToPreviewSectionWithRetry(normalizedAnchor, {
        initialDelayMs: 0,
        maxAttempts: 40,
        scrollBehavior: 'auto',
      });
    };
    requestAnimationFrame(snapSamePage);
  }
}

export function buildSmartPagePreviewUrl(slug: string): string {
  const hash = slugToPreviewHash(slug);
  if (typeof window === 'undefined') return hash || '#/home';
  const base = window.location.href.split('#')[0];
  return `${base}${hash}`;
}

export function navigatePreviewToPage(
  pageId: string,
  pages: Page[],
  setCurrentPage: (id: string) => void,
  routeSlug?: string
): boolean {
  const target = pages.find(p => p.id === pageId);
  if (!target) return false;

  const hash = slugToPreviewHash(routeSlug || target.slug);
  const base = window.location.href.split('#')[0];
  window.history.pushState({ pageId }, '', `${base}${hash}`);

  const scrollPreviewToTop = (): void => {
    const scrollContainer = document.getElementById('preview-main-scroll');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  scrollPreviewToTop();
  setCurrentPage(pageId);
  requestAnimationFrame(scrollPreviewToTop);
  setTimeout(scrollPreviewToTop, 0);
  setTimeout(scrollPreviewToTop, 50);
  setTimeout(scrollPreviewToTop, 150);
  return true;
}
