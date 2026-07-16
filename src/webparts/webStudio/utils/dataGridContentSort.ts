import { LanguageCode } from '../types';
import { normalizeDataGridSource } from './cardReadMore';

export type DataGridSortKey = 'date' | 'title' | 'status' | 'sortOrder';
export type DataGridSortDirection = 'asc' | 'desc';

export interface DataGridSortConfig {
    key: DataGridSortKey;
    direction: DataGridSortDirection;
}

export interface DataGridSortOption {
    key: DataGridSortKey;
    label: string;
}

type TranslateFn = (key: string, lang: LanguageCode) => string;

const DATE_SOURCES = new Set(['News', 'Event', 'Document']);

/** News/Event items have no SortOrder field — only date/title/status apply. */
export const sourceSupportsItemSortOrder = (source: string): boolean => {
    const normalized = normalizeDataGridSource(source) || source;
    return normalized !== 'News' && normalized !== 'Event';
};

const getValidSortKeysForSource = (source: string): DataGridSortKey[] => {
    const normalized = normalizeDataGridSource(source) || source;
    const keys: DataGridSortKey[] = [];
    if (DATE_SOURCES.has(normalized)) keys.push('date');
    keys.push('title', 'status');
    if (sourceSupportsItemSortOrder(source)) keys.push('sortOrder');
    return keys;
};

export const normalizeSectionSortField = (source: string, sortField?: string): DataGridSortKey => {
    const defaultConfig = getDefaultDataGridSortConfig(source);
    const validKeys = getValidSortKeysForSource(source);
    const key = (sortField || defaultConfig.key) as DataGridSortKey;
    if (!validKeys.includes(key)) return defaultConfig.key;
    if (key === 'sortOrder' && !sourceSupportsItemSortOrder(source)) {
        return defaultConfig.key;
    }
    return key;
};

export const resolveContainerDataSource = (
    settings: Record<string, unknown> = {},
    containerType?: string
): string => {
    const explicit = settings.source ? String(settings.source) : '';
    if (explicit) return normalizeDataGridSource(explicit) || explicit;
    if (containerType === 'SLIDER') return 'ImageSlider';
    return 'News';
};

export const getDataGridSortOptions = (source: string, currentLanguage: LanguageCode, t: TranslateFn): DataGridSortOption[] => {
    const normalized = normalizeDataGridSource(source) || source;
    const options: DataGridSortOption[] = [];

    if (normalized === 'News') {
        options.push({ key: 'date', label: t('LABEL_PUBLISH_DATE', currentLanguage) });
    } else if (normalized === 'Event') {
        options.push({ key: 'date', label: t('LABEL_START_DATE', currentLanguage) });
    } else if (normalized === 'Document') {
        options.push({ key: 'date', label: t('LABEL_PUBLISHING_DATE', currentLanguage) });
    }

    options.push(
        { key: 'title', label: t('LABEL_TITLE', currentLanguage) },
        { key: 'status', label: t('LABEL_STATUS', currentLanguage) }
    );

    if (sourceSupportsItemSortOrder(source)) {
        options.push({ key: 'sortOrder', label: t('LABEL_SORT_ORDER', currentLanguage) });
    }

    return options;
};

export const getDefaultDataGridSortConfig = (source: string): DataGridSortConfig => {
    const normalized = normalizeDataGridSource(source) || source;
    if (DATE_SOURCES.has(normalized)) {
        return { key: 'date', direction: 'desc' };
    }
    return { key: 'sortOrder', direction: 'asc' };
};

const getItemDateValue = (source: string, item: Record<string, unknown>): string => {
    const normalized = normalizeDataGridSource(source) || source;
    if (normalized === 'News') return String(item.publishDate || '');
    if (normalized === 'Event') return String(item.startDate || '');
    if (normalized === 'Document') return String(item.date || '');
    return '';
};

const isMultilingualRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);

const pickLocalizedString = (record: Record<string, unknown>, lang: string): string => {
    const preferred = record[lang];
    if (typeof preferred === 'string' && preferred.trim()) return preferred.trim();
    const en = record.en;
    if (typeof en === 'string' && en.trim()) return en.trim();
    for (const value of Object.values(record)) {
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
};

const getItemTitleValue = (
    source: string,
    item: Record<string, unknown>,
    lang: string = 'en'
): string => {
    const normalized = normalizeDataGridSource(source) || source;
    if (normalized === 'Contact') {
        const fullName = item.fullName;
        if (typeof fullName === 'string' && fullName.trim()) return fullName.trim();
    }

    const rawTitle = item.title;
    if (typeof rawTitle === 'string' && rawTitle.trim()) return rawTitle.trim();
    if (isMultilingualRecord(rawTitle)) return pickLocalizedString(rawTitle, lang);

    const translations = item.translations as Record<string, unknown> | undefined;
    const langBucket = translations?.[lang];
    if (typeof langBucket === 'string' && langBucket.trim()) return langBucket.trim();
    if (isMultilingualRecord(langBucket) && typeof langBucket.title === 'string' && langBucket.title.trim()) {
        return langBucket.title.trim();
    }

    if (rawTitle != null && typeof rawTitle !== 'object') return String(rawTitle).trim();
    return '';
};

const parseDateMs = (value: string): number => {
    if (!value) return 0;
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : ms;
};

export const compareDataGridItems = (
    a: Record<string, unknown>,
    b: Record<string, unknown>,
    sortConfig: DataGridSortConfig,
    source: string,
    taggedIndexById?: Map<string, number>,
    lang: string = 'en'
): number => {
    const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;

    const resolveSortOrder = (item: Record<string, unknown>): number => {
        const id = String(item.id ?? '');
        if (taggedIndexById?.has(id)) {
            return taggedIndexById.get(id)!;
        }
        const raw = item.sortOrder ?? item.itemRank;
        const num = Number(raw);
        return Number.isFinite(num) ? num : 0;
    };

    let cmp = 0;
    switch (sortConfig.key) {
        case 'date': {
            const dateA = parseDateMs(getItemDateValue(source, a));
            const dateB = parseDateMs(getItemDateValue(source, b));
            cmp = dateA - dateB;
            break;
        }
        case 'title': {
            const titleA = getItemTitleValue(source, a, lang).toLocaleLowerCase();
            const titleB = getItemTitleValue(source, b, lang).toLocaleLowerCase();
            cmp = titleA.localeCompare(titleB);
            break;
        }
        case 'status': {
            const statusA = String(a.status || '').toLocaleLowerCase();
            const statusB = String(b.status || '').toLocaleLowerCase();
            cmp = statusA.localeCompare(statusB);
            break;
        }
        case 'sortOrder':
        default: {
            cmp = resolveSortOrder(a) - resolveSortOrder(b);
            break;
        }
    }

    if (cmp !== 0) return cmp * directionMultiplier;

    const tieA = getItemTitleValue(source, a, lang).toLocaleLowerCase();
    const tieB = getItemTitleValue(source, b, lang).toLocaleLowerCase();
    return tieA.localeCompare(tieB);
};

export const sortDataGridItems = (
    items: Record<string, unknown>[],
    sortConfig: DataGridSortConfig,
    source: string,
    taggedIds?: string[],
    lang: string = 'en'
): Record<string, unknown>[] => {
    const taggedIndexById = taggedIds?.length
        ? new Map(taggedIds.map((id, index) => [String(id), index]))
        : undefined;

    return [...items].sort((a, b) => compareDataGridItems(a, b, sortConfig, source, taggedIndexById, lang));
};

export type DataGridContentViewMode = 'grid' | 'list';

export const normalizeContentViewMode = (value?: string): DataGridContentViewMode =>
    String(value || '').toLowerCase() === 'list' ? 'list' : 'grid';

export const getSectionSortConfigFromSettings = (
    source: string,
    settings: { sortField?: string; sortDirection?: string }
): DataGridSortConfig => {
    const defaultConfig = getDefaultDataGridSortConfig(source);
    return {
        key: normalizeSectionSortField(source, settings.sortField),
        direction: (settings.sortDirection || defaultConfig.direction) as DataGridSortDirection,
    };
};

/** Ensure container settings always expose sort/view fields used by preview renderers. */
export const ensureContainerDisplaySortSettings = (
    settings: Record<string, unknown> = {},
    containerType?: string
): Record<string, unknown> => {
    const source = resolveContainerDataSource(settings, containerType);
    const defaultConfig = getDefaultDataGridSortConfig(source);
    const normalizedSortField = normalizeSectionSortField(source, settings.sortField as string | undefined);
    const normalizedViewMode = normalizeContentViewMode(settings.contentViewMode as string | undefined);
    return {
        ...settings,
        sortField: normalizedSortField,
        sortDirection: (settings.sortDirection as string) || defaultConfig.direction,
        contentViewMode: settings.contentViewMode ? normalizedViewMode : 'grid',
    };
};

/** Apply section Sort By settings to a display list (preview / public site). */
export const sortDataGridDisplayList = (
    list: { originalItem: Record<string, unknown> }[],
    source: string,
    sortConfig: DataGridSortConfig,
    orderTaggedIds?: string[],
    lang: string = 'en'
): { originalItem: Record<string, unknown> }[] => {
    if (sortConfig.key === 'sortOrder' && orderTaggedIds?.length && sourceSupportsItemSortOrder(source)) {
        return sortConfig.direction === 'desc' ? [...list].reverse() : list;
    }
    const taggedIndexById =
        sortConfig.key === 'sortOrder' && orderTaggedIds?.length
            ? new Map(orderTaggedIds.map((id, index) => [String(id), index]))
            : undefined;
    return [...list].sort((a, b) =>
        compareDataGridItems(a.originalItem, b.originalItem, sortConfig, source, taggedIndexById, lang)
    );
};

/** Sort tagged ImageSlider items using saved container display settings (sortField / sortDirection). */
export const sortTaggedSliderItems = <T,>(
    items: T[],
    taggedIds: Array<string | number>,
    settings: { sortField?: string; sortDirection?: string; source?: string } = {},
    lang: string = 'en'
): T[] => {
    if (!items.length) return items;
    const source = 'ImageSlider';
    const displaySettings = ensureContainerDisplaySortSettings(
        { ...settings, source: settings.source || source },
        'SLIDER'
    );
    const sortConfig = getSectionSortConfigFromSettings(source, displaySettings);
    const useTagOrder = sortConfig.key === 'sortOrder' && sourceSupportsItemSortOrder(source);
    return sortDataGridItems(
        items as Record<string, unknown>[],
        sortConfig,
        source,
        useTagOrder ? taggedIds.map(String) : undefined,
        lang
    ) as T[];
};

export const buildDataGridSectionItems = <T extends { id: string | number; originalItem: Record<string, unknown> }>(
    allItems: T[],
    taggedIds: string[],
    source: string,
    settings: {
        showAllWithoutTagging?: boolean;
        sortField?: string;
        sortDirection?: string;
        contentViewMode?: string;
        source?: string;
    },
    lang: string = 'en'
): T[] => {
    const normalizedSource = normalizeDataGridSource(source) || source;
    const displaySettings = ensureContainerDisplaySortSettings({
        ...settings,
        source: normalizedSource,
    });
    const sortConfig = getSectionSortConfigFromSettings(normalizedSource, displaySettings);

    if (displaySettings.showAllWithoutTagging) {
        return sortDataGridDisplayList(allItems, normalizedSource, sortConfig, undefined, lang) as T[];
    }

    const tagged = taggedIds
        .map((id) => allItems.find((item) => String(item.id) === String(id)))
        .filter(Boolean) as T[];

    const useTagOrder = sortConfig.key === 'sortOrder' && sourceSupportsItemSortOrder(normalizedSource);
    return sortDataGridDisplayList(tagged, normalizedSource, sortConfig, useTagOrder ? taggedIds : undefined, lang) as T[];
};

export type DataGridPreviewDisplayItem = {
    id: string | number;
    title: string;
    desc: string;
    img: string;
    type?: string;
    originalItem: Record<string, unknown>;
};

export interface DataGridPreviewStoreCollections {
    news: readonly any[];
    events: readonly any[];
    documents: readonly any[];
    pages: readonly any[];
    contacts: readonly any[];
    containerItems: readonly any[];
}

export interface DataGridPreviewTranslators {
    getItemTranslation: (item: any, lang: string, field: string | string[]) => string;
    getLocalizedText: (text: any, lang: string) => string;
    getGlobalDefaultImage: () => string;
}

export const mapStoreItemsForDataGridSource = (
    source: string,
    collections: DataGridPreviewStoreCollections,
    translators: DataGridPreviewTranslators,
    lang: string
): DataGridPreviewDisplayItem[] => {
    const { getItemTranslation, getLocalizedText, getGlobalDefaultImage } = translators;
    const normalized = normalizeDataGridSource(source) || source;

    if (normalized === 'News') {
        return collections.news.map((n) => ({
            id: n.id,
            title: getItemTranslation(n, lang, 'title'),
            desc: getItemTranslation(n, lang, 'description'),
            img: n.imageUrl || '',
            originalItem: n,
        }));
    }
    if (normalized === 'Event') {
        return collections.events.map((e) => ({
            id: e.id,
            title: getItemTranslation(e, lang, 'title'),
            desc: getItemTranslation(e, lang, 'description'),
            img: e.imageUrl || '',
            originalItem: e,
        }));
    }
    if (normalized === 'Document') {
        return collections.documents.map((d) => ({
            id: d.id,
            title: getItemTranslation(d, lang, 'title'),
            desc: getItemTranslation(d, lang, 'description'),
            img: d.imageUrl || '',
            type: d.type,
            originalItem: d,
        }));
    }
    if (normalized === 'Smart Pages' || normalized === 'SmartPages') {
        return collections.pages.map((p) => ({
            id: p.id,
            title: getLocalizedText(p.title, lang),
            desc: p.description || '',
            img: p.imageUrl || '',
            originalItem: p,
        }));
    }
    if (normalized === 'Contacts' || normalized === 'Contact') {
        return collections.contacts.map((c) => ({
            id: c.id,
            title: getItemTranslation(c, lang, 'fullName'),
            desc: getItemTranslation(c, lang, 'description') || '',
            img: c.imageUrl || getGlobalDefaultImage(),
            originalItem: c,
        }));
    }
    if (normalized === 'Container Items') {
        return collections.containerItems.map((item) => ({
            id: item.id,
            title: getItemTranslation(item, lang, 'title'),
            desc: getItemTranslation(item, lang, 'description'),
            img: item.imageUrl || '',
            originalItem: item,
        }));
    }
    return [];
};

export const buildDataGridPreviewItemsFromStore = (
    settings: Record<string, unknown>,
    collections: DataGridPreviewStoreCollections,
    translators: DataGridPreviewTranslators,
    lang: string
): DataGridPreviewDisplayItem[] => {
    const source = String(settings.source || 'News');
    const taggedIds = Array.isArray(settings.taggedItems) ? (settings.taggedItems as string[]) : [];
    const allItems = mapStoreItemsForDataGridSource(source, collections, translators, lang);
    return buildDataGridSectionItems(allItems, taggedIds, source, settings, lang);
};
