/** 0.5 MB floor for compression slider at 0%. */
export const COMPRESSION_TARGET_MIN_BYTES = 524288;

export const DEFAULT_IMAGE_COMPRESSION = 100;

export function formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** 100% = current/max size; 0% = 0.5 MB floor (or current size if already smaller). */
export function getDisplayFileSize(maxBytes: number, compressionPercent: number): number {
    if (!maxBytes || maxBytes <= 0) return 0;
    const pct = Math.min(100, Math.max(0, compressionPercent));
    const floor = Math.min(COMPRESSION_TARGET_MIN_BYTES, maxBytes);
    if (pct >= 100) return maxBytes;
    if (pct <= 0) return floor;
    return Math.round(floor + (maxBytes - floor) * (pct / 100));
}

/** Target byte size when encoding the canvas for save/preview. */
export function getTargetFileSize(originalBytes: number, compressionPercent: number): number {
    return getDisplayFileSize(originalBytes, compressionPercent);
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode canvas'))),
            mimeType,
            quality
        );
    });
}

function pickExportMimeType(fileName?: string): { mime: string; useQuality: boolean } {
    const lower = (fileName || '').toLowerCase();
    if (lower.endsWith('.png')) {
        return { mime: 'image/png', useQuality: false };
    }
    if (lower.endsWith('.webp')) {
        return { mime: 'image/webp', useQuality: true };
    }
    return { mime: 'image/jpeg', useQuality: true };
}

async function encodeCanvasAtQuality(
    canvas: HTMLCanvasElement,
    mime: string,
    quality: number,
    useQuality: boolean
): Promise<Blob> {
    if (mime === 'image/png' || !useQuality) {
        return canvasToBlob(canvas, mime);
    }
    return canvasToBlob(canvas, mime, quality);
}

/** Pick the highest quality whose encoded size stays at or below targetBytes. */
async function encodeCanvasToMaxBytes(
    canvas: HTMLCanvasElement,
    mime: string,
    targetBytes: number,
    useQuality: boolean
): Promise<Blob> {
    if (!useQuality) {
        const png = await canvasToBlob(canvas, 'image/png');
        if (png.size <= targetBytes) return png;
        return encodeCanvasToMaxBytes(canvas, 'image/jpeg', targetBytes, true);
    }

    let low = 0.05;
    let high = 0.95;
    let best = await encodeCanvasAtQuality(canvas, mime, low, true);

    for (let i = 0; i < 14; i++) {
        const mid = (low + high) / 2;
        const blob = await encodeCanvasAtQuality(canvas, mime, mid, true);
        if (blob.size <= targetBytes) {
            best = blob;
            low = mid;
        } else {
            high = mid;
        }
    }

    return best;
}

/** Encode canvas toward targetBytes (100% = maxBytes, 0% = 0.5 MB floor). */
export async function exportCanvasWithCompression(
    canvas: HTMLCanvasElement,
    compressionPercent: number,
    maxFileSizeBytes: number,
    fileName?: string
): Promise<Blob> {
    const { mime, useQuality } = pickExportMimeType(fileName);

    if (!maxFileSizeBytes) {
        return encodeCanvasAtQuality(canvas, mime, 0.92, useQuality);
    }

    const targetBytes = getTargetFileSize(maxFileSizeBytes, compressionPercent);
    return encodeCanvasToMaxBytes(canvas, mime, targetBytes, useQuality);
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/** Fetch stored file size from a SharePoint absolute URL (HEAD, then GET fallback). */
export async function fetchFileSizeFromUrl(url: string): Promise<number> {
    try {
        const head = await fetch(url, { method: 'HEAD', credentials: 'include' });
        const len = head.headers.get('Content-Length');
        if (len) return parseInt(len, 10);
    } catch {
        /* fall through */
    }
    try {
        const res = await fetch(url, { credentials: 'include' });
        const blob = await res.blob();
        return blob.size;
    } catch {
        return 0;
    }
}

export function ensureJpegFileName(fileName: string): string {
    const base = fileName.replace(/\.[^.]+$/, '') || 'image';
    return `${base}.jpg`;
}

/** Approximate byte size of a base64 data URL (e.g. right after upload). */
export function estimateDataUrlSize(dataUrl: string): number {
    if (!dataUrl || !dataUrl.startsWith('data:')) return 0;
    const base64 = dataUrl.split(',')[1] || '';
    return Math.round((base64.length * 3) / 4);
}
