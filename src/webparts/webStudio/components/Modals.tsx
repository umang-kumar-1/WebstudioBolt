import * as React from 'react';
import { useStore, getTranslation } from '../store';
import { ModalType } from '../types';
import { canManagePermissions, canAccessWebStudioEditor } from '../utils/templatePermissions';

// Imported Isolated Managers
import { NavigationManager } from './modals/NavigationManager';
import { NewsManager } from './modals/NewsManager';
import { EventManager } from './modals/EventManager';
import { DocumentManager } from './modals/DocumentManager';
import { FooterManager } from './modals/FooterManager';
import { SiteManager } from './modals/SiteManager';
import { ContainerEditorModal } from './modals/ContainerEditor'; // Import Shared Editor
import { SliderManager } from './modals/SliderManager'; // Import Isolated Slider Manager
import { LabelEditorModal } from './modals/LabelEditor';
import { ThemeEditor } from './modals/ThemeEditor';
import { ThemeTemplateManager } from './modals/ThemeTemplateManager';
// import { ImageManager } from './modals/ImageManager';
import { TranslationManager } from './modals/TranslationManager';
import { PermissionManager } from './modals/PermissionManager';
import { ContactQueryManager } from './modals/ContactQueryManager';
import { PageInfoEditor } from './modals/PageInfoEditor';
import { ContainerItemManager } from './modals/ContainerItemManager';
import { ContactManager } from './modals/ContactManager';
import { GenericModal, SharedVersionHistoryModal, EditTrigger, SuccessDialog } from './modals/SharedModals';
import ImageOptimizationConfirmDialog from '../../../components/ImageOptimizationConfirmDialog';

// --- Photogallery Module Integration ---
import ImageManagementParent from '../../imageManagement/components/ImageManagementParent';
import { PhotoGalleryService } from '../../imageManagement/services/PhotoGalleryService';
import { useSPContext } from '../contexts/SPServiceContext';
import TooltipMenu from './common/TooltipMenu';
import { getModalLayerZ, LABEL_EDITOR_Z } from '../utils/modalZIndex';

// --- Modal Manager ---
// --- Modal Manager ---
export const ModalManager: React.FC = () => {
  const { activeModal, modalStack, closeModal, setEditingContainerId, currentLanguage, currentPageId, successModal, hideSuccessModal, webStudioUserRole } = useStore();
  const { context } = useSPContext();

  // Initialize service for photogallery integration
  const photoGalleryService = React.useMemo(() => new PhotoGalleryService(context), [context]);

  const handleClose = () => {
    closeModal();
    // Only clear editingContainerId if we are closing the last modal
    if (modalStack.length === 0) {
      setEditingContainerId(null);
    }
  };

  const renderModalContent = (type: ModalType) => {
    switch (type) {
      case ModalType.NAVIGATION:
        return <NavigationManager onClose={handleClose} />;
      case ModalType.SITE_MGMT:
        return <SiteManager onClose={handleClose} />;
      case ModalType.CONTAINER_EDITOR: // Shared Editor for non-slider
        return <ContainerEditorModal onClose={handleClose} />;
      case ModalType.SLIDER_MANAGER: // Isolated Slider Manager
        return <SliderManager onClose={handleClose} />;
      case ModalType.STYLING:
        if (!canManagePermissions(webStudioUserRole)) return null;
        return <ThemeEditor />;
      case ModalType.THEME_TEMPLATES:
        if (!canAccessWebStudioEditor(webStudioUserRole) || canManagePermissions(webStudioUserRole)) return null;
        return <ThemeTemplateManager onClose={handleClose} />;
      case ModalType.LABEL_EDITOR:
        return <LabelEditorModal />;
      case ModalType.NEWS:
        return <NewsManager onClose={handleClose} />;
      case ModalType.EVENTS:
        return <EventManager onClose={handleClose} />;
      case ModalType.DOCUMENTS:
        return <DocumentManager onClose={handleClose} />;
      case ModalType.FOOTER:
        return <FooterManager onClose={handleClose} />;
      case ModalType.IMAGES:
        return (
          <GenericModal
            title={getTranslation('IMG_MGMT', currentLanguage)}
            onClose={handleClose}
            width="w-[80vw] min-w-[80vw] max-w-[80vw]"
            noFooter={false}
            headerIcons={<TooltipMenu ComponentId={'13831'} />}
            customFooter={
              <div className="flex justify-end w-full">
              <button
                onClick={handleClose}
                className="btn-secondary flex items-center gap-1 shadow-sm transition-colors"
              >
                {getTranslation('BTN_CLOSE', currentLanguage)} <EditTrigger labelKey="BTN_CLOSE" />
              </button>
              </div>
            }
          >
            <div className="h-[82vh] overflow-hidden" style={{ margin: '-14px -21px' }}>
              <ImageManagementParent
                context={context}
                service={photoGalleryService}
                targetLibrary="Images"
              />
            </div>
          </GenericModal>
        );
      case ModalType.TRANSLATION:
        return <TranslationManager onClose={handleClose} />;
      case ModalType.PERMISSIONS:
        if (!canManagePermissions(webStudioUserRole)) return null;
        return <PermissionManager onClose={handleClose} />;
      case ModalType.CONTACT_QUERIES:
        return <ContactQueryManager onClose={handleClose} />;
      case ModalType.CONTACTS:
        return <ContactManager onClose={handleClose} />;
      case ModalType.PAGE_INFO:
        return <PageInfoEditor onClose={handleClose} />;
      case ModalType.VERSION_HISTORY:
        return (
          <SharedVersionHistoryModal
            onClose={handleClose}
            listTitle="SmartPages"
            itemId={currentPageId}
            onVersionRestore={() => void useStore.getState().loadFromSharePoint()}
          />
        );
      case ModalType.CONTAINER_ITEMS:
        return <ContainerItemManager onClose={handleClose} />;
      default:
        return type !== ModalType.NONE ? (
          <GenericModal title={getTranslation('MSG_COMING_SOON', currentLanguage)} onClose={handleClose}>
            <div className="text-gray-500 italic p-8 text-center">
              {getTranslation('MSG_MODULE_UNDER_DEV', currentLanguage).replace('{modal}', type)}
            </div>
          </GenericModal>
        ) : null;
    }
  };

  const allModals = [...modalStack];
  if (activeModal !== ModalType.NONE) {
    allModals.push(activeModal);
  }

  return (
    <>
      {allModals.map((modalType, index) => {
        const isLast = index === allModals.length - 1;
        const isLabelEditorOnTop = allModals[allModals.length - 1] === ModalType.LABEL_EDITOR;
        const keepSiteManagerVisible = isLabelEditorOnTop && modalType === ModalType.SITE_MGMT;
        const hideForLabelEditor = isLabelEditorOnTop && !isLast && !keepSiteManagerVisible;
        // Base 1300 — above editor sidebar (10) and mobile drawer (1200); label editor portals higher
        const zIndex = modalType === ModalType.LABEL_EDITOR ? LABEL_EDITOR_Z : getModalLayerZ(index);

        // Modals that portal to document.body and manage their own backdrop
        if (modalType === ModalType.PAGE_INFO || modalType === ModalType.VERSION_HISTORY || modalType === ModalType.LABEL_EDITOR) {
          return (
            <div key={`${modalType}-${index}`} style={{ zIndex }}>
              {renderModalContent(modalType)}
            </div>
          );
        }

        return (
          <div
            key={`${modalType}-${index}`}
            className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 transition-all"
            style={{
              zIndex,
              backgroundColor: index === 0 ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
              backdropFilter: 'none'
            }}
          >
            {/* Darken background for sub-modals */}
            {!isLast && !hideForLabelEditor && (
              <div className="absolute inset-0 bg-black/30" />
            )}
            {!isLast && hideForLabelEditor && (
              <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }} />
            )}

            {isLast && (
              <div className="absolute inset-0" onClick={handleClose} />
            )}

            <div
              className={`relative z-10 w-full flex justify-center transition-all duration-300 ${hideForLabelEditor ? 'opacity-0 pointer-events-none' : (!isLast && !keepSiteManagerVisible ? 'opacity-30 pointer-events-none' : 'opacity-100 pointer-events-auto')}`}
            >
              {renderModalContent(modalType)}
            </div>
          </div>
        );
      })}

      {/* Global Success Dialog */}
      {successModal?.show && activeModal !== ModalType.NONE && successModal.sourceModal === activeModal && (
        <SuccessDialog
          title={successModal.title}
          message={successModal.message}
          onClose={hideSuccessModal}
        />
      )}

      <ImageOptimizationConfirmDialog />
    </>
  );
};
