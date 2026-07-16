import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import PhotoGallery from "./components/PhotoGallery";
import ImageEditorModal from "./components/ImageEditorModal";
import FolderList from "./components/FolderList";
import { Image, Folder, ROOT_FOLDER_ID } from "../components/types";
import { PhotoGalleryService } from "../services/PhotoGalleryService";
import { toBlobFile, ImageUploadCancelledError } from "../../../utils/imageUploadPipeline";
import { useStore, getTranslation } from "../../webStudio/store";
import "./Custom.css";

export interface IImageManagementParentProps {
  context: any;
  service: PhotoGalleryService;
  targetLibrary: string;
}

const App: React.FC<IImageManagementParentProps> = ({ context, service, targetLibrary }) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<Image | undefined>(undefined);
  const [selectedFolderId, setSelectedFolderId] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { currentLanguage } = useStore();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!service || !targetLibrary) return;

      const fetchedFolders = await service.getFolders(targetLibrary);
      setFolders(fetchedFolders);

      const fetchedImages = await service.getImages(targetLibrary, fetchedFolders);
      setImages(fetchedImages);

    } catch (error) {
      console.error("Data fetching error:", error);
      setError("Failed to load images. Please check the library configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [targetLibrary]); // dependencies: re-fetch if library changes

  const handleOpenAddModal = () => {
    setEditingImage(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (image: Image) => {
    setEditingImage(image);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingImage(undefined);
  };

  const handleSaveImage = async (
    savedImage: Omit<Image, "id"> & { id?: number; UniqueId?: string }
  ) => {
    try {
      const folder =
        savedImage.folderId === ROOT_FOLDER_ID
          ? undefined
          : folders.find((f) => f.id === savedImage.folderId);
      const folderUrl = folder?.serverRelativeUrl || folder?.name || "";

      if (!savedImage.src.startsWith("data:image")) {
        // It might be an existing URL if we just edited metadata?
        // If src is url, we are updating metadata only, unless we have new blob.
        // Service can handle update.
        if (savedImage.id) {
          await service.updateImage(targetLibrary, savedImage.id, {
            title: savedImage.title,
            description: savedImage.description,
            altText: savedImage.altText,
            copyright: savedImage.copyright,
            keywords: savedImage.keywords,
            imageCompression: savedImage.imageCompression,
            originalFileSize: savedImage.originalFileSizeBytes,
          });
          await fetchData();
          handleCloseModal();
          return;
        }
      }

      // Convert base64 to Blob
      if (savedImage.src.startsWith("data:image")) {
        const base64Response = await fetch(savedImage.src);
        const blob = await base64Response.blob();
        const sourceFile = toBlobFile(blob, savedImage.name);

        if (savedImage.id) {
          await service.updateImage(targetLibrary, savedImage.id, {
            title: savedImage.title,
            description: savedImage.description,
            altText: savedImage.altText,
            copyright: savedImage.copyright,
            keywords: savedImage.keywords,
            imageCompression: savedImage.imageCompression,
            originalFileSize: savedImage.originalFileSizeBytes ?? sourceFile.size,
          }, blob);
        } else {
          await service.uploadImage(
            targetLibrary,
            blob,
            sourceFile.name,
            folderUrl,
            {
              title: savedImage.title,
              description: savedImage.description,
              altText: savedImage.altText,
              copyright: savedImage.copyright,
              keywords: savedImage.keywords,
              imageCompression: savedImage.imageCompression,
              originalFileSize: savedImage.originalFileSizeBytes ?? sourceFile.size,
            }
          );
        }
      }

      await fetchData();
      handleCloseModal();
    } catch (error) {
      if (error instanceof ImageUploadCancelledError) return;
      console.error("Error saving image:", error);
      alert("Error saving image. Please ensure you have permissions.");
    }
  };

  const handleDeleteImage = async (image: Image) => {
    try {
      if (image.id) {
        await service.deleteImage(targetLibrary, image.id);
        await fetchData();
        handleCloseModal();
      }
    } catch (error) {
      console.error("Error deleting image:", error);
      alert("Error deleting image. Please ensure you have permissions.");
    }
  };

  const handleSelectFolder = (folderId: number) => {
    setSelectedFolderId(Number(folderId));
  };

  const foldersWithCounts = useMemo(() => {
    const counts = images.reduce((acc, image) => {
      acc[image.folderId] = (acc[image.folderId] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return folders.map((folder) => ({
      ...folder,
      imageCount: counts[folder.id] || 0,
    }));
  }, [folders, images]);

  const filteredImages = useMemo(() => {
    if (selectedFolderId === 0) {
      return images;
    }
    return images.filter((img) => Number(img.folderId) === Number(selectedFolderId));
  }, [images, selectedFolderId]);

  const selectedFolderName = useMemo(() => {
    if (selectedFolderId === 0) return getTranslation('LABEL_ALL_IMAGES', currentLanguage);
    return folders.find((f) => Number(f.id) === Number(selectedFolderId))?.name || "";
  }, [folders, selectedFolderId, currentLanguage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-[var(--primary-color)]/30 border-t-[var(--primary-color)] rounded-full animate-spin" role="status" />
      </div>
    );
  }

  if (error) {
    return <div className="px-4 py-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>;
  }

  return (
    <>
      <div className="photogallery-container" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <main
          className="w-full mt-4 px-4"
          style={{ flex: "1 1 auto", overflowY: "hidden" }}
        >
          <div className="h-full im-layout">
            <aside className="h-full im-layout-sidebar">
              <FolderList
                folders={foldersWithCounts}
                totalImageCount={images.length}
                selectedFolderId={selectedFolderId}
                onSelectFolder={handleSelectFolder}
              />
            </aside>
            <section className="border-0 h-full im-layout-content overflow-y-auto scrollbar">
              <PhotoGallery
                images={filteredImages}
                galleryTitle={selectedFolderName}
                onAddImage={handleOpenAddModal}
                onEditImage={handleOpenEditModal}
              />
            </section>
          </div>
        </main>
      </div>
      {isModalOpen && (
        <ImageEditorModal
          imagesLength={images.length}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveImage}
          onDelete={handleDeleteImage}
          imageToEdit={editingImage}
          folders={folders}
          images={images}
          selectedFolderId={selectedFolderId}
        />
      )}
    </>
  );
};

export default App;