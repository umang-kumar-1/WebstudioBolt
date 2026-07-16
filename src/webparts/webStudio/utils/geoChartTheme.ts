/** Google GeoChart colours derived from site primary theme colour. */

const DEFAULT_PRIMARY = '#2f5596';
const NEUTRAL_MAP_FILL = '#e2e8f0';

const parseHex = (hex: string): { r: number; g: number; b: number } | null => {
    const cleaned = String(hex || '').trim().replace(/^#/, '');
    if (cleaned.length === 3) {
        return {
            r: parseInt(cleaned[0] + cleaned[0], 16),
            g: parseInt(cleaned[1] + cleaned[1], 16),
            b: parseInt(cleaned[2] + cleaned[2], 16),
        };
    }
    if (cleaned.length === 6) {
        return {
            r: parseInt(cleaned.slice(0, 2), 16),
            g: parseInt(cleaned.slice(2, 4), 16),
            b: parseInt(cleaned.slice(4, 6), 16),
        };
    }
    return null;
};

const normalizePrimaryHex = (primaryColor?: string): string => {
    const raw = String(primaryColor || '').trim();
    if (!raw || raw.startsWith('var(')) return DEFAULT_PRIMARY;
    return raw.startsWith('#') ? raw : `#${raw}`;
};

/** Light tint of primary (replaces hard-coded #dbeafe / #f0f4ff pairs). */
export const mixPrimaryWithWhite = (primaryColor: string, whiteRatio: number): string => {
    const primary = normalizePrimaryHex(primaryColor);
    const rgb = parseHex(primary);
    if (!rgb) return primary;
    const ratio = Math.min(1, Math.max(0, whiteRatio));
    const r = Math.round(rgb.r + (255 - rgb.r) * ratio);
    const g = Math.round(rgb.g + (255 - rgb.g) * ratio);
    const b = Math.round(rgb.b + (255 - rgb.b) * ratio);
    return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

export type GeoChartThemeColors = {
    colorAxisMin: string;
    colorAxisMax: string;
    backgroundColor: string;
    datalessRegionColor: string;
    defaultColor: string;
};

export const getGeoChartThemeColors = (primaryColor?: string): GeoChartThemeColors => {
    const primary = normalizePrimaryHex(primaryColor);
    return {
        colorAxisMin: mixPrimaryWithWhite(primary, 0.82),
        colorAxisMax: primary,
        backgroundColor: mixPrimaryWithWhite(primary, 0.94),
        datalessRegionColor: NEUTRAL_MAP_FILL,
        defaultColor: NEUTRAL_MAP_FILL,
    };
};
