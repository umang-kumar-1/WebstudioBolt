import { Container, LanguageCode, MultilingualText } from '../types';

/** Canonical source language for original/base container copy. */
export const CONTENT_SOURCE_LANG: LanguageCode = 'en';

/** Default language for explicit translation-tab edits. */
export const TRANSLATION_TARGET_LANG: LanguageCode = 'de';

/** Build ContainerContent with only the base (English) value on create. */
export function baseMultilingualText(value: string): MultilingualText {
    return { en: value };
}

export function getExactLanguageText(value: unknown, language: LanguageCode): string {
    if (!value) return '';
    if (typeof value === 'string') return language === CONTENT_SOURCE_LANG ? value : '';
    const record = value as Record<string, string>;
    return record[language] || '';
}

/** Patch base language in content.* only (ContainerContent). */
export function patchBaseContentField(
    content: Container['content'],
    contentKey: string,
    value: string
): Container['content'] {
    return {
        ...content,
        [contentKey]: {
            ...((content as Record<string, MultilingualText>)?.[contentKey] || {}),
            [CONTENT_SOURCE_LANG]: value,
        },
    };
}

/** Patch one translation language in content.* only. */
export function patchTranslationContentField(
    content: Container['content'],
    contentKey: string,
    value: string,
    language: LanguageCode = TRANSLATION_TARGET_LANG
): Container['content'] {
    return {
        ...content,
        [contentKey]: {
            ...((content as Record<string, MultilingualText>)?.[contentKey] || {}),
            [language]: value,
        },
    };
}

/**
 * Base header edit: store EN in ContainerContent and mirror a plain string on settings
 * for legacy preview paths that still read settings.subheading / settings.description.
 */
export function applyBaseHeaderFieldUpdate(
    container: Container,
    contentKey: string,
    value: string,
    legacySettingKey?: string
): Container {
    const next: Container = {
        ...container,
        content: patchBaseContentField(container.content, contentKey, value),
    };
    if (legacySettingKey) {
        next.settings = { ...next.settings, [legacySettingKey]: value };
    }
    return next;
}

/** Translation-tab edit: only ContainerContent (+ optional per-lang settings mirror). */
export function applyTranslationHeaderFieldUpdate(
    container: Container,
    contentKey: string,
    value: string,
    legacySettingKey?: string,
    language: LanguageCode = TRANSLATION_TARGET_LANG
): Container {
    const next: Container = {
        ...container,
        content: patchTranslationContentField(container.content, contentKey, value, language),
    };
    if (legacySettingKey) {
        const current = (next.settings as Record<string, unknown>)[legacySettingKey];
        const merged =
            typeof current === 'object' && current !== null
                ? { ...(current as Record<string, string>), [language]: value }
                : {
                      [CONTENT_SOURCE_LANG]: String(current || ''),
                      [language]: value,
                  };
        next.settings = { ...next.settings, [legacySettingKey]: merged };
    }
    return next;
}

/** Contact-form style: base edit only touches EN on a settings multilingual field. */
export function applyBaseSettingsTextField(
    settings: Container['settings'],
    key: string,
    value: string
): Container['settings'] {
    const current = (settings as Record<string, unknown>)[key];
    const nextValue =
        typeof current === 'object' && current !== null
            ? { ...(current as Record<string, string>), [CONTENT_SOURCE_LANG]: value }
            : { [CONTENT_SOURCE_LANG]: value };
    return { ...settings, [key]: nextValue };
}

/** Contact-form style: translation tab only touches the target language. */
export function applyTranslationSettingsTextField(
    settings: Container['settings'],
    key: string,
    value: string,
    language: LanguageCode = TRANSLATION_TARGET_LANG
): Container['settings'] {
    const current = (settings as Record<string, unknown>)[key];
    const nextValue =
        typeof current === 'object' && current !== null
            ? { ...(current as Record<string, string>), [language]: value }
            : { [CONTENT_SOURCE_LANG]: '', [language]: value };
    return { ...settings, [key]: nextValue };
}

/** Stable container sort: primary by order, secondary by SharePoint item id. */
export function compareContainersByOrder(a: Pick<Container, 'order' | 'id'>, b: Pick<Container, 'order' | 'id'>): number {
    const orderDiff = (Number(a.order) || 0) - (Number(b.order) || 0);
    if (orderDiff !== 0) return orderDiff;
    return Number(a.id) - Number(b.id);
}

export function getNextContainerOrder(containers: Pick<Container, 'order'>[]): number {
    if (!containers.length) return 0;
    const maxOrder = Math.max(...containers.map((c) => Number(c.order) || 0));
    return maxOrder + 1;
}

export const BIND_PAGE_TITLE_DESCRIPTION_KEY = 'bindPageTitleDescription';

export function isContainerSectionBindPageEnabled(settings: Container['settings'] | undefined): boolean {
    return settings?.[BIND_PAGE_TITLE_DESCRIPTION_KEY] === true;
}

export function getPlainTextFromHtml(html: string): string {
    return (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
}

export function hasContainerSectionManualContent(title: string, body: string): boolean {
    return title.trim().length > 0 || getPlainTextFromHtml(body).length > 0;
}

export function hasContainerSectionContent(
    config: { title: string; body: string; bindPageTitleDescription?: boolean }
): boolean {
    return config.bindPageTitleDescription === true || hasContainerSectionManualContent(config.title, config.body);
}
