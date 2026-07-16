import {
    getOptimizedFileName,
    imageOptimizationConfig,
    optimizeImage,
    type ImageOptimizationConfig,
    type OptimizeImageResult,
} from './optimizeImage';
import { requestImageOptimizationConfirm } from './imageOptimizationConfirm';

export type { ImageOptimizationConfig, OptimizeImageResult };
export { imageOptimizationConfig, optimizeImage };

export interface ImageOptimizationStats {
    originalSize: number;
    optimizedSize: number;
    width: number;
    height: number;
    percentSaved: number;
    wasOptimized?: boolean;
}

export function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function statsFromOptimizeResult(result: OptimizeImageResult): ImageOptimizationStats {
    const saved =
        result.originalSize > 0
            ? Math.round(((result.originalSize - result.optimizedSize) / result.originalSize) * 100)
            : 0;
    return {
        originalSize: result.originalSize,
        optimizedSize: result.optimizedSize,
        width: result.width,
        height: result.height,
        percentSaved: Math.max(0, saved),
        wasOptimized: true,
    };
}

export function blobToOptimizedFile(
    blob: Blob,
    originalName: string,
    mimeType: string
): File {
    const name = getOptimizedFileName(originalName, mimeType);
    return new File([blob], name, { type: mimeType, lastModified: Date.now() });
}

export interface PreparedImageUpload {
    file: File;
    blob: Blob;
    previewUrl: string;
    stats: ImageOptimizationStats;
    wasOptimized: boolean;
}

export type ImagePrepareOptions = {
    skipConfirm?: boolean;
    onOptimizeStart?: () => void;
};

export class ImageUploadCancelledError extends Error {
    constructor() {
        super('Image upload cancelled');
        this.name = 'ImageUploadCancelledError';
    }
}

async function loadImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({
                width: img.naturalWidth || img.width || 0,
                height: img.naturalHeight || img.height || 0,
            });
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({ width: 0, height: 0 });
        };
        img.src = objectUrl;
    });
}

export async function prepareOriginalImageFile(file: File): Promise<PreparedImageUpload> {
    const previewUrl = URL.createObjectURL(file);
    const { width, height } = await loadImageDimensions(file);
    return {
        file,
        blob: file,
        previewUrl,
        stats: {
            originalSize: file.size,
            optimizedSize: file.size,
            width,
            height,
            percentSaved: 0,
            wasOptimized: false,
        },
        wasOptimized: false,
    };
}

async function optimizeImageFile(
    file: File,
    config: ImageOptimizationConfig = imageOptimizationConfig
): Promise<PreparedImageUpload> {
    const result = await optimizeImage(file, config);
    const mimeType = result.blob.type || 'image/jpeg';
    return {
        file: blobToOptimizedFile(result.blob, file.name, mimeType),
        blob: result.blob,
        previewUrl: result.url,
        stats: statsFromOptimizeResult(result),
        wasOptimized: true,
    };
}

export async function prepareImageFile(
    file: File,
    config: ImageOptimizationConfig = imageOptimizationConfig,
    options?: ImagePrepareOptions
): Promise<PreparedImageUpload> {
    if (!file.type.startsWith('image/')) {
        throw new Error(`"${file.name}" is not an image file.`);
    }

    if (!options?.skipConfirm) {
        const shouldOptimize = await requestImageOptimizationConfirm(file);
        if (shouldOptimize === null) {
            throw new ImageUploadCancelledError();
        }
        if (!shouldOptimize) {
            return prepareOriginalImageFile(file);
        }
    }

    options?.onOptimizeStart?.();
    return optimizeImageFile(file, config);
}

export async function prepareImageFiles(
    files: File[],
    config: ImageOptimizationConfig = imageOptimizationConfig,
    options?: ImagePrepareOptions
): Promise<PreparedImageUpload[]> {
    return Promise.all(files.map((file) => prepareImageFile(file, config, options)));
}

export function toBlobFile(blob: Blob, name = 'pasted-image.png'): File {
    return new File([blob], name, { type: blob.type || 'image/png', lastModified: Date.now() });
}
