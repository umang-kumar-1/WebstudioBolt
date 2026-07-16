import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import '../webparts/webStudio/webStudioStyles';
import ImageManagementParent from '../webparts/imageManagement/components/ImageManagementParent';
import { PhotoGalleryService } from '../webparts/imageManagement/services/PhotoGalleryService';

const ImagesPage = () => {
  const service = useMemo(() => new PhotoGalleryService(), []);
  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-50 p-4">
      <ImageManagementParent context={null} service={service} targetLibrary="Images" />
    </div>
  );
};

export const Route = createFileRoute('/images')({
  head: () => ({ meta: [{ title: 'Image Management' }] }),
  ssr: false,
  component: ImagesPage,
});
