import { SiteConfig, ThemeConfig, ThemeTemplate } from '../types';
import { applyPageWidthToTheme } from './pageWidth';

export const DEFAULT_THEME_TEMPLATE_ID = 'builtin_default';

/** SiteConfig keys edited inside the theme / styling editor. */
export const STYLING_SITE_CONFIG_KEYS = [
  'headerWidth',
  'headerWidthCustom',
  'headerLogoHeight',
  'headerNavHeight',
  'headerTopBackgroundColor',
  'headerBottomBackgroundColor',
  'navAlignment',
  'headerLogoText',
  'headerLogoTextSpacing',
  'headerLogoTextAlignment',
  'headerLogoTextFontSize',
  'headerTopAlignment',
  'headerNavFontWeight',
  'headerNavHoverColor',
  'headerSubmenuHoverBgColor',
  'headerSubmenuHoverTextColor',
  'headerMenuFontFamily',
  'headerMenuFontSize',
  'headerMenuFontWeight',
  'headerMenuLineHeight',
  'headerMenuTextTransform',
  'headerSubmenuFontFamily',
  'headerSubmenuFontSize',
  'headerSubmenuFontWeight',
  'headerSubmenuLineHeight',
  'headerSubmenuTextTransform',
  'headerSubmenuWidth',
  'headerBreadcrumbHeight',
  'headerBreadcrumbFontSize',
] as const;

export function extractStylingSiteConfig(siteConfig: SiteConfig): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of STYLING_SITE_CONFIG_KEYS) {
    const value = siteConfig[key as keyof SiteConfig];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export function applyStylingSiteConfig(
  siteConfig: SiteConfig,
  stylingConfig: Record<string, unknown>
): SiteConfig {
  const merged = { ...siteConfig, ...stylingConfig } as SiteConfig;
  if (stylingConfig.headerLogoText && typeof stylingConfig.headerLogoText === 'object') {
    merged.headerLogoText = {
      ...(siteConfig.headerLogoText || { en: '' }),
      ...(stylingConfig.headerLogoText as Record<string, string>),
    };
  }
  return merged;
}

export function getDefaultStylingSiteConfig(): Record<string, unknown> {
  return {
    headerWidth: 'full',
    navAlignment: 'left',
    headerLogoTextSpacing: '0.5rem',
    headerLogoTextAlignment: 'centre',
    headerTopAlignment: 'left',
    headerMenuTextTransform: 'uppercase',
    headerSubmenuTextTransform: 'none',
  };
}

export function getDefaultThemeTemplate(defaultTheme: ThemeConfig, title = 'Default Theme'): ThemeTemplate {
  const stylingConfig = getDefaultStylingSiteConfig();
  const themeConfig = applyPageWidthToTheme(
    { headerWidth: 'full' },
    { ...defaultTheme }
  );
  return {
    id: DEFAULT_THEME_TEMPLATE_ID,
    title,
    themeConfig,
    stylingConfig,
    status: 'Published',
  };
}

/** Default template first, then custom templates (newest modified first). */
export function orderThemeTemplatesWithDefaultFirst(
  customTemplates: ThemeTemplate[],
  defaultTheme: ThemeConfig,
  defaultTitle = 'Default Theme'
): ThemeTemplate[] {
  const defaultTemplate = getDefaultThemeTemplate(defaultTheme, defaultTitle);
  const custom = customTemplates
    .filter(tmpl => tmpl.id !== DEFAULT_THEME_TEMPLATE_ID)
    .sort((a, b) => {
      const aTime = a.modifiedDate ? new Date(a.modifiedDate).getTime() : 0;
      const bTime = b.modifiedDate ? new Date(b.modifiedDate).getTime() : 0;
      return bTime - aTime;
    });
  return [defaultTemplate, ...custom];
}

export function isDefaultThemeTemplate(template: ThemeTemplate): boolean {
  return template.id === DEFAULT_THEME_TEMPLATE_ID;
}

export function buildThemeTemplateDraft(
  siteConfig: SiteConfig,
  themeConfig: ThemeConfig,
  title: string,
  status: 'Draft' | 'Published' = 'Draft'
): Omit<ThemeTemplate, 'id'> {
  return {
    title,
    themeConfig: applyPageWidthToTheme(siteConfig, { ...themeConfig }),
    stylingConfig: extractStylingSiteConfig(siteConfig),
    status,
  };
}
