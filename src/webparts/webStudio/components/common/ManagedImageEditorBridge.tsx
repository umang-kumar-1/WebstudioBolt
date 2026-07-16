import * as React from 'react';
import { useMemo } from 'react';
import ImageEditorModal from '../../../imageManagement/components/components/ImageEditorModal';
import { useStore } from '../../store';
import {
    buildManagedImageToEdit,
    createManagedImageSaveHandler,
    toManagedFolders,
    toManagedImages,
} from '../../utils/managedImageEditor';

export interface ManagedImageEditorBridgeProps {
    imageUrl: string;
    imageName?: string;
    isOpen: boolean;
    onClose: () => void;
    onSaved: (url: string, name: string) => void;
}

/** Opens ImageEditorModal for a URL (gallery item or external/pasted image). */
const ManagedImageEditorBridge: React.FC<ManagedImageEditorBridgeProps> = ({
    imageUrl,
    imageName,
    isOpen,
    onClose,
    onSaved,
}) => {
    const { images, imageFolders, updateImage, uploadImage } = useStore();

    const managedFolders = useMemo(() => toManagedFolders(imageFolders), [imageFolders]);
    const managedImages = useMemo(() => toManagedImages(images), [images]);
    const managedImageToEdit = useMemo(
        () => (isOpen && imageUrl ? buildManagedImageToEdit(imageUrl, images, imageName) : undefined),
        [isOpen, imageUrl, images, imageName]
    );

    const handleSave = useMemo(
        () => createManagedImageSaveHandler(updateImage, uploadImage, imageUrl, onSaved),
        [updateImage, uploadImage, imageUrl, onSaved]
    );

    if (!isOpen || !managedImageToEdit) {
        return null;
    }

    return (
        <ImageEditorModal
            imagesLength={managedImages.length}
            isOpen={isOpen}
            onClose={onClose}
            onSave={async (managed) => {
                await handleSave(managed);
                onClose();
            }}
            imageToEdit={managedImageToEdit}
            folders={managedFolders}
            images={managedImages}
            selectedFolderId={Number(managedImageToEdit.folderId) || undefined}
        />
    );
};

export default ManagedImageEditorBridge;
