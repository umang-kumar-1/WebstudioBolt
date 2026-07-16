import * as React from 'react';
import { Globe } from 'lucide-react';
import { useStore, getTranslation } from '../../store';

/** Shown when Site Languages has no optional languages enabled (English-only). */
export const TranslationLanguagesEmptyState: React.FC = () => {
    const { currentLanguage } = useStore();

    return (
        <div className="text-center py-8 text-gray-400">
            <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm italic">{getTranslation('MSG_NO_ADDITIONAL_LANGUAGES', currentLanguage)}</p>
            <p className="text-xs mt-1">{getTranslation('MSG_ADD_LANGUAGES_SITE_MANAGER', currentLanguage)}</p>
        </div>
    );
};
