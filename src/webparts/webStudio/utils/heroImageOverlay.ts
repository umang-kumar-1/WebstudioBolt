export const DEFAULT_HERO_OVERLAY_COLOR = '#000000';
export const DEFAULT_HERO_OVERLAY_OPACITY = 0.4;

export function parseHeroOverlayOpacity(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(1, Math.max(0, value));
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return Math.min(1, Math.max(0, parsed));
  }
  return DEFAULT_HERO_OVERLAY_OPACITY;
}

export function isValidHexColor(hex: string): boolean {
  return parseHexColor(hex) !== null;
}

export function normalizeHexColorInput(raw: string): string {
  let value = raw.trim();
  if (!value) return '';
  if (!value.startsWith('#')) value = `#${value}`;
  return value.toUpperCase();
}

export function toColorInputValue(hex: string, fallback = DEFAULT_HERO_OVERLAY_COLOR): string {
  const normalized = normalizeHexColorInput(hex);
  return isValidHexColor(normalized) ? normalized : fallback;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace('#', '');
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  return null;
}

export function resolveHeroOverlayColor(hex: unknown): string {
  if (typeof hex === 'string' && parseHexColor(hex)) return hex;
  return DEFAULT_HERO_OVERLAY_COLOR;
}

/** Returns rgba() overlay color for image heroes, or null when overlay is disabled (opacity 0). */
export function resolveHeroOverlayBackground(settings: Record<string, unknown>): string | null {
  if (settings.bgType !== 'image') return null;
  const opacity = parseHeroOverlayOpacity(settings.heroOverlayOpacity);
  if (opacity <= 0) return null;
  const rgb = parseHexColor(resolveHeroOverlayColor(settings.heroOverlayColor));
  if (!rgb) return `rgba(0, 0, 0, ${opacity})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}
