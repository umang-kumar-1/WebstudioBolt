import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { GenericModal } from './SharedModals';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IoCalendarOutline as IoCalendarOutlineIcon } from 'react-icons/io5';
const IoCalendarOutline = IoCalendarOutlineIcon as any;
import { getTranslation, useStore } from '../../store';
import { getNestedPortalZFromStore } from '../../utils/modalZIndex';

export const ReadMoreModal = ({ item, onClose, isNumbered, index, imagePosition, imgBorder, source }: any) => {
    const { currentLanguage } = useStore();
    // Resolve images: support both 'images' array and single 'img'/'imageUrl' property
    const images = item.images && item.images.length > 0
        ? item.images
        : (item.img || item.imageUrl ? [item.img || item.imageUrl] : []);

    const [currentImgIndex, setCurrentImgIndex] = useState(0);

    const nextImg = () => setCurrentImgIndex((prev) => (prev + 1) % images.length);
    const prevImg = () => setCurrentImgIndex((prev) => (prev - 1 + images.length) % images.length);

    const isCircleStyle = imgBorder === 'circle' || imgBorder === 'halfcircle';

    const customFooter = (
        <div className="flex justify-end w-full">
            <button type="button" onClick={onClose} className="btn-secondary transition-colors inline-flex items-center justify-center gap-2">
                {getTranslation('BTN_CLOSE', currentLanguage)}
            </button>
        </div>
    );

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(0) }}>
            <GenericModal
                title={item.title}
                onClose={onClose}
                width="w-full max-w-[900px]"
                heightClass="h-auto max-h-[90vh]"
                noFooter={true}
                customFooter={customFooter}
            >
                <div className={`flex ${imagePosition === 'left' ? 'flex-col md:flex-row' : imagePosition === 'right' ? 'flex-col md:flex-row-reverse' : 'flex-col'} ${imagePosition !== 'none' ? 'gap-8' : ''}`}>
                    {/* Image Section */}
                    {images.length > 0 && imagePosition !== 'none' && (
                        isCircleStyle ? (
                            /* Circle / Half-circle: centered circular avatar */
                            <div className={`flex flex-col items-center flex-shrink-0 ${imagePosition === 'left' || imagePosition === 'right' ? 'w-full md:w-1/3' : 'mb-6'}`}>
                                <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-gray-100 shadow-lg flex-shrink-0 bg-gray-100">
                                    <img
                                        src={images[currentImgIndex]}
                                        className="w-full h-full object-cover"
                                        alt={item.title}
                                    />
                                </div>
                                {(item.jobTitle || item.company) && (
                                    <p className="text-sm text-gray-500 font-medium mt-3 text-center">
                                        {item.jobTitle}
                                        {item.jobTitle && item.company
                                            ? ` ${currentLanguage === 'de' ? 'bei' : 'at'} ${item.company}`
                                            : item.company}
                                    </p>
                                )}
                            </div>
                        ) : (
                            /* Standard: full-width rectangular image with optional carousel */
                            <div className={`bg-gray-100 relative rounded-sm overflow-hidden flex-shrink-0 group ${imagePosition === 'left' || imagePosition === 'right' ? 'w-full md:w-1/2 min-h-[300px]' : 'w-full h-[400px] mb-8'}`}>
                                <img
                                    src={images[currentImgIndex]}
                                    className="w-full h-full object-cover"
                                    alt={item.title}
                                />
                                {images.length > 1 && (
                                    <>
                                        <button onClick={prevImg} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full hover:bg-white transition-colors shadow-sm opacity-0 group-hover:opacity-100">
                                            <ChevronLeft className="w-5 h-5 text-gray-800" />
                                        </button>
                                        <button onClick={nextImg} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full hover:bg-white transition-colors shadow-sm opacity-0 group-hover:opacity-100">
                                            <ChevronRight className="w-5 h-5 text-gray-800" />
                                        </button>
                                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm font-bold">
                                            {currentImgIndex + 1} / {images.length}
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    )}

                    {/* Content Section */}
                    <div className={`space-y-6 px-1 pb-4 flex-1 ${imagePosition === 'left' || imagePosition === 'right' ? (isCircleStyle ? 'md:w-2/3' : 'md:w-1/2') : ''}`}>
                        <div className="flex items-start gap-6">
                            <div className="space-y-3">
                                {(source === 'News' || source === 'Event') && item.date && (
                                    <div className="flex items-center gap-2 text-sm font-medium text-[var(--primary-color)]">
                                        <IoCalendarOutline className="w-4 h-4" />
                                        {new Date(item.date).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}
                                        {item.endDate && item.endDate !== item.date && (
                                            <>
                                                <span className="text-gray-400 mx-1"> - </span>
                                                {new Date(item.endDate).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div
                            className="text-gray-700 leading-relaxed text-base jodit-content"
                            dangerouslySetInnerHTML={{ __html: item.readMoreText || item.desc || item.description || getTranslation('MSG_NO_DESCRIPTION', currentLanguage) }}
                        />
                    </div>
                </div>
            </GenericModal>
        </div>,
        document.body
    );
};
