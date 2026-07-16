import type { NavItem, Page } from '../types';

export const slugifyTitle = (title: string): string =>
  title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const isHomePageSlug = (slug: string): boolean =>
  !slug || slug === '/' || slug === '/home';

/** Route slug used in preview hashes (home → /home). */
export const getPageRouteSlug = (page: Page): string => {
  if (page.isHomePage || isHomePageSlug(page.slug)) return '/home';
  const normalized = page.slug?.startsWith('/') ? page.slug : `/${page.slug || ''}`;
  return normalized || '/home';
};

/** Build nested slug from parent page and title segment. */
export const buildNestedPageSlug = (parentPage: Page | undefined, title: string): string => {
  const segment = slugifyTitle(title);
  if (!segment) return '/';
  if (!parentPage || isHomePageSlug(parentPage.slug)) {
    return `/home/${segment}`;
  }
  const parentRoute = getPageRouteSlug(parentPage);
  return `${parentRoute}/${segment}`;
};

export const findPageById = (pages: Page[], pageId: string): Page | undefined =>
  pages.find((p) => String(p.id) === String(pageId));

export const findPageByRouteSlug = (pages: Page[], slug: string): Page | undefined => {
  const normalized = slug.startsWith('/') ? slug : `/${slug || ''}`;
  if (normalized === '/home' || normalized === '/') {
    return pages.find((p) => p.isHomePage || isHomePageSlug(p.slug));
  }
  const exact = pages.find((p) => {
    const route = getPageRouteSlug(p);
    return route === normalized || p.slug === normalized;
  });
  if (exact) return exact;
  return pages.find((p) => p.slug === normalized);
};

export const getPageBreadcrumbPath = (pages: Page[], pageId: string): Page[] => {
  const path: Page[] = [];
  let current = findPageById(pages, pageId);
  let guard = 0;
  while (current && guard < 20) {
    path.unshift(current);
    if (!current.parentPageId) break;
    current = findPageById(pages, current.parentPageId);
    guard += 1;
  }
  return path;
};

export const findNavItemForPage = (navigation: NavItem[], pageId: string): NavItem | undefined =>
  navigation.find((n) => n.type === 'Page' && String(n.pageId) === String(pageId));

/** Full navigation chain from root to a nav item (for nested URL building). */
export const getNavItemChain = (navigation: NavItem[], navId: string): NavItem[] => {
  const chain: NavItem[] = [];
  let current = navigation.find((n) => n.id === navId);
  let guard = 0;
  while (current && guard < 30) {
    chain.unshift(current);
    if (!current.parentId || current.parentId === 'root') break;
    current = navigation.find((n) => n.id === current!.parentId);
    guard += 1;
  }
  return chain;
};

const getNavSegment = (nav: NavItem, pages: Page[]): string => {
  if (nav.type !== 'Page') return '';

  if (nav.pageId) {
    const page = findPageById(pages, nav.pageId);
    if (page?.slug && !isHomePageSlug(page.slug)) {
      const parts = page.slug.replace(/^\//, '').split('/').filter(Boolean);
      const lastPart = parts[parts.length - 1];
      if (lastPart) return lastPart;
    }
    const titleSource = page?.title?.en || nav.title || '';
    return slugifyTitle(titleSource);
  }

  return slugifyTitle(nav.title);
};

/**
 * Nested preview route for a nav item, e.g. /home/what-we-offer/web-design.
 */
export const getNavItemRouteSlug = (
  navigation: NavItem[],
  pages: Page[],
  navItemId: string
): string => {
  const chain = getNavItemChain(navigation, navItemId);
  const segments: string[] = [];

  for (const nav of chain) {
    const seg = getNavSegment(nav, pages);
    if (seg && seg !== 'home') {
      segments.push(seg);
    }
  }

  if (segments.length === 0) return '/home';
  return `/home/${segments.join('/')}`;
};

/**
 * Build nested URL from navigation hierarchy for a new child title.
 */
export const buildSlugFromNavChain = (
  navigation: NavItem[],
  pages: Page[],
  parentNavId: string,
  title: string
): string => {
  const chain = getNavItemChain(navigation, parentNavId);
  const segments: string[] = [];

  for (const nav of chain) {
    const seg = getNavSegment(nav, pages);
    if (seg && seg !== 'home') {
      segments.push(seg);
    }
  }

  const childSeg = slugifyTitle(title);
  if (childSeg) segments.push(childSeg);

  if (segments.length === 0) return '/home';
  return `/home/${segments.join('/')}`;
};

/** Resolve page by route slug — direct page slug first, then nav hierarchy. */
export const findPageByNavRouteSlug = (
  navigation: NavItem[],
  pages: Page[],
  routeSlug: string
): Page | undefined => {
  const normalized = routeSlug.startsWith('/') ? routeSlug : `/${routeSlug || ''}`;
  const direct = findPageByRouteSlug(pages, normalized);
  if (direct) return direct;

  for (const nav of navigation) {
    if (nav.type !== 'Page' || !nav.pageId) continue;
    const navRoute = getNavItemRouteSlug(navigation, pages, nav.id);
    if (navRoute === normalized) {
      return findPageById(pages, nav.pageId);
    }
  }

  return undefined;
};

export const resolveParentPageIdForNavItem = (
  navigation: NavItem[],
  pages: Page[],
  navId: string
): string | undefined => {
  const navItem = navigation.find((n) => n.id === navId);
  if (navItem?.pageId) return navItem.pageId;

  const chain = getNavItemChain(navigation, navId);
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const item = chain[i];
    if (item.pageId) return item.pageId;
  }
  return undefined;
};

export const resolveParentPageForNavItem = (
  navigation: NavItem[],
  pages: Page[],
  navId: string
): Page | undefined => {
  const parentPageId = resolveParentPageIdForNavItem(navigation, pages, navId);
  if (!parentPageId) return undefined;
  return findPageById(pages, parentPageId);
};

/** Indent nav items for hierarchical dropdown — all items except external links. */
export const buildNavTreeOptions = (
  navigation: NavItem[],
  parentId = 'root',
  depth = 0
): { id: string; label: string; depth: number; pageId?: string }[] => {
  const items = navigation
    .filter((n) => n.parentId === parentId && n.type !== 'External')
    .sort((a, b) => a.order - b.order);

  return items.flatMap((item) => [
    { id: item.id, label: item.title, depth, pageId: item.pageId },
    ...buildNavTreeOptions(navigation, item.id, depth + 1),
  ]);
};

/** Pages in tree order using parentPageId hierarchy. */
export const buildPageTreeOptions = (
  pages: Page[],
  parentPageId?: string,
  depth = 0
): { id: string; label: string; depth: number; page: Page }[] => {
  const children = pages
    .filter((p) => (parentPageId ? p.parentPageId === parentPageId : !p.parentPageId))
    .sort((a, b) => (a.title.en || '').localeCompare(b.title.en || ''));

  return children.flatMap((page) => [
    { id: page.id, label: page.title.en || page.slug, depth, page },
    ...buildPageTreeOptions(pages, page.id, depth + 1),
  ]);
};
