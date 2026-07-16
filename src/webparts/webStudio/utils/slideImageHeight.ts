export type SlideImageHeightMode = 'default' | 'full' | 'custom';

export interface SlideImageHeightSource {
    imageHeightMode?: SlideImageHeightMode | string;
    imageCustomHeight?: string;
}

export interface HeroHeightSource {
    heroHeightMode?: SlideImageHeightMode | string;
    heroCustomHeight?: string;
    /** @deprecated Use heroHeightMode */
    minHeight?: string;
    heroDefaultHeight?: string;
}

export interface SlideImageHeightContainerDefaults {
    slideDefaultHeight?: string;
    heroDefaultHeight?: string;
}

export interface SlideImageHeightSiteConfig {
    headerNavHeight?: string;
}

const DEFAULT_SLIDE_HEIGHT_PX = '480';

/** First hero on a page — mobile preview band (50% of viewport). */
export const MOBILE_MAIN_HERO_HEIGHT = '50vh';

export function isFullViewportHeightMode(
    mode: string | undefined,
    legacyMinHeight?: string
): boolean {
    return mode === 'full' || legacyMinHeight === 'full';
}

function normalizeCssHeight(raw: string, fallback: string): string {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return fallback;
    return /[a-z%]/i.test(trimmed) ? trimmed : `${trimmed}px`;
}

export function getSlideDefaultHeightLabel(
    containerSettings?: SlideImageHeightContainerDefaults
): string {
    const raw = String(
        containerSettings?.slideDefaultHeight ||
            containerSettings?.heroDefaultHeight ||
            DEFAULT_SLIDE_HEIGHT_PX
    ).trim();
    return /[a-z%]/i.test(raw) ? raw : `${raw}px`;
}

/** Resolve rendered height for a slider slide (preview + published). */
export function resolveSlideImageHeight(
    slide: SlideImageHeightSource | undefined,
    containerSettings?: SlideImageHeightContainerDefaults,
    siteConfig?: SlideImageHeightSiteConfig
): string {
    const mode = (slide?.imageHeightMode || 'default') as SlideImageHeightMode;
    const defaultHeight = normalizeCssHeight(
        String(
            containerSettings?.slideDefaultHeight ||
                containerSettings?.heroDefaultHeight ||
                DEFAULT_SLIDE_HEIGHT_PX
        ),
        `${DEFAULT_SLIDE_HEIGHT_PX}px`
    );

    if (mode === 'full') {
        const navHeightRaw = String(siteConfig?.headerNavHeight || '48').trim();
        const navHeight = navHeightRaw.endsWith('px') ? navHeightRaw : `${navHeightRaw}px`;
        return `calc(100vh - ${navHeight})`;
    }

    if (mode === 'custom') {
        return normalizeCssHeight(String(slide?.imageCustomHeight || ''), defaultHeight);
    }

    return defaultHeight;
}

/** Resolve rendered min-height for header/hero sections (preview + published). */
export function resolveHeroMinHeight(
    settings: HeroHeightSource | undefined,
    siteConfig?: SlideImageHeightSiteConfig
): string {
    const mode =
        settings?.heroHeightMode ||
        (settings?.minHeight === 'full' ? 'full' : 'default');
    const defaultHeight = normalizeCssHeight(
        String(settings?.heroDefaultHeight || '600'),
        '600px'
    );

    if (mode === 'full') {
        const navHeightRaw = String(siteConfig?.headerNavHeight || '48').trim();
        const navHeight = navHeightRaw.endsWith('px') ? navHeightRaw : `${navHeightRaw}px`;
        return `calc(100vh - ${navHeight})`;
    }

    if (mode === 'custom') {
        return normalizeCssHeight(String(settings?.heroCustomHeight || ''), defaultHeight);
    }

    return defaultHeight;
}
