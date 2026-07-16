import { acquireGraphToken } from './graphAuth';
import { GRAPH_ROOT, GraphError } from './graphFetch';

/** Encodes an absolute URL into Microsoft Graph's "shares" sharing-token format (u!base64url). */
const encodeSharingUrl = (absoluteUrl: string): string => {
  const base64 = typeof window !== 'undefined' ? window.btoa(unescape(encodeURIComponent(absoluteUrl))) : Buffer.from(absoluteUrl).toString('base64');
  const urlSafe = base64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  return `u!${urlSafe}`;
};

const SP_HOSTNAME = (import.meta.env.VITE_SP_HOSTNAME as string) || '';

/** Pseudo-URL scheme used for Microsoft 365 user profile photos (replaces the old ambient-session
 *  `/_layouts/15/userphoto.aspx` link, which doesn't work outside of a SharePoint page). */
const GRAPH_PHOTO_PREFIX = 'graph-photo:';

/** Builds the pseudo-URL consumed by `resolveAuthenticatedUrl`/`SPImage` for a user's Entra ID photo. */
export const buildGraphPhotoUrl = (userPrincipalNameOrEmail: string): string =>
  userPrincipalNameOrEmail ? `${GRAPH_PHOTO_PREFIX}${encodeURIComponent(userPrincipalNameOrEmail)}` : '';

const isGraphPhotoUrl = (url: string): boolean => url.startsWith(GRAPH_PHOTO_PREFIX);

/** True when a URL points at the configured SharePoint tenant and therefore needs a bearer token to load. */
export const isSharePointUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:')) return false;
  if (isGraphPhotoUrl(url)) return true;
  try {
    const parsed = new URL(url, window.location.origin);
    if (SP_HOSTNAME && parsed.hostname === SP_HOSTNAME) return true;
    return /\.sharepoint\.com$/i.test(parsed.hostname);
  } catch {
    return false;
  }
};

/** Fetches a user's Microsoft 365 profile photo via Microsoft Graph (requires User.ReadBasic.All / User.Read.All). */
export const fetchGraphUserPhoto = async (userPrincipalNameOrEmail: string): Promise<Blob> => {
  const token = await acquireGraphToken();
  const response = await fetch(`${GRAPH_ROOT}/users/${encodeURIComponent(userPrincipalNameOrEmail)}/photo/$value`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new GraphError(`Failed to load profile photo for ${userPrincipalNameOrEmail}`, response.status);
  }
  return response.blob();
};

/**
 * Fetches the binary content of an arbitrary SharePoint absolute URL (list attachment, document,
 * image, etc.) using the signed-in user's Microsoft Graph token instead of anonymous/cookie access.
 * This is the mechanism behind the "SP token ke saath image show hota hai" requirement.
 */
export const fetchSharePointContentByUrl = async (absoluteUrl: string): Promise<Blob> => {
  const token = await acquireGraphToken();
  const shareId = encodeSharingUrl(absoluteUrl);

  const response = await fetch(`${GRAPH_ROOT}/shares/${shareId}/driveItem/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new GraphError(`Failed to load SharePoint content for ${absoluteUrl}`, response.status);
  }

  return response.blob();
};

const blobUrlCache = new Map<string, Promise<string>>();

/**
 * Returns a cached, revocable object URL for a SharePoint-hosted file, fetched with the Graph
 * bearer token. Non-SharePoint URLs (bundled assets, data/blob URIs, external images) pass through untouched.
 */
export const resolveAuthenticatedUrl = async (url: string | null | undefined): Promise<string> => {
  if (!url) return '';
  if (!isSharePointUrl(url)) return url;

  const cached = blobUrlCache.get(url);
  if (cached) return cached;

  const fetchBlob = isGraphPhotoUrl(url)
    ? () => fetchGraphUserPhoto(decodeURIComponent(url.slice(GRAPH_PHOTO_PREFIX.length)))
    : () => fetchSharePointContentByUrl(url);

  const promise = fetchBlob()
    .then((blob) => URL.createObjectURL(blob))
    .catch((error) => {
      blobUrlCache.delete(url);
      throw error;
    });

  blobUrlCache.set(url, promise);
  return promise;
};

export const clearAuthenticatedUrlCache = (): void => {
  blobUrlCache.clear();
};
