import {
    ContactItem,
    Container,
    ContainerItem,
    DocumentItem,
    EventItem,
    LanguageCode,
    MultilingualText,
    NewsItem,
    Page,
    SiteConfig,
    SliderItem,
} from '../types';
import { normalizeImageUrlKey } from './managedImageEditor';

export interface ImageUsageTarget {
    url?: string;
    name?: string;
    id?: number | string;
}

export interface ImageUsageReference {
    id: string;
    pageLabel: string;
    sectionLabel: string;
    itemLabel: string;
    itemTypeKey: string;
    usageRoleKey: string;
}

export interface ImageUsageScanState {
    pages: Page[];
    news: NewsItem[];
    events: EventItem[];
    documents: DocumentItem[];
    containerItems: ContainerItem[];
    contacts: ContactItem[];
    sliderItems: SliderItem[];
    siteConfig: SiteConfig;
}

const matchesImageReference = (
    target: ImageUsageTarget,
    candidateUrl?: string | null,
    candidateName?: string | null
): boolean => {
    const url = (candidateUrl || '').trim();
    const name = (candidateName || '').trim();
    if (!url && !name) return false;

    const targetUrl = (target.url || '').trim();
    const targetName = (target.name || '').trim().toLowerCase();

    if (url && targetUrl) {
        if (normalizeImageUrlKey(url) === normalizeImageUrlKey(targetUrl)) {
            return true;
        }
    }

    if (targetName) {
        if (name && name.toLowerCase() === targetName) {
            return true;
        }
        if (url) {
            const fileFromUrl = url.split('/').pop()?.split('?')[0]?.toLowerCase() || '';
            if (fileFromUrl && fileFromUrl === targetName) {
                return true;
            }
        }
    }

    return false;
};

const getLocalizedText = (text: MultilingualText | string | undefined, lang: LanguageCode): string => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[lang] || text.en || '';
};

const getPageLabel = (page: Page, lang: LanguageCode): string =>
    getLocalizedText(page.title, lang) || page.slug || 'Page';

const getContainerLabel = (container: Container, lang: LanguageCode): string => {
    if (container.title) return container.title;
    const contentTitle = container.content?.title;
    if (contentTitle) {
        const localized = getLocalizedText(contentTitle as MultilingualText | string, lang);
        if (localized) return localized;
    }
    return container.settings?.containerTitle || container.settings?.title || container.type;
};

const getItemTitle = (item: Record<string, unknown>, lang: LanguageCode, titleKey = 'title'): string => {
    const translations = item.translations as Record<string, Record<string, string>> | undefined;
    const translated = translations?.[lang]?.[titleKey] || translations?.en?.[titleKey];
    if (translated) return translated;
    const raw = item[titleKey];
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (raw && typeof raw === 'object') {
        return getLocalizedText(raw as MultilingualText, lang);
    }
    return String(item.id || 'Item');
};

type SourceListEntry = {
    source: string;
    itemTypeKey: string;
    titleKey?: string;
    items: Array<Record<string, unknown>>;
};

const resolveSourceLists = (state: ImageUsageScanState): SourceListEntry[] => [
    { source: 'News', itemTypeKey: 'USAGE_TYPE_NEWS', items: state.news as unknown as Array<Record<string, unknown>> },
    { source: 'Event', itemTypeKey: 'USAGE_TYPE_EVENTS', items: state.events as unknown as Array<Record<string, unknown>> },
    { source: 'Document', itemTypeKey: 'USAGE_TYPE_DOCUMENTS', items: state.documents as unknown as Array<Record<string, unknown>> },
    { source: 'Container Items', itemTypeKey: 'USAGE_TYPE_CONTAINER_ITEMS', items: state.containerItems as unknown as Array<Record<string, unknown>> },
    { source: 'Contact', itemTypeKey: 'USAGE_TYPE_CONTACTS', titleKey: 'fullName', items: state.contacts as unknown as Array<Record<string, unknown>> },
    { source: 'ImageSlider', itemTypeKey: 'USAGE_TYPE_SLIDER_ITEMS', items: state.sliderItems as unknown as Array<Record<string, unknown>> },
    { source: 'Smart Pages', itemTypeKey: 'USAGE_TYPE_SMART_PAGES', items: state.pages as unknown as Array<Record<string, unknown>> },
];

const resolveSourceItems = (source: string, state: ImageUsageScanState): Array<Record<string, unknown>> => {
    const normalized = source === 'SmartPages' ? 'Smart Pages' : source;
    const match = resolveSourceLists(state).find((entry) => entry.source === normalized);
    return match?.items || [];
};

export const findImageUsages = (
    target: ImageUsageTarget,
    state: ImageUsageScanState,
    lang: LanguageCode
): ImageUsageReference[] => {
    const usages: ImageUsageReference[] = [];
    const seen = new Set<string>();

    const addUsage = (entry: Omit<ImageUsageReference, 'id'>) => {
        const key = `${entry.pageLabel}|${entry.sectionLabel}|${entry.itemLabel}|${entry.itemTypeKey}|${entry.usageRoleKey}`;
        if (seen.has(key)) return;
        seen.add(key);
        usages.push({ ...entry, id: key });
    };

    const checkAndAddItem = (
        item: Record<string, unknown>,
        itemTypeKey: string,
        titleKey: string,
        pageLabel: string,
        sectionLabel: string,
        usageRoleKey: string
    ) => {
        const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl : undefined;
        const imageName = typeof item.imageName === 'string' ? item.imageName : undefined;
        if (!matchesImageReference(target, imageUrl, imageName)) return;
        addUsage({
            pageLabel,
            sectionLabel,
            itemLabel: getItemTitle(item, lang, titleKey),
            itemTypeKey,
            usageRoleKey,
        });
    };

    // Site-level images
    if (matchesImageReference(target, state.siteConfig.logo?.url)) {
        addUsage({
            pageLabel: 'USAGE_LABEL_SITE',
            sectionLabel: 'USAGE_LABEL_HEADER',
            itemLabel: 'USAGE_LABEL_SITE_LOGO',
            itemTypeKey: 'USAGE_TYPE_SITE',
            usageRoleKey: 'USAGE_ROLE_LOGO',
        });
    }

    if (matchesImageReference(target, state.siteConfig.footer?.logo)) {
        addUsage({
            pageLabel: 'USAGE_LABEL_SITE',
            sectionLabel: 'USAGE_LABEL_FOOTER',
            itemLabel: 'USAGE_LABEL_FOOTER_LOGO',
            itemTypeKey: 'USAGE_TYPE_SITE',
            usageRoleKey: 'USAGE_ROLE_FOOTER_LOGO',
        });
    }

    // Page thumbnails
    for (const page of state.pages) {
        if (matchesImageReference(target, page.imageUrl, page.imageName)) {
            addUsage({
                pageLabel: getPageLabel(page, lang),
                sectionLabel: 'USAGE_LABEL_PAGE_INFO',
                itemLabel: getPageLabel(page, lang),
                itemTypeKey: 'USAGE_TYPE_SMART_PAGES',
                usageRoleKey: 'USAGE_ROLE_PAGE_IMAGE',
            });
        }
    }

    // Container / section level images and tagged items
    for (const page of state.pages) {
        const pageLabel = getPageLabel(page, lang);
        for (const container of page.containers || []) {
            const sectionLabel = getContainerLabel(container, lang);
            const settings = container.settings || {};

            const bgImage = settings.bgImage || settings.backgroundImage;
            if (matchesImageReference(target, typeof bgImage === 'string' ? bgImage : undefined)) {
                addUsage({
                    pageLabel,
                    sectionLabel,
                    itemLabel: sectionLabel,
                    itemTypeKey: 'USAGE_TYPE_SECTION',
                    usageRoleKey: 'USAGE_ROLE_SECTION_BACKGROUND',
                });
            }

            const slides = Array.isArray(settings.slides) ? settings.slides : [];
            slides.forEach((slide: Record<string, unknown>, index: number) => {
                const slideImage = (slide.image || slide.img) as string | undefined;
                if (!matchesImageReference(target, slideImage)) return;
                const slideTitle =
                    (typeof slide.title === 'string' && slide.title) ||
                    `Slide ${index + 1}`;
                addUsage({
                    pageLabel,
                    sectionLabel,
                    itemLabel: slideTitle,
                    itemTypeKey: 'USAGE_TYPE_SECTION',
                    usageRoleKey: 'USAGE_ROLE_SLIDE_IMAGE',
                });
            });

            const source = typeof settings.source === 'string' ? settings.source : '';
            const taggedIds: string[] = Array.isArray(settings.taggedItems)
                ? settings.taggedItems.map(String)
                : [];
            if (!taggedIds.length || !source) continue;

            const sourceItems = resolveSourceItems(source, state);
            const sourceEntry = resolveSourceLists(state).find(
                (entry) => entry.source === (source === 'SmartPages' ? 'Smart Pages' : source)
            );
            const titleKey = sourceEntry?.titleKey || 'title';

            for (const taggedId of taggedIds) {
                const item = sourceItems.find((entry) => String(entry.id) === taggedId);
                if (!item) continue;
                checkAndAddItem(
                    item,
                    sourceEntry?.itemTypeKey || 'USAGE_TYPE_ITEM',
                    titleKey,
                    pageLabel,
                    sectionLabel,
                    'USAGE_ROLE_TAGGED_ITEM'
                );
            }
        }
    }

    // Standalone content libraries (items not already shown via a tagged section)
    for (const { itemTypeKey, titleKey = 'title', items } of resolveSourceLists(state)) {
        for (const item of items) {
            const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl : undefined;
            const imageName = typeof item.imageName === 'string' ? item.imageName : undefined;
            if (!matchesImageReference(target, imageUrl, imageName)) continue;

            const itemLabel = getItemTitle(item, lang, titleKey);
            const alreadyInSection = usages.some(
                (usage) =>
                    usage.itemLabel === itemLabel &&
                    usage.itemTypeKey === itemTypeKey &&
                    usage.usageRoleKey === 'USAGE_ROLE_TAGGED_ITEM'
            );
            if (alreadyInSection) continue;

            addUsage({
                pageLabel: 'USAGE_LABEL_CONTENT_LIBRARY',
                sectionLabel: itemTypeKey,
                itemLabel,
                itemTypeKey,
                usageRoleKey: 'USAGE_ROLE_ITEM_IMAGE',
            });
        }
    }

    return usages.sort((a, b) => {
        const pageCompare = a.pageLabel.localeCompare(b.pageLabel);
        if (pageCompare !== 0) return pageCompare;
        const sectionCompare = a.sectionLabel.localeCompare(b.sectionLabel);
        if (sectionCompare !== 0) return sectionCompare;
        return a.itemLabel.localeCompare(b.itemLabel);
    });
};
