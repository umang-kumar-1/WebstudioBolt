/** Preset typography styles for Header / Hero editor (Settings → Typography). */
export type HeroTypographyStylePreset =
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'paragraph'
    | 'custom';

export type HeroTypographyRole = 'title' | 'subtitle' | 'description' | 'cardTitle' | 'cardSubtitle' | 'cardDesc' | 'label';

export const HERO_TYPOGRAPHY_STYLE_DEFAULTS: Record<HeroTypographyRole, HeroTypographyStylePreset> = {
    title: 'h1',
    subtitle: 'h3',
    description: 'paragraph',
    cardTitle: 'h5',
    cardSubtitle: 'h6',
    cardDesc: 'paragraph',
    label: 'paragraph',
};

/** Dropdown options (Heading 1–6, Paragraph, Custom). */
export const HERO_TYPOGRAPHY_STYLE_OPTIONS: ReadonlyArray<{
    value: HeroTypographyStylePreset;
    labelKey: string;
}> = [
    { value: 'h1', labelKey: 'LABEL_STYLE_HEADING_1' },
    { value: 'h2', labelKey: 'LABEL_STYLE_HEADING_2' },
    { value: 'h3', labelKey: 'LABEL_STYLE_HEADING_3' },
    { value: 'h4', labelKey: 'LABEL_STYLE_HEADING_4' },
    { value: 'h5', labelKey: 'LABEL_STYLE_HEADING_5' },
    { value: 'h6', labelKey: 'LABEL_STYLE_HEADING_6' },
    { value: 'paragraph', labelKey: 'LABEL_STYLE_PARAGRAPH' },
    { value: 'custom', labelKey: 'LABEL_STYLE_CUSTOM' },
];

const PRESET_VALUES = new Set<string>(HERO_TYPOGRAPHY_STYLE_OPTIONS.map((o) => o.value));

export const isHeroTypographyStylePreset = (value: unknown): value is HeroTypographyStylePreset =>
    typeof value === 'string' && PRESET_VALUES.has(value);

const STYLE_SETTING_KEY: Record<HeroTypographyRole, string> = {
    title: 'titleStyle',
    subtitle: 'subtitleStyle',
    description: 'descStyle',
    cardTitle: 'cardTitleStyle',
    cardSubtitle: 'cardSubtitleStyle',
    cardDesc: 'cardDescStyle',
    label: 'labelStyle',
};

const FONT_SIZE_KEY: Record<HeroTypographyRole, string> = {
    title: 'titleFontSize',
    subtitle: 'subtitleFontSize',
    description: 'descFontSize',
    cardTitle: 'cardTitleFontSize',
    cardSubtitle: 'cardSubtitleFontSize',
    cardDesc: 'cardDescFontSize',
    label: 'labelFontSize',
};

const FONT_WEIGHT_KEY: Record<HeroTypographyRole, string> = {
    title: 'titleFontWeight',
    subtitle: 'subtitleFontWeight',
    description: 'descFontWeight',
    cardTitle: 'cardTitleFontWeight',
    cardSubtitle: 'cardSubtitleFontWeight',
    cardDesc: 'cardDescFontWeight',
    label: 'labelFontWeight',
};

const LINE_HEIGHT_KEY: Record<HeroTypographyRole, string> = {
    title: 'titleLineHeight',
    subtitle: 'subtitleLineHeight',
    description: 'descLineHeight',
    cardTitle: 'cardTitleLineHeight',
    cardSubtitle: 'cardSubtitleLineHeight',
    cardDesc: 'cardDescLineHeight',
    label: 'labelLineHeight',
};

const HEADING_FONT_SIZE_FALLBACK: Record<string, string> = {
    h1: '42px',
    h2: '32px',
    h3: '24px',
    h4: '20px',
    h5: '16px',
    h6: '14px',
};

export const getHeroTypographyStyleSettingKey = (role: HeroTypographyRole): string =>
    STYLE_SETTING_KEY[role];

export const getHeroTypographyCustomKeys = (role: HeroTypographyRole) => ({
    fontSize: FONT_SIZE_KEY[role],
    fontWeight: FONT_WEIGHT_KEY[role],
    lineHeight: LINE_HEIGHT_KEY[role],
});

export const inferHeroTypographyStyle = (
    settings: Record<string, any> | undefined,
    role: HeroTypographyRole
): HeroTypographyStylePreset => {
    const stored = settings?.[STYLE_SETTING_KEY[role]];
    if (isHeroTypographyStylePreset(stored)) {
        return stored;
    }
    const hasCustom =
        (settings?.[FONT_SIZE_KEY[role]] != null && settings[FONT_SIZE_KEY[role]] !== '') ||
        (settings?.[FONT_WEIGHT_KEY[role]] != null && settings[FONT_WEIGHT_KEY[role]] !== '') ||
        (settings?.[LINE_HEIGHT_KEY[role]] != null && settings[LINE_HEIGHT_KEY[role]] !== '');
    if (hasCustom) return 'custom';
    return HERO_TYPOGRAPHY_STYLE_DEFAULTS[role];
};

export type ResolvedHeroTypography = {
    fontSize?: string;
    fontWeight?: string | number;
    lineHeight?: string;
};

const toPx = (value: any): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const raw = String(value).trim();
    if (!raw || raw.toLowerCase() === 'auto') return undefined;
    return raw.endsWith('px') ? raw : `${raw}px`;
};

const resolveHeadingPreset = (
    level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
    themeConfig: Record<string, string>
): ResolvedHeroTypography => ({
    fontSize: themeConfig[`--font-size-${level}`] || HEADING_FONT_SIZE_FALLBACK[level],
    fontWeight: themeConfig['--font-weight-bold'] || 600,
    lineHeight: undefined,
});

export const resolveHeroTypography = (
    settings: Record<string, any> | undefined,
    role: HeroTypographyRole,
    themeConfig: Record<string, string>
): ResolvedHeroTypography => {
    const style = inferHeroTypographyStyle(settings, role);
    const keys = getHeroTypographyCustomKeys(role);

    if (style === 'custom') {
        return {
            fontSize: settings?.[keys.fontSize] != null && settings[keys.fontSize] !== ''
                ? toPx(settings[keys.fontSize])
                : undefined,
            fontWeight: settings?.[keys.fontWeight] != null && settings[keys.fontWeight] !== ''
                ? settings[keys.fontWeight]
                : undefined,
            lineHeight: toPx(settings?.[keys.lineHeight]),
        };
    }

    if (style === 'h1' || style === 'h2' || style === 'h3' || style === 'h4' || style === 'h5' || style === 'h6') {
        return resolveHeadingPreset(style, themeConfig);
    }

    return {
        fontSize: themeConfig['--font-size-p'] || themeConfig['--font-size-base'] || '14px',
        fontWeight: 400,
        lineHeight: undefined,
    };
};

export const FONT_WEIGHT_OPTIONS = [
    { value: '100', labelKey: 'LABEL_FONT_WEIGHT_THIN' },
    { value: '200', labelKey: 'LABEL_FONT_WEIGHT_EXTRALIGHT' },
    { value: '300', labelKey: 'LABEL_FONT_WEIGHT_LIGHT' },
    { value: '400', labelKey: 'LABEL_FONT_WEIGHT_REGULAR' },
    { value: '500', labelKey: 'LABEL_FONT_WEIGHT_MEDIUM' },
    { value: '600', labelKey: 'LABEL_FONT_WEIGHT_SEMIBOLD' },
    { value: '700', labelKey: 'LABEL_FONT_WEIGHT_BOLD' },
    { value: '800', labelKey: 'LABEL_FONT_WEIGHT_EXTRABOLD' },
    { value: '900', labelKey: 'LABEL_FONT_WEIGHT_BLACK' },
] as const;

/** @deprecated Use FONT_WEIGHT_OPTIONS */
export const HERO_FONT_WEIGHT_OPTIONS = FONT_WEIGHT_OPTIONS;

const FONT_WEIGHT_VALUES: Set<string> = new Set(FONT_WEIGHT_OPTIONS.map((opt) => opt.value));

/** Normalizes stored font weight values to a supported dropdown option. */
export const resolveFontWeightSelectValue = (weight: unknown, fallback = '400'): string => {
    if (weight == null || weight === '') return fallback;
    const normalized = String(weight).trim().toLowerCase();
    if (normalized === 'normal') return '400';
    if (normalized === 'bold') return '700';
    if (FONT_WEIGHT_VALUES.has(normalized)) return normalized;
    const n = Number(normalized);
    if (!Number.isFinite(n)) return fallback;
    const rounded = Math.round(n / 100) * 100;
    const clamped = Math.min(900, Math.max(100, rounded));
    return String(clamped);
};

export const formatFontWeightOptionLabel = (
    opt: { value: string; labelKey: string },
    translate: (key: string, lang: string) => string,
    lang: string,
): string => `${opt.value} — ${translate(opt.labelKey, lang)}`;

/** Maps stored btnFontWeight (legacy numeric or preset) to dropdown value. */
export const resolveActionButtonFontWeightSelectValue = (weight: unknown): string =>
    resolveFontWeightSelectValue(weight, '700');

export const resolveActionButtonFontWeightNumeric = (weight: unknown): number =>
    Number(resolveActionButtonFontWeightSelectValue(weight));

export const resolveActionButtonLetterCase = (letterCase: unknown): string => {
    const value = String(letterCase || 'none').trim().toLowerCase();
    if (value === 'uppercase' || value === 'lowercase' || value === 'capitalize') return value;
    return 'none';
};

/** Contact forms default to uppercase heading letter case when unset (matches editor dropdown). */
export const CONTACT_FORM_DEFAULT_LETTER_CASE = 'uppercase';

export const getEffectiveContactFormLetterCase = (settings?: Record<string, any>): string => {
    const raw = settings?.letterCase;
    if (raw != null && String(raw).trim() !== '') return String(raw).trim();
    return CONTACT_FORM_DEFAULT_LETTER_CASE;
};

export const resolveContactFormLetterCaseCss = (
    rawValue: string
): 'none' | 'uppercase' | 'lowercase' | 'capitalize' => {
    const v = String(rawValue).trim().toLowerCase();
    if (v === 'uppercase') return 'uppercase';
    if (v === 'lowercase') return 'lowercase';
    if (v === 'title') return 'capitalize';
    return 'none';
};

/** Applies heading letter case in JS (heading only — subheading/description stay as typed). */
export const applyContactFormLetterCaseToText = (text: string, rawValue: string): string => {
    if (!text) return text;
    const css = resolveContactFormLetterCaseCss(rawValue);
    if (css === 'uppercase') return text.toLocaleUpperCase();
    if (css === 'lowercase') return text.toLocaleLowerCase();
    if (css === 'capitalize') {
        return text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    }
    return text;
};
