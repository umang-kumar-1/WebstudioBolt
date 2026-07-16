export type ImageOutputFormat = 'webp' | 'jpeg' | 'png';

export interface ImageOptimizationConfig {
    outputFormat: ImageOutputFormat;
    quality: number;
    maxDimension: number;
    stripExif: boolean;
    sharpen: boolean;
}

export const imageOptimizationConfig: ImageOptimizationConfig = {
    outputFormat: 'webp',
    quality: 0.85,
    maxDimension: 1920,
    stripExif: true,
    sharpen: true,
};

export interface OptimizeImageResult {
    blob: Blob;
    url: string;
    originalSize: number;
    optimizedSize: number;
    width: number;
    height: number;
}

let webpCanvasSupported: boolean | null = null;

function canvasSupportsMime(mime: string): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const dataUrl = canvas.toDataURL(mime, 0.5);
    return dataUrl.startsWith(`data:${mime}`);
}

function supportsWebpEncoding(): boolean {
    if (webpCanvasSupported === null) {
        webpCanvasSupported = canvasSupportsMime('image/webp');
    }
    return webpCanvasSupported;
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(`Failed to decode image "${file.name}".`));
        };
        img.src = objectUrl;
    });
}

function getScaledDimensions(
    width: number,
    height: number,
    maxDimension: number
): { width: number; height: number } {
    if (!maxDimension || maxDimension <= 0) {
        return { width, height };
    }
    const longest = Math.max(width, height);
    if (longest <= maxDimension) {
        return { width, height };
    }
    const scale = maxDimension / longest;
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

function imageHasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
    const { data } = ctx.getImageData(0, 0, width, height);
    for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) {
            return true;
        }
    }
    return false;
}

function applySharpenKernel(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const imageData = ctx.getImageData(0, 0, width, height);
    const src = imageData.data;
    const out = new Uint8ClampedArray(src.length);

    const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0,
    ];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const dst = (y * width + x) * 4;
            for (let c = 0; c < 3; c++) {
                let sum = 0;
                let ki = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const sx = ((y + ky) * width + (x + kx)) * 4 + c;
                        sum += src[sx] * kernel[ki];
                        ki++;
                    }
                }
                out[dst + c] = Math.min(255, Math.max(0, sum));
            }
            out[dst + 3] = src[dst + 3];
        }
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
                out[i] = src[i];
                out[i + 1] = src[i + 1];
                out[i + 2] = src[i + 2];
                out[i + 3] = src[i + 3];
            }
        }
    }

    imageData.data.set(out);
    ctx.putImageData(imageData, 0, 0);
}

function resolveOutputMime(
    file: File,
    config: ImageOptimizationConfig,
    hasTransparency: boolean
): string {
    if (hasTransparency && config.outputFormat !== 'jpeg') {
        if (config.outputFormat === 'png') {
            return 'image/png';
        }
        if (config.outputFormat === 'webp' && supportsWebpEncoding()) {
            return 'image/webp';
        }
        return 'image/png';
    }

    if (config.outputFormat === 'webp' && supportsWebpEncoding()) {
        return 'image/webp';
    }

    if (config.outputFormat === 'png') {
        return 'image/png';
    }

    return 'image/jpeg';
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    mimeType: string,
    quality: number
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const useQuality = mimeType === 'image/jpeg' || mimeType === 'image/webp';
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error(`Failed to encode image as ${mimeType}.`));
                    return;
                }
                resolve(blob);
            },
            mimeType,
            useQuality ? quality : undefined
        );
    });
}

export function getOptimizedFileName(originalName: string, mimeType: string): string {
    const base = (originalName || 'image').replace(/\.[^.]+$/, '') || 'image';
    if (mimeType === 'image/webp') return `${base}.webp`;
    if (mimeType === 'image/png') return `${base}.png`;
    return `${base}.jpg`;
}

export async function optimizeImage(
    file: File,
    config: ImageOptimizationConfig = imageOptimizationConfig
): Promise<OptimizeImageResult> {
    if (!file.type.startsWith('image/')) {
        throw new Error(`"${file.name}" is not an image file.`);
    }

    const originalSize = file.size;
    const img = await loadImageElement(file);
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;

    if (!naturalWidth || !naturalHeight) {
        throw new Error(`"${file.name}" has invalid dimensions.`);
    }

    const { width, height } = getScaledDimensions(
        naturalWidth,
        naturalHeight,
        config.maxDimension
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: true });

    if (!ctx) {
        throw new Error('Canvas 2D context is not available.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const hasTransparency = imageHasTransparency(ctx, width, height);

    if (config.sharpen && (naturalWidth !== width || naturalHeight !== height)) {
        applySharpenKernel(ctx, width, height);
    }

    const mimeType = resolveOutputMime(file, config, hasTransparency);
    const quality = Math.min(1, Math.max(0.5, config.quality));
    const blob = await canvasToBlob(canvas, mimeType, quality);
    const url = URL.createObjectURL(blob);

    return {
        blob,
        url,
        originalSize,
        optimizedSize: blob.size,
        width,
        height,
    };
}
