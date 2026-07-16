import React from 'react';
import { Check } from 'lucide-react';
import { ThemeTemplate } from '../../types';
import { isDefaultThemeTemplate } from '../../utils/themeTemplateHelpers';

export interface ThemeTemplateCardProps {
    template: ThemeTemplate;
    isSelected?: boolean;
    isSelectable?: boolean;
    onSelect?: () => void;
    footerActions?: React.ReactNode;
    themePrimaryColor: string;
    defaultLabel: string;
}

/** Theme template picker card with color swatch preview. */
export const ThemeTemplateCard: React.FC<ThemeTemplateCardProps> = ({
    template,
    isSelected = false,
    isSelectable = true,
    onSelect,
    footerActions,
    themePrimaryColor,
    defaultLabel,
}) => {
    const primary = template.themeConfig['--primary-color'] || themePrimaryColor;
    const secondary = template.themeConfig['--secondary-color'] || '#64748b';
    const bodyBg = template.themeConfig['--bg-body'] || '#ffffff';
    const textPrimary = template.themeConfig['--text-primary'] || '#1f2937';
    const isDefault = isDefaultThemeTemplate(template);

    return (
        <div
            onClick={() => { if (isSelectable && onSelect) onSelect(); }}
            className={`bg-white border rounded-sm shadow-sm transition-all flex flex-col h-full group overflow-hidden ${isSelectable ? 'cursor-pointer hover:shadow-xl hover:-translate-y-0.5' : ''} ${isSelected ? 'ring-2' : ''}`}
            style={{
                borderColor: isSelected ? themePrimaryColor : '#e5e7eb',
                boxShadow: isSelected ? `0 0 0 2px ${themePrimaryColor}33` : undefined,
            }}
        >
            <div className="px-5 pt-4 flex justify-between items-center gap-2 min-h-[36px]">
                <div className="flex items-center gap-2 flex-wrap">
                    {isDefault && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {defaultLabel}
                        </span>
                    )}
                    {!isDefault && template.status && (
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${template.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {template.status}
                        </span>
                    )}
                </div>
                {isSelected && (
                    <div className="text-white rounded-full p-1 shadow-md shrink-0" style={{ backgroundColor: themePrimaryColor }}>
                        <Check className="w-3.5 h-3.5" />
                    </div>
                )}
            </div>

            <div className="px-5 py-3 flex flex-col items-center text-center flex-shrink-0">
                <h4 className="font-bold mb-3 w-full text-center line-clamp-2" style={{ color: primary }}>
                    {template.title}
                </h4>

                <div
                    className="w-full rounded-sm border border-gray-200 overflow-hidden shadow-inner"
                    style={{ backgroundColor: bodyBg }}
                >
                    <div className="h-8 flex items-center px-3 gap-2" style={{ backgroundColor: template.themeConfig['--header-bg'] || primary }}>
                        <div className="w-6 h-3 rounded-sm opacity-80" style={{ backgroundColor: primary }} />
                        <div className="flex-1 flex gap-2 justify-end">
                            <div className="w-8 h-1 rounded-full opacity-60" style={{ backgroundColor: textPrimary }} />
                            <div className="w-8 h-1 rounded-full opacity-60" style={{ backgroundColor: textPrimary }} />
                        </div>
                    </div>
                    <div className="p-3 space-y-2">
                        <div className="h-2 w-3/4 rounded-full" style={{ backgroundColor: primary, opacity: 0.85 }} />
                        <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: textPrimary, opacity: 0.25 }} />
                        <div className="h-1.5 w-5/6 rounded-full" style={{ backgroundColor: textPrimary, opacity: 0.2 }} />
                        <div className="flex gap-2 pt-1">
                            <div className="h-5 w-14 rounded-sm" style={{ backgroundColor: template.themeConfig['--btn-primary-bg'] || primary }} />
                            <div className="h-5 w-14 rounded-sm border" style={{ borderColor: secondary, opacity: 0.5 }} />
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mt-3 w-full justify-center">
                    <div className="w-6 h-6 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: primary }} title="Primary" />
                    <div className="w-6 h-6 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: secondary }} title="Secondary" />
                    <div className="w-6 h-6 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: bodyBg }} title="Background" />
                </div>
            </div>

            {footerActions && (
                <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-2 mt-auto">
                    {footerActions}
                </div>
            )}
        </div>
    );
};
