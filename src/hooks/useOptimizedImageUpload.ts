import { useCallback, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { useImageOptimizer } from './useImageOptimizer';
import { toBlobFile } from '../utils/imageUploadPipeline';

type UploadImageFn = (
    file: File,
    folderId?: string,
    metadata?: Record<string, unknown>
) => Promise<unknown>;

export function useOptimizedImageUpload(uploadImageFn: UploadImageFn) {
    const optimizer = useImageOptimizer();
    const [isUploading, setIsUploading] = useState(false);

    const uploadFile = useCallback(
        async (file: File, folderId?: string, metadata?: Record<string, unknown>) => {
            setIsUploading(true);
            try {
                const prepared = await optimizer.prepareFile(file);
                return await uploadImageFn(prepared.file, folderId, metadata);
            } finally {
                setIsUploading(false);
            }
        },
        [optimizer, uploadImageFn]
    );

    const uploadBlob = useCallback(
        async (
            blob: Blob,
            folderId?: string,
            metadata?: Record<string, unknown>,
            name = 'pasted-image.png'
        ) => uploadFile(toBlobFile(blob, name), folderId, metadata),
        [uploadFile]
    );

    const handleFileInputChange = useCallback(
        (folderId?: string, metadata?: Record<string, unknown>) =>
            (e: ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file || !file.type.startsWith('image/')) return;
                optimizer.clearStats();
                uploadFile(file, folderId, metadata).catch(console.error);
            },
        [optimizer, uploadFile]
    );

    const handlePaste = useCallback(
        (folderId?: string, metadata?: Record<string, unknown>) =>
            (e: ClipboardEvent<HTMLElement>) => {
                const items = e.clipboardData?.items;
                if (!items) return;

                for (const item of Array.from(items)) {
                    if (item.type.indexOf('image') === -1) continue;
                    const blob = item.getAsFile();
                    if (!blob) continue;
                    e.preventDefault();
                    optimizer.clearStats();
                    uploadBlob(blob, folderId, metadata).catch(console.error);
                    break;
                }
            },
        [optimizer, uploadBlob]
    );

    const isBusy = isUploading || optimizer.isOptimizing;

    return {
        uploadFile,
        uploadBlob,
        prepareFile: optimizer.prepareFile,
        handleFileInputChange,
        handlePaste,
        isUploading,
        isOptimizing: optimizer.isOptimizing,
        isBusy,
        stats: optimizer.stats,
        error: optimizer.error,
        clearStats: optimizer.clearStats,
    };
}
