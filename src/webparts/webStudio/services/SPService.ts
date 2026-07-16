/**
 * SharePoint data-access layer for the Web Studio app.
 *
 * Rewritten from @pnp/sp / sp-pnp-js to Microsoft Graph. Every exported function keeps the
 * exact same name, parameters and return shape as before so the rest of the app (store.ts,
 * every modal, PreviewArea, etc.) needed zero changes.
 */
import {
  getAllListItems,
  getListItemById,
  addListItem as graphAddListItem,
  updateListItem as graphUpdateListItem,
  deleteListItem as graphDeleteListItem,
  getAllLists as graphGetAllLists,
  getListFields as graphGetListFields,
  getItemVersions as graphGetItemVersions,
  resolveLookupTitle,
  type SPItem,
} from '../../../lib/graph/listItems';
import {
  listDriveFolders,
  uploadFileToLibrary,
  setFileContent,
  renameOrMoveDriveItem,
  checkFileExists as graphCheckFileExists,
  getDriveItemById,
} from '../../../lib/graph/driveFiles';
import { getSiteId, getSiteUrl, getListId } from '../../../lib/graph/siteResolver';
import { graphFetch, graphFetchAllPages, GraphError } from '../../../lib/graph/graphFetch';
import {
  PermissionGroup,
  PermissionUser,
  SectionTemplate,
  ContainerType,
  WebStudioUserRole,
  ThemeTemplate,
  ThemeConfig,
} from '../types';
import { isDefaultImageFileName } from '../utils/defaultImageUrl';
import {
  buildContainerLookupPayload,
  type TaggableListName,
} from '../utils/containerLookupSync';
import { buildPageLookupPayload } from '../utils/pageLookupSync';
import {
  resolveWebStudioUserRoleFromGroupIds,
  resolveWebStudioUserRoleFromGroupTitles,
  sortWebStudioPermissionGroups,
  isWebStudioDefaultPermissionGroup,
  isWebStudioSiteAdminsGroup,
  WEBSTUDIO_SITE_ADMIN_GROUP,
  WEBSTUDIO_SUPER_ADMIN_GROUP,
  type WebStudioPermissionGroupType,
} from '../utils/templatePermissions';

type SPGroupRecord = { Id: number; Title: string; Description?: string };

interface SitePermissionTriplet {
  owner: SPGroupRecord | null;
  member: SPGroupRecord | null;
  visitor: SPGroupRecord | null;
}

const mapSPGroupToPermissionGroup = (
  group: SPGroupRecord | null,
  type: WebStudioPermissionGroupType
): PermissionGroup | null => {
  if (!group?.Id) return null;
  return {
    id: String(group.Id),
    name: group.Title,
    description: group.Description || '',
    type,
    memberIds: [],
  };
};

const resolveCustomPermissionGroupType = (title: string): PermissionGroup['type'] => {
  const trimmed = title.trim();
  if (trimmed === 'Site Admins' || trimmed === WEBSTUDIO_SITE_ADMIN_GROUP) return 'SiteAdmin';
  if (trimmed === WEBSTUDIO_SUPER_ADMIN_GROUP) return 'SuperAdmin';
  return 'Custom';
};

const mapSPGroupRecordToPermissionGroup = (group: SPGroupRecord): PermissionGroup | null => {
  if (!group?.Id) return null;
  return {
    id: String(group.Id),
    name: group.Title,
    description: group.Description || '',
    type: resolveCustomPermissionGroupType(group.Title),
    memberIds: [],
  };
};

const getParentWebRelativeUrl = (serverRelativeUrl: string): string | null => {
  const segments = serverRelativeUrl.split('/').filter(Boolean);
  if (segments.length <= 2) return null;
  return `/${segments.slice(0, -1).join('/')}`;
};

const loadAssociatedTripletAtPath = async (serverRelativeWebPath: string): Promise<SitePermissionTriplet> => {
  const { spRestFetchOneAtWebPath } = await import('../../../lib/graph/spRestFetch');
  const [owner, member, visitor] = await Promise.all([
    spRestFetchOneAtWebPath<{ Id: number; Title: string; Description?: string }>(
      serverRelativeWebPath,
      '/_api/web/AssociatedOwnerGroup'
    ),
    spRestFetchOneAtWebPath<{ Id: number; Title: string; Description?: string }>(
      serverRelativeWebPath,
      '/_api/web/AssociatedMemberGroup'
    ),
    spRestFetchOneAtWebPath<{ Id: number; Title: string; Description?: string }>(
      serverRelativeWebPath,
      '/_api/web/AssociatedVisitorGroup'
    ),
  ]);
  return { owner, member, visitor };
};

const loadAssociatedTriplet = async (): Promise<SitePermissionTriplet> => {
  const { spRestFetchOne } = await import('../../../lib/graph/spRestFetch');
  const [owner, member, visitor] = await Promise.all([
    spRestFetchOne<{ Id: number; Title: string; Description?: string }>('/_api/web/AssociatedOwnerGroup').catch(() => null),
    spRestFetchOne<{ Id: number; Title: string; Description?: string }>('/_api/web/AssociatedMemberGroup').catch(() => null),
    spRestFetchOne<{ Id: number; Title: string; Description?: string }>('/_api/web/AssociatedVisitorGroup').catch(() => null),
  ]);
  return { owner, member, visitor };
};

/**
 * Normalize a date string to a valid ISO format for SharePoint OData Edm.DateTime
 * Returns null for empty or invalid strings to avoid 400 Bad Request
 */
const normalizeSPODataDate = (date: string | null | undefined): string | null => {
    if (!date || (typeof date === 'string' && date.trim() === '')) return null;
    try {
        const parsed = new Date(date);
        if (isNaN(parsed.getTime())) return null;
        return parsed.toISOString();
    } catch {
        return null;
    }
};

const byString = (a: unknown, b: unknown): number => String(a ?? '').localeCompare(String(b ?? ''));
const byNumber = (a: unknown, b: unknown): number => (Number(a) || 0) - (Number(b) || 0);
const byDate = (a: unknown, b: unknown): number => new Date(String(a || 0)).getTime() - new Date(String(b || 0)).getTime();

// ==================== SmartPages ====================

export const getPages = async (): Promise<any[]> => {
    const items = await getAllListItems('SmartPages');
    return items.sort((a, b) => byString(a.Title, b.Title));
};

export const getPageById = async (id: number): Promise<any> => {
    return await getListItemById('SmartPages', id);
};

export const savePage = async (data: any): Promise<any> => {
    return await graphAddListItem('SmartPages', data);
};

export const updatePage = async (id: number, data: any): Promise<any> => {
    if (isNaN(id)) return;
    return await graphUpdateListItem('SmartPages', id, data);
};

export const deletePage = async (id: number): Promise<void> => {
    await graphDeleteListItem('SmartPages', id);
};

// ==================== Containers ====================

export const getContainersByPageId = async (pageId: number): Promise<any[]> => {
    const items = await getAllListItems('Containers');
    // Graph exposes the "Page" Lookup column as PageLookupId (SharePoint REST/PnP used PageId).
    return items
        .filter((i) => Number(i.PageLookupId ?? i.PageId) === Number(pageId))
        .sort((a, b) => byNumber(a.SortOrder, b.SortOrder));
};

export const saveContainer = async (data: any): Promise<any> => {
    const payload = { ...data };
    if (!payload.Status) payload.Status = 'Draft';
    return await graphAddListItem('Containers', payload);
};

export const updateContainer = async (id: number, data: any): Promise<any> => {
    return await graphUpdateListItem('Containers', id, data);
};

export const deleteContainer = async (id: number): Promise<void> => {
    await graphDeleteListItem('Containers', id);
};

export const getContainerById = async (id: number): Promise<any> => {
    return await getListItemById('Containers', id);
};

export const updateItemContainerLookup = async (
    listName: TaggableListName,
    itemId: number,
    containerIds: Array<string | number>
): Promise<void> => {
    if (isNaN(itemId)) return;
    try {
        await graphUpdateListItem(listName, itemId, buildContainerLookupPayload(containerIds));
    } catch (error) {
        console.error(`Failed to update Container lookup for ${listName} item ${itemId}:`, error);
        throw error;
    }
};

export const updateItemPageLookup = async (
    listName: TaggableListName,
    itemId: number,
    pageIds: Array<string | number>
): Promise<void> => {
    if (isNaN(itemId)) return;
    try {
        await graphUpdateListItem(listName, itemId, buildPageLookupPayload(pageIds, listName));
    } catch (error) {
        console.error(`Failed to update Page lookup for ${listName} item ${itemId}:`, error);
        throw error;
    }
};

// ==================== TopNavigation ====================

const enrichNavItem = async (item: SPItem): Promise<SPItem> => {
    const parentId = item.ParentLookupId ? Number(item.ParentLookupId) : null;
    const smartPageId = item.SmartPageLookupId ? Number(item.SmartPageLookupId) : null;
    const [parentTitle, smartPageTitle] = await Promise.all([
        parentId ? resolveLookupTitle('TopNavigation', parentId) : Promise.resolve(''),
        smartPageId ? resolveLookupTitle('SmartPages', smartPageId) : Promise.resolve(''),
    ]);
    return {
        ...item,
        Parent: parentId ? { Id: parentId, Title: parentTitle } : null,
        SmartPage: smartPageId ? { Id: smartPageId, Title: smartPageTitle } : null,
    };
};

export const getNavigation = async (): Promise<any[]> => {
    const items = await getAllListItems('TopNavigation');
    const enriched = await Promise.all(items.map(enrichNavItem));
    return enriched.sort((a, b) => byNumber(a.SortOrder, b.SortOrder));
};

export const saveNavItem = async (data: any): Promise<any> => {
    const created = await graphAddListItem('TopNavigation', data);
    return enrichNavItem(created);
};

export const updateNavItem = async (id: number, data: any): Promise<any> => {
    if (isNaN(id)) return;
    const updated = await graphUpdateListItem('TopNavigation', id, data);
    return enrichNavItem(updated);
};

export const deleteNavItem = async (id: number): Promise<void> => {
    if (isNaN(id)) return;
    await graphDeleteListItem('TopNavigation', id);
};

// ==================== News ====================

export const getNews = async (): Promise<any[]> => {
    const items = await getAllListItems('News');
    return items.sort((a, b) => byDate(b.PublishDate, a.PublishDate));
};

export const saveNews = async (data: any): Promise<any> => {
    const payload = { ...data };
    if (payload.PublishDate !== undefined) payload.PublishDate = normalizeSPODataDate(payload.PublishDate);
    return await graphAddListItem('News', payload);
};

export const updateNews = async (id: number, data: any): Promise<any> => {
    if (isNaN(id)) {
        console.warn(`Skipping SP update for invalid News ID: ${id}`);
        return;
    }
    const payload = { ...data };
    if (payload.PublishDate !== undefined) payload.PublishDate = normalizeSPODataDate(payload.PublishDate);
    return await graphUpdateListItem('News', id, payload);
};

export const deleteNews = async (id: number): Promise<void> => {
    if (isNaN(id)) {
        console.warn(`Skipping SP delete for invalid News ID: ${id}`);
        return;
    }
    await graphDeleteListItem('News', id);
};

// ==================== Events ====================

export const getEvents = async (): Promise<any[]> => {
    const fetchEvents = async () => {
        const items = await getAllListItems('Events');
        return items.sort((a, b) => byDate(a.StartDate, b.StartDate));
    };

    try {
        return await fetchEvents();
    } catch (error) {
        console.error('Error loading events:', error);
        throw error;
    }
};

export const saveEvent = async (data: any): Promise<any> => {
    const payload = { ...data };
    payload.StartDate = normalizeSPODataDate(payload.StartDate);
    payload.EndDate = normalizeSPODataDate(payload.EndDate);
    return await graphAddListItem('Events', payload);
};

export const updateEvent = async (id: number, data: any): Promise<any> => {
    if (isNaN(id)) return;
    const payload = { ...data };
    payload.StartDate = normalizeSPODataDate(payload.StartDate);
    payload.EndDate = normalizeSPODataDate(payload.EndDate);
    return await graphUpdateListItem('Events', id, payload);
};

export const deleteEvent = async (id: number): Promise<void> => {
    if (isNaN(id)) {
        console.warn(`Skipping SP delete for invalid Event ID: ${id}`);
        return;
    }
    await graphDeleteListItem('Events', id);
};

// ==================== ContainerItems ====================

export const getContainerItems = async (): Promise<any[]> => {
    const items = await getAllListItems('ContainerItems');
    return items.sort((a, b) => byNumber(a.SortOrder, b.SortOrder));
};

export const saveContainerItem = async (data: any): Promise<any> => {
    return await graphAddListItem('ContainerItems', data);
};

export const updateContainerItem = async (id: number, data: any): Promise<any> => {
    if (isNaN(id)) {
        console.warn(`Skipping SP update for invalid ContainerItem ID: ${id}`);
        return;
    }
    return await graphUpdateListItem('ContainerItems', id, data);
};

export const deleteContainerItem = async (id: number): Promise<void> => {
    if (isNaN(id)) {
        console.warn(`Skipping SP delete for invalid ContainerItem ID: ${id}`);
        return;
    }
    await graphDeleteListItem('ContainerItems', id);
};

// ==================== ImageSlider ====================

export const getSliderItems = async (): Promise<any[]> => {
    try {
        const items = await getAllListItems('ImageSlider');
        return items.sort((a, b) => byNumber(a.SortOrder, b.SortOrder));
    } catch (error) {
        console.warn('ImageSlider list not available, returning empty.', error);
        return [];
    }
};

export const saveSliderItem = async (data: any): Promise<any> => {
    const payload = { ...data };
    if (data.itemType) {
        payload.ItemType = data.itemType;
        delete payload.itemType;
    }
    return await graphAddListItem('ImageSlider', payload);
};

export const updateSliderItem = async (id: number, data: any): Promise<any> => {
    if (isNaN(id)) {
        console.warn(`Skipping SP update for invalid SliderItem ID: ${id}`);
        return;
    }
    const payload = { ...data };
    if (data.itemType) {
        payload.ItemType = data.itemType;
        delete payload.itemType;
    }
    return await graphUpdateListItem('ImageSlider', id, payload);
};

export const deleteSliderItem = async (id: number): Promise<void> => {
    if (isNaN(id)) {
        console.warn(`Skipping SP delete for invalid SliderItem ID: ${id}`);
        return;
    }
    await graphDeleteListItem('ImageSlider', id);
};

// ==================== Contacts ====================

export const getContacts = async (): Promise<any[]> => {
    const items = await getAllListItems('Contacts');
    return items.sort((a, b) => byNumber(a.SortOrder, b.SortOrder));
};

export const saveContact = async (data: any): Promise<any> => {
    return await graphAddListItem('Contacts', data);
};

export const updateContact = async (id: number, data: any): Promise<any> => {
    if (isNaN(id)) {
        console.warn(`Skipping SP update for invalid Contact ID: ${id}`);
        return;
    }
    return await graphUpdateListItem('Contacts', id, data);
};

export const deleteContact = async (id: number): Promise<void> => {
    if (isNaN(id)) {
        console.warn(`Skipping SP delete for invalid Contact ID: ${id}`);
        return;
    }
    await graphDeleteListItem('Contacts', id);
    console.log(`✅ Deleted Contact with ID ${id}`);
};

// ==================== Documents ====================

export interface IDocumentItem {
    Id: string;
    Title: string;
    DocStatus: string;
    Modified?: string;
    DocType: string;
    DocumentYear: string;
    DocumentDescriptions?: string;
    ItemRank: string;
    url?: string;
}

export const getDocuments = async (): Promise<IDocumentItem[]> => {
    try {
        const items = await getAllListItems('Documents', true);
        return items
            .filter((item) => item.FSObjType !== 1)
            .sort((a, b) => byString(a.FileLeafRef, b.FileLeafRef))
            .map((item) => ({
                Id: item.Id.toString(),
                Title: (item.Title && String(item.Title).trim())
                    || (item.FileLeafRef ? item.FileLeafRef.replace(/\.[^/.]+$/, '') : ''),
                Name: item.FileLeafRef || '',
                DocStatus: item.DocStatus,
                Modified: item.Modified || item.Created,
                Created: item.Created,
                AuthorName: item.Author?.Title,
                EditorName: item.Editor?.Title,
                DocType: item.DocType,
                DocumentYear: item.DocumentYear,
                DocumentDescriptions: item.DocumentDescriptions || '',
                ItemRank: item.ItemRank,
                SortOrder: item.SortOrder,
                Translations: item.Translations,
                ImageUrl: item.ImageUrl?.Url || '',
                ImageName: item.ImageName || '',
                FileRef: item.FileRef,
                EncodedAbsUrl: item.EncodedAbsUrl || '',
            })) as unknown as IDocumentItem[];
    } catch (error) {
        console.error('Error fetching documents:', error);
        return [];
    }
};

export const saveDocument = async (data: any): Promise<any> => {
    try {
        if (!data.Title || data.Title.trim() === '') {
            throw new Error('Title is required');
        }

        let uploadedFileName: string;
        let uploadedContent: Blob;

        if (data.File) {
            uploadedFileName = data.File.name;
            uploadedContent = data.File;
        } else if (data.FileRef && data.FileRef.trim() !== '') {
            uploadedFileName = `${data.Title}.url`;
            uploadedContent = new Blob([`[InternetShortcut]\nURL=${data.FileRef}`], { type: 'text/plain' });
        } else {
            uploadedFileName = `${data.Title}.txt`;
            uploadedContent = new Blob(['Placeholder document.\nNo file or link was provided at creation time.'], { type: 'text/plain' });
        }

        const uploaded = await uploadFileToLibrary('Documents', undefined, uploadedFileName, uploadedContent, true);
        const newItemId = await getListItemIdForDriveItem('Documents', uploaded.id);

        const metadata: any = {
            Title: data.Title,
            DocStatus: data.DocStatus,
            DocType: data.DocType,
            DocumentYear: data.DocumentYear,
            ItemRank: data.ItemRank,
            DocumentDescriptions: data.DocumentDescriptions || '',
        };
        Object.keys(metadata).forEach((key) => metadata[key] === undefined && delete metadata[key]);
        await graphUpdateListItem('Documents', newItemId, metadata);

        return await getListItemById('Documents', newItemId, true);
    } catch (error) {
        console.error('saveDocument error:', error);
        throw error;
    }
};

export const updateDocument = async (id: number, data: any): Promise<any> => {
    try {
        const existing = await getListItemById('Documents', id, true);

        if (data.File instanceof File) {
            await setFileContent('Documents', existing.DriveItemId, data.File);
        }

        if (typeof data.Name === 'string' && data.Name.trim() !== '' && existing.FileLeafRef !== data.Name) {
            await renameOrMoveDriveItem('Documents', existing.DriveItemId, { name: data.Name });
        }

        const { File: _ignoredFile, Name: _ignoredName, ...metadata } = data;
        const updatePayload: Record<string, unknown> = { ...metadata };
        if (typeof data.Title === 'string' && data.Title.trim() !== '') {
            updatePayload.Title = data.Title.trim();
        }
        Object.keys(updatePayload).forEach((key) => updatePayload[key] === undefined && delete updatePayload[key]);

        if (Object.keys(updatePayload).length > 0) {
            await graphUpdateListItem('Documents', id, updatePayload);
        }

        return await getListItemById('Documents', id, true);
    } catch (error) {
        console.error('updateDocument error:', error);
        throw error;
    }
};

export const deleteDocument = async (id: number): Promise<void> => {
    await graphDeleteListItem('Documents', id);
};

export const getDocumentById = async (id: number): Promise<any> => {
    return await getListItemById('Documents', id, true);
};

// ==================== Images ====================

export interface IImageItem {
    Id: number;
    FileName: string;
    ImageUrl: string;
    AltText?: string;
    AssetCategory?: string;
    CopyrightInfo?: string;
    Created: string;
    AuthorName?: string;
    Title?: string;
    Description?: string;
}

const resolveFolderId = (fileUrl: string, folders: IImageFolder[]): string => {
    try {
        const urlPart = decodeURIComponent(fileUrl).toLowerCase();
        for (const folder of folders) {
            if (urlPart.includes(`/${folder.name.toLowerCase()}/`)) {
                return folder.id;
            }
        }
        return 'all';
    } catch {
        return 'all';
    }
};

export const getImages = async (folders: IImageFolder[] = []): Promise<IImageItem[]> => {
    try {
        const items = await getAllListItems('Images', true);

        return items
            .filter((item) => item.FSObjType === 0)
            .sort((a, b) => byDate(b.Created, a.Created))
            .map((item) => ({
                Id: item.Id,
                FileName: item.FileLeafRef,
                ImageUrl: item.FileRef,
                AltText: item.AltText || item.FileLeafRef,
                AssetCategory: item.AssetCategory || resolveFolderId(item.FileRef, folders),
                CopyrightInfo: item.CopyrightInfo || '',
                Created: item.Created,
                Modified: item.Modified,
                AuthorName: item.Author?.Title,
                EditorName: item.Editor?.Title,
                Title: item.Title || item.FileLeafRef,
                Description: item.Description || '',
            })) as unknown as IImageItem[];
    } catch (error) {
        console.error('Error fetching images:', error);
        return [];
    }
};

/** Fetch default.* (any image format) from the root Images library. */
export const getDefaultImageUrl = async (): Promise<string> => {
    try {
        const items = await getAllListItems('Images', true);
        const rootDefaults = items.filter((item) => {
            const leaf = item.FileLeafRef || '';
            if (!isDefaultImageFileName(leaf)) return false;
            // Root-level items only (no folder ancestor beyond the library itself).
            const dir = String(item.FileDirRef || '').toLowerCase();
            return !!dir && dir.split('/').pop() === 'images';
        });
        const chosen = rootDefaults[0] || items.find((item) => isDefaultImageFileName(item.FileLeafRef || ''));
        return chosen?.FileRef || '';
    } catch (error) {
        console.error('Error resolving default image URL:', error);
        return '';
    }
};

export interface IImageFolder {
    id: string;
    name: string;
    serverRelativeUrl: string;
}

export const getFolders = async (): Promise<IImageFolder[]> => {
    try {
        const folders = await listDriveFolders('Images');
        return folders.map((f) => ({
            id: f.name.toLowerCase(),
            name: f.name,
            serverRelativeUrl: f.webUrl,
        }));
    } catch (error) {
        console.error('Error fetching folders:', error);
        return [];
    }
};

export const checkImageExists = async (fileName: string, folderName = ''): Promise<boolean> => {
    try {
        const folder = folderName && folderName !== 'all' && folderName !== 'All Images' ? folderName : undefined;
        return await graphCheckFileExists('Images', folder || '', fileName);
    } catch (error) {
        console.error('Error checking file existence:', error);
        return false;
    }
};

const getListItemIdForDriveItem = async (libraryTitle: string, driveItemId: string): Promise<number> => {
    const siteId = await getSiteId();
    const listId = await getListId(libraryTitle);
    // The library's list id is already resolved; ask the drive item for its associated list item.
    const { getLibraryDriveId } = await import('../../../lib/graph/siteResolver');
    const driveId = await getLibraryDriveId(libraryTitle);
    const listItem = await graphFetch<{ id: string }>(`/drives/${driveId}/items/${driveItemId}/listItem?$select=id`);
    void siteId;
    void listId;
    return Number(listItem.id);
};

export const uploadImage = async (
    file: File,
    folderName = '',
    metadata?: any
): Promise<any> => {
    let fileToUpload: File | Blob = file;
    if (file.type.startsWith('image/')) {
        const { prepareImageFile } = await import(
            /* webpackChunkName: 'optimize-image' */ '../../../utils/imageUploadPipeline'
        );
        const prepared = await prepareImageFile(file);
        fileToUpload = prepared.file;
    }

    try {
        const folder = folderName && folderName !== 'all' && folderName !== 'All Images' ? folderName : undefined;
        const fileName = (fileToUpload as File).name || file.name;

        if (folder) {
            const exists = await graphCheckFileExists('Images', '', folder).catch(() => false);
            if (!exists) {
                const { createFolder } = await import('../../../lib/graph/driveFiles');
                await createFolder('Images', folder).catch(() => undefined);
            }
        }

        const uploaded = await uploadFileToLibrary('Images', folder, fileName, fileToUpload, true);
        const itemId = await getListItemIdForDriveItem('Images', uploaded.id);

        const finalMetadata = {
            Title: metadata?.Title || fileName,
            AltText: metadata?.AltText || metadata?.Title || fileName,
            AssetCategory: folder || 'General',
            Description: metadata?.Description || '',
            CopyrightInfo: metadata?.CopyrightInfo || '',
        };
        await graphUpdateListItem('Images', itemId, finalMetadata);

        const freshItem = await getListItemById('Images', itemId, true);
        return { item: freshItem };
    } catch (error) {
        console.error('Graph image upload failed', error);
        throw error;
    }
};

export const updateImage = async (id: number, file?: File, metadata?: any): Promise<any> => {
    try {
        const existing = await getListItemById('Images', id, true);

        if (file) {
            let fileToUpload: File | Blob = file;
            if (file.type.startsWith('image/')) {
                const { prepareImageFile } = await import(
                    /* webpackChunkName: 'optimize-image' */ '../../../utils/imageUploadPipeline'
                );
                fileToUpload = (await prepareImageFile(file)).file;
            }
            await setFileContent('Images', existing.DriveItemId, fileToUpload);
        }

        if (metadata) {
            const finalMetadata: any = {};
            if (metadata.Title) finalMetadata.Title = metadata.Title;
            if (metadata.Title) finalMetadata.AltText = metadata.Title;
            if (metadata.Description !== undefined) finalMetadata.Description = metadata.Description;
            if (metadata.AssetCategory) finalMetadata.AssetCategory = metadata.AssetCategory;
            if (metadata.CopyrightInfo) finalMetadata.CopyrightInfo = metadata.CopyrightInfo;

            if (Object.keys(finalMetadata).length > 0) {
                await graphUpdateListItem('Images', id, finalMetadata);
            }
        }

        return await getListItemById('Images', id, true);
    } catch (error) {
        console.error('updateImage failed', error);
        throw error;
    }
};

export const deleteImage = async (id: number): Promise<void> => {
    if (isNaN(id)) return;
    await graphDeleteListItem('Images', id);
};

export const updateImageMetadata = async (id: number, metadata: any): Promise<void> => {
    if (isNaN(id)) return;
    await graphUpdateListItem('Images', id, metadata);
};

/**
 * Downloads an image from an external URL and re-uploads it into the SharePoint Images library.
 */
export const uploadImageFromUrl = async (
    imageUrl: string,
    folderName = 'Containers',
    metadata?: { Title?: string; Description?: string; AltText?: string }
): Promise<string> => {
    try {
        if (!imageUrl || imageUrl.trim() === '') {
            console.log('   ⚠️ Empty image URL, skipping upload');
            return '';
        }

        const siteUrl = await getSiteUrl();
        if (imageUrl.includes(siteUrl)) {
            console.log('   ℹ️ Image already hosted on SharePoint, skipping upload');
            return imageUrl;
        }

        console.log(`   📥 Downloading image from URL: ${imageUrl}`);
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();

        let fileName = imageUrl.split('/').pop()?.split('?')[0] || `image_${Date.now()}.jpg`;
        if (!fileName.includes('.')) {
            const contentType = response.headers.get('content-type');
            const extension = contentType?.split('/')[1]?.split(';')[0] || 'jpg';
            fileName = `${fileName}.${extension}`;
        }
        fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

        console.log(`   📤 Uploading to SharePoint as: ${fileName}`);
        const file = new File([blob], fileName, { type: blob.type });

        const result = await uploadImage(file, folderName, {
            Title: metadata?.Title || fileName,
            Description: metadata?.Description || `Uploaded from ${imageUrl}`,
            AltText: metadata?.AltText || fileName,
        });

        const uploadedUrl = result.item.FileRef as string;
        console.log(`   ✅ Image uploaded successfully: ${uploadedUrl}`);
        return uploadedUrl;
    } catch (error) {
        console.error('   ❌ Failed to upload image from URL:', error);
        return imageUrl;
    }
};

// ==================== GlobalSettings ====================

export const getGlobalSettings = async (): Promise<any[]> => {
    return await getAllListItems('GlobalSettings');
};

export const getSettingByKey = async (key: string): Promise<any> => {
    const items = await getAllListItems('GlobalSettings');
    return items.find((i) => i.Title === key) || null;
};

export const saveSetting = async (data: any): Promise<any> => {
    return await graphAddListItem('GlobalSettings', data);
};

export const updateSetting = async (id: number, data: any): Promise<any> => {
    return await graphUpdateListItem('GlobalSettings', id, data);
};

export const upsertGlobalSetting = async (key: string, data: any): Promise<void> => {
    const items = await getAllListItems('GlobalSettings');
    const existing = items.find((i) => i.Title === key);
    if (existing) {
        await graphUpdateListItem('GlobalSettings', existing.Id, { ConfigData: data.ConfigData });
    } else {
        await graphAddListItem('GlobalSettings', { Title: key, ConfigData: data.ConfigData });
    }
};

// ==================== TranslationDictionary ====================

export const getTranslations = async (): Promise<any[]> => {
    return await getAllListItems('TranslationDictionary');
};

export const saveTranslation = async (data: any): Promise<any> => {
    return await graphAddListItem('TranslationDictionary', data);
};

export const updateTranslation = async (id: number, data: any): Promise<any> => {
    return await graphUpdateListItem('TranslationDictionary', id, data);
};

export const upsertTranslation = async (key: string, translations: any, sourceList = 'General'): Promise<void> => {
    const items = await getAllListItems('TranslationDictionary');
    const existing = items.find((i) => i.Title === key && i.SourceList === sourceList);

    const payload = {
        Title: key,
        SourceList: sourceList,
        EN: translations.en || '',
        DE: translations.de || '',
        FR: translations.fr || '',
        ES: translations.es || '',
    };

    if (existing) {
        await graphUpdateListItem('TranslationDictionary', existing.Id, payload);
    } else {
        await graphAddListItem('TranslationDictionary', payload);
    }
};

// ==================== ContactQueries ====================

const enrichContactQuery = async (item: SPItem): Promise<SPItem> => {
    const sourcePageId = item.SourcePageLookupId ? Number(item.SourcePageLookupId) : null;
    const title = sourcePageId ? await resolveLookupTitle('SmartPages', sourcePageId) : '';
    return { ...item, SourcePage: sourcePageId ? { Id: sourcePageId, Title: title } : null };
};

export const getContactQueries = async (): Promise<any[]> => {
    const items = await getAllListItems('ContactQueries');
    const enriched = await Promise.all(items.map(enrichContactQuery));
    return enriched.sort((a, b) => byDate(b.Created, a.Created));
};

export const saveContactQuery = async (data: any): Promise<any> => {
    return await graphAddListItem('ContactQueries', data);
};

export const updateContactQuery = async (id: number, data: any): Promise<any> => {
    return await graphUpdateListItem('ContactQueries', id, data);
};

export const deleteContactQuery = async (id: number): Promise<void> => {
    await graphDeleteListItem('ContactQueries', id);
};

export const deleteContactQueries = async (ids: number[]): Promise<void> => {
    for (const id of ids) {
        await graphDeleteListItem('ContactQueries', id);
    }
};

// ==================== Generic list / field inspection ====================

export const getListFields = async (listTitle: string): Promise<any[]> => {
    return await graphGetListFields(listTitle);
};

export const getAllLists = async (): Promise<any[]> => {
    return await graphGetAllLists();
};

export const getListItems = async (listTitle: string): Promise<any[]> => {
    return await getAllListItems(listTitle);
};

export const addListItem = async (listTitle: string, data: any): Promise<any> => {
    return await graphAddListItem(listTitle, data);
};

export const updateListItem = async (listTitle: string, id: number, data: any): Promise<void> => {
    await graphUpdateListItem(listTitle, id, data);
};

export const deleteListItem = async (listTitle: string, id: number): Promise<void> => {
    await graphDeleteListItem(listTitle, id);
};

/** Get version history for a specific list item */
export const getItemVersions = async (listTitle: string, itemId: number): Promise<any[]> => {
    return await graphGetItemVersions(listTitle, itemId);
};

export const getListGuidByTitle = async (listTitle: string): Promise<string> => {
    return await getListId(listTitle);
};

const RESTORABLE_FIELDS_BY_LIST: Record<string, string[]> = {
    TopNavigation: ['Title', 'ParentId', 'NavType', 'Status', 'SmartPageId', 'ExternalURL', 'ContainerId', 'SortOrder', 'IsVisible', 'OpenInNewTab', 'Translations'],
    Containers: ['Title', 'PageId', 'ContainerType', 'SortOrder', 'Settings', 'ContainerContent', 'IsVisible', 'Status', 'BtnEnabled', 'BtnName', 'BtnLinkType', 'BtnUrl', 'BtnContainerId', 'BtnTargetContainerTitle'],
    SmartPages: ['Title', 'MultilingualTitle', 'Slug', 'PageStatus', 'IsHomePage', 'Description', 'SEOConfig', 'VersionNote', 'ImageName', 'SortOrder'],
    News: ['Title', 'MultilingualTitle', 'Status', 'PublishDate', 'Description', 'ReadMoreURL', 'ReadMoreText', 'ReadMoreEnabled', 'SEOConfig', 'Translations', 'ImageName'],
    Events: ['Title', 'MultilingualTitle', 'StartDate', 'EndDate', 'Location', 'Description', 'Category', 'Translations', 'Status', 'ReadMoreURL', 'ReadMoreText', 'ReadMoreEnabled', 'SEOConfig', 'ImageName'],
    Documents: ['Title', 'DocumentYear', 'DocStatus', 'ItemRank', 'DocType', 'DocumentDescriptions', 'SortOrder', 'Translations', 'ImageName'],
    ImageSlider: ['Title', 'Subtitle', 'Description', 'Status', 'SortOrder', 'CtaText', 'CtaUrl', 'Translations', 'ImageName', 'ImageSettings', 'ItemType'],
    Contacts: ['Title', 'FirstName', 'LastName', 'Status', 'SortOrder', 'JobTitle', 'Company', 'Email', 'Phone', 'Description', 'Translations', 'BtnEnabled', 'BtnName', 'BtnLinkType', 'BtnUrl', 'BtnContainerId', 'BtnTargetContainerTitle', 'BtnConfig', 'ImageName'],
};

/** Restore a specific version of a list item */
export const restoreItemVersion = async (listTitle: string, itemId: number, versionLabel: string): Promise<void> => {
    const versions = await graphGetItemVersions(listTitle, itemId);
    const targetVersion = versions.find((v: any) => v.VersionLabel === versionLabel);
    if (!targetVersion) {
        throw new Error(`Version ${versionLabel} not found`);
    }

    const fields = await graphGetListFields(listTitle);
    const writableFields = new Set(
        fields.filter((f: any) => !f.ReadOnlyField && !f.Hidden).map((f: any) => f.InternalName)
    );

    const allowList = RESTORABLE_FIELDS_BY_LIST[listTitle];
    const allowSet = allowList ? new Set(allowList) : null;

    const fieldsToRestore: Record<string, any> = {};
    Object.keys(targetVersion).forEach((key) => {
        if (!writableFields.has(key)) return;
        if (allowSet && !allowSet.has(key)) return;
        if (key === 'Attachments' || key === 'VersionLabel') return;
        const value = targetVersion[key];
        if (typeof value === 'function' || value === undefined) return;
        fieldsToRestore[key] = value;
    });

    if (Object.keys(fieldsToRestore).length === 0) {
        throw new Error(`No writable fields available to restore for version ${versionLabel}`);
    }

    await graphUpdateListItem(listTitle, itemId, fieldsToRestore);
};

// ==================== Site users / permission groups ====================
//
// Classic SharePoint site groups (Owners/Members/Visitors) are not exposed by
// Microsoft Graph. We call SharePoint REST (_api/web/siteGroups / siteUsers)
// with the signed-in user's SharePoint delegated token — same as PnP in SPFx.

const resolveTripletByWebTitle = async (webTitle: string): Promise<SitePermissionTriplet> => {
    const { spRestFetchAll } = await import('../../../lib/graph/spRestFetch');
    const groups = await spRestFetchAll<{ Id: number; Title: string; Description?: string }>('/_api/web/sitegroups');
    const find = (suffix: string) => groups.find((g) => g.Title === `${webTitle}${suffix}`) || null;
    return {
        owner: find(' Owners'),
        member: find(' Members'),
        visitor: find(' Visitors'),
    };
};

export const getSitePermissionTriplet = async (): Promise<SitePermissionTriplet> => {
    try {
        const { spRestFetchOne } = await import('../../../lib/graph/spRestFetch');
        const webInfo = await spRestFetchOne<{
            Title: string;
            HasUniqueRoleAssignments?: boolean;
            ServerRelativeUrl: string;
        }>('/_api/web?$select=Title,HasUniqueRoleAssignments,ServerRelativeUrl');

        let triplet: SitePermissionTriplet = { owner: null, member: null, visitor: null };

        if (webInfo.HasUniqueRoleAssignments === false) {
            const parentPath = getParentWebRelativeUrl(webInfo.ServerRelativeUrl);
            if (parentPath) {
                try {
                    triplet = await loadAssociatedTripletAtPath(parentPath);
                } catch {
                    /* fall through */
                }
            }
        }

        if (!triplet.owner || !triplet.member || !triplet.visitor) {
            const currentTriplet = await loadAssociatedTriplet();
            triplet = {
                owner: triplet.owner || currentTriplet.owner,
                member: triplet.member || currentTriplet.member,
                visitor: triplet.visitor || currentTriplet.visitor,
            };
        }

        if (!triplet.owner || !triplet.member || !triplet.visitor) {
            const byTitle = await resolveTripletByWebTitle(webInfo.Title);
            triplet = {
                owner: triplet.owner || byTitle.owner,
                member: triplet.member || byTitle.member,
                visitor: triplet.visitor || byTitle.visitor,
            };
        }

        return triplet;
    } catch (error) {
        console.error('Error resolving site permission triplet:', error);
        return { owner: null, member: null, visitor: null };
    }
};

const mapSiteUserToPermissionUser = (user: {
    Id?: number;
    Title?: string;
    Email?: string | null;
    UserPrincipalName?: string | null;
}): PermissionUser => ({
    id: String(user.Id),
    name: user.Title || '',
    email: user.UserPrincipalName || user.Email || '',
});

export const getPermissionGroups = async (): Promise<PermissionGroup[]> => {
    try {
        const triplet = await getSitePermissionTriplet();
        const tripletIds = new Set(
            [triplet.owner?.Id, triplet.member?.Id, triplet.visitor?.Id].filter(
                (id): id is number => id != null
            ).map(String)
        );

        const { spRestFetchAll } = await import('../../../lib/graph/spRestFetch');
        const allGroups = await spRestFetchAll<{ Id: number; Title: string; Description?: string }>(
            '/_api/web/sitegroups'
        ).catch(() => [] as SPGroupRecord[]);

        const siteAdminGroup = allGroups.find(
            (g) => isWebStudioSiteAdminsGroup(g.Title || '') && !tripletIds.has(String(g.Id))
        ) || null;

        const groups = [
            mapSPGroupToPermissionGroup(triplet.owner, 'Owners'),
            mapSPGroupToPermissionGroup(siteAdminGroup, 'SiteAdmin'),
            mapSPGroupToPermissionGroup(triplet.member, 'Members'),
            mapSPGroupToPermissionGroup(triplet.visitor, 'Visitors'),
        ].filter((group): group is PermissionGroup => !!group);

        return sortWebStudioPermissionGroups(groups);
    } catch (error) {
        console.error('Error fetching permission groups dynamically:', error);
        return [];
    }
};

export const getPermissionUsers = async (): Promise<PermissionUser[]> => {
    try {
        const { spRestFetchAll } = await import('../../../lib/graph/spRestFetch');
        const users = await spRestFetchAll<{
            Id: number;
            Title: string;
            Email?: string;
            UserPrincipalName?: string;
        }>('/_api/web/siteusers');

        return users
            .filter((u) => u.Title)
            .map((u) => mapSiteUserToPermissionUser(u));
    } catch (error) {
        console.error('Error fetching permission users via SharePoint REST:', error);
        return [];
    }
};

export const searchPermissionUsers = async (query: string): Promise<PermissionUser[]> => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const results = new Map<string, PermissionUser>();
    const addUser = (user: PermissionUser | null | undefined): void => {
        if (!user?.id || !user.name) return;
        results.set(user.id, user);
    };

    try {
        const { spRestFetchAll } = await import('../../../lib/graph/spRestFetch');
        const escaped = trimmed.replace(/'/g, "''");
        const siteUsers = await spRestFetchAll<{
            Id: number;
            Title: string;
            Email?: string;
            UserPrincipalName?: string;
        }>(
            `/_api/web/siteusers?$filter=substringof('${escaped}',Title) or substringof('${escaped}',Email) or substringof('${escaped}',UserPrincipalName)&$top=20`
        );
        siteUsers.forEach((user) => addUser(mapSiteUserToPermissionUser(user)));
    } catch {
        /* site user filter may fail on some farms */
    }

    if (results.size < 20) {
        try {
            const odataEscaped = trimmed.replace(/'/g, "''");
            const graphPage = await graphFetch<{
                value?: Array<{ id: string; displayName?: string; mail?: string; userPrincipalName?: string }>;
            }>(
                `/users?$filter=startswith(displayName,'${odataEscaped}') or startswith(mail,'${odataEscaped}') or startswith(userPrincipalName,'${odataEscaped}')&$top=20&$select=id,displayName,mail,userPrincipalName`
            );
            for (const gu of graphPage.value || []) {
                const email = gu.mail || gu.userPrincipalName || '';
                if (!email.includes('@')) continue;
                const resolved = await resolvePermissionUserByEmail(email);
                if (resolved) addUser(resolved);
                else addUser({ id: gu.id, name: gu.displayName || email, email });
            }
        } catch {
            /* Graph directory search optional */
        }
    }

    return Array.from(results.values()).slice(0, 20);
};

export const resolvePermissionUserByEmail = async (email: string): Promise<PermissionUser | null> => {
    const trimmed = email.trim();
    if (!trimmed) return null;

    try {
        const { spRestFetchAll, spRestFetch } = await import('../../../lib/graph/spRestFetch');
        const escaped = trimmed.replace(/'/g, "''");
        const users = await spRestFetchAll<{
            Id: number;
            Title: string;
            Email?: string;
            UserPrincipalName?: string;
        }>(
            `/_api/web/siteusers?$filter=Email eq '${escaped}' or UserPrincipalName eq '${escaped}'`
        );

        if (users?.length > 0) {
            const user = users[0];
            return {
                id: String(user.Id),
                name: user.Title,
                email: user.UserPrincipalName || user.Email || trimmed,
            };
        }

        const loginName = trimmed.includes('@') ? `i:0#.f|membership|${trimmed}` : trimmed;
        const ensured = await spRestFetch<{ Id: number; Title: string; Email?: string }>(
            '/_api/web/ensureuser',
            {
                method: 'POST',
                headers: { Accept: 'application/json;odata=verbose', 'Content-Type': 'application/json' },
                body: JSON.stringify({ logonName: loginName }),
            }
        );
        if (ensured?.Id) {
            return {
                id: String(ensured.Id),
                name: ensured.Title,
                email: ensured.Email || trimmed,
            };
        }
        return null;
    } catch (error) {
        console.error('Error resolving permission user by email:', error);
        return null;
    }
};

export const resolveSiteUserLoginName = async (options: {
    userId?: string;
    email?: string;
    groupId?: string;
}): Promise<string | null> => {
    const { userId, email, groupId } = options;

    if (groupId && userId) {
        const gid = parseInt(groupId, 10);
        if (!isNaN(gid)) {
            try {
                const { spRestFetchAll } = await import('../../../lib/graph/spRestFetch');
                const groupUsers = await spRestFetchAll<{ Id?: number; LoginName?: string }>(
                    `/_api/web/sitegroups(${gid})/users`
                );
                const member = groupUsers.find((u) => String(u.Id) === String(userId));
                if (member?.LoginName) return member.LoginName;
            } catch {
                /* try other strategies */
            }
        }
    }

    if (userId) {
        const numericId = parseInt(userId, 10);
        if (!isNaN(numericId)) {
            try {
                const { spRestFetch } = await import('../../../lib/graph/spRestFetch');
                const byId = await spRestFetch<{ LoginName?: string }>(`/_api/web/getuserbyid(${numericId})`);
                if (byId?.LoginName) return byId.LoginName;
            } catch {
                /* try email lookup */
            }
        }
    }

    if (email) {
        const { resolveLoginNameByEmail } = await import('../../../lib/graph/spRestFetch');
        return await resolveLoginNameByEmail(email);
    }

    return null;
};

export const handleRemoveMember = async (
    groupId: string,
    userId: string,
    userEmail: string,
    removeMemberFromGroup: (groupId: string, userId: string) => void
): Promise<void> => {
    try {
        const { spRestFetch, resolveLoginNameByEmail } = await import('../../../lib/graph/spRestFetch');
        const loginName = await resolveLoginNameByEmail(userEmail);

        if (!loginName) {
            console.error(`Failed to resolve login name for ${userEmail}`);
            removeMemberFromGroup(groupId, userId);
            return;
        }

        const numericId = parseInt(groupId, 10);
        if (Number.isNaN(numericId)) {
            console.warn(`Cannot remove member from non-numeric group id "${groupId}" via SharePoint REST`);
            removeMemberFromGroup(groupId, userId);
            return;
        }

        const encodedLogin = encodeURIComponent(loginName);
        await spRestFetch(
            `/_api/web/sitegroups(${numericId})/users/removeByLoginName(@v)?@v='${encodedLogin}'`,
            { method: 'POST' }
        );

        console.log(`✅ Removed user ${userEmail} from group ${groupId}`);
        removeMemberFromGroup(groupId, userId);
    } catch (e) {
        console.error('Error removing user from SharePoint group:', e);
        removeMemberFromGroup(groupId, userId);
    }
};

export const createSPGroup = async (name: string, desc: string): Promise<any> => {
    const { spRestFetch, unwrapSingle } = await import('../../../lib/graph/spRestFetch');
    const payload = await spRestFetch<{ d: { Id: number; Title: string; Description?: string } }>(
        '/_api/web/sitegroups',
        {
            method: 'POST',
            body: {
                __metadata: { type: 'SP.Group' },
                Title: name,
                Description: desc,
            },
        }
    );
    const created = unwrapSingle(payload);

    return { Id: created.Id, Title: created.Title, Description: created.Description };
};

/** Add a user to a classic SharePoint site group by group id and email. */
export const addUserToSiteGroup = async (groupId: string, email: string): Promise<boolean> => {
    try {
        const { spRestFetch, resolveLoginNameByEmail } = await import('../../../lib/graph/spRestFetch');
        const loginName = await resolveLoginNameByEmail(email);

        if (!loginName) {
            console.error(`User with email ${email} not found on site`);
            return false;
        }

        const numericId = parseInt(groupId, 10);
        if (Number.isNaN(numericId)) {
            console.warn(`Cannot add user to non-numeric group id "${groupId}" via SharePoint REST`);
            return false;
        }

        await spRestFetch(`/_api/web/sitegroups(${numericId})/users`, {
            method: 'POST',
            body: {
                __metadata: { type: 'SP.User' },
                LoginName: loginName,
            },
        });

        return true;
    } catch (error) {
        console.error('Error adding user to SharePoint group:', error);
        return false;
    }
};

/** Fetch members of a classic SharePoint site group. */
export const getSiteGroupUsers = async (groupId: string): Promise<PermissionUser[]> => {
    try {
        const numericId = parseInt(groupId, 10);
        if (Number.isNaN(numericId)) {
            return [];
        }

        const { spRestFetchAll } = await import('../../../lib/graph/spRestFetch');
        const users = await spRestFetchAll<{
            Id: number;
            Title: string;
            Email?: string;
            UserPrincipalName?: string;
        }>(`/_api/web/sitegroups(${numericId})/users`);

        return users.map((u) => ({
            id: String(u.Id),
            name: u.Title,
            email: u.UserPrincipalName || u.Email || '',
        }));
    } catch (error) {
        console.error(`Error fetching users for group ${groupId}:`, error);
        return [];
    }
};

// ==================== Section Templates ====================

const parseSectionTemplateItem = (item: any): SectionTemplate => {
    let settings: Record<string, unknown> = {};
    let content: Record<string, unknown> = {};
    let editableFields: string[] = [];

    try {
        if (item.Settings) settings = JSON.parse(item.Settings);
    } catch { /* keep defaults */ }
    try {
        if (item.TemplateContent) content = JSON.parse(item.TemplateContent);
    } catch { /* keep defaults */ }
    try {
        if (item.EditableFields) editableFields = JSON.parse(item.EditableFields);
    } catch { /* keep defaults */ }

    return {
        id: String(item.Id),
        title: item.Title || '',
        description: item.Description || '',
        containerType: item.ContainerType as ContainerType,
        status: item.TemplateStatus === 'Published' ? 'Published' : 'Draft',
        settings,
        content,
        editableFields,
        sortOrder: item.SortOrder ?? 0,
        createdBy: item.Author?.Title,
        modifiedBy: item.Editor?.Title,
        createdDate: item.Created,
        modifiedDate: item.Modified,
    };
};

export const getSectionTemplates = async (): Promise<SectionTemplate[]> => {
    try {
        const items = await getAllListItems('Templates');
        return items.map(parseSectionTemplateItem).sort((a, b) => {
            const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
            if (orderDiff !== 0) return orderDiff;
            return Number(a.id) - Number(b.id);
        });
    } catch (error) {
        console.error('Error loading section templates:', error);
        return [];
    }
};

export const saveSectionTemplate = async (template: SectionTemplate): Promise<SectionTemplate> => {
    const payload = {
        Title: template.title,
        Description: template.description || '',
        ContainerType: template.containerType,
        TemplateStatus: template.status,
        Settings: JSON.stringify(template.settings || {}),
        TemplateContent: JSON.stringify(template.content || {}),
        EditableFields: JSON.stringify(template.editableFields || []),
        SortOrder: template.sortOrder ?? 0,
    };
    const created = await graphAddListItem('Templates', payload);
    const item = await getListItemById('Templates', Number(created.Id));
    return parseSectionTemplateItem(item);
};

export const updateSectionTemplate = async (template: SectionTemplate): Promise<SectionTemplate> => {
    const id = parseInt(template.id, 10);
    if (isNaN(id)) throw new Error('Invalid template id');

    await graphUpdateListItem('Templates', id, {
        Title: template.title,
        Description: template.description || '',
        ContainerType: template.containerType,
        TemplateStatus: template.status,
        Settings: JSON.stringify(template.settings || {}),
        TemplateContent: JSON.stringify(template.content || {}),
        EditableFields: JSON.stringify(template.editableFields || []),
        SortOrder: template.sortOrder ?? 0,
    });

    const item = await getListItemById('Templates', id);
    return parseSectionTemplateItem(item);
};

export const deleteSectionTemplate = async (id: string): Promise<void> => {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return;
    await graphDeleteListItem('Templates', numId);
};

// ==================== Theme Templates ====================

const THEME_TEMPLATES_LIST = 'Theme Templates';

const parseThemeTemplateItem = (item: any): ThemeTemplate => {
    let themeConfig: ThemeConfig = {};
    let stylingConfig: Record<string, unknown> = {};

    try {
        if (item.ThemeConfiguration) themeConfig = JSON.parse(item.ThemeConfiguration);
    } catch { /* keep defaults */ }
    try {
        if (item.StylingConfiguration) stylingConfig = JSON.parse(item.StylingConfiguration);
    } catch { /* keep defaults */ }

    return {
        id: String(item.Id),
        title: item.Title || '',
        themeConfig,
        stylingConfig,
        status: item.TemplateStatus === 'Published' ? 'Published' : 'Draft',
        createdBy: item.Author?.Title,
        modifiedBy: item.Editor?.Title,
        createdDate: item.Created,
        modifiedDate: item.Modified,
    };
};

export const getThemeTemplates = async (_retryCount = 0): Promise<ThemeTemplate[]> => {
    try {
        const items = await getAllListItems(THEME_TEMPLATES_LIST);
        return items
            .map(parseThemeTemplateItem)
            .sort((a, b) => {
                const aTime = a.modifiedDate ? new Date(a.modifiedDate).getTime() : 0;
                const bTime = b.modifiedDate ? new Date(b.modifiedDate).getTime() : 0;
                return bTime - aTime;
            });
    } catch (error) {
        console.error('Error loading theme templates:', error);
        return [];
    }
};

export const saveThemeTemplate = async (template: ThemeTemplate): Promise<ThemeTemplate> => {
    const payload = {
        Title: template.title,
        ThemeConfiguration: JSON.stringify(template.themeConfig || {}),
        StylingConfiguration: JSON.stringify(template.stylingConfig || {}),
        TemplateStatus: template.status,
    };
    const created = await graphAddListItem(THEME_TEMPLATES_LIST, payload);
    const item = await getListItemById(THEME_TEMPLATES_LIST, Number(created.Id));
    return parseThemeTemplateItem(item);
};

export const updateThemeTemplate = async (template: ThemeTemplate): Promise<ThemeTemplate> => {
    const id = parseInt(template.id, 10);
    if (isNaN(id)) throw new Error('Invalid theme template id');

    await graphUpdateListItem(THEME_TEMPLATES_LIST, id, {
        Title: template.title,
        ThemeConfiguration: JSON.stringify(template.themeConfig || {}),
        StylingConfiguration: JSON.stringify(template.stylingConfig || {}),
        TemplateStatus: template.status,
    });

    const item = await getListItemById(THEME_TEMPLATES_LIST, id);
    return parseThemeTemplateItem(item);
};

export const deleteThemeTemplate = async (id: string): Promise<void> => {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return;
    await graphDeleteListItem(THEME_TEMPLATES_LIST, numId);
};

// ==================== WebStudio Role Detection ====================

/** Resolve role from delegated user token (Owners / Site Admins / Members / Visitors). */
export const getWebStudioUserRole = async (): Promise<WebStudioUserRole> => {
    try {
        const { spRestFetchAll } = await import('../../../lib/graph/spRestFetch');
        const triplet = await getSitePermissionTriplet();
        const [groups, siteGroups] = await Promise.all([
            spRestFetchAll<{ Id: number; Title: string }>('/_api/web/currentuser/groups').catch(
                () => [] as { Id: number; Title: string }[]
            ),
            spRestFetchAll<{ Id: number; Title: string }>('/_api/web/sitegroups').catch(
                () => [] as { Id: number; Title: string }[]
            ),
        ]);

        if (groups.length === 0) return 'standard';

        const userGroupIds = groups.map((g) => g.Id);
        const titles = groups.map((g) => g.Title);
        const siteAdminGroup = siteGroups.find((g) => isWebStudioSiteAdminsGroup(g.Title || ''));

        const roleByIds = resolveWebStudioUserRoleFromGroupIds(
            userGroupIds,
            triplet.owner?.Id,
            triplet.member?.Id,
            siteAdminGroup?.Id
        );
        if (roleByIds !== 'standard') return roleByIds;
        return resolveWebStudioUserRoleFromGroupTitles(titles);
    } catch (error) {
        console.error('Error resolving WebStudio user role:', error);
        return 'standard';
    }
};

// ==================== Compatibility helpers (replace old getSP() escape hatch) ====================

/** Absolute URL of the configured SharePoint site (replaces `getSP().web.select('Url')()`). */
export const getSiteAbsoluteUrl = async (): Promise<string> => {
    return await getSiteUrl();
};

export { GraphError };
export { getDriveItemById };
