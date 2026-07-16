import React from 'react';
import { Circle, Sliders, Square } from 'lucide-react';
import { getTranslation } from '../../store';
import { LanguageCode } from '../../types';
import { FontWeightSelect } from './FontWeightSelect';
import {
    DEFAULT_HERO_ACTION_BUTTON_RADIUS_CUSTOM,
    HeroActionButtonRadiusPreset,
    parseHeroActionButtonRadiusSettings,
} from '../../utils/heroActionButtonRadius';

const ACTION_BUTTON_RADIUS_PRESETS = [
    { value: 'none', labelKey: 'LABEL_SHARP', icon: Square },
    { value: 'sm', labelKey: 'LABEL_SMALL', icon: Square },
    { value: 'lg', labelKey: 'LABEL_ROUNDED', icon: Square },
    { value: 'full', labelKey: 'LABEL_CIRCLE', icon: Circle },
    { value: 'custom', labelKey: 'LABEL_CUSTOM', icon: Sliders },
] as const;

const ActionButtonRadiusEditor = ({
    settings,
    onPresetChange,
    onCornerChange,
    currentLanguage,
}: {
    settings: Record<string, any>;
    onPresetChange: (preset: HeroActionButtonRadiusPreset) => void;
    onCornerChange: (corner: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight', value: string) => void;
    currentLanguage: LanguageCode;
}) => {
    const { btnRadiusPreset, btnRadiusCustom } = parseHeroActionButtonRadiusSettings(settings);

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                    {getTranslation('LABEL_ACTION_BUTTON_CORNER_RADIUS', currentLanguage)}
                </label>
                <div className="flex bg-gray-100 p-1 rounded-sm gap-1">
                    {ACTION_BUTTON_RADIUS_PRESETS.map((preset) => {
                        const Icon = preset.icon;
                        return (
                            <button
                                key={preset.value}
                                type="button"
                                onClick={() => onPresetChange(preset.value)}
                                className={`flex-1 py-2 px-2 text-xs font-bold flex items-center justify-center gap-2 rounded-sm transition-all min-w-0 ${btnRadiusPreset === preset.value
                                    ? 'bg-white text-[var(--primary-color)] shadow-sm ring-1 ring-[var(--primary-color)]'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                title={getTranslation(preset.labelKey, currentLanguage)}
                            >
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{getTranslation(preset.labelKey, currentLanguage)}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {btnRadiusPreset === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                    {([
                        { key: 'topLeft', labelKey: 'LABEL_RADIUS_TOP_LEFT' },
                        { key: 'topRight', labelKey: 'LABEL_RADIUS_TOP_RIGHT' },
                        { key: 'bottomLeft', labelKey: 'LABEL_RADIUS_BOTTOM_LEFT' },
                        { key: 'bottomRight', labelKey: 'LABEL_RADIUS_BOTTOM_RIGHT' },
                    ] as const).map((corner) => (
                        <div key={corner.key}>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                {getTranslation(corner.labelKey, currentLanguage)}
                            </label>
                            <input
                                className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none bg-white"
                                value={btnRadiusCustom[corner.key] || ''}
                                onChange={(e) => onCornerChange(corner.key, e.target.value)}
                                placeholder={getTranslation('PLACEHOLDER_RADIUS_VALUE', currentLanguage)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const ActionButtonStyleEditor = ({
    settings,
    onFieldChange,
    onMultiChange,
    currentLanguage,
}: {
    settings: Record<string, any>;
    onFieldChange: (key: string, value: any) => void;
    onMultiChange: (patch: Record<string, any>) => void;
    currentLanguage: LanguageCode;
}) => (
    <>
        <div className="pt-4 border-t mt-4">
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        {getTranslation('LABEL_FONT_SIZE', currentLanguage)}
                    </label>
                    <div className="flex items-center border border-gray-200 rounded-sm overflow-hidden bg-white">
                        <input
                            type="number"
                            min={8}
                            max={120}
                            className="flex-1 p-2 text-sm outline-none bg-transparent"
                            placeholder="e.g. 14"
                            value={settings.btnFontSize || ''}
                            onChange={(e) => onFieldChange('btnFontSize', e.target.value ? Number(e.target.value) : '')}
                        />
                        <span className="px-2 text-xs text-gray-400 border-l h-full flex items-center bg-gray-50">px</span>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        {getTranslation('LABEL_FONT_WEIGHT', currentLanguage)}
                    </label>
                    <FontWeightSelect
                        value={settings.btnFontWeight}
                        defaultValue="700"
                        currentLanguage={currentLanguage}
                        className="w-full border border-gray-200 p-2 text-sm outline-none bg-white rounded-sm"
                        onChange={(value) => onFieldChange('btnFontWeight', Number(value))}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        {getTranslation('LABEL_TEXT_CASE', currentLanguage)}
                    </label>
                    <select
                        className="w-full border border-gray-200 p-2 text-sm outline-none bg-white rounded-sm"
                        value={settings.btnLetterCase || 'none'}
                        onChange={(e) => onFieldChange('btnLetterCase', e.target.value)}
                    >
                        <option value="none">Normal</option>
                        <option value="uppercase">Uppercase</option>
                        <option value="lowercase">Lowercase</option>
                        <option value="capitalize">Capitalize</option>
                    </select>
                </div>
            </div>
        </div>

        <ActionButtonRadiusEditor
            settings={settings}
            onPresetChange={(preset) => onMultiChange({
                btnRadiusPreset: preset,
                btnRadiusCustom: settings.btnRadiusCustom || { ...DEFAULT_HERO_ACTION_BUTTON_RADIUS_CUSTOM },
            })}
            onCornerChange={(corner, value) => onMultiChange({
                btnRadiusPreset: 'custom',
                btnRadiusCustom: {
                    ...(settings.btnRadiusCustom || DEFAULT_HERO_ACTION_BUTTON_RADIUS_CUSTOM),
                    [corner]: value,
                },
            })}
            currentLanguage={currentLanguage}
        />
    </>
);
