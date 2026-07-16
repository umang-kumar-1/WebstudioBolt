import type { CSSProperties } from 'react';
import {
    resolveActionButtonFontWeightNumeric,
    resolveActionButtonLetterCase,
} from '../heroTypographyPresets';
import {
    DEFAULT_HERO_ACTION_BUTTON_RADIUS_CUSTOM,
    HeroActionButtonRadiusCustom,
    HeroActionButtonRadiusPreset,
    resolveHeroActionButtonRadiusStyle,
} from './heroActionButtonRadius';

export interface ActionButtonStyleFields {
    btnFontSize?: number | string;
    btnFontWeight?: number | string;
    btnLetterCase?: string;
    btnRadiusPreset?: HeroActionButtonRadiusPreset;
    btnRadiusCustom?: HeroActionButtonRadiusCustom;
}

export const pickActionButtonStyleFields = (
    source?: Record<string, unknown> | null
): ActionButtonStyleFields => ({
    btnFontSize: (source?.btnFontSize as number | string | undefined) ?? '',
    btnFontWeight: source?.btnFontWeight as number | string | undefined,
    btnLetterCase: (source?.btnLetterCase as string | undefined) || 'none',
    btnRadiusPreset: source?.btnRadiusPreset as HeroActionButtonRadiusPreset | undefined,
    btnRadiusCustom: (source?.btnRadiusCustom as HeroActionButtonRadiusCustom | undefined)
        || { ...DEFAULT_HERO_ACTION_BUTTON_RADIUS_CUSTOM },
});

export const serializeActionButtonStyleFields = (
    data: Record<string, unknown>
): ActionButtonStyleFields => ({
    btnFontSize: (data.btnFontSize as number | string | undefined) || '',
    btnFontWeight: (data.btnFontWeight as number | string | undefined) ?? '',
    btnLetterCase: (data.btnLetterCase as string | undefined) || 'none',
    btnRadiusPreset: data.btnRadiusPreset as HeroActionButtonRadiusPreset | undefined,
    btnRadiusCustom: (data.btnRadiusCustom as HeroActionButtonRadiusCustom | undefined)
        || { ...DEFAULT_HERO_ACTION_BUTTON_RADIUS_CUSTOM },
});

export const buildActionButtonInlineStyle = (
    settings?: Record<string, unknown> | ActionButtonStyleFields
): CSSProperties => {
    const radiusStyle = resolveHeroActionButtonRadiusStyle(settings);
    const fontWeight = resolveActionButtonFontWeightNumeric(settings?.btnFontWeight);
    const textTransform = resolveActionButtonLetterCase(settings?.btnLetterCase);

    const fontSizePx = settings?.btnFontSize ? `${settings.btnFontSize}px` : undefined;

    return {
        ...(fontSizePx ? {
            fontSize: fontSizePx,
            ['--ws-btn-font-size' as string]: fontSizePx,
        } : {}),
        fontWeight,
        textTransform,
        ...radiusStyle,
        ['--ws-btn-font-weight' as string]: String(fontWeight),
        ['--ws-btn-text-transform' as string]: textTransform,
        ['--ws-btn-radius' as string]: radiusStyle.borderRadius,
    };
};
