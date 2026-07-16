/**
 * Photo Gallery service — rewritten from @pnp/sp to Microsoft Graph.
 * Keeps the exact same public class API as before so ImageManagementParent, FolderList,
 * PhotoGallery, ImageUploader and ImageEditorModal did not need any changes.
 */
import {
  getAllListItems,
  getListItemById,
  updateListItem,
  deleteListItem as graphDeleteListItem,
} from '../../../lib/graph/listItems';
import {
  listDriveFolders,
  uploadFileToLibrary,
  setFileContent,
  renameOrMoveDriveItem,
  checkFileExists,
} from '../../../lib/graph/driveFiles';
import { graphFetch } from '../../../lib/graph/graphFetch';
import { getLibraryDriveId } from '../../../lib/graph/siteResolver';
import { Image, Folder } from '../components/types';

const getListItemIdForDriveItem = async (libraryTitle: string, driveItemId: string): Promise<number> => {
    const driveId = await getLibraryDriveId(libraryTitle);
    const listItem = await graphFetch<{ id: string }>(`/drives/${driveId}/items/${driveItemId}/listItem?$select=id`);
    return Number(listItem.id);
};

export class PhotoGalleryService {
    // The SPFx WebPartContext parameter is no longer required (auth is handled globally via
    // MSAL/Graph); kept for call-site compatibility with existing `new PhotoGalleryService(context)`.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_context?: unknown) {}

    private guidToNumber(id: string): number {
        // Drive item ids aren't GUIDs like SP's UniqueId; hash the string into a stable number.
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = (hash * 31 + id.charCodeAt(i)) | 0;
        }
        return Math.abs(hash);
    }

    public async getFolders(libraryName: string): Promise<Folder[]> {
        try {
            const folders = await listDriveFolders(libraryName);
            return folders.map((f) => ({
                id: this.guidToNumber(f.id),
                name: f.name,
                serverRelativeUrl: f.webUrl,
            }));
        } catch (error) {
            console.error('Error fetching folders:', error);
            return [];
        }
    }

    public async getImages(libraryName: string, folders: Folder[]): Promise<Image[]> {
        try {
            const items = await getAllListItems(libraryName, true);

            const mappedImages = items
                .filter((item) => item.FSObjType !== 1)
                .map((item) => {
                    const fileUrl: string = item.EncodedAbsUrl || item.FileRef;
                    if (!fileUrl || !fileUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i)) return null;

                    const versionParam = item.Modified || item.DriveItemId || Date.now().toString();
                    const cacheBustedUrl = `${fileUrl}?v=${encodeURIComponent(versionParam)}`;

                    return {
                        id: item.Id,
                        folderId: this.resolveFolderId(fileUrl, folders),
                        src: cacheBustedUrl,
                        name: item.FileLeafRef,
                        title: item.Title || '',
                        description: item.Description || '',
                        created: item.Created,
                        modified: item.Modified,
                        modifiedDate: item.Modified,
                        authorId: item.Author?.Id,
                        author: item.Author?.Title,
                        editorId: item.Editor?.Id,
                        editor: item.Editor?.Title,
                        uniqueId: item.DriveItemId,
                        width: item.ImageWidth,
                        height: item.ImageHeight,
                        imageCompression: item.ImageCompression ?? 100,
                        originalFileSizeBytes:
                            item.OriginalFileSize ||
                            ((item.ImageCompression ?? 100) >= 100 ? (item.File?.Length || 0) : 0),
                        fileSizeBytes: item.File?.Length || 0,
                    } as Image;
                })
                .filter((i): i is Image => i !== null);

            return mappedImages;
        } catch (error) {
            console.error('Error fetching images:', error);
            return [];
        }
    }

    private resolveFolderId(fileUrl: string, folders: Folder[]): number {
        try {
            const url = new URL(fileUrl.startsWith('http') ? fileUrl : window.location.origin + fileUrl);
            const pathSegments = url.pathname.split('/').filter(Boolean);

            for (let i = pathSegments.length - 2; i >= 0; i--) {
                const segment = decodeURIComponent(pathSegments[i]).toLowerCase();
                const folder = folders.find((f) => f.name.toLowerCase() === segment);
                if (folder) return folder.id;
            }
            return 0;
        } catch {
            const urlPart = decodeURIComponent(fileUrl).toLowerCase();
            for (const folder of folders) {
                if (urlPart.includes(`/${folder.name.toLowerCase()}/`)) {
                    return folder.id;
                }
            }
            return 0;
        }
    }

    public async uploadImage(
        libraryName: string,
        imageFile: Blob,
        fileName: string,
        folderName: string,
        metadata: {
            title?: string;
            description?: string;
            altText?: string;
            copyright?: string;
            keywords?: string;
            imageCompression?: number;
            originalFileSize?: number;
        }
    ): Promise<void> {
        let fileToUpload: Blob = imageFile;
        let uploadFileName = fileName;
        if (imageFile.type.startsWith('image/')) {
            const { prepareImageFile, toBlobFile } = await import(
                /* webpackChunkName: 'optimize-image' */ '../../../utils/imageUploadPipeline'
            );
            const sourceFile = toBlobFile(imageFile, fileName);
            const prepared = await prepareImageFile(sourceFile);
            fileToUpload = prepared.blob;
            uploadFileName = prepared.file.name;
        }

        const folder = folderName && folderName !== 'All Images' && folderName !== '' ? folderName : undefined;

        let finalFileName = uploadFileName;
        try {
            const exists = await checkFileExists(libraryName, folder || '', uploadFileName);
            if (exists) {
                const extension = uploadFileName.includes('.') ? uploadFileName.substring(uploadFileName.lastIndexOf('.')) : '';
                const baseName = uploadFileName.replace(extension, '');
                finalFileName = `${baseName}_${Date.now()}${extension}`;
            }
        } catch (e) {
            console.warn('Error checking for existing files, proceeding with original name', e);
        }

        const uploaded = await uploadFileToLibrary(libraryName, folder, finalFileName, fileToUpload, true);
        const itemId = await getListItemIdForDriveItem(libraryName, uploaded.id);

        await updateListItem(libraryName, itemId, {
            Title: metadata.title || '',
            Description: metadata.description || '',
            AltText: metadata.altText || '',
            CopyrightInfo: metadata.copyright || '',
            Keywords: metadata.keywords || '',
            ImageCompression: metadata.imageCompression ?? 100,
            OriginalFileSize: metadata.originalFileSize ?? 0,
        });
    }

    public async updateImage(
        libraryName: string,
        itemId: number,
        metadata: {
            title?: string;
            description?: string;
            altText?: string;
            copyright?: string;
            keywords?: string;
            imageCompression?: number;
            originalFileSize?: number;
        },
        newBlob?: Blob,
        newFileName?: string
    ): Promise<void> {
        const itemProps = await getListItemById(libraryName, itemId, true);

        if (newBlob && itemProps.DriveItemId) {
            await setFileContent(libraryName, itemProps.DriveItemId, newBlob);
        }

        if (newFileName && itemProps.FileLeafRef !== newFileName && itemProps.DriveItemId) {
            await renameOrMoveDriveItem(libraryName, itemProps.DriveItemId, { name: newFileName });
        }

        const updatePayload: Record<string, unknown> = {
            Title: metadata.title,
            Description: metadata.description,
            AltText: metadata.altText,
            CopyrightInfo: metadata.copyright,
            Keywords: metadata.keywords,
        };
        if (metadata.imageCompression !== undefined) {
            updatePayload.ImageCompression = metadata.imageCompression;
        }
        if (metadata.originalFileSize !== undefined) {
            updatePayload.OriginalFileSize = metadata.originalFileSize;
        }
        await updateListItem(libraryName, itemId, updatePayload);
    }

    public async deleteImage(libraryName: string, itemId: number): Promise<void> {
        try {
            await graphDeleteListItem(libraryName, itemId);
        } catch (error) {
            console.error('Error deleting image:', error);
            throw error;
        }
    }
}
