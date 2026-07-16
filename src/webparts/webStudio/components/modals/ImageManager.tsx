import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore, getTranslation } from '../../store';
import { useNestedPortalZ, getNestedPortalZFromStore } from '../../utils/modalZIndex';
import { GenericModal, OpenOOTBButton, EditTrigger } from './SharedModals';
import JoditRichTextEditor from '../JoditEditor';
import { ImageItem } from '../../types';
import { ImageIcon, X, Upload, Crop, RotateCw, RotateCcw, Sliders, Info, ChevronUp, ChevronDown, Monitor, ZoomIn, Save, Plus, Search, Pencil, Trash2, Folder } from "lucide-react";
import TooltipMenu from '../common/TooltipMenu';
import { useImageOptimizer } from '../../../../hooks/useImageOptimizer';
import { ImageUploadCancelledError } from '../../../../utils/imageUploadPipeline';
import ImageOptimizationFeedback from '../../../../components/ImageOptimizationFeedback';

// --- SUB-COMPONENT: FOLDER ITEM ---
const FolderItem = ({ folder, isActive, onClick }: any) => (
    <div
        onClick={() => onClick(folder.id)}
        className={`flex justify-between items-center px-4 py-3 cursor-pointer text-sm font-medium transition-colors border-l-4 ${isActive ? 'bg-[var(--brand-light)] text-[var(--primary-color)] border-[var(--primary-color)]' : 'bg-white text-gray-600 hover:bg-gray-50 border-transparent'}`}
    >
        <div className="flex items-center gap-3">
            <Folder className={`w-4 h-4 ${isActive ? 'text-[var(--primary-color)]' : 'text-gray-400'}`} />
            <span>{folder.name}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-[var(--primary-color)] text-white' : 'bg-gray-100 text-gray-500'}`}>
            {folder.count || 0}
        </span>
    </div>
);

interface EditState {
    rotate: number;
    scale: number;
    filter: string;
    crop: { x: number, y: number, width: number, height: number }; // Percentages
}

// --- SUB-MODAL: IMAGE EDITOR ---
const ImageEditor = ({
    title,
    initialImage,
    isNew,
    onClose,
    onSave,
    onDelete
}: {
    title: string,
    initialImage: Partial<ImageItem>,
    isNew: boolean;
    onClose: () => void;
    onSave: (image: ImageItem) => void;
    onDelete?: (id: string) => void;
}) => {
    const { imageFolders, images, uploadImage, updateImage, checkImageExists, currentLanguage } = useStore();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const [method, setMethod] = useState<'UPLOAD' | 'URL' | 'PASTE' | 'GALLERY'>('UPLOAD');
    const [urlInput, setUrlInput] = useState('');

    const [previewUrl, setPreviewUrl] = useState<string | null>(initialImage.url || null);
    const [fileName, setFileName] = useState(initialImage.name || '');
    const [imgTitle, setImgTitle] = useState(initialImage.title || '');
    const [imgDescription, setImgDescription] = useState(initialImage.description || '');
    const [imgAltText, setImgAltText] = useState(initialImage.altText || initialImage.title || '');
    const [imgCopyright, setImgCopyright] = useState(initialImage.copyright || '');
    const [imgKeywords, setImgKeywords] = useState(initialImage.keywords || '');
    const [selectedFolder, setSelectedFolder] = useState(initialImage.folderId || (imageFolders[0]?.id || 'General'));

    // Editor State
    const [editState, setEditState] = useState<EditState>({
        rotate: 0,
        scale: 1,
        filter: 'none',
        crop: { x: 10, y: 10, width: 80, height: 80 }
    });
    const [isAccordionOpen, setIsAccordionOpen] = useState({ resize: true, rotate: true, filters: false, props: false });
    const [isHoveringPreview, setIsHoveringPreview] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const imageOptimizer = useImageOptimizer();

    // Interactive Crop State
    const [isDraggingCrop, setIsDraggingCrop] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [cropStart, setCropStart] = useState({ x: 0, y: 0 });
    const cropBoxRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Additional handlers
    const handleUrlLoad = () => {
        if (urlInput) {
            setPreviewUrl(urlInput);
            if (isNew) {
                setFileName(urlInput.split('/').pop() || 'image-url.jpg');
            }
        }
    };

    const applyOptimizedPreview = async (file: File) => {
        const prepared = await imageOptimizer.prepareFile(file);
        setSelectedFile(prepared.file);
        setPreviewUrl(prepared.previewUrl);
        if (isNew) {
            setFileName(prepared.file.name);
        }
        setEditState({ rotate: 0, scale: 1, filter: 'none', crop: { x: 10, y: 10, width: 80, height: 80 } });
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    e.preventDefault();
                    imageOptimizer.prepareBlob(blob, 'pasted-image.png')
                        .then((prepared) => {
                            setSelectedFile(prepared.file);
                            setPreviewUrl(prepared.previewUrl);
                            if (isNew) {
                                setFileName(prepared.file.name);
                            }
                        })
                        .catch((err) => {
                            if (err instanceof ImageUploadCancelledError) return;
                            console.error(err);
                        });
                }
            }
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) {
            applyOptimizedPreview(file).catch((err) => {
                if (err instanceof ImageUploadCancelledError) return;
                console.error(err);
            });
        }
    };

    const handleCropMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingCrop(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setCropStart({ x: editState.crop.x, y: editState.crop.y });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingCrop || !containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const deltaX = ((e.clientX - dragStart.x) / containerRect.width) * 100;
            const deltaY = ((e.clientY - dragStart.y) / containerRect.height) * 100;
            let newX = cropStart.x + deltaX;
            let newY = cropStart.y + deltaY;
            newX = Math.max(0, Math.min(newX, 100 - editState.crop.width));
            newY = Math.max(0, Math.min(newY, 100 - editState.crop.height));
            setEditState(prev => ({ ...prev, crop: { ...prev.crop, x: newX, y: newY } }));
        };
        const handleMouseUp = () => setIsDraggingCrop(false);
        if (isDraggingCrop) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingCrop, dragStart, cropStart, editState.crop.width, editState.crop.height]);

    const handleSave = async () => {
        if (!previewUrl && !initialImage.url) return;

        setIsSaving(true);
        try {
            let fileToUpload: File | null = selectedFile;

            // Check for edits (Rotate, Filter, Crop, Scale)
            const hasEdits = editState.rotate !== 0 || editState.filter !== 'none' || editState.scale !== 1 ||
                editState.crop.width < 100 || editState.crop.height < 100 || editState.crop.x > 0 || editState.crop.y > 0;

            if (hasEdits && previewUrl) {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = previewUrl;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });

                const sx = (editState.crop.x / 100) * img.naturalWidth;
                const sy = (editState.crop.y / 100) * img.naturalHeight;
                const sw = (editState.crop.width / 100) * img.naturalWidth;
                const sh = (editState.crop.height / 100) * img.naturalHeight;

                const dw = sw * editState.scale;
                const dh = sh * editState.scale;

                const isVertical = Math.abs(editState.rotate % 180) === 90;
                const canvasWidth = isVertical ? dh : dw;
                const canvasHeight = isVertical ? dw : dh;

                const canvas = document.createElement('canvas');
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                const ctx = canvas.getContext('2d');

                if (ctx) {
                    if (editState.filter !== 'none') ctx.filter = editState.filter;
                    ctx.translate(canvasWidth / 2, canvasHeight / 2);
                    ctx.rotate((editState.rotate * Math.PI) / 180);
                    ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
                }

                const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
                let mimeType = 'image/jpeg';
                if (ext === 'png') mimeType = 'image/png';
                if (ext === 'webp') mimeType = 'image/webp';

                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mimeType, 0.9));
                if (blob) {
                    const saveFileName = isNew ? fileName : (initialImage.name || fileName);
                    fileToUpload = new File([blob], saveFileName, { type: mimeType });
                }
            }

            const metadata = {
                Title: imgTitle || fileName,
                AltText: imgAltText || imgTitle || fileName,
                AssetCategory: selectedFolder !== 'all' ? selectedFolder : 'General',
                Description: imgDescription,
                CopyrightInfo: imgCopyright,
                Keywords: imgKeywords
            };

            if (isNew) {
                if (fileToUpload) {
                    // Validate if file exists
                    const exists = await checkImageExists(fileToUpload.name, selectedFolder !== 'all' ? selectedFolder : '');
                    if (exists) {
                        if (!confirm(`A file named "${fileToUpload.name}" already exists in the selected folder. Do you want to overwrite it?`)) {
                            setIsSaving(false);
                            return;
                        }
                    }
                    await uploadImage(fileToUpload, selectedFolder !== 'all' ? selectedFolder : '', metadata);
                }
            } else {
                const updatedItem: ImageItem = {
                    ...initialImage as ImageItem,
                    title: imgTitle || fileName,
                    description: imgDescription,
                    altText: imgAltText,
                    copyright: imgCopyright,
                    keywords: imgKeywords,
                    folderId: selectedFolder,
                    url: fileToUpload ? '' : initialImage.url! // If fileToUpload, it will be handled by store/service
                };

                if (fileToUpload) {
                    // Convert file back to dataURL for store.updateImage to pick it up as edited
                    const reader = new FileReader();
                    const dataUrl = await new Promise<string>((resolve) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(fileToUpload!);
                    });
                    updatedItem.url = dataUrl;
                }

                await updateImage(updatedItem);
            }
            onClose();
        } catch (error) {
            console.error("Error saving image", error);
            alert("Failed to save image. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!isNew && initialImage.id && onDelete) {
            if (confirm('Are you sure you want to delete this image? This cannot be undone.')) {
                setIsSaving(true);
                try {
                    await onDelete(initialImage.id);
                    onClose();
                } catch (error) {
                    console.error("Error deleting image", error);
                    setIsSaving(false);
                }
            }
        }
    };

    const FILTERS = [
        { id: 'none', label: 'None', val: 'none' },
        { id: 'grayscale', label: 'B&W', val: 'grayscale(100%)' },
        { id: 'sepia', label: 'Sepia', val: 'sepia(100%)' },
        { id: 'contrast', label: 'Contrast', val: 'contrast(150%)' },
        { id: 'blur', label: 'Blur', val: 'blur(2px)' },
    ];

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(0) }}>
            <div className="bg-white w-[95vw] h-[90vh] max-w-[1400px] shadow-2xl flex flex-col rounded-sm relative overflow-hidden">
                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-[var(--primary-color)]" />
                        <h3 className="text-lg font-bold text-gray-800">{isNew ? getTranslation('TITLE_ADD_NEW_IMAGE', currentLanguage) : `${getTranslation('LABEL_EDITING', currentLanguage)}: ${fileName}`}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <TooltipMenu ComponentId={isNew ? '16311' : '16312'} />
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex items-center justify-center w-8 h-8 rounded-sm hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT PANEL */}
                    <div className="w-[380px] bg-white border-r border-gray-200 flex flex-col overflow-y-auto custom-scrollbar">
                        <div className="p-6 border-b border-gray-200 bg-gray-50/50">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{isNew ? 'Bildquelle auswaehlen' : 'Bild ersetzen'}</h4>

                            {/* Method Tabs */}
                            <div className="flex bg-gray-200 p-1 rounded-sm mb-4">
                                {['UPLOAD', 'URL', 'PASTE', 'GALLERY'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setMethod(m as any)}
                                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-sm transition-all ${method === m ? 'bg-white text-[var(--primary-color)] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>

                            <div className="bg-white border border-gray-200 rounded-sm p-4 min-h-[140px] flex flex-col justify-center relative">
                                {method === 'UPLOAD' && (
                                    <label className="border-2 border-dashed border-gray-300 rounded-sm p-6 text-center cursor-pointer hover:border-[var(--primary-color)] hover:bg-blue-50 transition-colors group flex flex-col items-center h-full justify-center">
                                        <Upload className="w-8 h-8 text-gray-300 mb-2 group-hover:text-[var(--primary-color)]" />
                                        <p className="text-xs font-bold text-gray-600">Click to Upload File</p>
                                        <p className="text-[10px] text-gray-400 mt-1">JPG, PNG, WEBP supported</p>
                                        <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" disabled={imageOptimizer.isOptimizing} />
                                        <div className="mt-2 w-full">
                                            <ImageOptimizationFeedback stats={imageOptimizer.stats} isProcessing={imageOptimizer.isOptimizing} />
                                        </div>
                                    </label>
                                )}

                                {method === 'URL' && (
                                    <div className="flex flex-col gap-2 h-full justify-center">
                                        <input
                                            type="text"
                                            placeholder="https://example.com/image.jpg"
                                            value={urlInput}
                                            onChange={(e) => setUrlInput(e.target.value)}
                                            className="w-full border border-gray-300 p-2 text-sm rounded-sm"
                                        />
                                        <button onClick={handleUrlLoad} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 rounded-sm border border-gray-300">
                                            Load Image
                                        </button>
                                    </div>
                                )}

                                {method === 'PASTE' && (
                                    <div
                                        className="h-full border-2 border-dashed border-gray-300 rounded-sm flex flex-col items-center justify-center bg-gray-50 focus:bg-white focus:border-[var(--primary-color)] outline-none transition-colors"
                                        contentEditable
                                        onPaste={handlePaste}
                                        suppressContentEditableWarning
                                    >
                                        <p className="text-xs font-bold text-gray-500 pointer-events-none">Click here & Press Ctrl+V</p>
                                    </div>
                                )}

                                {method === 'GALLERY' && (
                                    <div className="h-40 overflow-y-auto custom-scrollbar grid grid-cols-3 gap-2 p-1">
                                        {images.length > 0 ? images.map(img => (
                                            <div key={img.id} onClick={() => { setPreviewUrl(img.url); setFileName(`copy-${img.name}`); }} className="aspect-square bg-gray-100 cursor-pointer hover:ring-2 ring-[var(--primary-color)] border border-gray-200">
                                                <img src={img.url} className="w-full h-full object-cover" loading="lazy" />
                                            </div>
                                        )) : <p className="col-span-3 text-center text-xs text-gray-400 py-4">No images in library</p>}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 p-6">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Anpassen und Bearbeiten</h4>
                            <div className="border border-gray-200 rounded-sm bg-white shadow-sm divide-y divide-gray-100">
                                <div>
                                    <button onClick={() => setIsAccordionOpen(p => ({ ...p, resize: !p.resize }))} className="w-full flex justify-between items-center px-4 py-3 hover:bg-gray-50 text-sm font-medium text-gray-700">
                                        <span className="flex items-center gap-2"><Crop className="w-4 h-4 text-gray-400" /> Resize & Crop</span>
                                        {isAccordionOpen.resize ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                    </button>
                                    {isAccordionOpen.resize && (
                                        <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-4">
                                            <div>
                                                <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1"><span>{getTranslation('LABEL_ZOOM', currentLanguage)}</span><span>{Math.round(editState.scale * 100)}%</span></div>
                                                <input type="range" min="0.5" max="3" step="0.1" value={editState.scale} onChange={e => setEditState(s => ({ ...s, scale: parseFloat(e.target.value) }))} className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]" />
                                            </div>
                                            <div className="text-[10px] text-gray-400 italic flex items-center gap-1"><Info className="w-3 h-3" /> Drag crop box on image to adjust</div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <button onClick={() => setIsAccordionOpen(p => ({ ...p, rotate: !p.rotate }))} className="w-full flex justify-between items-center px-4 py-3 hover:bg-gray-50 text-sm font-medium text-gray-700">
                                        <span className="flex items-center gap-2"><RotateCw className="w-4 h-4 text-gray-400" /> Rotate</span>
                                        {isAccordionOpen.rotate ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                    </button>
                                    {isAccordionOpen.rotate && (
                                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-center gap-4">
                                            <button onClick={() => setEditState(s => ({ ...s, rotate: s.rotate - 90 }))} className="p-2 bg-white border border-gray-300 rounded-sm hover:bg-gray-100 text-gray-600"><RotateCcw className="w-4 h-4" /></button>
                                            <button onClick={() => setEditState(s => ({ ...s, rotate: s.rotate + 90 }))} className="p-2 bg-white border border-gray-300 rounded-sm hover:bg-gray-100 text-gray-600"><RotateCw className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <button onClick={() => setIsAccordionOpen(p => ({ ...p, filters: !p.filters }))} className="w-full flex justify-between items-center px-4 py-3 hover:bg-gray-50 text-sm font-medium text-gray-700">
                                        <span className="flex items-center gap-2"><Sliders className="w-4 h-4 text-gray-400" /> Filters</span>
                                        {isAccordionOpen.filters ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                    </button>
                                    {isAccordionOpen.filters && (
                                        <div className="p-4 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-2">
                                            {FILTERS.map(f => (
                                                <button key={f.id} onClick={() => setEditState(s => ({ ...s, filter: f.val }))} className={`px-2 py-1.5 text-xs font-bold rounded-sm border transition-colors ${editState.filter === f.val ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>{f.label}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <button onClick={() => setIsAccordionOpen(p => ({ ...p, props: !p.props }))} className="w-full flex justify-between items-center px-4 py-3 hover:bg-gray-50 text-sm font-medium text-gray-700">
                                        <span className="flex items-center gap-2"><Info className="w-4 h-4 text-gray-400" /> Properties</span>
                                        {isAccordionOpen.props ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                    </button>
                                    {isAccordionOpen.props && (
                                        <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-3">
                                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_NAME', currentLanguage)}</label><input type="text" value={fileName} onChange={e => setFileName(e.target.value)} disabled={!isNew} className="w-full border border-gray-300 p-1.5 text-sm rounded-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" /></div>
                                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_TITLE', currentLanguage)}</label><input type="text" value={imgTitle} onChange={e => setImgTitle(e.target.value)} className="w-full border border-gray-300 p-1.5 text-sm rounded-sm" /></div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_DESCRIPTION', currentLanguage)}</label>
                                                <JoditRichTextEditor
                                                    value={imgDescription}
                                                    onChange={(val: string) => setImgDescription(val)}
                                                    height={160}
                                                    placeholder={getTranslation('PLACEHOLDER_DESCRIPTION', currentLanguage)}
                                                />
                                            </div>
                                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_COPYRIGHT', currentLanguage)}</label><input type="text" value={imgCopyright} onChange={e => setImgCopyright(e.target.value)} className="w-full border border-gray-300 p-1.5 text-sm rounded-sm" /></div>
                                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_ALT_TEXT', currentLanguage)}</label><input type="text" value={imgAltText} onChange={e => setImgAltText(e.target.value)} className="w-full border border-gray-300 p-1.5 text-sm rounded-sm" /></div>
                                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_KEYWORDS', currentLanguage)}</label><input type="text" value={imgKeywords} onChange={e => setImgKeywords(e.target.value)} className="w-full border border-gray-300 p-1.5 text-sm rounded-sm" /></div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_TARGET_FOLDER', currentLanguage)}</label>
                                            <select value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)} className="w-full border border-gray-300 p-1.5 text-sm rounded-sm bg-white">
                                                <option value="General">General</option>
                                                {imageFolders.filter(f => f.id !== 'all').map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL */}
                    <div className="flex-1 bg-gray-100 flex flex-col h-full border-l border-gray-200 relative">
                        <div className="flex-1 relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-gray-200 flex items-center justify-center p-12 select-none">
                            {previewUrl ? (
                                <div
                                    ref={containerRef}
                                    className="relative shadow-2xl transition-transform duration-200 ease-out"
                                    style={{
                                        transform: `scale(${editState.scale}) rotate(${editState.rotate}deg)`,
                                        filter: editState.filter,
                                        maxWidth: '100%',
                                        maxHeight: '100%'
                                    }}
                                >
                                    <img
                                        src={previewUrl}
                                        alt="Editor Canvas"
                                        className="max-w-[800px] max-h-[600px] object-contain block pointer-events-none"
                                    />
                                    <div
                                        ref={cropBoxRef}
                                        className="absolute border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] cursor-move"
                                        style={{
                                            left: `${editState.crop.x}%`,
                                            top: `${editState.crop.y}%`,
                                            width: `${editState.crop.width}%`,
                                            height: `${editState.crop.height}%`
                                        }}
                                        onMouseDown={handleCropMouseDown}
                                    >
                                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-50">
                                            <div className="border-r border-b border-white/30"></div><div className="border-r border-b border-white/30"></div><div className="border-b border-white/30"></div>
                                            <div className="border-r border-b border-white/30"></div><div className="border-r border-b border-white/30"></div><div className="border-b border-white/30"></div>
                                            <div className="border-r border-white/30"></div><div className="border-r border-white/30"></div><div></div>
                                        </div>
                                        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-gray-400"></div>
                                        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-gray-400"></div>
                                        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-gray-400"></div>
                                        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-gray-400"></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-gray-400">
                                    <ImageIcon className="w-16 h-16 mb-4 opacity-20 mx-auto" />
                                    <p className="font-bold">Loading Image...</p>
                                </div>
                            )}
                        </div>

                        <div className="h-40 bg-white border-t border-gray-200 flex flex-col p-4 flex-shrink-0 z-30 relative">
                            <h5 className="text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                <Monitor className="w-3 h-3" /> Preview Output
                            </h5>
                            <div className="flex-1 flex gap-4">
                                <div
                                    className="h-full aspect-square bg-gray-100 border border-gray-300 rounded-sm overflow-hidden relative cursor-zoom-in group"
                                    onMouseEnter={() => setIsHoveringPreview(true)}
                                    onMouseLeave={() => setIsHoveringPreview(false)}
                                >
                                    {previewUrl && (
                                        <img
                                            src={previewUrl}
                                            className="w-full h-full object-cover"
                                            style={{
                                                filter: editState.filter,
                                                transform: `rotate(${editState.rotate}deg) scale(1.2)`
                                            }}
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                        <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col justify-center text-xs text-gray-500 space-y-1">
                                    <p><span className="font-bold">{getTranslation('LABEL_ORIGINAL', currentLanguage)}:</span> {previewUrl ? getTranslation('STATUS_LOADED', currentLanguage) : getTranslation('STATUS_PENDING', currentLanguage)}</p>
                                    <p><span className="font-bold text-[var(--primary-color)]">{getTranslation('LABEL_CROPPED', currentLanguage)}:</span> {Math.round(1920 * (editState.crop.width / 100))} x {Math.round(1080 * (editState.crop.height / 100))}</p>
                                    <p><span className="font-bold">{getTranslation('LABEL_FORMAT', currentLanguage)}:</span> JPG (80% Quality)</p>
                                </div>
                            </div>
                            {isHoveringPreview && previewUrl && (
                                <div className="fixed bottom-24 right-8 w-96 h-96 bg-white border-4 border-white shadow-2xl rounded-sm z-[100] overflow-hidden animate-in zoom-in-95 duration-100 pointer-events-none ring-1 ring-gray-300">
                                    <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded-sm z-10 font-bold">{getTranslation('LABEL_HQ_PREVIEW', currentLanguage)}</div>
                                    <img
                                        src={previewUrl}
                                        className="w-full h-full object-cover"
                                        style={{
                                            filter: editState.filter,
                                            transform: `rotate(${editState.rotate}deg) scale(1.5)`
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-between items-center z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <div className="text-xs text-gray-500 flex gap-4">
                        <span>{getTranslation('LABEL_CREATED', currentLanguage)}: {new Date().toLocaleDateString()}</span>
                        <span className="text-[var(--primary-color)] font-bold">{getTranslation('MSG_READY_TO_SAVE', currentLanguage)}</span>
                    </div>
                    <div className="flex gap-3">
                        {!isNew && onDelete && (
                            <button onClick={handleDelete} disabled={isSaving} className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-sm font-bold rounded-sm flex items-center gap-2 mr-auto transition-colors">
                                <Trash2 className="w-4 h-4" /> {getTranslation('BTN_DELETE', currentLanguage)}
                            </button>
                        )}
                        <button onClick={onClose} className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-50 rounded-sm transition-colors">
                            {getTranslation('BTN_CANCEL', useStore.getState().currentLanguage)}
                        </button>
                        <button onClick={handleSave} disabled={!previewUrl || isSaving} className="px-8 py-2.5 bg-[var(--primary-color)] text-white text-sm font-bold shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm flex items-center gap-2"><Save className="w-4 h-4" /> {isSaving ? getTranslation('MSG_SAVING', currentLanguage) : (isNew ? getTranslation('BTN_SAVE_AND_ADD_TO_LIBRARY', currentLanguage) : getTranslation('BTN_SAVE_CHANGES', currentLanguage))}</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- MAIN MANAGER COMPONENT ---
export const ImageManager = ({ onClose }: { onClose: () => void }) => {
    const { imageFolders, images, addImage, updateImage, deleteImage, currentLanguage } = useStore();
    const [selectedFolderId, setSelectedFolderId] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingImage, setEditingImage] = useState<ImageItem | null>(null);

    // Filter images based on folder and search
    const gridImages = useMemo(() => {
        let base = images.length > 0 ? images : [];

        // Filter by Folder
        if (selectedFolderId !== 'all') {
            base = base.filter(img => img.folderId === selectedFolderId);
        }

        // Search
        if (searchQuery) {
            base = base.filter(img => img.name.toLowerCase().includes(searchQuery.toLowerCase()) || (img.title && img.title.toLowerCase().includes(searchQuery.toLowerCase())));
        }

        return base;
    }, [selectedFolderId, searchQuery, images]);

    const customFooter = (
        <div className="flex justify-between w-full items-center">
            <OpenOOTBButton listTitle="Images" isLibrary={true} />
            <button onClick={onClose} className="inline-flex items-center justify-center gap-2 h-9 px-6 border border-gray-300 bg-white text-gray-700 text-sm font-bold hover:bg-gray-100 rounded-sm">
                <span>{getTranslation('BTN_CLOSE', currentLanguage)}</span>
                <EditTrigger labelKey="BTN_CLOSE" />
            </button>
        </div>
    );

    return (
        <GenericModal
            className="image-management-popup"
            title={getTranslation('IMG_MGMT', currentLanguage)}
            onClose={onClose}
            width="w-[85vw] min-w-[1000px] max-w-[1200px]"
            noFooter={true}
            customFooter={customFooter}
            headerIcons={<TooltipMenu ComponentId={'13831'} />}
        >
            <div className="flex h-[70vh] bg-white border border-gray-200">
                {/* Left: Folders */}
                <div className="w-64 border-r border-gray-200 bg-white flex flex-col overflow-y-auto py-2 custom-scrollbar">
                    <h4 className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        {getTranslation('LBL_LIBRARY_FOLDERS', currentLanguage)} <EditTrigger labelKey="LBL_LIBRARY_FOLDERS" size="w-3 h-3" />
                    </h4>
                    {imageFolders.map(folder => (
                        <FolderItem
                            key={folder.id}
                            folder={{ ...folder, count: folder.id === 'all' ? images.length : images.filter(i => i.folderId === folder.id).length }}
                            isActive={selectedFolderId === folder.id}
                            onClick={setSelectedFolderId}
                        />
                    ))}
                </div>

                {/* Right: Gallery */}
                <div className="flex-1 flex flex-col bg-gray-50">
                    {/* Toolbar */}
                    <div className="px-6 py-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-700">{getTranslation('LABEL_GALLERY', currentLanguage)} <span className="text-gray-300 font-light mx-2">|</span> <span className="text-[var(--primary-color)]">{selectedFolderId === 'all' ? getTranslation('LABEL_ALL_IMAGES', currentLanguage) : imageFolders.find(f => f.id === selectedFolderId)?.name}</span></h3>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder={getTranslation('PLACEHOLDER_SEARCH_IMAGES', currentLanguage)}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 border border-gray-300 w-64 text-sm focus:outline-none focus:border-[var(--primary-color)] rounded-sm shadow-inner"
                                />
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            </div>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="inline-flex items-center justify-center gap-2 h-9 px-4 bg-[var(--primary-color)] text-white text-sm font-bold hover:opacity-90 shadow-sm rounded-sm transition-transform active:scale-95"
                            >
                                <Plus className="w-4 h-4 flex-shrink-0" />
                                <span>{getTranslation('BTN_ADD_IMAGE', currentLanguage)}</span>
                            </button>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {gridImages.length > 0 ? (
                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                                {gridImages.map(img => {
                                    let displayUrl = img.url;
                                    if (img.url && !img.url.includes('?t=')) {
                                        // Cache busting for display
                                        displayUrl = `${img.url}?t=${img.modifiedDate ? new Date(img.modifiedDate).getTime() : Date.now()}`;
                                    }

                                    return (
                                        <div key={img.id} className="bg-white border border-gray-200 shadow-sm hover:shadow-xl transition-all group flex flex-col rounded-sm overflow-hidden animate-in fade-in duration-300">
                                            {/* Thumbnail */}
                                            <div className="h-32 bg-gray-100 overflow-hidden relative cursor-pointer border-b border-gray-100" onClick={() => setEditingImage({ ...img, url: displayUrl })}>
                                                {displayUrl ? (
                                                    <img
                                                        key={displayUrl} // Force re-mount on URL change
                                                        src={displayUrl}
                                                        alt={img.name}
                                                        loading="lazy"
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                                                            e.currentTarget.parentElement!.innerHTML = '<span class="text-xs text-gray-400">Image Broken</span>';
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                        <ImageIcon className="w-8 h-8 opacity-20" />
                                                    </div>
                                                )}
                                                {/* Hover Overlay */}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                    <div className="bg-white/90 text-gray-800 px-3 py-1 rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-sm">
                                                        <Pencil className="w-3 h-3" style={{ color: 'var(--icon-color)' }} /> Zum Bearbeiten klicken
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Footer */}
                                            <div className="p-2.5 bg-white flex flex-col gap-1.5">
                                                <h5 className="text-xs font-bold text-gray-700 truncate" title={img.name}>{img.name}</h5>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingImage({ ...img, url: displayUrl }); }}
                                                    className="w-full py-1.5 bg-gray-100 hover:bg-[var(--primary-color)] hover:text-white text-gray-600 text-[10px] font-bold uppercase tracking-wide rounded-sm flex items-center justify-center gap-1.5 transition-colors"
                                                >
                                                    <Pencil className="w-5 h-5" style={{ color: 'var(--icon-color)' }} /> Bild bearbeiten
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <div className="bg-gray-100 p-6 rounded-full mb-4">
                                    <ImageIcon className="w-12 h-12 opacity-20" />
                                </div>
                                <p className="font-medium text-lg">{getTranslation('MSG_NO_IMAGES_FOUND', currentLanguage)}</p>
                                <p className="text-sm opacity-60">{getTranslation('MSG_UPLOAD_IMAGE_TO_START', currentLanguage)}</p>
                                <button onClick={() => setShowAddModal(true)} className="mt-4 text-[var(--primary-color)] font-bold hover:underline">
                                    {getTranslation('BTN_UPLOAD_NEW_IMAGE', currentLanguage)}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Unified Editor Modal via Portal */}
            {showAddModal && (
                <ImageEditor
                    title={getTranslation('TITLE_ADD_NEW_IMAGE', currentLanguage)}
                    initialImage={{ folderId: selectedFolderId !== 'all' ? selectedFolderId : undefined }}
                    isNew={true}
                    onClose={() => setShowAddModal(false)}
                    onSave={(img) => { addImage(img); setShowAddModal(false); }}
                />
            )}

            {editingImage && (
                <ImageEditor
                    title={`${getTranslation('LABEL_EDITING', currentLanguage)}: ${editingImage.name}`}
                    initialImage={editingImage}
                    isNew={false}
                    onClose={() => setEditingImage(null)}
                    onSave={(img) => { updateImage(img); setEditingImage(null); }}
                    onDelete={async (id) => { await deleteImage(id); setEditingImage(null); }}
                />
            )}
        </GenericModal>
    );
};
