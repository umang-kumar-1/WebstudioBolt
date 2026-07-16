import { SiteConfig, ThemeConfig } from '../types';

/** Legacy boxed width for saved sites that used Standard (Boxed) page width. */
export const LEGACY_BOXED_MAX_WIDTH = '1320px';

export type PageWidthMode = 'full' | 'custom';

/** Navigation modes that set `--nav-max-width`. Unset / `standard` = match global page width. */
export const isExplicitNavigationWidth = (
    mode: string | undefined
): mode is PageWidthMode => {
    const normalized = String(mode || '').toLowerCase();
    return normalized === 'full' || normalized === 'custom';
};

const normalizePageWidthMode = (
    mode: PageWidthMode | string | undefined
): PageWidthMode | 'standard' => {
    const normalized = String(mode || 'full').toLowerCase();
    if (normalized === 'full') return 'full';
    if (normalized === 'custom') return 'custom';
    if (normalized === 'standard') return 'standard';
    return 'full';
};

const normalizeCustomWidth = (value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed) return LEGACY_BOXED_MAX_WIDTH;
    if (/(px|rem|em|%|vw|ch)$/i.test(trimmed)) return trimmed;
    if (/^-?\d*\.?\d+$/.test(trimmed)) return `${trimmed}px`;
    return trimmed;
};

/** Resolves site Page Width setting to a CSS max-width value. */
export const resolvePageMaxWidth = (
    mode: PageWidthMode | string | undefined,
    customValue?: string
): string => {
    const normalized = normalizePageWidthMode(mode);
    if (normalized === 'full') return '100%';
    if (normalized === 'custom') return normalizeCustomWidth(customValue || '');
    return LEGACY_BOXED_MAX_WIDTH;
};

const isFullWidthMode = (mode: PageWidthMode | string | undefined): boolean =>
    normalizePageWidthMode(mode) === 'full';

const resolveLayoutWidthCssVars = (
    mode: PageWidthMode | string | undefined,
    customValue?: string
): { base?: string } => {
    if (isFullWidthMode(mode)) {
        return {};
    }
    if (normalizePageWidthMode(mode) === 'custom') {
        return { base: normalizeCustomWidth(customValue || '') };
    }
    return { base: LEGACY_BOXED_MAX_WIDTH };
};

/** Navigation bar width: "Full Page" = 100% of header area; unset = match page; custom = fixed override. */
const resolveNavigationWidthCssVars = (
    mode: PageWidthMode | string | undefined,
    customValue?: string
): { base?: string } => {
    if (isFullWidthMode(mode)) {
        return { base: '100%' };
    }
    if (normalizePageWidthMode(mode) === 'custom') {
        return { base: normalizeCustomWidth(customValue || '') };
    }
    if (normalizePageWidthMode(mode) === 'standard') {
        return { base: LEGACY_BOXED_MAX_WIDTH };
    }
    return {};
};

type LayoutWidthSiteConfig = Pick<
    SiteConfig,
    'headerWidth' | 'headerWidthCustom' | 'navigationWidth' | 'navigationWidthCustom'
>;

/**
 * Applies layout width CSS variables:
 * - Page (Theme Editor): full = Bootstrap container via `--ws-container-max`; custom = fixed width
 * - Navigation: unset = match page; full = 100% nav bar width; custom = fixed nav width (`--nav-max-width`)
 */
export const applySiteLayoutWidthToTheme = (
    siteConfig: LayoutWidthSiteConfig,
    theme: ThemeConfig
): ThemeConfig => {
    const pageWidth = resolveLayoutWidthCssVars(siteConfig.headerWidth, siteConfig.headerWidthCustom);
    const navWidth = isExplicitNavigationWidth(siteConfig.navigationWidth)
        ? resolveNavigationWidthCssVars(siteConfig.navigationWidth, siteConfig.navigationWidthCustom)
        : {};

    const next: ThemeConfig = { ...theme };

    if (pageWidth.base) {
        next['--page-max-width'] = pageWidth.base;
    } else {
        delete next['--page-max-width'];
    }
    delete next['--page-max-width-lg'];

    if (navWidth.base) {
        next['--nav-max-width'] = navWidth.base;
    } else {
        delete next['--nav-max-width'];
    }
    delete next['--nav-max-width-lg'];

    // Legacy theme keys — navigation width must not leak into page/slider via --header-max-width
    delete next['--header-max-width'];
    delete next['--header-max-width-lg'];

    return next;
};

/** CSS variables synced to the document / preview root for layout width. */
export const LAYOUT_WIDTH_CSS_VARS = [
    '--page-max-width',
    '--page-max-width-lg',
    '--nav-max-width',
    '--nav-max-width-lg',
    '--header-max-width',
    '--header-max-width-lg',
] as const;

/** Remove layout width vars before spreading theme onto preview roots (width comes from CSS + :root sync). */
export const omitLayoutWidthThemeVars = <T extends ThemeConfig>(theme: T): T => {
    const next = { ...theme };
    LAYOUT_WIDTH_CSS_VARS.forEach((key) => {
        delete next[key];
    });
    return next;
};

/** Normalize legacy / alternate SITE_CONFIG keys before applying layout width. */
export const normalizeSiteLayoutConfig = <T extends LayoutWidthSiteConfig>(siteConfig: T): T => {
    const next = { ...siteConfig } as T & { pageWidth?: string };
    const legacyPageWidth = next.pageWidth;
    if (!next.headerWidth && legacyPageWidth) {
        next.headerWidth = legacyPageWidth as T['headerWidth'];
    }

    const mode = String(next.headerWidth || 'full').toLowerCase();
    if (mode === 'standard') {
        next.headerWidth = 'custom' as T['headerWidth'];
        if (!next.headerWidthCustom) {
            next.headerWidthCustom = LEGACY_BOXED_MAX_WIDTH;
        }
    }

    if (!isExplicitNavigationWidth(next.navigationWidth)) {
        next.navigationWidth = undefined;
        next.navigationWidthCustom = '';
    }

    return next;
};

/** Apply layout width vars to a DOM node and clear stale values when unused. */
export const syncLayoutWidthCssVars = (
    root: HTMLElement,
    siteConfig: LayoutWidthSiteConfig,
    theme: ThemeConfig
): ThemeConfig => {
    const merged = applySiteLayoutWidthToTheme(normalizeSiteLayoutConfig(siteConfig), theme);

    LAYOUT_WIDTH_CSS_VARS.forEach((key) => {
        const value = merged[key];
        if (value) {
            root.style.setProperty(key, value);
        } else {
            root.style.removeProperty(key);
        }
    });

    return merged;
};

/** @deprecated Use applySiteLayoutWidthToTheme — kept for Theme Editor imports. */
export const applyPageWidthToTheme = applySiteLayoutWidthToTheme;

/** @deprecated Use LEGACY_BOXED_MAX_WIDTH */
export const STANDARD_BOXED_MAX_WIDTH = LEGACY_BOXED_MAX_WIDTH;
