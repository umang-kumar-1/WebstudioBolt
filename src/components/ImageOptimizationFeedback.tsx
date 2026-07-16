import * as React from 'react';
import { formatBytes, type ImageOptimizationStats } from '../utils/imageUploadPipeline';

export interface ImageOptimizationFeedbackProps {
    stats: ImageOptimizationStats | null;
    isProcessing?: boolean;
    className?: string;
    /** inline: default text row; panel: readable bar below previews; overlay: light text for dark bars on images */
    variant?: 'inline' | 'panel' | 'overlay';
}

const ImageOptimizationFeedback: React.FC<ImageOptimizationFeedbackProps> = ({
    stats,
    isProcessing = false,
    className = '',
    variant = 'inline',
}) => {
    const processingClassName =
        variant === 'overlay'
            ? 'flex items-center gap-2 text-xs text-white'
            : variant === 'panel'
                ? 'flex items-center gap-2 text-xs text-gray-700 rounded-sm border border-gray-200 bg-gray-100 px-3 py-2'
                : 'flex items-center gap-2 text-xs text-gray-600';

    const statsClassName =
        variant === 'overlay'
            ? 'text-[10px] text-white/95 leading-snug'
            : variant === 'panel'
                ? 'text-[10px] text-gray-700 leading-snug rounded-sm border border-gray-200 bg-gray-100 px-3 py-2'
                : 'text-[10px] text-gray-600 leading-snug';

    const savedClassName =
        variant === 'overlay' ? 'font-semibold text-emerald-300' : 'font-semibold text-emerald-700';

    if (isProcessing) {
        return (
            <div
                className={`${processingClassName} ${className}`}
                role="status"
                aria-live="polite"
            >
                <span className="inline-block w-3.5 h-3.5 border-2 border-[var(--primary-color,#1d4ed8)]/35 border-t-[var(--primary-color,#1d4ed8)] rounded-full animate-spin" />
                <span>Optimizing image…</span>
            </div>
        );
    }

    if (!stats || stats.wasOptimized === false) {
        return null;
    }

    const savedLabel =
        stats.percentSaved > 0 ? `Saved ${stats.percentSaved}%` : 'Already optimized';

    return (
        <div
            className={`${statsClassName} ${className}`}
            role="status"
            aria-live="polite"
        >
            <span className={savedClassName}>{savedLabel}</span>
            <span className="mx-1">·</span>
            <span>
                {formatBytes(stats.originalSize)} → {formatBytes(stats.optimizedSize)}
            </span>
            <span className="mx-1">·</span>
            <span>
                {stats.width} × {stats.height}px
            </span>
        </div>
    );
};

export default ImageOptimizationFeedback;
