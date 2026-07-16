import { formatBytes } from './imageUploadPipeline';

export type ImageOptimizationChoice = boolean | null;

export interface ImageOptimizationConfirmRequest {
    fileName: string;
    fileSizeLabel: string;
    resolve: (choice: ImageOptimizationChoice) => void;
}

let pendingRequest: ImageOptimizationConfirmRequest | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
    listeners.forEach((listener) => listener());
}

export function subscribeImageOptimizationConfirm(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getImageOptimizationConfirmRequest(): ImageOptimizationConfirmRequest | null {
    return pendingRequest;
}

export function requestImageOptimizationConfirm(file: File): Promise<ImageOptimizationChoice> {
    if (!file.type.startsWith('image/')) {
        return Promise.resolve(true);
    }

    if (pendingRequest) {
        pendingRequest.resolve(null);
        pendingRequest = null;
    }

    return new Promise((resolve) => {
        pendingRequest = {
            fileName: file.name,
            fileSizeLabel: formatBytes(file.size),
            resolve: (choice) => {
                pendingRequest = null;
                notifyListeners();
                resolve(choice);
            },
        };
        notifyListeners();
    });
}

export function respondImageOptimizationConfirm(optimize: boolean): void {
    pendingRequest?.resolve(optimize);
}

export function cancelImageOptimizationConfirm(): void {
    pendingRequest?.resolve(null);
}
