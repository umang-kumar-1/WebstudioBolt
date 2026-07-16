import type { CSSProperties } from 'react';

export type HeroActionButtonRadiusPreset = 'none' | 'sm' | 'lg' | 'full' | 'custom';

export interface HeroActionButtonRadiusCustom {
    topLeft?: string;
    topRight?: string;
    bottomRight?: string;
    bottomLeft?: string;
}

export interface HeroActionButtonRadiusSettings {
    btnRadiusPreset?: HeroActionButtonRadiusPreset;
    btnRadiusCustom?: HeroActionButtonRadiusCustom;
}

export const DEFAULT_HERO_ACTION_BUTTON_RADIUS_CUSTOM: HeroActionButtonRadiusCustom = {
    topLeft: '',
    topRight: '',
    bottomRight: '',
    bottomLeft: '',
};

export const DEFAULT_HERO_ACTION_BUTTON_RADIUS_PRESET: HeroActionButtonRadiusPreset = 'sm';

const PRESET_VALUES: HeroActionButtonRadiusPreset[] = ['none', 'sm', 'lg', 'full', 'custom'];

const normalizeRadiusValue = (val?: string): string => {
    if (!val || !val.trim()) return '0';
    const v = val.trim();
    if (/^\d+(\.\d+)?$/.test(v)) return `${v}px`;
    return v;
};

export const parseHeroActionButtonRadiusSettings = (
    settings?: HeroActionButtonRadiusSettings | Record<string, unknown>
): Required<Pick<HeroActionButtonRadiusSettings, 'btnRadiusPreset' | 'btnRadiusCustom'>> => {
    const presetRaw = settings?.btnRadiusPreset;
    const btnRadiusPreset = PRESET_VALUES.includes(presetRaw as HeroActionButtonRadiusPreset)
        ? (presetRaw as HeroActionButtonRadiusPreset)
        : DEFAULT_HERO_ACTION_BUTTON_RADIUS_PRESET;

    const custom = (settings?.btnRadiusCustom || {}) as HeroActionButtonRadiusCustom;
    return {
        btnRadiusPreset,
        btnRadiusCustom: {
            topLeft: custom.topLeft || '',
            topRight: custom.topRight || '',
            bottomRight: custom.bottomRight || '',
            bottomLeft: custom.bottomLeft || '',
        },
    };
};

export const resolveHeroActionButtonRadiusStyle = (
    settings?: HeroActionButtonRadiusSettings | Record<string, unknown>
): CSSProperties => {
    const { btnRadiusPreset, btnRadiusCustom } = parseHeroActionButtonRadiusSettings(settings);

    if (btnRadiusPreset === 'custom') {
        const c = btnRadiusCustom;
        return {
            borderRadius: `${normalizeRadiusValue(c.topLeft)} ${normalizeRadiusValue(c.topRight)} ${normalizeRadiusValue(c.bottomRight)} ${normalizeRadiusValue(c.bottomLeft)}`,
        };
    }

    const map: Record<Exclude<HeroActionButtonRadiusPreset, 'custom'>, string> = {
        none: '0',
        sm: '0.125rem',
        lg: '0.5rem',
        full: '9999px',
    };

    return { borderRadius: map[btnRadiusPreset] || map.sm };
};
