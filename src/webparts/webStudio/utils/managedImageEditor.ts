import { ImageItem } from '../types';
import { Image as ManagedImage, Folder as ManagedFolder } from '../../imageManagement/components/types';
import { useStore } from '../store';
import { ImageUploadCancelledError } from '../../../utils/imageUploadPipeline';
import { withImageCacheBust } from './imageCache';

const resolveEditorImageSrc = (imageUrl: string, selectedImage: ImageItem): string => {
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
        return selectedImage.url || imageUrl;
    }
    const baseUrl = selectedImage.url || imageUrl;
    return withImageCacheBust(baseUrl, selectedImage.modifiedDate || Date.now());
};

export const normalizeImageUrlKey = (url: string): string => {
    if (!url) return '';
    try {
        const parsed = new URL(url, window.location.origin);
        return decodeURIComponent(parsed.pathname).toLowerCase();
    } catch {
        return url.split('?')[0].toLowerCase();
    }
};

export const findImageByUrl = (gallery: ImageItem[], url: string): ImageItem | undefined => {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return undefined;
    const key = normalizeImageUrlKey(url);
    if (!key) return undefined;
    return gallery.find((img) => normalizeImageUrlKey(img.url || '') === key);
};

export const findGalleryImage = (
    gallery: ImageItem[],
    managed: Omit<ManagedImage, 'id'> & { id?: number },
    currentUrl: string
): ImageItem | undefined => {
    const managedId = Number(managed.id);
    if (Number.isFinite(managedId) && managedId > 0) {
        const byId = gallery.find((img) => Number(img.id) === managedId);
        if (byId) return byId;
    }

    const editedSrc = managed.src || currentUrl;
    const byUrl = findImageByUrl(gallery, currentUrl) || findImageByUrl(gallery, editedSrc);
    if (byUrl) return byUrl;

    const imageName = String(managed.name || '').trim();
    if (imageName) {
        return gallery.find((img) => img.name?.toLowerCase() === imageName.toLowerCase());
    }

    return undefined;
};

export const toManagedFolders = (
    imageFolders: { id: string | number; name: string }[]
): ManagedFolder[] =>
    imageFolders
        .filter((folder) => folder.id !== 'all')
        .map((folder) => ({ id: Number(folder.id), name: folder.name }))
        .filter((folder) => Number.isFinite(folder.id));

export const toManagedImages = (images: ImageItem[]): ManagedImage[] =>
    images
        .map((img) => ({
            id: Number(img.id),
            folderId: Number(img.folderId) || 0,
            src: img.url,
            name: img.name || '',
            title: img.title || img.name || '',
            description: img.description || '',
            created: img.createdDate,
            modifiedDate: img.modifiedDate,
            author: img.createdBy,
            editor: img.modifiedBy,
        }))
        .filter((img) => Number.isFinite(img.id));

export const buildManagedImageToEdit = (
    imageUrl: string,
    gallery: ImageItem[],
    imageName?: string
): ManagedImage | undefined => {
    if (!imageUrl) return undefined;
    const fileNameFromUrl = imageUrl.split('/').pop()?.split('?')[0] || 'image';
    const selectedImage =
        findImageByUrl(gallery, imageUrl) ||
        (imageName
            ? gallery.find((img) => img.name?.toLowerCase() === imageName.toLowerCase())
            : undefined);
    if (selectedImage) {
        const id = Number(selectedImage.id);
        const resolvedUrl = resolveEditorImageSrc(imageUrl, selectedImage);
        return {
            id: Number.isFinite(id) ? id : 0,
            folderId: Number(selectedImage.folderId) || 0,
            src: resolvedUrl,
            name: selectedImage.name || imageName || fileNameFromUrl,
            title: selectedImage.title || selectedImage.name || '',
            description: selectedImage.description || '',
            created: selectedImage.createdDate,
            modifiedDate: selectedImage.modifiedDate,
            author: selectedImage.createdBy,
            editor: selectedImage.modifiedBy,
            width: selectedImage.width,
            height: selectedImage.height,
        };
    }
    return {
        id: 0,
        folderId: 0,
        src: imageUrl,
        name: imageName || fileNameFromUrl,
        title: imageName || fileNameFromUrl,
        description: '',
        created: '',
        modifiedDate: '',
        author: '',
        editor: '',
    };
};

const dataUrlToFile = async (dataUrl: string, fileName: string): Promise<File> => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const mimeType = blob.type || dataUrl.match(/^data:([^;]+)/)?.[1] || 'image/png';
    return new File([blob], fileName, { type: mimeType });
};

const resolveSharePointUrl = (
    candidate: string | undefined,
    fallback: string
): string => {
    if (candidate && (candidate.startsWith('http://') || candidate.startsWith('https://'))) {
        return candidate;
    }
    if (fallback.startsWith('http://') || fallback.startsWith('https://')) {
        return fallback;
    }
    return '';
};

const isInlineImageUrl = (url: string): boolean =>
    url.startsWith('data:') || url.startsWith('blob:');

const pickSharePointUrl = (
    ...candidates: Array<string | undefined>
): string => {
    for (const candidate of candidates) {
        const resolved = resolveSharePointUrl(candidate, '');
        if (resolved) return resolved;
    }
    return '';
};

type UploadImageFn = (
    file: File,
    folderId?: string,
    metadata?: Record<string, unknown>
) => Promise<ImageItem | null>;

export const createManagedImageSaveHandler = (
    updateImage: (image: ImageItem) => Promise<ImageItem | null>,
    uploadImage: UploadImageFn,
    currentUrl: string,
    onSaved: (url: string, name: string) => void
) => {
    return async (managed: Omit<ManagedImage, 'id'> & { id?: number }) => {
        const editedSrc = managed.src || currentUrl;
        const imageName = String(managed.name || '').trim();
        const gallery = useStore.getState().images;
        const galleryImage = findGalleryImage(gallery, managed, currentUrl);
        const galleryId = galleryImage ? Number(galleryImage.id) : NaN;
        const isDataUrl = isInlineImageUrl(editedSrc);

        let sharePointUrl = pickSharePointUrl(galleryImage?.url, currentUrl);
        let finalName = imageName || galleryImage?.name || '';

        try {
            if (galleryImage && Number.isFinite(galleryId) && galleryId > 0) {
                const updated = await updateImage({
                    ...galleryImage,
                    url: editedSrc,
                    name: imageName || galleryImage.name,
                    title: managed.title || galleryImage.title,
                    description: managed.description || galleryImage.description,
                    folderId: String(managed.folderId || galleryImage.folderId),
                });
                sharePointUrl = pickSharePointUrl(updated?.url, galleryImage.url, sharePointUrl);
                finalName = updated?.name || finalName;
            } else if (isDataUrl) {
                const file = await dataUrlToFile(editedSrc, imageName || 'image.png');
                const { prepareImageFile } = await import(
                    /* webpackChunkName: 'optimize-image' */ '../../../utils/imageUploadPipeline'
                );
                const prepared = await prepareImageFile(file);
                const folderId =
                    managed.folderId && Number(managed.folderId) > 0
                        ? String(managed.folderId)
                        : 'Pictures';
                const uploaded = await uploadImage(prepared.file, folderId, {
                    Title: managed.title || imageName,
                    Description: managed.description || '',
                });
                sharePointUrl = pickSharePointUrl(uploaded?.url, sharePointUrl);
                finalName = uploaded?.name || finalName;
            } else {
                sharePointUrl = pickSharePointUrl(editedSrc, sharePointUrl);
            }
        } catch (error) {
            if (error instanceof ImageUploadCancelledError) return;
            console.error('Managed image save failed:', error);
            sharePointUrl = pickSharePointUrl(galleryImage?.url, sharePointUrl);
        }

        if (isInlineImageUrl(sharePointUrl)) {
            sharePointUrl = pickSharePointUrl(galleryImage?.url, currentUrl);
        }

        onSaved(sharePointUrl, finalName);
    };
};
