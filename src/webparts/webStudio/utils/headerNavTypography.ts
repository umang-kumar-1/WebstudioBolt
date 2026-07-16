import type { SiteConfig } from '../types';

type ThemeConfigLike = Record<string, string | undefined>;

const hasValue = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

/** Font weight for top navigation menu links. */
export function resolveHeaderMenuFontWeight(siteConfig: Partial<SiteConfig> | undefined): string {
    if (hasValue(siteConfig?.headerMenuFontWeight)) {
        return siteConfig.headerMenuFontWeight.trim();
    }
    if (hasValue(siteConfig?.headerNavFontWeight)) {
        return siteConfig.headerNavFontWeight.trim();
    }
    return '600';
}

/** Font weight for header logo text beside the logo image. */
export function resolveHeaderLogoFontWeight(siteConfig: Partial<SiteConfig> | undefined): string {
    if (hasValue(siteConfig?.headerNavFontWeight)) {
        return siteConfig.headerNavFontWeight.trim();
    }
    return '600';
}

/** Font family for top navigation menu links. */
export function resolveHeaderMenuFontFamily(
    siteConfig: Partial<SiteConfig> | undefined,
    themeConfig?: ThemeConfigLike
): string {
    if (hasValue(siteConfig?.headerMenuFontFamily)) {
        return siteConfig.headerMenuFontFamily.trim();
    }
    if (hasValue(themeConfig?.['--font-family-nav'])) {
        return themeConfig['--font-family-nav']!.trim();
    }
    return 'var(--font-family-nav, var(--font-family-base, sans-serif))';
}
