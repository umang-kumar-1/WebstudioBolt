import { Page } from '../types';
import {
    TaggableListName,
    TaggableContentItem,
    LISTS_WITH_CONTAINER_LOOKUP,
    getContainerIdsForItem,
    containerTagsContentList,
    SyncTaggingLookupsOptions,
} from './containerLookupSync';

/** All taggable lists use the same Page / PageId multi-lookup field names. */
export const LISTS_WITH_PAGE_LOOKUP = LISTS_WITH_CONTAINER_LOOKUP;

export const PAGE_LOOKUP_FIELD = 'Page';
export const PAGE_LOOKUP_ID_FIELD = 'PageId';

/** Legacy SmartPages column from earlier builds — read-only fallback during migration. */
const LEGACY_SMART_PAGE_SELF_LOOKUP_FIELD = 'RelatedPages';
const LEGACY_SMART_PAGE_SELF_LOOKUP_ID_FIELD = 'RelatedPagesId';

export const resolvePageLookupFields = (): { field: string; idField: string } => ({
    field: PAGE_LOOKUP_FIELD,
    idField: PAGE_LOOKUP_ID_FIELD,
});

const normalizeId = (value: unknown): string => String(value);

const sameIdSet = (left: string[], right: string[]): boolean => {
    const a = Array.from(new Set(left.map(normalizeId))).sort();
    const b = Array.from(new Set(right.map(normalizeId))).sort();
    return a.length === b.length && a.every((id, index) => id === b[index]);
};

const parseLookupIdsFromFields = (spItem: any, field: string, idField: string): string[] => {
    if (!spItem) return [];

    const fromIdArray = spItem[idField];
    if (Array.isArray(fromIdArray)) {
        return fromIdArray.map(normalizeId).filter(Boolean);
    }

    const expanded = spItem[field];
    if (Array.isArray(expanded)) {
        return expanded.map((entry: any) => normalizeId(entry?.Id)).filter(Boolean);
    }

    if (expanded?.Id) {
        return [normalizeId(expanded.Id)];
    }

    return [];
};

/** Parse Page multi-lookup IDs from a SharePoint list item payload. */
export const parsePageLookupIds = (spItem: any, listName?: TaggableListName): string[] => {
    const { field, idField } = resolvePageLookupFields();
    const fromPage = parseLookupIdsFromFields(spItem, field, idField);

    if (fromPage.length > 0 || listName !== 'SmartPages') {
        return fromPage;
    }

    // Migrate reads from legacy RelatedPages column if Page is not populated yet.
    return parseLookupIdsFromFields(
        spItem,
        LEGACY_SMART_PAGE_SELF_LOOKUP_FIELD,
        LEGACY_SMART_PAGE_SELF_LOOKUP_ID_FIELD
    );
};

/** Whether SharePoint returned the Page lookup field on this list item. */
export const hasPageLookupOnItem = (spItem: any, listName?: TaggableListName): boolean => {
    if (!spItem) return false;
    const { field, idField } = resolvePageLookupFields();
    if (
        Object.prototype.hasOwnProperty.call(spItem, idField) ||
        Object.prototype.hasOwnProperty.call(spItem, field)
    ) {
        return true;
    }

    if (listName === 'SmartPages') {
        return (
            Object.prototype.hasOwnProperty.call(spItem, LEGACY_SMART_PAGE_SELF_LOOKUP_ID_FIELD) ||
            Object.prototype.hasOwnProperty.call(spItem, LEGACY_SMART_PAGE_SELF_LOOKUP_FIELD)
        );
    }

    return false;
};

export const enrichTaggableItemWithPageLookup = (
    item: TaggableContentItem,
    spItem: any
): TaggableContentItem => ({
    ...item,
    pageIds: parsePageLookupIds(spItem, item.listName),
    hasPageLookupField: LISTS_WITH_PAGE_LOOKUP.has(item.listName) || hasPageLookupOnItem(spItem, item.listName),
});

/** Build the REST payload for updating the Page multi-lookup field. */
export const buildPageLookupPayload = (
    pageIds: Array<string | number>,
    _listName?: TaggableListName
): Record<string, number[]> => {
    const uniqueIds = Array.from(new Set(
        pageIds
            .map((id) => Number(id))
            .filter((id) => !isNaN(id) && id > 0)
    ));

    const { idField } = resolvePageLookupFields();

    return {
        [idField]: uniqueIds,
    };
};

/** All page IDs where the content item is tagged in any matching container. */
export const getPageIdsForItem = (
    itemId: string,
    pages: Page[],
    listName?: TaggableListName
): string[] => {
    const normalizedItemId = normalizeId(itemId);
    const pageIds: string[] = [];

    pages.forEach((page) => {
        const isTaggedOnPage = page.containers.some((container) => {
            if (listName && !containerTagsContentList(container, listName)) {
                return false;
            }

            const taggedItems: string[] = container.settings?.taggedItems || [];
            return taggedItems.some((taggedId) => normalizeId(taggedId) === normalizedItemId);
        });

        if (isTaggedOnPage) {
            pageIds.push(normalizeId(page.id));
        }
    });

    return Array.from(new Set(pageIds));
};

const removeItemFromPageTaggedItems = (
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

const addItemToPageTaggedItems = (
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
        };
    });
};

export interface ReconcilePageTaggingResult {
    pages: Page[];
    items: TaggableContentItem[];
    pageLookupUpdates: TaggableContentItem[];
    containerLookupUpdates: TaggableContentItem[];
    containersToPersist: Array<{ pageId: string; containerId: string }>;
}

/**
 * Reconcile page-level tagging with the Page multi-lookup field.
 * The lookup field is authoritative: removals in SharePoint untag from all containers on that page.
 * Lookup additions propagate to all matching containers on the page.
 */
export const reconcilePageTagging = (
    pages: Page[],
    items: TaggableContentItem[]
): ReconcilePageTaggingResult => {
    let nextPages = pages;
    const nextItems = items.map((item) => ({
        ...item,
        pageIds: [...(item.pageIds || [])],
        containerIds: [...item.containerIds],
    }));
    const pageLookupUpdates: TaggableContentItem[] = [];
    const containerLookupUpdates: TaggableContentItem[] = [];
    const containersToPersist: Array<{ pageId: string; containerId: string }> = [];
    const persistedContainers = new Set<string>();

    const markContainerPersist = (pageId: string, containerId: string) => {
        const key = `${normalizeId(pageId)}:${normalizeId(containerId)}`;
        if (persistedContainers.has(key)) return;
        persistedContainers.add(key);
        containersToPersist.push({
            pageId: normalizeId(pageId),
            containerId: normalizeId(containerId),
        });
    };

    const markAllContainersOnPage = (pageId: string, listName: TaggableListName) => {
        const page = nextPages.find((entry) => normalizeId(entry.id) === normalizeId(pageId));
        page?.containers.forEach((container) => {
            if (containerTagsContentList(container, listName)) {
                markContainerPersist(pageId, container.id);
            }
        });
    };

    const removeItemFromAllPages = (itemId: string, listName: TaggableListName) => {
        getPageIdsForItem(itemId, nextPages, listName).forEach((pageId) => {
            nextPages = removeItemFromPageTaggedItems(nextPages, pageId, itemId, listName);
            markAllContainersOnPage(pageId, listName);
        });
    };

    nextItems.forEach((item, index) => {
        const fromPages = getPageIdsForItem(item.id, nextPages, item.listName);
        const fromLookup = [...(item.pageIds || [])];

        if (fromLookup.length === 0 && fromPages.length > 0) {
            if (!item.hasPageLookupField) {
                nextItems[index] = { ...item, pageIds: fromPages };
                pageLookupUpdates.push({ ...item, pageIds: fromPages });
                return;
            }

            removeItemFromAllPages(item.id, item.listName);
            nextItems[index] = { ...item, pageIds: [] };
            return;
        }

        if (sameIdSet(fromLookup, fromPages)) {
            return;
        }

        fromPages
            .filter((pageId) => !fromLookup.includes(normalizeId(pageId)))
            .forEach((pageId) => {
                nextPages = removeItemFromPageTaggedItems(nextPages, pageId, item.id, item.listName);
                markAllContainersOnPage(pageId, item.listName);
            });

        fromLookup
            .filter((pageId) => !fromPages.includes(normalizeId(pageId)))
            .forEach((pageId) => {
                nextPages = addItemToPageTaggedItems(nextPages, pageId, item.id, item.listName);
                markAllContainersOnPage(pageId, item.listName);
            });

        const reconciledPageIds = getPageIdsForItem(item.id, nextPages, item.listName);
        const reconciledContainerIds = getContainerIdsForItem(item.id, nextPages, item.listName);
        nextItems[index] = {
            ...item,
            pageIds: reconciledPageIds,
            containerIds: reconciledContainerIds,
        };

        if (!sameIdSet(reconciledPageIds, fromLookup)) {
            pageLookupUpdates.push({ ...item, pageIds: reconciledPageIds });
        }

        if (!sameIdSet(reconciledContainerIds, item.containerIds)) {
            containerLookupUpdates.push({ ...item, containerIds: reconciledContainerIds });
        }
    });

    return {
        pages: nextPages,
        items: nextItems,
        pageLookupUpdates,
        containerLookupUpdates,
        containersToPersist,
    };
};

export const applyPageIdsToContentItems = <T extends { id: string; pageIds?: string[] }>(
    items: T[],
    itemIds: Set<string>,
    pages: Page[],
    listName: TaggableListName
): T[] => (
    items.map((item) => (
        itemIds.has(normalizeId(item.id))
            ? { ...item, pageIds: getPageIdsForItem(item.id, pages, listName) }
            : item
    ))
);

export interface TaggableStoreSlice {
    pages: Page[];
    news: Array<{ id: string }>;
    events: Array<{ id: string }>;
    documents: Array<{ id: string }>;
    containerItems: Array<{ id: string }>;
    contacts: Array<{ id: string }>;
    sliderItems: Array<{ id: string }>;
}

export const syncPageLookupsForItemIds = async (
    state: TaggableStoreSlice,
    itemIds: string[],
    options?: SyncTaggingLookupsOptions
): Promise<void> => {
    const { updateItemPageLookup } = await import('../services/SPService');
    const { resolveListNameForItemId } = await import('./containerLookupSync');
    const uniqueIds = Array.from(new Set(itemIds.map(normalizeId)));
    const preferredListName = options?.contentListName;

    for (const itemId of uniqueIds) {
        const listName = resolveListNameForItemId(itemId, state, preferredListName);
        if (!listName || isNaN(Number(itemId))) continue;

        const pageIds = getPageIdsForItem(itemId, state.pages, listName);
        await updateItemPageLookup(listName, Number(itemId), pageIds);
    }
};

export const persistItemPageLookups = async (updates: TaggableContentItem[]): Promise<void> => {
    const { updateItemPageLookup } = await import('../services/SPService');

    for (const item of updates) {
        if (isNaN(Number(item.id))) continue;
        await updateItemPageLookup(item.listName, Number(item.id), item.pageIds || []);
    }
};
