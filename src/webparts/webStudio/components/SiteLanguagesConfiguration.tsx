import React from 'react';
import { Languages } from 'lucide-react';
import { LanguageCode } from '../types';
import { getTranslation } from '../store';
import {
  LANGUAGE_DISPLAY_NAMES,
  OPTIONAL_SITE_LANGUAGES,
  getEnabledSiteLanguages,
  isOptionalLanguageSelectable,
  toggleOptionalLanguage,
} from '../utils/siteLanguages';

interface SiteLanguagesConfigurationProps {
  languages: LanguageCode[];
  currentLanguage: LanguageCode;
  onLanguagesChange: (languages: LanguageCode[]) => void;
  className?: string;
}

export const SiteLanguagesConfiguration: React.FC<SiteLanguagesConfigurationProps> = ({
  languages,
  currentLanguage,
  onLanguagesChange,
  className = '',
}) => {
  const enabledLanguages = getEnabledSiteLanguages({ languages });

  const handleToggle = (lang: LanguageCode, checked: boolean) => {
    onLanguagesChange(toggleOptionalLanguage(languages, lang, checked));
  };

  return (
    <div className={`bg-gray-50 p-6 rounded-sm border border-gray-200 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Languages className="w-4 h-4 text-[var(--primary-color)]" />
        <label className="block text-xs font-bold text-gray-500 uppercase">
          {getTranslation('LABEL_SITE_LANGUAGES_CONFIG', currentLanguage)}
        </label>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed mb-4">
        {getTranslation('LABEL_SITE_LANGUAGES_HINT', currentLanguage)}
      </p>
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 cursor-not-allowed bg-white px-3 py-2 border border-[var(--primary-color)] ring-1 ring-[var(--primary-color)]/30 rounded-sm shadow-sm opacity-90">
          <input
            type="checkbox"
            checked
            disabled
            readOnly
            className="text-[var(--primary-color)] focus:ring-[var(--primary-color)] rounded"
          />
          <span className="text-sm font-medium text-gray-700">
            {LANGUAGE_DISPLAY_NAMES.en}
            <span className="ml-1 text-[10px] font-bold uppercase text-gray-400">
              ({getTranslation('LABEL_PRIMARY_LANGUAGE', currentLanguage)})
            </span>
          </span>
        </label>
        {OPTIONAL_SITE_LANGUAGES.map((lang) => {
          const selectable = isOptionalLanguageSelectable(lang);
          const isChecked = selectable && enabledLanguages.includes(lang);
          return (
            <label
              key={lang}
              className={`flex items-center gap-2 bg-white px-3 py-2 border rounded-sm shadow-sm transition-all ${
                !selectable
                  ? 'cursor-not-allowed border-gray-200 opacity-60'
                  : isChecked
                    ? 'cursor-pointer border-[var(--primary-color)] ring-1 ring-[var(--primary-color)]'
                    : 'cursor-pointer border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={!selectable}
                onChange={(e) => handleToggle(lang, e.target.checked)}
                className="text-[var(--primary-color)] focus:ring-[var(--primary-color)] rounded disabled:opacity-50"
              />
              <span className="text-sm font-medium text-gray-700">{LANGUAGE_DISPLAY_NAMES[lang]}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};
