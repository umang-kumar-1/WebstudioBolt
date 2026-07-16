import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import ImageUploader from './ImageUploader';
import { Image, Folder, FilterType, Dimensions, ROOT_FOLDER_ID } from '../types';
import {
    DEFAULT_IMAGE_COMPRESSION,
    exportCanvasWithCompression,
    blobToDataUrl,
    fetchFileSizeFromUrl,
    formatFileSize,
    getDisplayFileSize,
    ensureJpegFileName,
    estimateDataUrlSize,
} from '../../utils/imageCompressionUtils';
import { useStore, getTranslation } from './../../../webStudio/store';
import TooltipMenu from '../../../webStudio/components/common/TooltipMenu';
import ImageUsagePanel from './ImageUsagePanel';
import { ChevronDown, ChevronUp, Copy, ImageIcon, RotateCcw, RotateCw, Trash2, X } from 'lucide-react';
import { SPImage } from '../../../../components/SPImage';
// import 'bootstrap/dist/css/bootstrap.min.css';
// import 'bootstrap/dist/js/bootstrap.bundle.min.js';

interface ImageEditorModalProps {
    imagesLength: number;
    isOpen: boolean;
    onClose: () => void;
    onSave: (image: Omit<Image, 'id'> & { id?: number }) => void | Promise<void>;
    onDelete?: (image: Image) => void;
    imageToEdit: Image | undefined;
    folders: Folder[];
    images: Image[];
    selectedFolderId?: number;
}

const BLANK_IMAGE_STATE: Omit<Image, 'id' | 'folderId'> & { folderId: number | '' } = {
    src: '',
    name: '',
    title: '',
    description: '',
    altText: '',
    copyright: '',
    keywords: '',
    folderId: '',
    created: '',
    modifiedDate: '',
    author: '',
    editor: '',
    imageCompression: DEFAULT_IMAGE_COMPRESSION,
    originalFileSizeBytes: 0,
};

const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ imagesLength, isOpen, onClose, onSave, onDelete, imageToEdit, folders, images, selectedFolderId }) => {
    const [editedImage, setEditedImage] = useState<Omit<Image, 'id' | 'src' | 'folderId'> & { id?: number, src: string | null, folderId: number | '' }>(BLANK_IMAGE_STATE);
    const imgRef = useRef<HTMLImageElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [rotation, setRotation] = useState(0);
    const [activeFilter, setActiveFilter] = useState<FilterType>(FilterType.NONE);
    const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });
    const [isPreviewHovered, setIsPreviewHovered] = useState(false);
    const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
    const [activeAccordion, setActiveAccordion] = useState<string | null>('collapseResize');
    const [compression, setCompression] = useState(DEFAULT_IMAGE_COMPRESSION);
    const [originalFileSizeBytes, setOriginalFileSizeBytes] = useState(0);
    const [currentSizeBytes, setCurrentSizeBytes] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const { currentLanguage } = useStore();

    const getReferenceOriginalBytes = useCallback(() => {
        return originalFileSizeBytes || (editedImage.src ? estimateDataUrlSize(editedImage.src) : 0);
    }, [originalFileSizeBytes, editedImage.src]);

    const toggleAccordion = (id: string) => {
        setActiveAccordion(prev => prev === id ? null : id);
    };

    const resetEditorState = useCallback(() => {
        setCrop(undefined);
        setCompletedCrop(undefined);
        setRotation(0);
        setActiveFilter(FilterType.NONE);
        setDimensions({ width: 0, height: 0 });
        setCompression(DEFAULT_IMAGE_COMPRESSION);
        setOriginalFileSizeBytes(0);
        setCurrentSizeBytes(0);

        let initialFolderId: number | '' = '';
        if (selectedFolderId && selectedFolderId !== ROOT_FOLDER_ID) {
            initialFolderId = selectedFolderId;
        } else {
            initialFolderId = ROOT_FOLDER_ID;
        }

        setEditedImage({ ...BLANK_IMAGE_STATE, folderId: initialFolderId });
        setPreviewDataUrl(null);
    }, [folders, selectedFolderId]);

    useEffect(() => {
        if (!isOpen) {
            setIsSaving(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('modal-open');
            setActiveAccordion('collapseResize');
            if (imageToEdit) {
                setEditedImage(imageToEdit);
                setCrop(undefined);
                setCompletedCrop(undefined);
                setRotation(0);
                setActiveFilter(FilterType.NONE);
                setDimensions({
                    width: imageToEdit.width || 0,
                    height: imageToEdit.height || 0,
                });
                const currentFileSize = imageToEdit.fileSizeBytes || 0;
                setCompression(DEFAULT_IMAGE_COMPRESSION);
                setOriginalFileSizeBytes(currentFileSize);
                setCurrentSizeBytes(currentFileSize);
            } else {
                resetEditorState();
            }
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [isOpen, imageToEdit, resetEditorState]);

    useEffect(() => {
        if (!isOpen || !editedImage.src || originalFileSizeBytes > 0) return;
        const src = editedImage.src;
        if (!src.startsWith('http')) return;
        let cancelled = false;
        fetchFileSizeFromUrl(src).then((size) => {
            if (!cancelled && size > 0) {
                setOriginalFileSizeBytes(size);
                setCurrentSizeBytes(size);
                setCompression(DEFAULT_IMAGE_COMPRESSION);
            }
        });
        return () => { cancelled = true; };
    }, [isOpen, editedImage.src, originalFileSizeBytes]);

    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
        setDimensions({ width, height });
        setCrop({
            unit: '%',
            width: 100,
            height: 100,
            x: 0,
            y: 0,
        });
        setCompletedCrop(undefined);
    }, []);

    const applyEdits = useCallback(() => {
        const image = imgRef.current;
        const canvas = previewCanvasRef.current;
        if (!image || !canvas || !image.complete || image.naturalWidth === 0) {
            return;
        }

        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        const cropToUse = completedCrop;
        const targetWidth = cropToUse ? cropToUse.width * scaleX : image.naturalWidth;
        const targetHeight = cropToUse ? cropToUse.height * scaleY : image.naturalHeight;

        canvas.width = dimensions.width || targetWidth;
        canvas.height = dimensions.height || targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.filter = activeFilter;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);

        const sourceX = cropToUse ? cropToUse.x * scaleX : 0;
        const sourceY = cropToUse ? cropToUse.y * scaleY : 0;
        const sourceWidth = cropToUse ? cropToUse.width * scaleX : image.naturalWidth;
        const sourceHeight = cropToUse ? cropToUse.height * scaleY : image.naturalHeight;

        ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
        ctx.restore();
    }, [completedCrop, rotation, activeFilter, dimensions]);

    useEffect(() => {
        const imageSrc = editedImage.src;
        if (!imageSrc) return;
        let cancelled = false;

        const updatePreview = async () => {
            applyEdits();
            const canvas = previewCanvasRef.current;
            if (!canvas || canvas.width === 0) return;

            try {
                const refSize = originalFileSizeBytes || estimateDataUrlSize(imageSrc);
                const blob = await exportCanvasWithCompression(
                    canvas,
                    compression,
                    refSize,
                    editedImage.name
                );
                if (cancelled) return;
                setCurrentSizeBytes(
                    compression >= 100 && originalFileSizeBytes > 0
                        ? originalFileSizeBytes
                        : blob.size
                );
                const dataUrl = await blobToDataUrl(blob);
                setPreviewDataUrl(dataUrl);

                const displayW = canvas.width;
                const displayH = canvas.height;
                const bitmap = await createImageBitmap(blob);
                const ctx = canvas.getContext('2d');
                if (ctx && !cancelled) {
                    ctx.clearRect(0, 0, displayW, displayH);
                    ctx.drawImage(bitmap, 0, 0, displayW, displayH);
                    bitmap.close();
                }
            } catch (err) {
                console.warn('Preview compression failed, using canvas fallback', err);
                if (!cancelled && previewCanvasRef.current) {
                    setPreviewDataUrl(previewCanvasRef.current.toDataURL('image/png'));
                }
            }
        };

        void updatePreview();
        return () => { cancelled = true; };
    }, [applyEdits, editedImage.src, editedImage.name, compression, originalFileSizeBytes]);

    const handleCompressionChange = (value: number) => {
        setCompression(value);
        const maxSize = getReferenceOriginalBytes();
        if (maxSize > 0) {
            setCurrentSizeBytes(getDisplayFileSize(maxSize, value));
        }
    };

    const handleImageUpload = (file: File) => {
        setOriginalFileSizeBytes(file.size);
        setCurrentSizeBytes(file.size);
        setCompression(DEFAULT_IMAGE_COMPRESSION);
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setEditedImage(prev => ({
                ...prev,
                src: reader.result as string,
                name: imageToEdit ? prev.name : file.name,
                imageCompression: DEFAULT_IMAGE_COMPRESSION,
                originalFileSizeBytes: file.size,
            }));
        });
        reader.readAsDataURL(file);
    };

    const handlePropertyChange = (field: string, value: string | number) => {
        setEditedImage(prev => ({ ...prev, [field]: value }));
    };

    const handleDimensionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setDimensions(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    };

    const handleFilterChange = (filter: FilterType) => {
        setActiveFilter(filter);
    };

    const buildFinalImageFromCanvas = async (): Promise<(Omit<Image, 'id'> & { id?: number }) | null> => {
        if (!editedImage.src || !previewCanvasRef.current) return null;

        applyEdits();
        const canvas = previewCanvasRef.current;
        const refSize =
            originalFileSizeBytes ||
            imageToEdit?.fileSizeBytes ||
            estimateDataUrlSize(editedImage.src);
        let saveName = imageToEdit ? imageToEdit.name : editedImage.name;
        if (!imageToEdit && compression < 100 && !/\.(jpe?g)$/i.test(saveName)) {
            saveName = ensureJpegFileName(saveName);
        }
        const blob = await exportCanvasWithCompression(canvas, compression, refSize, saveName);
        const finalImageSrc = await blobToDataUrl(blob);

        const maxSize = originalFileSizeBytes || blob.size;

        return {
            ...editedImage,
            src: finalImageSrc || editedImage.src,
            name: saveName,
            folderId: editedImage.folderId as number,
            imageCompression: compression,
            originalFileSizeBytes: maxSize,
            fileSizeBytes: blob.size,
        };
    };

    const persistImage = async (finalImage: (Omit<Image, 'id'> & { id?: number }) | null) => {
        if (!finalImage) return;
        await Promise.resolve(onSave(finalImage));
    };

    const handleSave = async () => {
        if (isSaving) return;
        if (!imageToEdit && editedImage.folderId === '') {
            alert(getTranslation('MSG_SELECT_UPLOAD_FOLDER', currentLanguage));
            return;
        }
        setIsSaving(true);
        try {
            const finalImage = await buildFinalImageFromCanvas();
            await persistImage(finalImage);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopyAndSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const built = await buildFinalImageFromCanvas();
            if (!built) return;

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...imageWithoutId } = built;

            const finalImage: Omit<Image, 'id'> = {
                ...imageWithoutId,
                title: editedImage.title ? `${editedImage.title}_Copy${imagesLength + 1}` : "",
            };
            await persistImage(finalImage);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const controlsDisabled = !editedImage.src || isSaving;

    return (
        <>
            <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex justify-center items-center" tabIndex={-1} role="dialog">
                <div className="edit-modal-large bg-white overflow-hidden relative">
                    {isSaving && (
                        <div
                            className="absolute inset-0 z-[130] flex flex-col items-center justify-center gap-3 bg-white/80"
                            role="status"
                            aria-live="polite"
                            aria-busy="true"
                        >
                            <span className="inline-block w-10 h-10 border-4 border-[var(--primary-color)]/30 border-t-[var(--primary-color)] rounded-full animate-spin" />
                            <span className="text-sm font-semibold text-gray-700">
                                {getTranslation('MSG_SAVING', currentLanguage)}
                            </span>
                        </div>
                    )}
                    {/* HEADER */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 24px',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#fff',
                        flexShrink: 0
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <ImageIcon className="w-5 h-5" style={{ color: 'var(--primary-color, #1d4ed8)' }} />
                            <h3 style={{
                                margin: 0,
                            }}>
                                {imageToEdit
                                    ? `${getTranslation('TITLE_EDITING', currentLanguage)}: ${editedImage.title || editedImage.name}`
                                    : getTranslation('TITLE_ADD_NEW_IMAGE', currentLanguage)}
                            </h3>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <TooltipMenu ComponentId={imageToEdit ? '16311' : '16312'} />
                            <button type="button" className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed" onClick={onClose} disabled={isSaving} aria-label={getTranslation('BTN_CLOSE', currentLanguage)}><X className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div
                        className="addimg scrollbar pb-6 pt-2 border-0 px-5"
                        style={{
                            flexGrow: 1,
                            flexShrink: 1,
                            flexBasis: 'auto',
                            minHeight: 0,
                            overflowY: 'auto'
                        }}
                    >
                        <div className="im-editor-layout h-full">
                            {/* Left Column: Uploader & Controls */}
                            <div className="im-editor-left flex flex-col w-full">
                                <div className="mb-5">
                                    <h6 style={{ fontWeight: 600, color: '#4b5563', fontSize: '0.84rem', marginBottom: '10px' }}>
                                        {editedImage.src ? getTranslation('LABEL_REPLACE_IMAGE', currentLanguage) : getTranslation('LABEL_STEP_UPLOAD', currentLanguage)}
                                    </h6>
                                    <ImageUploader onImageUpload={handleImageUpload} images={images} />
                                </div>
                                <div className="grow" style={{ opacity: controlsDisabled ? 0.6 : 1, pointerEvents: controlsDisabled ? 'none' : 'auto' }}>
                                    <h6 style={{ fontWeight: 600, color: '#4b5563', fontSize: '0.84rem', marginBottom: '10px' }}>
                                        {getTranslation('LABEL_STEP_ADJUST', currentLanguage)}
                                    </h6>
                                    <div className="space-y-2" id="editorControlsAccordion">
                                        {/* Resize */}
                                        <div className="border border-gray-200">
                                            <h2>
                                                <button
                                                    className="w-full px-3 py-2 flex items-center justify-between text-left bg-gray-50 text-sm font-medium text-gray-700"
                                                    type="button"
                                                    onClick={() => toggleAccordion('collapseResize')}
                                                    aria-expanded={activeAccordion === 'collapseResize'}
                                                >
                                                    <span>{getTranslation('LABEL_RESIZE', currentLanguage)}</span>
                                                    {activeAccordion === 'collapseResize' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </h2>
                                            <div id="collapseResize" className={`${activeAccordion === 'collapseResize' ? 'block' : 'hidden'}`}>
                                                <div className="p-3">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="flex">
                                                            <span className="inline-flex items-center justify-center w-10 border border-gray-300 border-r-0 bg-gray-100 text-xs font-semibold">W</span>
                                                            <input type="number" className="h-9 border border-gray-300 w-full px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]" name="width" value={dimensions.width} onChange={handleDimensionChange} />
                                                        </div>
                                                        <div className="flex">
                                                            <span className="inline-flex items-center justify-center w-10 border border-gray-300 border-r-0 bg-gray-100 text-xs font-semibold">H</span>
                                                            <input type="number" className="h-9 border border-gray-300 w-full px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]" name="height" value={dimensions.height} onChange={handleDimensionChange} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Image Compression */}
                                        <div className="border border-gray-200">
                                            <h2>
                                                <button
                                                    className="w-full px-3 py-2 flex items-center justify-between text-left bg-gray-50 text-sm font-medium text-gray-700"
                                                    type="button"
                                                    onClick={() => toggleAccordion('collapseCompression')}
                                                    aria-expanded={activeAccordion === 'collapseCompression'}
                                                >
                                                    <span>{getTranslation('LABEL_IMAGE_COMPRESSION', currentLanguage)}</span>
                                                    {activeAccordion === 'collapseCompression' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </h2>
                                            <div id="collapseCompression" className={`${activeAccordion === 'collapseCompression' ? 'block' : 'hidden'}`}>
                                                <div className="p-3">
                                                    <input
                                                        type="range"
                                                        min={0}
                                                        max={100}
                                                        step={1}
                                                        value={compression}
                                                        onChange={(e) => handleCompressionChange(parseInt(e.target.value, 10))}
                                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]"
                                                        aria-label={getTranslation('LABEL_IMAGE_COMPRESSION', currentLanguage)}
                                                    />
                                                    <p className="text-sm text-gray-600 mt-2 text-center">
                                                        {getTranslation('LABEL_CURRENT_SIZE', currentLanguage)}:{' '}
                                                        <strong>{formatFileSize(currentSizeBytes)}</strong>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Rotate */}
                                        <div className="border border-gray-200">
                                            <h2>
                                                <button
                                                    className="w-full px-3 py-2 flex items-center justify-between text-left bg-gray-50 text-sm font-medium text-gray-700"
                                                    type="button"
                                                    onClick={() => toggleAccordion('collapseRotate')}
                                                    aria-expanded={activeAccordion === 'collapseRotate'}
                                                >
                                                    <span>{getTranslation('LABEL_ROTATE', currentLanguage)}</span>
                                                    {activeAccordion === 'collapseRotate' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </h2>
                                            <div id="collapseRotate" className={`${activeAccordion === 'collapseRotate' ? 'block' : 'hidden'}`}>
                                                <div className="p-3">
                                                    <div className="flex gap-2">
                                                        <button className="h-9 px-3 border border-gray-300 text-sm w-full inline-flex items-center justify-center gap-1 hover:bg-gray-50" onClick={() => setRotation(r => r - 90)}><RotateCcw className="w-4 h-4" /> Left</button>
                                                        <button className="h-9 px-3 border border-gray-300 text-sm w-full inline-flex items-center justify-center gap-1 hover:bg-gray-50" onClick={() => setRotation(r => r + 90)}>Right <RotateCw className="w-4 h-4" /></button>
                                                    </div>
                                                    <p className="text-gray-500 text-center mt-2 text-sm">Current: {rotation}°</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Filters */}
                                        <div className="border border-gray-200">
                                            <h2>
                                                <button
                                                    className="w-full px-3 py-2 flex items-center justify-between text-left bg-gray-50 text-sm font-medium text-gray-700"
                                                    type="button"
                                                    onClick={() => toggleAccordion('collapseFilters')}
                                                    aria-expanded={activeAccordion === 'collapseFilters'}
                                                >
                                                    <span>{getTranslation('LABEL_FILTERS', currentLanguage)}</span>
                                                    {activeAccordion === 'collapseFilters' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </h2>
                                            <div id="collapseFilters" className={`${activeAccordion === 'collapseFilters' ? 'block' : 'hidden'}`}>
                                                <div className="p-3">
                                                    <div className="grid grid-cols-2 gap-2" role="group">
                                                        <button type="button" className={`h-9 px-3 text-sm border ${activeFilter === FilterType.NONE ? 'bg-[var(--btn-primary-bg)] text-white border-[var(--btn-primary-bg)]' : 'bg-white text-gray-700 border-gray-300'}`} onClick={() => handleFilterChange(FilterType.NONE)}>None</button>
                                                        <button type="button" className={`h-9 px-3 text-sm border ${activeFilter === FilterType.GRAYSCALE ? 'bg-[var(--btn-primary-bg)] text-white border-[var(--btn-primary-bg)]' : 'bg-white text-gray-700 border-gray-300'}`} onClick={() => handleFilterChange(FilterType.GRAYSCALE)}>Grayscale</button>
                                                        <button type="button" className={`h-9 px-3 text-sm border ${activeFilter === FilterType.SEPIA ? 'bg-[var(--btn-primary-bg)] text-white border-[var(--btn-primary-bg)]' : 'bg-white text-gray-700 border-gray-300'}`} onClick={() => handleFilterChange(FilterType.SEPIA)}>Sepia</button>
                                                        <button type="button" className={`h-9 px-3 text-sm border ${activeFilter === FilterType.INVERT ? 'bg-[var(--btn-primary-bg)] text-white border-[var(--btn-primary-bg)]' : 'bg-white text-gray-700 border-gray-300'}`} onClick={() => handleFilterChange(FilterType.INVERT)}>Invert</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Image Properties */}
                                        <div className="border border-gray-200">
                                            <h2>
                                                <button
                                                    className="w-full px-3 py-2 flex items-center justify-between text-left bg-gray-50 text-sm font-medium text-gray-700"
                                                    type="button"
                                                    onClick={() => toggleAccordion('collapseProperties')}
                                                    aria-expanded={activeAccordion === 'collapseProperties'}
                                                >
                                                    <span>{getTranslation('LABEL_IMAGE_PROPERTIES', currentLanguage)}</span>
                                                    {activeAccordion === 'collapseProperties' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </h2>
                                            <div id="collapseProperties" className={`${activeAccordion === 'collapseProperties' ? 'block' : 'hidden'}`}>
                                                <div className="p-3">
                                                    {!imageToEdit && (
                                                        <div className="mb-3">
                                                            <label htmlFor="folderId" className="block text-xs font-bold text-red-600 mb-1">{getTranslation('LABEL_SELECT_FOLDER', currentLanguage)}</label>
                                                            <select
                                                                id="folderId"
                                                                className="h-9 w-full border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                                                                value={editedImage.folderId === '' ? '' : editedImage.folderId}
                                                                onChange={(e) => handlePropertyChange('folderId', parseInt(e.target.value, 10))}
                                                                required
                                                            >
                                                                <option value="" disabled>{getTranslation('PH_CHOOSE_FOLDER', currentLanguage)}</option>
                                                                <option value={ROOT_FOLDER_ID}>{getTranslation('LABEL_ROOT_UPLOAD', currentLanguage)}</option>
                                                                {folders.map(folder => (
                                                                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                    <div className="mb-2">
                                                        <label htmlFor="imageName" className="block text-xs mb-1">{getTranslation('LABEL_NAME', currentLanguage)}</label>
                                                        <input type="text" id="imageName" className="h-9 w-full border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)] disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" value={editedImage.name} onChange={(e) => handlePropertyChange('name', e.target.value)} placeholder={getTranslation('PH_IMG_NAME_EXAMPLE', currentLanguage)} disabled={!!imageToEdit} />
                                                    </div>
                                                    <div className="mb-2">
                                                        <label htmlFor="title" className="block text-xs mb-1">{getTranslation('LABEL_TITLE', currentLanguage)}</label>
                                                        <input type="text" id="title" className="h-9 w-full border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]" value={editedImage.title} onChange={(e) => handlePropertyChange('title', e.target.value)} placeholder={getTranslation('PH_IMG_TITLE_EXAMPLE', currentLanguage)} />
                                                    </div>
                                                    <div className="mb-2">
                                                        <label htmlFor="description" className="block text-xs mb-1">{getTranslation('LABEL_DESCRIPTION', currentLanguage)}</label>
                                                        <textarea id="description" className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]" rows={3} value={editedImage.description} onChange={(e) => handlePropertyChange('description', e.target.value)} placeholder={getTranslation('PH_IMG_DESC_EXAMPLE', currentLanguage)}></textarea>
                                                    </div>
                                                    <div className="mb-2">
                                                        <label htmlFor="copyright" className="block text-xs mb-1">{getTranslation('LABEL_COPYRIGHT', currentLanguage)}</label>
                                                        <input type="text" id="copyright" className="h-9 w-full border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]" value={editedImage.copyright || ''} onChange={(e) => handlePropertyChange('copyright', e.target.value)} />
                                                    </div>
                                                    <div className="mb-2">
                                                        <label htmlFor="altText" className="block text-xs mb-1">{getTranslation('LABEL_ALT_TEXT', currentLanguage)}</label>
                                                        <input type="text" id="altText" className="h-9 w-full border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]" value={editedImage.altText || ''} onChange={(e) => handlePropertyChange('altText', e.target.value)} />
                                                    </div>
                                                    <div className="mb-2">
                                                        <label htmlFor="keywords" className="block text-xs mb-1">{getTranslation('LABEL_KEYWORDS', currentLanguage)}</label>
                                                        <input type="text" id="keywords" className="h-9 w-full border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]" value={editedImage.keywords || ''} onChange={(e) => handlePropertyChange('keywords', e.target.value)} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {imageToEdit && (
                                    <ImageUsagePanel
                                        image={{
                                            id: imageToEdit.id,
                                            src: editedImage.src || imageToEdit.src,
                                            name: editedImage.name || imageToEdit.name,
                                        }}
                                    />
                                )}
                            </div>
                            {/* Right Column: Editor & Preview */}
                            <div className="im-editor-right flex flex-col h-full min-w-0">
                                {!editedImage.src ? (
                                    <div className="flex justify-center items-center h-full border border-gray-200 rounded-sm bg-gray-100">
                                        <div className="text-center text-gray-500">
                                            <ImageIcon className="w-24 h-24 mx-auto" />
                                            <h4 className="mt-3 text-[35px] font-semibold text-[#1f3f76] leading-none">Image Preview Area</h4>
                                            <p>Upload an image to start editing.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div
                                            className="p-3 rounded-sm grow w-full"
                                            style={{
                                                backgroundColor: '#6b7280',
                                                minHeight: '360px'
                                            }}
                                        >
                                            <div className="w-full h-full flex items-center justify-center overflow-hidden">
                                                <ReactCrop
                                                    crop={crop}
                                                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                                                    onComplete={(c) => setCompletedCrop(c)}
                                                >
                                                    <SPImage
                                                        key={editedImage.src || 'empty'}
                                                        ref={imgRef}
                                                        src={editedImage.src}
                                                        alt="Upload Preview"
                                                        onLoad={onImageLoad}
                                                        style={{
                                                            maxHeight: '320px',
                                                            maxWidth: '100%',
                                                            objectFit: 'contain'
                                                        }}
                                                    />
                                                </ReactCrop>
                                            </div>
                                        </div>
                                        <div className="mt-3 shrink-0">
                                            <h6 className="text-gray-500 text-center mb-2 text-sm">Live Preview</h6>
                                            <div
                                                className="relative text-center"
                                                onMouseEnter={() => setIsPreviewHovered(true)}
                                                onMouseLeave={() => setIsPreviewHovered(false)}
                                            >
                                                <canvas
                                                    ref={previewCanvasRef}
                                                    className="border rounded shadow-sm mx-auto"
                                                    style={{
                                                        maxWidth: '100%',
                                                        maxHeight: '15vh',
                                                        objectFit: 'contain'
                                                    }}
                                                />
                                                {isPreviewHovered && previewDataUrl && (
                                                    <div
                                                        className="absolute p-1 bg-white border rounded shadow-lg"
                                                        style={{
                                                            bottom: '100%',
                                                            left: '50%',
                                                            transform: 'translateX(-50%)',
                                                            marginBottom: '10px',
                                                            width: 'auto',
                                                            maxWidth: '400px',
                                                            zIndex: 1056
                                                        }}
                                                    >
                                                        <SPImage
                                                            src={previewDataUrl}
                                                            alt="Large preview of edits"
                                                            style={{
                                                                width: '100%',
                                                                height: 'auto',
                                                                objectFit: 'contain'
                                                            }}
                                                        />
                                                        <div className="text-center text-xs text-gray-500 bg-gray-100 p-1">Large Preview</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* FOOTER */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 24px',
                        borderTop: '1px solid #e5e7eb',
                        background: '#fff',
                        flexShrink: 0,
                        position: 'sticky',
                        bottom: 0,
                        zIndex: 2
                    }}>
                        {/* Left: metadata + delete */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px', color: '#6b7280' }}>
                            {imageToEdit && (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span>Created</span>
                                        <span style={{ color: 'var(--primary-color, #1d4ed8)', fontWeight: 600 }}>
                                            {editedImage?.created ? new Date(editedImage.created).toLocaleDateString('en-GB') : ''}
                                        </span>
                                        {editedImage?.author && <><span>By</span><span style={{ color: 'var(--primary-color, #1d4ed8)', fontWeight: 600 }}>{editedImage.author}</span></>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span>Last modified</span>
                                        <span style={{ color: 'var(--primary-color, #1d4ed8)', fontWeight: 600 }}>
                                            {editedImage?.modifiedDate ? new Date(editedImage.modifiedDate).toLocaleDateString('en-GB') : ''}
                                        </span>
                                        {editedImage?.editor && <><span>By</span><span style={{ color: 'var(--primary-color, #1d4ed8)', fontWeight: 600 }}>{editedImage.editor}</span></>}
                                    </div>
                                    {onDelete && imageToEdit && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (confirm(getTranslation('MSG_DELETE_CONFIRM', currentLanguage))) {
                                                    // @ts-ignore
                                                    onDelete(imageToEdit);
                                                }
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#ef4444',
                                                fontWeight: 700,
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                padding: '2px 0',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <span className="inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />{getTranslation('BTN_DELETE_ITEM', currentLanguage)}</span>
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Right: action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSaving}
                                style={{
                                    boxSizing: 'border-box',
                                    height: '40px',
                                    minHeight: '40px',
                                    padding: '0 20px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    background: '#fff',
                                    color: '#374151',
                                    fontWeight: 700,
                                    fontSize: '13px',
                                    cursor: isSaving ? 'not-allowed' : 'pointer',
                                    opacity: isSaving ? 0.5 : 1
                                }}
                            >
                                {getTranslation('BTN_CANCEL', currentLanguage)}
                            </button>
                            {imageToEdit && (
                                <button
                                    type="button"
                                    onClick={() => void handleCopyAndSave()}
                                    disabled={controlsDisabled}
                                    style={{
                                        boxSizing: 'border-box',
                                        height: '40px',
                                        minHeight: '40px',
                                        padding: '0 18px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        border: '1px solid var(--primary-color, #1d4ed8)',
                                        borderRadius: '4px',
                                        background: '#fff',
                                        color: 'var(--primary-color, #1d4ed8)',
                                        fontWeight: 700,
                                        fontSize: '13px',
                                        cursor: controlsDisabled ? 'not-allowed' : 'pointer',
                                        opacity: controlsDisabled ? 0.5 : 1
                                    }}
                                >
                                    <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden />
                                    {getTranslation('BTN_COPY_SAVE_NEW', currentLanguage)}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => void handleSave()}
                                disabled={controlsDisabled}
                                style={{
                                    boxSizing: 'border-box',
                                    height: '40px',
                                    minHeight: '40px',
                                    padding: '0 20px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    border: 'none',
                                    borderRadius: '4px',
                                    background: 'var(--primary-color, #1d4ed8)',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '13px',
                                    cursor: controlsDisabled ? 'not-allowed' : 'pointer',
                                    opacity: controlsDisabled ? 0.5 : 1
                                }}
                            >
                                {isSaving && (
                                    <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
                                )}
                                {isSaving
                                    ? getTranslation('MSG_SAVING', currentLanguage)
                                    : imageToEdit
                                        ? getTranslation('BTN_SAVE_CHANGES', currentLanguage)
                                        : getTranslation('BTN_SAVE_IMAGE', currentLanguage)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ImageEditorModal;