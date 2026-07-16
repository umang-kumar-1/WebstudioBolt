import { Image } from '../types';
import * as React from "react";
import { useStore, getTranslation } from "./../../../webStudio/store";
import { Plus, Search, X } from 'lucide-react';
import { SPImage } from '../../../../components/SPImage';

interface PhotoGalleryProps {
  images: Image[];
  galleryTitle: string;
  onAddImage: () => void;
  onEditImage: (image: Image) => void;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  images,
  galleryTitle,
  onAddImage,
  onEditImage,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const { currentLanguage } = useStore();

  const filteredImages = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return images;
    }
    return images.filter(
      (image) =>
        image.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        image.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [images, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 flex-shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h4 className="m-0 whitespace-nowrap text-2xl font-semibold text-[#1f3f76]">
            {getTranslation('LABEL_GALLERY', currentLanguage)}: <span className="siteColor">{galleryTitle}</span>
          </h4>
          <div
            className="relative inline-block"
            style={{ minWidth: "350px", maxWidth: "450px" }}
          >
            <input
              type="text"
              className="w-full h-10 border border-gray-300 rounded-sm px-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
              placeholder={getTranslation('PH_IMG_SEARCH', currentLanguage)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {searchQuery ? (
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setSearchQuery("")}
                style={{ cursor: "pointer", padding: "5px" }}
              >
                <X className='icon-theme w-4 h-4' />
              </span>
            ) : (
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ pointerEvents: "none", padding: "5px" }}
              >
                <Search className='icon-theme w-4 h-4' />
              </span>
            )}
          </div>
        </div>
        <button className="h-10 px-4 inline-flex items-center gap-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 transition-opacity" onClick={onAddImage}>
          <div className="flex items-center gap-1">
            <Plus className='text-white w-4 h-4' />
            <span>{getTranslation('BTN_ADD_IMAGE', currentLanguage)}</span>
          </div>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 flex-grow overflow-y-auto">
        {filteredImages.length > 0 ? (
          filteredImages.map((image) => (
            <div key={image.id}>
              <div className="bg-white border border-gray-200 shadow-sm h-full flex flex-col" style={{ maxHeight: '400px' }}>
                <SPImage
                  src={image.src}
                  className="w-full"
                  alt={image.title}
                  style={{ height: "250px", objectFit: "cover", cursor: "pointer" }}
                  onClick={() => onEditImage(image)}
                />
                <div className="px-4 pt-3 pb-2">
                  <h5 className="text-base font-medium text-gray-800 truncate" title={image.title || image.name}>
                    {image.title ? image.title : image.name}
                  </h5>
                  <p className="text-[13px] leading-6 text-gray-500 truncate">
                    {image.description || ""}
                  </p>
                </div>
                <div className="px-4 pb-3 mt-auto">
                  <button
                    className="w-full h-8 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] text-sm font-medium hover:opacity-90 transition-opacity"
                    onClick={() => onEditImage(image)}
                    style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "5px" }}
                  >
                    {getTranslation('BTN_EDIT', currentLanguage)}
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full">
            <div className="text-center p-5 bg-gray-100 rounded">
              {searchQuery ? (
                <>
                  <h2>{getTranslation('MSG_NO_RESULTS', currentLanguage)} "{searchQuery}"</h2>
                  <p className="text-gray-500">
                    {getTranslation('MSG_TRY_DIFFERENT_SEARCH', currentLanguage)}
                  </p>
                </>
              ) : (
                <>
                  <h2>{getTranslation('MSG_FOLDER_EMPTY', currentLanguage)}</h2>
                  <p className="text-gray-500">
                    {getTranslation('MSG_FOLDER_EMPTY_DESC', currentLanguage)}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoGallery;