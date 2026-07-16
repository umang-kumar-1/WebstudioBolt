import { useCallback, useState } from 'react';
import {
    prepareImageFile,
    prepareImageFiles,
    type ImageOptimizationConfig,
    type ImageOptimizationStats,
    type PreparedImageUpload,
    toBlobFile,
} from '../utils/imageUploadPipeline';

export interface UseImageOptimizerResult {
    isOptimizing: boolean;
    stats: ImageOptimizationStats | null;
    error: string | null;
    clearStats: () => void;
    prepareFile: (file: File, config?: ImageOptimizationConfig) => Promise<PreparedImageUpload>;
    prepareFiles: (files: File[], config?: ImageOptimizationConfig) => Promise<PreparedImageUpload[]>;
    prepareBlob: (blob: Blob, name?: string, config?: ImageOptimizationConfig) => Promise<PreparedImageUpload>;
}

export function useImageOptimizer(): UseImageOptimizerResult {
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [stats, setStats] = useState<ImageOptimizationStats | null>(null);
    const [error, setError] = useState<string | null>(null);

    const clearStats = useCallback(() => {
        setStats(null);
        setError(null);
    }, []);

    const runPrepare = useCallback(
        async <T,>(fn: () => Promise<T>): Promise<T> => {
            setIsOptimizing(true);
            setError(null);
            try {
                const result = await fn();
                return result;
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : 'Image optimization failed.';
                setError(message);
                throw err;
            } finally {
                setIsOptimizing(false);
            }
        },
        []
    );

    const prepareFile = useCallback(
        async (file: File, config?: ImageOptimizationConfig) => {
            const prepared = await runPrepare(() => prepareImageFile(file, config));
            setStats(prepared.stats);
            return prepared;
        },
        [runPrepare]
    );

    const prepareFiles = useCallback(
        async (files: File[], config?: ImageOptimizationConfig) => {
            const prepared = await runPrepare(() => prepareImageFiles(files, config));
            if (prepared.length === 1) {
                setStats(prepared[0].stats);
            } else if (prepared.length > 1) {
                const originalSize = prepared.reduce((sum, p) => sum + p.stats.originalSize, 0);
                const optimizedSize = prepared.reduce((sum, p) => sum + p.stats.optimizedSize, 0);
                const percentSaved =
                    originalSize > 0
                        ? Math.round(((originalSize - optimizedSize) / originalSize) * 100)
                        : 0;
                setStats({
                    originalSize,
                    optimizedSize,
                    width: prepared[0].stats.width,
                    height: prepared[0].stats.height,
                    percentSaved: Math.max(0, percentSaved),
                });
            }
            return prepared;
        },
        [runPrepare]
    );

    const prepareBlob = useCallback(
        async (blob: Blob, name = 'pasted-image.png', config?: ImageOptimizationConfig) => {
            return prepareFile(toBlobFile(blob, name), config);
        },
        [prepareFile]
    );

    return {
        isOptimizing,
        stats,
        error,
        clearStats,
        prepareFile,
        prepareFiles,
        prepareBlob,
    };
}
