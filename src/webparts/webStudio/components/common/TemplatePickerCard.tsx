import React from 'react';
import { Check } from 'lucide-react';
import { ContainerType } from '../../types';
import { TemplateSkeletonPreview } from './TemplateSkeletonPreview';

export interface TemplatePickerCardProps {
    title: string;
    description?: string;
    containerType: ContainerType;
    settings?: Record<string, unknown>;
    previewId?: string;
    isSelected?: boolean;
    isSelectable?: boolean;
    statusBadge?: 'Published' | 'Draft' | null;
    onSelect?: () => void;
    onPreview?: () => void;
    previewLabel: string;
    footerActions?: React.ReactNode;
    themePrimaryColor: string;
}

/** Unified template picker card — matches built-in preset card layout. */
export const TemplatePickerCard: React.FC<TemplatePickerCardProps> = ({
    title,
    description,
    containerType,
    settings = {},
    previewId,
    isSelected = false,
    isSelectable = true,
    statusBadge = null,
    onSelect,
    onPreview,
    previewLabel,
    footerActions,
    themePrimaryColor,
}) => (
    <div
        onClick={() => { if (isSelectable && onSelect) onSelect(); }}
        className={`bg-white border rounded-sm shadow-sm transition-all flex flex-col h-full group overflow-hidden ${isSelectable ? 'cursor-pointer hover:shadow-xl hover:-translate-y-0.5' : ''} ${isSelected ? 'ring-2' : ''}`}
        style={{
            borderColor: isSelected ? themePrimaryColor : '#e5e7eb',
            boxShadow: isSelected ? `0 0 0 2px ${themePrimaryColor}33` : undefined,
            opacity: isSelectable ? 1 : 0.9,
        }}
    >
        <div className="px-5 pt-4 flex justify-end items-center gap-2 min-h-[36px]">
            {statusBadge && (
                <span className={`mr-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadge === 'Published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {statusBadge}
                </span>
            )}
            {onPreview && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPreview(); }}
                    className="text-xs font-semibold flex items-center gap-1 transition-opacity hover:opacity-80"
                    style={{ color: themePrimaryColor }}
                >
                    {previewLabel} <span className="text-[10px]">↗</span>
                </button>
            )}
            {isSelected && (
                <div className="text-white rounded-full p-1 shadow-md shrink-0" style={{ backgroundColor: themePrimaryColor }}>
                    <Check className="w-3.5 h-3.5" />
                </div>
            )}
        </div>

        <div className="ws-template-card-desc-block px-5 pt-2 pb-4 flex flex-col items-center text-center flex-shrink-0">
            <h4 className="font-bold mb-2 w-full text-center line-clamp-2" style={{ color: themePrimaryColor }}>
                {title}
            </h4>
            {description && (
                <p className="ws-template-card-desc text-[11px] text-gray-500 leading-relaxed w-full line-clamp-3">
                    {description}
                </p>
            )}
        </div>

        <div className="bg-white relative overflow-hidden flex items-center justify-center px-4 pb-4 mt-auto">
            <div className="w-full h-[160px] border border-gray-100 rounded-md overflow-hidden relative">
                <TemplateSkeletonPreview
                    containerType={containerType}
                    settings={settings}
                    previewId={previewId}
                />
            </div>
        </div>

        {footerActions && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-4 pt-2 border-t border-gray-100">
                {footerActions}
            </div>
        )}
    </div>
);
