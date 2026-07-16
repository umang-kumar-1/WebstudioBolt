import { CSSProperties } from 'react';

export const DEFAULT_SECTION_SPACING_PX = 30;

export type SectionSpacingSettings = {
    spacingTop?: number | string | null;
    spacingBottom?: number | string | null;
};

export const normalizeSpacingPx = (value: unknown): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num) || num < 0) return undefined;
    return num;
};

export const defaultSectionSpacingSettings = (): Pick<SectionSpacingSettings, 'spacingTop' | 'spacingBottom'> => ({
    spacingTop: DEFAULT_SECTION_SPACING_PX,
    spacingBottom: DEFAULT_SECTION_SPACING_PX,
});

export const hasCustomSectionSpacing = (settings?: SectionSpacingSettings | null): boolean =>
    normalizeSpacingPx(settings?.spacingTop) !== undefined
    || normalizeSpacingPx(settings?.spacingBottom) !== undefined;

export const sectionSpacingClassName = (settings?: SectionSpacingSettings | null): string => {
    const classes: string[] = [];
    if (normalizeSpacingPx(settings?.spacingTop) !== undefined) classes.push('ws-has-spacing-top');
    if (normalizeSpacingPx(settings?.spacingBottom) !== undefined) classes.push('ws-has-spacing-bottom');
    if (classes.length > 0) classes.unshift('ws-custom-section-spacing');
    return classes.join(' ');
};

export const resolveSectionSpacingPadding = (
    settings?: SectionSpacingSettings | null,
    defaults?: { top?: string; bottom?: string }
): CSSProperties => {
    const top = normalizeSpacingPx(settings?.spacingTop);
    const bottom = normalizeSpacingPx(settings?.spacingBottom);
    const style: CSSProperties & Record<string, string | undefined> = {};

    if (top !== undefined) {
        style['--ws-section-spacing-top'] = `${top}px`;
        style.paddingTop = `${top}px`;
    } else if (defaults?.top) {
        style.paddingTop = defaults.top;
    }

    if (bottom !== undefined) {
        style['--ws-section-spacing-bottom'] = `${bottom}px`;
        style.paddingBottom = `${bottom}px`;
    } else if (defaults?.bottom) {
        style.paddingBottom = defaults.bottom;
    }

    return style;
};

/** Hero/header containers show 64px section spacing by default in the editor UI. */
export const withDefaultHeroSectionSpacing = (
    settings?: SectionSpacingSettings | null
): SectionSpacingSettings => (
    hasCustomSectionSpacing(settings)
        ? {
            spacingTop: settings?.spacingTop,
            spacingBottom: settings?.spacingBottom,
        }
        : defaultSectionSpacingSettings()
);
