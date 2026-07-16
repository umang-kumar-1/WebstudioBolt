import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { useOptimizedImageUpload } from './useOptimizedImageUpload';
import { ImageUploadCancelledError } from '../utils/imageUploadPipeline';
import { getUniqueImageFileName, renameFileForUpload } from '../utils/imageFileName';

type UploadImageFn = (
    file: File,
    folderId?: string,
    metadata?: Record<string, unknown>
) => Promise<{ url: string; name: string } | null | undefined>;

type GalleryImage = {
    id: string;
    name: string;
    url: string;
};

export type EditorImageTabId = 'COPY' | 'UPLOAD' | 'CHOOSE';

export interface UseEditorImageTabOptions {
    uploadImage: UploadImageFn;
    images: GalleryImage[];
    folderId?: string;
    titleForNaming: string;
    namingFallback?: string;
    imageUrl: string;
    imageName: string;
    updateField: (key: string, value: unknown) => void;
    /** Atomically patch image-related form fields (avoids stale overwrites in async saves). */
    patchFormData?: (patch: Record<string, unknown>) => void;
    activeTab: string;
    imageTabId?: string;
    metadata?: Record<string, unknown>;
    preserveExistingImageName?: boolean;
    onImageApplied?: (url: string, name: string) => void;
}

export function useEditorImageTab({
    uploadImage,
    images,
    folderId = 'Pictures',
    titleForNaming,
    namingFallback = 'Item',
    imageUrl,
    imageName,
    updateField,
    patchFormData,
    activeTab,
    imageTabId = 'IMAGE',
    metadata,
    preserveExistingImageName = false,
    onImageApplied,
}: UseEditorImageTabOptions) {
    const imageUpload = useOptimizedImageUpload(uploadImage);
    const [imgTab, setImgTab] = useState<EditorImageTabId>('COPY');
    const [searchImg, setSearchImg] = useState('');
    const [copyPastePreviewUrl, setCopyPastePreviewUrl] = useState('');
    const [newImageName, setNewImageName] = useState(imageName || '');
    const [imagePreviewToken, setImagePreviewToken] = useState(() => Date.now());
    const [isUploading, setIsUploading] = useState(false);
    const pasteAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setNewImageName(imageName || '');
    }, [imageName]);

    useEffect(() => {
        if (!imageUrl) {
            setCopyPastePreviewUrl('');
            return;
        }
        if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
            setCopyPastePreviewUrl(imageUrl);
            return;
        }
        setCopyPastePreviewUrl('');
        setImagePreviewToken(Date.now());
    }, [imageUrl]);

    const commitImageFields = useCallback((url: string, name: string) => {
        const token = Date.now();
        if (patchFormData) {
            patchFormData({
                imageUrl: url,
                imageName: name,
                imageCacheToken: token,
            });
        } else {
            updateField('imageUrl', url);
            updateField('imageName', name);
            updateField('imageCacheToken', token);
        }
        setNewImageName(name);
        setImagePreviewToken(token);
        if (url.startsWith('http://') || url.startsWith('https://')) {
            setCopyPastePreviewUrl('');
        } else {
            setCopyPastePreviewUrl(url);
        }
    }, [patchFormData, updateField]);

    const getUniqueImageName = useCallback((file?: File | null) => {
        if (preserveExistingImageName) {
            const existing = String(imageName || '').trim();
            if (existing) return existing;
        }

        const existingNames = [
            ...images.map((img) => String(img.name || '')),
            String(imageName || ''),
            String(newImageName || ''),
        ];
        const fallbackBaseName = (titleForNaming || namingFallback).trim() || 'image';
        return getUniqueImageFileName(file, existingNames, fallbackBaseName);
    }, [preserveExistingImageName, imageName, images, newImageName, namingFallback, titleForNaming]);

    const applyUploadedImage = useCallback((url: string, name: string) => {
        commitImageFields(url, name);
        onImageApplied?.(url, name);
    }, [commitImageFields, onImageApplied]);

    const uploadEditorImage = useCallback(async (file: File) => {
        const targetName = (preserveExistingImageName && String(imageName || newImageName || '').trim())
            ? String(imageName || newImageName).trim()
            : getUniqueImageName(file);
        setNewImageName(targetName);
        updateField('imageName', targetName);
        setIsUploading(true);
        try {
            const prepared = await imageUpload.prepareFile(file);
            const uploadFile = renameFileForUpload(prepared.file, targetName);
            const uploadedImage = await uploadImage(uploadFile, folderId, metadata);
            if (uploadedImage) {
                applyUploadedImage(uploadedImage.url, targetName);
            }
        } catch (err) {
            if (err instanceof ImageUploadCancelledError) return;
            throw err;
        } finally {
            setIsUploading(false);
        }
    }, [
        applyUploadedImage,
        folderId,
        getUniqueImageName,
        imageName,
        imageUpload,
        metadata,
        newImageName,
        preserveExistingImageName,
        uploadImage,
        updateField,
    ]);

    const processClipboardData = useCallback(async (clipboardData?: DataTransfer | null) => {
        if (!clipboardData) return false;

        const imageItems = Array.from(clipboardData.items || []).filter((clipboardItem) => clipboardItem.type.startsWith('image/'));
        for (const clipboardItem of imageItems) {
            const fileFromItem = clipboardItem.getAsFile();
            if (fileFromItem) {
                await uploadEditorImage(fileFromItem);
                return true;
            }
        }

        const fileFromFiles = Array.from(clipboardData.files || []).find((clipboardFile) => clipboardFile.type.startsWith('image/'));
        if (fileFromFiles) {
            await uploadEditorImage(fileFromFiles);
            return true;
        }

        return false;
    }, [uploadEditorImage]);

    const handlePaste = useCallback(async (e: ClipboardEvent<HTMLElement>) => {
        const uploaded = await processClipboardData(e.clipboardData);
        if (uploaded) {
            e.preventDefault();
        }
    }, [processClipboardData]);

    useEffect(() => {
        if (activeTab !== imageTabId || imgTab !== 'COPY') return;

        const handleWindowPaste = (event: globalThis.ClipboardEvent) => {
            processClipboardData(event.clipboardData).then((uploaded) => {
                if (uploaded) {
                    event.preventDefault();
                }
            }).catch(console.error);
        };

        window.addEventListener('paste', handleWindowPaste);
        return () => window.removeEventListener('paste', handleWindowPaste);
    }, [activeTab, imageTabId, imgTab, processClipboardData]);

    const handleUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        await uploadEditorImage(file);
    }, [uploadEditorImage]);

    const handleGallerySelect = useCallback((img: GalleryImage) => {
        commitImageFields(img.url, img.name);
    }, [commitImageFields]);

    const clearImage = useCallback(() => {
        commitImageFields('', '');
    }, [commitImageFields]);

    const handleImageNameChange = useCallback((value: string) => {
        setNewImageName(value);
        updateField('imageName', value);
    }, [updateField]);

    const handleImageSaved = useCallback((url: string, name: string) => {
        applyUploadedImage(url, name);
    }, [applyUploadedImage]);

    const filteredGallery = images.filter((img) => img.name.toLowerCase().includes(searchImg.toLowerCase()));
    const isBusy = isUploading || imageUpload.isBusy;

    return {
        imgTab,
        setImgTab,
        searchImg,
        setSearchImg,
        copyPastePreviewUrl,
        newImageName,
        imagePreviewToken,
        pasteAreaRef,
        imageUpload,
        isUploading,
        isBusy,
        filteredGallery,
        handlePaste,
        handleUpload,
        handleGallerySelect,
        clearImage,
        handleImageNameChange,
        handleImageSaved,
        imageUrl,
        imageName,
    };
}
