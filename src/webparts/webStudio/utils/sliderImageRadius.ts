import type { CSSProperties } from 'react';
import type { SliderImageRadiusCustom, SliderImageSettings } from '../types';

export type SliderImageRadiusPreset = NonNullable<SliderImageSettings['radiusPreset']>;

export const DEFAULT_SLIDER_IMAGE_SETTINGS: SliderImageSettings = {
    radiusPreset: 'none',
    radiusCustom: { topLeft: '', topRight: '', bottomRight: '', bottomLeft: '' },
};

const PRESET_VALUES: SliderImageRadiusPreset[] = ['none', 'sm', 'lg', 'full', 'custom'];

const normalizeRadiusValue = (val?: string): string => {
    if (!val || !val.trim()) return '0';
    const v = val.trim();
    if (/^\d+(\.\d+)?$/.test(v)) return `${v}px`;
    return v;
};

export const parseSliderImageSettings = (raw: unknown): SliderImageSettings => {
    if (!raw) return { ...DEFAULT_SLIDER_IMAGE_SETTINGS, radiusCustom: { ...DEFAULT_SLIDER_IMAGE_SETTINGS.radiusCustom } };

    let parsed: unknown = raw;
    if (typeof raw === 'string') {
        try {
            parsed = JSON.parse(raw);
        } catch {
            return { ...DEFAULT_SLIDER_IMAGE_SETTINGS, radiusCustom: { ...DEFAULT_SLIDER_IMAGE_SETTINGS.radiusCustom } };
        }
    }

    if (typeof parsed !== 'object' || parsed === null) {
        return { ...DEFAULT_SLIDER_IMAGE_SETTINGS, radiusCustom: { ...DEFAULT_SLIDER_IMAGE_SETTINGS.radiusCustom } };
    }

    const obj = parsed as Partial<SliderImageSettings>;
    const radiusPreset = PRESET_VALUES.includes(obj.radiusPreset as SliderImageRadiusPreset)
        ? (obj.radiusPreset as SliderImageRadiusPreset)
        : 'none';

    const custom = obj.radiusCustom || {};
    return {
        radiusPreset,
        radiusCustom: {
            topLeft: custom.topLeft || '',
            topRight: custom.topRight || '',
            bottomRight: custom.bottomRight || '',
            bottomLeft: custom.bottomLeft || '',
        },
    };
};

export const resolveSliderImageRadiusStyle = (settings?: SliderImageSettings): CSSProperties => {
    const preset = settings?.radiusPreset || 'none';

    if (preset === 'custom') {
        const c: SliderImageRadiusCustom = settings?.radiusCustom || {};
        return {
            borderRadius: `${normalizeRadiusValue(c.topLeft)} ${normalizeRadiusValue(c.topRight)} ${normalizeRadiusValue(c.bottomRight)} ${normalizeRadiusValue(c.bottomLeft)}`,
        };
    }

    const map: Record<Exclude<SliderImageRadiusPreset, 'custom'>, string> = {
        none: '0',
        sm: '0.125rem',
        lg: '0.5rem',
        full: '9999px',
    };

    return { borderRadius: map[preset] || '0' };
};
