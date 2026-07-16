import * as React from "react";
import { useCallback, useState, useEffect } from "react";
import { Image } from "./../types";
import { useStore, getTranslation } from "./../../../webStudio/store";
import { ChevronLeft, Clipboard, ClipboardCheck, Download, FolderOpen, Link2, UploadCloud, Images as ImagesIcon } from "lucide-react";
import { useImageOptimizer } from "../../../../hooks/useImageOptimizer";
import ImageOptimizationFeedback from "../../../../components/ImageOptimizationFeedback";
import { prepareImageFile, ImageUploadCancelledError } from "../../../../utils/imageUploadPipeline";
import { SPImage } from '../../../../components/SPImage';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  images: Image[];
}

type UploadMethod =
  | "selection"
  | "upload"
  | "url"
  | "paste"
  | "gallery";

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

function mimeFromFilename(name: string): string | null {
  const ext = name.split("?")[0].split(".").pop()?.toLowerCase();
  return ext ? IMAGE_MIME_BY_EXT[ext] ?? null : null;
}

function resolveImageMimeType(
  blobType: string,
  contentType: string | null,
  filename: string,
  url: string
): string | null {
  if (blobType.startsWith("image/")) {
    return blobType;
  }

  const headerMime = contentType?.split(";")[0]?.trim();
  if (headerMime?.startsWith("image/")) {
    return headerMime;
  }

  return (
    mimeFromFilename(filename) ??
    mimeFromFilename(url.split("?")[0].split("/").pop() || "")
  );
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUpload,
  images,
}) => {
  const [uploadMethod, setUploadMethod] = useState<UploadMethod>("selection");
  const [isDragging, setIsDragging] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { currentLanguage } = useStore();
  const {
    isOptimizing,
    stats,
    error: optimizeError,
    clearStats,
    prepareFile,
    prepareBlob,
  } = useImageOptimizer();

  const resetState = useCallback(() => {
    setError(null);
    setIsLoading(false);
    setImageUrl("");
    setIsDragging(false);
    clearStats();
  }, [clearStats]);

  const handleMethodSelect = (method: UploadMethod) => {
    resetState();
    setUploadMethod(method);
  };

  const deliverOptimizedFile = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const prepared = await prepareFile(file);
        onImageUpload(prepared.file);
      } catch (err) {
        if (err instanceof ImageUploadCancelledError) return;
        const message =
          err instanceof Error ? err.message : "Image optimization failed.";
        setError(message);
      }
    },
    [onImageUpload, prepareFile]
  );

  const fetchImageAsFile = useCallback(
    async (url: string, filename: string): Promise<File | null> => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch image. Server responded with ${response.status}. Please check the URL and ensure it allows cross-origin requests.`
          );
        }
        const blob = await response.blob();
        const mimeType = resolveImageMimeType(
          blob.type,
          response.headers.get("content-type"),
          filename,
          url
        );
        if (!mimeType) {
          throw new Error(
            "The fetched file is not an image. Please provide a URL to a valid image file."
          );
        }
        return new File([blob], filename, { type: mimeType });
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "An unknown error occurred while fetching the image.";
        setError(errorMessage);
        console.error("Error fetching image:", err);
        return null;
      }
    },
    []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      deliverOptimizedFile(e.target.files[0]).catch(console.error);
      e.target.value = "";
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        deliverOptimizedFile(e.dataTransfer.files[0]).catch(console.error);
      }
    },
    [deliverOptimizedFile]
  );

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) {
      setError("Please enter an image URL.");
      return;
    }
    setError(null);
    setIsLoading(true);
    const file = await fetchImageAsFile(imageUrl, "image-from-url.png");
    if (file) {
      try {
        const prepared = await prepareImageFile(file);
        onImageUpload(prepared.file);
      } catch (err) {
        if (err instanceof ImageUploadCancelledError) return;
        const message =
          err instanceof Error ? err.message : "Image optimization failed.";
        setError(message);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (uploadMethod === "paste") {
      const handlePaste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              prepareBlob(file, "pasted-image.png")
                .then((prepared) => onImageUpload(prepared.file))
                .catch((err) => {
                  if (err instanceof ImageUploadCancelledError) return;
                  console.error(err);
                });
              break;
            }
          }
        }
      };

      window.addEventListener("paste", handlePaste);

      return () => {
        window.removeEventListener("paste", handlePaste);
      };
    }
  }, [uploadMethod, onImageUpload, prepareBlob]);

  const handleSelectFromGallery = async (image: Image) => {
    if (isLoading || isOptimizing) return;
    setError(null);
    setIsLoading(true);
    const file = await fetchImageAsFile(image.src, image.name);
    if (file) {
      try {
        const prepared = await prepareImageFile(file);
        onImageUpload(prepared.file);
      } catch (err) {
        if (err instanceof ImageUploadCancelledError) return;
        const message =
          err instanceof Error ? err.message : "Image optimization failed.";
        setError(message);
      }
    }
    setIsLoading(false);
  };

  const SelectionCard = ({
    children,
    title,
    description,
    onClick,
  }: {
    children: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
  }) => (
    <div className="w-full">
      <div
        className="h-full text-center shadow-sm border border-gray-200 bg-white hover:border-[var(--primary-color)] transition-colors rounded-sm"
        onClick={onClick}
        style={{ cursor: "pointer" }}
      >
        <div className="flex flex-col justify-center items-center px-2 py-3 min-h-[120px]">
          <h6 className="mt-2 mb-0.5 text-[12px] leading-tight font-semibold text-[#1f3f76]">{title}</h6>
          <p className="text-[11px] leading-tight text-gray-500">{description}</p>
        </div>
      </div>
    </div>
  );

  const renderSelectionScreen = () => (
    <div className="text-center">
      <h5 className="mb-3 text-[28px] leading-none font-semibold text-[#1f3f76]">{getTranslation('MSG_CHOOSE_ADD_METHOD', currentLanguage)}</h5>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <SelectionCard
          title={getTranslation('LABEL_UPLOAD', currentLanguage)}
          description={getTranslation('DESC_UPLOAD_DEVICE', currentLanguage)}
          onClick={() => handleMethodSelect("upload")}
        >
          <UploadCloud className="w-7 h-7 text-[var(--primary-color)]" />
        </SelectionCard>
        <SelectionCard
          title={getTranslation('LABEL_FROM_URL', currentLanguage)}
          description={getTranslation('DESC_IMPORT_LINK', currentLanguage)}
          onClick={() => handleMethodSelect("url")}
        >
          <Link2 className="w-7 h-7 text-[var(--primary-color)]" />
        </SelectionCard>
        <SelectionCard
          title={getTranslation('LABEL_PASTE', currentLanguage)}
          description={getTranslation('DESC_FROM_CLIPBOARD', currentLanguage)}
          onClick={() => handleMethodSelect("paste")}
        >
          <Clipboard className="w-7 h-7 text-[var(--primary-color)]" />
        </SelectionCard>
        <SelectionCard
          title={getTranslation('LABEL_FROM_GALLERY', currentLanguage)}
          description={getTranslation('DESC_USE_EXISTING_IMG', currentLanguage)}
          onClick={() => handleMethodSelect("gallery")}
        >
          <ImagesIcon className="w-7 h-7 text-[var(--primary-color)]" />
        </SelectionCard>
      </div>
    </div>
  );

  const BackButton = () => (
    <div className="mb-2">
      <button
        className="inline-flex items-center gap-2 text-[var(--primary-color,#1d4ed8)] text-sm font-semibold hover:underline"
        onClick={() => handleMethodSelect("selection")}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span>{getTranslation('BTN_BACK_OPTIONS', currentLanguage)}</span>
      </button>
    </div>
  );

  const displayError = error || optimizeError;

  return (
    <div style={{ minHeight: "300px" }}>
      {displayError && (
        <div className="mb-3 px-3 py-2 rounded border border-red-200 bg-red-50 text-red-700 text-sm" role="alert">
          {displayError}
        </div>
      )}

      {uploadMethod === "selection" && renderSelectionScreen()}

      {uploadMethod === "upload" && (
        <div>
          <BackButton />
          <div
            className={`text-center p-5 border-2 rounded ${isDragging
              ? "border-[var(--primary-color)] bg-[var(--primary-color)]/10"
              : "border-gray-400"
              }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{ borderStyle: "dashed" }}
          >
            <UploadCloud className="w-16 h-16 mx-auto text-gray-500" />
            <h4 className="mt-3 text-4xl font-medium text-[#1f3f76]">{getTranslation('TITLE_UPLOAD_IMAGE', currentLanguage)}</h4>
            <p className="text-gray-500">
              {getTranslation('MSG_DRAG_DROP_FILE', currentLanguage)}
            </p>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept="image/png, image/jpeg, image/webp, image/gif"
              onChange={handleFileChange}
              disabled={isOptimizing}
            />
            <label htmlFor="file-upload" className={`inline-flex items-center gap-2 mt-3 px-4 py-2 bg-[var(--btn-primary-bg)] text-white text-sm font-semibold ${isOptimizing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}>
              <FolderOpen className="w-4 h-4 text-white" />{getTranslation('BTN_CHOOSE_FILE', currentLanguage)}
            </label>
            <div className="mt-3 flex justify-center">
              <ImageOptimizationFeedback stats={stats} isProcessing={isOptimizing} />
            </div>
          </div>
        </div>
      )}

      {uploadMethod === "url" && (
        <div>
          <BackButton />
          <div className="flex flex-col justify-center items-center h-full p-4">
            <h4 className="mb-3 text-xl font-semibold text-[#1f3f76]">{getTranslation('TITLE_LOAD_FROM_URL', currentLanguage)}</h4>
            <form
              onSubmit={(e) => { handleUrlSubmit(e).catch(console.error); }}
              className="w-full"
              style={{ maxWidth: "600px" }}
            >
              <div className="flex items-stretch gap-2">
                <input
                  type="url"
                  className="flex-1 h-11 border border-gray-300 rounded-sm px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                  placeholder="https://example.com/image.png"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={isLoading || isOptimizing}
                  required
                />
                <button
                  className="h-11 px-4 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] text-sm font-semibold hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-2"
                  type="submit"
                  disabled={isLoading || isOptimizing}
                >
                  {isLoading || isOptimizing ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />{getTranslation('BTN_LOAD', currentLanguage)}
                    </>
                  )}
                </button>
              </div>
            </form>
            <div className="mt-3">
              <ImageOptimizationFeedback stats={stats} isProcessing={isOptimizing} />
            </div>
          </div>
        </div>
      )}

      {uploadMethod === "paste" && (
        <div>
          <BackButton />
          <div
            className="text-center p-5 border-2 border-dashed rounded border-gray-400 flex flex-col justify-center items-center"
            style={{ height: "250px" }}
          >
            <ClipboardCheck className="w-16 h-16 text-gray-500" />
            <h4 className="mt-3 text-4xl font-medium text-[#1f3f76]">{getTranslation('TITLE_PASTE_IMAGE', currentLanguage)}</h4>
            <p className="text-gray-500 text-lg">
              {getTranslation('MSG_PASTE_DIRECTIONS', currentLanguage)}
            </p>
            <div className="mt-3">
              <ImageOptimizationFeedback stats={stats} isProcessing={isOptimizing} />
            </div>
          </div>
        </div>
      )}

      {uploadMethod === "gallery" && (
        <div>
          <BackButton />
          <div className="flex flex-col justify-center h-full">
            <h4 className="mb-3 text-center text-xl font-semibold text-[#1f3f76]">{getTranslation('TITLE_SELECT_GALLERY', currentLanguage)}</h4>
            {(isLoading || isOptimizing) && (
              <div className="text-center">
                <div className="inline-flex items-center justify-center" role="status" aria-live="polite">
                  <span className="inline-block w-7 h-7 border-[3px] border-[var(--primary-color)]/35 border-t-[var(--primary-color)] rounded-full animate-spin" />
                </div>
                <ImageOptimizationFeedback stats={stats} isProcessing={isOptimizing} className="mt-2 justify-center" />
              </div>
            )}
            {!isLoading && !isOptimizing && (
              <div
                className="grid grid-cols-3 md:grid-cols-4 gap-2"
                style={{ maxHeight: "260px", overflowY: "auto" }}
              >
                {images.length > 0 ? (
                  images.map((image) => (
                    <div key={image.id}>
                      <SPImage
                        src={image.src}
                        alt={image.title}
                        className="w-full rounded"
                        style={{
                          cursor: "pointer",
                          objectFit: "cover",
                          width: "100%",
                          height: "100px",
                        }}
                        onClick={() => { handleSelectFromGallery(image).catch(console.error); }}
                        role="button"
                        aria-label={`${getTranslation('LABEL_SELECT_IMAGE', currentLanguage)}: ${image.title}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { handleSelectFromGallery(image).catch(console.error); }
                        }}
                      />
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center text-gray-500">
                    <p>{getTranslation('MSG_GALLERY_EMPTY', currentLanguage)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
