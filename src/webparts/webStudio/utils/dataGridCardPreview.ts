import React, { type CSSProperties, type ReactNode } from 'react';
import {
    resolveHeroTypography,
    type ResolvedHeroTypography,
} from '../heroTypographyPresets';
import { resolveCardTitleFontFamily } from './fontCatalog';

export type DataGridCardLayout = {
    card: string;
    img: string;
    imgStyle?: CSSProperties;
};

const heroTypographyToStyle = (typo: ResolvedHeroTypography, cssVarKey?: string): CSSProperties => {
    const style: Record<string, string | number> = {};
    if (typo.fontSize) {
        style.fontSize = typo.fontSize;
        if (cssVarKey) style[cssVarKey] = typo.fontSize;
    }
    if (typo.fontWeight != null && typo.fontWeight !== '') {
        style.fontWeight = typo.fontWeight;
    }
    if (typo.lineHeight) {
        style.lineHeight = typo.lineHeight;
    }
    return style as CSSProperties;
};

const resolveLetterCaseCss = (rawValue: unknown): 'none' | 'uppercase' | 'lowercase' | 'capitalize' => {
    const value = String(rawValue ?? '').trim().toLowerCase();
    if (!value || value === 'none' || value === 'normal-case') return 'none';
    if (value === 'uppercase') return 'uppercase';
    if (value === 'lowercase') return 'lowercase';
    if (value === 'capitalize' || value === 'title') return 'capitalize';
    return 'none';
};

const resolveCardTitleColorStyle = (colorSetting?: string, customHex?: string): CSSProperties => {
    const key = String(colorSetting || '').trim().toLowerCase();
    if (!colorSetting || !key) {
        return customHex ? { color: customHex } : { color: 'var(--primary-color)' };
    }
    if (key === 'site' || key === 'site-color' || key === 'sitecolor') return { color: 'var(--primary-color)' };
    if ((key === 'color' || key === 'custom') && customHex) return { color: customHex };
    if (key === 'white') return { color: '#ffffff' };
    if (key === 'black') return { color: '#000000' };
    if (String(colorSetting).trim().startsWith('#')) return { color: String(colorSetting).trim() };
    return { color: 'var(--primary-color)' };
};

export const getDataGridCardBorderClass = (settings: Record<string, unknown> | undefined): string => {
    if (settings?.border === 'rounded') return 'rounded-lg';
    if (settings?.border === 'circle') return 'rounded-xl';
    return 'rounded-none';
};

export const getDataGridCardLayout = (
    settings: Record<string, unknown> | undefined,
    columns: number
): DataGridCardLayout => {
    const cols = columns || 3;
    const isSingleColumnGrid = cols === 1;
    const pos = String(settings?.imgPos || 'top');

    switch (pos) {
        case 'left':
            return {
                card: isSingleColumnGrid ? 'flex-row items-stretch' : 'flex-row items-center',
                img: isSingleColumnGrid ? 'w-24 flex-shrink-0 self-stretch min-h-[7rem]' : 'w-20 h-20 m-3 flex-shrink-0',
                imgStyle: isSingleColumnGrid ? { minHeight: '7rem' } : undefined,
            };
        case 'right':
            return {
                card: isSingleColumnGrid ? 'flex-row-reverse items-stretch' : 'flex-row-reverse items-center',
                img: isSingleColumnGrid ? 'w-24 flex-shrink-0 self-stretch min-h-[7rem]' : 'w-20 h-20 m-3 flex-shrink-0',
                imgStyle: isSingleColumnGrid ? { minHeight: '7rem' } : undefined,
            };
        case 'none':
            return { card: 'flex-col', img: 'hidden' };
        default:
            return {
                card: 'flex-col',
                img: isSingleColumnGrid ? 'w-full flex-shrink-0 min-h-[7rem]' : 'w-full h-32 flex-shrink-0',
                imgStyle: isSingleColumnGrid ? { aspectRatio: '2 / 1', width: '100%' } : undefined,
            };
    }
};

export const getDataGridCardImageBorderClass = (
    settings: Record<string, unknown> | undefined,
    imgPos?: string
): string => {
    const position = imgPos || String(settings?.imgPos || 'top');
    if (settings?.imgBorder === 'rounded') {
        return position === 'top' ? 'rounded-t-lg overflow-hidden' : 'rounded-xl overflow-hidden';
    }
    return 'overflow-hidden';
};

export const getDataGridCardTitleStyle = (
    settings: Record<string, unknown> | undefined,
    themeConfig: Record<string, string>
): CSSProperties => {
    const typo = heroTypographyToStyle(resolveHeroTypography(settings, 'cardTitle', themeConfig), '--font-size-h3');
    const colorStyle = resolveCardTitleColorStyle(
        settings?.cardTitleColor as string | undefined,
        settings?.cardTitleCustomColor as string | undefined
    );
    const letterCss = resolveLetterCaseCss(settings?.cardLetterCase ?? 'uppercase');
    const resolvedFontFamily = resolveCardTitleFontFamily(settings as { cardTitleFontFamily?: string }, themeConfig);
    return {
        margin: 0,
        ...typo,
        ...colorStyle,
        ...(letterCss !== 'none' ? { textTransform: letterCss } : {}),
        fontFamily: resolvedFontFamily,
    };
};

export const getDataGridEditorGridStyle = (columns: number, spacing?: string): CSSProperties => {
    const gapRem = spacing === 'compact' ? 0.75 : spacing === 'wide' ? 1.25 : 1;
    return {
        ['--ws-grid-cols' as string]: String(columns || 3),
        ['--ws-grid-gap' as string]: `${gapRem}rem`,
    };
};

const toRoman = (num: number): string => {
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const numerals = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    let roman = '';
    let n = num;
    for (let i = 0; i < values.length; i++) {
        while (n >= values[i]) {
            roman += numerals[i];
            n -= values[i];
        }
    }
    return roman;
};

export const getDataGridOrderedLabel = (index: number, ordering?: string): string => {
    const n = index + 1;
    switch (ordering) {
        case '123': return n.toString().padStart(2, '0');
        case 'III': return toRoman(n);
        case 'IIIII': return 'I'.repeat(n);
        case 'ABC': return String.fromCharCode(64 + n);
        case 'abc': return String.fromCharCode(96 + n);
        case 'dots': return '...';
        default: return '';
    }
};

export const resolveDataGridPreviewColor = (
    colorSetting?: string,
    customHex?: string,
    defaultClass: string = 'text-inherit',
    varName?: string
): { className?: string; style?: CSSProperties } => {
    const key = String(colorSetting || '').trim().toLowerCase();

    if (!colorSetting || !key) {
        if (customHex) {
            const style: Record<string, string> = { color: customHex };
            if (varName) style[varName] = customHex;
            return { style };
        }
        return { className: defaultClass };
    }

    let colorValue: string | undefined;
    if (key === 'site' || key === 'site-color' || key === 'sitecolor') colorValue = 'var(--primary-color)';
    else if ((key === 'color' || key === 'custom') && customHex) colorValue = customHex;
    else if (key === 'white') colorValue = '#ffffff';
    else if (key === 'black') colorValue = '#000000';
    else if (String(colorSetting).trim().startsWith('#')) colorValue = String(colorSetting).trim();

    if (colorValue) {
        const style: Record<string, string> = { color: colorValue };
        if (varName) style[varName] = colorValue;
        return { style };
    }

    return { className: defaultClass };
};

const normalizeDataGridLetterCase = (rawValue: unknown): 'uppercase' | 'lowercase' | 'capitalize' | 'normal-case' => {
    const value = String(rawValue || '').trim().toLowerCase();
    if (!value || value === 'none' || value === 'normal-case') return 'normal-case';
    if (value === 'uppercase' || value === 'grossbuchstaben' || value === 'majuscules' || value === 'mayúsculas' || value === 'mayusculas') {
        return 'uppercase';
    }
    if (value === 'lowercase' || value === 'kleinbuchstaben' || value === 'minuscules' || value === 'minúsculas' || value === 'minusculas') {
        return 'lowercase';
    }
    if (value === 'capitalize' || value === 'title' || value === 'title case') return 'capitalize';
    if (value === 'sentence' || value === 'sentence case') return 'normal-case';
    return 'normal-case';
};

const resolveCardDescColorStyle = (settings: Record<string, unknown> | undefined): CSSProperties => {
    const preset = String(settings?.cardDescColor || '').trim().toLowerCase();
    if (preset === 'bodytext' || preset === 'body-text') return { color: 'var(--text-primary)' };
    if (preset === 'secondarytext' || preset === 'secondary-text') return { color: 'var(--text-secondary, #6b7280)' };
    return resolveDataGridPreviewColor(
        settings?.cardDescColor as string | undefined,
        settings?.cardDescCustomColor as string | undefined,
        'text-gray-600',
        '--text-secondary'
    ).style || {};
};

export const getDataGridCardDescStyle = (
    settings: Record<string, unknown> | undefined,
    themeConfig: Record<string, string>
): CSSProperties => {
    const typo = heroTypographyToStyle(resolveHeroTypography(settings, 'cardDesc', themeConfig), '--font-size-p');
    return {
        fontFamily: 'var(--font-family-base, sans-serif)',
        lineHeight: '1.6',
        ...typo,
        ...resolveCardDescColorStyle(settings),
    };
};

export type DataGridSectionHeaderPresentation = {
    titleTypoStyle: CSSProperties;
    subtitleTypoStyle: CSSProperties;
    descTypoStyle: CSSProperties;
    titleColor: { className?: string; style?: CSSProperties };
    subtitleColor: { className?: string; style?: CSSProperties };
    descColor: { className?: string; style?: CSSProperties };
    headerWrapClass: string;
    headerTextClass: string;
    sectionLetterCaseClass: string;
    sectionTextTransform?: 'uppercase' | 'lowercase' | 'capitalize';
    centeredSubheadingClass: string;
};

export const getDataGridSectionHeaderPresentation = (
    settings: Record<string, unknown> | undefined,
    themeConfig: Record<string, string>
): DataGridSectionHeaderPresentation => {
    const align = String(settings?.align || 'left');
    const titleTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'title', themeConfig), '--font-size-h2');
    const subtitleTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'subtitle', themeConfig), '--font-size-p');
    const descTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'description', themeConfig), '--font-size-p');
    const sectionLetterCaseClass = normalizeDataGridLetterCase(settings?.letterCase);
    const sectionTextTransform = sectionLetterCaseClass === 'normal-case' ? undefined : sectionLetterCaseClass;

    return {
        titleTypoStyle,
        subtitleTypoStyle,
        descTypoStyle,
        titleColor: resolveDataGridPreviewColor(
            settings?.titleColor as string | undefined,
            settings?.titleCustomColor as string | undefined,
            'text-inherit',
            '--heading-h2-color'
        ),
        subtitleColor: resolveDataGridPreviewColor(
            (settings?.subtitleColor || settings?.titleColor) as string | undefined,
            (settings?.subtitleCustomColor || settings?.titleCustomColor) as string | undefined,
            'text-inherit',
            '--heading-h2-color'
        ),
        descColor: resolveDataGridPreviewColor(
            settings?.descColor as string | undefined,
            settings?.descCustomColor as string | undefined,
            'text-[var(--text-secondary)]',
            '--text-primary'
        ),
        headerWrapClass: align === 'center'
            ? 'justify-center relative'
            : align === 'right'
                ? 'justify-end relative'
                : 'justify-between',
        headerTextClass: align === 'center'
            ? 'text-center w-full'
            : align === 'right'
                ? 'text-right'
                : 'text-left',
        sectionLetterCaseClass,
        sectionTextTransform,
        centeredSubheadingClass: align === 'center' ? 'ws-section-subheading-width mx-auto' : 'w-full',
    };
};

/** Full-screen preview sits on a black overlay — use white when section has no explicit background. */
export const withDataGridPreviewBgFallback = (
    style: CSSProperties,
    fallback = '#ffffff'
): CSSProperties => {
    const bg = style.backgroundColor;
    if (!bg || bg === 'transparent') {
        return { ...style, backgroundColor: fallback };
    }
    return style;
};

export const getDataGridSectionBgStyle = (settings: Record<string, unknown> | undefined): CSSProperties => {
    const resolvedBgColor = settings?.bgColor || (
        settings?.backgroundColor && settings.backgroundColor !== 'site-color' ? settings.backgroundColor : '#ffffff'
    );
    const resolvedBgImage = settings?.bgImage || settings?.backgroundImage || '';
    const bgTypeNormalized = String(settings?.bgType || '').toLowerCase();
    const resolvedBgType = ((bgTypeNormalized === 'none' || bgTypeNormalized === 'color' || bgTypeNormalized === 'image' || bgTypeNormalized === 'site-color' || bgTypeNormalized === 'site' || bgTypeNormalized === 'sitecolor')
        ? ((bgTypeNormalized === 'site' || bgTypeNormalized === 'sitecolor') ? 'site-color' : bgTypeNormalized)
        : (
            settings?.backgroundColor === 'site-color'
                ? 'site-color'
                : ((settings?.bgImage || settings?.backgroundImage) ? 'image' : ((settings?.bgColor || settings?.backgroundColor) ? 'color' : 'none'))
        )) as 'none' | 'color' | 'site-color' | 'image';

    return {
        backgroundColor: resolvedBgType === 'site-color'
            ? 'var(--primary-color)'
            : (resolvedBgType === 'color' ? String(resolvedBgColor) : 'transparent'),
        backgroundImage: resolvedBgType === 'image' && resolvedBgImage ? `url("${resolvedBgImage}")` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    };
};

export const getDataGridCardBgStyle = (settings: Record<string, unknown> | undefined): CSSProperties => {
    const resolvedCardBgColor = settings?.cardBgColor || settings?.cardBackgroundColor || '#ffffff';
    const cardBgTypeNormalized = String(settings?.cardBgType || '').toLowerCase();
    const resolvedCardBgType = ((cardBgTypeNormalized === 'none' || cardBgTypeNormalized === 'color' || cardBgTypeNormalized === 'site-color' || cardBgTypeNormalized === 'site' || cardBgTypeNormalized === 'sitecolor')
        ? ((cardBgTypeNormalized === 'site' || cardBgTypeNormalized === 'sitecolor') ? 'site-color' : cardBgTypeNormalized)
        : (
            settings?.cardBackgroundColor === 'site-color'
                ? 'site-color'
                : ((settings?.cardBgColor || settings?.cardBackgroundColor) ? 'color' : 'none')
        )) as 'none' | 'color' | 'site-color';

    return {
        backgroundColor: resolvedCardBgType === 'site-color'
            ? 'var(--primary-color)'
            : (resolvedCardBgType === 'color' ? String(resolvedCardBgColor) : 'transparent'),
    };
};

export const getDataGridPreviewCardClassName = (
    settings: Record<string, unknown> | undefined,
    borderClass: string,
    cardLayoutCard: string,
    options?: { isSlider?: boolean }
): string => {
    const useOldCardLayout = !!settings?.useOldCardLayout;
    const isSlider = !!options?.isSlider;
    const hasBorder = settings?.border !== 'none';
    return [
        useOldCardLayout ? 'bg-transparent' : 'bg-white',
        hasBorder ? 'border border-gray-200' : '',
        'group flex relative box-border',
        isSlider && !useOldCardLayout ? 'h-full overflow-hidden' : '',
        cardLayoutCard,
        borderClass,
        isSlider ? 'snap-start flex-shrink-0' : '',
        useOldCardLayout ? '' : settings?.imgBorder === 'halfcircle' ? 'overflow-visible' : (!isSlider ? 'overflow-hidden' : ''),
    ].filter(Boolean).join(' ');
};

export const renderDataGridPreviewRichText = (
    html: string,
    className?: string,
    style?: CSSProperties
): ReactNode => {
    if (!html) return null;
    const finalClassName = ['jodit-wysiwyg', className].filter(Boolean).join(' ');
    return React.createElement('div', {
        className: finalClassName,
        style,
        dangerouslySetInnerHTML: { __html: html },
    });
};
