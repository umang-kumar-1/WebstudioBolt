import { acquireGraphToken } from './graphAuth';
import { graphFetch, graphFetchAllPages, graphFetchBlob, GraphError, GRAPH_ROOT } from './graphFetch';
import { getLibraryDriveId, getSiteOrigin } from './siteResolver';
import type { SPItem } from './listItems';

export interface DriveItemInfo {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  createdBy?: { user?: { id?: string; displayName?: string } };
  lastModifiedBy?: { user?: { id?: string; displayName?: string } };
  folder?: { childCount: number };
  file?: { mimeType: string };
  parentReference?: { path?: string };
}

const encodeGraphPath = (path: string): string =>
  path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');

const pathSegment = (folderPath?: string): string => {
  const clean = (folderPath || '').replace(/^\/+|\/+$/g, '');
  return clean ? `:/${encodeGraphPath(clean)}` : '';
};

/** Lists the immediate children (files + folders) of a library root or a named sub-folder. */
export const listDriveChildren = async (libraryTitle: string, folderPath?: string): Promise<DriveItemInfo[]> => {
  const driveId = await getLibraryDriveId(libraryTitle);
  const suffix = pathSegment(folderPath);
  const path = suffix ? `/drives/${driveId}/root${suffix}:/children` : `/drives/${driveId}/root/children`;
  return graphFetchAllPages<DriveItemInfo>(`${path}?$top=200`);
};

/** Lists only sub-folders directly under the library root (mirrors old sp `rootFolder.folders`). */
export const listDriveFolders = async (libraryTitle: string): Promise<DriveItemInfo[]> => {
  const children = await listDriveChildren(libraryTitle);
  return children.filter((c) => !!c.folder);
};

export const getDriveItemById = async (libraryTitle: string, itemId: string): Promise<DriveItemInfo> => {
  const driveId = await getLibraryDriveId(libraryTitle);
  return graphFetch<DriveItemInfo>(`/drives/${driveId}/items/${itemId}`);
};

/** SharePoint custom-column values (Title, Description, AltText, etc.) attached to a file's list item. */
export const getDriveItemFields = async (libraryTitle: string, itemId: string): Promise<SPItem> => {
  const driveId = await getLibraryDriveId(libraryTitle);
  const listItem = await graphFetch<{ id: string; fields?: SPItem }>(
    `/drives/${driveId}/items/${itemId}/listItem?$expand=fields`
  );
  return { Id: Number(listItem.id), ...(listItem.fields || {}) };
};

export const updateDriveItemFields = async (libraryTitle: string, itemId: string, fields: SPItem): Promise<void> => {
  const driveId = await getLibraryDriveId(libraryTitle);
  const clean: Record<string, unknown> = {};
  Object.keys(fields || {}).forEach((k) => {
    if (fields[k] !== undefined) clean[k] = fields[k];
  });
  await graphFetch(`/drives/${driveId}/items/${itemId}/listItem/fields`, {
    method: 'PATCH',
    body: clean,
  });
};

export const checkFileExists = async (libraryTitle: string, folderPath: string, fileName: string): Promise<boolean> => {
  try {
    const driveId = await getLibraryDriveId(libraryTitle);
    const suffix = pathSegment(folderPath ? `${folderPath}/${fileName}` : fileName);
    await graphFetch(`/drives/${driveId}/root${suffix}`);
    return true;
  } catch (error) {
    if (error instanceof GraphError && error.status === 404) return false;
    throw error;
  }
};

export const createFolder = async (libraryTitle: string, folderName: string): Promise<DriveItemInfo> => {
  const driveId = await getLibraryDriveId(libraryTitle);
  return graphFetch<DriveItemInfo>(`/drives/${driveId}/root/children`, {
    method: 'POST',
    body: {
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    },
  });
};

const SMALL_FILE_LIMIT = 4 * 1024 * 1024; // 4MB — Graph simple-upload limit

/**
 * Uploads a file into a library (optionally inside a single-level sub-folder), overwriting
 * by default to match the old PnP `addUsingPath(..., { Overwrite: true })` behavior.
 * Files larger than 4MB automatically use a resumable upload session.
 */
export const uploadFileToLibrary = async (
  libraryTitle: string,
  folderPath: string | undefined,
  fileName: string,
  content: Blob | File,
  overwrite = true
): Promise<DriveItemInfo> => {
  const driveId = await getLibraryDriveId(libraryTitle);
  const targetPath = folderPath ? `${folderPath}/${fileName}` : fileName;
  const suffix = pathSegment(targetPath);
  const conflictQuery = overwrite ? 'replace' : 'fail';

  if (content.size <= SMALL_FILE_LIMIT) {
    const token = await acquireGraphToken();
    const response = await fetch(
      `${GRAPH_ROOT}/drives/${driveId}/root${suffix}:/content?@microsoft.graph.conflictBehavior=${conflictQuery}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': content.type || 'application/octet-stream' },
        body: content,
      }
    );
    if (!response.ok) {
      throw new GraphError(`Failed to upload file '${fileName}'`, response.status);
    }
    return response.json();
  }

  // Resumable upload session for large files (documents, unoptimized originals, etc.).
  const session = await graphFetch<{ uploadUrl: string }>(`/drives/${driveId}/root${suffix}:/createUploadSession`, {
    method: 'POST',
    body: { item: { '@microsoft.graph.conflictBehavior': conflictQuery } },
  });

  const chunkSize = 5 * 1024 * 1024; // 5MB chunks
  let start = 0;
  let lastResponse: DriveItemInfo | null = null;

  while (start < content.size) {
    const end = Math.min(start + chunkSize, content.size);
    const chunk = content.slice(start, end);
    const response = await fetch(session.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(end - start),
        'Content-Range': `bytes ${start}-${end - 1}/${content.size}`,
      },
      body: chunk,
    });
    if (!response.ok && response.status !== 202) {
      throw new GraphError(`Failed to upload chunk for '${fileName}'`, response.status);
    }
    if (response.status !== 202) {
      lastResponse = await response.json();
    }
    start = end;
  }

  return lastResponse || getDriveItemByPathHelper(driveId, targetPath);
};

const getDriveItemByPathHelper = async (driveId: string, path: string): Promise<DriveItemInfo> =>
  graphFetch<DriveItemInfo>(`/drives/${driveId}/root${pathSegment(path)}`);

export const setFileContent = async (libraryTitle: string, itemId: string, content: Blob | File): Promise<void> => {
  const driveId = await getLibraryDriveId(libraryTitle);
  const token = await acquireGraphToken();
  const response = await fetch(`${GRAPH_ROOT}/drives/${driveId}/items/${itemId}/content`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': content.type || 'application/octet-stream' },
    body: content,
  });
  if (!response.ok) {
    throw new GraphError('Failed to replace file content', response.status);
  }
};

export const renameOrMoveDriveItem = async (
  libraryTitle: string,
  itemId: string,
  updates: { name?: string; overwrite?: boolean }
): Promise<DriveItemInfo> => {
  const driveId = await getLibraryDriveId(libraryTitle);
  const body: Record<string, unknown> = {};
  if (updates.name) {
    body.name = updates.name;
    body['@microsoft.graph.conflictBehavior'] = updates.overwrite === false ? 'fail' : 'replace';
  }
  return graphFetch<DriveItemInfo>(`/drives/${driveId}/items/${itemId}`, { method: 'PATCH', body });
};

export const deleteDriveItem = async (libraryTitle: string, itemId: string): Promise<void> => {
  const driveId = await getLibraryDriveId(libraryTitle);
  await graphFetch(`/drives/${driveId}/items/${itemId}`, { method: 'DELETE' });
};

/** Downloads a file's binary content with the bearer token attached (for authenticated preview/export). */
export const downloadDriveItemContent = async (libraryTitle: string, itemId: string): Promise<Blob> => {
  const driveId = await getLibraryDriveId(libraryTitle);
  return graphFetchBlob(`/drives/${driveId}/items/${itemId}/content`);
};

/** Converts a Graph driveItem's webUrl into a server-relative path, mirroring SP's `FileRef`. */
export const toServerRelativeUrl = async (webUrl: string): Promise<string> => {
  try {
    return new URL(webUrl).pathname;
  } catch {
    const origin = await getSiteOrigin();
    return webUrl.replace(origin, '');
  }
};
