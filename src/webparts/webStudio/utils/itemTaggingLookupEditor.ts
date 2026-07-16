import { Container, LanguageCode, Page } from '../types';
import {
    TaggableListName,
    containerTagsContentList,
    getContainerIdsForItem,
} from './containerLookupSync';
import { getPageIdsForItem } from './pageLookupSync';

const normalizeId = (value: unknown): string => String(value);

export interface ContainerLookupOption {
    id: string;
    title: string;
    pageId: string;
    pageTitle: string;
}

export interface PageLookupOption {
    id: string;
    title: string;
}

export interface PageRemovalBlocker {
    id: string;
    title: string;
    pageTitle: string;
}

export interface PageRemovalValidation {
    canRemove: boolean;
    blockingContainers: PageRemovalBlocker[];
}

export const resolveContainerDisplayTitle = (
    container: Container,
    lang: LanguageCode = 'en'
): string => {
    const fromSettings = container.settings?.containerTitle;
    if (typeof fromSettings === 'string' && fromSettings.trim()) {
        return fromSettings.trim();
    }
    if (fromSettings && typeof fromSettings === 'object') {
        const localized = (fromSettings as Record<string, string>)[lang]
            || (fromSettings as Record<string, string>).en;
        if (localized?.trim()) return localized.trim();
    }

    const contentTitle = container.content?.containerTitle || container.content?.title;
    if (contentTitle && typeof contentTitle === 'object') {
        const localized = contentTitle[lang] || contentTitle.en;
        if (localized?.trim()) return localized.trim();
    }

    return container.title?.trim() || `[${container.type}]`;
};

export const resolvePageDisplayTitle = (page: Page, lang: LanguageCode = 'en'): string => {
    const title = page.title;
    if (typeof title === 'string') return title;
    if (title && typeof title === 'object') {
        return title[lang] || title.en || page.slug || 'Page';
    }
    return page.slug || 'Page';
};

export const listContainersForContentList = (
    pages: Page[],
    listName: TaggableListName,
    lang: LanguageCode = 'en'
): ContainerLookupOption[] => {
    const options: ContainerLookupOption[] = [];

    pages.forEach((page) => {
        const pageTitle = resolvePageDisplayTitle(page, lang);
        page.containers.forEach((container) => {
            if (!containerTagsContentList(container, listName)) return;
            options.push({
                id: normalizeId(container.id),
                title: resolveContainerDisplayTitle(container, lang),
                pageId: normalizeId(page.id),
                pageTitle,
            });
        });
    });

    return options.sort((a, b) => a.title.localeCompare(b.title));
};

export const listPagesForIds = (
    pages: Page[],
    pageIds: string[],
    lang: LanguageCode = 'en'
): PageLookupOption[] => {
    const uniqueIds = Array.from(new Set(pageIds.map(normalizeId).filter(Boolean)));
    return uniqueIds
        .map((pageId) => {
            const page = pages.find((entry) => normalizeId(entry.id) === pageId);
            if (!page) return null;
            return { id: pageId, title: resolvePageDisplayTitle(page, lang) };
        })
        .filter(Boolean) as PageLookupOption[];
};

const removeItemFromContainerTaggedItems = (
    pages: Page[],
    containerId: string,
    itemId: string
): Page[] => {
    const normalizedContainerId = normalizeId(containerId);
    const normalizedItemId = normalizeId(itemId);

    return pages.map((page) => ({
        ...page,
        containers: page.containers.map((container) => {
            if (normalizeId(container.id) !== normalizedContainerId) return container;

            const taggedItems: string[] = container.settings?.taggedItems || [];
            if (!taggedItems.some((taggedId) => normalizeId(taggedId) === normalizedItemId)) {
                return container;
            }

            return {
                ...container,
                settings: {
                    ...container.settings,
                    taggedItems: taggedItems.filter((taggedId) => normalizeId(taggedId) !== normalizedItemId),
                },
            };
        }),
    }));
};

const addItemToContainerTaggedItems = (
    pages: Page[],
    containerId: string,
    itemId: string
): Page[] => {
    const normalizedContainerId = normalizeId(containerId);
    const normalizedItemId = normalizeId(itemId);

    return pages.map((page) => ({
        ...page,
        containers: page.containers.map((container) => {
            if (normalizeId(container.id) !== normalizedContainerId) return container;

            const taggedItems: string[] = container.settings?.taggedItems || [];
            if (taggedItems.some((taggedId) => normalizeId(taggedId) === normalizedItemId)) {
                return container;
            }

            return {
                ...container,
                settings: {
                    ...container.settings,
                    taggedItems: [...taggedItems, normalizedItemId],
                },
            };
        }),
    }));
};

export interface ApplyContainerLookupResult {
    pages: Page[];
    containerIds: string[];
    pageIds: string[];
    changedContainers: Array<{ pageId: string; container: Container }>;
}

/** Apply container lookup selection by syncing container taggedItems for one content item. */
export const applyContainerLookupSelection = (
    itemId: string,
    listName: TaggableListName,
    nextContainerIds: string[],
    pages: Page[]
): ApplyContainerLookupResult => {
    const normalizedItemId = normalizeId(itemId);
    const previousContainerIds = getContainerIdsForItem(normalizedItemId, pages, listName);
    const previousSet = new Set(previousContainerIds.map(normalizeId));
    const nextSet = new Set(nextContainerIds.map(normalizeId).filter(Boolean));

    let nextPages = pages;

    previousContainerIds
        .filter((containerId) => !nextSet.has(normalizeId(containerId)))
        .forEach((containerId) => {
            nextPages = removeItemFromContainerTaggedItems(nextPages, containerId, normalizedItemId);
        });

    nextContainerIds
        .map(normalizeId)
        .filter(Boolean)
        .filter((containerId) => !previousSet.has(containerId))
        .forEach((containerId) => {
            nextPages = addItemToContainerTaggedItems(nextPages, containerId, normalizedItemId);
        });

    const reconciledContainerIds = getContainerIdsForItem(normalizedItemId, nextPages, listName);
    const reconciledPageIds = getPageIdsForItem(normalizedItemId, nextPages, listName);

    const changedContainers: Array<{ pageId: string; container: Container }> = [];
    const changedContainerIds = new Set<string>([
        ...previousContainerIds.filter((id) => !nextSet.has(normalizeId(id))),
        ...nextContainerIds.map(normalizeId).filter((id) => id && !previousSet.has(id)),
    ]);

    changedContainerIds.forEach((containerId) => {
        const ownerPage = nextPages.find((page) =>
            page.containers.some((container) => normalizeId(container.id) === normalizeId(containerId))
        );
        const container = ownerPage?.containers.find((entry) => normalizeId(entry.id) === normalizeId(containerId));
        if (ownerPage && container) {
            changedContainers.push({ pageId: ownerPage.id, container });
        }
    });

    return {
        pages: nextPages,
        containerIds: reconciledContainerIds,
        pageIds: reconciledPageIds,
        changedContainers,
    };
};

/** Containers on a page where the item is still tagged (page removal impact). */
export const getPageRemovalImpact = (
    itemId: string,
    pageId: string,
    pages: Page[],
    listName: TaggableListName,
    lang: LanguageCode = 'en'
): PageRemovalValidation & { pageTitle: string } => {
    const normalizedItemId = normalizeId(itemId);
    const normalizedPageId = normalizeId(pageId);
    const page = pages.find((entry) => normalizeId(entry.id) === normalizedPageId);
    const blockingContainers: PageRemovalBlocker[] = [];

    page?.containers.forEach((container) => {
        if (!containerTagsContentList(container, listName)) return;
        const taggedItems: string[] = container.settings?.taggedItems || [];
        if (!taggedItems.some((taggedId) => normalizeId(taggedId) === normalizedItemId)) return;

        blockingContainers.push({
            id: normalizeId(container.id),
            title: resolveContainerDisplayTitle(container, lang),
            pageTitle: resolvePageDisplayTitle(page, lang),
        });
    });

    return {
        pageTitle: page ? resolvePageDisplayTitle(page, lang) : '',
        canRemove: true,
        blockingContainers,
    };
};

/** @deprecated Use getPageRemovalImpact — removal is allowed after user confirmation. */
export const validatePageRemoval = getPageRemovalImpact;

const removeItemFromPageContainers = (
    pages: Page[],
    pageId: string,
    itemId: string,
    listName: TaggableListName
): Page[] => {
    const normalizedPageId = normalizeId(pageId);
    const normalizedItemId = normalizeId(itemId);

    return pages.map((page) => {
        if (normalizeId(page.id) !== normalizedPageId) return page;

        return {
            ...page,
            containers: page.containers.map((container) => {
                if (!containerTagsContentList(container, listName)) return container;

                const taggedItems: string[] = container.settings?.taggedItems || [];
                if (!taggedItems.some((taggedId) => normalizeId(taggedId) === normalizedItemId)) {
                    return container;
                }

                return {
                    ...container,
                    settings: {
                        ...container.settings,
                        taggedItems: taggedItems.filter((taggedId) => normalizeId(taggedId) !== normalizedItemId),
                    },
                };
            }),
        };
    });
};

export interface ApplyPageLookupResult {
    pages: Page[];
    containerIds: string[];
    pageIds: string[];
    changedContainers: Array<{ pageId: string; container: Container }>;
}

/** Remove a page association and untag the item from all matching containers on that page. */
export const applyPageLookupRemoval = (
    itemId: string,
    listName: TaggableListName,
    pageId: string,
    pages: Page[]
): ApplyPageLookupResult => {
    const normalizedItemId = normalizeId(itemId);
    const normalizedPageId = normalizeId(pageId);
    const ownerPage = pages.find((entry) => normalizeId(entry.id) === normalizedPageId);

    const changedContainers: Array<{ pageId: string; container: Container }> = [];
    ownerPage?.containers.forEach((container) => {
        if (!containerTagsContentList(container, listName)) return;
        const taggedItems: string[] = container.settings?.taggedItems || [];
        if (taggedItems.some((taggedId) => normalizeId(taggedId) === normalizedItemId)) {
            changedContainers.push({ pageId: ownerPage.id, container });
        }
    });

    let nextPages = removeItemFromPageContainers(pages, normalizedPageId, normalizedItemId, listName);

    // Refresh changed container snapshots after mutation.
    const refreshedChanged = changedContainers
        .map(({ pageId: ownerId, container }) => {
            const page = nextPages.find((entry) => normalizeId(entry.id) === normalizeId(ownerId));
            const updated = page?.containers.find((entry) => normalizeId(entry.id) === normalizeId(container.id));
            return updated ? { pageId: ownerId, container: updated } : null;
        })
        .filter(Boolean) as Array<{ pageId: string; container: Container }>;

    return {
        pages: nextPages,
        containerIds: getContainerIdsForItem(normalizedItemId, nextPages, listName),
        pageIds: getPageIdsForItem(normalizedItemId, nextPages, listName),
        changedContainers: refreshedChanged,
    };
};

export const isPersistedSharePointItemId = (itemId: string | number | undefined): boolean => {
    if (itemId === undefined || itemId === null) return false;
    const numeric = Number(itemId);
    return !isNaN(numeric) && numeric > 0;
};
