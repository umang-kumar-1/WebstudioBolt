/** Shared hero/header typography color keys and resolution (editor + live preview). */
import type { CSSProperties } from 'react';

export type HeroColorPreset = 'site' | 'black' | 'white' | 'custom';

export const HERO_COLOR_PRESET_OPTIONS: HeroColorPreset[] = ['site', 'black', 'white', 'custom'];

/** Description color presets (includes theme body / secondary text). */
export type HeroDescriptionColorPreset =
    | 'site'
    | 'bodyText'
    | 'editorText'
    | 'secondaryText'
    | 'black'
    | 'white'
    | 'custom';

export const HERO_DESCRIPTION_COLOR_OPTIONS: ReadonlyArray<{
    value: HeroDescriptionColorPreset;
    labelKey: string;
}> = [
    { value: 'site', labelKey: 'LABEL_SITE_COLOR' },
    { value: 'bodyText', labelKey: 'LABEL_BODY_TEXT_COLOR' },
    { value: 'editorText', labelKey: 'LABEL_EDITOR_TEXT_COLOR' },
    { value: 'secondaryText', labelKey: 'LABEL_SECONDARY_TEXT_COLOR' },
    { value: 'black', labelKey: 'LABEL_BLACK' },
    { value: 'white', labelKey: 'LABEL_WHITE' },
    { value: 'custom', labelKey: 'LABEL_CUSTOM_COLOR' },
];

export const HERO_TITLE_CUSTOM_DEFAULT = '#333333';
export const HERO_SUBTITLE_CUSTOM_DEFAULT = '#666666';
export const HERO_DESCRIPTION_CUSTOM_DEFAULT = '#555555';

export type HeroThemeColors = {
    primary: string;
    bodyText: string;
    secondaryText: string;
};

export const getHeroThemeColors = (themeConfig: Record<string, string>): HeroThemeColors => ({
    primary: themeConfig['--primary-color'] || '#2f5596',
    bodyText: themeConfig['--text-primary'] || '#1f2937',
    secondaryText: themeConfig['--text-secondary'] || '#4b5563',
});

export const normalizeHeroDescriptionColorPreset = (value: unknown): HeroDescriptionColorPreset | '' => {
    const key = String(value ?? '').trim().toLowerCase();
    if (key === 'site' || key === 'site-color' || key === 'sitecolor') return 'site';
    if (key === 'bodytext' || key === 'body-text' || key === 'text-primary' || key === 'textprimary') {
        return 'bodyText';
    }
    if (key === 'editortext' || key === 'editor-text' || key === 'editor_text') {
        return 'editorText';
    }
    if (key === 'secondarytext' || key === 'secondary-text' || key === 'text-secondary' || key === 'textsecondary') {
        return 'secondaryText';
    }
    if (key === 'black') return 'black';
    if (key === 'white') return 'white';
    if (key === 'custom' || key === 'color') return 'custom';
    return '';
};

export const normalizeHeroColorPreset = (value: unknown): HeroColorPreset | '' => {
    const key = String(value ?? '').trim().toLowerCase();
    if (key === 'site' || key === 'site-color' || key === 'sitecolor') return 'site';
    if (key === 'black') return 'black';
    if (key === 'white') return 'white';
    if (key === 'custom' || key === 'color') return 'custom';
    return '';
};

/** Resolve preset to a concrete color (never var(--*) — required for --ws-*-color CSS vars). */
const resolveConcreteHeroColor = (
    preset: HeroColorPreset,
    theme: HeroThemeColors,
    customHex: string | undefined,
    role: 'title' | 'subtitle' | 'description'
): string => {
    if (preset === 'custom') {
        if (role === 'title') return customHex || HERO_TITLE_CUSTOM_DEFAULT;
        if (role === 'subtitle') return customHex || HERO_SUBTITLE_CUSTOM_DEFAULT;
        return customHex || HERO_DESCRIPTION_CUSTOM_DEFAULT;
    }
    if (preset === 'black') return '#000000';
    if (preset === 'white') return '#ffffff';
    if (preset === 'site') return theme.primary;
    return theme.primary;
};

const resolveConcreteDescriptionColor = (
    preset: HeroDescriptionColorPreset,
    theme: HeroThemeColors,
    customHex: string | undefined
): string => {
    if (preset === 'custom') return customHex || HERO_DESCRIPTION_CUSTOM_DEFAULT;
    if (preset === 'black') return '#000000';
    if (preset === 'white') return '#ffffff';
    if (preset === 'bodyText') return theme.bodyText;
    if (preset === 'editorText') return theme.bodyText;
    if (preset === 'secondaryText') return theme.secondaryText;
    if (preset === 'site') return theme.primary;
    return theme.primary;
};

const toHeadingStyle = (color: string): CSSProperties => ({
    color,
    ['--ws-heading-color' as string]: color,
    ['--heading-h1-color' as string]: color,
});

const toSubheadingStyle = (color: string): CSSProperties => ({
    color,
    ['--ws-subheading-color' as string]: color,
    ['--heading-h2-color' as string]: color,
});

const toDescriptionStyle = (color: string): CSSProperties => ({
    color,
    ['--ws-description-color' as string]: color,
});

/** Title color setting for dropdowns. */
export const getHeroTitleColorSetting = (settings: Record<string, any>): HeroColorPreset | 'site' =>
    normalizeHeroColorPreset(settings.titleColor ?? settings.titleColorType) || 'site';

export const getHeroSubtitleColorSetting = (settings: Record<string, any>): HeroColorPreset | 'site' =>
    normalizeHeroColorPreset(settings.subtitleColor ?? settings.subtitleColorType) || 'site';

export const getHeroDescriptionColorSetting = (
    settings: Record<string, any>
): HeroDescriptionColorPreset | 'site' =>
    normalizeHeroDescriptionColorPreset(settings.labelColor ?? settings.descColor ?? settings.descColorType) || 'site';

export const getHeroTitleCustomColor = (settings: Record<string, any>): string =>
    settings.titleCustomColor || HERO_TITLE_CUSTOM_DEFAULT;

export const getHeroSubtitleCustomColor = (settings: Record<string, any>): string =>
    settings.subtitleCustomColor || HERO_SUBTITLE_CUSTOM_DEFAULT;

export const getHeroDescriptionCustomColor = (settings: Record<string, any>): string =>
    settings.labelCustomColor || settings.descCustomColor || HERO_DESCRIPTION_CUSTOM_DEFAULT;

export const buildHeroTitleColorPatch = (
    preset: string,
    customHex?: string,
    prevSettings?: Record<string, any>
): Record<string, any> => {
    const normalized = normalizeHeroColorPreset(preset) || 'site';
    const patch: Record<string, any> = { titleColor: normalized, titleColorType: normalized };
    if (normalized === 'custom') {
        patch.titleCustomColor = customHex ?? prevSettings?.titleCustomColor ?? HERO_TITLE_CUSTOM_DEFAULT;
    }
    return patch;
};

export const buildHeroSubtitleColorPatch = (
    preset: string,
    customHex?: string,
    prevSettings?: Record<string, any>
): Record<string, any> => {
    const normalized = normalizeHeroColorPreset(preset) || 'site';
    const patch: Record<string, any> = { subtitleColor: normalized, subtitleColorType: normalized };
    if (normalized === 'custom') {
        patch.subtitleCustomColor = customHex ?? prevSettings?.subtitleCustomColor ?? HERO_SUBTITLE_CUSTOM_DEFAULT;
    }
    return patch;
};

export const buildHeroDescriptionColorPatch = (
    preset: string,
    customHex?: string,
    prevSettings?: Record<string, any>
): Record<string, any> => {
    const normalized = normalizeHeroDescriptionColorPreset(preset) || 'site';
    const patch: Record<string, any> = {
        labelColor: normalized,
        descColor: normalized,
        descColorType: normalized,
    };
    if (normalized === 'custom') {
        const hex = customHex ?? prevSettings?.labelCustomColor ?? prevSettings?.descCustomColor ?? HERO_DESCRIPTION_CUSTOM_DEFAULT;
        patch.labelCustomColor = hex;
        patch.descCustomColor = hex;
    }
    return patch;
};

export const resolveHeroTitleColor = (
    settings: Record<string, any>,
    effectiveTitleColorSetting: string | undefined,
    theme: HeroThemeColors
): CSSProperties => {
    const raw = settings.titleColor ?? settings.titleColorType ?? effectiveTitleColorSetting;
    const preset = normalizeHeroColorPreset(raw);
    const customHex = String(settings.titleCustomColor || '').trim();

    if (preset === 'custom') {
        return toHeadingStyle(resolveConcreteHeroColor('custom', theme, customHex, 'title'));
    }

    const resolvedPreset =
        preset || normalizeHeroColorPreset(effectiveTitleColorSetting) || 'site';
    return toHeadingStyle(resolveConcreteHeroColor(resolvedPreset, theme, customHex, 'title'));
};

export const resolveHeroSubtitleColor = (
    settings: Record<string, any>,
    effectiveTitleColorSetting: string | undefined,
    theme: HeroThemeColors
): CSSProperties => {
    const raw = settings.subtitleColor ?? settings.subtitleColorType;
    const preset = normalizeHeroColorPreset(raw);
    const customHex = String(settings.subtitleCustomColor || '').trim();

    if (preset === 'custom') {
        return toSubheadingStyle(resolveConcreteHeroColor('custom', theme, customHex, 'subtitle'));
    }

    const resolvedPreset =
        preset || normalizeHeroColorPreset(effectiveTitleColorSetting) || 'site';
    return toSubheadingStyle(resolveConcreteHeroColor(resolvedPreset, theme, customHex, 'subtitle'));
};

export const resolveHeroDescriptionColor = (
    settings: Record<string, any>,
    theme: HeroThemeColors
): CSSProperties => {
    const raw = settings.labelColor ?? settings.descColor ?? settings.descColorType;
    const preset = normalizeHeroDescriptionColorPreset(raw);
    const customHex = String(settings.labelCustomColor ?? settings.descCustomColor ?? '').trim();

    if (preset === 'custom') {
        return toDescriptionStyle(resolveConcreteDescriptionColor('custom', theme, customHex));
    }

    /** Use colours from the rich-text editor (inline styles); no forced wrapper colour. */
    if (preset === 'editorText') {
        return { color: 'inherit' };
    }

    if (preset) {
        return toDescriptionStyle(resolveConcreteDescriptionColor(preset, theme, customHex));
    }

    return toDescriptionStyle(theme.primary);
};

export const hasHeroColorStyle = (style: CSSProperties, cssVar: string): boolean =>
    Boolean(style.color || (style as Record<string, string>)[cssVar]);

/** Cards grid — item title color */
export const getCardTitleColorSetting = (settings: Record<string, any>): HeroColorPreset | 'site' =>
    normalizeHeroColorPreset(settings.cardTitleColor ?? settings.cardTitleColorType) || 'site';

export const getCardTitleCustomColor = (settings: Record<string, any>): string =>
    settings.cardTitleCustomColor || HERO_TITLE_CUSTOM_DEFAULT;

export const buildCardTitleColorPatch = (
    preset: string,
    customHex?: string,
    prevSettings?: Record<string, any>
): Record<string, any> => {
    const normalized = normalizeHeroColorPreset(preset) || 'site';
    const patch: Record<string, any> = { cardTitleColor: normalized, cardTitleColorType: normalized };
    if (normalized === 'custom') {
        patch.cardTitleCustomColor = customHex ?? prevSettings?.cardTitleCustomColor ?? HERO_TITLE_CUSTOM_DEFAULT;
    }
    return patch;
};

/** Cards grid — item description color */
export const getCardDescColorSetting = (settings: Record<string, any>): HeroDescriptionColorPreset | 'site' =>
    normalizeHeroDescriptionColorPreset(settings.cardDescColor ?? settings.cardDescColorType) || 'secondaryText';

export const getCardDescCustomColor = (settings: Record<string, any>): string =>
    settings.cardDescCustomColor || HERO_DESCRIPTION_CUSTOM_DEFAULT;

export const buildCardDescColorPatch = (
    preset: string,
    customHex?: string,
    prevSettings?: Record<string, any>
): Record<string, any> => {
    const normalized = normalizeHeroDescriptionColorPreset(preset) || 'secondaryText';
    const patch: Record<string, any> = { cardDescColor: normalized, cardDescColorType: normalized };
    if (normalized === 'custom') {
        patch.cardDescCustomColor =
            customHex ?? prevSettings?.cardDescCustomColor ?? HERO_DESCRIPTION_CUSTOM_DEFAULT;
    }
    return patch;
};

/** Cards / carousel — item subtitle color */
export const getCardSubtitleColorSetting = (settings: Record<string, any>): HeroDescriptionColorPreset | 'site' =>
    normalizeHeroDescriptionColorPreset(settings.cardSubtitleColor ?? settings.cardSubtitleColorType) || 'secondaryText';

export const getCardSubtitleCustomColor = (settings: Record<string, any>): string =>
    settings.cardSubtitleCustomColor || HERO_DESCRIPTION_CUSTOM_DEFAULT;

export const buildCardSubtitleColorPatch = (
    preset: string,
    customHex?: string,
    prevSettings?: Record<string, any>
): Record<string, any> => {
    const normalized = normalizeHeroDescriptionColorPreset(preset) || 'secondaryText';
    const patch: Record<string, any> = { cardSubtitleColor: normalized, cardSubtitleColorType: normalized };
    if (normalized === 'custom') {
        patch.cardSubtitleCustomColor =
            customHex ?? prevSettings?.cardSubtitleCustomColor ?? HERO_DESCRIPTION_CUSTOM_DEFAULT;
    }
    return patch;
};
