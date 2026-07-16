import type { ChangeEvent, ClipboardEvent, DragEvent } from 'react';
import type { UseImageOptimizerResult } from '../../../hooks/useImageOptimizer';
import { ImageUploadCancelledError } from '../../../utils/imageUploadPipeline';

type Optimizer = Pick<
    UseImageOptimizerResult,
    'prepareFile' | 'prepareBlob' | 'clearStats'
>;

export async function getOptimizedFileFromInput(
    file: File,
    optimizer: Optimizer
): Promise<File> {
    const prepared = await optimizer.prepareFile(file);
    return prepared.file;
}

export async function getOptimizedFileFromBlob(
    blob: Blob,
    name: string | undefined,
    optimizer: Optimizer
): Promise<File> {
    const prepared = await optimizer.prepareBlob(blob, name);
    return prepared.file;
}

export function createOptimizedFileChangeHandler(
    optimizer: Optimizer,
    onFile: (file: File) => void | Promise<void>
): (e: ChangeEvent<HTMLInputElement>) => void {
    return (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !file.type.startsWith('image/')) return;

        optimizer.clearStats();
        getOptimizedFileFromInput(file, optimizer)
            .then(onFile)
            .catch((err) => {
                if (err instanceof ImageUploadCancelledError) return;
                console.error(err);
            });
    };
}

export function createOptimizedDropHandler(
    optimizer: Optimizer,
    onFile: (file: File) => void | Promise<void>
): (e: DragEvent<HTMLElement>) => void {
    return (e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;

        optimizer.clearStats();
        getOptimizedFileFromInput(file, optimizer)
            .then(onFile)
            .catch((err) => {
                if (err instanceof ImageUploadCancelledError) return;
                console.error(err);
            });
    };
}

export function createOptimizedPasteHandler(
    optimizer: Optimizer,
    onFile: (file: File) => void | Promise<void>
): (e: ClipboardEvent<HTMLElement>) => void {
    return (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of Array.from(items)) {
            if (item.type.indexOf('image') === -1) continue;
            const blob = item.getAsFile();
            if (!blob) continue;
            e.preventDefault();
            optimizer.clearStats();
            getOptimizedFileFromBlob(blob, 'pasted-image.png', optimizer)
                .then(onFile)
                .catch((err) => {
                    if (err instanceof ImageUploadCancelledError) return;
                    console.error(err);
                });
            break;
        }
    };
}
