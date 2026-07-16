import { graphFetch, graphFetchAllPages, GraphError } from './graphFetch';
import { getSiteId, getListId } from './siteResolver';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SPItem = Record<string, any>;

interface GraphIdentitySet {
  user?: { id?: string; displayName?: string; email?: string };
}

interface GraphDriveItemFacet {
  id: string;
  name?: string;
  webUrl?: string;
  size?: number;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
}

interface GraphListItem {
  id: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  createdBy?: GraphIdentitySet;
  lastModifiedBy?: GraphIdentitySet;
  fields?: SPItem;
  driveItem?: GraphDriveItemFacet;
}

/**
 * Flattens a Microsoft Graph list item into the same shape the old PnP/SharePoint-REST
 * calls returned (numeric Id, fields spread at the top level, Author/Editor as {Id, Title}).
 * This lets all downstream UI code (store.ts, modals, etc.) keep working unmodified.
 * When the item belongs to a document/picture library, the expanded `driveItem` facet is
 * used to reproduce file-specific properties (FileLeafRef, FileRef, EncodedAbsUrl, File.Length,
 * FSObjType) that used to come from PnP's File/Folder OData expansions.
 */
const normalizeItem = (raw: GraphListItem): SPItem => {
  const fields = raw.fields || {};
  const drive = raw.driveItem;

  // Graph returns multi-lookup IDs as "{Field}LookupId" arrays; the UI expects REST-style "{Field}Id".
  const containerLookupIds = fields.ContainerLookupId ?? fields.ContainerId;
  const pageLookupIds = fields.PageLookupId ?? fields.PageId;

  return {
    ...fields,
    Id: Number(raw.id),
    ...(containerLookupIds !== undefined ? { ContainerId: containerLookupIds } : {}),
    ...(pageLookupIds !== undefined ? { PageId: pageLookupIds } : {}),
    Created: fields.Created || raw.createdDateTime,
    Modified: fields.Modified || raw.lastModifiedDateTime,
    Author: {
      Id: raw.createdBy?.user?.id,
      Title: raw.createdBy?.user?.displayName || '',
      Email: raw.createdBy?.user?.email || '',
    },
    Editor: {
      Id: raw.lastModifiedBy?.user?.id,
      Title: raw.lastModifiedBy?.user?.displayName || '',
      Email: raw.lastModifiedBy?.user?.email || '',
    },
    ...(drive
      ? {
          FileLeafRef: fields.FileLeafRef || drive.name,
          FileRef: fields.FileRef || drive.webUrl,
          FileDirRef: drive.webUrl ? drive.webUrl.slice(0, drive.webUrl.lastIndexOf('/')) : undefined,
          EncodedAbsUrl: fields.EncodedAbsUrl || drive.webUrl,
          File: { Length: drive.size || 0 },
          FSObjType: drive.folder ? 1 : 0,
          DriveItemId: drive.id,
        }
      : {}),
  };
};

// Small per-list cache used purely to resolve lookup-column titles (SharePoint Lookup
// fields only expose "{Field}LookupId" via Graph, not the looked-up item's Title).
const lookupTitleCache = new Map<string, Map<number, string>>();

// In-flight request de-duplication: several callers (e.g. one per page, resolved via
// Promise.all in store.ts's loadFromSharePoint) commonly ask for the *same* full list
// at the same moment. Without this, each caller fires its own identical paginated fetch,
// which bursts far more requests than Graph/SharePoint Online will tolerate and makes the
// whole app appear to hang. Coalescing concurrent calls into a single network round-trip
// keeps the exact same return value/shape while eliminating the duplicate traffic.
const inFlightListItems = new Map<string, Promise<SPItem[]>>();

export const invalidateListCache = (listTitle: string): void => {
  lookupTitleCache.delete(listTitle);
};

/** Resolves display Titles for a lookup column by loading (and caching) {Id -> Title} of the target list. */
export const resolveLookupTitle = async (targetListTitle: string, id: number | null | undefined): Promise<string> => {
  if (!id && id !== 0) return '';
  let map = lookupTitleCache.get(targetListTitle);
  if (!map) {
    const items = await getAllListItems(targetListTitle);
    map = new Map(items.map((i) => [Number(i.Id), String(i.Title || '')]));
    lookupTitleCache.set(targetListTitle, map);
  }
  return map.get(Number(id)) || '';
};

/**
 * Fetches and normalizes every item in a SharePoint list (paginated).
 * Pass `withDriveItem: true` for document/picture libraries to also resolve
 * file-specific properties (name, absolute URL, size) via the associated driveItem.
 */
export const getAllListItems = async (listTitle: string, withDriveItem = false): Promise<SPItem[]> => {
  const cacheKey = `${listTitle}::${withDriveItem}`;
  const inFlight = inFlightListItems.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const siteId = await getSiteId();
    const listId = await getListId(listTitle);
    const expand = withDriveItem ? 'fields,driveItem' : 'fields';
    const raw = await graphFetchAllPages<GraphListItem>(
      `/sites/${siteId}/lists/${listId}/items?$expand=${expand}&$top=200`
    );
    return raw.map(normalizeItem);
  })().finally(() => {
    inFlightListItems.delete(cacheKey);
  });

  inFlightListItems.set(cacheKey, promise);
  return promise;
};

export const getListItemById = async (listTitle: string, id: number, withDriveItem = false): Promise<SPItem> => {
  const siteId = await getSiteId();
  const listId = await getListId(listTitle);
  const expand = withDriveItem ? 'fields,driveItem' : 'fields';
  const raw = await graphFetch<GraphListItem>(`/sites/${siteId}/lists/${listId}/items/${id}?$expand=${expand}`);
  return normalizeItem(raw);
};

export const addListItem = async (listTitle: string, fields: SPItem): Promise<SPItem> => {
  const siteId = await getSiteId();
  const listId = await getListId(listTitle);
  const raw = await graphFetch<GraphListItem>(`/sites/${siteId}/lists/${listId}/items`, {
    method: 'POST',
    body: { fields: sanitizeFields(fields) },
  });
  invalidateListCache(listTitle);
  // POST response includes the fields we sent but not necessarily createdBy/lastModifiedBy resolved yet -> re-fetch.
  return getListItemById(listTitle, Number(raw.id));
};

export const updateListItem = async (listTitle: string, id: number, fields: SPItem): Promise<SPItem> => {
  const siteId = await getSiteId();
  const listId = await getListId(listTitle);
  await graphFetch(`/sites/${siteId}/lists/${listId}/items/${id}/fields`, {
    method: 'PATCH',
    body: sanitizeFields(fields),
  });
  invalidateListCache(listTitle);
  return getListItemById(listTitle, id);
};

export const deleteListItem = async (listTitle: string, id: number): Promise<void> => {
  const siteId = await getSiteId();
  const listId = await getListId(listTitle);
  await graphFetch(`/sites/${siteId}/lists/${listId}/items/${id}`, { method: 'DELETE' });
  invalidateListCache(listTitle);
};

/**
 * SharePoint Lookup columns are addressed differently by the two APIs: classic
 * SharePoint REST/CSOM (and PnP JS, used by the original SPFx app) writes them as
 * "{InternalName}Id" (e.g. PageId, ParentId), while Microsoft Graph requires
 * "{InternalName}LookupId" (e.g. PageLookupId, ParentLookupId). The rest of the app
 * (store.ts, modals) still builds payloads using the original REST-style names, so we
 * translate the known Lookup columns here rather than touching every call site.
 * Schema reference: Containers.Page, TopNavigation.Parent/SmartPage, ContactQueries.SourcePage.
 */
const LOOKUP_FIELD_ALIASES: Record<string, string> = {
  PageId: 'PageLookupId', // Containers -> SmartPages
  ParentId: 'ParentLookupId', // TopNavigation -> TopNavigation (self-reference)
  SmartPageId: 'SmartPageLookupId', // TopNavigation -> SmartPages
  SourcePageId: 'SourcePageLookupId', // ContactQueries -> SmartPages
  ContainerId: 'ContainerLookupId', // News/Events/etc. -> Containers (multi-lookup)
};

/** Strips undefined values and Id (read-only) before writing fields to Graph. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sanitizeFields = (fields: Record<string, any>): Record<string, any> => {
  const clean: Record<string, unknown> = {};
  Object.keys(fields || {}).forEach((key) => {
    if (key === 'Id' || key === 'Author' || key === 'Editor' || key === 'Created' || key === 'Modified') return;
    const value = fields[key];
    if (value === undefined) return;
    const graphKey = LOOKUP_FIELD_ALIASES[key] || key;
    clean[graphKey] = value;
  });
  return clean;
};

export interface SPListInfo {
  Id: string;
  Title: string;
  ItemCount: number;
  BaseTemplate: number;
  Description: string;
  Hidden: boolean;
}

const TEMPLATE_TO_BASE_TEMPLATE: Record<string, number> = {
  genericList: 100,
  documentLibrary: 101,
  survey: 102,
  links: 103,
  announcements: 104,
  contacts: 105,
  events: 106,
  tasks: 107,
  discussionBoard: 108,
  pictureLibrary: 109,
};

export const getAllLists = async (): Promise<SPListInfo[]> => {
  const siteId = await getSiteId();
  interface GraphListFull {
    id: string;
    displayName: string;
    description?: string;
    list?: { template?: string; hidden?: boolean };
  }
  const lists = await graphFetchAllPages<GraphListFull>(`/sites/${siteId}/lists?$select=id,displayName,description,list`);
  const withCounts = await Promise.all(
    lists.map(async (l) => {
      let itemCount = 0;
      try {
        const items = await graphFetchAllPages(`/sites/${siteId}/lists/${l.id}/items?$select=id&$top=200`);
        itemCount = items.length;
      } catch {
        itemCount = 0;
      }
      return {
        Id: l.id,
        Title: l.displayName,
        ItemCount: itemCount,
        BaseTemplate: TEMPLATE_TO_BASE_TEMPLATE[l.list?.template || ''] ?? 100,
        Description: l.description || '',
        Hidden: !!l.list?.hidden,
      };
    })
  );
  return withCounts.filter((l) => !l.Hidden);
};

export interface SPFieldInfo {
  Id: string;
  Title: string;
  InternalName: string;
  TypeAsString: string;
  Description: string;
  Required: boolean;
  Hidden: boolean;
  ReadOnlyField: boolean;
}

export const getListFields = async (listTitle: string): Promise<SPFieldInfo[]> => {
  const siteId = await getSiteId();
  const listId = await getListId(listTitle);
  interface GraphColumn {
    id: string;
    name: string;
    displayName: string;
    description?: string;
    required?: boolean;
    hidden?: boolean;
    readOnly?: boolean;
    columnGroup?: string;
  }
  const columns = await graphFetchAllPages<GraphColumn>(`/sites/${siteId}/lists/${listId}/columns?$top=200`);
  return columns
    .filter((c) => !c.hidden)
    .map((c) => ({
      Id: c.id,
      Title: c.displayName,
      InternalName: c.name,
      TypeAsString: c.columnGroup || 'Text',
      Description: c.description || '',
      Required: !!c.required,
      Hidden: !!c.hidden,
      ReadOnlyField: !!c.readOnly,
    }));
};

interface GraphItemVersion {
  id: string;
  lastModifiedDateTime?: string;
  fields?: SPItem;
}

export const getItemVersions = async (listTitle: string, itemId: number): Promise<SPItem[]> => {
  const siteId = await getSiteId();
  const listId = await getListId(listTitle);
  try {
    const versions = await graphFetchAllPages<GraphItemVersion>(
      `/sites/${siteId}/lists/${listId}/items/${itemId}/versions?$expand=fields&$top=200`
    );
    return versions.map((v) => ({
      ...(v.fields || {}),
      VersionLabel: v.id,
      Modified: v.lastModifiedDateTime,
    }));
  } catch (error) {
    if (error instanceof GraphError && error.status === 404) return [];
    throw error;
  }
};

export { GraphError };
