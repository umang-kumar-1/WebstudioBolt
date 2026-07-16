import { graphFetch, graphFetchAllPages, GraphError } from './graphFetch';

interface GraphSite {
  id: string;
  webUrl: string;
  displayName?: string;
}

interface GraphList {
  id: string;
  displayName: string;
  name: string;
}

const SP_HOSTNAME = (import.meta.env.VITE_SP_HOSTNAME as string) || '';
const SP_SITE_PATH = (import.meta.env.VITE_SP_SITE_PATH as string) || '';

let cachedSiteId: string | null = null;
let cachedSiteUrl: string | null = null;
const listIdCache = new Map<string, string>();
const driveIdCache = new Map<string, string>();

// In-flight request de-duplication: when many components/pages ask for the same
// site/list/drive id concurrently (e.g. loading containers for every page at once),
// only one network request should actually fire. Without this, Microsoft Graph /
// SharePoint Online throttles the burst of identical concurrent requests, which makes
// the app appear to hang on "Loading Data...". This mirrors how PnP JS's same-origin
// SharePoint REST calls never hit this problem in the original SPFx webpart.
let inFlightSiteId: Promise<string> | null = null;
const inFlightListId = new Map<string, Promise<string>>();
const inFlightDriveId = new Map<string, Promise<string>>();

/** Resolves (and caches) the Microsoft Graph site id for the configured SharePoint site. */
export const getSiteId = async (): Promise<string> => {
  if (cachedSiteId) return cachedSiteId;
  if (inFlightSiteId) return inFlightSiteId;
  if (!SP_HOSTNAME || !SP_SITE_PATH) {
    throw new Error('SharePoint site is not configured. Set VITE_SP_HOSTNAME and VITE_SP_SITE_PATH in .env');
  }
  const normalizedPath = SP_SITE_PATH.startsWith('/') ? SP_SITE_PATH : `/${SP_SITE_PATH}`;
  inFlightSiteId = graphFetch<GraphSite>(`/sites/${SP_HOSTNAME}:${normalizedPath}`)
    .then((site) => {
      cachedSiteId = site.id;
      cachedSiteUrl = site.webUrl;
      return cachedSiteId;
    })
    .finally(() => {
      inFlightSiteId = null;
    });
  return inFlightSiteId;
};

/** Absolute URL (origin + path) of the configured SharePoint site, e.g. https://contoso.sharepoint.com/sites/WebStudio */
export const getSiteUrl = async (): Promise<string> => {
  if (cachedSiteUrl) return cachedSiteUrl;
  await getSiteId();
  return cachedSiteUrl as string;
};

export const getSiteOrigin = async (): Promise<string> => {
  const url = await getSiteUrl();
  return new URL(url).origin;
};

/** Resolves (and caches) a SharePoint list's Graph list id by its display title. */
export const getListId = async (listTitle: string): Promise<string> => {
  const cached = listIdCache.get(listTitle);
  if (cached) return cached;

  const inFlight = inFlightListId.get(listTitle);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const siteId = await getSiteId();
    const escaped = listTitle.replace(/'/g, "''");
    const lists = await graphFetchAllPages<GraphList>(
      `/sites/${siteId}/lists?$filter=displayName eq '${escaped}'&$select=id,displayName,name`
    );

    let match = lists[0];
    if (!match) {
      // Fall back to scanning all lists (displayName filter can miss lists with special chars in some tenants).
      const all = await graphFetchAllPages<GraphList>(`/sites/${siteId}/lists?$select=id,displayName,name&$top=200`);
      match = all.find((l) => l.displayName === listTitle || l.name === listTitle) as GraphList;
    }

    if (!match) {
      throw new GraphError(`List '${listTitle}' does not exist (404)`, 404);
    }

    listIdCache.set(listTitle, match.id);
    return match.id;
  })().finally(() => {
    inFlightListId.delete(listTitle);
  });

  inFlightListId.set(listTitle, promise);
  return promise;
};

/** Resolves (and caches) the drive id backing a document/picture library (needed for file operations). */
export const getLibraryDriveId = async (libraryTitle: string): Promise<string> => {
  const cached = driveIdCache.get(libraryTitle);
  if (cached) return cached;

  const inFlight = inFlightDriveId.get(libraryTitle);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const siteId = await getSiteId();
    const listId = await getListId(libraryTitle);
    const drive = await graphFetch<{ id: string }>(`/sites/${siteId}/lists/${listId}/drive`);
    driveIdCache.set(libraryTitle, drive.id);
    return drive.id;
  })().finally(() => {
    inFlightDriveId.delete(libraryTitle);
  });

  inFlightDriveId.set(libraryTitle, promise);
  return promise;
};

/** Clears all resolver caches (call after provisioning new lists/libraries). */
export const clearSiteResolverCache = (): void => {
  cachedSiteId = null;
  cachedSiteUrl = null;
  listIdCache.clear();
  driveIdCache.clear();
};
