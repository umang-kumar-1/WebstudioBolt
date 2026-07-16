import { Container, ContainerType, Page } from '../types';
import { normalizeDataGridSource } from './cardReadMore';

/** SharePoint list titles that support the Container multi-lookup column. */
export type TaggableListName =
    | 'News'
    | 'Events'
    | 'Documents'
    | 'SmartPages'
    | 'ContainerItems'
    | 'Contacts'
    | 'ImageSlider';

/** Lists that receive the Container multi-lookup column during provisioning. */
export const LISTS_WITH_CONTAINER_LOOKUP = new Set<TaggableListName>([
    'News',
    'Events',
    'Documents',
    'SmartPages',
    'ContainerItems',
    'Contacts',
    'ImageSlider',
]);

export const CONTAINER_LOOKUP_FIELD = 'Container';
export const CONTAINER_LOOKUP_ID_FIELD = 'ContainerId';

const SOURCE_TO_LIST: Record<string, TaggableListName> = {
    News: 'News',
    Event: 'Events',
    Document: 'Documents',
    'Container Items': 'ContainerItems',
    Contact: 'Contacts',
    Contacts: 'Contacts',
    ImageSlider: 'ImageSlider',
    'Smart Pages': 'SmartPages',
    SmartPages: 'SmartPages',
};

export interface TaggableContentItem {
    id: string;
    listName: TaggableListName;
    containerIds: string[];
    pageIds?: string[];
    /** True when the SharePoint item exposes the Container lookup field (even if empty). */
    hasContainerLookupField?: boolean;
    /** True when the SharePoint item exposes the Page lookup field (even if empty). */
    hasPageLookupField?: boolean;
}

const normalizeId = (value: unknown): string => String(value);

const sameIdSet = (left: string[], right: string[]): boolean => {
    const a = Array.from(new Set(left.map(normalizeId))).sort();
    const b = Array.from(new Set(right.map(normalizeId))).sort();
    return a.length === b.length && a.every((id, index) => id === b[index]);
};

/** Parse Container lookup IDs from a SharePoint list item payload. */
export const parseContainerLookupIds = (spItem: any): string[] => {
    if (!spItem) return [];

    const fromIdArray = spItem[CONTAINER_LOOKUP_ID_FIELD];
    if (Array.isArray(fromIdArray)) {
        return fromIdArray.map(normalizeId).filter(Boolean);
    }

    const expanded = spItem[CONTAINER_LOOKUP_FIELD];
    if (Array.isArray(expanded)) {
        return expanded.map((entry: any) => normalizeId(entry?.Id)).filter(Boolean);
    }

    if (expanded?.Id) {
        return [normalizeId(expanded.Id)];
    }

    return [];
};

/** Whether SharePoint returned the Container lookup field on this list item. */
export const hasContainerLookupOnItem = (spItem: any): boolean => {
    if (!spItem) return false;
    return (
        Object.prototype.hasOwnProperty.call(spItem, CONTAINER_LOOKUP_ID_FIELD) ||
        Object.prototype.hasOwnProperty.call(spItem, CONTAINER_LOOKUP_FIELD)
    );
};

export const toTaggableContentItem = (spItem: any, listName: TaggableListName): TaggableContentItem => ({
    id: normalizeId(spItem?.Id),
    listName,
    containerIds: parseContainerLookupIds(spItem),
    hasContainerLookupField: LISTS_WITH_CONTAINER_LOOKUP.has(listName) || hasContainerLookupOnItem(spItem),
});

/** Which content list a container tags, based on its settings.source (or type). */
export const resolveContainerSourceList = (
    container: Pick<Container, 'type' | 'settings'>
): TaggableListName | undefined => {
    const rawSource = container.settings?.source;
    const fromSettings = resolveListNameForSource(rawSource);
    if (fromSettings) return fromSettings;

    const normalizedSource = normalizeDataGridSource(rawSource);
    if (normalizedSource) {
        const fromNormalized = resolveListNameForSource(normalizedSource);
        if (fromNormalized) return fromNormalized;
    }

    if (container.type === ContainerType.SLIDER) {
        return 'ImageSlider';
    }

    return undefined;
};

export const containerTagsContentList = (
    container: Pick<Container, 'type' | 'settings'>,
    listName: TaggableListName
): boolean => {
    const containerList = resolveContainerSourceList(container);
    return containerList === listName;
};
export const buildContainerLookupPayload = (containerIds: Array<string | number>): Record<string, number[]> => {
    const uniqueIds = Array.from(new Set(
        containerIds
            .map((id) => Number(id))
            .filter((id) => !isNaN(id) && id > 0)
    ));

    // PnP / SharePoint REST expects a plain array for multi-lookup Id fields,
    // not the legacy { results: [...] } wrapper used by odata=verbose clients.
    return {
        [CONTAINER_LOOKUP_ID_FIELD]: uniqueIds,
    };
};

export const resolveListNameForSource = (source?: string): TaggableListName | undefined => {
    if (!source) return undefined;
    return SOURCE_TO_LIST[source];
};

/** All container IDs that currently tag the given content item (same list/source only). */
export const getContainerIdsForItem = (
    itemId: string,
    pages: Page[],
    listName?: TaggableListName
): string[] => {
    const normalizedItemId = normalizeId(itemId);
    const containerIds: string[] = [];

    pages.forEach((page) => {
        page.containers.forEach((container) => {
            if (listName && !containerTagsContentList(container, listName)) {
                return;
            }

            const taggedItems: string[] = container.settings?.taggedItems || [];
            if (taggedItems.some((taggedId) => normalizeId(taggedId) === normalizedItemId)) {
                containerIds.push(normalizeId(container.id));
            }
        });
    });

    return Array.from(new Set(containerIds));
};

const removeItemFromContainerTaggedItems = (pages: Page[], containerId: string, itemId: string): Page[] => {
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

const addItemToContainerTaggedItems = (pages: Page[], containerId: string, itemId: string): Page[] => {
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

export interface ReconcileContainerTaggingResult {
    pages: Page[];
    items: TaggableContentItem[];
    lookupUpdates: TaggableContentItem[];
    containersToPersist: Array<{ pageId: string; containerId: string }>;
}

/**
 * Reconcile container taggedItems with Container lookup values.
 * The lookup field is authoritative: removals in SharePoint propagate to container taggedItems.
 * Lookup additions in SharePoint propagate to container taggedItems.
 * Legacy items without a Container field yet are back-filled from container settings once.
 */
export const reconcileContainerTagging = (
    pages: Page[],
    items: TaggableContentItem[]
): ReconcileContainerTaggingResult => {
    let nextPages = pages;
    const nextItems = items.map((item) => ({ ...item, containerIds: [...item.containerIds] }));
    const lookupUpdates: TaggableContentItem[] = [];
    const containersToPersist: Array<{ pageId: string; containerId: string }> = [];
    const persistedContainers = new Set<string>();

    const markContainerPersist = (containerId: string) => {
        if (persistedContainers.has(containerId)) return;
        persistedContainers.add(containerId);
        const ownerPage = nextPages.find((page) =>
            page.containers.some((container) => normalizeId(container.id) === normalizeId(containerId))
        );
        if (ownerPage) {
            containersToPersist.push({
                pageId: ownerPage.id,
                containerId: normalizeId(containerId),
            });
        }
    };

    const removeItemFromAllContainers = (itemId: string, listName: TaggableListName) => {
        getContainerIdsForItem(itemId, nextPages, listName).forEach((containerId) => {
            nextPages = removeItemFromContainerTaggedItems(nextPages, containerId, itemId);
            markContainerPersist(containerId);
        });
    };

    nextItems.forEach((item, index) => {
        const fromContainers = getContainerIdsForItem(item.id, nextPages, item.listName);
        const fromLookup = [...item.containerIds];

        if (fromLookup.length === 0 && fromContainers.length > 0) {
            if (!item.hasContainerLookupField) {
                // First-time migration: container settings exist but lookup was never written.
                nextItems[index] = { ...item, containerIds: fromContainers };
                lookupUpdates.push({ ...item, containerIds: fromContainers });
                return;
            }

            // User cleared every Container ID in SharePoint — untag from all sections for this list.
            removeItemFromAllContainers(item.id, item.listName);
            nextItems[index] = { ...item, containerIds: [] };
            return;
        }

        if (sameIdSet(fromLookup, fromContainers)) {
            return;
        }

        fromContainers
            .filter((containerId) => !fromLookup.includes(normalizeId(containerId)))
            .forEach((containerId) => {
                nextPages = removeItemFromContainerTaggedItems(nextPages, containerId, item.id);
                markContainerPersist(containerId);
            });

        fromLookup
            .filter((containerId) => !fromContainers.includes(normalizeId(containerId)))
            .forEach((containerId) => {
                nextPages = addItemToContainerTaggedItems(nextPages, containerId, item.id);
                markContainerPersist(containerId);
            });

        const reconciledIds = getContainerIdsForItem(item.id, nextPages, item.listName);
        nextItems[index] = { ...item, containerIds: reconciledIds };

        if (!sameIdSet(reconciledIds, fromLookup)) {
            lookupUpdates.push({ ...item, containerIds: reconciledIds });
        }
    });

    return {
        pages: nextPages,
        items: nextItems,
        lookupUpdates,
        containersToPersist,
    };
};

export const collectAffectedItemIds = (previousTagged: string[] = [], nextTagged: string[] = []): string[] => (
    Array.from(new Set([...previousTagged, ...nextTagged].map(normalizeId)))
);

export const parsePersistedTaggedItems = (settingsJson?: string): string[] => {
    if (!settingsJson) return [];
    try {
        const parsed = JSON.parse(settingsJson);
        const taggedItems = parsed?.taggedItems;
        return Array.isArray(taggedItems) ? taggedItems.map(normalizeId) : [];
    } catch {
        return [];
    }
};

export const applyContainerIdsToContentItems = <T extends { id: string; containerIds?: string[] }>(
    items: T[],
    itemIds: Set<string>,
    pages: Page[],
    listName: TaggableListName
): T[] => (
    items.map((item) => (
        itemIds.has(normalizeId(item.id))
            ? { ...item, containerIds: getContainerIdsForItem(item.id, pages, listName) }
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

export interface SyncTaggingLookupsOptions {
    /** Content list for items tagged in this container (e.g. SmartPages for Smart Pages source). */
    contentListName?: TaggableListName;
}

export const resolveListNameForItemId = (
    itemId: string,
    state: TaggableStoreSlice,
    preferredListName?: TaggableListName
): TaggableListName | undefined => {
    const normalizedItemId = normalizeId(itemId);

    if (preferredListName) {
        return preferredListName;
    }

    if (state.news.some((item) => normalizeId(item.id) === normalizedItemId)) return 'News';
    if (state.events.some((item) => normalizeId(item.id) === normalizedItemId)) return 'Events';
    if (state.documents.some((item) => normalizeId(item.id) === normalizedItemId)) return 'Documents';
    if (state.containerItems.some((item) => normalizeId(item.id) === normalizedItemId)) return 'ContainerItems';
    if (state.contacts.some((item) => normalizeId(item.id) === normalizedItemId)) return 'Contacts';
    if (state.sliderItems.some((item) => normalizeId(item.id) === normalizedItemId)) return 'ImageSlider';
    if (state.pages.some((item) => normalizeId(item.id) === normalizedItemId)) return 'SmartPages';
    return undefined;
};

export const syncLookupsForItemIds = async (
    state: TaggableStoreSlice,
    itemIds: string[],
    options?: SyncTaggingLookupsOptions
): Promise<void> => {
    const { updateItemContainerLookup } = await import('../services/SPService');
    const { syncPageLookupsForItemIds } = await import('./pageLookupSync');
    const uniqueIds = Array.from(new Set(itemIds.map(normalizeId)));
    const preferredListName = options?.contentListName;

    for (const itemId of uniqueIds) {
        const listName = resolveListNameForItemId(itemId, state, preferredListName);
        if (!listName || isNaN(Number(itemId))) continue;

        const containerIds = getContainerIdsForItem(itemId, state.pages, listName);
        await updateItemContainerLookup(listName, Number(itemId), containerIds);
    }

    await syncPageLookupsForItemIds(state, itemIds, options);
};

export const persistItemContainerLookups = async (updates: TaggableContentItem[]): Promise<void> => {
    const { updateItemContainerLookup } = await import('../services/SPService');

    for (const item of updates) {
        if (isNaN(Number(item.id))) continue;
        await updateItemContainerLookup(item.listName, Number(item.id), item.containerIds);
    }
};
