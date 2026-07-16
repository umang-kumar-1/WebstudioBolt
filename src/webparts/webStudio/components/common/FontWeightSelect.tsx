import React from 'react';
import { getTranslation } from '../../store';
import { LanguageCode } from '../../types';
import {
    FONT_WEIGHT_OPTIONS,
    formatFontWeightOptionLabel,
    resolveFontWeightSelectValue,
} from '../../heroTypographyPresets';

interface FontWeightSelectProps {
    value: unknown;
    onChange: (value: string) => void;
    defaultValue?: string;
    currentLanguage: LanguageCode;
    className?: string;
    includeEmptyOption?: boolean;
    emptyOptionLabel?: string;
}

const DEFAULT_CLASS =
    'w-full border border-gray-300 p-2 text-sm rounded-sm bg-white focus:outline-none focus:border-[var(--primary-color)]';

export const FontWeightSelect: React.FC<FontWeightSelectProps> = ({
    value,
    onChange,
    defaultValue = '400',
    currentLanguage,
    className = DEFAULT_CLASS,
    includeEmptyOption = false,
    emptyOptionLabel = '',
}) => (
    <select
        className={className}
        value={
            (value == null || value === '') && includeEmptyOption
                ? ''
                : resolveFontWeightSelectValue(value, defaultValue)
        }
        onChange={(e) => onChange(e.target.value)}
    >
        {includeEmptyOption && <option value="">{emptyOptionLabel}</option>}
        {FONT_WEIGHT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
                {formatFontWeightOptionLabel(opt, getTranslation, currentLanguage)}
            </option>
        ))}
    </select>
);
