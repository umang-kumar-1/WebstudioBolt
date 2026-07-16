import * as React from 'react';
import { useState } from 'react';
import { Copy, Image as ImageIcon, Pencil, Search, Upload, X } from 'lucide-react';
import { getTranslation } from '../../store';
import { LanguageCode } from '../../types';
import { resolveGalleryDefaultImage } from '../../utils/defaultImageUrl';
import { withImageCacheBust } from '../../utils/imageCache';
import { useEditorImageTab, type UseEditorImageTabOptions } from '../../../../hooks/useEditorImageTab';
import ImageOptimizationFeedback from '../../../../components/ImageOptimizationFeedback';
import { EditTrigger } from '../modals/SharedModals';
import ManagedImageEditorBridge from './ManagedImageEditorBridge';

type EditorImageTabPanelProps = UseEditorImageTabOptions & {
    currentLanguage: LanguageCode;
    images: UseEditorImageTabOptions['images'];
    getGlobalDefaultImage: () => string;
    onEditImage?: () => void;
    emptyStateIcon?: React.ReactNode;
    urlLabelKey?: string;
    showImageNameEditTrigger?: boolean;
    enableImageEditor?: boolean;
};

const EditorImageTabPanel: React.FC<EditorImageTabPanelProps> = ({
    currentLanguage,
    getGlobalDefaultImage,
    onEditImage,
    emptyStateIcon,
    urlLabelKey = 'LABEL_IMAGE_URL',
    showImageNameEditTrigger = false,
    enableImageEditor = true,
    ...hookOptions
}) => {
    const [showImageEditor, setShowImageEditor] = useState(false);
    const {
        imgTab,
        setImgTab,
        searchImg,
        setSearchImg,
        copyPastePreviewUrl,
        newImageName,
        imagePreviewToken,
        pasteAreaRef,
        imageUpload,
        isUploading,
        isBusy,
        filteredGallery,
        handlePaste,
        handleUpload,
        handleGallerySelect,
        clearImage,
        handleImageNameChange,
        handleImageSaved,
        imageUrl,
        imageName,
    } = useEditorImageTab(hookOptions);

    const openImageEditor = onEditImage || (enableImageEditor ? () => setShowImageEditor(true) : undefined);

    const focusPasteArea = () => {
        pasteAreaRef.current?.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        if (pasteAreaRef.current && selection) {
            range.selectNodeContents(pasteAreaRef.current);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    };

    return (
        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm space-y-6">
            <div className="flex gap-6 items-start">
                <div className="w-32 h-32 bg-gray-100 border border-gray-300 flex items-center justify-center relative overflow-hidden flex-shrink-0">
                    <img
                        key={`${imageUrl || ''}-${imagePreviewToken}`}
                        src={withImageCacheBust(imageUrl, imagePreviewToken)}
                        alt="Current"
                        className="w-full h-full object-cover"
                        style={{ display: imageUrl ? 'block' : 'none' }}
                        onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    {!imageUrl && (emptyStateIcon || <ImageIcon className="w-8 h-8 text-gray-300" />)}
                </div>
                <div className="flex-1 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            {getTranslation(urlLabelKey, currentLanguage)}
                            {urlLabelKey === 'LABEL_IMAGE_URL' && <EditTrigger labelKey="LABEL_IMAGE_URL" className="ml-2" />}
                        </label>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 border border-gray-300 p-2 text-sm text-gray-600 rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                value={imageUrl || ''}
                                onChange={(e) => hookOptions.updateField('imageUrl', e.target.value)}
                                placeholder={getTranslation('PLACEHOLDER_URL_GENERIC', currentLanguage)}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const resolvedDefault = resolveGalleryDefaultImage(hookOptions.images);
                                    if (resolvedDefault) {
                                        hookOptions.updateField('imageUrl', resolvedDefault.url);
                                        hookOptions.updateField('imageName', resolvedDefault.name);
                                        handleImageNameChange(resolvedDefault.name);
                                    } else {
                                        hookOptions.updateField('imageUrl', getGlobalDefaultImage());
                                        hookOptions.updateField('imageName', '');
                                        handleImageNameChange('');
                                    }
                                }}
                                className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-sm hover:bg-gray-200 transition-colors"
                            >
                                {getTranslation('BTN_DEFAULT_IMAGE', currentLanguage)}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            {getTranslation('LABEL_IMAGE_NAME', currentLanguage)}
                        </label>
                        <input
                            className="w-full border border-gray-300 p-2 text-sm rounded-sm"
                            value={imageName || ''}
                            onChange={(e) => handleImageNameChange(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        {imageUrl && openImageEditor && (
                            <button
                                type="button"
                                onClick={openImageEditor}
                                className="text-xs text-[var(--primary-color)] hover:underline inline-flex items-center gap-1"
                            >
                                <Pencil className="w-3 h-3" />
                                {getTranslation('BTN_EDIT', currentLanguage) || 'Edit Image'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={clearImage}
                            className="text-xs text-[var(--primary-color)] hover:underline flex items-center gap-1"
                        >
                            <X className="w-3 h-3" /> {getTranslation('BTN_CLEAR_IMAGE', currentLanguage)}
                        </button>
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
                <div className="flex gap-6 border-b border-gray-200 mb-4">
                    {([
                        { id: 'COPY' as const, labelKey: 'TAB_IMG_COPY' },
                        { id: 'UPLOAD' as const, labelKey: 'TAB_IMG_UPLOAD' },
                        { id: 'CHOOSE' as const, labelKey: 'TAB_IMG_CHOOSE' },
                    ]).map((sub) => (
                        <button
                            key={sub.id}
                            type="button"
                            onClick={() => setImgTab(sub.id)}
                            className={`pb-2 text-xs font-bold uppercase transition-colors ${imgTab === sub.id ? 'border-b-2 border-[var(--primary-color)] text-[var(--primary-color)]' : 'text-gray-500'}`}
                        >
                            {sub.id === 'CHOOSE'
                                ? `${getTranslation(sub.labelKey, currentLanguage)} (${hookOptions.images.length})`
                                : getTranslation(sub.labelKey, currentLanguage)}
                        </button>
                    ))}
                </div>

                {imgTab === 'COPY' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">
                                {getTranslation('LABEL_IMAGE_NAME', currentLanguage)}
                                {showImageNameEditTrigger && <EditTrigger labelKey="LABEL_IMAGE_NAME" className="ml-2" />}
                            </label>
                            <input
                                className="w-full border border-gray-300 p-2 text-sm rounded-sm"
                                value={newImageName}
                                onChange={(e) => handleImageNameChange(e.target.value)}
                            />
                        </div>
                        <div
                            ref={pasteAreaRef}
                            onPaste={(e) => { handlePaste(e).catch(console.error); }}
                            contentEditable
                            suppressContentEditableWarning
                            className="h-32 border-2 border-dashed border-[var(--primary-color)] bg-blue-50 flex flex-col items-center justify-center text-gray-400 text-sm cursor-pointer hover:bg-blue-100 transition-colors relative overflow-hidden"
                            onClick={focusPasteArea}
                            tabIndex={0}
                        >
                            {copyPastePreviewUrl ? (
                                <>
                                    <img
                                        src={withImageCacheBust(copyPastePreviewUrl, imagePreviewToken)}
                                        alt={imageName || 'Pasted image'}
                                        className="absolute inset-0 w-full h-full object-contain bg-white"
                                    />
                                    {(imageUpload.isOptimizing || imageUpload.stats) && (
                                        <div className="ws-image-opt-overlay-bar absolute inset-x-0 top-0 z-20 px-2 py-1.5">
                                            <ImageOptimizationFeedback
                                                stats={imageUpload.stats}
                                                isProcessing={imageUpload.isOptimizing}
                                                variant="overlay"
                                            />
                                        </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 z-10 bg-black/70 text-white text-[11px] px-2 py-1 truncate">
                                        {imageName || 'Pasted image'}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-6 h-6 mb-2 text-[var(--primary-color)] opacity-50" />
                                    <span className="font-bold text-[var(--primary-color)]">{getTranslation('MSG_CLICK_PASTE_IMAGE', currentLanguage)}</span>
                                </>
                            )}
                        </div>
                        {!copyPastePreviewUrl && (imageUpload.isOptimizing || imageUpload.stats) && (
                            <ImageOptimizationFeedback
                                stats={imageUpload.stats}
                                isProcessing={imageUpload.isOptimizing}
                                variant="panel"
                            />
                        )}
                    </div>
                )}

                {imgTab === 'UPLOAD' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_IMAGE_NAME', currentLanguage)}</label>
                            <input
                                className="w-full border border-gray-300 p-2 text-sm rounded-sm"
                                value={newImageName}
                                onChange={(e) => handleImageNameChange(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <label className={`bg-[var(--btn-primary-bg)] text-white px-4 py-2 text-sm font-bold shadow-sm cursor-pointer hover:opacity-90 rounded-sm flex items-center gap-2 ${isBusy ? 'opacity-50 cursor-wait' : ''}`}>
                                <Upload className="w-4 h-4" /> {isBusy ? (imageUpload.isOptimizing ? 'Optimizing…' : getTranslation('MSG_UPLOADING', currentLanguage)) : getTranslation('BTN_UPLOAD_IMAGE', currentLanguage)}
                                <input type="file" className="hidden" onChange={(e) => { handleUpload(e).catch(console.error); }} accept="image/*" disabled={isBusy} />
                            </label>
                            <ImageOptimizationFeedback stats={imageUpload.stats} isProcessing={imageUpload.isOptimizing} />
                        </div>
                    </div>
                )}

                {imgTab === 'CHOOSE' && (
                    <div className="flex flex-col h-full">
                        <div className="relative mb-4 shrink-0">
                            <input
                                className="w-full border border-gray-300 py-2 pl-8 pr-8 text-sm rounded-sm focus:outline-none focus:border-[var(--primary-color)]"
                                placeholder={getTranslation('PH_SEARCH_IMAGES', currentLanguage)}
                                value={searchImg}
                                onChange={(e) => setSearchImg(e.target.value)}
                            />
                            <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                            {searchImg && (
                                <button
                                    type="button"
                                    onClick={() => setSearchImg('')}
                                    className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                                    title="Clear search"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[400px] border border-gray-100 bg-gray-50/50 p-2 rounded-sm content-start">
                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 auto-rows-min">
                                {filteredGallery.map((img) => (
                                    <div
                                        key={img.id}
                                        onClick={() => handleGallerySelect(img)}
                                        className={`relative aspect-square cursor-pointer overflow-hidden rounded-sm border-2 transition-all group bg-white shadow-sm ${imageUrl === img.url
                                            ? 'border-[var(--primary-color)] ring-2 ring-[var(--primary-color)] ring-opacity-20 z-10'
                                            : 'border-transparent hover:border-blue-300 hover:shadow-md'}`}
                                    >
                                        <img src={img.url} alt={img.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                            {img.name}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {enableImageEditor && (
                <ManagedImageEditorBridge
                    imageUrl={imageUrl || ''}
                    imageName={imageName}
                    isOpen={showImageEditor}
                    onClose={() => setShowImageEditor(false)}
                    onSaved={(url, name) => {
                        handleImageSaved(url, name);
                        setShowImageEditor(false);
                    }}
                />
            )}
        </div>
    );
};

export default EditorImageTabPanel;
