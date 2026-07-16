import { LanguageCode } from '../types';

export const ALL_AVAILABLE_LANGUAGES: LanguageCode[] = ['en', 'de', 'fr', 'es'];
export const OPTIONAL_SITE_LANGUAGES: LanguageCode[] = ['de', 'fr', 'es'];

/** Optional languages that can be turned on in Site Languages Configuration (fr/es disabled for now). */
export const SELECTABLE_OPTIONAL_SITE_LANGUAGES: LanguageCode[] = ['de'];

export function isOptionalLanguageSelectable(lang: LanguageCode): boolean {
  return SELECTABLE_OPTIONAL_SITE_LANGUAGES.includes(lang);
}

export const LANGUAGE_DISPLAY_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
};

/** Ensures English is always included and order stays stable. */
export function normalizeSiteLanguages(languages?: LanguageCode[] | null): LanguageCode[] {
  const selected = new Set<LanguageCode>(['en']);
  if (Array.isArray(languages)) {
    for (const lang of languages) {
      if (lang === 'en' || (ALL_AVAILABLE_LANGUAGES.includes(lang) && isOptionalLanguageSelectable(lang))) {
        selected.add(lang);
      }
    }
  }
  return ALL_AVAILABLE_LANGUAGES.filter((lang) => selected.has(lang));
}

export function getEnabledSiteLanguages(siteConfig: { languages?: LanguageCode[] }): LanguageCode[] {
  return normalizeSiteLanguages(siteConfig?.languages);
}

export function shouldShowLanguageSelector(languages: LanguageCode[]): boolean {
  return languages.length > 1;
}

export function getOptionalEnabledLanguages(siteConfig: { languages?: LanguageCode[] }): LanguageCode[] {
  return getEnabledSiteLanguages(siteConfig).filter((lang) => lang !== 'en');
}

/** First configured optional language for item editors, or null when English-only. */
export function getPrimaryTranslationTarget(siteConfig: { languages?: LanguageCode[] }): LanguageCode | null {
  const optional = getOptionalEnabledLanguages(siteConfig);
  return optional.length > 0 ? optional[0] : null;
}

export function hasOptionalTranslationLanguages(siteConfig: { languages?: LanguageCode[] }): boolean {
  return getOptionalEnabledLanguages(siteConfig).length > 0;
}

export function toggleOptionalLanguage(
  current: LanguageCode[] | undefined,
  lang: LanguageCode,
  checked: boolean
): LanguageCode[] {
  const normalized = normalizeSiteLanguages(current);
  if (lang === 'en' || !isOptionalLanguageSelectable(lang)) return normalized;

  const optionalSet = new Set(normalized.filter((l) => l !== 'en' && isOptionalLanguageSelectable(l)));
  if (checked) {
    optionalSet.add(lang);
  } else {
    optionalSet.delete(lang);
  }

  return ['en', ...SELECTABLE_OPTIONAL_SITE_LANGUAGES.filter((l) => optionalSet.has(l))];
}

export function isLanguageEnabled(languages: LanguageCode[] | undefined, lang: LanguageCode): boolean {
  return normalizeSiteLanguages(languages).includes(lang);
}
