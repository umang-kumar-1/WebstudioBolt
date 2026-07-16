export type FontSource = 'system' | 'google' | 'custom';

export interface FontOption {
  name: string;
  cssValue: string;
  source: FontSource;
}

const SYSTEM_FONT_OPTIONS: FontOption[] = [
  { name: 'Arial', cssValue: "'Arial', sans-serif", source: 'system' },
  { name: 'Helvetica', cssValue: "'Helvetica', sans-serif", source: 'system' },
  { name: 'Verdana', cssValue: "'Verdana', sans-serif", source: 'system' },
  { name: 'Tahoma', cssValue: "'Tahoma', sans-serif", source: 'system' },
  { name: 'Trebuchet MS', cssValue: "'Trebuchet MS', sans-serif", source: 'system' },
  { name: 'Times New Roman', cssValue: "'Times New Roman', serif", source: 'system' },
  { name: 'Georgia', cssValue: "'Georgia', serif", source: 'system' },
  { name: 'Garamond', cssValue: "'Garamond', serif", source: 'system' },
  { name: 'Courier New', cssValue: "'Courier New', monospace", source: 'system' },
  { name: 'Segoe UI', cssValue: "'Segoe UI', sans-serif", source: 'system' },
];

const GOOGLE_FONT_OPTIONS: FontOption[] = [
  { name: 'Poppins', cssValue: "'Poppins', sans-serif", source: 'google' },
  { name: 'Lato', cssValue: "'Lato', sans-serif", source: 'google' },
  { name: 'Roboto', cssValue: "'Roboto', sans-serif", source: 'google' },
  { name: 'Open Sans', cssValue: "'Open Sans', sans-serif", source: 'google' },
  { name: 'Montserrat', cssValue: "'Montserrat', sans-serif", source: 'google' },
  { name: 'Inter', cssValue: "'Inter', sans-serif", source: 'google' },
  { name: 'Nunito', cssValue: "'Nunito', sans-serif", source: 'google' },
  { name: 'Merriweather', cssValue: "'Merriweather', serif", source: 'google' },
  { name: 'Playfair Display', cssValue: "'Playfair Display', serif", source: 'google' },
  { name: 'Raleway', cssValue: "'Raleway', sans-serif", source: 'google' },
  { name: 'Noto Sans', cssValue: "'Noto Sans', sans-serif", source: 'google' },
  { name: 'Noto Sans JP', cssValue: "'Noto Sans JP', sans-serif", source: 'google' },
  { name: 'Oswald', cssValue: "'Oswald', sans-serif", source: 'google' },
  { name: 'Rubik', cssValue: "'Rubik', sans-serif", source: 'google' },
  { name: 'Source Sans 3', cssValue: "'Source Sans 3', sans-serif", source: 'google' },
  { name: 'Ubuntu', cssValue: "'Ubuntu', sans-serif", source: 'google' },
  { name: 'Work Sans', cssValue: "'Work Sans', sans-serif", source: 'google' },
  { name: 'Fira Sans', cssValue: "'Fira Sans', sans-serif", source: 'google' },
  { name: 'PT Serif', cssValue: "'PT Serif', serif", source: 'google' },
  { name: 'Muli', cssValue: "'Mulish', sans-serif", source: 'google' },
];

const CUSTOM_FONT_OPTIONS: FontOption[] = [
  { name: 'PT Sans', cssValue: "'PT Sans', sans-serif", source: 'custom' },
  { name: 'GrueneType', cssValue: "'GrueneType', sans-serif", source: 'custom' },
  { name: 'Arvo', cssValue: "'Arvo', serif", source: 'custom' },
  { name: 'Arvo Gruen', cssValue: "'Arvo Gruen', serif", source: 'custom' },
];

export const FONT_OPTIONS: FontOption[] = [
  ...SYSTEM_FONT_OPTIONS,
  ...GOOGLE_FONT_OPTIONS,
  ...CUSTOM_FONT_OPTIONS,
];

export const GOOGLE_FONT_STYLESHEETS: Record<string, string> = {
  Poppins: 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap',
  Lato: 'https://fonts.googleapis.com/css2?family=Lato:wght@100;300;400;700;900&display=swap',
  Roboto: 'https://fonts.googleapis.com/css2?family=Roboto:wght@100;300;400;500;700;900&display=swap',
  'Open Sans': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700;800&display=swap',
  Montserrat: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@100;300;400;500;600;700;800;900&display=swap',
  Inter: 'https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap',
  Nunito: 'https://fonts.googleapis.com/css2?family=Nunito:wght@200;300;400;500;600;700;800;900&display=swap',
  Merriweather: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700;900&display=swap',
  'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&display=swap',
  Raleway: 'https://fonts.googleapis.com/css2?family=Raleway:wght@100;200;300;400;500;600;700;800;900&display=swap',
  'Noto Sans': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@100;300;400;500;700;900&display=swap',
  'Noto Sans JP': 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100;300;400;500;700;900&display=swap',
  Oswald: 'https://fonts.googleapis.com/css2?family=Oswald:wght@200;300;400;500;600;700&display=swap',
  Rubik: 'https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800;900&display=swap',
  'Source Sans 3': 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@200;300;400;500;600;700;800;900&display=swap',
  Ubuntu: 'https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap',
  'Work Sans': 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@100;200;300;400;500;600;700;800;900&display=swap',
  'Fira Sans': 'https://fonts.googleapis.com/css2?family=Fira+Sans:wght@100;200;300;400;500;600;700;800;900&display=swap',
  'PT Serif': 'https://fonts.googleapis.com/css2?family=PT+Serif:wght@400;700&display=swap',
  Mulish: 'https://fonts.googleapis.com/css2?family=Mulish:wght@200;300;400;500;600;700;800;900&display=swap',
};

export const CUSTOM_FONT_STYLESHEETS: string[] = [
  'https://netzbegruenung.github.io/webfonts/style.css',
];

export function extractPrimaryFontName(cssFamily: string | undefined): string {
  const raw = String(cssFamily || '').trim();
  if (!raw) return '';
  const first = raw.split(',')[0]?.trim() || '';
  return first.replace(/^['"]|['"]$/g, '');
}

export type WebsiteFontConfig = {
  themeConfig?: Record<string, string>;
  siteConfig?: {
    headerMenuFontFamily?: string;
    headerSubmenuFontFamily?: string;
  };
};

const WEBSITE_FONT_THEME_KEYS = [
  '--font-family-base',
  '--font-family-secondary',
  '--font-family-nav',
] as const;

/** CSS font-family values configured for the current website theme/header. */
export function getWebsiteFontCssValues(config: WebsiteFontConfig): string[] {
  const { themeConfig = {}, siteConfig = {} } = config;
  const rawValues = [
    ...WEBSITE_FONT_THEME_KEYS.map((key) => themeConfig[key]),
    siteConfig.headerMenuFontFamily,
    siteConfig.headerSubmenuFontFamily,
  ];

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of rawValues) {
    const cssValue = String(value || '').trim();
    if (!cssValue) continue;
    const key = extractPrimaryFontName(cssValue).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(cssValue);
  }
  return unique;
}

/** Font picker options limited to families already used on the website. */
export function getWebsiteFontOptions(config: WebsiteFontConfig): FontOption[] {
  const websiteCssValues = getWebsiteFontCssValues(config);
  const byName = new Map<string, FontOption>();

  for (const cssValue of websiteCssValues) {
    const primaryName = extractPrimaryFontName(cssValue);
    const catalogMatch = FONT_OPTIONS.find(
      (option) => option.name.toLowerCase() === primaryName.toLowerCase()
    );
    if (catalogMatch) {
      byName.set(primaryName.toLowerCase(), catalogMatch);
      continue;
    }
    byName.set(primaryName.toLowerCase(), {
      name: primaryName,
      cssValue,
      source: 'custom',
    });
  }

  return Array.from(byName.values());
}

export const DEFAULT_CARD_TITLE_FONT_FAMILY = 'var(--font-family-secondary, sans-serif)';

export function resolveCardTitleFontFamily(
  settings: { cardTitleFontFamily?: string } | undefined,
  themeConfig?: Record<string, string>
): string {
  const custom = String(settings?.cardTitleFontFamily || '').trim();
  if (custom) return custom;
  const headingFont = String(themeConfig?.['--font-family-secondary'] || '').trim();
  return headingFont || DEFAULT_CARD_TITLE_FONT_FAMILY;
}

export function buildCardTitleFontFamilyImportantCss(
  scopeSelector: string,
  fontFamily: string | undefined
): string {
  const value = String(fontFamily || '').trim();
  if (!value || !scopeSelector) return '';
  const targets = [
    '.ws-card-title-container',
    '.ws-card-title-container span',
    '.ws-card-title-container a',
    '.ws-card-title-container button',
    '.ws-smart-page-card-title',
  ];
  return targets
    .flatMap((target) => [
      `#preview-main-scroll ${scopeSelector} ${target}`,
      `${scopeSelector} ${target}`,
    ])
    .map((selector) => `${selector} { font-family: ${value} !important; }`)
    .join('\n');
}

export function buildCardTitleCustomCss(
  scopeSelector: string,
  style: any
): string {
  if (!scopeSelector || !style) return '';
  const rules: string[] = [];
  if (style.fontFamily) rules.push(`font-family: ${style.fontFamily} !important;`);
  if (style.fontSize) rules.push(`font-size: ${style.fontSize} !important;`);
  if (style.fontWeight != null && style.fontWeight !== '') rules.push(`font-weight: ${style.fontWeight} !important;`);
  if (style.lineHeight) rules.push(`line-height: ${style.lineHeight} !important;`);
  if (style.color) rules.push(`color: ${style.color} !important;`);
  if (style.textTransform) rules.push(`text-transform: ${style.textTransform} !important;`);

  if (rules.length === 0) return '';
  const cssBlock = rules.join('\n  ');

  const targets = [
    '.ws-card-title-container',
    '.ws-card-title-container span',
    '.ws-card-title-container a',
    '.ws-card-title-container button',
    '.ws-smart-page-card-title',
  ];

  const baseRules = targets
    .flatMap((target) => [
      `#preview-main-scroll ${scopeSelector} ${target}`,
      `${scopeSelector} ${target}`,
    ])
    .map((selector) => `${selector} {\n  ${cssBlock}\n}`)
    .join('\n');

  const hoverTargets = [
    '.ws-card-title-container a:hover',
    '.ws-card-title-container button:hover',
    '.ws-smart-page-card-title:hover',
  ];

  const hoverRules = hoverTargets
    .flatMap((target) => [
      `#preview-main-scroll ${scopeSelector} ${target}`,
      `${scopeSelector} ${target}`,
    ])
    .map((selector) => `${selector} {\n  color: var(--link-hover-color) !important;\n}`)
    .join('\n');

  return `${baseRules}\n${hoverRules}`;
}

