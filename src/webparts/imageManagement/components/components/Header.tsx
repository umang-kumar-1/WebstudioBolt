import * as React from 'react';
import { useStore, getTranslation } from './../../../webStudio/store';
import { Images } from 'lucide-react';

const Header: React.FC = () => {
  const { currentLanguage } = useStore();
  return (
    <header>
      <nav className="w-full bg-[#006400]">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <a className="inline-flex items-center gap-2 text-white no-underline" href="#">
            <Images className="w-6 h-6" />
            <span className="text-2xl font-bold">{getTranslation('TITLE_PHOTO_GALLERY', currentLanguage)}</span>
          </a>
        </div>
      </nav>
    </header>
  );
};

export default Header;
