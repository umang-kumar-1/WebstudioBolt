
import { create } from 'zustand';
import { ModalType, ViewMode, Page, SiteConfig, ThemeConfig, LanguageCode, MultilingualText, NavItem, NewsItem, EventItem, DocumentItem, Container, ContainerType, ContainerItem, ContactItem, ImageItem, ImageFolder, TranslationItem, PermissionGroup, PermissionUser, ContactQuery, SliderItem, SectionTemplate, ThemeTemplate, WebStudioUserRole } from './types';
import { canManageTemplates, normalizeHeroTemplateSettings, normalizeCardGridTemplateSettings, hydrateTemplateContentForContainer, canAccessWebStudioEditor } from './utils/templatePermissions';
import { applySiteLayoutWidthToTheme, normalizeSiteLayoutConfig } from './utils/pageWidth';
import { applyStylingSiteConfig, orderThemeTemplatesWithDefaultFirst } from './utils/themeTemplateHelpers';
import { resolveDefaultImageUrl } from './utils/defaultImageUrl';
import { resolveDocumentType } from './utils/documentType';
import { getEnabledSiteLanguages, isLanguageEnabled, normalizeSiteLanguages } from './utils/siteLanguages';
import { compareContainersByOrder, getNextContainerOrder } from './utils/containerContentHelpers';
import {
  getPreviewSectionAnchorFromHash,
  parsePreviewHashRoute,
  slugToPreviewHash,
} from './utils/previewNavigation';
import {
  collectAffectedItemIds,
  parseContainerLookupIds,
  reconcileContainerTagging,
  persistItemContainerLookups,
  syncLookupsForItemIds,
  TaggableListName,
  getContainerIdsForItem,
  parsePersistedTaggedItems,
  applyContainerIdsToContentItems,
  toTaggableContentItem,
  resolveListNameForItemId,
  resolveContainerSourceList,
} from './utils/containerLookupSync';
import {
  applyContainerLookupSelection,
  applyPageLookupRemoval,
} from './utils/itemTaggingLookupEditor';
import {
  parsePageLookupIds,
  enrichTaggableItemWithPageLookup,
  reconcilePageTagging,
  applyPageIdsToContentItems,
  persistItemPageLookups,
  getPageIdsForItem,
} from './utils/pageLookupSync';
import { ensureContainerDisplaySortSettings } from './utils/dataGridContentSort';

export { getEnabledSiteLanguages, normalizeSiteLanguages, shouldShowLanguageSelector } from './utils/siteLanguages';

/** Per-browser UI language so refresh does not reset to site default. APP_STATE is shared site-wide, so restore is not read from SharePoint. */
const UI_LANGUAGE_STORAGE_KEY = 'webstudio.editor.uiLanguage';

function readStoredUiLanguage(): LanguageCode | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
    if (v === 'en' || v === 'de' || v === 'fr' || v === 'es') return v;
  } catch {
    /* ignore quota / private mode */
  }
  return null;
}

function getInitialCurrentLanguage(): LanguageCode {
  return readStoredUiLanguage() ?? 'de';
}

function persistUiLanguage(lang: LanguageCode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

/**
 * Container template selector feature flags.
 * Set `enableTableAndMapView` to `false` to hide Table View and Map tabs when adding containers.
 */
export const CONTAINER_TEMPLATE_FEATURES = {
  enableTableAndMapView: true,
} as const;

// Initial State for UI Labels (populated from SharePoint)
export const INITIAL_UI_LABELS: Record<string, MultilingualText> = {
  TITLE_EDIT_DOC: { en: 'Edit Document', de: 'Dokument bearbeiten', fr: 'Modifier le document', es: 'Editar documento' },
  TITLE_EVENT_MGMT: { en: 'Event Management', de: 'Veranstaltungsverwaltung', fr: 'Gestion des événements', es: 'Gestión de eventos' },
  DESC_EVENT_MGMT: { en: 'Manage corporate events, webinars, and meetings.', de: 'Verwalten Sie Firmenveranstaltungen, Webinare und Meetings.', fr: 'Gérez les événements d\'entreprise, les webinaires et les réunions.', es: 'Gestione eventos corporativos, seminarios web y reuniones.' },
  BTN_ADD_DOCUMENT: { en: 'Add Document', de: 'Dokument hinzufügen', fr: 'Ajouter un document', es: 'Agregar documento' },
  APP_TITLE: { en: 'Web Studio', de: 'Web Studio', fr: 'Web Studio', es: 'Web Studio' },
  APP_SUBTITLE: { en: 'Enterprise CMS', de: 'Unternehmens-CMS', fr: 'CMS d\'entreprise', es: 'CMS empresarial' },
  SITE_GLOBALS: { en: 'Site Globals', de: 'Globale Einstellungen', fr: 'Paramètres globaux', es: 'Configuración global' },
  PAGES: { en: 'Pages', de: 'Seiten', fr: 'Pages', es: 'Páginas' },
  SECTION_PAGE_INFO: { en: 'Page Info', de: 'Seiteninfo', fr: 'Info page', es: 'Info página' },
  LABEL_SECTIONS: { en: 'Sections', de: 'Abschnitte', fr: 'Sections', es: 'Secciones' },
  BTN_ADD_SLIDE: { en: 'Add Slide', de: 'Folie hinzufügen', fr: 'Ajouter une diapositive', es: 'Agregar diapositiva' },
  BTN_DELETE_SLIDE: { en: 'Delete Slide', de: 'Folie löschen', fr: 'Supprimer la diapositive', es: 'Eliminar diapositiva' },
  MSG_CONFIRM_DELETE_SLIDE: { en: 'Are you sure you want to delete this slide?', de: 'Sind Sie sicher, dass Sie diese Folie löschen möchten?', fr: 'Êtes-vous sûr de vouloir supprimer cette diapositive ?', es: '¿Está seguro de que desea eliminar esta diapositiva?' },
  MSG_CONFIRM_DELETE_SLIDE_LIST: { en: 'Are you sure you want to delete this slide from the list? This cannot be undone.', de: 'Sind Sie sicher, dass Sie diese Folie aus der Liste löschen möchten? Dies kann nicht rückgängig gemacht werden.', fr: 'Êtes-vous sûr de vouloir supprimer cette diapositive de la liste ? Cela ne peut pas être annulé.', es: '¿Está seguro de que desea eliminar esta diapositiva de la lista? Esto no se puede deshacer.' },
  TITLE_EDIT_SLIDE: { en: 'Edit Slide', de: 'Folie bearbeiten', fr: 'Modifier la diapositive', es: 'Editar diapositiva' },
  LABEL_EDITING_SLIDE: { en: 'Slide', de: 'Folie', fr: 'Diapositive', es: 'Diapositiva' },
  LABEL_OF: { en: 'of', de: 'von', fr: 'sur', es: 'de' },
  LABEL_UNTITLED_SLIDE: { en: 'Untitled Slide', de: 'Unbenannte Folie', fr: 'Diapositive sans titre', es: 'Diapositiva sin título' },
  SECTION_LAYOUT: { en: 'Layout Selection', de: 'Layout-Auswahl', fr: 'Sélection de mise en page', es: 'Selección de diseño' },
  SECTION_LIVE_PREVIEW: { en: 'Live Preview', de: 'Live-Vorschau', fr: 'Aperçu en direct', es: 'Vista previa en vivo' },
  SECTION_IMAGE_EDITOR: { en: 'Image Editor', de: 'Bild-Editor', fr: 'Éditeur d\'image', es: 'Editor de imágenes' },
  SECTION_IMAGE_ADJUSTMENTS: { en: 'Image Adjustments', de: 'Bildanpassungen', fr: 'Ajustements d\'image', es: 'Ajustes de imagen' },
  SECTION_SLIDE_IDENTITY: { en: 'Slide Identity', de: 'Foliendidentität', fr: 'Identité de la diapositive', es: 'Identidad de la diapositiva' },
  SECTION_CONTENT: { en: 'Content & Details', de: 'Inhalt & Details', fr: 'Contenu & Détails', es: 'Contenido y detalles' },
  LAYOUT_TEXT_OVERLAY: { en: 'Text Overlay', de: 'Textüberlagerung', fr: 'Superposition de texte', es: 'Superposición de texto' },
  LAYOUT_SOLID_COLOR: { en: 'Solid Color', de: 'Vollfarbe', fr: 'Couleur unie', es: 'Color sólido' },
  LAYOUT_SPLIT_LEFT: { en: 'Split Left', de: 'Links teilen', fr: 'Gauche divisée', es: 'División izquierda' },
  LAYOUT_SPLIT_RIGHT: { en: 'Split Right', de: 'Rechts teilen', fr: 'Droite divisée', es: 'División derecha' },
  LABEL_SLIDE_NAME: { en: 'Slide Name', de: 'Folienname', fr: 'Nom de la diapositive', es: 'Nombre de la diapositiva' },
  LABEL_HEADER_TITLE: { en: 'Header Title', de: 'Überschrift', fr: 'Titre de l\'en-tête', es: 'Título del encabezado' },
  LABEL_CONTENT_TEXT: { en: 'Content Text', de: 'Inhaltstext', fr: 'Texte du contenu', es: 'Texto del contenido' },
  LABEL_URL_OPTIONAL: { en: 'URL / Link (Optional)', de: 'URL / Link (Optional)', fr: 'URL / Lien (Optionnel)', es: 'URL / Enlace (Opcional)' },
  LABEL_ZOOM: { en: 'Zoom', de: 'Zoom', fr: 'Zoom', es: 'Zoom' },
  LABEL_ROTATE: { en: 'Rotate', de: 'Drehen', fr: 'Rotation', es: 'Girar' },
  LABEL_BRIGHTNESS: { en: 'Brightness', de: 'Helligkeit', fr: 'Luminosité', es: 'Brillo' },
  LABEL_CONTRAST: { en: 'Contrast', de: 'Kontrast', fr: 'Contraste', es: 'Contraste' },
  BTN_SAVE_CHANGES: { en: 'Save Changes', de: 'Änderungen speichern', fr: 'Enregistrer les modifications', es: 'Guardar cambios' },
  SLIDER_MGMT: { en: 'Slider Management', de: 'Slider-Verwaltung', fr: 'Gestion du curseur', es: 'Gestión de controles deslizantes' },
  TAB_SLIDES: { en: 'Slides', de: 'Folien', fr: 'Diapositives', es: 'Diapositivas' },
  TAB_SETTINGS: { en: 'Carousel Settings', de: 'Website-Einstellungen', fr: 'Paramètres du carrousel', es: 'Configuración del carrusel' },
  TAB_MANAGE_CONTENT: { en: 'Manage Content', de: 'Inhalt verwalten', fr: 'Gérer le contenu', es: 'Administrar contenido' },
  LABEL_SLIDE_QUEUE: { en: 'Global Item List (Slide Queue)', de: 'Globale Elementliste', fr: 'Liste d\'éléments globale', es: 'Lista de elementos globales' },
  MSG_NO_SLIDES: { en: 'No slides added to this container yet.', de: 'Noch keine Folien zu diesem Container hinzugefügt.', fr: 'Aucune diapositive n\'a encore été ajoutée à ce conteneur.', es: 'Aún no se han agregado diapositivas a este contenedor.' },
  BTN_SYNC: { en: 'Sync with SharePoint', de: 'Mit SharePoint synchronisieren', fr: 'Synchroniser avec SharePoint', es: 'Sincronizar con SharePoint' },
  TAB_BASIC: { en: 'Basic', de: 'Basis', fr: 'Basique', es: 'Básico' },
  TAB_BASIC_INFO: { en: 'Basic Information', de: 'Basisinformationen', fr: 'Informations de base', es: 'Información básica' },
  TAB_IMAGE_INFO: { en: 'Image Information', de: 'Bildinformationen', fr: 'Informations sur l\'image', es: 'Información de imagen' },
  TAB_TRANSLATION: { en: 'Translation', de: 'Übersetzung', fr: 'Traduction', es: 'Traducción' },
  TAB_TRANSLATIONS: { en: 'Translations', de: 'Übersetzungen', fr: 'Traductions', es: 'Traducciones' },
  TAB_ADVANCED: { en: 'Advanced', de: 'Erweitert', fr: 'Avancé', es: 'Avanzado' },
  TAB_EXISTING_IMAGES: { en: 'Existing Images', de: 'Vorhandene Bilder', fr: 'Images existantes', es: 'Imágenes existentes' },
  TAB_UPLOAD_IMAGE: { en: 'Upload Image', de: 'Bild hochladen', fr: 'Télécharger une image', es: 'Subir imagen' },
  TAB_IMAGE_URL: { en: 'Image URL', de: 'Bild-URL', fr: 'URL de l\'image', es: 'URL de la imagen' },
  TAB_IMG_COPY: { en: 'Copy & Paste', de: 'Kopieren & Einfügen', fr: 'Copier & coller', es: 'Copiar y pegar' },
  TAB_IMG_UPLOAD: { en: 'Upload', de: 'Hochladen', fr: 'Télécharger', es: 'Subir' },
  TAB_IMG_CHOOSE: { en: 'Choose from existing', de: 'Aus Vorhandenen wählen', fr: 'Choisir parmi existants', es: 'Elegir de existentes' },
  TITLE_ADD_DOC: { en: 'Add New Document', de: 'Neues Dokument hinzufügen', fr: 'Ajouter un nouveau document', es: 'Agregar nuevo documento' },
  TAB_DRAG_DROP: { en: 'Drag & Drop', de: 'Drag & Drop', fr: 'Glisser-déposer', es: 'Arrastrar y soltar' },
  TAB_LINK: { en: 'Link', de: 'Link', fr: 'Lien', es: 'Enlace' },
  BTN_ADD_NEW_LINK: { en: 'Add New Link', de: 'Neuen Link hinzufügen', fr: 'Ajouter un nouveau lien', es: 'Agregar nuevo enlace' },
  LABEL_SORT_ORDER: { en: 'Sort Order', de: 'Sortierreihenfolge', fr: 'Ordre de tri', es: 'Orden de clasificación' },
  LABEL_STATUS: { en: 'Status', de: 'Status', fr: 'Statut', es: 'Estado' },
  BTN_SUGGEST_AI: { en: 'Suggest with AI', de: 'Suggest with AI', fr: 'Suggérer avec l\'IA', es: 'Sugerir con IA' },
  BTN_ADD_LEVEL: { en: 'Add Level', de: 'Ebene hinzufügen', fr: 'Ajouter un niveau', es: 'Agregar nivel' },
  BTN_CHOOSE_FILE: { en: 'Choose File', de: 'Datei auswählen', fr: 'Choisir un fichier', es: 'Elegir archivo' },
  MSG_TRANSLATING: { en: 'Translating...', de: 'Wird übersetzt...', fr: 'Traduction...', es: 'Traduciendo...' },
  MSG_ALL_PAGES_ASSIGNED: { en: 'All pages have been assigned.', de: 'Alle Seiten wurden zugewiesen.', fr: 'Toutes les pages ont été assignées.', es: 'Todas las páginas han sido asignadas.' },
  MSG_CLICK_ADD_ITEM: { en: 'Click to add item', de: 'Klicken zum Hinzufügen', fr: 'Cliquer pour ajouter', es: 'Haga clic para agregar' },
  MSG_COMING_SOON: { en: 'Coming Soon', de: 'Demnächst verfügbar', fr: 'Bientôt disponible', es: 'Próximamente' },
  MSG_DRAG_DROP: { en: 'Drag and drop files here', de: 'Dateien hierher ziehen', fr: 'Glisser-déposer les fichiers ici', es: 'Arrastre y suelte archivos aquí' },
  MSG_NAV_EMPTY: { en: 'Navigation is empty.', de: 'Navigation ist leer.', fr: 'La navigation est vide.', es: 'La navegación está vacía.' },
  MSG_NEWS_DESC: { en: 'Manage your news items here.', de: 'Verwalten Sie hier Ihre Nachrichten.', fr: 'Gérez vos actualités ici.', es: 'Administre sus noticias aquí.' },
  MSG_NO_FILE_CHOSEN: { en: 'No file chosen', de: 'Keine Datei ausgewählt', fr: 'Aucun fichier choisi', es: 'Ningún archivo elegido' },
  MSG_NO_IMAGES: { en: 'No images available.', de: 'Keine Bilder verfügbar.', fr: 'Aucune image disponible.', es: 'No hay imágenes disponibles.' },
  MSG_NO_ITEMS_FOUND: { en: 'No items found.', de: 'Keine Elemente gefunden.', fr: 'Aucun élément trouvé.', es: 'No se encontraron artículos.' },
  MSG_NO_PAGE_SELECTED: { en: 'No page selected', de: 'Keine Seite ausgewählt', fr: 'Aucune page sélectionnée', es: 'Nenguna página seleccionada' },
  MSG_NO_SLIDER_ITEMS: { en: 'No slider items found.', de: 'Keine Slider-Elemente gefunden.', fr: 'Aucun élément de curseur trouvé.', es: 'No se encontraron elementos de control deslizante.' },
  MSG_RENAME_WARNING: { en: 'Warning: Renaming may break links.', de: 'Warnung: Umbenennen kann Links unterbrechen.', fr: 'Attention : renommer peut casser les liens.', es: 'Advertencia: el cambio de nombre puede romper los enlaces.' },
  MSG_SELECT_PAGE_EDIT: { en: 'Select a page to edit', de: 'Wählen Sie eine Seite zum Bearbeiten', fr: 'Sélectionnez une page à modifier', es: 'Seleccione una página para editar' },
  MSG_SUPPORTED_FILES: { en: 'Supported Files: JPG, PNG, PDF', de: 'Unterstützte Dateien: JPG, PNG, PDF', fr: 'Fichiers supportés : JPG, PNG, PDF', es: 'Archivos compatibles: JPG, PNG, PDF' },
  MSG_MODULE_UNDER_DEV: { en: 'Module under development', de: 'Modul in Entwicklung', fr: 'Module en développement', es: 'Módulo en desarrollo' },
  LABEL_ORIGINAL: { en: 'Original (EN)', de: 'Original (EN)', fr: 'Original (EN)', es: 'Original (EN)' },
  LABEL_TRANSLATION: { en: 'Translation', de: 'Übersetzung', fr: 'Traduction', es: 'Traducción' },
  BTN_ADD_SLIDE_ALT: { en: 'Add Slider Item', de: 'Slider-Element hinzufügen', fr: 'Ajouter un élément de curseur', es: 'Agregar elemento de control deslizante' },
  LABEL_SUBTITLE: { en: 'Subtitle', de: 'Untertitel', fr: 'Sous-titre', es: 'Subtítulo' },
  LABEL_CTA_BUTTON: { en: 'CTA Button', de: 'Call-to-Action-Button', fr: 'Bouton CTA', es: 'Botón CTA' },
  LABEL_MODIFIED: { en: 'Modified', de: 'Geändert', fr: 'Modifié', es: 'Modificado' },
  PAGE_PREVIEW: { en: 'Page Preview', de: 'Seitenvorschau', fr: 'Aperçu de la page', es: 'Vista previa' },
  EDIT_MODE: { en: 'Edit Mode', de: 'Bearbeitungsmodus', fr: 'Mode édition', es: 'Modo edición' },
  CONTENT_TRANS: { en: 'Content Translator', de: 'Inhaltsübersetzer', fr: 'Traducteur de contenu', es: 'Traducteur de contenu' },
  NAV_MGMT: { en: 'Navigation Management', de: 'Navigationsverwaltung', fr: 'Gestion de navigation', es: 'Gestión de navegación' },
  NEWS_MGMT: { en: 'News Management', de: 'Nachrichtenverwaltung', fr: 'Gestion des actualités', es: 'Gestión de noticias' },
  DESC_NEWS_MGMT: { en: 'Manage your site news and announcements.', de: 'Verwalten Sie Ihre Website-Nachrichten und Ankündigungen.', fr: 'Gérez les actualités et les annonces de votre site.', es: 'Administre las noticias y anuncios de su sitio.' },
  EVENT_MGMT: { en: 'Event Management', de: 'Veranstaltungsverwaltung', fr: 'Gestion des événements', es: 'Gestión de eventos' },
  DOC_MGMT: { en: 'Document Management', de: 'Dokumentenverwaltung', fr: 'Gestion documentaire', es: 'Gestión de documentos' },
  FOOTER_MGMT: { en: 'Footer Management', de: 'Fußzeilenverwaltung', fr: 'Gestion de pied de page', es: 'Gestión de pie de página' },
  SITE_MGMT: { en: 'Site Management', de: 'Seitenverwaltung', fr: 'Gestion du site', es: 'Gestión del sitio' },
  IMG_MGMT: { en: 'Image Management', de: 'Bildverwaltung', fr: 'Gestion des images', es: 'Gestion des images' },
  PERM_MGMT: { en: 'Permission Management', de: 'Berechtigungsverwaltung', fr: 'Gestion des permissions', es: 'Gestión de permisos' },
  CONTACT_Q: { en: 'Contact Form Queries', de: 'Kontaktanfragen', fr: 'Demandes de contact', es: 'Consultas de contacto' },
  STYLING: { en: 'Styling Configuration', de: 'Design-Konfiguration', fr: 'Configuration du style', es: 'Configuración de estilo' },
  THEME_TEMPLATE_MGMT: { en: 'Theme Template Management', de: 'Design-Vorlagenverwaltung', fr: 'Gestion des modèles de thème', es: 'Gestión de plantillas de tema' },
  TITLE_THEME_TEMPLATES: { en: 'Theme Templates', de: 'Design-Vorlagen', fr: 'Modèles de thème', es: 'Plantillas de tema' },
  TITLE_CREATE_THEME_TEMPLATE: { en: 'Create Theme Template', de: 'Design-Vorlage erstellen', fr: 'Créer un modèle de thème', es: 'Crear plantilla de tema' },
  TITLE_EDIT_THEME_TEMPLATE: { en: 'Edit Theme Template', de: 'Design-Vorlage bearbeiten', fr: 'Modifier le modèle de thème', es: 'Editar plantilla de tema' },
  BTN_CREATE_THEME_TEMPLATE: { en: 'Create Theme Template', de: 'Design-Vorlage erstellen', fr: 'Créer un modèle de thème', es: 'Crear plantilla de tema' },
  BTN_SAVE_DRAFT: { en: 'Save as Draft', de: 'Als Entwurf speichern', fr: 'Enregistrer comme brouillon', es: 'Guardar como borrador' },
  BTN_APPLY_THEME: { en: 'Apply Theme', de: 'Design anwenden', fr: 'Appliquer le thème', es: 'Aplicar tema' },
  MSG_THEME_APPLIED: { en: 'Theme template applied successfully.', de: 'Design-Vorlage erfolgreich angewendet.', fr: 'Modèle de thème appliqué avec succès.', es: 'Plantilla de tema aplicada correctamente.' },
  MSG_NO_THEME_TEMPLATES: { en: 'No published theme templates yet. The default theme is available below.', de: 'Noch keine veröffentlichten Design-Vorlagen. Die Standardvorlage steht unten zur Verfügung.', fr: 'Aucun modèle de thème publié pour l\'instant. Le thème par défaut est disponible ci-dessous.', es: 'Aún no hay plantillas de tema publicadas. El tema predeterminado está disponible abajo.' },
  LABEL_DEFAULT_THEME: { en: 'Default Theme', de: 'Standard-Design', fr: 'Thème par défaut', es: 'Tema predeterminado' },
  LABEL_THEME_VERSION: { en: 'Version', de: 'Version', fr: 'Version', es: 'Versión' },
  DESC_THEME_TEMPLATE_MGMT: { en: 'Select a published theme template to apply to your site.', de: 'Wählen Sie eine veröffentlichte Design-Vorlage für Ihre Website.', fr: 'Sélectionnez un modèle de thème publié à appliquer à votre site.', es: 'Seleccione una plantilla de tema publicada para aplicar a su sitio.' },
  DESC_THEME_TEMPLATE_SUPER: { en: 'The default theme is always available. Select any template and apply to preview it on your site.', de: 'Das Standard-Design ist immer verfügbar. Wählen Sie eine Vorlage und wenden Sie sie an, um sie auf Ihrer Website zu testen.', fr: 'Le thème par défaut est toujours disponible. Sélectionnez un modèle et appliquez-le pour le prévisualiser sur votre site.', es: 'El tema predeterminado siempre está disponible. Seleccione una plantilla y aplíquela para previsualizarla en su sitio.' },
  MSG_NO_THEME_TEMPLATES_SUPER: { en: 'No theme templates yet. Click "Create Theme Template" to add one.', de: 'Noch keine Design-Vorlagen. Klicken Sie auf „Design-Vorlage erstellen“.', fr: 'Aucun modèle de thème pour l\'instant. Cliquez sur « Créer un modèle de thème ».', es: 'Aún no hay plantillas de tema. Haga clic en «Crear plantilla de tema».' },
  LABEL_THEME_NAME: { en: 'Theme Name', de: 'Designname', fr: 'Nom du thème', es: 'Nombre del tema' },
  PLACEHOLDER_THEME_NAME: { en: 'Enter theme template name...', de: 'Design-Vorlagenname eingeben...', fr: 'Entrez le nom du modèle de thème...', es: 'Ingrese el nombre de la plantilla de tema...' },
  BTN_EDIT: { en: 'Edit', de: 'Bearbeiten', fr: 'Éditer', es: 'Editar' },
  CONTAINER_ITEM_MGMT: { en: 'Container Items', de: 'Container-Elemente', fr: 'Éléments de conteneur', es: 'elementos de contenedor' },
  TITLE_CREATE_CONTAINER_ITEM: { en: 'Create Container Item', de: 'Container-Element erstellen', fr: 'Créer un élément de conteneur', es: 'Crear elemento de contenedor' },
  PLACEHOLDER_ITEM_TITLE: { en: 'Enter item title...', de: 'Titel des Elements eingeben...', fr: 'Entrez le titre de l\'élément...', es: 'Ingrese el título del elemento...' },
  TITLE_EDIT_CONTAINER_ITEM: { en: 'Edit Container Item', de: 'Container-Element bearbeiten', fr: 'Modifier l\'élément de conteneur', es: 'Editar elemento de contenedor' },
  LABEL_ADD_READ_MORE: { en: 'Add Read More Link', de: 'Mehr lesen Link hinzufügen', fr: 'Ajouter un lien Lire la suite', es: 'Agregar enlace Leer más' },
  LABEL_LINK_URL: { en: 'Link URL', de: 'Link URL', fr: 'URL du lien', es: 'URL del enlace' },
  LABEL_LINK_TEXT: { en: 'Link Text', de: 'Link Text', fr: 'Texte du lien', es: 'Texto del enlace' },
  LABEL_ORIGINAL_DESC: { en: 'Original Description', de: 'Originale Beschreibung', fr: 'Description originale', es: 'Descripción original' },
  PLACEHOLDER_ITEM_DESC: { en: 'Enter item description...', de: 'Beschreibung des Elements eingeben...', fr: 'Entrez la description de l\'élément...', es: 'Ingrese la descripción del elemento...' },
  LABEL_SEO_TITLE: { en: 'SEO Title', de: 'SEO Titel', fr: 'Titre SEO', es: 'Título SEO' },
  LABEL_META_DESC: { en: 'Meta Description', de: 'Meta-Beschreibung', fr: 'Méta description', es: 'Meta descripción' },
  LABEL_KEYWORDS: { en: 'Keywords', de: 'Schlagworte', fr: 'Mots-clés', es: 'Palabras clave' },
  LABEL_TRANSLATED_TITLE: { en: 'Translated Title', de: 'Übersetzter Titel', fr: 'Titre traduit', es: 'Título traducido' },
  LABEL_TRANSLATED_READ_MORE: { en: 'Translated Link Text', de: 'Übersetzter Link-Text', fr: 'Texte de lien traduit', es: 'Texto de enlace traducido' },
  LABEL_TRANSLATED_DESC: { en: 'Translated Description', de: 'Übersetzte Beschreibung', fr: 'Description traduite', es: 'Descripción traducida' },
  BTN_ADD_ITEM: { en: 'Add Item', de: 'Element hinzufügen', fr: 'Ajouter un élément', es: 'Agregar elemento' },
  LABEL_SEARCH_ITEMS: { en: 'Search items...', de: 'Elemente suchen...', fr: 'Rechercher des éléments...', es: 'Buscar elementos...' },
  MSG_CONTAINER_ITEM_DESC: { en: 'Manage reusable items for your containers.', de: 'Verwalten Sie wiederverwendbare Elemente für Ihre Container.', fr: 'Gérez les éléments réutilisables pour vos conteneurs.', es: 'Administre elementos reutilizables para sus contenedores.' },
  BTN_ADD_PAGE: { en: 'Add Page', de: 'Seite hinzufügen', fr: 'Ajouter une page', es: 'Agregar página' },
  TOOLTIP_ADD_PAGE: { en: 'Create a new page to expand your project. Once added, you can drag and drop it anywhere in your navigation.', de: 'Erstellen Sie eine neue Seite, um Ihr Projekt zu erweitern. Sobald sie hinzugefügt wurde, können Sie sie per Drag & Drop in Ihre Navigation verschieben.', fr: 'Créez une nouvelle page pour développer votre projet. Une fois ajoutée, vous pouvez la glisser-déposer n\'importe où dans votre navigation.', es: 'Cree una nueva página para ampliar su proyecto. Una vez agregada, puede arrastrarla y soltarla en cualquier lugar de su navegación.' },
  TOOLTIP_NAV_LOCK: { en: 'Unlock to drag and drop pages to reorder. Lock to prevent accidental changes.', de: 'Entsperren, um Seiten per Drag & Drop neu anzuordnen. Sperren, um versehentliche Änderungen zu verhindern.', fr: 'Déverrouillez pour glisser-déposer les pages afin de les réorganiser. Verrouillez pour éviter les modifications accidentelles.', es: 'Desbloquee para arrastrar y soltar páginas para reordenarlas. Bloquee para evitar cambios accidentales.' },
  TOOLTIP_NAV_ORGANIZE: { en: 'Drag and drop pages to organize your site\'s navigation. You can also nest pages to create dropdown menus.', de: 'Seiten per Drag & Drop verschieben, um die Navigation zu organisieren. Sie können Seiten auch verschachteln, um Dropdown-Menüs zu erstellen.', fr: 'Faites glisser et déposez des pages pour organiser la navigation de votre site. Vous pouvez également imbriquer des pages pour créer des menus déroulants.', es: 'Arrastra y suelta páginas para organizar la navegación de tu sitio. También puedes anidar páginas para crear menús desplegables.' },
  TITLE_CREATE_PAGE: { en: 'Add New Page', de: 'Neue Seite hinzufügen', fr: 'Ajouter une nouvelle page', es: 'Agregar nueva página' },
  BTN_CREATE_PAGE: { en: 'Save', de: 'Speichern', fr: 'Enregistrer', es: 'Guardar' },
  LABEL_PAGE_TITLE: { en: 'Title', de: 'Titel', fr: 'Titre', es: 'Título' },
  LABEL_URL_SLUG: { en: 'Slug', de: 'Slug', fr: 'Slug', es: 'Slug' },

  // Contact Management
  CONTACT_MGMT: { en: 'Contact Management', de: 'Kontaktverwaltung', fr: 'Gestion des contacts', es: 'Gestión de contactos' },
  TITLE_CREATE_CONTACT: { en: 'Create New Contact', de: 'Neuen Kontakt erstellen', fr: 'Créer un nouveau contact', es: 'Crear nuevo contacto' },
  TITLE_EDIT_CONTACT: { en: 'Edit Contact', de: 'Kontakt bearbeiten', fr: 'Modifier le contact', es: 'Editar contacto' },
  LABEL_FIRST_NAME: { en: 'First Name', de: 'Vorname', fr: 'Prénom', es: 'Nombre' },
  LABEL_LAST_NAME: { en: 'Last Name', de: 'Nachname', fr: 'Nom de famille', es: 'Apellido' },
  LABEL_FULL_NAME: { en: 'Full Name', de: 'Vollständiger Name', fr: 'Nom complet', es: 'Nombre completo' },
  LABEL_JOB_TITLE: { en: 'Job Title', de: 'Berufsbezeichnung', fr: 'Titre du poste', es: 'Título del trabajo' },
  LABEL_COMPANY: { en: 'Company', de: 'Firma', fr: 'Entreprise', es: 'Empresa' },
  LABEL_EMAIL: { en: 'Email', de: 'E-Mail', fr: 'E-mail', es: 'Correo electrónico' },
  LABEL_COUNTRY: { en: 'Country', de: 'Land', fr: 'Pays', es: 'País' },
  LABEL_PHONE: { en: 'Phone', de: 'Telefon', fr: 'Téléphone', es: 'Teléfono' },
  LABEL_MESSAGE: { en: 'Message', de: 'Nachricht', fr: 'Message', es: 'Mensaje' },
  LABEL_CAPTCHA: { en: 'CAPTCHA', de: 'CAPTCHA', fr: 'CAPTCHA', es: 'CAPTCHA' },
  TAB_SOCIAL_LINKS: { en: 'Social Links', de: 'Soziale Medien', fr: 'Réseaux sociaux', es: 'Redes sociales' },
  LABEL_LINKEDIN: { en: 'LinkedIn URL', de: 'LinkedIn URL', fr: 'URL LinkedIn', es: 'URL de LinkedIn' },
  LABEL_TWITTER: { en: 'Twitter URL', de: 'Twitter URL', fr: 'URL Twitter', es: 'URL de Twitter' },
  LABEL_FACEBOOK: { en: 'Facebook URL', de: 'Facebook URL', fr: 'URL Facebook', es: 'URL de Facebook' },
  PLACEHOLDER_CONTACT_NAME: { en: 'Enter contact name...', de: 'Kontaktname eingeben...', fr: 'Entrez le nom du contact...', es: 'Ingrese el nombre del contacto...' },
  MSG_CONTACT_DESC: { en: 'Manage your team members and contacts.', de: 'Verwalten Sie Ihre Teammitglieder und Kontakte.', fr: 'Gérez vos membres d\'équipe et vos contacts.', es: 'Administre los miembros de su equipo y contactos.' },

  // General Buttons & Labels
  BTN_CREATE: { en: 'Create', de: 'Erstellen', fr: 'Créer', es: 'Crear' },
  BTN_ADD_NEWS: { en: 'Add News', de: 'Nachricht hinzufügen', fr: 'Ajouter une actualité', es: 'Agregar noticia' },
  BTN_ADD_EVENT: { en: 'Add Event', de: 'Veranstaltung hinzufügen', fr: 'Ajouter un événement', es: 'Agregar evento' },
  BTN_CANCEL: { en: 'Cancel', de: 'Abbrechen', fr: 'Annuler', es: 'Cancelar' },
  BTN_SAVE: { en: 'Save', de: 'Speichern', fr: 'Enregistrer', es: 'Guardar' },
  BTN_DELETE: { en: 'Delete', de: 'Löschen', fr: 'Supprimer', es: 'Eliminar' },
  BTN_REMOVE: { en: 'Remove', de: 'Entfernen', fr: 'Retirer', es: 'Eliminar' },
  BTN_SELECT: { en: 'Select', de: 'Auswählen', fr: 'Sélectionner', es: 'Seleccionar' },
  BTN_CLEAR_IMAGE: { en: 'Clear Image', de: 'Bild entfernen', fr: 'Effacer l\'image', es: 'Borrar imagen' },
  BTN_UPLOAD_IMAGE: { en: 'Upload Image', de: 'Bild hochladen', fr: 'Télécharger l\'image', es: 'Subir imagen' },
  BTN_ADD_CONTAINER: { en: 'Add Container', de: 'Container hinzufügen', fr: 'Ajouter un conteneur', es: 'Agregar contenedor' },
  BTN_ADD_SECTIONS_HERE: { en: 'Add Sections Here', de: 'Abschnitt hier hinzufügen', fr: 'Ajouter une section ici', es: 'Agregar sección aquí' },
  TOOLTIP_ADD_SECTION: { en: 'Add Section', de: 'Abschnitt hinzufügen', fr: 'Ajouter une section', es: 'Agregar sección' },
  LABEL_DESCRIPTION: { en: 'Description', de: 'Beschreibung', fr: 'Description', es: 'Descripción' },
  LABEL_ACTIONS: { en: 'Actions', de: 'Aktionen', fr: 'Actions', es: 'Acciones' },
  TAB_IMAGE: { en: 'Image Information', de: 'Bild', fr: 'Image', es: 'Imagen' },

  // Image Upload Messages
  MSG_PASTE_OR_UPLOAD: { en: 'Paste image or click to upload', de: 'Bild einfügen oder zum Hochladen klicken', fr: 'Collez une image ou cliquez pour télécharger', es: 'Pegue la imagen o haga clic para cargar' },
  MSG_SUPPORTS_IMAGE_FORMATS: { en: 'Supports JPG, PNG, WEBP', de: 'Unterstützt JPG, PNG, WEBP', fr: 'Supporte JPG, PNG, WEBP', es: 'Soporta JPG, PNG, WEBP' },
  MSG_UPLOADING: { en: 'Uploading...', de: 'Wird hochgeladen...', fr: 'Téléchargement...', es: 'Subiendo...' },
  LABEL_CHOOSE_FROM_GALLERY: { en: 'Choose from Gallery', de: 'Aus Galerie wählen', fr: 'Choisir dans la galerie', es: 'Elegir de la galería' },

  // Translation Info
  MSG_TRANSLATION_INFO: { en: 'Provide translations for multilingual support. Fallback to English if empty.', de: 'Geben Sie Übersetzungen für mehrsprachige Unterstützung an. Fallback auf Englisch, wenn leer.', fr: 'Fournissez des traductions pour le support multilingue. Retour à l\'anglais si vide.', es: 'Proporcione traducciones para soporte multilingüe. Vuelve a inglés si está vacío.' },

  // Missing Labels for Contact Manager & others
  BTN_CLOSE: { en: 'Close', de: 'Schließen', fr: 'Fermer', es: 'Cerrar' },
  LABEL_VISUAL_VIEW: { en: 'Visual View', de: 'Visuelle Ansicht', fr: 'Vue visuelle', es: 'Vista visual' },
  LABEL_LIST_VIEW: { en: 'List View', de: 'Listenansicht', fr: 'Vue liste', es: 'Vista de lista' },
  BTN_READ_MORE: { en: 'Read More', de: 'Mehr lesen', fr: 'Lire la suite', es: 'Leer más' },
  BTN_READ_LESS: { en: 'Read Less', de: 'Weniger lesen', fr: 'Réduire', es: 'Leer menos' },
  LABEL_SEARCH_CONTACTS: { en: 'Search contacts...', de: 'Kontakte suchen...', fr: 'Rechercher des contacts...', es: 'Buscar contactos...' },
  LABEL_SORT_BY: { en: 'Sort by', de: 'Sortieren nach', fr: 'Trier par', es: 'Ordenar por' },
  BTN_ADD_CONTACT: { en: 'Add Contact', de: 'Kontakt hinzufügen', fr: 'Ajouter un contact', es: 'Agregar contacto' },
  MSG_REQ_TITLE: { en: 'Please enter a title to continue.', de: 'Bitte geben Sie einen Titel ein, um fortzufahren.', fr: 'Veuillez saisir un titre pour continuer.', es: 'Ingrese un título para continuar.' },
  MSG_FIELD_REQUIRED_NAMED: { en: '{0} is required.', de: '{0} ist erforderlich.', fr: '{0} est obligatoire.', es: '{0} es obligatorio.' },
  MSG_INVALID_EMAIL: { en: 'Please enter a valid email address.', de: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.', fr: 'Veuillez saisir une adresse e-mail valide.', es: 'Introduzca una dirección de correo electrónico válida.' },
  MSG_FORM_HAS_ERRORS: { en: 'Please correct the errors below before submitting.', de: 'Bitte korrigieren Sie die unten stehenden Fehler, bevor Sie absenden.', fr: 'Veuillez corriger les erreurs ci-dessous avant de soumettre.', es: 'Corrija los errores siguientes antes de enviar.' },
  MSG_FORM_ERROR_SUMMARY: { en: 'Please fix {0} issue(s) below before sending.', de: 'Bitte beheben Sie {0} Problem(e) unten, bevor Sie senden.', fr: 'Veuillez corriger {0} problème(s) ci-dessous avant d\'envoyer.', es: 'Corrija {0} problema(s) a continuación antes de enviar.' },
  MSG_SUBMIT_ERROR: { en: 'Submission failed. Please try again.', de: 'Übermittlung fehlgeschlagen. Bitte versuchen Sie es erneut.', fr: 'Échec de l\'envoi. Veuillez réessayer.', es: 'Error al enviar. Inténtelo de nuevo.' },
  MSG_INCORRECT_CAPTCHA: { en: 'Incorrect CAPTCHA.', de: 'Falsches CAPTCHA.', fr: 'CAPTCHA incorrect.', es: 'CAPTCHA incorrecto.' },
  MSG_CAPTCHA_LOAD_ERROR: { en: 'Could not load CAPTCHA. Please refresh.', de: 'CAPTCHA konnte nicht geladen werden. Bitte aktualisieren.', fr: 'Impossible de charger le CAPTCHA. Veuillez actualiser.', es: 'No se pudo cargar el CAPTCHA. Actualice, por favor.' },
  MSG_RATE_LIMITED: { en: 'Too many submissions. Please try again later.', de: 'Zu viele Übermittlungen. Bitte versuchen Sie es später erneut.', fr: 'Trop de soumissions. Veuillez réessayer plus tard.', es: 'Demasiados envíos. Inténtelo de nuevo más tarde.' },
  MSG_SUBMIT_TOO_FAST: { en: 'Please take a moment to complete the form before submitting.', de: 'Bitte nehmen Sie sich einen Moment Zeit, das Formular auszufüllen.', fr: 'Veuillez prendre un moment pour remplir le formulaire avant de l\'envoyer.', es: 'Tómese un momento para completar el formulario antes de enviar.' },
  MSG_ACCEPT_PRIVACY: { en: 'You must accept the privacy policy.', de: 'Sie müssen die Datenschutzerklärung akzeptieren.', fr: 'Vous devez accepter la politique de confidentialité.', es: 'Debe aceptar la política de privacidad.' },
  MSG_MESSAGE_RECEIVED_TITLE: { en: 'Message Received!', de: 'Nachricht erhalten!', fr: 'Message reçu !', es: '¡Mensaje recibido!' },
  MSG_MESSAGE_RECEIVED_DESC: { en: 'We have received your inquiry and will get back to you within 24 hours.', de: 'Wir haben Ihre Anfrage erhalten und melden uns innerhalb von 24 Stunden bei Ihnen.', fr: 'Nous avons bien reçu votre demande et vous répondrons sous 24 heures.', es: 'Hemos recibido su consulta y le responderemos en 24 horas.' },
  LABEL_CONTACT_US: { en: 'Contact us', de: 'Kontaktieren Sie uns', fr: 'Contactez-nous', es: 'Contáctenos' },
  LABEL_CONTACT_US_SUBHEADING: { en: 'We look forward to your message', de: 'Wir freuen uns auf Ihre Nachricht', fr: 'Nous attendons votre message avec impatience', es: 'Esperamos su mensaje' },
  BTN_SEND_ANOTHER_MESSAGE: { en: 'Send another message', de: 'Weitere Nachricht senden', fr: 'Envoyer un autre message', es: 'Enviar otro mensaje' },
  BTN_REFRESH_CAPTCHA: { en: 'Refresh CAPTCHA', de: 'CAPTCHA aktualisieren', fr: 'Actualiser le CAPTCHA', es: 'Actualizar CAPTCHA' },
  PLACEHOLDER_FIRST_NAME_EXAMPLE: { en: 'e.g. John', de: 'z. B. Max', fr: 'ex. Jean', es: 'p. ej. Juan' },
  PLACEHOLDER_LAST_NAME_EXAMPLE: { en: 'e.g. Doe', de: 'z. B. Mustermann', fr: 'ex. Dupont', es: 'p. ej. Pérez' },
  PLACEHOLDER_EMAIL_EXAMPLE: { en: 'name@example.com', de: 'name@beispiel.de', fr: 'nom@exemple.fr', es: 'nombre@ejemplo.com' },
  PLACEHOLDER_COUNTRY: { en: 'country', de: 'Land', fr: 'pays', es: 'pais' },
  PLACEHOLDER_MESSAGE_EXAMPLE: { en: 'Your message...', de: 'Ihre Nachricht...', fr: 'Votre message...', es: 'Su mensaje...' },
  LABEL_IMAGE_URL: { en: 'Image URL', de: 'Bild URL', fr: 'URL de l\'image', es: 'URL de la imagen' },
  LABEL_IMAGE_NAME: { en: 'Image Name', de: 'Bildname', fr: 'Nom de l\'image', es: 'Nombre de la imagen' },
  LABEL_TRANSLATED_JOB_TITLE: { en: 'Translated Job Title', de: 'Übersetzter Beruf', fr: 'Titre du poste traduit', es: 'Título del trabajo traducido' },
  LABEL_OPEN_OOTB_FORM: { en: 'Open out-of-the-box form', de: 'Standard-Formular öffnen', fr: 'Ouvrir le formulaire standard', es: 'Abrir formulario estándar' },
  TAB_URL: { en: 'URL', de: 'URL', fr: 'URL', es: 'URL' },
  BTN_DEFAULT_LOGO: { en: 'Placeholder Image', de: 'Platzhalterbild', fr: 'Image placeholder', es: 'Imagen placeholder' },
  BTN_DEFAULT_IMAGE: { en: 'Placeholder Image', de: 'Platzhalterbild', fr: 'Image placeholder', es: 'Imagen placeholder' },
  BTN_MARK_READ: { en: 'Mark as Read', de: 'Als gelesen markieren', fr: 'Marquer comme lu', es: 'Marcar como leído' },
  TITLE_SUBMISSION_DETAILS: { en: 'Submission Details', de: 'Anfragedetails', fr: 'Détails de la soumission', es: 'Detalles del envío' },
  LABEL_SUBMITTED_ON: { en: 'Submitted On', de: 'Eingereicht am', fr: 'Soumis le', es: 'Enviado el' },
  LABEL_SOURCE_PAGE: { en: 'Source Page', de: 'Quellseite', fr: 'Page source', es: 'Página de origen' },
  LABEL_FORM_DATA: { en: 'Form Data', de: 'Formulardaten', fr: 'Données du formulaire', es: 'Données du formulaire' },
  LABEL_EMPTY: { en: 'Empty', de: 'Leer', fr: 'Vide', es: 'Vacío' },
  LBL_LIBRARY_FOLDERS: { en: 'Library Folders', de: 'Bibliotheksordner', fr: 'Dossiers de bibliothèque', es: 'Carpetas de la biblioteca' },
  LABEL_ID: { en: 'ID', de: 'ID', fr: 'ID', es: 'ID' },
  LABEL_PAGE_NAME: { en: 'Page Name', de: 'Seitenname', fr: 'Nom de la page', es: 'Nombre de la página' },
  LABEL_SUBMITTED_BY: { en: 'Submitted By (Email)', de: 'Eingereicht von (Email)', fr: 'Soumis par (E-mail)', es: 'Enviado por (E-mail)' },
  LABEL_DATE: { en: 'Date', de: 'Datum', fr: 'Date', es: 'Fecha' },
  LABEL_SENDER_EMAIL: { en: 'Sender Email', de: 'Sender-Email', fr: 'E-mail de l\'expéditeur', es: 'Correo electrónico del remitente' },
  MSG_SHOWING: { en: 'Showing', de: 'Anzeige', fr: 'Affichage', es: 'Mostrando' },
  BTN_CLEAR_SEARCH: { en: 'Clear Search', de: 'Suche löschen', fr: 'Effacer la recherche', es: 'Borrar búsqueda' },
  MSG_NO_SUBMISSIONS: { en: 'No submissions found.', de: 'Keine Einreichungen gefunden.', fr: 'Aucune soumission trouvée.', es: 'No se encontraron presentaciones.' },
  BTN_VIEW_DETAILS: { en: 'View Details', de: 'Details anzeigen', fr: 'Voir les détails', es: 'Ver detalles' },
  BTN_EXPORT: { en: 'Export to CSV', de: 'Nach CSV exportieren', fr: 'Exporter en CSV', es: 'Exportar a CSV' },
  BTN_REFRESH: { en: 'Refresh Data', de: 'Daten aktualisieren', fr: 'Actualiser les données', es: 'Refrescar datos' },
  TITLE_VERSION_HISTORY: { en: 'Version History', de: 'Versionsverlauf', fr: 'Historique des versions', es: 'Historial de versiones' },
  BTN_HISTORY: { en: 'History', de: 'Verlauf', fr: 'Historique', es: 'Historial' },
  BTN_UPDATE: { en: 'Sync with Dictionary', de: 'Mit Wörterbuch abgleichen', fr: 'Synchroniser avec le dictionnaire', es: 'Sincronizar con diccionario' },
  BTN_GENERATE: { en: 'Generate', de: 'Generieren', fr: 'Générer', es: 'Generar' },
  BTN_PUBLISH: { en: 'Publish', de: 'Veröffentlichen', fr: 'Publier', es: 'Publicar' },
  BTN_UPLOAD: { en: 'Upload', de: 'Hochladen', fr: 'Télécharger', es: 'Subir' },
  BTN_COPY: { en: 'Copy', de: 'Kopieren', fr: 'Copier', es: 'Copiar' },
  BTN_DREAMING: { en: 'AI Generating...', de: 'KI generiert...', fr: 'Génération IA...', es: 'IA generando...' },
  BTN_RESET_DEFAULTS: { en: 'Reset to Defaults', de: 'Auf Standard zurücksetzen', fr: 'Réinitialiser par défaut', es: 'Restablecer valores predeterminados' },
  BTN_SAVE_CONFIG: { en: 'Save Configuration', de: 'Konfiguration speichern', fr: 'Enregistrer la configuration', es: 'Guardar configuración' },
  BTN_CLEAR_FILTERS: { en: 'Clear Filters', de: 'Filter löschen', fr: 'Effacer les filtres', es: 'Borrar filtros' },

  // Navigation Manager - Header Configuration
  NAV_HEADER_CONFIG: { en: 'Header Configuration', de: 'Kopfzeilen-Konfiguration', fr: 'Configuration de l\'en-tête', es: 'Configuración de encabezado' },
  LABEL_SITE_LANGUAGES_CONFIG: { en: 'Site Languages Configuration', de: 'Website-Sprachen', fr: 'Configuration des langues', es: 'Configuración de idiomas' },
  LABEL_SITE_LANGUAGES_HINT: {
    en: 'English is always the primary language. Select additional languages to show the site language selector and enable translations for those languages.',
    de: 'Englisch ist immer die Hauptsprache. Wählen Sie weitere Sprachen, um die Sprachauswahl anzuzeigen und Übersetzungen zu aktivieren.',
    fr: 'L\'anglais est toujours la langue principale. Sélectionnez des langues supplémentaires pour afficher le sélecteur et activer les traductions.',
    es: 'El inglés es siempre el idioma principal. Seleccione idiomas adicionales para mostrar el selector y habilitar traducciones.',
  },
  LABEL_PRIMARY_LANGUAGE: { en: 'Primary', de: 'Primär', fr: 'Principale', es: 'Principal' },
  MSG_NO_OPTIONAL_LANGUAGES: {
    en: 'Enable languages in Navigation Management → Site Languages Configuration',
    de: 'Sprachen unter Navigationsverwaltung → Website-Sprachen aktivieren',
    fr: 'Activez les langues dans Gestion de navigation → Configuration des langues',
    es: 'Active idiomas en Gestión de navegación → Configuración de idiomas',
  },
  NAV_MENU_PLACEMENT: { en: 'Menu Placement', de: 'Menü-Platzierung', fr: 'Placement du menu', es: 'Posición del menú' },
  NAV_SHOW_BREADCRUMB: { en: 'Show breadcrumb', de: 'Brotkrumen anzeigen', fr: 'Afficher le fil d\'Ariane', es: 'Mostrar ruta de navegación' },
  NAV_BREADCRUMB_HEIGHT: { en: 'Breadcrumb Height', de: 'Brotkrumen-Höhe', fr: 'Hauteur du fil d\'Ariane', es: 'Altura de la ruta de navegación' },
  NAV_BREADCRUMB_FONT_SIZE: { en: 'Breadcrumb Font Size', de: 'Brotkrumen-Schriftgröße', fr: 'Taille de police du fil d\'Ariane', es: 'Tamaño de fuente de la ruta de navegación' },
  NAV_NAVIGATION_WIDTH: { en: 'Navigation Width', de: 'Navigationsbreite', fr: 'Largeur de navigation', es: 'Ancho de navigation' },
  NAV_NAVIGATION_WIDTH_HINT: {
    en: 'Use Global Page Width matches Theme Editor → Page Width (container breakpoints). Full Page spans 100% of the header area. Custom sets a fixed max width for the navigation bar only.',
    de: '„Globale Seitenbreite“ übernimmt die Seitenbreite aus dem Theme-Editor (Container-Breakpoints). „Volle Seite“ nutzt 100 % der Kopfzeile. „Benutzerdefiniert“ setzt eine feste Maximalbreite nur für die Navigation.',
    fr: '« Largeur globale » reprend la largeur du thème (points de rupture du conteneur). « Pleine page » utilise 100 % de l’en-tête. « Personnalisé » fixe une largeur max. pour la barre de navigation uniquement.',
    es: '« Ancho global » usa el ancho del tema (contenedor responsive). « Página completa » ocupa el 100 % del encabezado. « Personalizado » fija un ancho máximo solo para la barra de navegación.',
  },
  NAV_USE_GLOBAL_PAGE_WIDTH: { en: 'Use Global Page Width', de: 'Globale Seitenbreite verwenden', fr: 'Utiliser la largeur globale', es: 'Usar ancho global de página' },
  NAV_FULL_PAGE: { en: 'Full Page', de: 'Volle Seite', fr: 'Pleine page', es: 'Página completa' },
  NAV_RIGHT_OF_PAGE: { en: 'Right of Page', de: 'Rechts auf der Seite', fr: 'Droite de la page', es: 'Derecha de la página' },
  NAV_NEAR_LOGO: { en: 'Near Logo', de: 'Neben dem Logo', fr: 'Près du logo', es: 'Cerca del logo' },
  NAV_NEXT_LINE: { en: 'Next Line', de: 'Nächste Zeile', fr: 'Ligne suivante', es: 'Línea siguiente' },
  NAV_ROW_ALIGNMENT: { en: 'Row Alignment', de: 'Zeilen-Ausrichtung', fr: 'Alignement de la ligne', es: 'Alineación de fila' },
  NAV_PAGE_WIDTH: { en: 'Page Width', de: 'Seitenbreite', fr: 'Largeur de la page', es: 'Ancho de página' },
  NAV_FULL_WIDTH: { en: 'Full Width', de: 'Volle Breite', fr: 'Pleine largeur', es: 'Ancho completo' },
  NAV_STANDARD_BOXED: { en: 'Standard (Boxed)', de: 'Standard (Gerahmt)', fr: 'Standard (encadré)', es: 'Estándar (enmarcado)' },
  NAV_PAGE_WIDTH_CUSTOM: { en: 'Custom', de: 'Benutzerdefiniert', fr: 'Personnalisé', es: 'Personalizado' },
  PLACEHOLDER_PAGE_WIDTH_CUSTOM: {
    en: 'Enter a max width (e.g. 1280px, 90rem, or 95%)',
    de: 'Maximale Breite eingeben (z. B. 1280px, 90rem oder 95%)',
    fr: 'Saisir une largeur max (ex. 1280px, 90rem ou 95 %)',
    es: 'Introduzca un ancho máximo (p. ej. 1280px, 90rem o 95%)',
  },
  NAV_BG_COLOR: { en: 'Background Color', de: 'Hintergrundfarbe', fr: 'Couleur de fond', es: 'Color de fondo' },
  NAV_LOGO_HEIGHT: { en: 'Logo Height', de: 'Logo Höhe', fr: 'Hauteur du logo', es: 'Altura del logo' },
  NAV_MENU_HEIGHT: { en: 'Menu Height', de: 'Menü Höhe', fr: 'Hauteur du menu', es: 'Altura del menú' },
  NAV_HEADER_HEIGHT: { en: 'Navigation Height', de: 'Navigationshöhe', fr: 'Hauteur de navigation', es: 'Altura de navegación' },
  NAV_HEADER_TOP_BG: { en: 'Top Background Color', de: 'Top Hintergrundfarbe', fr: 'Couleur de fond du haut', es: 'Color de fondo superior' },
  NAV_HEADER_BOTTOM_BG: { en: 'Bottom Background Color', de: 'Unten Hintergrundfarbe', fr: 'Couleur de fond du bas', es: 'Color de fondo inferior' },
  NAV_HEADER_LOGO_TEXT: { en: 'Logo Text (Optional)', de: 'Logo-Text (Optional)', fr: 'Texte du logo (optionnel)', es: 'Texto del logo (opcional)' },
  NAV_HEADER_TEXT_SPACING: { en: 'Logo-Text Spacing', de: 'Logo-Text Abstand', fr: 'Espacement logo-texte', es: 'Espacio logo-texto' },
  NAV_HEADER_LOGO_TEXT_ALIGNMENT: { en: 'Logo Text Alignment', de: 'Logo-Text Ausrichtung', fr: 'Alignement du texte du logo', es: 'Alineación del texto del logotipo' },
  NAV_HEADER_LOGO_TEXT_FONT_SIZE: { en: 'Logo Text Font Size', de: 'Logo-Text-Schriftgröße', fr: 'Taille de police du texte du logo', es: 'Tamaño de fuente del texto del logotipo' },
  NAV_LOGO_TEXT_UP: { en: 'Up', de: 'Oben', fr: 'Oben', es: 'Oben' },
  NAV_LOGO_TEXT_CENTRE: { en: 'Centre', de: 'Zentriert', fr: 'Zentriert', es: 'Zentriert' },
  NAV_LOGO_TEXT_DOWN: { en: 'Down', de: 'Unten', fr: 'Unten', es: 'Unten' },
  NAV_LOGO_MARGIN_LEFT: { en: 'Logo Left Margin', de: 'Logo linker Rand', fr: 'Marge gauche du logo', es: 'Margen izquierdo del logo' },
  NAV_MENU_MARGIN_LEFT: { en: 'Menu Left Margin', de: 'Menü linker Rand', fr: 'Marge gauche du menu', es: 'Margen izquierdo del menú' },
  NAV_TOP_ALIGNMENT: { en: 'Top Alignment', de: 'Obere Ausrichtung', fr: 'Alignement supérieur', es: 'Alineación superior' },
  NAV_LOGO_SETTINGS: { en: 'Site & Logo Settings', de: 'Site- & Logo-Einstellungen', fr: 'Paramètres du site et du logo', es: 'Configuración del sitio y logo' },
  NAV_LOGO_POSITION: { en: 'Position', de: 'Position', fr: 'Position', es: 'Position' },
  PLACEHOLDER_SITE_NAME: { en: 'Site Name (e.g. Hochhuth Consulting GmbH)', de: 'Seitenname (z. B. Hochhuth Consulting GmbH)', fr: 'Nom du site (ex. Hochhuth Consulting GmbH)', es: 'Nombre del sitio (p. ej. Hochhuth Consulting GmbH)' },
  PLACEHOLDER_LOGO_URL: { en: 'Logo URL (e.g. /assets/logo.png)', de: 'Logo-URL (z. B. /assets/logo.png)', fr: 'URL du logo (ex. /assets/logo.png)', es: 'URL del logo (p. ej. /assets/logo.png)' },
  PLACEHOLDER_LOGO_WIDTH: { en: 'Width (150px)', de: 'Breite (150px)', fr: 'Largeur (150px)', es: 'Ancho (150px)' },
  NAV_NAV_FONT_WEIGHT: { en: 'Top Navigation Font Weight', de: 'Top Navigation Schriftgewicht', fr: 'Épaisseur de police de navigation supérieure', es: 'Grosor de fuente de navegación superior' },
  NAV_NAV_HOVER_COLOR: { en: 'Top Navigation Hover Color', de: 'Top Navigation Hover-Farbe', fr: 'Couleur de survol de la navigation supérieure', es: 'Color de navegación superior al pasar el mouse' },
  NAV_SUBMENU_HOVER_BG: { en: 'Top Submenu Hover Background', de: 'Top Untermenü Hover-Hintergrund', fr: 'Arrière-plan de survol du sous-menu supérieur', es: 'Fondo de submenú superior al pasar el mouse' },
  NAV_SUBMENU_HOVER_TEXT: { en: 'Top Submenu Hover Text', de: 'Top Untermenü Hover-Text', fr: 'Texte de survol du sous-menu supérieur', es: 'Texto de submenú superior al pasar el mouse' },
  NAV_MENU_FONT_SIZE: { en: 'Menu Font Size', de: 'Menü Schriftgröße', fr: 'Taille de police du menu', es: 'Tamaño de fuente del menú' },
  NAV_MENU_FONT_WEIGHT: { en: 'Menu Font Weight', de: 'Menü Schriftgewicht', fr: 'Poids de la police du menu', es: 'Grosor de la font del menú' },
  NAV_MENU_LINE_HEIGHT: { en: 'Menu Line Height', de: 'Menü Zeilenhöhe', fr: 'Hauteur de ligne du menu', es: 'Altura de línea del menú' },
  NAV_MENU_FONT_FAMILY: { en: 'Menu Font Family', de: 'Menü Schriftfamilie', fr: 'Famille de polices du menu', es: 'Familia de fuentes del menú' },
  NAV_SUBMENU_WIDTH: { en: 'Submenu Dropdown Width', de: 'Dropdown-Breite', fr: 'Largeur du menu déroulant', es: 'Ancho del menú desplegable' },
  NAV_SUBMENU_FONT_SIZE: { en: 'Submenu Font Size', de: 'Untermenü Schriftgröße', fr: 'Taille de police du sous-menu', es: 'Tamaño de fuente del submenú' },
  NAV_SUBMENU_FONT_WEIGHT: { en: 'Submenu Font Weight', de: 'Untermenü Schriftgewicht', fr: 'Poids de la police du sous-menu', es: 'Grosor de la fuente del submenú' },
  NAV_SUBMENU_LINE_HEIGHT: { en: 'Submenu Line Height', de: 'Untermenü Zeilenhöhe', fr: 'Hauteur de ligne du sous-menu', es: 'Altura de línea del submenú' },
  NAV_SUBMENU_FONT_FAMILY: { en: 'Submenu Font Family', de: 'Untermenü Schriftfamilie', fr: 'Famille de polices du sous-menu', es: 'Familia de fuentes del submenú' },
  NAV_MENU_TEXT_TRANSFORM: { en: 'Menu Text Transform', de: 'Menü-Texttransformation', fr: 'Transformation de texte du menu', es: 'Transformación de texto del menú' },
  NAV_SUBMENU_TEXT_TRANSFORM: { en: 'Submenu Text Transform', de: 'Untermenü Texttransformation', fr: 'Transformation de texte du sous-menu', es: 'Transformación de texto del submenú' },
  BTN_ADD_NAV_ITEM: { en: 'Add Navigation Item', de: 'Navigationselement hinzufügen', fr: 'Ajouter un élément de navigation', es: 'Agregar elemento de navegación' },
  BTN_CREATE_SUBPAGE: { en: 'Create Subpage', de: 'Unterseite erstellen', fr: 'Créer une sous-page', es: 'Crear subpágina' },
  DESC_CREATE_SUBPAGE: { en: 'Creates a new Smart Page with a nested URL under the parent navigation item and links it automatically.', de: 'Erstellt eine neue Smart Page mit verschachtelter URL unter dem übergeordneten Navigationselement und verknüpft sie automatisch.', fr: 'Crée une nouvelle Smart Page avec une URL imbriquée sous l\'élément de navigation parent et la lie automatiquement.', es: 'Crea una nueva Smart Page con una URL anidada bajo el elemento de navegación principal y la vincula automáticamente.' },
  LABEL_SUBPAGE_PARENT: { en: 'Parent', de: 'Übergeordnet', fr: 'Parent', es: 'Padre' },
  LABEL_SUBPAGE_CURRENT: { en: 'Current page', de: 'Aktuelle Seite', fr: 'Page actuelle', es: 'Página actual' },
  LINK_MODE_SUBPAGE: { en: 'Create Subpage', de: 'Unterseite erstellen', fr: 'Créer une sous-page', es: 'Crear subpágina' },
  LINK_MODE_NEW_PAGE: { en: 'Create New Page', de: 'Neue Seite erstellen', fr: 'Créer une nouvelle page', es: 'Crear nueva página' },
  LINK_MODE_EXISTING_PAGE: { en: 'Tag Existing Page', de: 'Bestehende Seite verknüpfen', fr: 'Lier une page existante', es: 'Vincular página existente' },
  DESC_CREATE_NEW_PAGE: { en: 'Creates a new Smart Page using the navigation title and links it automatically.', de: 'Erstellt eine neue Smart Page mit dem Navigationstitel und verknüpft sie automatisch.', fr: 'Crée une nouvelle Smart Page à partir du titre de navigation et la lie automatiquement.', es: 'Crea una nueva Smart Page con el título de navegación y la vincula automáticamente.' },
  BTN_CREATE_NEW_PAGE: { en: 'Create Page', de: 'Seite erstellen', fr: 'Créer la page', es: 'Crear página' },
  BTN_VISUAL_VIEW: { en: 'Visual View', de: 'Visuelle Ansicht', fr: 'Vue visuelle', es: 'Vista visual' },
  BTN_LIST_VIEW: { en: 'List View', de: 'Listenansicht', fr: 'Vue liste', es: 'Vue liste' },
  LABEL_URL_PAGE: { en: 'URL / Page', de: 'URL / Seite', fr: 'URL / Page', es: 'URL / Página' },
  TH_ACTIONS: { en: 'Actions', de: 'Aktionen', fr: 'Actions', es: 'Acciones' },
  BTN_ADD_NEW: { en: 'Add Navigation Item', de: 'Navigationselement hinzufügen', fr: 'Ajouter un élément de navigation', es: 'Agregar elemento de navegación' },
  TITLE_CREATE_GROUP: { en: 'Create New Group', de: 'Neue Gruppe erstellen', fr: 'Créer un nouveau groupe', es: 'Crear nuevo grupo' },
  LABEL_GROUP_NAME: { en: 'Group Name', de: 'Gruppenname', fr: 'Nom du groupe', es: 'Nombre del grupo' },
  BTN_SAVE_GROUP: { en: 'Save Group', de: 'Gruppe speichern', fr: 'Enregistrer le groupe', es: 'Guardar grupo' },
  TITLE_ADD_USER_TO: { en: 'Add User to', de: 'Benutzer hinzufügen zu', fr: 'Ajouter un utilisateur à', es: 'Agregar usuario a' },
  LABEL_SEARCH_USER: { en: 'Search User', de: 'Benutzer suchen', fr: 'Rechercher un utilisateur', es: 'Buscar usuario' },
  TITLE_MANAGE_GROUP: { en: 'Manage Group', de: 'Gruppe verwalten', fr: 'Gérer le groupe', es: 'Administrar grupo' },
  LABEL_MEMBER_COUNT: { en: 'Group Members', de: 'Gruppenmitglieder', fr: 'Membres du groupe', es: 'Miembros del grupo' },
  TH_USER_NAME: { en: 'User Name', de: 'Benutzername', fr: 'Nom d\'utilisateur', es: 'Nombre de usuario' },
  TH_EMAIL_ADDRESS: { en: 'Email Address', de: 'E-Mail Adresse', fr: 'Adresse e-mail', es: 'Correo electrónico' },
  TITLE_CHECK_USER_PERM: { en: 'Check User Permissions', de: 'Benutzerberechtigungen prüfen', fr: 'Vérifier les permissions de l\'utilisateur', es: 'Verificar permisos de usuario' },
  LABEL_GROUP_MEMBERSHIPS: { en: 'Group Memberships', de: 'Gruppenmitgliedschaften', fr: 'Appartenance aux groupes', es: 'Membresía de grupo' },
  MSG_NO_MEMBERS: { en: 'No members found matching your search.', de: 'Keine Mitglieder gefunden, die Ihrer Suche entsprechen.', fr: 'Aucun membre trouvé correspondant à votre recherche.', es: 'No se encontraron miembros para su búsqueda.' },
  MSG_USER_NOT_FOUND: { en: 'User not found. Please try again.', de: 'Benutzer nicht gefunden. Bitte versuchen Sie es erneut.', fr: 'Utilisateur non trouvé. Veuillez réessayer.', es: 'Usuario no encontrado. Por favor, inténtelo de nuevo.' },
  LABEL_ENABLED: { en: 'Enabled', de: 'Aktiviert', fr: 'Activé', es: 'Habilitado' },
  LABEL_DISABLED: { en: 'Disabled', de: 'Deaktiviert', fr: 'Désactivé', es: 'Deshabilitado' },
  LABEL_SELECT_TARGET_CONTAINER: { en: 'Select Target Container', de: 'Ziel-Container auswählen', fr: 'Sélectionner le conteneur cible', es: 'Seleccionar contenedor de destino' },
  MSG_NO_CONTAINERS: { en: 'No containers available on the site.', de: 'Keine Container auf der Website verfügbar.', fr: 'Aucun conteneur disponible sur le site.', es: 'No hay contenedores disponibles en el sitio.' },
  LABEL_ENTER_CONTAINER_TITLE: { en: 'Enter Container Title', de: 'Container-Titel eingeben', fr: 'Entrer le titre du conteneur', es: 'Introducir título del contenedor' },
  MSG_CONTAINER_MATCHED: { en: 'Container matched successfully.', de: 'Container erfolgreich zugeordnet.', fr: 'Conteneur associé avec succès.', es: 'Contenedor coincidido con éxito.' },
  MSG_MAP_EXACT_TITLE: { en: 'Enter the exact title. Matches across all pages.', de: 'Geben Sie den genauen Titel ein. Gilt für alle Seiten.', fr: 'Entrez le titre exact. Correspond à toutes les pages.', es: 'Introduzca el título exacto. Coincide en todas las páginas.' },
  MSG_NO_TITLE: { en: 'No title', de: 'Kein Titel', fr: 'Pas de titre', es: 'Sin título' },
  MSG_NO_SUBTITLE: { en: 'No subtitle', de: 'Kein Untertitel', fr: 'Pas de sous-titre', es: 'Sin subtítulo' },
  MSG_NO_DESCRIPTION: { en: 'No description', de: 'Keine Beschreibung', fr: 'Pas de description', es: 'Sin descripción' },
  MSG_NO_CTA_TEXT: { en: 'No CTA text', de: 'Kein Button-Text', fr: 'Pas de texte CTA', es: 'Sin texto de CTA' },
  PH_ENTER_TITLE: { en: 'Enter title...', de: 'Titel eingeben...', fr: 'Entrer le titre...', es: 'Ingrese el título...' },
  PH_SEARCH_IMAGES: { en: 'Search images...', de: 'Bilder suchen...', fr: 'Rechercher des images...', es: 'Buscar imágenes...' },
  PLACEHOLDER_DISPLAY_NAME: { en: 'Display Name', de: 'Anzeigename', fr: 'Nom d\'affichage', es: 'Nombre para mostrar' },
  PLACEHOLDER_SLIDER_TITLE: { en: 'Slider Title', de: 'Slider-Titel', fr: 'Titre du curseur', es: 'Título del control deslizante' },
  PLACEHOLDER_SLIDE_NAME: { en: 'Slide Name', de: 'Folienname', fr: 'Nom de la diapositive', es: 'Nombre de la diapositiva' },
  PLACEHOLDER_TRANSLATED_TITLE: { en: 'Enter translated title...', de: 'Übersetzten Titel eingeben...', fr: 'Entrez le titre traduit...', es: 'Introduzca el título traducido...' },
  PLACEHOLDER_TRANSLATED_SUBTITLE: { en: 'Enter translated subtitle...', de: 'Übersetzten Untertitel eingeben...', fr: 'Entrez le sous-titre traduit...', es: 'Introduzca el subtítulo traducido...' },
  PLACEHOLDER_TRANSLATED_DESC: { en: 'Enter translated description...', de: 'Übersetzte Beschreibung eingeben...', fr: 'Entrez la description traduite...', es: 'Descripción traducida...' },
  PLACEHOLDER_TRANSLATED_CTA: { en: 'Enter translated CTA text...', de: 'Übersetzten Button-Text eingeben...', fr: 'Entrez le texte CTA traduit...', es: 'Introduzca el texto de CTA traducido...' },
  PLACEHOLDER_NEWS_TITLE: { en: 'Enter news title...', de: 'Nachrichtentitel eingeben...', fr: 'Entrez le titre de l\'actualité...', es: 'Ingrese el título de la noticia...' },
  PLACEHOLDER_RENAME_DOC: { en: 'Enter new document name...', de: 'Neuen Dokumentnamen eingeben...', fr: 'Entrez le nouveau nom du document...', es: 'Ingrese el nuevo nombre del documento...' },
  PLACEHOLDER_AI_PROMPT: { en: 'Enter AI prompt...', de: 'KI-Prompt eingeben...', fr: 'Entrez l\'invite IA...', es: 'Ingrese el mensaje de IA...' },
  PLACEHOLDER_DESC: { en: 'Enter description...', de: 'Beschreibung eingeben...', fr: 'Entrez la description...', es: 'Ingrese la descripción...' },
  PLACEHOLDER_SUBHEADING: { en: 'Enter subheading...', de: 'Untertitel eingeben...', fr: 'Entrez le sous-titre...', es: 'Ingrese el subencabezado...' },
  LABEL_TITLE: { en: 'Title', de: 'Titel', fr: 'Titre', es: 'Título' },
  LABEL_SUBHEADING: { en: 'Subheading', de: 'Unterüberschrift', fr: 'Sous-titre', es: 'Subencabezado' },
  LABEL_DESC: { en: 'Description', de: 'Beschreibung', fr: 'Description', es: 'Descripción' },
  LABEL_START_DATE: { en: 'Start Date', de: 'Startdatum', fr: 'Date de début', es: 'Fecha de inicio' },
  LABEL_END_DATE: { en: 'End Date', de: 'Enddatum', fr: 'Date de fin', es: 'Fecha de finalización' },
  LABEL_PUBLISHING_DATE: { en: 'Publishing Date', de: 'Veröffentlichungsdatum', fr: 'Date de publication', es: 'Fecha de publicación' },
  LABEL_TRANS_TITLE: { en: 'Translated Title', de: 'Übersetzter Titel', fr: 'Titre traduit', es: 'Título traducido' },
  LABEL_TRANS_CAT: { en: 'Translated Category', de: 'Übersetzte Kategorie', fr: 'Catégorie traduite', es: 'Categoría traduite' },
  LABEL_TRANS_LOC: { en: 'Translated Location', de: 'Übersetzter Ort', fr: 'Lieu traduit', es: 'Ubicación traducida' },
  LABEL_TRANS_READ_MORE: { en: 'Translated Read More', de: 'Übersetztes "Weiterlesen"', fr: 'Traduit "Lire la suite"', es: 'Traducido "Leer más"' },
  LABEL_TRANS_DESC: { en: 'Translated Description', de: 'Übersetzte Beschreibung', fr: 'Description traduite', es: 'Descripción traducida' },
  LABEL_ITEM_RANK: { en: 'Item Rank', de: 'Rangfolge', fr: 'Rang de l\'élément', es: 'Rango del artículo' },
  LABEL_YEAR: { en: 'Year', de: 'Jahr', fr: 'Année', es: 'Año' },
  LABEL_FILE_NAME: { en: 'File Name', de: 'Dateiname', fr: 'Nom du fichier', es: 'Nombre del archivo' },
  LABEL_FILE_TYPE: { en: 'Type', de: 'Typ', fr: 'Type', es: 'Tipo' },
  LABEL_CREATED: { en: 'Created', de: 'Erstellt', fr: 'Créé', es: 'Creado' },
  LABEL_LOCATION: { en: 'Location', de: 'Ort', fr: 'Lieu', es: 'Ubicación' },
  LABEL_SEARCH_NEWS: { en: 'Search news...', de: 'Nachrichten suchen...', fr: 'Rechercher des actualités...', es: 'Buscar noticias...' },
  LABEL_SEARCH_EVENTS: { en: 'Search events...', de: 'Veranstaltungen suchen...', fr: 'Rechercher des événements...', es: 'Buscar eventos...' },
  TITLE_CREATE_NEWS: { en: 'Create News Item', de: 'Nachricht erstellen', fr: 'Créer une actualité', es: 'Crear noticia' },
  TITLE_EDIT_NEWS: { en: 'Edit News Item', de: 'Nachricht bearbeiten', fr: 'Modifier l\'actualité', es: 'Editar noticia' },
  TITLE_CREATE_EVENT: { en: 'Create Event', de: 'Veranstaltung erstellen', fr: 'Créer un événement', es: 'Crear evento' },
  TITLE_EDIT_EVENT: { en: 'Edit Event', de: 'Veranstaltung bearbeiten', fr: 'Modifier l\'événement', es: 'Editar evento' },
  MODAL_CREATE_EVENT: { en: 'Create New Event', de: 'Neue Veranstaltung erstellen', fr: 'Créer un nouvel événement', es: 'Crear nuevo evento' },
  MODAL_EDIT_EVENT: { en: 'Edit Event Details', de: 'Veranstaltungsdetails bearbeiten', fr: 'Modifier les détails de l\'événement', es: 'Editar detalles del evento' },
  LABEL_CATEGORY: { en: 'Category', de: 'Kategorie', fr: 'Catégorie', es: 'Categoría' },
  LABEL_DOC_NAME: { en: 'Document Name', de: 'Dokumentname', fr: 'Nom du document', es: 'Nombre del documento' },
  LABEL_DOC_TYPES: { en: 'Document Types', de: 'Dokumenttypen', fr: 'Types de documents', es: 'Tipos de documentos' },
  LABEL_ENABLE_AUTOPLAY: { en: 'Enable Autoplay', de: 'Autoplay aktivieren', fr: 'Activer la lecture automatique', es: 'Habilitar reproducción automática' },
  LABEL_ENTER_MAP_TITLE: { en: 'Enter Map Title', de: 'Kartentitel eingeben', fr: 'Entrer le titre de la carte', es: 'Ingrese el título del mapa' },
  LABEL_LAYOUT_FOR: { en: 'Layout For', de: 'Layout für', fr: 'Mise en page pour', es: 'Diseño para' },
  LABEL_LINK_NAME: { en: 'Link Name', de: 'Linkname', fr: 'Nom du lien', es: 'Nombre del enlace' },
  LABEL_NO_DATE: { en: 'No Date', de: 'Kein Datum', fr: 'Pas de date', es: 'Sin fecha' },
  LABEL_NO_DESCRIPTION: { en: 'No Description', de: 'Keine Beschreibung', fr: 'Pas de description', es: 'Sin descripción' },
  LABEL_ORPHAN_PAGES: { en: 'Orphan Pages', de: 'Waisenseiten', fr: 'Pages orphelines', es: 'Páginas huérfanas' },
  LABEL_OVERLAY_POS: { en: 'Overlay Position', de: 'Position des Overlays', fr: 'Position de la superposition', es: 'Posición de superposición' },
  LABEL_PUBLIC_URL: { en: 'Public URL', de: 'Öffentliche URL', fr: 'URL publique', es: 'URL pública' },
  LABEL_PUBLISH_DATE: { en: 'Publish Date', de: 'Veröffentlichungsdatum', fr: 'Date de publication', es: 'Fecha de publicación' },
  LABEL_READ_MORE: { en: 'Read More', de: 'Mehr lesen', fr: 'Lire la suite', es: 'Leer más' },
  LABEL_REQUIRED: { en: 'Required', de: 'Erforderlich', fr: 'Requis', es: 'Requerido' },
  LABEL_SHOW_DESC: { en: 'Show Description', de: 'Beschreibung anzeigen', fr: 'Afficher la description', es: 'Mostrar descripción' },
  LABEL_SHOW_TITLE: { en: 'Show Title', de: 'Titel anzeigen', fr: 'Afficher le titre', es: 'Mostrar título' },
  LABEL_SLIDER_SPEED: { en: 'Slider Speed (ms)', de: 'Slider-Geschwindigkeit (ms)', fr: 'Vitesse du curseur (ms)', es: 'Velocidad del control deslizante (ms)' },
  LABEL_SLIDER_TITLE: { en: 'Slider Title', de: 'Slider-Titel', fr: 'Titre du curseur', es: 'Título del control deslizante' },
  LABEL_TEXT_ALIGNMENT: { en: 'Text Alignment', de: 'Textausrichtung', fr: 'Alignement du texte', es: 'Alineación del texto' },
  LABEL_TITLE_DATE: { en: 'Title & Date', de: 'Titel & Datum', fr: 'Titre & Date', es: 'Título y fecha' },
  LABEL_TOP_NAV: { en: 'Top Navigation', de: 'Obere Navigation', fr: 'Navigation supérieure', es: 'Navegación superior' },
  LABEL_TRANSLATION_STATE: { en: 'Translation State', de: 'Übersetzungsstatus', fr: 'État de la traduction', es: 'Estado de traducción' },
  LABEL_CAPITALIZE: { en: 'Capitalize', de: 'Großschreiben', fr: 'Capitaliser', es: 'Capitalizar' },
  LBL_ALIGNMENT: { en: 'Alignment', de: 'Ausrichtung', fr: 'Alignement', es: 'Alineación' },
  LBL_SHOW_LIST_BULLETS: { en: 'Show List Bullets', de: 'Listenpunkte anzeigen', fr: 'Afficher les puces', es: 'Mostrar viñetas' },
  LBL_YES: { en: 'Yes', de: 'Ja', fr: 'Oui', es: 'Sí' },
  LBL_NO: { en: 'No', de: 'Nein', fr: 'Non', es: 'No' },
  POS_BOTTOM: { en: 'Bottom', de: 'Unten', fr: 'Bas', es: 'Abajo' },
  POS_MIDDLE: { en: 'Middle', de: 'Mitte', fr: 'Milieu', es: 'Medio' },
  SECTION_AUTOPLAY: { en: 'Autoplay Settings', de: 'Autoplay-Einstellungen', fr: 'Paramètres de lecture automatique', es: 'Ajustes de reproducción automática' },
  SECTION_GENERAL_SETTINGS: { en: 'General Settings', de: 'Allgemeine Einstellungen', fr: 'Paramètres généraux', es: 'Ajustes generales' },
  SECTION_TEXT_OVERLAY: { en: 'Text Overlay', de: 'Text-Overlay', fr: 'Superposition de texte', es: 'Superposición de texto' },
  TITLE_AI_THEME: { en: 'AI Theme Generator', de: 'KI-Themen-Generator', fr: 'Générateur de thèmes IA', es: 'Generador de temas de IA' },
  TITLE_AI_THEME_HELP: { en: 'How AI Theme Generation Works', de: 'So funktioniert die KI-Theme-Generierung', fr: 'Comment fonctionne la génération de thème IA', es: 'Cómo funciona la generación de temas con IA' },
  DESC_AI_THEME_GLOBAL: {
    en: 'Generate a complete global theme for your entire site in one step. AI updates colors, typography, buttons, header, footer, sidebar, and icons together.',
    de: 'Erstellen Sie in einem Schritt ein vollständiges globales Theme für Ihre gesamte Website. Die KI aktualisiert Farben, Typografie, Buttons, Header, Footer, Sidebar und Symbole gemeinsam.',
    fr: 'Générez un thème global complet pour l\'ensemble de votre site en une étape. L\'IA met à jour les couleurs, la typographie, les boutons, l\'en-tête, le pied de page, la barre latérale et les icônes ensemble.',
    es: 'Genere un tema global completo para todo su sitio en un solo paso. La IA actualiza colores, tipografía, botones, encabezado, pie de página, barra lateral e iconos juntos.'
  },
  AI_THEME_HELP_STEP_1: {
    en: 'Describe the look and feel you want (e.g. classic corporate, education portal, rustic heritage).',
    de: 'Beschreiben Sie das gewünschte Erscheinungsbild (z. B. klassisch corporate, Bildungsportal, rustikales Erbe).',
    fr: 'Décrivez le style souhaité (par ex. corporate classique, portail éducatif, patrimoine rustique).',
    es: 'Describa el estilo deseado (ej. corporativo clásico, portal educativo, patrimonio rústico).'
  },
  AI_THEME_HELP_STEP_2: {
    en: 'Click Generate. AI builds a full theme that matches your description.',
    de: 'Klicken Sie auf Generieren. Die KI erstellt ein vollständiges Theme passend zu Ihrer Beschreibung.',
    fr: 'Cliquez sur Générer. L\'IA crée un thème complet correspondant à votre description.',
    es: 'Haga clic en Generar. La IA crea un tema completo acorde a su descripción.'
  },
  AI_THEME_HELP_STEP_3: {
    en: 'Review the Live Preview on the right — changes appear instantly.',
    de: 'Prüfen Sie die Live-Vorschau rechts — Änderungen erscheinen sofort.',
    fr: 'Consultez l\'aperçu en direct à droite — les changements apparaissent instantanément.',
    es: 'Revise la vista previa en vivo a la derecha — los cambios aparecen al instante.'
  },
  AI_THEME_HELP_STEP_4: {
    en: 'Fine-tune individual settings in the other tabs if needed.',
    de: 'Passen Sie bei Bedarf einzelne Einstellungen in den anderen Tabs an.',
    fr: 'Ajustez les paramètres individuels dans les autres onglets si nécessaire.',
    es: 'Ajuste configuraciones individuales en las otras pestañas si es necesario.'
  },
  AI_THEME_HELP_STEP_5: {
    en: 'Click Save Configuration to apply the theme site-wide.',
    de: 'Klicken Sie auf Konfiguration speichern, um das Theme siteweit anzuwenden.',
    fr: 'Cliquez sur Enregistrer la configuration pour appliquer le thème à tout le site.',
    es: 'Haga clic en Guardar configuración para aplicar el tema en todo el sitio.'
  },
  AI_THEME_HELP_NOTE: {
    en: 'Note: AI updates the theme draft until you save. Layout settings such as page width, logo text, and navigation alignment are not changed by AI.',
    de: 'Hinweis: Die KI aktualisiert den Theme-Entwurf bis zum Speichern. Layout-Einstellungen wie Seitenbreite, Logo-Text und Navigationsausrichtung werden von der KI nicht geändert.',
    fr: 'Remarque : l\'IA met à jour le brouillon du thème jusqu\'à l\'enregistrement. Les paramètres de mise en page tels que la largeur de page, le texte du logo et l\'alignement de la navigation ne sont pas modifiés par l\'IA.',
    es: 'Nota: la IA actualiza el borrador del tema hasta que guarde. Ajustes de diseño como ancho de página, texto del logo y alineación de navegación no los cambia la IA.'
  },
  AI_THEME_HELP_INCLUDES: {
    en: 'Includes: brand colors, text, links, backgrounds, buttons, typography, sidebar, header/footer colors, status colors, and icons.',
    de: 'Enthält: Markenfarben, Text, Links, Hintergründe, Buttons, Typografie, Sidebar, Header/Footer-Farben, Statusfarben und Symbole.',
    fr: 'Inclut : couleurs de marque, texte, liens, arrière-plans, boutons, typographie, barre latérale, couleurs en-tête/pied de page, couleurs de statut et icônes.',
    es: 'Incluye: colores de marca, texto, enlaces, fondos, botones, tipografía, barra lateral, colores de encabezado/pie, colores de estado e iconos.'
  },
  AI_THEME_HELP_EXCLUDES: {
    en: 'Not changed by AI: page width, logo height, menu alignment, and other header layout options (edit in Site Layout & Header tab).',
    de: 'Nicht von der KI geändert: Seitenbreite, Logo-Höhe, Menüausrichtung und andere Header-Layout-Optionen (im Tab Layout & Header bearbeiten).',
    fr: 'Non modifié par l\'IA : largeur de page, hauteur du logo, alignement du menu et autres options de mise en page d\'en-tête (modifier dans l\'onglet Mise en page & En-tête).',
    es: 'No lo cambia la IA: ancho de página, altura del logo, alineación del menú y otras opciones de diseño del encabezado (editar en la pestaña Diseño y Encabezado).'
  },
  TITLE_CONFIRM_DELETE: { en: 'Confirm Deletion', de: 'Löschen bestätigen', fr: 'Confirmer la suppression', es: 'Confirmar eliminación' },
  TITLE_DELETE_NEWS: { en: 'Delete News Item', de: 'Nachricht löschen', fr: 'Supprimer l\'actualité', es: 'Eliminar noticia' },
  MSG_DELETE_NEWS_CONFIRM: { en: 'Are you sure you want to delete this news item? This action cannot be undone.', de: 'Sind Sie sicher, dass Sie diesen Nachrichtenbeitrag löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.', fr: 'Êtes-vous sûr de vouloir supprimer cet article d\'actualité ? Cette action ne peut pas être annulée.', es: '¿Está seguro de que desea eliminar esta noticia? Esta acción no se puede deshacer.' },
  TITLE_EDIT_PAGE_INFO: { en: 'Edit Page Info', de: 'Seiteninfo bearbeiten', fr: 'Modifier les infos de la page', es: 'Editar información de la página' },
  TITLE_THEME_EDITOR: { en: 'Theme Editor', de: 'Themen-Editor', fr: 'Éditeur de thème', es: 'Editor de temas' },
  TAB_CHOOSE_EXISTING: { en: 'Choose Existing', de: 'Vorhandene auswählen', fr: 'Choisir l\'existant', es: 'Elegir existente' },
  TAB_COPY_PASTE: { en: 'Copy & Paste', de: 'Kopieren & Einfügen', fr: 'Copier & Coller', es: 'Copiar y pegar' },
  PLACEHOLDER_FIRST_NAME: { en: 'First Name', de: 'Vorname', fr: 'Prénom', es: 'Nombre' },
  PLACEHOLDER_LAST_NAME: { en: 'Last Name', de: 'Nachname', fr: 'Nom de famille', es: 'Apellido' },
  LABEL_NEW_SLIDE: { en: 'New Slide', de: 'Neue Folie', fr: 'Nouvelle diapositive', es: 'Nueva diapositiva' },
  MSG_CONFIRM_DELETE_MULTIPLE: { en: 'Are you sure you want to delete {0} items?', de: 'Sind Sie sicher, dass Sie {0} Elemente löschen möchten?', fr: 'Êtes-vous sûr de vouloir supprimer {0} éléments ?', es: '¿Está seguro de que desea eliminar {0} elementos?' },
  MSG_NO_DATA_EXPORT: { en: 'No data to export.', de: 'Keine Daten zum Exportieren.', fr: 'Aucune donnée à exporter.', es: 'No hay datos para exportar.' },
  MSG_NO_CONTACTS_MATCH: { en: 'No contacts match your search.', de: 'Keine Kontakte entsprechen Ihrer Suche.', fr: 'Aucun contact ne correspond à votre recherche.', es: 'Ningún contacto coincide con su búsqueda.' },
  MSG_NO_CONTACTS_YET: { en: 'No contacts added yet.', de: 'Noch keine Kontakte hinzugefügt.', fr: 'Aucun contact n\'a encore été ajouté.', es: 'Aún no se han agregado contactos.' },
  TITLE_SUCCESS: { en: 'Success', de: 'Erfolg', fr: 'Succès', es: 'Éxito' },
  MSG_SUCCESS: { en: '{0} has been updated successfully.', de: '{0} wurde erfolgreich aktualisiert.', fr: '{0} a été mis à jour avec succès.', es: '{0} se ha actualizado con éxito.' },
  MSG_ITEM_TAGGED_SUCCESS: { en: 'Item tagged successfully.', de: 'Element erfolgreich markiert.', fr: 'Élément marqué avec succès.', es: 'Elemento etiquetado correctamente.' },
  MSG_ITEM_UNTAGGED_SUCCESS: { en: 'Item untagged successfully.', de: 'Markierung des Elements erfolgreich entfernt.', fr: 'Marquage de l\'élément supprimé avec succès.', es: 'Etiqueta del elemento eliminada correctamente.' },
  LABEL_TAGGING_CONTAINER: { en: 'Container', de: 'Container', fr: 'Conteneur', es: 'Contenedor' },
  LABEL_TAGGING_PAGE: { en: 'Page', de: 'Seite', fr: 'Page', es: 'Página' },
  PLACEHOLDER_SEARCH_CONTAINER: { en: 'Search Container', de: 'Container suchen', fr: 'Rechercher un conteneur', es: 'Buscar contenedor' },
  PLACEHOLDER_SEARCH_PAGE: { en: 'Search Page', de: 'Seite suchen', fr: 'Rechercher une page', es: 'Buscar página' },
  MSG_NO_CONTAINER_ASSOCIATED: { en: 'No container associated', de: 'Kein Container zugeordnet', fr: 'Aucun conteneur associé', es: 'Ningún contenedor asociado' },
  MSG_NO_PAGE_ASSOCIATED: { en: 'No page associated', de: 'Keine Seite zugeordnet', fr: 'Aucune page associée', es: 'Ninguna página asociada' },
  BTN_EDIT_CONTAINER_ASSOCIATIONS: { en: 'Edit container associations', de: 'Container-Zuordnungen bearbeiten', fr: 'Modifier les associations de conteneurs', es: 'Editar asociaciones de contenedores' },
  BTN_REMOVE_CONTAINER_ASSOCIATION: { en: 'Remove container association', de: 'Container-Zuordnung entfernen', fr: 'Supprimer l\'association de conteneur', es: 'Eliminar asociación de contenedor' },
  BTN_REMOVE_PAGE_ASSOCIATION: { en: 'Remove page association', de: 'Seitenzuordnung entfernen', fr: 'Supprimer l\'association de page', es: 'Eliminar asociación de página' },
  BTN_CONFIRM: { en: 'Continue', de: 'Fortfahren', fr: 'Continuer', es: 'Continuar' },
  MSG_PAGE_ASSOCIATIONS_VIEW_ONLY: { en: 'Page associations are view only', de: 'Seitenzuordnungen sind nur zur Ansicht', fr: 'Les associations de pages sont en lecture seule', es: 'Las asociaciones de página son solo de lectura' },
  TITLE_EDIT_CONTAINER_ASSOCIATIONS: { en: 'Edit Container Associations', de: 'Container-Zuordnungen bearbeiten', fr: 'Modifier les associations de conteneurs', es: 'Editar asociaciones de contenedores' },
  TITLE_ADD_CONTAINER_ASSOCIATIONS: { en: 'Add Container Associations', de: 'Container-Zuordnungen hinzufügen', fr: 'Ajouter des associations de conteneurs', es: 'Agregar asociaciones de contenedores' },
  MSG_CONTAINER_PICKER_SOURCE_HINT: { en: 'Showing containers for this item data source only.', de: 'Es werden nur Container für diese Datenquelle angezeigt.', fr: 'Affichage des conteneurs pour cette source de données uniquement.', es: 'Mostrando solo contenedores para esta fuente de datos.' },
  MSG_CONTAINER_PICKER_UNTAGGED_ONLY: { en: 'Only containers this item is not tagged in are shown.', de: 'Es werden nur Container angezeigt, in denen dieses Element nicht markiert ist.', fr: 'Seuls les conteneurs dans lesquels cet élément n\'est pas marqué sont affichés.', es: 'Solo se muestran contenedores en los que este elemento no está etiquetado.' },
  MSG_NO_UNTAGGED_CONTAINERS: { en: 'No untagged containers available for this data source.', de: 'Keine nicht markierten Container für diese Datenquelle verfügbar.', fr: 'Aucun conteneur non marqué disponible pour cette source de données.', es: 'No hay contenedores sin etiquetar para esta fuente de datos.' },
  MSG_NO_CONTAINERS_FOR_SOURCE: { en: 'No containers found for this data source.', de: 'Keine Container für diese Datenquelle gefunden.', fr: 'Aucun conteneur trouvé pour cette source de données.', es: 'No se encontraron contenedores para esta fuente de datos.' },
  TITLE_CANNOT_REMOVE_PAGE: { en: 'Cannot remove page association', de: 'Seitenzuordnung kann nicht entfernt werden', fr: 'Impossible de supprimer l\'association de page', es: 'No se puede eliminar la asociación de página' },
  MSG_PAGE_REMOVE_BLOCKED: { en: 'This item is still tagged in one or more containers on this page. Remove it from those containers first:', de: 'Dieses Element ist noch in einem oder mehreren Containern auf dieser Seite markiert. Entfernen Sie es zuerst aus diesen Containern:', fr: 'Cet élément est encore marqué dans un ou plusieurs conteneurs sur cette page. Retirez-le d\'abord de ces conteneurs :', es: 'Este elemento aún está etiquetado en uno o más contenedores de esta página. Elimínelo primero de esos contenedores:' },
  TITLE_CONFIRM_REMOVE_PAGE: { en: 'Remove page association?', de: 'Seitenzuordnung entfernen?', fr: 'Supprimer l\'association de page ?', es: '¿Eliminar asociación de página?' },
  MSG_CONFIRM_REMOVE_PAGE: { en: 'Remove association with page "{0}"?', de: 'Zuordnung zur Seite "{0}" entfernen?', fr: 'Supprimer l\'association avec la page « {0} » ?', es: '¿Eliminar asociación con la página "{0}"?' },
  TITLE_CONFIRM_REMOVE_PAGE_TAG: { en: 'Remove page association?', de: 'Seitenzuordnung entfernen?', fr: 'Supprimer l\'association de page ?', es: '¿Eliminar asociación de página?' },
  MSG_PAGE_REMOVE_WITH_CONTAINERS: { en: 'This item is currently tagged in the following containers on "{0}":', de: 'Dieses Element ist derzeit in den folgenden Containern auf "{0}" markiert:', fr: 'Cet élément est actuellement marqué dans les conteneurs suivants sur « {0} » :', es: 'Este elemento está etiquetado actualmente en los siguientes contenedores en "{0}":' },
  MSG_PAGE_REMOVE_AUTO_UNTAG: { en: 'Continuing will automatically remove this item from all containers associated with this page.', de: 'Wenn Sie fortfahren, wird dieses Element automatisch aus allen Containern dieser Seite entfernt.', fr: 'En continuant, cet élément sera automatiquement retiré de tous les conteneurs associés à cette page.', es: 'Al continuar, este elemento se eliminará automáticamente de todos los contenedores asociados con esta página.' },
  MSG_PAGE_REMOVE_SIMPLE: { en: 'Remove the page association for "{0}"?', de: 'Seitenzuordnung für "{0}" entfernen?', fr: 'Supprimer l\'association de page pour « {0} » ?', es: '¿Eliminar la asociación de página para "{0}"?' },
  TITLE_CONFIRM_REMOVE_CONTAINER_TAG: { en: 'Remove container association?', de: 'Container-Zuordnung entfernen?', fr: 'Supprimer l\'association de conteneur ?', es: '¿Eliminar asociación de contenedor?' },
  MSG_CONTAINER_REMOVE_CONFIRM: { en: 'Remove this item from container "{0}" on page "{1}"?', de: 'Dieses Element aus Container "{0}" auf Seite "{1}" entfernen?', fr: 'Retirer cet élément du conteneur « {0} » sur la page « {1} » ?', es: '¿Eliminar este elemento del contenedor "{0}" en la página "{1}"?' },
  BTN_OK: { en: 'OK', de: 'OK', fr: 'OK', es: 'Aceptar' },
  BTN_RESET: { en: 'Reset', de: 'Zurücksetzen', fr: 'Réinitialiser', es: 'Restablecer' },
  PLACEHOLDER_SEARCH_MEMBERS: { en: 'Search members...', de: 'Mitglieder suchen...', fr: 'Rechercher des membres...', es: 'Buscar miembros...' },
  BTN_ADD_MEMBER: { en: 'Add Member', de: 'Mitglied hinzufügen', fr: 'Ajouter un membre', es: 'Agregar miembro' },
  BTN_REMOVE_MEMBER: { en: 'Remove Member', de: 'Mitglied entfernen', fr: 'Supprimer le membre', es: 'Eliminar miembro' },
  PLACEHOLDER_EXACT_USER: { en: 'Search by name or email...', de: 'Nach Name oder E-Mail suchen...', fr: 'Rechercher par nom ou e-mail...', es: 'Buscar por nombre o correo...' },
  PLACEHOLDER_SEARCH_USER: { en: 'Search by name or email...', de: 'Nach Name oder E-Mail suchen...', fr: 'Rechercher par nom ou e-mail...', es: 'Buscar por nombre o correo...' },
  MSG_MULTIPLE_USERS_FOUND: { en: 'Multiple users match. Please select one from the suggestions.', de: 'Mehrere Benutzer gefunden. Bitte wählen Sie einen aus den Vorschlägen.', fr: 'Plusieurs utilisateurs correspondent. Veuillez en sélectionner un dans les suggestions.', es: 'Varios usuarios coinciden. Seleccione uno de las sugerencias.' },
  PLACEHOLDER_ENTER_CAPTCHA: { en: 'Enter CAPTCHA', de: 'CAPTCHA eingeben', fr: 'Saisir le CAPTCHA', es: 'Introducir CAPTCHA' },
  PLACEHOLDER_SEARCH_TRANSLATIONS: { en: 'Search by ID, title, or description...', de: 'Nach ID, Titel oder Beschreibung suchen...', fr: 'Rechercher par ID, titre ou description...', es: 'Buscar por ID, título o descripción...' },
  PLACEHOLDER_ORIGINAL_DESCRIPTION: { en: 'Enter original description...', de: 'Originalbeschreibung eingeben...', fr: 'Saisissez la description originale...', es: 'Ingrese la descripción original...' },
  PLACEHOLDER_URL_GENERIC: { en: 'https://...', de: 'https://...', fr: 'https://...', es: 'https://...' },
  PLACEHOLDER_SEARCH_GALLERY: { en: 'Search gallery...', de: 'Galerie durchsuchen...', fr: 'Rechercher dans la galerie...', es: 'Buscar en la galería...' },
  PLACEHOLDER_SEO_KEYWORDS_EXAMPLE: { en: 'e.g. services, about, contact', de: 'z. B. dienstleistungen, ueber-uns, kontakt', fr: 'ex. services, a-propos, contact', es: 'p. ej. servicios, acerca-de, contacto' },
  PLACEHOLDER_TRANSLATED_TITLE_INPUT: { en: 'Enter translated title...', de: 'Uebersetzten Titel eingeben...', fr: 'Saisir le titre traduit...', es: 'Ingrese el titulo traducido...' },
  PLACEHOLDER_TRANSLATED_DESCRIPTION: { en: 'Enter translated description...', de: 'Uebersetzte Beschreibung eingeben...', fr: 'Saisir la description traduite...', es: 'Ingrese la descripcion traducida...' },
  PLACEHOLDER_PAGE_TITLE_EXAMPLE: { en: 'e.g. Service Details', de: 'z. B. Servicedetails', fr: 'ex. Details du service', es: 'p. ej. detalles del servicio' },
  PLACEHOLDER_LOCATION_SEARCH: { en: 'Enter your municipality or ZIP code...', de: 'Geben Sie Ihre Gemeinde oder PLZ ein...', fr: 'Saisissez votre commune ou code postal...', es: 'Ingrese su municipio o codigo postal...' },
  PLACEHOLDER_SEARCH_IMAGES: { en: 'Search images...', de: 'Bilder suchen...', fr: 'Rechercher des images...', es: 'Buscar imagenes...' },
  PLACEHOLDER_SEARCH_PAGES: { en: 'Search pages...', de: 'Seiten suchen...', fr: 'Rechercher des pages...', es: 'Buscar paginas...' },
  LABEL_TITLE_ENGLISH: { en: 'Title (English)', de: 'Titel (Englisch)', fr: 'Titre (anglais)', es: 'Titulo (ingles)' },
  LABEL_SLUG_URL_PATH: { en: 'Slug (URL Path)', de: 'Slug (URL-Pfad)', fr: 'Slug (chemin URL)', es: 'Slug (ruta URL)' },
  LABEL_SET_AS_HOME: { en: 'Set as Home', de: 'Als Startseite festlegen', fr: 'Definir comme accueil', es: 'Establecer como inicio' },
  LABEL_THUMBNAIL_IMAGE_URL: { en: 'Image URL', de: 'Bild URL', fr: 'URL de l\'image', es: 'URL de la imagen' },
  MSG_CLICK_PASTE_IMAGE: { en: 'Click here and press Ctrl+V (Cmd+V) to paste', de: 'Hier klicken und Strg+V (Cmd+V) zum Einfuegen druecken', fr: 'Cliquez ici puis appuyez sur Ctrl+V (Cmd+V) pour coller', es: 'Haga clic aqui y presione Ctrl+V (Cmd+V) para pegar' },
  TITLE_DELETE_ITEM: { en: 'Delete Item', de: 'Element loeschen', fr: 'Supprimer l element', es: 'Eliminar elemento' },
  MSG_DELETE_NAV_ITEM_CONFIRM: { en: 'Are you sure you want to delete this navigation item? This action will also remove all sub-items and cannot be undone.', de: 'Moechten Sie dieses Navigationselement wirklich loeschen? Diese Aktion entfernt auch alle Unterelemente und kann nicht rueckgaengig gemacht werden.', fr: 'Voulez-vous vraiment supprimer cet element de navigation ? Cette action supprimera aussi tous les sous-elements et ne peut pas etre annulee.', es: 'Seguro que desea eliminar este elemento de navegacion? Esta accion tambien eliminara los subelementos y no se puede deshacer.' },
  TITLE_SELECT_SMARTPAGE: { en: 'Select SmartPage', de: 'SmartPage auswaehlen', fr: 'Selectionner SmartPage', es: 'Seleccionar SmartPage' },
  LABEL_PAGE_TITLE_COLUMN: { en: 'Page Title', de: 'Seitentitel', fr: 'Titre de page', es: 'Titulo de pagina' },
  LABEL_URL_STRUCTURE: { en: 'URL Structure', de: 'URL-Struktur', fr: 'Structure URL', es: 'Estructura URL' },
  MSG_NO_PAGES_MATCHING: { en: 'No pages found matching', de: 'Keine passenden Seiten gefunden fuer', fr: 'Aucune page trouvee pour', es: 'No se encontraron paginas para' },
  TITLE_SELECT_SECTION: { en: 'Select Section', de: 'Abschnitt auswaehlen', fr: 'Selectionner une section', es: 'Seleccionar seccion' },
  LABEL_SECTION_TITLE: { en: 'Section Title', de: 'Abschnittstitel', fr: 'Titre de section', es: 'Titulo de seccion' },
  LABEL_FOUND_ON_PAGE: { en: 'Found on Page', de: 'Gefunden auf Seite', fr: 'Trouve sur la page', es: 'Encontrado en la pagina' },
  TITLE_SELECT_PARENT_ITEM: { en: 'Select Parent Item', de: 'Uebergeordnetes Element auswaehlen', fr: 'Selectionner l element parent', es: 'Seleccionar elemento padre' },
  LABEL_NAV_STRUCTURE: { en: 'Navigation Structure', de: 'Navigationsstruktur', fr: 'Structure de navigation', es: 'Estructura de navegacion' },
  LABEL_PARENT_ITEM: { en: 'Parent Item', de: 'Uebergeordnetes Element', fr: 'Element parent', es: 'Elemento padre' },
  LABEL_VISIBILITY_STATUS: { en: 'Visibility Status', de: 'Sichtbarkeitsstatus', fr: 'Statut de visibilite', es: 'Estado de visibilidad' },
  LABEL_VISIBLE: { en: 'Visible', de: 'Sichtbar', fr: 'Visible', es: 'Visible' },
  LABEL_HIDDEN: { en: 'Hidden', de: 'Versteckt', fr: 'Masque', es: 'Oculto' },
  LABEL_INTERACTION: { en: 'Interaction', de: 'Interaktion', fr: 'Interaction', es: 'Interaccion' },
  LABEL_OPEN_LINK_NEW_TAB: { en: 'Open link in new tab', de: 'Link in neuem Tab oeffnen', fr: 'Ouvrir le lien dans un nouvel onglet', es: 'Abrir enlace en nueva pestana' },
  LABEL_SMART_PAGE_CARD_LINK_TARGET: { en: 'Card title opens in', de: 'Kartentitel oeffnet in', fr: 'Le titre de la carte s\'ouvre dans', es: 'El titulo de la tarjeta se abre en' },
  LABEL_OPEN_IN_CURRENT_TAB: { en: 'Current tab', de: 'Aktuellem Tab', fr: 'Onglet actuel', es: 'Pestana actual' },
  LABEL_OPEN_IN_NEW_TAB: { en: 'New tab', de: 'Neuem Tab', fr: 'Nouvel onglet', es: 'Nueva pestana' },
  LABEL_NAV_TITLE_EN_DEFAULT: { en: 'Navigation Title (English / Default)', de: 'Navigationstitel (Englisch / Standard)', fr: 'Titre de navigation (anglais / par defaut)', es: 'Titulo de navegacion (ingles / predeterminado)' },
  LABEL_LINK_DESTINATION: { en: 'Link Destination', de: 'Link-Ziel', fr: 'Destination du lien', es: 'Destino del enlace' },
  DESC_LINK_SMARTPAGE: { en: 'Connect to an editable CMS page (Home, About, Services). Supports layout builder, versioning and publishing.', de: 'Mit einer bearbeitbaren CMS-Seite verbinden (Startseite, Ueber uns, Services). Unterstuetzt Layout-Builder, Versionierung und Veroeffentlichung.', fr: 'Connectez a une page CMS modifiable (Accueil, A propos, Services). Prend en charge le constructeur de mise en page, le versioning et la publication.', es: 'Conectar a una pagina CMS editable (Inicio, Acerca de, Servicios). Admite constructor de diseno, versionado y publicacion.' },
  DESC_LINK_SECTION: { en: 'Navigate and scroll directly to a specific container/section on a SmartPage.', de: 'Direkt zu einem bestimmten Container/Abschnitt auf einer SmartPage navigieren und scrollen.', fr: 'Naviguez et faites defiler directement vers un conteneur/section specifique sur une SmartPage.', es: 'Navegue y desplacese directamente a un contenedor/seccion especifico en una SmartPage.' },
  MSG_DO_NOT_USE_INTERNAL: { en: 'Do NOT use for internal website pages.', de: 'NICHT fuer interne Webseiten verwenden.', fr: 'Ne pas utiliser pour des pages internes du site.', es: 'NO usar para paginas internas del sitio web.' },
  LABEL_SELECTED_SMARTPAGE: { en: 'Selected SmartPage', de: 'Ausgewaehlte SmartPage', fr: 'SmartPage selectionnee', es: 'SmartPage seleccionada' },
  MSG_SMARTPAGE_REQUIRED: { en: 'A SmartPage must be selected to save.', de: 'Zum Speichern muss eine SmartPage ausgewaehlt werden.', fr: 'Une SmartPage doit etre selectionnee pour enregistrer.', es: 'Debe seleccionar una SmartPage para guardar.' },
  LABEL_SELECTED_SECTION: { en: 'Selected Section', de: 'Ausgewaehlter Abschnitt', fr: 'Section selectionnee', es: 'Seccion seleccionada' },
  MSG_SECTION_REQUIRED: { en: 'A Section must be selected to save.', de: 'Zum Speichern muss ein Abschnitt ausgewaehlt werden.', fr: 'Une section doit etre selectionnee pour enregistrer.', es: 'Debe seleccionar una seccion para guardar.' },
  MSG_NO_ADDITIONAL_LANGUAGES: { en: 'No additional languages configured.', de: 'Keine zusaetzlichen Sprachen konfiguriert.', fr: 'Aucune langue supplementaire configuree.', es: 'No hay idiomas adicionales configurados.' },
  MSG_ADD_LANGUAGES_SITE_MANAGER: { en: 'Add more languages in the Site Manager to enable translations.', de: 'Fuegen Sie im Site Manager weitere Sprachen hinzu, um Uebersetzungen zu aktivieren.', fr: 'Ajoutez plus de langues dans le Site Manager pour activer les traductions.', es: 'Agregue mas idiomas en Site Manager para habilitar traducciones.' },
  MSG_NO_NAV_ITEMS_FOUND: { en: 'No navigation items found.', de: 'Keine Navigationselemente gefunden.', fr: 'Aucun element de navigation trouve.', es: 'No se encontraron elementos de navegacion.' },
  LBL_IMPRINT: { en: 'Imprint', de: 'Impressum', fr: 'Mentions legales', es: 'Aviso legal' },
  LABEL_FOOTER_LOGO: { en: 'Footer Logo', de: 'Footer-Logo', fr: 'Logo de pied de page', es: 'Logo de pie de pagina' },
  LABEL_LOGO_PREVIEW: { en: 'Logo Preview', de: 'Logo-Vorschau', fr: 'Apercu du logo', es: 'Vista previa del logo' },
  LABEL_GALLERY: { en: 'Gallery', de: 'Galerie', fr: 'Galerie', es: 'Galeria' },
  TITLE_FOOTER_TRANSLATIONS: { en: 'Footer Content Translations', de: 'Uebersetzungen fuer Footer-Inhalte', fr: 'Traductions du contenu du pied de page', es: 'Traducciones del contenido del pie de pagina' },
  DESC_FOOTER_TRANSLATIONS: { en: 'Translate footer columns, links, and text for the selected language.', de: 'Uebersetzen Sie Footer-Spalten, Links und Texte fuer die ausgewaehlte Sprache.', fr: 'Traduisez les colonnes, liens et textes du pied de page pour la langue selectionnee.', es: 'Traduzca columnas, enlaces y textos del pie de pagina para el idioma seleccionado.' },
  MSG_SELECT_NON_EN_LANGUAGE: { en: 'Select a non-English language to edit footer translations.', de: 'Waehlen Sie eine andere Sprache als Englisch, um Footer-Uebersetzungen zu bearbeiten.', fr: 'Selectionnez une langue autre que l anglais pour modifier les traductions du pied de page.', es: 'Seleccione un idioma distinto de ingles para editar traducciones del pie de pagina.' },
  BTN_CHECK: { en: 'Check', de: 'Prüfen', fr: 'Vérifier', es: 'Comprobar' },
  TITLE_GROUP_MEMBERSHIPS: { en: 'Group Memberships', de: 'Gruppenmitgliedschaften', fr: 'Appartenance aux groupes', es: 'Membresía de grupo' },
  MSG_NO_MEMBERSHIPS: { en: 'No direct group memberships found.', de: 'Keine direkten Gruppenmitgliedschaften gefunden.', fr: 'Aucune appartenance directe aux groupes trouvée.', es: 'No se encontraron membresías de grupo directas.' },
  MSG_USER_NOT_FOUND_RETRY: { en: 'User not found. Please try again.', de: 'Benutzer nicht gefunden. Bitte versuchen Sie es erneut.', fr: 'Utilisateur non trouvé. Veuillez réessayer.', es: 'Usuario no encontrado. Por favor, inténtelo de nuevo.' },
  LABEL_MEMBERS: { en: 'Members', de: 'Mitglieder', fr: 'Membres', es: 'Miembros' },
  MSG_NO_GROUPS_FOUND: { en: 'No permission groups found.', de: 'Keine Berechtigungsgruppen gefunden.', fr: 'Aucun groupe de permissions trouvé.', es: 'No se encontraron grupos de permisos.' },
  HELP_SLIDE_QUEUE: {
    en: 'Drag with the handle to reorder, or use the arrows for fine-tuning. Duplicate a slide with the copy icon, or edit its content and design.',
    de: 'Ziehen Sie am Griff, um die Reihenfolge zu ändern, oder verwenden Sie die Pfeile zur Feinabstimmung. Duplizieren Sie eine Folie mit dem Kopier-Symbol oder bearbeiten Sie deren Inhalt und Design.',
    fr: 'Faites glisser la poignée pour réorganiser ou utilisez les flèches pour affiner. Dupliquez une diapositive avec l\'icône de copie, ou modifiez son contenu et sa conception.',
    es: 'Arrastre con el controlador para reordenar o use las flechas para ajustar. Duplique una diapositiva con el icono de copiar o edite su contenido y diseño.'
  },
  BTN_FILTERS: { en: 'Filters', de: 'Filter', fr: 'Filtres', es: 'Filtros' },
  HELP_FILTERS_DOCS: { en: 'Search and filter documents by title, status, year, and file type.', de: 'Suchen und filtern Sie Dokumente nach Titel, Status, Jahr und Dateityp.', fr: 'Recherchez et filtrez les documents par titre, statut, année et type de fichier.', es: 'Busque y filtre documentos por título, estado, año y tipo de archivo.' },
  // --- THEME EDITOR LABELS ---
  'THEME_VAR_--primary-color': { en: 'Site Color (Primary)', de: 'Website-Farbe (Primär)', fr: 'Couleur du site (primaire)', es: 'Color del sitio (primario)' },
  'THEME_VAR_--secondary-color': { en: 'Site Color (Secondary)', de: 'Website-Farbe (Sekundär)', fr: 'Couleur du site (secondaire)', es: 'Color del sitio (secundario)' },
  'THEME_VAR_--brand-light': { en: 'Brand Light Accent', de: 'Marke Hell-Akzent', fr: 'Accent clair de marque', es: 'Acento ligero de marca' },
  'THEME_VAR_--brand-dark': { en: 'Brand Dark Accent', de: 'Marke Dunkel-Akzent', fr: 'Accent sombre de marque', es: 'Acento oscuro de marca' },
  'THEME_VAR_--gradient-primary': { en: 'Primary Gradient', de: 'Primärer Verlauf', fr: 'Dégradé primaire', es: 'Degradado primario' },

  'THEME_VAR_--text-primary': { en: 'Body Text Color', de: 'Haupttextfarbe', fr: 'Couleur du texte corporel', es: 'Color de texto del cuerpo' },
  'THEME_VAR_--text-secondary': { en: 'Secondary Text Color', de: 'Sekundärtextfarbe', fr: 'Couleur du texte secondaire', es: 'Color de texto secundario' },
  'THEME_VAR_--text-on-primary': { en: 'Text on Brand Colors', de: 'Text auf Markenfarben', fr: 'Texte sur les couleurs de marque', es: 'Texto en colores de marca' },
  'THEME_VAR_--link-color': { en: 'Global Link Color', de: 'Globale Link-Farbe', fr: 'Couleur des liens globaux', es: 'Color de enlace global' },
  'THEME_VAR_--link-hover-color': { en: 'Link Hover Color', de: 'Link-Hover-Farbe', fr: 'Couleur de survol des liens', es: 'Color de enlace al pasar el mouse' },

  'THEME_VAR_--bg-body': { en: 'Page Background', de: 'Seitenhintergrund', fr: 'Fond de page', es: 'Fondo de página' },
  'THEME_VAR_--bg-hover': { en: 'Hover Background', de: 'Hover-Hintergrund', fr: 'Fond de survol', es: 'Fondo de desplazamiento' },

  'THEME_VAR_--btn-primary-bg': { en: 'Primary Button Background', de: 'Primär-Button Hintergrund', fr: 'Fond du bouton principal', es: 'Fondo del botón principal' },
  'THEME_VAR_--btn-primary-text': { en: 'Primary Button Text', de: 'Primär-Button Text', fr: 'Texte du bouton principal', es: 'Texto del bouton principal' },
  'THEME_VAR_--btn-primary-hover-bg': { en: 'Primary Button Hover', de: 'Primär-Button Hover', fr: 'Survol du bouton principal', es: 'Botón principal al pasar el mouse' },
  'THEME_VAR_--btn-secondary-bg': { en: 'Secondary Button BG', de: 'Sekundär-Button Hintergrund', fr: 'Fond du bouton secondaire', es: 'Fondo del botón secundario' },
  'THEME_VAR_--btn-secondary-text': { en: 'Secondary Button Text', de: 'Sekundär-Button Text', fr: 'Texte du bouton secondaire', es: 'Texto del botón secundario' },
  'THEME_VAR_--btn-padding-x': { en: 'Button Padding (Side)', de: 'Button Polsterung (Seite)', fr: 'Marge bouton (côté)', es: 'Margen de botón (lado)' },
  'THEME_VAR_--btn-padding-y': { en: 'Button Padding (Top)', de: 'Button Polsterung (Oben)', fr: 'Marge bouton (haut)', es: 'Margen de botón (arriba)' },
  'THEME_VAR_--btn-font-size': { en: 'Button Font Size', de: 'Button Schriftgröße', fr: 'Taille police bouton', es: 'Tamaño fuente botón' },
  'THEME_VAR_--add-section-btn-bg': { en: 'Add Section Button Background', de: 'Abschnitt-Button Hintergrund', fr: 'Fond du bouton Ajouter section', es: 'Fondo del botón Agregar sección' },
  'THEME_VAR_--add-section-btn-text': { en: 'Add Section Button Text', de: 'Abschnitt-Button Text', fr: 'Texte du bouton Ajouter section', es: 'Texto del botón Agregar sección' },
  'THEME_VAR_--add-section-btn-hover-bg': { en: 'Add Section Button Hover', de: 'Abschnitt-Button Hover', fr: 'Survol du bouton Ajouter section', es: 'Botón Agregar sección al pasar el mouse' },
  'THEME_VAR_--add-section-btn-font-size': { en: 'Add Section Button Font Size', de: 'Abschnitt-Button Schriftgröße', fr: 'Taille police bouton Ajouter section', es: 'Tamaño fuente botón Agregar sección' },
  'THEME_VAR_--add-section-btn-padding-x': { en: 'Add Section Button Padding (Side)', de: 'Abschnitt-Button Polsterung (Seite)', fr: 'Marge bouton Ajouter section (côté)', es: 'Margen botón Agregar sección (lado)' },
  'THEME_VAR_--add-section-btn-padding-y': { en: 'Add Section Button Padding (Top)', de: 'Abschnitt-Button Polsterung (Oben)', fr: 'Marge bouton Ajouter section (haut)', es: 'Margen botón Agregar sección (arriba)' },
  'THEME_VAR_--add-section-line-color': { en: 'Add Section Line Color', de: 'Abschnitt-Linie Farbe', fr: 'Couleur de la ligne Ajouter section', es: 'Color de línea Agregar sección' },
  'THEME_VAR_--add-section-line-thickness': { en: 'Add Section Line Thickness', de: 'Abschnitt-Linie Dicke', fr: 'Épaisseur de la ligne Ajouter section', es: 'Grosor de línea Agregar sección' },

  'THEME_VAR_--heading-color': { en: 'Global Heading Color', de: 'Globale Überschriftenfarbe', fr: 'Couleur de titre globale', es: 'Color de encabezado global' },
  'THEME_VAR_--font-import-url': { en: 'Typography Font URL', de: 'Typografie Schrift-URL', fr: 'URL de police de typographie', es: 'URL de fuente de tipografía' },
  'THEME_VAR_--font-import-url-2': { en: 'Typography Font URL 2', de: 'Typografie Schrift-URL 2', fr: 'URL de police de typographie 2', es: 'URL de fuente de tipografía 2' },
  'THEME_VAR_--font-family-base': { en: 'Base Font Family', de: 'Haupt-Schriftfamilie', fr: 'Famille de polices de base', es: 'Familia de fuentes base' },
  'THEME_VAR_--font-family-secondary': { en: 'Heading Font Family', de: 'Überschrift-Schriftfamilie', fr: 'Famille de polices de titre', es: 'Familia de fuentes de título' },
  'THEME_VAR_--font-family-nav': { en: 'Navigation Font Family', de: 'Navigations-Schriftfamilie', fr: 'Famille de polices de navigation', es: 'Familia de fuentes de navegación' },
  'THEME_VAR_--font-size-base': { en: 'Global Font Size', de: 'Globale Schriftgröße', fr: 'Taille de police globale', es: 'Tamaño de fuente global' },
  'THEME_VAR_--font-size-p': { en: 'Paragraph Font Size', de: 'Absatz-Schriftgröße', fr: 'Taille police paragraphe', es: 'Tamaño fuente párrafo' },
  'THEME_VAR_--font-weight-bold': { en: 'Global Bold Weight', de: 'Globales Fettgewicht', fr: 'Poids gras global', es: 'Peso en negrita global' },

  'THEME_VAR_--sidebar-bg': { en: 'Sidebar Background', de: 'Sidebar Hintergrund', fr: 'Fond de la barre latérale', es: 'Fondo de la barra lateral' },
  'THEME_VAR_--sidebar-text': { en: 'Sidebar Text', de: 'Sidebar Textfarbe', fr: 'Texte de la barre latérale', es: 'Texto de la barra lateral' },
  'THEME_VAR_--sidebar-text-muted': { en: 'Sidebar Muted Text', de: 'Sidebar Gedämpfter Text', fr: 'Texte atténué de la barre latérale', es: 'Texto silenciado de la barra lateral' },
  'THEME_VAR_--sidebar-border-color': { en: 'Sidebar Border', de: 'Sidebar Rahmenfarbe', fr: 'Bordure de la barre latérale', es: 'Borde de la barra lateral' },
  'THEME_VAR_--sidebar-icon-color': { en: 'Sidebar Icon Color', de: 'Sidebar Symbolfarbe', fr: 'Couleur d’icône de barre latérale', es: 'Color de icono de la barra lateral' },
  'THEME_VAR_--sidebar-active-bg': { en: 'Sidebar Active Item', de: 'Sidebar Aktives Element', fr: 'Élément actif de la barre latérale', es: 'Elemento activo de la barra lateral' },
  'THEME_VAR_--sidebar-active-text-color': { en: 'Sidebar Active Text', de: 'Sidebar Aktiver Text', fr: 'Texte actif de la barre latérale', es: 'Texto activo de la barra lateral' },
  'THEME_VAR_--sidebar-active-indicator-color': { en: 'Sidebar Indicator', de: 'Sidebar Indikatorfarbe', fr: 'Indicateur de la barre latérale', es: 'Indicador de la barra lateral' },
  'THEME_VAR_--sidebar-hover-bg': { en: 'Sidebar Hover Color', de: 'Sidebar Hover-Farbe', fr: 'Survol de la barre latérale', es: 'Barra lateral al pasar el mouse' },
  'THEME_VAR_--sidebar-button-color': { en: 'Sidebar Switcher Color', de: 'Sidebar Umschalter-Farbe', fr: 'Couleur du sélecteur latéral', es: 'Color del selector lateral' },
  'THEME_VAR_--sidebar-link-color': { en: 'Sidebar Link Color', de: 'Sidebar Link-Farbe', fr: 'Lien de la barre latérale', es: 'Enlace de la barra lateral' },
  'THEME_VAR_--sidebar-link-hover-color': { en: 'Sidebar Link Hover', de: 'Sidebar Link-Hover', fr: 'Survol du lien latéral', es: 'Enlace lateral al pasar el mouse' },

  'THEME_VAR_--header-bg': { en: 'Header Background', de: 'Header Hintergrund', fr: 'Fond de l’en-tête', es: 'Fondo del encabezado' },
  'THEME_VAR_--footer-bg': { en: 'Footer Background', de: 'Footer Hintergrund', fr: 'Fond du pied de page', es: 'Fondo del pie de página' },
  'THEME_VAR_--header-max-width': { en: 'Header Max Width', de: 'Header Max. Breite', fr: 'Largeur max de l’en-tête', es: 'Ancho máximo del encabezado' },
  'THEME_VAR_--logo-width': { en: 'Logo Target Width', de: 'Logo-Breite', fr: 'Largeur du logo', es: 'Ancho del logo' },
  'THEME_VAR_--footer-heading-color': { en: 'Footer Heading Color', de: 'Footer Überschriftenfarbe', fr: 'Couleur de titre du pied de page', es: 'Color de encabezado del pie de página' },
  'THEME_VAR_--footer-text-color': { en: 'Footer Text Color', de: 'Footer Textfarbe', fr: 'Couleur texte pied de page', es: 'Color de texto del pie de página' },

  'THEME_VAR_--border-radius-sm': { en: 'Border Radius (Small)', de: 'Eckenradius (Klein)', fr: 'Rayon des coins (Petit)', es: 'Radio de borde (Pequeño)' },
  'THEME_VAR_--border-radius-md': { en: 'Border Radius (Medium)', de: 'Eckenradius (Mittel)', fr: 'Rayon des coins (Moyen)', es: 'Radio de borde (Mediano)' },
  'THEME_VAR_--border-radius-lg': { en: 'Border Radius (Large)', de: 'Eckenradius (Groß)', fr: 'Rayon des coins (Grand)', es: 'Radio de borde (Grande)' },
  'THEME_VAR_--border-color': { en: 'UI Border Color', de: 'UI Rahmenfarbe', fr: 'Couleur de bordure UI', es: 'Color de borde de la interfaz' },

  'THEME_VAR_--status-success': { en: 'Success States', de: 'Erfolgszustände', fr: 'États de réussite', es: 'Estados de éxito' },
  'THEME_VAR_--status-warning': { en: 'Warning States', de: 'Warnzustände', fr: 'États d’avertissement', es: 'Estados de advertencia' },
  'THEME_VAR_--status-error': { en: 'Error States', de: 'Fehlerzustände', fr: 'États d’erreur', es: 'Estados de error' },

  'THEME_VAR_--icon-color': { en: 'General Icon Color', de: 'Symbolfarbe', fr: 'Couleur d’icône', es: 'Color de icono' },
  'THEME_VAR_--edit-icon-bg': { en: 'Edit Trigger Background', de: 'Bearbeitungs-Trigger Hintergrund', fr: 'Fond de déclencheur d’édition', es: 'Fondo del activador de edición' },
  'THEME_VAR_--edit-icon-color': { en: 'Edit Trigger Color', de: 'Bearbeitungs-Trigger Farbe', fr: 'Couleur de déclencheur d’édition', es: 'Color del activador de edición' },
  'THEME_VAR_--edit-icon-hover-bg': { en: 'Edit Trigger Hover', de: 'Bearbeitungs-Trigger Hover', fr: 'Survol de déclencheur d’édition', es: 'Activador de edición al pasar el mouse' },

  'THEME_VAR_--heading-h1-color': { en: 'Heading 1 Color', de: 'Überschrift 1 Farbe', fr: 'Couleur titre 1', es: 'Color encabezado 1' },
  'THEME_VAR_--heading-h2-color': { en: 'Heading 2 Color', de: 'Überschrift 2 Farbe', fr: 'Couleur titre 2', es: 'Color encabezado 2' },
  'THEME_VAR_--heading-h3-color': { en: 'Heading 3 Color', de: 'Überschrift 3 Farbe', fr: 'Couleur titre 3', es: 'Color encabezado 3' },
  'THEME_VAR_--heading-h4-color': { en: 'Heading 4 Color', de: 'Überschrift 4 Farbe', fr: 'Couleur titre 4', es: 'Color encabezado 4' },
  'THEME_VAR_--heading-h5-color': { en: 'Heading 5 Color', de: 'Überschrift 5 Farbe', fr: 'Couleur titre 5', es: 'Color encabezado 5' },
  'THEME_VAR_--heading-h6-color': { en: 'Heading 6 Color', de: 'Überschrift 6 Farbe', fr: 'Couleur titre 6', es: 'Color encabezado 6' },
  'THEME_VAR_--font-size-h1': { en: 'Heading 1 Font Size', de: 'Überschrift 1 Schriftgröße', fr: 'Taille police titre 1', es: 'Tamaño fuente encabezado 1' },
  'THEME_VAR_--font-size-h2': { en: 'Heading 2 Font Size', de: 'Überschrift 2 Schriftgröße', fr: 'Taille police titre 2', es: 'Tamaño fuente encabezado 2' },
  'THEME_VAR_--font-size-h3': { en: 'Heading 3 Font Size', de: 'Überschrift 3 Schriftgröße', fr: 'Taille police titre 3', es: 'Tamaño fuente encabezado 3' },
  'THEME_VAR_--font-size-h4': { en: 'Heading 4 Font Size', de: 'Überschrift 4 Schriftgröße', fr: 'Taille police titre 4', es: 'Tamaño fuente encabezado 4' },
  'THEME_VAR_--font-size-h5': { en: 'Heading 5 Font Size', de: 'Überschrift 5 Schriftgröße', fr: 'Taille police titre 5', es: 'Tamaño fuente encabezado 5' },
  'THEME_VAR_--font-size-h6': { en: 'Heading 6 Font Size', de: 'Überschrift 6 Schriftgröße', fr: 'Taille police titre 6', es: 'Tamaño fuente encabezado 6' },

  'THEME_GROUP_AI_THEME': { en: 'AI Theme Generation', de: 'KI-Theme-Generierung', fr: 'Génération de thème IA', es: 'Generación de temas con IA' },
  'THEME_GROUP_BRANDING': { en: 'Colors & Branding', de: 'Farben & Branding', fr: 'Couleurs & Design', es: 'Colores y Diseño' },
  'THEME_GROUP_SITE_LAYOUT': { en: 'Site Layout & Header', de: 'Layout & Header', fr: 'Mise en page & En-tête', es: 'Diseño y Encabezado' },
  'THEME_GROUP_TYPOGRAPHY': { en: 'Typography & Fonts', de: 'Typografie & Schrift', fr: 'Typographie & Polices', es: 'Tipografía y Fuentes' },
  'THEME_GROUP_BUTTONS': { en: 'Buttons & UI Elements', de: 'Buttons & Oberflächen', fr: 'Boutons & Éléments UI', es: 'Botones y Elementos UI' },
  'THEME_GROUP_STATUS': { en: 'System Status Colors', de: 'System-Status Farben', fr: 'Couleurs de statut système', es: 'Colores de estado del sistema' },
  'THEME_GROUP_ICONS': { en: 'Icons & Administrative', de: 'Symbole & Verwaltung', fr: 'Icônes & Administration', es: 'Iconos y Administración' },
  'THEME_GROUP_SIDEBAR': { en: 'Sidebar Navigation', de: 'Sidebar Navigation', fr: 'Barre latérale', es: 'Barra lateral' },
  'THEME_GROUP_HELP': { en: 'Help & Knowledge Base', de: 'Hilfe & Wissen', fr: 'Aide & Base de connaissances', es: 'Ayuda y Conocimiento' },

  // --- NAVIGATION MANAGER HELP GUIDE ---
  HELP_NAV_INTRO: {
    en: 'Welcome to the Navigation Manager! This tool allows you to create, edit, delete, and reorder the items in the main navigation bar of your project. You can manage multiple levels of navigation, including dropdowns and flyout menus.',
    de: 'Willkommen im Navigationsmanager! Dieses Tool ermöglicht es Ihnen, die Elemente in der Hauptnavigationsleiste Ihres Projekts zu erstellen, zu bearbeiten, zu löschen und neu zu sortieren. Sie können mehrere Navigationsebenen verwalten, einschließlich Dropdowns und Flyout-Menüs.',
    fr: 'Bienvenue dans le Gestionnaire de navigation ! Cet outil vous permet de créer, modifier, supprimer et réorganiser les éléments de la barre de navigation principale de votre projet. Vous pouvez gérer plusieurs niveaux de navigation, y compris les menus déroulants et les menus flyout.',
    es: '¡Bienvenido al Gestor de Navegación! Esta herramienta le permite crear, editar, eliminar y reordenar los elementos de la barra de navegación principal de su proyecto. Puede gestionar múltiples niveles de navegación, incluidos menús desplegables y menús flyout.'
  },
  HELP_NAV_VIEWING_MODES_TITLE: {
    en: 'Viewing Modes',
    de: 'Anzeigemodi',
    fr: 'Modes d\'affichage',
    es: 'Modos de visualización'
  },
  HELP_NAV_VIEWING_MODES_DESC: {
    en: 'You can manage navigation items in two different ways. Use the toggle buttons at the top right to switch between them.',
    de: 'Sie können Navigationselemente auf zwei verschiedene Arten verwalten. Verwenden Sie die Umschalter oben rechts, um zwischen ihnen zu wechseln.',
    fr: 'Vous pouvez gérer les éléments de navigation de deux manières différentes. Utilisez les boutons bascule en haut à droite pour passer de l\'un à l\'autre.',
    es: 'Puede gestionar los elementos de navegación de dos maneras diferentes. Use los botones de alternancia en la parte superior derecha para cambiar entre ellos.'
  },
  HELP_NAV_VISUAL_VIEW_DESC: {
    en: 'This view mimics the actual appearance of the top navigation bar, allowing you to interact with dropdown menus directly.',
    de: 'Diese Ansicht imitiert das tatsächliche Aussehen der oberen Navigationsleiste und ermöglicht die direkte Interaktion mit Dropdown-Menüs.',
    fr: 'Cette vue imite l\'apparence réelle de la barre de navigation supérieure, vous permettant d\'interagir directement avec les menus déroulants.',
    es: 'Esta vista imita la apariencia real de la barra de navegación superior, lo que le permite interactuar directamente con los menús desplegables.'
  },
  HELP_NAV_LIST_VIEW_DESC: {
    en: 'This view displays all navigation items in a hierarchical list, which can be useful for seeing the entire structure at a glance.',
    de: 'Diese Ansicht zeigt alle Navigationselemente in einer hierarchischen Liste an, was es ermöglicht, die gesamte Struktur auf einen Blick zu sehen.',
    fr: 'Cette vue affiche tous les éléments de navigation dans une liste hiérarchique, ce qui peut être utile pour voir l\'ensemble de la structure en un coup d\'œil.',
    es: 'Esta vista muestra todos los elementos de navegación en una lista jerárquica, lo que puede ser útil para ver toda la estructura de un vistazo.'
  },
  HELP_NAV_ADDING_EDITING_TITLE: {
    en: 'Adding & Editing Items',
    de: 'Elemente hinzufügen & bearbeiten',
    fr: 'Ajouter & modifier des éléments',
    es: 'Agregar y editar elementos'
  },
  HELP_NAV_ADDING_EDITING_DESC1: {
    en: 'To add a new top-level item, click the main "+ Add Level" button. To add a sub-item, hover over its intended parent in Visual View to open the dropdown, then click the "+ Add Level" button inside. In List View, the top-level button adds to the root.',
    de: 'Um ein neues Element der obersten Ebene hinzuzufügen, klicken Sie auf die Schaltfläche "+ Ebene hinzufügen". Um ein Unterelement hinzuzufügen, fahren Sie in der visuellen Ansicht über das übergeordnete Element, um das Dropdown zu öffnen, und klicken Sie dann auf die Schaltfläche "+ Ebene hinzufügen". In der Listenansicht fügt die Schaltfläche der obersten Ebene dem Stammverzeichnis hinzu.',
    fr: 'Pour ajouter un élément de niveau supérieur, cliquez sur le bouton principal "+ Ajouter un niveau". Pour ajouter un sous-élément, survolez son parent prévu dans la vue visuelle pour ouvrir le menu déroulant, puis cliquez sur le bouton "+ Ajouter un niveau" à l\'intérieur. Dans la vue liste, le bouton de niveau supérieur ajoute à la racine.',
    es: 'Para agregar un nuevo elemento de nivel superior, haga clic en el botón principal "+ Agregar nivel". Para agregar un subelemento, pase el cursor sobre el elemento padre en la Vista Visual para abrir el menú desplegable, luego haga clic en el botón "+ Agregar nivel" dentro de él. En la Vista de Lista, el botón de nivel superior agrega a la raíz.'
  },
  HELP_NAV_ADDING_EDITING_DESC2: {
    en: 'To edit an item, simply click on its title or the pencil icon next to it. This will open the edit panel.',
    de: 'Um ein Element zu bearbeiten, klicken Sie einfach auf seinen Titel oder das Bleistift-Symbol daneben. Dadurch wird das Bearbeitungspanel geöffnet.',
    fr: 'Pour modifier un élément, cliquez simplement sur son titre ou sur l\'icône crayon à côté de lui. Cela ouvrira le panneau d\'édition.',
    es: 'Para editar un elemento, simplemente haga clic en su título o en el ícono de lápiz junto a él. Esto abrirá el panel de edición.'
  },
  HELP_NAV_EDIT_PANEL_INTRO: {
    en: 'In the edit panel, you can change the item\'s:',
    de: 'Im Bearbeitungspanel können Sie Folgendes ändern:',
    fr: 'Dans le panneau d\'édition, vous pouvez modifier :',
    es: 'En el panel de edición, puede cambiar:'
  },
  HELP_NAV_PARENT_DESC: {
    en: 'Change where the item appears in the hierarchy.',
    de: 'Ändern Sie, wo das Element in der Hierarchie erscheint.',
    fr: 'Modifiez l\'emplacement de l\'élément dans la hiérarchie.',
    es: 'Cambie dónde aparece el elemento en la jerarquía.'
  },
  HELP_NAV_VISIBILITY_DESC: {
    en: 'Show or hide the item from the final navigation.',
    de: 'Das Element in der endgültigen Navigation ein- oder ausblenden.',
    fr: 'Affichez ou masquez l\'élément dans la navigation finale.',
    es: 'Muestre u oculte el elemento en la navegación final.'
  },
  HELP_NAV_TITLE_FIELD_DESC: {
    en: 'The text displayed for the link.',
    de: 'Der angezeigte Text für den Link.',
    fr: 'Le texte affiché pour le lien.',
    es: 'El texto que se muestra para el enlace.'
  },
  HELP_NAV_URL_DESC: {
    en: 'The destination link. You can select from a list of existing pages or enter one manually.',
    de: 'Der Ziel-Link. Sie können aus einer Liste vorhandener Seiten auswählen oder einen manuell eingeben.',
    fr: 'Le lien de destination. Vous pouvez sélectionner dans une liste de pages existantes ou en saisir un manuellement.',
    es: 'El enlace de destino. Puede seleccionar de una lista de páginas existentes o ingresar uno manualmente.'
  },
  HELP_NAV_REORDER_TITLE: {
    en: 'Reordering Items (Drag & Drop)',
    de: 'Elemente neu anordnen (Drag & Drop)',
    fr: 'Réorganiser les éléments (Glisser-déposer)',
    es: 'Reordenar elementos (Arrastrar y soltar)'
  },
  HELP_NAV_REORDER_DESC: {
    en: 'You can change the order of items that share the same parent. Click and hold the drag handle on an item, then drag it up or down. A blue line will indicate where the item will be placed when you release it.',
    de: 'Sie können die Reihenfolge von Elementen ändern, die denselben übergeordneten Knoten teilen. Klicken und halten Sie den Ziehpunkt eines Elements und ziehen Sie es nach oben oder unten. Eine blaue Linie zeigt an, wo das Element platziert wird, wenn Sie es loslassen.',
    fr: 'Vous pouvez modifier l\'ordre des éléments qui partagent le même parent. Cliquez et maintenez la poignée de glissement d\'un élément, puis faites-le glisser vers le haut ou vers le bas. Une ligne bleue indiquera où l\'élément sera placé lorsque vous le relâcherez.',
    es: 'Puede cambiar el orden de los elementos que comparten el mismo padre. Haga clic y mantenga presionado el controlador de arrastre en un elemento, luego arrástrelo hacia arriba o hacia abajo. Una línea azul indicará dónde se colocará el elemento cuando lo suelte.'
  },
  HELP_NAV_DELETE_TITLE: {
    en: 'Deleting Items',
    de: 'Elemente löschen',
    fr: 'Supprimer des éléments',
    es: 'Eliminar elementos'
  },
  HELP_NAV_DELETE_DESC: {
    en: 'To delete an item, open its edit panel and click the "Delete this item" link at the bottom left.',
    de: 'Um ein Element zu löschen, öffnen Sie dessen Bearbeitungspanel und klicken Sie unten links auf den Link "Dieses Element löschen".',
    fr: 'Pour supprimer un élément, ouvrez son panneau d\'édition et cliquez sur le lien "Supprimer cet élément" en bas à gauche.',
    es: 'Para eliminar un elemento, abra su panel de edición y haga clic en el enlace "Eliminar este elemento" en la parte inferior izquierda.'
  },
  HELP_NAV_DELETE_WARNING: {
    en: 'Deleting an item will also permanently delete all of its children (sub-items). This action cannot be undone.',
    de: 'Das Löschen eines Elements löscht auch dauerhaft alle seine Kindelemente (Unterelemente). Diese Aktion kann nicht rückgängig gemacht werden.',
    fr: 'La suppression d\'un élément supprimera également définitivement tous ses enfants (sous-éléments). Cette action ne peut pas être annulée.',
    es: 'Eliminar un elemento también eliminará permanentemente todos sus hijos (subelementos). Esta acción no se puede deshacer.'
  },
  LABEL_PARENT: {
    en: 'Parent',
    de: 'Übergeordnet',
    fr: 'Parent',
    es: 'Padre'
  },
  LABEL_VISIBILITY: {
    en: 'Visibility',
    de: 'Sichtbarkeit',
    fr: 'Visibilité',
    es: 'Visibilidad'
  },
  LABEL_WARNING: {
    en: 'Warning',
    de: 'Warnung',
    fr: 'Avertissement',
    es: 'Advertencia'
  },
  TH_NO: { en: 'No', de: 'Nr.', fr: 'N°', es: 'No.' },
  LABEL_INFO: { en: 'Info', de: 'Info', fr: 'Info', es: 'Info' },
  LABEL_MODIFIED_BY: { en: 'Modified by', de: 'Geändert von', fr: 'Modifié par', es: 'Modificado por' },
  MSG_VERSION_LOAD_ERROR: { en: 'Could not load version history from SharePoint.', de: 'Versionsverlauf konnte nicht aus SharePoint geladen werden.', fr: 'Impossible de charger l\'historique des versions depuis SharePoint.', es: 'No se pudo cargar el historial de versiones desde SharePoint.' },
  MSG_VERSION_NO_CONTEXT: { en: 'Select a page and open version history again, or use it from Site Management while a page is selected.', de: 'Wählen Sie eine Seite aus und öffnen Sie den Versionsverlauf erneut, oder verwenden Sie ihn in der Seitenverwaltung, während eine Seite ausgewählt ist.', fr: 'Sélectionnez une page et ouvrez à nouveau l\'historique des versions, ou utilisez-le depuis la gestion du site lorsqu\'une page est sélectionnée.', es: 'Seleccione una página y vuelva a abrir el historial de versiones, o úselo desde la administración del sitio mientras se selecciona una página.' },
  MSG_NO_VERSIONS: { en: 'No version history found.', de: 'Kein Versionsverlauf gefunden.', fr: 'Aucun historique de version trouvé.', es: 'No se encontró historial de versiones.' },
  MSG_NO_DETAILS: { en: 'No tracked changes', de: 'Keine nachverfolgten Änderungen', fr: 'Aucune modification suivie', es: 'Sin cambios rastreados' },
  MSG_EDITING_CONNECTED: { en: 'Editing Connected Item...', de: 'Verbundenes Element wird bearbeitet...', fr: 'Édition de l\'élément connecté...', es: 'Editando elemento conectado...' },
  TITLE_HELP_GUIDE: { en: 'Help Guide', de: 'Hilfe-Leitfaden', fr: 'Guide d\'aide', es: 'Guía de ayuda' },
  TITLE_INTRODUCTION: { en: 'Introduction', de: 'Einführung', fr: 'Introduction', es: 'Introducción' },
  TITLE_HOW_IT_WORKS: { en: 'Your Guide to Global Styling', de: 'Ihr Leitfaden für globales Styling', fr: 'Votre guide du style global', es: 'Su guía de estilo global' },
  DESC_HOW_IT_WORKS: {
    en: 'The Global Style Editor lets you control how your entire website looks — colours, fonts, buttons, header, footer, and more — from one place. You do not need any technical or coding knowledge. Changes you make here apply across your whole site so everything stays consistent and on-brand.',
    de: 'Der globale Style-Editor steuert das Erscheinungsbild Ihrer gesamten Website — Farben, Schriften, Buttons, Header, Footer und mehr — an einem Ort. Sie benötigen keine technischen oder Programmierkenntnisse. Änderungen gelten siteweit, damit alles einheitlich und markenkonform bleibt.',
    fr: 'L\'éditeur de style global vous permet de contrôler l\'apparence de tout votre site — couleurs, polices, boutons, en-tête, pied de page et plus — depuis un seul endroit. Aucune connaissance technique n\'est requise. Les modifications s\'appliquent à l\'ensemble du site pour une cohérence visuelle.',
    es: 'El editor de estilo global le permite controlar el aspecto de todo su sitio — colores, fuentes, botones, encabezado, pie de página y más — desde un solo lugar. No necesita conocimientos técnicos. Los cambios se aplican en todo el sitio para mantener coherencia visual.'
  },
  TITLE_HELP_GETTING_STARTED: { en: 'Getting Started — 5 Simple Steps', de: 'Erste Schritte — 5 einfache Schritte', fr: 'Premiers pas — 5 étapes simples', es: 'Primeros pasos — 5 pasos sencillos' },
  HELP_STEP_1: { en: 'Open the tab you want to change (for example, Colours & Branding for your main brand colour).', de: 'Öffnen Sie den gewünschten Tab (z. B. Farben & Branding für Ihre Hauptfarbe).', fr: 'Ouvrez l\'onglet à modifier (par ex. Couleurs & Design pour votre couleur principale).', es: 'Abra la pestaña que desea cambiar (por ejemplo, Colores y diseño para su color principal).' },
  HELP_STEP_2: { en: 'Adjust the settings using the colour pickers, dropdowns, and text fields. Hover the info icon (ℹ) next to any label for a short explanation.', de: 'Passen Sie die Einstellungen mit Farbwähler, Dropdowns und Textfeldern an. Fahren Sie mit der Maus über das Info-Symbol (ℹ) neben einer Bezeichnung für eine kurze Erklärung.', fr: 'Ajustez les paramètres avec les sélecteurs de couleur, listes et champs texte. Survolez l\'icône info (ℹ) à côté d\'un libellé pour une explication.', es: 'Ajuste los valores con selectores de color, listas y campos de texto. Pase el cursor sobre el icono de información (ℹ) junto a cada etiqueta para una breve explicación.' },
  HELP_STEP_3: { en: 'Watch the Live Preview on the right — it updates instantly so you can see exactly how your site will look.', de: 'Beobachten Sie die Live-Vorschau rechts — sie aktualisiert sich sofort, damit Sie das Ergebnis sehen.', fr: 'Regardez l\'aperçu en direct à droite — il se met à jour instantanément pour voir le résultat.', es: 'Observe la vista previa en vivo a la derecha — se actualiza al instante para ver el resultado.' },
  HELP_STEP_4: { en: 'Try AI Theme Generation (first tab) to create a complete look from a short description, then fine-tune individual settings if needed.', de: 'Nutzen Sie KI-Theme-Generierung (erster Tab), um aus einer kurzen Beschreibung ein vollständiges Design zu erstellen, und verfeinern Sie bei Bedarf einzelne Einstellungen.', fr: 'Essayez la génération de thème IA (premier onglet) pour créer un style complet à partir d\'une description, puis affinez si nécessaire.', es: 'Pruebe la generación de temas con IA (primera pestaña) para crear un aspecto completo desde una descripción y ajuste después si hace falta.' },
  HELP_STEP_5: { en: 'When you are happy with the result, click Save Configuration at the bottom. Until you save, changes are only a preview inside this editor.', de: 'Wenn Sie zufrieden sind, klicken Sie unten auf Konfiguration speichern. Bis zum Speichern sind Änderungen nur eine Vorschau in diesem Editor.', fr: 'Quand le résultat vous convient, cliquez sur Enregistrer la configuration en bas. Avant cela, les changements ne sont qu\'un aperçu dans cet éditeur.', es: 'Cuando esté satisfecho, haga clic en Guardar configuración abajo. Hasta guardar, los cambios son solo una vista previa en este editor.' },
  TITLE_HELP_TABS_GUIDE: { en: 'What Each Section Does', de: 'Was jeder Bereich bewirkt', fr: 'Rôle de chaque section', es: 'Qué hace cada sección' },
  HELP_TAB_AI_THEME: { en: 'AI Theme Generation — Describe the mood you want (e.g. modern education site) and let AI build a full colour and font theme for your whole site in one click.', de: 'KI-Theme-Generierung — Beschreiben Sie die gewünschte Stimmung (z. B. modernes Bildungsportal) und die KI erstellt mit einem Klick ein vollständiges Farb- und Schrift-Theme.', fr: 'Génération de thème IA — Décrivez l\'ambiance souhaitée et l\'IA crée en un clic un thème complet de couleurs et polices.', es: 'Generación de temas con IA — Describa el estilo deseado y la IA crea con un clic un tema completo de colores y fuentes.' },
  HELP_TAB_BRANDING: { en: 'Colours & Branding — Set your main brand colours, page background, text colours, and link colours.', de: 'Farben & Branding — Hauptmarkenfarben, Seitenhintergrund, Text- und Linkfarben festlegen.', fr: 'Couleurs & Design — Définissez les couleurs de marque, le fond de page, les textes et les liens.', es: 'Colores y diseño — Defina colores de marca, fondo de página, textos y enlaces.' },
  HELP_TAB_LAYOUT: { en: 'Site Layout & Header — Control page width, header height, logo text, navigation alignment, and header background colours.', de: 'Layout & Header — Seitenbreite, Header-Höhe, Logo-Text, Navigationsausrichtung und Header-Hintergrundfarben.', fr: 'Mise en page & En-tête — Largeur de page, hauteur d\'en-tête, texte du logo, alignement du menu et couleurs d\'en-tête.', es: 'Diseño y encabezado — Ancho de página, altura del encabezado, texto del logo, alineación del menú y colores del encabezado.' },
  HELP_TAB_TYPOGRAPHY: { en: 'Typography & Fonts — Choose fonts and sizes for headings, paragraphs, and navigation text.', de: 'Typografie & Schrift — Schriften und Größen für Überschriften, Absätze und Navigation.', fr: 'Typographie & Polices — Polices et tailles pour titres, paragraphes et navigation.', es: 'Tipografía y fuentes — Fuentes y tamaños para títulos, párrafos y navegación.' },
  HELP_TAB_BUTTONS: { en: 'Buttons & UI Elements — Style primary and secondary buttons, borders, and corner rounding.', de: 'Buttons & Oberflächen — Primär- und Sekundärbuttons, Rahmen und Eckenradius.', fr: 'Boutons & Éléments UI — Style des boutons, bordures et coins arrondis.', es: 'Botones y elementos UI — Estilo de botones, bordes y esquinas redondeadas.' },
  HELP_TAB_STATUS: { en: 'System Status Colours — Colours used for success, warning, and error messages across the site.', de: 'System-Statusfarben — Farben für Erfolgs-, Warn- und Fehlermeldungen.', fr: 'Couleurs de statut — Couleurs des messages de succès, avertissement et erreur.', es: 'Colores de estado — Colores para mensajes de éxito, advertencia y error.' },
  HELP_TAB_ICONS: { en: 'Icons & Administrative — Colours for edit icons and action buttons shown in editing mode.', de: 'Symbole & Verwaltung — Farben für Bearbeitungssymbole und Aktionsbuttons im Bearbeitungsmodus.', fr: 'Icônes & Administration — Couleurs des icônes d\'édition en mode modification.', es: 'Iconos y administración — Colores de iconos de edición en modo edición.' },
  HELP_TAB_SIDEBAR: { en: 'Sidebar Navigation — Style the left editor menu: background, text, active item, and hover colours.', de: 'Sidebar-Navigation — Linkes Editor-Menü: Hintergrund, Text, aktives Element und Hover-Farben.', fr: 'Barre latérale — Style du menu éditeur : fond, texte, élément actif et survol.', es: 'Barra lateral — Estilo del menú del editor: fondo, texto, elemento activo y hover.' },
  TITLE_HELP_TIPS: { en: 'Helpful Tips', de: 'Hilfreiche Tipps', fr: 'Conseils utiles', es: 'Consejos útiles' },
  HELP_TIP_PREVIEW: { en: 'Live Preview shows a sample header, text, and buttons — not your real page content, but an accurate representation of your style choices.', de: 'Die Live-Vorschau zeigt Beispiel-Header, Text und Buttons — nicht Ihre echten Seiteninhalte, aber eine genaue Darstellung Ihrer Stilwahl.', fr: 'L\'aperçu montre un exemple d\'en-tête, texte et boutons — pas votre contenu réel, mais une représentation fidèle de vos choix de style.', es: 'La vista previa muestra un encabezado, texto y botones de ejemplo — no su contenido real, pero una representación fiel de su estilo.' },
  HELP_TIP_SAVE: { en: 'Always click Save Configuration when finished. Closing the window without saving will discard your changes.', de: 'Klicken Sie am Ende immer auf Konfiguration speichern. Schließen ohne Speichern verwirft Ihre Änderungen.', fr: 'Cliquez toujours sur Enregistrer la configuration à la fin. Fermer sans enregistrer annule vos modifications.', es: 'Siempre haga clic en Guardar configuración al terminar. Cerrar sin guardar descartará sus cambios.' },
  HELP_TIP_RESET: { en: 'Reset Defaults restores the original system theme. Use this if you want to start over — you will still need to save afterwards.', de: 'Standardwerte zurücksetzen stellt das Original-Theme wieder her. Danach müssen Sie trotzdem speichern.', fr: 'Réinitialiser restaure le thème d\'origine. Vous devrez ensuite enregistrer.', es: 'Restablecer valores devuelve el tema original. Aún deberá guardar después.' },
  HELP_TIP_AI: { en: 'AI generation updates the entire theme at once. It does not change page width, logo layout, or navigation structure — adjust those in Site Layout & Header.', de: 'Die KI aktualisiert das gesamte Theme auf einmal. Seitenbreite, Logo-Layout und Navigationsstruktur ändern sich nicht — passen Sie diese unter Layout & Header an.', fr: 'L\'IA met à jour tout le thème d\'un coup. Elle ne modifie pas la largeur de page ni la structure de navigation — utilisez Mise en page & En-tête.', es: 'La IA actualiza todo el tema de una vez. No cambia el ancho de página ni la estructura de navegación — ajústelos en Diseño y encabezado.' },
  TITLE_HELP_IMPORTANT: { en: 'Good to Know', de: 'Gut zu wissen', fr: 'Bon à savoir', es: 'Bueno saber' },
  HELP_IMPORTANT_NOTE: {
    en: 'Global styling affects the visual appearance of your published site. It does not change your page content, images, or navigation links. If something does not look right after saving, reopen this editor and adjust the relevant section — or use Reset Defaults to return to the starting theme.',
    de: 'Globales Styling betrifft das visuelle Erscheinungsbild Ihrer veröffentlichten Website, nicht Inhalte, Bilder oder Navigationslinks. Öffnen Sie diesen Editor erneut oder setzen Sie auf Standardwerte zurück, wenn etwas nicht passt.',
    fr: 'Le style global affecte l\'apparence visuelle du site publié, pas le contenu, les images ni les liens. Rouvrez cet éditeur ou réinitialisez si quelque chose ne convient pas.',
    es: 'El estilo global afecta la apariencia del sitio publicado, no el contenido, imágenes ni enlaces. Vuelva a abrir este editor o restablezca si algo no se ve bien.'
  },
  TITLE_KEY_CONCEPTS: { en: 'Key Concepts', de: 'Schlüsselkonzepte', fr: 'Concepts clés', es: 'Conceptos clave' },
  TITLE_EDIT_TRANSLATION: { en: 'Edit Translation', de: 'Übersetzung bearbeiten', fr: 'Modifier la traduction', es: 'Editar traducción' },
  TOOLTIP_EDIT_TRANSLATIONS: {
    en: 'Edit translations',
    de: 'Übersetzungen bearbeiten',
    fr: 'Modifier les traductions',
    es: 'Editar traducciones'
  },
  // HHHH feedback menu (TooltipMenu) — keys double as label + edit target
  TT_HHHH_Feedback_SP: {
    en: 'HHHH Feedback SP',
    de: 'HHHH Feedback SP',
    fr: 'HHHH Feedback SP',
    es: 'HHHH Feedback SP'
  },
  TT_HHHH_Bug: {
    en: 'HHHH Bug',
    de: 'HHHH Bug',
    fr: 'HHHH Bug',
    es: 'HHHH Bug'
  },
  TT_HHHH_Design: {
    en: 'HHHH Design',
    de: 'HHHH Design',
    fr: 'HHHH Design',
    es: 'HHHH Design'
  },
  TT_HHHH_UX_New: {
    en: 'HHHH UX-New',
    de: 'HHHH UX-New',
    fr: 'HHHH UX-New',
    es: 'HHHH UX-New'
  },
  TT_HHHH_Quick: {
    en: 'HHHH Quick',
    de: 'HHHH Quick',
    fr: 'HHHH Quick',
    es: 'HHHH Quick'
  },
  TT_HHHH_Component_Page: {
    en: 'HHHH Component Page',
    de: 'HHHH Komponentenseite',
    fr: 'HHHH Page composant',
    es: 'HHHH Página de componentes'
  },
  TT_Call_Notes: {
    en: 'Call Notes',
    de: 'Anrufnotizen',
    fr: 'Notes d\'appel',
    es: 'Notas de llamadas'
  },
  TT_Admin_Help: {
    en: 'Admin Help',
    de: 'Admin-Hilfe',
    fr: 'Aide administrateur',
    es: 'Ayuda de administración'
  },
  TT_Browser_Setting: {
    en: 'Browser Setting',
    de: 'Browser-Einstellung',
    fr: 'Paramètres du navigateur',
    es: 'Configuración del navegador'
  },
  LABEL_FONT_SIZE: { en: 'Font Size', de: 'Schriftgröße', fr: 'Taille de police', es: 'Tamaño de fuente' },
  LABEL_FONT_WEIGHT: { en: 'Font Weight', de: 'Schriftgewicht', fr: 'Graisse de police', es: 'Peso de fuente' },
  LABEL_TEXT_CASE: { en: 'Text Case', de: 'Text-Groß-/Kleinschreibung', fr: 'Casse du texte', es: 'Mayúsculas y minúsculas' },

  // --- DOCUMENT MANAGER HELP GUIDE ---
  HELP_DOC_WELCOME_TITLE: {
    en: 'Welcome!',
    de: 'Willkommen!',
    fr: 'Bienvenue !',
    es: '¡Bienvenido!'
  },
  HELP_DOC_WELCOME_DESC: {
    en: 'This guide provides an overview of the Document Management tool\'s features. Use this to search, filter, sort, and manage all your documents efficiently.',
    de: 'Dieser Leitfaden gibt einen Überblick über die Funktionen des Dokumentenverwaltungstools. Verwenden Sie es, um alle Ihre Dokumente effizient zu suchen, filtern, sortieren und verwalten.',
    fr: 'Ce guide fournit un aperçu des fonctionnalités de l\'outil de gestion des documents. Utilisez-le pour rechercher, filtrer, trier et gérer efficacement tous vos documents.',
    es: 'Esta guía proporciona una descripción general de las funciones de la herramienta de gestión de documentos. Úsela para buscar, filtrar, ordenar y gestionar todos sus documentos de manera eficiente.'
  },
  HELP_DOC_SEARCH_TITLE: {
    en: 'Searching for Documents',
    de: 'Dokumente suchen',
    fr: 'Rechercher des documents',
    es: 'Buscar documentos'
  },
  HELP_DOC_SEARCH_DESC: {
    en: 'Use the search bar at the top to find documents by their title. The list will update automatically as you type.',
    de: 'Verwenden Sie die Suchleiste oben, um Dokumente nach ihrem Titel zu finden. Die Liste wird automatisch aktualisiert, während Sie tippen.',
    fr: 'Utilisez la barre de recherche en haut pour trouver des documents par leur titre. La liste se met à jour automatiquement au fur et à mesure que vous tapez.',
    es: 'Use la barra de búsqueda en la parte superior para encontrar documentos por su título. La lista se actualizará automáticamente mientras escribe.'
  },
  HELP_DOC_FILTER_TITLE: {
    en: 'Filtering Documents',
    de: 'Dokumente filtern',
    fr: 'Filtrer les documents',
    es: 'Filtrar documentos'
  },
  HELP_DOC_FILTER_DESC: {
    en: 'Click the "Filters" button to open the filter panel. You can filter documents by their Status (Published/Draft) and File Type. Select one or more checkboxes to apply the filters. Click "Clear Filters" to reset your selection.',
    de: 'Klicken Sie auf die Schaltfläche "Filter", um den Filterbereich zu öffnen. Sie können Dokumente nach ihrem Status (Veröffentlicht/Entwurf) und Dateityp filtern. Wählen Sie ein oder mehrere Kontrollkästchen aus, um die Filter anzuwenden. Klicken Sie auf "Filter löschen", um Ihre Auswahl zurückzusetzen.',
    fr: 'Cliquez sur le bouton "Filtres" pour ouvrir le panneau de filtres. Vous pouvez filtrer les documents par leur Statut (Publié/Brouillon) et Type de fichier. Sélectionnez une ou plusieurs cases à cocher pour appliquer les filtres. Cliquez sur "Effacer les filtres" pour réinitialiser votre sélection.',
    es: 'Haga clic en el botón "Filtros" para abrir el panel de filtros. Puede filtrar documentos por su Estado (Publicado/Borrador) y Tipo de archivo. Seleccione una o más casillas de verificación para aplicar los filtros. Haga clic en "Borrar filtros" para restablecer su selección.'
  },
  HELP_DOC_SORT_TITLE: {
    en: 'Sorting Documents',
    de: 'Dokumente sortieren',
    fr: 'Trier les documents',
    es: 'Ordenar documentos'
  },
  HELP_DOC_SORT_DESC: {
    en: 'To sort the documents, use the "Sort By" dropdown menu. You can choose to sort by various criteria like Title, File Size, or Date. Use the arrow buttons next to the dropdown to switch between ascending and descending order.',
    de: 'Um die Dokumente zu sortieren, verwenden Sie das Dropdown-Menü "Sortieren nach". Sie können nach verschiedenen Kriterien wie Titel, Dateigröße oder Datum sortieren. Verwenden Sie die Pfeilschaltflächen neben dem Dropdown, um zwischen auf- und absteigender Reihenfolge zu wechseln.',
    fr: 'Pour trier les documents, utilisez le menu déroulant "Trier par". Vous pouvez choisir de trier selon différents critères comme le Titre, la Taille du fichier ou la Date. Utilisez les boutons fléchés à côté du menu déroulant pour basculer entre l\'ordre croissant et décroissant.',
    es: 'Para ordenar los documentos, use el menú desplegable "Ordenar por". Puede elegir ordenar por varios criterios como Título, Tamaño de archivo o Fecha. Use los botones de flecha junto al desplegable para cambiar entre orden ascendente y descendente.'
  },
  HELP_SORT_BY_DESC: {
    en: 'Use the Sort By dropdown to choose how items are ordered (for example title, date, status, or sort order). Click the A–Z arrow button beside it to switch between ascending and descending order.',
    de: 'Verwenden Sie das Dropdown „Sortieren nach“, um die Reihenfolge festzulegen (z. B. Titel, Datum, Status oder Sortierreihenfolge). Klicken Sie auf die A–Z-Pfeilschaltfläche daneben, um zwischen aufsteigender und absteigender Reihenfolge zu wechseln.',
    fr: 'Utilisez le menu déroulant « Trier par » pour choisir l\'ordre des éléments (par exemple titre, date, statut ou ordre de tri). Cliquez sur le bouton fléché A–Z à côté pour basculer entre l\'ordre croissant et décroissant.',
    es: 'Use el menú desplegable « Ordenar por » para elegir cómo se ordenan los elementos (por ejemplo título, fecha, estado u orden). Haga clic en el botón de flecha A–Z junto a él para alternar entre orden ascendente y descendente.'
  },
  HELP_SORT_BY_CARDS_DESC: {
    en: 'Use Sort By to choose how items are shown in this panel. Click the A–Z button to switch ascending or descending order. In the Already Tagged panel, sort and list/grid view are saved with the container and control how cards appear on the page.',
    de: 'Verwenden Sie „Sortieren nach“, um festzulegen, wie Elemente in diesem Bereich angezeigt werden. Klicken Sie auf die A–Z-Schaltfläche für auf- oder absteigende Reihenfolge. Im Bereich „Bereits getaggt“ werden Sortierung und Listen-/Rasteransicht mit dem Container gespeichert und steuern die Darstellung auf der Seite.',
    fr: 'Utilisez « Trier par » pour choisir l\'affichage des éléments dans ce panneau. Cliquez sur le bouton A–Z pour l\'ordre croissant ou décroissant. Dans le panneau « Déjà étiqueté », le tri et la vue liste/grille sont enregistrés avec le conteneur et définissent l\'affichage des cartes sur la page.',
    es: 'Use « Ordenar por » para elegir cómo se muestran los elementos en este panel. Haga clic en el botón A–Z para orden ascendente o descendente. En el panel « Ya etiquetado », el orden y la vista lista/cuadrícula se guardan con el contenedor y controlan cómo aparecen las tarjetas en la página.'
  },
  HELP_DOC_VIEWS_TITLE: {
    en: 'Switching Views',
    de: 'Ansicht wechseln',
    fr: 'Changer de vue',
    es: 'Cambiar vistas'
  },
  HELP_DOC_VIEWS_DESC: {
    en: 'You can toggle between two different layouts: Visual View (card-based) and List View (table-based) using the buttons in the top right of the main panel.',
    de: 'Sie können zwischen zwei verschiedenen Layouts wechseln: Visuelle Ansicht (kartenbasiert) und Listenansicht (tabellenbasiert) mit den Schaltflächen oben rechts im Hauptbereich.',
    fr: 'Vous pouvez basculer entre deux mises en page différentes : Vue visuelle (basée sur des cartes) et Vue liste (basée sur un tableau) en utilisant les boutons en haut à droite du panneau principal.',
    es: 'Puede alternar entre dos diseños diferentes: Vista Visual (basada en tarjetas) y Vista de Lista (basada en tabla) usando los botones en la parte superior derecha del panel principal.'
  },
  HELP_DOC_ADD_TITLE: {
    en: 'Adding a New Document',
    de: 'Neues Dokument hinzufügen',
    fr: 'Ajouter un nouveau document',
    es: 'Agregar un nuevo documento'
  },
  HELP_DOC_ADD_DESC: {
    en: 'Click the "Add New Document" button at the bottom right. A modal will appear with options to:',
    de: 'Klicken Sie auf die Schaltfläche "Neues Dokument hinzufügen" unten rechts. Ein Dialog erscheint mit Optionen zum:',
    fr: 'Cliquez sur le bouton "Ajouter un nouveau document" en bas à droite. Une fenêtre modale apparaîtra avec des options pour :',
    es: 'Haga clic en el botón "Agregar nuevo documento" en la parte inferior derecha. Aparecerá un modal con opciones para:'
  },
  HELP_DOC_ADD_UPLOAD: {
    en: 'Choose a file from your computer.',
    de: 'Wählen Sie eine Datei von Ihrem Computer aus.',
    fr: 'Choisissez un fichier sur votre ordinateur.',
    es: 'Elija un archivo de su computadora.'
  },
  HELP_DOC_ADD_DRAG: {
    en: 'Drag a file directly into the designated area.',
    de: 'Ziehen Sie eine Datei direkt in den vorgesehenen Bereich.',
    fr: 'Faites glisser un fichier directement dans la zone désignée.',
    es: 'Arrastre un archivo directamente al área designada.'
  },
  HELP_DOC_ADD_LINK: {
    en: 'Add a document by providing a URL.',
    de: 'Fügen Sie ein Dokument durch Angabe einer URL hinzu.',
    fr: 'Ajoutez un document en fournissant une URL.',
    es: 'Agregue un documento proporcionando una URL.'
  },
  HELP_DOC_ADD_FOOTER: {
    en: 'After providing the necessary information, click "Upload" or "Create" to add the document to the list.',
    de: 'Nachdem Sie die erforderlichen Informationen eingegeben haben, klicken Sie auf "Hochladen" oder "Erstellen", um das Dokument zur Liste hinzuzufügen.',
    fr: 'Après avoir fourni les informations nécessaires, cliquez sur "Télécharger" ou "Créer" pour ajouter le document à la liste.',
    es: 'Después de proporcionar la información necesaria, haga clic en "Subir" o "Crear" para agregar el documento a la lista.'
  },
  HELP_DOC_UPLOAD_LABEL: {
    en: 'Upload',
    de: 'Hochladen',
    fr: 'Télécharger',
    es: 'Subir'
  },
  HELP_DOC_DRAGDROP_LABEL: {
    en: 'Drag & Drop',
    de: 'Drag & Drop',
    fr: 'Glisser-Déposer',
    es: 'Arrastrar y Soltar'
  },
  HELP_DOC_LINK_LABEL: {
    en: 'Link To',
    de: 'Verlinken',
    fr: 'Lier à',
    es: 'Vincular a'
  },

  // Container Settings Labels
  LABEL_DISPLAY_OPTIONS: { en: 'Display Options', de: 'Anzeigeoptionen', fr: 'Options d\'affichage', es: 'Opciones de visualización' },
  LABEL_LAYOUT_BEHAVIOR: { en: 'Layout & Behavior', de: 'Layout & Verhalten', fr: 'Mise en page & Comportement', es: 'Diseño y Comportamiento' },
  LABEL_CONTENT_ALIGNMENT: { en: 'Section alignment', de: 'Abschnittsausrichtung', fr: 'Alignement de la section', es: 'Alineación de la sección' },
  LABEL_CARD_CONTAINER_ALIGNMENT: { en: 'Content alignment', de: 'Inhaltsausrichtung', fr: 'Alignement du contenu', es: 'Alineación del contenido' },
  LABEL_CONTAINER_HEADER_ALIGNMENT: { en: 'Container Header Alignment', de: 'Container-Header-Ausrichtung', fr: 'Alignement de l\'en-tête du conteneur', es: 'Alineación del encabezado del contenedor' },
  LABEL_SLIDE_CONTENT_ALIGNMENT: { en: 'Slide Content Alignment', de: 'Folieninhalts-Ausrichtung', fr: 'Alignement du contenu de la diapositive', es: 'Alineación del contenido de la diapositiva' },
  LABEL_CARD_BORDER: { en: 'Card Border', de: 'Kartenrand', fr: 'Bordure de carte', es: 'Borde de tarjeta' },
  LABEL_IMAGE_POSITION: { en: 'Image Position', de: 'Bildposition', fr: 'Position de l\'image', es: 'Posición de la imagen' },
  LABEL_CARD_LAYOUT: { en: 'Card Layout', de: 'Kartenlayout', fr: 'Mise en page de la carte', es: 'Diseño de tarjeta' },
  LABEL_SLIDER_CONFIGURATION: { en: 'Slider Configuration', de: 'Slider-Konfiguration', fr: 'Configuration du curseur', es: 'Configuración de controles deslizantes' },
  LABEL_SPEED_AUTOPLAY: { en: 'Speed & Autoplay', de: 'Geschwindigkeit & Autoplay', fr: 'Vitesse & Lecture automatique', es: 'Velocidad y Reproducción automática' },
  LABEL_NAVIGATION_CONTROLS: { en: 'Navigation Controls', de: 'Navigationssteuerung', fr: 'Contrôles de navigation', es: 'Controles de navegación' },
  LABEL_SHOW_ARROWS: { en: 'Show Arrows', de: 'Pfeile anzeigen', fr: 'Afficher les flèches', es: 'Mostrar flechas' },
  LABEL_SHOW_DOTS: { en: 'Show Dots', de: 'Punkte anzeigen', fr: 'Afficher les points', es: 'Mostrar puntos' },
  LABEL_SLIDE_CONTENT_VISIBILITY: { en: 'Slide Content Visibility', de: 'Sichtbarkeit des Folieninhalts', fr: 'Visibilité du contenu de la diapositive', es: 'Visibilidad del contenido de la diapositiva' },
  LABEL_TITLES: { en: 'Titles', de: 'Titel', fr: 'Titres', es: 'Títulos' },
  LABEL_DESCRIPTIONS: { en: 'Descriptions', de: 'Beschreibungen', fr: 'Descriptions', es: 'Descripciones' },
  LABEL_CONTENT_OVERLAY_POSITION: { en: 'Content Overlay Position', de: 'Position der Inhaltsüberlagerung', fr: 'Position de superposition du contenu', es: 'Posición de superposición de contenido' },
  LABEL_CARD_SETTINGS: { en: 'Card Settings', de: 'Karteneinstellungen', fr: 'Paramètres de la carte', es: 'Configuración de la tarjeta' },
  SECTION_CARD_STYLE: { en: 'Card Style', de: 'Kartenstil', fr: 'Style de carte', es: 'Estilo de tarjeta' },
  LABEL_CARD_TITLE_COLOR: { en: 'Card Title Color', de: 'Kartentitelfarbe', fr: 'Couleur du titre de carte', es: 'Color del título de tarjeta' },
  LABEL_CARD_DESCRIPTION_COLOR: { en: 'Card Description Color', de: 'Kartenbeschreibungsfarbe', fr: 'Couleur de la description de carte', es: 'Color de la descripción de tarjeta' },
  LABEL_CARD_TITLE_STYLE: { en: 'Card Title Style', de: 'Kartentitelstil', fr: 'Style du titre de carte', es: 'Estilo del título de tarjeta' },
  LABEL_CARD_DESCRIPTION_STYLE: { en: 'Card Description Style', de: 'Kartenbeschreibungsstil', fr: 'Style de la description de carte', es: 'Estilo de la descripción de tarjeta' },
  LABEL_CARD_SUBTITLE_COLOR: { en: 'Card Subtitle Color', de: 'Kartenuntertitelfarbe', fr: 'Couleur du sous-titre de carte', es: 'Color del subtítulo de tarjeta' },
  LABEL_CARD_SUBTITLE_STYLE: { en: 'Card Subtitle Style', de: 'Kartenuntertitelstil', fr: 'Style du sous-titre de carte', es: 'Estilo del subtítulo de tarjeta' },
  LABEL_CUSTOM_CARD_SUBTITLE_STYLE: { en: 'Custom Card Subtitle Style', de: 'Benutzerdefinierter Kartenuntertitelstil', fr: 'Style de sous-titre de carte personnalisé', es: 'Estilo de subtítulo de tarjeta personalizado' },
  LABEL_CARD_SUBTITLE_LETTER_CASE: { en: 'Card Subtitle Letter Case', de: 'Groß-/Kleinschreibung Kartenuntertitel', fr: 'Casse du sous-titre de carte', es: 'Mayúsculas/minúsculas del subtítulo de tarjeta' },
  LABEL_CUSTOM_CARD_TITLE_STYLE: { en: 'Custom Card Title Style', de: 'Benutzerdefinierter Kartentitelstil', fr: 'Style de titre de carte personnalisé', es: 'Estilo de título de tarjeta personalizado' },
  LABEL_CUSTOM_CARD_DESCRIPTION_STYLE: { en: 'Custom Card Description Style', de: 'Benutzerdefinierter Kartenbeschreibungsstil', fr: 'Style de description de carte personnalisé', es: 'Estilo de descripción de tarjeta personalizado' },
  LABEL_CARD_LETTER_CASE: { en: 'Card Title Letter Case', de: 'Groß-/Kleinschreibung Kartentitel', fr: 'Casse du titre de carte', es: 'Mayúsculas/minúsculas del título de tarjeta' },
  LABEL_CARD_TITLE_FONT_FAMILY: { en: 'Card Title Font Family', de: 'Kartentitel-Schriftfamilie', fr: 'Famille de police du titre de carte', es: 'Familia de fuente del título de tarjeta' },
  LABEL_CARD_TITLE_FONT_DEFAULT: { en: 'Default (Heading Font)', de: 'Standard (Überschrift)', fr: 'Par défaut (police de titre)', es: 'Predeterminado (fuente de título)' },
  LABEL_USE_SITE_CARD_LAYOUT: { en: 'Use Site Card Layout', de: 'Website-Kartenlayout verwenden', fr: 'Utiliser la mise en page de la carte du site', es: 'Usar diseño de tarjeta de sitio' },
  LABEL_ENABLE_READ_MORE_BUTTON: {
    en: 'Enable Read More Button',
    de: 'Weiterlesen-Button aktivieren',
    fr: 'Activer le bouton Lire la suite',
    es: 'Activar botón Leer más'
  },
  LABEL_READ_MORE_BEHAVIOR: {
    en: 'Read More Behavior',
    de: 'Weiterlesen-Verhalten',
    fr: 'Comportement Lire la suite',
    es: 'Comportamiento de Leer más'
  },
  LABEL_READ_MORE_POPUP: {
    en: 'Show details in popup',
    de: 'Details im Popup anzeigen',
    fr: 'Afficher les détails dans une fenêtre',
    es: 'Mostrar detalles en una ventana emergente'
  },
  LABEL_READ_MORE_EXPAND: {
    en: 'Expand / Collapse in card',
    de: 'Im Karte ausklappen / einklappen',
    fr: 'Développer / réduire dans la carte',
    es: 'Expandir / contraer en la tarjeta'
  },
  LABEL_READ_MORE_DISPLAY_TYPE: {
    en: 'Read More Style',
    de: 'Weiterlesen-Stil',
    fr: 'Style Lire la suite',
    es: 'Estilo de Leer más'
  },
  LABEL_READ_MORE_AS_LINK: {
    en: 'Link',
    de: 'Link',
    fr: 'Lien',
    es: 'Enlace'
  },
  LABEL_READ_MORE_AS_BUTTON: {
    en: 'Button',
    de: 'Button',
    fr: 'Bouton',
    es: 'Botón'
  },
  LABEL_READ_MORE_LINK_SIZE: {
    en: 'Read More Link Size',
    de: 'Weiterlesen-Linkgröße',
    fr: 'Taille du lien Lire la suite',
    es: 'Tamaño del enlace Leer más'
  },
  LABEL_READ_MORE_BUTTON_SIZE: {
    en: 'Read More Button Size',
    de: 'Weiterlesen-Buttongröße',
    fr: 'Taille du bouton Lire la suite',
    es: 'Tamaño del botón Leer más'
  },
  LABEL_READ_MORE_POSITION: {
    en: 'Read More Position',
    de: 'Weiterlesen-Position',
    fr: 'Position Lire la suite',
    es: 'Posición de Leer más'
  },
  LABEL_SMALL: { en: 'Small', de: 'Klein', fr: 'Petit', es: 'Pequeño' },
  LABEL_MEDIUM: { en: 'Medium', de: 'Mittel', fr: 'Moyen', es: 'Mediano' },
  LABEL_LARGE: { en: 'Large', de: 'Groß', fr: 'Grand', es: 'Grande' },
  LABEL_CONTAINER_IDENTITY: { en: 'Container Identity', de: 'Container-Identität', fr: 'Identité du conteneur', es: 'Identidad del contenedor' },
  LABEL_CONTAINER_TITLE_INTERNAL: { en: 'Container Title (Internal)', de: 'Container-Titel (Intern)', fr: 'Titre du conteneur (interne)', es: 'Título del contenedor (interno)' },
  LABEL_DATA_SOURCE: { en: 'Data Source', de: 'Datenquelle', fr: 'Source de données', es: 'Fuente de datos' },
  LABEL_SHOW_ALL_WITHOUT_TAGGING: {
    en: 'Show All Items Without Tagging',
    de: 'Alle Elemente ohne Tagging anzeigen',
    fr: 'Afficher tous les éléments sans étiquetage',
    es: 'Mostrar todos los elementos sin etiquetado'
  },
  LABEL_SHOW_ALL_WITHOUT_TAGGING_HINT: {
    en: 'All items from the selected data source are shown automatically. Manual tagging is not required.',
    de: 'Alle Elemente aus der gewählten Datenquelle werden automatisch angezeigt. Manuelles Tagging ist nicht erforderlich.',
    fr: 'Tous les éléments de la source de données sélectionnée sont affichés automatiquement. L\'étiquetage manuel n\'est pas requis.',
    es: 'Todos los elementos de la fuente de datos seleccionada se muestran automáticamente. No se requiere etiquetado manual.'
  },
  LABEL_FLAT_VIEW: { en: 'Flat View', de: 'Flache Ansicht', fr: 'Vue plate', es: 'Vista plana' },
  LABEL_CLEAR_ALL: { en: 'Clear All', de: 'Alle löschen', fr: 'Tout effacer', es: 'Borrar todo' },
  LABEL_ALL_YEARS: { en: 'All', de: 'Alle', fr: 'Tous', es: 'Todos' },
  PLACEHOLDER_SEARCH_ALL_NEWS: { en: 'Search All News...', de: 'Alle News durchsuchen...', fr: 'Rechercher toutes les actualités...', es: 'Buscar todas las noticias...' },
  PLACEHOLDER_SEARCH_ALL_EVENTS: { en: 'Search All Event...', de: 'Alle Events durchsuchen...', fr: 'Rechercher tous les événements...', es: 'Buscar todos los eventos...' },
  MSG_DATA_GRID_SHOWING_OF: {
    en: 'Showing {0} of {1} {2}',
    de: 'Zeige {0} von {1} {2}',
    fr: 'Affichage de {0} sur {1} {2}',
    es: 'Mostrando {0} de {1} {2}'
  },
  MSG_DATA_GRID_NO_MATCHING_ITEMS: {
    en: 'No matching items found.',
    de: 'Keine passenden Elemente gefunden.',
    fr: 'Aucun élément correspondant trouvé.',
    es: 'No se encontraron elementos coincidentes.'
  },
  LABEL_UNIQUE_CONTAINER_ID: { en: 'Unique Container ID', de: 'Eindeutige Container-ID', fr: 'ID de conteneur unique', es: 'ID de contenedor único' },
  LABEL_GENERATE: { en: 'Generate', de: 'Generieren', fr: 'Générer', es: 'Générer' },
  LABEL_ADDED_TO_PAGES: { en: 'Added to Pages', de: 'Zu Seiten hinzugefügt', fr: 'Ajouté aux pages', es: 'Agregado a las páginas' },
  LABEL_COLUMNS: { en: 'Columns', de: 'Spalten', fr: 'Colonnes', es: 'Columnas' },
  LABEL_COLUMN: { en: 'Column', de: 'Spalte', fr: 'Colonne', es: 'Columna' },
  LABEL_ORDERING_TYPE: { en: 'Ordering Type', de: 'Sortiertyp', fr: 'Type de tri', es: 'Tipo de ordenación' },
  LABEL_AUTOPLAY: { en: 'Autoplay', de: 'Autoplay', fr: 'Lecture automatique', es: 'Reproducción automática' },
  MSG_CARD_SLIDER_AUTOPLAY_ON: { en: 'Autoplay is enabled. Slider will auto-advance.', de: 'Autoplay ist aktiviert. Der Slider schaltet automatisch weiter.', fr: 'La lecture automatique est activée. Le curseur avancera automatiquement.', es: 'La reproducción automática está activada. El control deslizante avanzará automáticamente.' },
  MSG_CARD_SLIDER_AUTOPLAY_OFF: { en: 'Autoplay is disabled. Slider will not auto-advance.', de: 'Autoplay ist deaktiviert. Der Slider schaltet nicht automatisch weiter.', fr: 'La lecture automatique est désactivée. Le curseur n\'avancera pas automatiquement.', es: 'La reproducción automática está desactivada. El control deslizante no avanzará automáticamente.' },
  LABEL_SHOW_HEADER: { en: 'Show Header', de: 'Header anzeigen', fr: 'Afficher l\'en-tête', es: 'Mostrar encabezado' },
  LABEL_SHOW_SUBHEADING: { en: 'Show subheading', de: 'Unterüberschrift anzeigen', fr: 'Afficher le sous-titre', es: 'Mostrar subtítulo' },
  LABEL_ENABLE: { en: 'Enable', de: 'Aktivieren', fr: 'Activer', es: 'Habilitar' },
  LABEL_SLIDER_STYLE: { en: 'Slider Style', de: 'Slider-Stil', fr: 'Style de curseur', es: 'Estilo de control deslizante' },
  LABEL_CLASSIC_SLIDER: { en: 'Classic Slider', de: 'Klassischer Slider', fr: 'Curseur classique', es: 'Control deslizante clásico' },
  LABEL_GALLERY_CAROUSEL: { en: 'Gallery Carousel', de: 'Galerie-Karussell', fr: 'Carrousel de galerie', es: 'Carrusel de galerie' },
  LABEL_HEADING: { en: 'Heading', de: 'Überschrift', fr: 'Titre', es: 'Encabezado' },
  LABEL_FORM_HEADING: { en: 'Form Heading', de: 'Formularüberschrift', fr: 'Titre du formulaire', es: 'Encabezado del formulario' },
  LABEL_FORM_SUBHEADING: { en: 'Form Subheading', de: 'Formularunterüberschrift', fr: 'Sous-titre du formulaire', es: 'Subencabezado del formulario' },
  LABEL_BUTTON_TEXT: { en: 'Button Text', de: 'Button-Text', fr: 'Texte du bouton', es: 'Texto del botón' },
  LABEL_MANAGE_CONTENT: { en: 'Manage Content', de: 'Inhalt verwalten', fr: 'Gérer le contenu', es: 'Administrar contenido' },
  LABEL_HEADING_COLOR: { en: 'Heading Color', de: 'Überschriftfarbe', fr: 'Couleur du titre', es: 'Color del encabezado' },
  LABEL_SUBHEADING_COLOR: { en: 'Subheading Color', de: 'Untertitel-Farbe', fr: 'Couleur du sous-titre', es: 'Color del subencabezado' },
  LABEL_FONT_SIZES: { en: 'Font Sizes', de: 'Schriftgrößen', fr: 'Tailles de police', es: 'Tamaños de fuente' },
  LABEL_HEADING_SIZE: { en: 'Heading Size', de: 'Überschriftgröße', fr: 'Taille du titre', es: 'Tamaño del encabezado' },
  LABEL_SUBHEADING_SIZE: { en: 'Subheading Size', de: 'Untertitelgröße', fr: 'Taille du sous-titre', es: 'Tamaño del subencabezado' },
  LABEL_DESCRIPTION_SIZE: { en: 'Description Size', de: 'Beschreibungsgröße', fr: 'Taille de la description', es: 'Tamaño de la descripción' },
  LABEL_ACTION_BUTTON: { en: 'Action Button', de: 'Aktionsbutton', fr: 'Bouton d\'action', es: 'Botón de acción' },
  LABEL_LINK_TYPE: { en: 'Link Type', de: 'Link-Typ', fr: 'Type de lien', es: 'Tipo de enlace' },
  LABEL_EXTERNAL_URL: { en: 'URL / External', de: 'URL / Extern', fr: 'URL / Externe', es: 'URL / Externo' },
  LABEL_GO_TO_CONTAINER: { en: 'Go to Container', de: 'Gehe zu Container', fr: 'Aller au conteneur', es: 'Ir al contenedor' },
  LABEL_BUTTON_URL: { en: 'Button URL', de: 'Button-URL', fr: 'URL du bouton', es: 'URL del botón' },
  LABEL_TARGET_CONTAINER: { en: 'Target Container', de: 'Ziel-Container', fr: 'Conteneur cible', es: 'Contenedor de destino' },
  LABEL_TEMPLATE_DESIGN: { en: 'Template Design', de: 'Vorlagendesign', fr: 'Conception de modèle', es: 'Diseño de plantilla' },
  LABEL_TEXT_TITLE: { en: 'Text Header', de: 'Text-Header', fr: 'En-tête texte', es: 'Encabezado de texto' },
  LABEL_TITLE_COLOR_BG: { en: 'Header with color background', de: 'Header mit farbigem Hintergrund', fr: 'En-tête avec fond coloré', es: 'Encabezado con fondo de color' },
  LABEL_TITLE_IMAGE_BG: { en: 'Header with image background', de: 'Header mit Bildhintergrund', fr: 'En-tête avec fond d\'image', es: 'Encabezado con fondo de imagen' },
  LABEL_LAYOUT_DESIGN: { en: 'Image & Text', de: 'Bild & Text', fr: 'Image et texte', es: 'Imagen y texto' },
  /** Hero editor: image + text split template — separate key so stale SharePoint UI_LABELS rows for LABEL_LAYOUT_DESIGN do not keep showing “Layout Design”. */
  LABEL_HERO_TEMPLATE_IMAGE_TEXT: { en: 'Image & Text', de: 'Bild & Text', fr: 'Image et texte', es: 'Imagen y texto' },
  /** Canonical hero template names — shared by Select Header + Header Editor (avoids stale TranslationDictionary overrides on legacy keys). */
  HERO_TMPL_TEXT_HEADER: { en: 'Text Header', de: 'Text-Header', fr: 'En-tête texte', es: 'Encabezado de texto' },
  HERO_TMPL_TEXT_HEADER_DESC: { en: 'A clear, direct layout for important information and updates.', de: 'Ein klarer und direkter Ansatz. Nutzen Sie diesen Bereich für wichtige Informationen und Updates.', fr: 'Une mise en page claire pour les informations et mises à jour importantes.', es: 'Un diseño claro para información importante y actualizaciones.' },
  HERO_TMPL_COLOR_BG: { en: 'Header with color background', de: 'Header mit farbigem Hintergrund', fr: 'En-tête avec fond coloré', es: 'Encabezado con fondo de color' },
  HERO_TMPL_COLOR_BG_DESC: { en: 'Solid color background behind your title and content. Quick to brand and easy to read.', de: 'Einfarbiger Hintergrund hinter Titel und Inhalt. Schnell an die Marke anpassbar.', fr: 'Fond uni derrière le titre et le contenu. Rapide à mettre aux couleurs de la marque.', es: 'Fondo sólido detrás del título y el contenido. Fácil de alinear con la marca.' },
  HERO_TMPL_IMAGE_BG: { en: 'Header with image background', de: 'Header mit Bildhintergrund', fr: 'En-tête avec fond d\'image', es: 'Encabezado con fondo de imagen' },
  HERO_TMPL_IMAGE_BG_DESC: { en: 'Full-width header with a background image and overlay text. Ideal for landing pages.', de: 'Volle Breite mit Bildhintergrund und Text. Ideal für Landingpages.', fr: 'En-tête pleine largeur avec image de fond et texte. Idéal pour les pages d\'atterrissage.', es: 'Encabezado a todo ancho con imagen de fondo y texto. Ideal para páginas de destino.' },
  HERO_TMPL_IMAGE_TEXT: { en: 'Image & Text', de: 'Bild & Text', fr: 'Image et texte', es: 'Imagen y texto' },
  HERO_TMPL_IMAGE_TEXT_DESC: { en: 'Balance visuals and copy. Ideal for highlights, testimonials, or introductions.', de: 'Kombinieren Sie Bild und Text ausgewogen. Ideal für Highlights, Referenzen oder Serviceeinführungen mit gleichwertiger Gewichtung.', fr: 'Équilibrez visuels et texte. Idéal pour les points forts ou témoignages.', es: 'Equilibre imagen y texto. Ideal para destacados o testimonios.' },
  LABEL_IMG_LEFT_TEXT_RIGHT: { en: 'Image Left, Text Right', de: 'Bild links, Text rechts', fr: 'Image à gauche, texte à droite', es: 'Imagen a la izquierda, texto a la derecha' },
  LABEL_TEXT_LEFT_IMG_RIGHT: { en: 'Text Left, Image Right', de: 'Text links, Bild rechts', fr: 'Texte à gauche, image à droite', es: 'Texto a la izquierda, imagen a la derecha' },
  LABEL_TRANSLATION_MANAGER: { en: 'Translation Manager', de: 'Übersetzungsmanager', fr: 'Gestionnaire de traduction', es: 'Administrador de traducción' },
  LABEL_SUGGEST_WITH_AI: { en: 'Suggest with AI', de: 'Suggest with AI', fr: 'Suggérer avec l\'IA', es: 'Sugerir con IA' },
  LABEL_ORIGINAL_ENGLISH: { en: 'Original (English)', de: 'Original (Englisch)', fr: 'Original (Anglais)', es: 'Original (Inglés)' },
  LABEL_TRANSLATED: { en: 'Translated', de: 'Übersetzt', fr: 'Traduit', es: 'Traducido' },
  LABEL_SETTINGS: { en: 'Settings', de: 'Einstellungen', fr: 'Paramètres', es: 'Configuración' },
  LABEL_OPTIONAL: { en: 'Optional', de: 'Optional', fr: 'Optionnel', es: 'Opcional' },
  LABEL_RICH_TEXT: { en: 'Rich Text', de: 'Rich Text', fr: 'Texte enrichi', es: 'Texto enriquecido' },
  LABEL_BUTTON_NAME: { en: 'Button Name', de: 'Button-Name', fr: 'Nom du bouton', es: 'Nombre del bouton' },
  LABEL_ALIGNMENT: { en: 'Alignment', de: 'Ausrichtung', fr: 'Alignement', es: 'Alineación' },
  LABEL_LETTER_CASE: { en: 'Letter Case', de: 'Groß-/Kleinschreibung', fr: 'Casse', es: 'Mayúsculas/minúsculas' },
  LABEL_HEADING_LETTER_CASE: { en: 'Heading Letter Case', de: 'Groß-/Kleinschreibung (Überschrift)', fr: 'Casse du titre', es: 'Mayúsculas del encabezado' },
  LABEL_UPPERCASE: { en: 'UPPERCASE', de: 'GROSSBUCHSTABEN', fr: 'MAJUSCULES', es: 'MAYÚSCULAS' },
  LABEL_LOWERCASE: { en: 'lowercase', de: 'kleinbuchstaben', fr: 'minuscules', es: 'minúsculas' },
  LABEL_SENTENCE_CASE: { en: 'Sentence case', de: 'Satzanfang groß', fr: 'Casse de phrase', es: 'Mayúscula inicial' },
  LABEL_TITLE_CASE: { en: 'Title Case', de: 'Wortanfang groß', fr: 'Casse de titre', es: 'Mayúsculas en cada palabra' },
  LABEL_SITE_COLOR: { en: 'Site Color', de: 'Website-Farbe', fr: 'Couleur du site', es: 'Color del sitio' },
  LABEL_BLACK: { en: 'Black', de: 'Schwarz', fr: 'Noir', es: 'Negro' },
  LABEL_WHITE: { en: 'White', de: 'Weiß', fr: 'Blanc', es: 'Blanco' },
  LABEL_CUSTOM_COLOR: { en: 'Custom Color', de: 'Benutzerdefinierte Farbe', fr: 'Couleur personnalisée', es: 'Color personalizado' },
  LABEL_BACKGROUND_COLOR: { en: 'Background Color', de: 'Hintergrundfarbe', fr: 'Couleur de fond', es: 'Color de fondo' },
  LABEL_IMAGE: { en: 'Image', de: 'Bild', fr: 'Image', es: 'Imagen' },
  LABEL_INTERNAL_TITLE: { en: 'Internal Title', de: 'Interner Titel', fr: 'Titre interne', es: 'Título interno' },
  LABEL_DELETE_CONFIRM: { en: 'Are you sure you want to delete this item?', de: 'Sind Sie sicher, dass Sie dieses Element löschen möchten?', fr: 'Êtes-vous sûr de vouloir supprimer cet élément ?', es: '¿Está seguro de que desea eliminar este elemento?' },
  LABEL_SEARCH_PLACEHOLDER: { en: 'Global Search...', de: 'Globale Suche...', fr: 'Recherche globale...', es: 'Búsqueda global...' },
  LABEL_INTERNAL_TITLE_PLACEHOLDER: { en: 'e.g. Home Page Hero Section', de: 'z.B. Homepage Hero Bereich', fr: 'p. ex. Section Hero de la page d\'accueil', es: 'por ejemplo, Sección Hero de la página de inicio' },
  LABEL_BUTTON_NAME_PLACEHOLDER: { en: 'e.g. Learn More, Get Started, Contact Us', de: 'z.B. Mehr erfahren, Loslegen, Kontaktieren Sie uns', fr: 'p. ex. En savoir plus, Commencer, Contactez-nous', es: 'por ejemplo, Más información, Comenzar, Contáctenos' },
  LABEL_BUTTON_URL_PLACEHOLDER: { en: 'e.g. https://example.com or /page-slug', de: 'z.B. https://example.com oder /seiten-slug', fr: 'p. ex. https://example.com ou /page-slug', es: 'por ejemplo, https://example.com o /page-slug' },
  LABEL_SELECT_CONTAINER: { en: '— Select a container —', de: '— Container auswählen —', fr: '— Sélectionner un conteneur —', es: '— Seleccionar un contenedor —' },
  LABEL_NO_CONTAINERS_FOUND: { en: 'No other containers found on this page.', de: 'Keine anderen Container auf dieser Seite gefunden.', fr: 'Aucun autre conteneur trouvé sur cette page.', es: 'No se encontraron otros contenedores en esta página.' },
  LABEL_RICH_TEXT_DESC: { en: 'Rich Text description...', de: 'Rich Text Beschreibung...', fr: 'Description en texte enrichi...', es: 'Descripción de texto enriquecido...' },
  LABEL_MIN_ITEMS_REQUIRED: { en: 'Minimum {0} items required for the selected column layout. Please tag more items.', de: 'Mindestens {0} Elemente für das gewählte Spaltenlayout erforderlich. Bitte taggen Sie weitere Elemente.', fr: 'Minimum {0} éléments requis pour la disposition des colonnes sélectionnée. Veuillez étiqueter plus d\'éléments.', es: 'Se requiere un mínimo de {0} elementos para el diseño de columna seleccionado. Etiquete más elementos.' },
  LABEL_CREATE_NEW_STEP: { en: '1. Create New {0}', de: '1. Neu erstellen {0}', fr: '1. Créer un nouveau {0}', es: '1. Crear nuevo {0}' },
  LABEL_CREATE_NEW_DESC: { en: 'Create a new item in {0} and immediately add it to this container.', de: 'Erstellen Sie ein neues Element in {0} und fügen Sie es sofort diesem Container hinzu.', fr: 'Créez un nouvel élément dans {0} et ajoutez-le immédiatement à ce conteneur.', es: 'Cree un nuevo elemento en {0} y agréguelo inmediatamente a este contenedor.' },
  LABEL_CREATE_NEW_DESC_SLIDER: { en: 'Create a new item in Image Slider. It will appear in the connect list — tag it when you are ready to display it.', de: 'Erstellen Sie ein neues Element im Image Slider. Es erscheint in der Verbindungsliste — taggen Sie es, wenn es angezeigt werden soll.', fr: 'Créez un nouvel élément dans le carrousel d\'images. Il apparaîtra dans la liste de connexion — étiquetez-le lorsque vous êtes prêt à l\'afficher.', es: 'Cree un nuevo elemento en el carrusel de imágenes. Aparecerá en la lista de conexión — etiquételo cuando esté listo para mostrarlo.' },
  LABEL_CREATE_NEW_BUTTON: { en: 'Create New {0}', de: 'Neu erstellen {0}', fr: 'Créer un nouveau {0}', es: 'Crear nuevo {0}' },
  LABEL_CONNECT_EXISTING_STEP: { en: '2. Connect Existing {0}', de: '2. Bestehende verbinden {0}', fr: '2. Connecter l\'existant {0}', es: '2. Conectar existente {0}' },
  LABEL_ALREADY_TAGGED_STEP: { en: '3. Already Tagged {0}', de: '3. Bereits getaggt {0}', fr: '3. Déjà étiqueté {0}', es: '3. Ya etiquetado {0}' },
  LABEL_NO_ITEMS_AVAILABLE: { en: 'No items available to tag.', de: 'Keine Elemente zum Taggen verfügbar.', fr: 'Aucun élément disponible à étiqueter.', es: 'No hay elementos disponibles para etiquetar.' },
  LABEL_NO_ITEMS_TAGGED: { en: 'No items tagged yet. Tag items from the left list.', de: 'Noch keine Elemente getaggt. Taggen Sie Elemente aus der linken Liste.', fr: 'Aucun élément étiqueté pour le moment. Étiquetez des éléments dans la liste de gauche.', es: 'Aún no hay elementos etiquetados. Etiquete elementos de la lista de la izquierda.' },
  BTN_CHANGE_ORDER: { en: 'Change order', de: 'Reihenfolge ändern', fr: 'Modifier l\'ordre', es: 'Cambiar orden' },
  BTN_UNTAG: { en: 'Untag', de: 'Tag entfernen', fr: 'Retirer l\'étiquette', es: 'Quitar etiqueta' },
  LABEL_PUBLISHING_STATUS: { en: 'Publishing Status', de: 'Veröffentlichungsstatus', fr: 'Statut de publication', es: 'Estado de publicación' },
  TITLE_CHANGE_ORDER: { en: 'Change order', de: 'Reihenfolge ändern', fr: 'Modifier l\'ordre', es: 'Cambiar orden' },
  MSG_CHANGE_ORDER_HINT: { en: 'Drag or use arrows to change display order.', de: 'Per Drag & Drop oder Pfeile die Anzeigereihenfolge ändern.', fr: 'Glissez-déposez ou utilisez les flèches pour modifier l\'ordre d\'affichage.', es: 'Arrastre o use las flechas para cambiar el orden de visualización.' },
  MSG_DRAG_TO_REORDER: { en: 'Drag to reorder', de: 'Ziehen zum Sortieren', fr: 'Glisser pour réordonner', es: 'Arrastrar para reordenar' },
  BTN_SORT_ASCENDING: { en: 'Ascending', de: 'Aufsteigend', fr: 'Croissant', es: 'Ascendente' },
  BTN_SORT_DESCENDING: { en: 'Descending', de: 'Absteigend', fr: 'Décroissant', es: 'Descendente' },
  LABEL_CURRENT_ITEM_IN_ORDER: { en: 'This item', de: 'Dieses Element', fr: 'Cet élément', es: 'Este elemento' },
  BTN_APPLY_ORDER: { en: 'Apply', de: 'Übernehmen', fr: 'Appliquer', es: 'Aplicar' },
  BTN_MOVE_UP: { en: 'Move up', de: 'Nach oben', fr: 'Monter', es: 'Subir' },
  BTN_MOVE_DOWN: { en: 'Move down', de: 'Nach unten', fr: 'Descendre', es: 'Bajar' },
  MSG_EDIT_CONTAINER_TO_LINK_ITEMS: { en: 'Edit the container to link items.', de: 'Bearbeiten Sie den Container, um Elemente zu verknüpfen.', fr: 'Modifiez le conteneur pour lier des éléments.', es: 'Edite el contenedor para vincular elementos.' },
  PLACEHOLDER_SELECT_OPTION: { en: 'Select an option', de: 'Option auswählen', fr: 'Sélectionnez une option', es: 'Seleccione una opción' },
  LABEL_TAG: { en: 'Tag', de: 'Tag', fr: 'Tag', es: 'Etiquetar' },
  LABEL_LEFT: { en: 'Left', de: 'Links', fr: 'Gauche', es: 'Izquierda' },
  LABEL_CENTER: { en: 'Center', de: 'Zentriert', fr: 'Centre', es: 'Centro' },
  LABEL_RIGHT: { en: 'Right', de: 'Rechts', fr: 'Droite', es: 'Derecha' },
  LABEL_NONE: { en: 'None', de: 'Keine', fr: 'Aucun', es: 'Ninguno' },
  LABEL_SHARP: { en: 'Sharp', de: 'Scharf', fr: 'Vif', es: 'Afilado' },
  LABEL_ROUNDED: { en: 'Rounded', de: 'Abgerundet', fr: 'Arrondi', es: 'Redondeado' },
  LABEL_TOP: { en: 'Top', de: 'Oben', fr: 'Haut', es: 'Arriba' },
  LABEL_BOTTOM: { en: 'Bottom', de: 'Unten', fr: 'Bas', es: 'Abajo' },
  LABEL_GRID: { en: 'Grid', de: 'Raster', fr: 'Grille', es: 'Cuadrícula' },
  BTN_DELETE_SLIDER: { en: 'Delete Slider', de: 'Slider löschen', fr: 'Supprimer le curseur', es: 'Eliminar control deslizante' },
  MSG_CONFIRM_DELETE_SLIDER: { en: 'Are you sure you want to delete this slider container? This will not delete the individual slider items from the main list.', de: 'Sind Sie sicher, dass Sie diesen Slider-Container löschen möchten? Dies löscht nicht die einzelnen Slider-Elemente aus der Hauptliste.', fr: 'Êtes-vous sûr de vouloir supprimer ce conteneur de curseur ? Cela ne supprimera pas les éléments de curseur individuels de la liste principale.', es: '¿Está seguro de que desea eliminar este contenedor de control deslizante? Esto no eliminará los elementos de control deslizante individuales de la lista principal.' },
  BTN_SAVE_CHANGES_SLIDER: { en: 'Save Changes', de: 'Änderungen speichern', fr: 'Enregistrer les modifications', es: 'Guardar cambios' },
  BTN_DELETE_SLIDE_ALT: { en: 'Delete Slide', de: 'Folie löschen', fr: 'Supprimer la diapositive', es: 'Eliminar diapositiva' },
  MSG_CONFIRM_DELETE_SLIDE_LIST_ALT: { en: 'Are you sure you want to delete this slide from the list? This cannot be undone.', de: 'Sind Sie sicher, dass Sie diese Folie aus der Liste löschen möchten? Dies kann nicht rückgängig gemacht werden.', fr: 'Êtes-vous sûr de vouloir supprimer cette diapositive de la liste ? Cela ne peut pas être annulé.', es: '¿Está seguro de que desea eliminar esta diapositiva de la lista? Esto no se puede deshacer.' },
  TITLE_DELETE_SLIDER_ITEM: { en: 'Delete Slider Item', de: 'Slider-Element löschen', fr: 'Supprimer l\'élément du curseur', es: 'Eliminar elemento del control deslizante' },
  MSG_CONFIRM_DELETE_SLIDER_ITEM: { en: 'Are you sure you want to permanently delete this slider item from the SharePoint list? This cannot be undone.', de: 'Sind Sie sicher, dass Sie dieses Slider-Element dauerhaft aus der SharePoint-Liste löschen möchten? Dies kann nicht rückgängig gemacht werden.', fr: 'Êtes-vous sûr de vouloir supprimer définitivement cet élément de curseur de la liste SharePoint ? Cela ne peut pas être annulé.', es: '¿Está seguro de que desea eliminar permanentemente este elemento de control deslizante de la lista de SharePoint? Esto no se puede deshacer.' },
  TITLE_CREATE_SLIDER_ITEM: { en: 'Create Slider Item', de: 'Slider-Element erstellen', fr: 'Créer un élément de curseur', es: 'Crear elemento de control deslizante' },
  PLACEHOLDER_SLIDER_ITEM_TITLE: { en: 'Slider item title', de: 'Slider-Element Titel', fr: 'Titre de l\'élément du curseur', es: 'Título del elemento del control deslizante' },
  TITLE_EDIT_SLIDER_ITEM: { en: 'Edit Slider Item', de: 'Slider-Element bearbeiten', fr: 'Modifier l\'élément du curseur', es: 'Editar elemento del control deslizante' },

  LABEL_SLIDER: { en: 'Slider', de: 'Slider', fr: 'Slider', es: 'Slider' },

  LABEL_SHARP_CORNERS: { en: 'Sharp Corners', de: 'Scharfe Ecken', fr: 'Coins vifs', es: 'Esquinas afiladas' },
  LABEL_ROUNDED_CORNERS: { en: 'Rounded Corners', de: 'Abgerundete Ecken', fr: 'Coins arrondis', es: 'Esquinas redondeadas' },
  LABEL_CIRCLE: { en: 'Circle', de: 'Kreis', fr: 'Cercle', es: 'Círculo' },
  LABEL_HALFCIRCLE: { en: 'Half Circle', de: 'Halbkreis', fr: 'Demi-cercle', es: 'Semicírculo' },
  LABEL_IMAGE_BORDER_SECTION: { en: 'Image Border-radius Section', de: 'Bild-Eckenradius-Bereich', fr: 'Section border-radius de l\'image', es: 'Sección de border-radius de imagen' },
  LABEL_SLIDER_IMAGE_SETTINGS: { en: 'Image Settings', de: 'Bildeinstellungen', fr: 'Paramètres d\'image', es: 'Configuración de imagen' },
  LABEL_IMAGE_CORNER_RADIUS: { en: 'Image Corner Radius', de: 'Bildeckenradius', fr: 'Rayon des coins de l\'image', es: 'Radio de esquina de la imagen' },
  LABEL_ACTION_BUTTON_CORNER_RADIUS: { en: 'Rounded Corners', de: 'Abgerundete Ecken', fr: 'Coins arrondis', es: 'Esquinas redondeadas' },
  LABEL_RADIUS_NONE: { en: 'None (rounded-0)', de: 'Keine (rounded-0)', fr: 'Aucun (rounded-0)', es: 'Ninguno (rounded-0)' },
  LABEL_RADIUS_SM: { en: 'Small (rounded-sm)', de: 'Klein (rounded-sm)', fr: 'Petit (rounded-sm)', es: 'Pequeño (rounded-sm)' },
  LABEL_RADIUS_LG: { en: 'Large (rounded-lg)', de: 'Groß (rounded-lg)', fr: 'Grand (rounded-lg)', es: 'Grande (rounded-lg)' },
  LABEL_RADIUS_FULL: { en: 'Full (rounded-full)', de: 'Voll (rounded-full)', fr: 'Complet (rounded-full)', es: 'Completo (rounded-full)' },
  LABEL_CUSTOM: { en: 'Custom', de: 'Benutzerdefiniert', fr: 'Personnalisé', es: 'Personalizado' },
  LABEL_RADIUS_TOP_LEFT: { en: 'Top Left', de: 'Oben links', fr: 'Haut gauche', es: 'Arriba izquierda' },
  LABEL_RADIUS_TOP_RIGHT: { en: 'Top Right', de: 'Oben rechts', fr: 'Haut droite', es: 'Arriba derecha' },
  LABEL_RADIUS_BOTTOM_LEFT: { en: 'Bottom Left', de: 'Unten links', fr: 'Bas gauche', es: 'Abajo izquierda' },
  LABEL_RADIUS_BOTTOM_RIGHT: { en: 'Bottom Right', de: 'Unten rechts', fr: 'Bas droite', es: 'Abajo derecha' },
  PLACEHOLDER_RADIUS_VALUE: { en: 'e.g. 8px or 1rem', de: 'z. B. 8px oder 1rem', fr: 'ex. 8px ou 1rem', es: 'p. ej. 8px o 1rem' },
  LABEL_FORM_BUILDER: { en: 'Form Builder', de: 'Formular-Baukasten', fr: 'Générateur de formulaires', es: 'Constructor de formularios' },
  LABEL_LIVE_PREVIEW: { en: 'Live Preview', de: 'Live-Vorschau', fr: 'Aperçu en direct', es: 'Previsualización en vivo' },
  LABEL_TITLE_IDENTITY: { en: 'Title & Identity', de: 'Titel & Identität', fr: 'Titre & Identité', es: 'Título e Identidad' },
  LABEL_INPUT_FIELDS: { en: 'Input Fields', de: 'Eingabefelder', fr: 'Champs de saisie', es: 'Campos de entrada' },
  LABEL_LONG_TEXT: { en: 'Long Text', de: 'Langer Text', fr: 'Texte long', es: 'Texto largo' },
  LABEL_DROPDOWN: { en: 'Dropdown', de: 'Dropdown', fr: 'Menu déroulant', es: 'Menú desplegable' },
  LABEL_PRIVACY_POLICY_NOTE: { en: 'I have read the Privacy Policy note. I agree that my contact details and questions will be stored permanently.', de: 'Ich habe den Hinweis zur Datenschutzerklärung gelesen. Ich stimme zu, dass meine Kontaktdaten und Fragen dauerhaft gespeichert werden.', fr: 'J ai lu la note relative a la politique de confidentialite. J accepte que mes coordonnees et mes questions soient conservees durablement.', es: 'He leido la nota de la politica de privacidad. Acepto que mis datos de contacto y mis preguntas se almacenen de forma permanente.' },
  LABEL_SEND_MESSAGE: { en: 'Send Message', de: 'Nachricht senden', fr: 'Envoyer le message', es: 'Enviar mensaje' },
  LABEL_FIELD_LABEL: { en: 'Label', de: 'Label', fr: 'Étiquette', es: 'Etiqueta' },
  LABEL_FIELD_PLACEHOLDER: { en: 'Placeholder', de: 'Platzhalter', fr: 'Espace réservé', es: 'Marcador de posición' },
  LABEL_ADD_FIELD: { en: 'Add Field', de: 'Feld hinzufügen', fr: 'Ajouter un champ', es: 'Añadir campo' },
  LABEL_COL_LABEL_TEXT: { en: 'Label text', de: 'Beschriftungstext', fr: 'Texte du libellé', es: 'Texto de etiqueta' },
  LABEL_COL_PLACEHOLDER_TEXT: { en: 'Placeholder text', de: 'Platzhaltertext', fr: 'Texte du placeholder', es: 'Texto del marcador' },
  LABEL_COL_INPUT_TYPE: { en: 'Type of the input field', de: 'Typ des Eingabefelds', fr: 'Type du champ de saisie', es: 'Tipo de campo de entrada' },
  LABEL_DROPDOWN_OPTIONS: { en: 'Dropdown options', de: 'Dropdown-Optionen', fr: 'Options du menu déroulant', es: 'Opciones del menú desplegable' },
  LABEL_ADD_OPTION: { en: 'Add option', de: 'Option hinzufügen', fr: 'Ajouter une option', es: 'Añadir opción' },
  MSG_CONFIRM_DELETE_CONTACT_FIELD: { en: 'Are you sure you want to delete {0}?', de: 'Möchten Sie {0} wirklich löschen?', fr: 'Voulez-vous vraiment supprimer {0} ?', es: '¿Está seguro de que desea eliminar {0}?' },
  LABEL_FORM_SUBMIT_DESTINATION: { en: 'Form submission destination', de: 'Ziel für Formularübermittlung', fr: 'Destination de soumission du formulaire', es: 'Destino del envío del formulario' },
  PLACEHOLDER_FORM_SUBMIT_DESTINATION: { en: 'email@example.com or https://...', de: 'email@beispiel.de oder https://...', fr: 'email@exemple.com ou https://...', es: 'email@ejemplo.com o https://...' },
  MSG_FORM_SUBMIT_DESTINATION_HINT: { en: 'Enter the email address or URL where form submissions should be sent.', de: 'Geben Sie die E-Mail-Adresse oder URL ein, an die Formularübermittlungen gesendet werden sollen.', fr: 'Saisissez l\'adresse e-mail ou l\'URL vers laquelle les soumissions doivent être envoyées.', es: 'Introduzca la dirección de correo o la URL a la que deben enviarse los formularios.' },
  LABEL_BACKGROUND: { en: 'Background', de: 'Hintergrund', fr: 'Arrière-plan', es: 'Fondo' },
  LABEL_SECTION_BACKGROUND: { en: 'Section Background', de: 'Abschnitt-Hintergrund', fr: 'Arrière-plan de section', es: 'Fondo de sección' },
  LABEL_CARD_BACKGROUND: { en: 'Card Background', de: 'Karten-Hintergrund', fr: 'Arrière-plan de carte', es: 'Fondo de tarjeta' },
  LABEL_TYPOGRAPHY: { en: 'Typography', de: 'Typografie', fr: 'Typographie', es: 'Tipografía' },
  LABEL_HEADING_STYLE: { en: 'Heading style', de: 'Überschrift-Stil', fr: 'Style du titre', es: 'Estilo del encabezado' },
  LABEL_SUBHEADING_STYLE: { en: 'Subheading style', de: 'Untertitel-Stil', fr: 'Style du sous-titre', es: 'Estilo del subtítulo' },
  LABEL_DESCRIPTION_STYLE: { en: 'Description style', de: 'Beschreibungs-Stil', fr: 'Style de la description', es: 'Estilo de la descripción' },
  LABEL_STYLE_HEADING_1: { en: 'Heading 1', de: 'Überschrift 1', fr: 'Titre 1', es: 'Encabezado 1' },
  LABEL_STYLE_HEADING_2: { en: 'Heading 2', de: 'Überschrift 2', fr: 'Titre 2', es: 'Encabezado 2' },
  LABEL_STYLE_HEADING_3: { en: 'Heading 3', de: 'Überschrift 3', fr: 'Titre 3', es: 'Encabezado 3' },
  LABEL_STYLE_HEADING_4: { en: 'Heading 4', de: 'Überschrift 4', fr: 'Titre 4', es: 'Encabezado 4' },
  LABEL_STYLE_HEADING_5: { en: 'Heading 5', de: 'Überschrift 5', fr: 'Titre 5', es: 'Encabezado 5' },
  LABEL_STYLE_HEADING_6: { en: 'Heading 6', de: 'Überschrift 6', fr: 'Titre 6', es: 'Encabezado 6' },
  LABEL_LINE_HEIGHT: { en: 'Line height', de: 'Zeilenhöhe', fr: 'Hauteur de ligne', es: 'Altura de línea' },
  LABEL_STYLE_PARAGRAPH: { en: 'Paragraph', de: 'Absatz', fr: 'Paragraphe', es: 'Párrafo' },
  LABEL_STYLE_CUSTOM: { en: 'Custom', de: 'Benutzerdefiniert', fr: 'Personnalisé', es: 'Personalizado' },
  LABEL_CUSTOM_HEADING_STYLE: { en: 'Custom heading style', de: 'Benutzerdefinierter Überschrift-Stil', fr: 'Style de titre personnalisé', es: 'Estilo de encabezado personalizado' },
  LABEL_CUSTOM_SUBHEADING_STYLE: { en: 'Custom subheading style', de: 'Benutzerdefinierter Untertitel-Stil', fr: 'Style de sous-titre personnalisé', es: 'Estilo de subtítulo personalizado' },
  LABEL_CUSTOM_DESCRIPTION_STYLE: { en: 'Custom description style', de: 'Benutzerdefinierter Beschreibungs-Stil', fr: 'Style de description personnalisé', es: 'Estilo de descripción personalizado' },
  LABEL_LABEL_STYLE: { en: 'Label style', de: 'Label-Stil', fr: 'Style des libellés', es: 'Estilo de etiquetas' },
  LABEL_CUSTOM_LABEL_STYLE: { en: 'Custom label style', de: 'Benutzerdefinierter Label-Stil', fr: 'Style de libellé personnalisé', es: 'Estilo de etiqueta personalizado' },
  LABEL_LINE_HEIGHT_AUTO: { en: 'Auto', de: 'Automatisch', fr: 'Auto', es: 'Automático' },
  LABEL_FONT_WEIGHT_THIN: { en: 'Thin', de: 'Dünn', fr: 'Fin', es: 'Fino' },
  LABEL_FONT_WEIGHT_EXTRALIGHT: { en: 'Extra Light', de: 'Extraleicht', fr: 'Extra léger', es: 'Extraligero' },
  LABEL_FONT_WEIGHT_LIGHT: { en: 'Light', de: 'Leicht', fr: 'Léger', es: 'Ligero' },
  LABEL_FONT_WEIGHT_REGULAR: { en: 'Regular', de: 'Normal', fr: 'Regular', es: 'Regular' },
  LABEL_FONT_WEIGHT_MEDIUM: { en: 'Medium', de: 'Mittel', fr: 'Moyen', es: 'Medio' },
  LABEL_FONT_WEIGHT_SEMIBOLD: { en: 'Semi Bold', de: 'Halbfett', fr: 'Demi-gras', es: 'Seminegrita' },
  LABEL_FONT_WEIGHT_BOLD: { en: 'Bold', de: 'Fett', fr: 'Gras', es: 'Negrita' },
  LABEL_FONT_WEIGHT_EXTRABOLD: { en: 'Extra Bold', de: 'Extrafett', fr: 'Extra gras', es: 'Extranegrita' },
  LABEL_FONT_WEIGHT_BLACK: { en: 'Black', de: 'Schwarz', fr: 'Noir', es: 'Negro' },
  LABEL_CONTENT_DATA: { en: 'Content & Data', de: 'Inhalt & Daten', fr: 'Contenu & Données', es: 'Contenido y Datos' },
  LABEL_TABLE_SETTINGS: { en: 'Table Settings', de: 'Tabelleneinstellungen', fr: 'Paramètres du tableau', es: 'Ajustes de tabla' },
  LABEL_MANAGE_COLUMNS: { en: 'Manage Columns', de: 'Spalten verwalten', fr: 'Gérer les colonnes', es: 'Gestionar columnas' },
  LABEL_ADD_COLUMN: { en: 'Add Column', de: 'Spalte hinzufügen', fr: 'Ajouter une colonne', es: 'Añadir columna' },
  LABEL_COLUMN_HEADER_NAME: { en: 'Column Header Name', de: 'Spaltenüberschrift Name', fr: 'Nom de l\'en-tête de colonne', es: 'Nombre del encabezado de columna' },
  LABEL_NO_COLUMNS_DEFINED: { en: 'No columns defined.', de: 'Keine Spalten definiert.', fr: 'Aucune colonne définie.', es: 'No hay columnas definidas.' },
  LABEL_MANAGE_ROWS: { en: 'Manage Rows', de: 'Zeilen verwalten', fr: 'Gérer les lignes', es: 'Gestionar filas' },
  LABEL_ADD_ROW: { en: 'Add Row', de: 'Zeile hinzufügen', fr: 'Ajouter une ligne', es: 'Añadir fila' },
  LABEL_NO_DATA_ROWS: { en: 'No data rows added.', de: 'Keine Datenzeilen hinzugefügt.', fr: 'Aucune ligne de données ajoutée.', es: 'No se han añadido filas de datos.' },
  LABEL_DISPLAY_TITLE: { en: 'Display Title', de: 'Anzeigetitel', fr: 'Titre d\'affichage', es: 'Título a mostrar' },
  LABEL_ENTER_TABLE_TITLE: { en: 'Enter Table Title', de: 'Tabellentitel eingeben', fr: 'Entrer le titre du tableau', es: 'Introducir título de la tabla' },
  LABEL_TABLE_FEATURES: { en: 'Table Features', de: 'Tabellenfunktionen', fr: 'Fonctionnalités du tableau', es: 'Características de la tabla' },
  LABEL_ENABLE_GLOBAL_SEARCH: { en: 'Enable Global Search', de: 'Globale Suche aktivieren', fr: 'Activer la recherche globale', es: 'Activar búsqueda global' },
  LABEL_ENABLE_COLUMN_SEARCH: { en: 'Enable Column Search', de: 'Spaltensuche aktivieren', fr: 'Activer la recherche par colonne', es: 'Activar búsqueda por colonne' },
  LABEL_ENABLE_SORTING: { en: 'Enable Sorting Icons', de: 'Sortiersymbole aktivieren', fr: 'Activer les icônes de tri', es: 'Activar iconos de ordenación' },
  LABEL_TABLE_TITLE: { en: 'Table Title', de: 'Tabellentitel', fr: 'Titre du tableau', es: 'Título de la tabla' },
  LABEL_MAP_SETTINGS: { en: 'Map Settings', de: 'Karteneinstellungen', fr: 'Paramètres de la carte', es: 'Ajustes de mapa' },
  LABEL_MAP_TITLE: { en: 'Map Title', de: 'Kartentitel', fr: 'Titre de la carte', es: 'Título del mapa' },
  LABEL_MAP_TYPE: { en: 'Map Type', de: 'Kartentyp', fr: 'Type de carte', es: 'Tipo de mapa' },
  LABEL_WORLD_MAP: { en: 'World Map', de: 'Weltkarte', fr: 'Carte du monde', es: 'Mapa del mundo' },
  LABEL_CONTINENT_MAP: { en: 'Continent Map', de: 'Kontinentkarte', fr: 'Carte du continent', es: 'Mapa del continente' },
  LABEL_COUNTRY_MAP: { en: 'Country Map', de: 'Länderkarte', fr: 'Carte du pays', es: 'Mapa del país' },
  LABEL_SELECT_CONTINENT: { en: 'Select Continent', de: 'Kontinent auswählen', fr: 'Sélectionner le continent', es: 'Seleccionar continente' },
  LABEL_SELECT_COUNTRY: { en: 'Select Country', de: 'Land auswählen', fr: 'Sélectionner le pays', es: 'Seleccionar país' },
  LABEL_SELECT_STATE: { en: 'Select State', de: 'Staat auswählen', fr: 'Sélectionner l\'état', es: 'Seleccionar estado' },
  LABEL_INITIAL_LOCATION_SEARCH: { en: 'Initial Location Search', de: 'Anfängliche Standortsuche', fr: 'Recherche de l\'emplacement initial', es: 'Búsqueda de ubicación inicial' },
  LABEL_LOCATION_SEARCH_PLACEHOLDER: { en: 'City, Place, etc.', de: 'Stadt, Ort, etc.', fr: 'Ville, lieu, etc.', es: 'Ciudad, lugar, etc.' },
  LABEL_PAGE_CONTENT_RICH_TEXT: { en: 'Page Content (Rich Text)', de: 'Seiteninhalt (Rich Text)', fr: 'Contenu de la page (texte enrichi)', es: 'Contenido de la página (texto enriquecido)' },
  LABEL_WRITE_PAGE_CONTENT_HERE: { en: 'Write your page content here...', de: 'Schreiben Sie hier Ihren Seiteninhalt...', fr: 'Écrivez votre contenu de page ici...', es: 'Escribe el contenido de tu página aquí...' },
  LABEL_TITLE_COLOR: { en: 'Title Color', de: 'Titelfarbe', fr: 'Couleur du titre', es: 'Color del título' },
  LABEL_TITLE_BACKGROUND: { en: 'Title Background', de: 'Titelhintergrund', fr: 'Arrière-plan du titre', es: 'Fondo del título' },
  LABEL_HEADING_BACKGROUND: { en: 'Heading Background', de: 'Überschriften-Hintergrund', fr: 'Arrière-plan du titre', es: 'Fondo del encabezado' },
  LABEL_HERO_EDITOR: { en: 'Header / Hero Editor', de: 'Header / Hero Editor', fr: 'Éditeur d\'en-tête / Hero', es: 'Editor de cabecera / Hero' },
  LABEL_SLIDER_MANAGER: { en: 'Slider Manager', de: 'Slider-Manager', fr: 'Gestionnaire de curseur', es: 'Gestor de control deslizante' },
  LABEL_DATA_GRID_EDITOR: { en: 'Cards Editor', de: 'Karten-Editor', fr: 'Éditeur de cartes', es: 'Editor de tarjetas' },
  LABEL_CONTACT_FORM_EDITOR: { en: 'Contact Form Editor', de: 'Kontaktformular-Editor', fr: 'Éditeur de formulaire de contact', es: 'Editor de formulario de contacto' },
  LABEL_TABLE_VIEW_EDITOR: { en: 'Table View Editor', de: 'Tabellenansicht-Editor', fr: 'Éditeur de vue tableau', es: 'Editor de vista de tabla' },
  LABEL_MAP_EDITOR: { en: 'Map Editor', de: 'Karten-Editor', fr: 'Éditeur de carte', es: 'Editor de mapa' },
  LABEL_CONTAINER_SECTION_EDITOR: { en: 'Text Template Editor', de: 'Textvorlagen-Editor', fr: 'Éditeur de modèle de texte', es: 'Editor de plantilla de texto' },
  LABEL_CONTAINER_EDITOR: { en: 'Container Editor', de: 'Container-Editor', fr: 'Éditeur de conteneur', es: 'Editor de contenedor' },
  LABEL_EDITOR_NOT_AVAILABLE: { en: 'Editor not available for this container type.', de: 'Editor für diesen Containertyp nicht verfügbar.', fr: 'Éditeur non disponible pour ce type de conteneur.', es: 'Editor no disponible para este tipo de contenedor.' },
  LABEL_CANCEL: { en: 'Cancel', de: 'Abbrechen', fr: 'Annuler', es: 'Cancelar' },
  LABEL_SAVE_CHANGES: { en: 'Save Changes', de: 'Änderungen speichern', fr: 'Enregistrer les modifications', es: 'Guardar cambios' },
  LABEL_DELETE_CONTAINER_CONFIRM_TITLE: { en: 'Delete Container', de: 'Container löschen', fr: 'Supprimer le conteneur', es: 'Eliminar contenedor' },
  LABEL_DELETE_CONTAINER_CONFIRM_MSG: { en: 'Are you sure you want to remove this container from the page? This action cannot be undone.', de: 'Sind Sie sicher, dass Sie diesen Container von der Seite entfernen möchten? Diese Aktion kann nicht rückgängig gemacht werden.', fr: 'Êtes-vous sûr de vouloir supprimer ce conteneur de la page ? Cette action est irréversible.', es: '¿Estás seguro de que deseas eliminar este contenedor de la página? Esta acción no se puede deshacer.' },
  LABEL_PUBLISHED: { en: 'Published', de: 'Veröffentlicht', fr: 'Publié', es: 'Publicado' },
  LABEL_DRAFT: { en: 'Draft', de: 'Entwurf', fr: 'Brouillon', es: 'Borrador' },
  LABEL_PASTE_IMAGE_URL: { en: 'Paste image URL here...', de: 'Bild-URL hier einfügen...', fr: 'Coller l\'URL de l\'image ici...', es: 'Pegue la URL de la imagen aquí...' },
  LABEL_SET_TO_DEFAULT_LOGO: { en: 'Set to Placeholder Image', de: 'Platzhalterbild festlegen', fr: 'Définir comme image placeholder', es: 'Establecer imagen placeholder' },
  LABEL_SET_TO_DEFAULT_IMAGE: { en: 'Set to Placeholder Image', de: 'Platzhalterbild festlegen', fr: 'Définir comme image placeholder', es: 'Establecer imagen placeholder' },
  LABEL_CLEAR_IMAGE: { en: 'Clear Image', de: 'Bild löschen', fr: 'Effacer l\'image', es: 'Borrar imagen' },
  LABEL_INTERNAL_TITLE_NEWS_EXAMPLE: { en: 'e.g. Latest News Grid', de: 'z.B. Aktuelles Nachrichten-Raster', fr: 'p. ex. Grille des dernières nouvelles', es: 'por ejemplo, Cuadrícula de últimas noticias' },
  LABEL_EXISTING_IMAGES: { en: 'Existing Images', de: 'Bestehende Bilder', fr: 'Images existantes', es: 'Imágenes existentes' },
  LABEL_UPLOAD_IMAGE: { en: 'Upload Image', de: 'Bild hochladen', fr: 'Télécharger une image', es: 'Subir imagen' },
  LABEL_SELECT: { en: 'Select', de: 'Auswählen', fr: 'Sélectionner', es: 'Seleccionar' },
  LABEL_NO_IMAGES_IN_LIBRARY: { en: 'No images in library', de: 'Keine Bilder in der Bibliothek', fr: 'Aucune image dans la bibliothèque', es: 'No hay imágenes en la biblioteca' },
  LABEL_CLICK_TO_UPLOAD: { en: 'Click to Upload', de: 'Zum Hochladen klicken', fr: 'Cliquez pour télécharger', es: 'Haz clic para subir' },
  LABEL_LOGO: { en: 'LOGO', de: 'LOGO', fr: 'LOGO', es: 'LOGO' },
  LABEL_TEXT: { en: 'Text', de: 'Text', fr: 'Texte', es: 'Texto' },
  LABEL_NUMBER: { en: 'Number', de: 'Nummer', fr: 'Nombre', es: 'Número' },
  LABEL_CHECKBOX: { en: 'Checkbox', de: 'Kontrollkästchen', fr: 'Case à cocher', es: 'Casilla de verificación' },
  LABEL_EUROPE: { en: 'Europe', de: 'Europa', fr: 'Europe', es: 'Europa' },
  LABEL_ASIA: { en: 'Asia', de: 'Asien', fr: 'Asie', es: 'Asia' },
  LABEL_NORTH_AMERICA: { en: 'North America', de: 'Nordamerika', fr: 'Amérique du Nord', es: 'América del Norte' },
  LABEL_SOUTH_AMERICA: { en: 'South America', de: 'Südamerika', fr: 'Amérique du Sud', es: 'América del Sur' },
  LABEL_AFRICA: { en: 'Africa', de: 'Afrika', fr: 'Afrique', es: 'África' },
  LABEL_OCEANIA: { en: 'Oceania', de: 'Ozeanien', fr: 'Océanie', es: 'Oceanía' },
  LABEL_USA: { en: 'United States', de: 'Vereinigte Staaten', fr: 'États-Unis', es: 'Estados Unidos' },
  LABEL_GERMANY: { en: 'Germany', de: 'Deutschland', fr: 'Allemagne', es: 'Alemania' },
  LABEL_FRANCE: { en: 'France', de: 'Frankreich', fr: 'France', es: 'Francia' },
  LABEL_UK: { en: 'United Kingdom', de: 'Vereinigtes Königreich', fr: 'Royaume-Uni', es: 'Reino Unido' },
  LABEL_INDIA: { en: 'India', de: 'Indien', fr: 'Inde', es: 'India' },
  LABEL_CHINA: { en: 'China', de: 'China', fr: 'Chine', es: 'China' },

  // --- Add Container template modal (Site Management) ---
  TITLE_SELECT_TMPL_HEADER: { en: 'Select Header Template', de: 'Kopfbereich Vorlage auswählen', fr: 'Sélectionner un modèle d\'en-tête', es: 'Seleccionar plantilla de encabezado' },
  TITLE_SELECT_TMPL_SLIDER: { en: 'Select Slider Template', de: 'Slider Vorlage auswählen', fr: 'Sélectionner un modèle de curseur', es: 'Seleccionar plantilla de control deslizante' },
  TITLE_SELECT_TMPL_DATA_GRID: { en: 'Select Cards Template', de: 'Karten-Vorlage auswählen', fr: 'Sélectionner un modèle de cartes', es: 'Seleccionar plantilla de tarjetas' },
  TITLE_SELECT_TMPL_CONTACT_FORM: { en: 'Select Contact Form Template', de: 'Kontaktformular Vorlage auswählen', fr: 'Sélectionner un modèle de formulaire de contact', es: 'Seleccionar plantilla de formulario de contacto' },
  TITLE_SELECT_TMPL_TABLE_VIEW: { en: 'Select Table View Template', de: 'Tabellenansicht Vorlage auswählen', fr: 'Sélectionner un modèle de vue tableau', es: 'Seleccionar plantilla de vista de tabla' },
  TITLE_SELECT_TMPL_MAP: { en: 'Select Map Template', de: 'Karte Vorlage auswählen', fr: 'Sélectionner un modèle de carte', es: 'Seleccionar plantilla de mapa' },
  TITLE_SELECT_TMPL_CONTAINER_SECTION: { en: 'Select Text Template', de: 'Textvorlage auswählen', fr: 'Sélectionner un modèle de texte', es: 'Seleccionar plantilla de texto' },

  TAB_CONTAINER_HEADER: { en: 'Header', de: 'Kopfbereich', fr: 'En-tête', es: 'Encabezado' },
  TAB_CONTAINER_SLIDER: { en: 'Slider', de: 'Slider', fr: 'Slider', es: 'Slider' },
  TAB_CONTAINER_DATA_GRID: { en: 'Cards', de: 'Karten', fr: 'Cartes', es: 'Tarjetas' },
  TAB_CONTAINER_CONTACT_FORM: { en: 'Contact Form', de: 'Kontaktformular', fr: 'Formulaire de contact', es: 'Formulario de contacto' },
  TAB_CONTAINER_TABLE_VIEW: { en: 'Table View', de: 'Tabellenansicht', fr: 'Vue tableau', es: 'Vista de tabla' },
  TAB_CONTAINER_MAP: { en: 'Map', de: 'Karte', fr: 'Carte', es: 'Mapa' },
  TAB_CONTAINER_CONTAINER_SECTION: { en: 'Text Template', de: 'Textvorlage', fr: 'Modèle de texte', es: 'Plantilla de texto' },
  TAB_ORG_TEMPLATES: { en: 'Templates', de: 'Vorlagen', fr: 'Modèles', es: 'Plantillas' },
  BTN_NEW_TEMPLATE: { en: 'New Template', de: 'Neue Vorlage', fr: 'Nouveau modèle', es: 'Nueva plantilla' },
  BTN_CREATE_SECTION_TEMPLATE: { en: 'Create {section} Template', de: '{section}-Vorlage erstellen', fr: 'Créer un modèle {section}', es: 'Crear plantilla {section}' },
  BTN_UNPUBLISH: { en: 'Unpublish', de: 'Veröffentlichung aufheben', fr: 'Dépublier', es: 'Despublicar' },
  TITLE_CREATE_SECTION_TEMPLATE: { en: 'Create {section} Template', de: '{section}-Vorlage erstellen', fr: 'Créer un modèle {section}', es: 'Crear plantilla {section}' },
  TITLE_TEMPLATE_CHOOSE_DATA_SOURCE: { en: 'Choose data source & layout', de: 'Datenquelle & Layout wählen', fr: 'Choisir la source de données et la mise en page', es: 'Elegir fuente de datos y diseño' },
  TITLE_TEMPLATE_CHOOSE_SLIDER_TYPE: { en: 'Choose slider type', de: 'Slider-Typ wählen', fr: 'Choisir le type de curseur', es: 'Elegir tipo de control deslizante' },
  TITLE_TEMPLATE_CHOOSE_MAP_TYPE: { en: 'Choose map type', de: 'Kartentyp wählen', fr: 'Choisir le type de carte', es: 'Elegir tipo de mapa' },
  MSG_TEMPLATE_DATA_SOURCE_HINT: { en: 'Settings and content options depend on the data source. Pick the source your Site Admins will tag items from.', de: 'Einstellungen und Inhalte hängen von der Datenquelle ab. Wählen Sie die Quelle, aus der Site-Admins Elemente markieren.', fr: 'Les paramètres et le contenu dépendent de la source. Choisissez la source depuis laquelle les administrateurs de site étiquetteront les éléments.', es: 'La configuración y el contenido dependen de la fuente de datos. Elija la fuente desde la que los administradores del sitio etiquetarán elementos.' },
  TITLE_EDIT_SECTION_TEMPLATE: { en: 'Edit {section} Template', de: '{section}-Vorlage bearbeiten', fr: 'Modifier le modèle {section}', es: 'Editar plantilla {section}' },
  MSG_NO_SECTION_TEMPLATES_SUPER: { en: 'No {section} templates yet. Click "Create {section} Template" to add one.', de: 'Noch keine {section}-Vorlagen. Klicken Sie auf „{section}-Vorlage erstellen“.', fr: 'Aucun modèle {section} pour l\'instant. Cliquez sur « Créer un modèle {section} ».', es: 'Aún no hay plantillas {section}. Haga clic en «Crear plantilla {section}».' },
  LABEL_EDITABLE_FIELDS_COUNT: { en: 'editable field(s)', de: 'bearbeitbare Feld(er)', fr: 'champ(s) modifiable(s)', es: 'campo(s) editable(s)' },
  LABEL_SECTION_TYPE: { en: 'Section Type', de: 'Abschnittstyp', fr: 'Type de section', es: 'Tipo de sección' },
  BTN_SAVE_AS_TEMPLATE: { en: 'Save As Template', de: 'Als Vorlage speichern', fr: 'Enregistrer comme modèle', es: 'Guardar como plantilla' },
  TITLE_SECTION_TEMPLATES: { en: 'Section Templates', de: 'Abschnittsvorlagen', fr: 'Modèles de section', es: 'Plantillas de sección' },
  TITLE_SAVE_AS_TEMPLATE: { en: 'Save Section As Template', de: 'Abschnitt als Vorlage speichern', fr: 'Enregistrer la section comme modèle', es: 'Guardar sección como plantilla' },
  LABEL_TEMPLATE_NAME: { en: 'Template Name', de: 'Vorlagenname', fr: 'Nom du modèle', es: 'Nombre de plantilla' },
  LABEL_TEMPLATE_DESCRIPTION: { en: 'Description', de: 'Beschreibung', fr: 'Description', es: 'Descripción' },
  LABEL_TEMPLATE_STATUS: { en: 'Status', de: 'Status', fr: 'Statut', es: 'Estado' },
  LABEL_EDITABLE_FIELDS: { en: 'Editable Fields for Site Admins', de: 'Bearbeitbare Felder für Site-Admins', fr: 'Champs modifiables pour les admins de site', es: 'Campos editables para administradores del sitio' },
  LABEL_PUBLISHED_TEMPLATES: { en: 'Published Templates', de: 'Veröffentlichte Vorlagen', fr: 'Modèles publiés', es: 'Plantillas publicadas' },
  LABEL_BUILTIN_PRESETS: { en: 'Built-in Presets', de: 'Integrierte Vorlagen', fr: 'Préréglages intégrés', es: 'Preajustes integrados' },
  MSG_NO_PUBLISHED_TEMPLATES: { en: 'No published templates for this section type. Contact a Super Admin.', de: 'Keine veröffentlichten Vorlagen für diesen Abschnittstyp. Wenden Sie sich an einen Super-Admin.', fr: 'Aucun modèle publié pour ce type de section. Contactez un super administrateur.', es: 'No hay plantillas publicadas para este tipo de sección. Contacte a un superadministrador.' },
  MSG_TEMPLATE_LOCKED_FIELDS: { en: 'Design settings are managed by the selected template and can only be modified by a Super Admin.', de: 'Designeinstellungen werden durch die ausgewählte Vorlage verwaltet und können nur von einem Super-Admin geändert werden.', fr: 'Les paramètres de design sont gérés par le modèle sélectionné et ne peuvent être modifiés que par un super administrateur.', es: 'La configuración de diseño está gestionada por la plantilla seleccionada y solo puede modificarse por un superadministrador.' },
  MSG_TEMPLATE_EDITABLE_FIELDS_HINT: { en: 'Choose which content and design controls Site Admins may use on pages using this template.', de: 'Wählen Sie, welche Inhalts- und Designsteuerungen Site-Admins auf Seiten mit dieser Vorlage nutzen dürfen.', fr: 'Choisissez quels contrôles de contenu et de design les administrateurs de site peuvent utiliser avec ce modèle.', es: 'Elija qué controles de contenido y diseño pueden usar los administradores del sitio con esta plantilla.' },
  TMPL_FIELD_HEADING: { en: 'Heading', de: 'Überschrift', fr: 'Titre', es: 'Encabezado' },
  TMPL_FIELD_SUBHEADING: { en: 'Subheading', de: 'Unterüberschrift', fr: 'Sous-titre', es: 'Subtítulo' },
  TMPL_FIELD_DESCRIPTION: { en: 'Description', de: 'Beschreibung', fr: 'Description', es: 'Descripción' },
  TMPL_FIELD_BG_IMAGE: { en: 'Background / Hero Image', de: 'Hintergrund- / Hero-Bild', fr: 'Image d\'arrière-plan / Hero', es: 'Imagen de fondo / Hero' },
  TMPL_FIELD_BODY: { en: 'Body Content', de: 'Inhalt', fr: 'Contenu', es: 'Contenido' },
  TMPL_FIELD_SOURCE: { en: 'Content Source', de: 'Inhaltsquelle', fr: 'Source de contenu', es: 'Fuente de contenido' },
  TMPL_FIELD_TAGGED_ITEMS: { en: 'Tagged Items', de: 'Markierte Elemente', fr: 'Éléments étiquetés', es: 'Elementos etiquetados' },
  TMPL_FIELD_SHOW_ALL: { en: 'Show All Without Tagging', de: 'Alle ohne Markierung anzeigen', fr: 'Afficher tout sans étiquetage', es: 'Mostrar todo sin etiquetar' },
  TMPL_FIELD_ITEM_COUNT: { en: 'Item Count / Columns', de: 'Anzahl / Spalten', fr: 'Nombre d\'éléments / colonnes', es: 'Cantidad / columnas' },
  TMPL_FIELD_ORDERING: { en: 'Sort Order', de: 'Sortierreihenfolge', fr: 'Ordre de tri', es: 'Orden de clasificación' },
  TMPL_FIELD_SORT_ORDER: { en: 'Section Order', de: 'Abschnittsreihenfolge', fr: 'Ordre de section', es: 'Orden de sección' },
  TMPL_FIELD_VIEW_MODE: { en: 'Grid / List View', de: 'Raster-/Listenansicht', fr: 'Vue grille / liste', es: 'Vista cuadrícula / lista' },
  TMPL_FIELD_BTN_ENABLED: { en: 'Button Enabled', de: 'Schaltfläche aktiviert', fr: 'Bouton activé', es: 'Botón habilitado' },
  TMPL_FIELD_BTN_LABEL: { en: 'Button Label', de: 'Schaltflächentext', fr: 'Libellé du bouton', es: 'Etiqueta del botón' },
  TMPL_FIELD_BTN_URL: { en: 'Button URL', de: 'Schaltflächen-URL', fr: 'URL du bouton', es: 'URL del botón' },
  TMPL_FIELD_DISPLAY_OPTIONS: { en: 'Display Options (show/hide)', de: 'Anzeigeoptionen (ein/aus)', fr: 'Options d\'affichage (afficher/masquer)', es: 'Opciones de visualización (mostrar/ocultar)' },
  TMPL_FIELD_TYPOGRAPHY: { en: 'Typography & Colors', de: 'Typografie & Farben', fr: 'Typographie et couleurs', es: 'Tipografía y colores' },
  TMPL_FIELD_SLIDE_DESIGN: { en: 'Slide Layout & Image', de: 'Slide-Layout & Bild', fr: 'Mise en page et image du slide', es: 'Diseño e imagen del slide' },
  MSG_SLIDE_DESIGN_LOCKED_BY_TEMPLATE: { en: 'Layout and image behavior are defined by the section template. Edit content only.', de: 'Layout und Bildverhalten werden durch die Abschnittsvorlage festgelegt. Nur Inhalte bearbeiten.', fr: 'La mise en page et le comportement de l\'image sont définis par le modèle de section. Modifiez uniquement le contenu.', es: 'El diseño y el comportamiento de la imagen los define la plantilla de sección. Edite solo el contenido.' },
  MSG_TEMPLATE_SLIDE_LAYOUT_HINT: { en: 'Default layout applied to all slides. Site Admins edit content only unless you enable Slide Layout & Image permissions.', de: 'Standardlayout für alle Slides. Site Admins bearbeiten nur Inhalte, sofern Sie Slide-Layout & Bild nicht freigeben.', fr: 'Mise en page par défaut pour toutes les diapositives. Les admins de site modifient uniquement le contenu sauf si vous activez les permissions.', es: 'Diseño predeterminado para todas las diapositivas. Los administradores del sitio solo editan contenido salvo que habilite los permisos.' },
  MSG_TEMPLATE_SLIDER_PERMISSIONS_HINT: { en: 'Check each Settings section to allow Site Admins to change it. Unchecked sections stay locked to your template defaults (layout, autoplay, typography, etc.).', de: 'Aktivieren Sie jeden Einstellungsbereich, den Site Admins ändern dürfen. Deaktivierte Bereiche bleiben an Ihre Vorlagen-Standards gebunden.', fr: 'Cochez chaque section Paramètres que les admins de site peuvent modifier. Les sections non cochées restent verrouillées sur vos valeurs de modèle.', es: 'Marque cada sección de Configuración que los administradores del sitio puedan cambiar. Las secciones sin marcar permanecen bloqueadas con los valores de la plantilla.' },
  TMPL_FIELD_LAYOUT_BEHAVIOR: { en: 'Layout & Behavior', de: 'Layout & Verhalten', fr: 'Mise en page et comportement', es: 'Diseño y comportamiento' },
  TMPL_FIELD_HERO_DESIGN: { en: 'Hero Design (background & layout)', de: 'Hero-Design (Hintergrund & Layout)', fr: 'Design Hero (arrière-plan et mise en page)', es: 'Diseño Hero (fondo y diseño)' },
  TMPL_FIELD_FORM_DESIGN: { en: 'Form Design (background & corners)', de: 'Formular-Design (Hintergrund & Ecken)', fr: 'Design du formulaire (arrière-plan et coins)', es: 'Diseño del formulario (fondo y esquinas)' },
  TMPL_FIELD_CARD_STYLE: { en: 'Card Style (item typography)', de: 'Kartenstil (Element-Typografie)', fr: 'Style de carte (typographie des éléments)', es: 'Estilo de tarjeta (tipografía de elementos)' },
  TMPL_FIELD_CARD_SETTINGS: { en: 'Card Settings (read more, layout)', de: 'Karteneinstellungen (Mehr lesen, Layout)', fr: 'Paramètres de carte (lire la suite, mise en page)', es: 'Configuración de tarjetas (leer más, diseño)' },
  TMPL_CATEGORY_CONTENT: { en: 'Content', de: 'Inhalt', fr: 'Contenu', es: 'Contenido' },
  TMPL_CATEGORY_DISPLAY: { en: 'Display & Layout', de: 'Anzeige & Layout', fr: 'Affichage et mise en page', es: 'Visualización y diseño' },
  TMPL_CATEGORY_DESIGN: { en: 'Design', de: 'Design', fr: 'Design', es: 'Diseño' },
  TMPL_FIELD_BIND_PAGE: { en: 'Bind Page Title & Description', de: 'Seitentitel & -beschreibung binden', fr: 'Lier titre et description de page', es: 'Vincular título y descripción de página' },
  TMPL_FIELD_FORM_FIELDS: { en: 'Form Fields', de: 'Formularfelder', fr: 'Champs du formulaire', es: 'Campos del formulario' },
  TMPL_FIELD_MAP_TYPE: { en: 'Map Type', de: 'Kartentyp', fr: 'Type de carte', es: 'Tipo de mapa' },
  TMPL_FIELD_MAP_REGION: { en: 'Region / Continent / Country', de: 'Region / Kontinent / Land', fr: 'Région / continent / pays', es: 'Región / continente / país' },
  TMPL_FIELD_MAP_STATE: { en: 'State (India)', de: 'Bundesstaat (Indien)', fr: 'État (Inde)', es: 'Estado (India)' },
  TMPL_FIELD_LOCATION_SEARCH: { en: 'Initial Location Search', de: 'Anfängliche Standortsuche', fr: 'Recherche de lieu initiale', es: 'Búsqueda de ubicación inicial' },
  TMPL_FIELD_MAP_TITLE_TRANSLATION: { en: 'Map Title (Translation)', de: 'Kartentitel (Übersetzung)', fr: 'Titre de la carte (traduction)', es: 'Título del mapa (traducción)' },
  TMPL_FIELD_MAP_SETTINGS: { en: 'Map Settings', de: 'Karteneinstellungen', fr: 'Paramètres de la carte', es: 'Configuración del mapa' },
  TMPL_MAP_WORLD_LABEL: { en: 'World Map', de: 'Weltkarte', fr: 'Carte du monde', es: 'Mapa mundial' },
  TMPL_MAP_WORLD_DESC: { en: 'Interactive world map for global location display.', de: 'Interaktive Weltkarte für globale Standortanzeige.', fr: 'Carte du monde interactive pour l\'affichage mondial.', es: 'Mapa mundial interactivo para ubicaciones globales.' },
  TMPL_MAP_CONTINENT_LABEL: { en: 'Continent Map', de: 'Kontinentkarte', fr: 'Carte continentale', es: 'Mapa continental' },
  TMPL_MAP_CONTINENT_DESC: { en: 'Focused map view for a selected continent.', de: 'Fokussierte Kartenansicht für einen ausgewählten Kontinent.', fr: 'Vue carte centrée sur un continent.', es: 'Vista de mapa centrada en un continente.' },
  TMPL_MAP_COUNTRY_LABEL: { en: 'Country Map', de: 'Landkarte', fr: 'Carte pays', es: 'Mapa de país' },
  TMPL_MAP_COUNTRY_DESC: { en: 'Country-level map with optional state drill-down.', de: 'Landkarte mit optionaler Bundesstaat-Ansicht.', fr: 'Carte au niveau pays avec zoom régional optionnel.', es: 'Mapa a nivel país con detalle opcional de estados.' },
  TMPL_MAP_BRIEFWAHL_LABEL: { en: 'Briefwahl Portal', de: 'Briefwahl-Portal', fr: 'Portail Briefwahl', es: 'Portal Briefwahl' },
  TMPL_MAP_BRIEFWAHL_DESC: { en: 'Specialized portal layout for postal voting information.', de: 'Spezialisiertes Portal für Briefwahl-Informationen.', fr: 'Portail spécialisé pour les informations de vote par correspondance.', es: 'Portal especializado para información de voto por correo.' },
  TMPL_MAP_EUROPAWAHL_LABEL: { en: 'Europawahl Portal', de: 'Europawahl-Portal', fr: 'Portail Europawahl', es: 'Portal Europawahl' },
  TMPL_MAP_EUROPAWAHL_DESC: { en: 'European election information portal with interactive map.', de: 'Europawahl-Informationsportal mit interaktiver Karte.', fr: 'Portail d\'information pour les élections européennes.', es: 'Portal de información para elecciones europeas.' },

  TMPL_HERO_IMG_LABEL: { en: 'Header with image background', de: 'Header mit Bildhintergrund', fr: 'En-tête avec fond d\'image', es: 'Encabezado con fondo de imagen' },
  TMPL_HERO_IMG_DESC: { en: 'Full-width header with a background image and overlay text. Ideal for landing pages.', de: 'Volle Breite mit Bildhintergrund und Text. Ideal für Landingpages.', fr: 'En-tête pleine largeur avec image de fond et texte. Idéal pour les pages d\'atterrissage.', es: 'Encabezado a todo ancho con imagen de fondo y texto. Ideal para páginas de destino.' },
  /** Sample copy for new “Header with image background” hero (matches template preview). */
  DEFAULT_HERO_IMG_SAMPLE_HEADING: { en: 'Add your heading here', de: 'Überschrift hier eintragen', fr: 'Ajoutez votre titre ici', es: 'Añada su título aquí' },
  DEFAULT_HERO_IMG_SAMPLE_SUBHEADING: { en: 'Add short subheading here', de: 'Kurzen Untertitel hier eintragen', fr: 'Ajoutez un court sous-titre ici', es: 'Añada un subtítulo breve aquí' },
  DEFAULT_HERO_IMG_SAMPLE_BTN: { en: 'Get started', de: 'Jetzt starten', fr: 'Commencer', es: 'Empezar' },
  /** “Text header / page content” fullscreen template preview (design 2.1). */
  DEFAULT_PAGE_CONTENT_PREVIEW_HEADING: { en: 'Add your heading here', de: 'Überschrift hier einfügen', fr: 'Ajoutez votre titre ici', es: 'Añada su título aquí' },
  DEFAULT_PAGE_CONTENT_PREVIEW_SUBHEADING: { en: 'Add a short subheading here', de: 'Kurzen Untertitel hier einfügen', fr: 'Ajoutez un court sous-titre ici', es: 'Añada un subtítulo breve aquí' },
  DEFAULT_PAGE_CONTENT_PREVIEW_BODY: {
    en: 'This is a short paragraph where you can highlight your unique value proposition or introduce your company. Mention how your solution helps users and what makes it worth their time.',
    de: 'Dies ist ein kurzer Absatz für Ihr Alleinstellungsmerkmal oder eine Unternehmensvorstellung. Beschreiben Sie, wie Ihre Lösung hilft und warum sie sich lohnt.',
    fr: 'Court paragraphe pour votre proposition de valeur ou la présentation de votre entreprise. Expliquez comment votre solution aide et pourquoi elle mérite l’attention.',
    es: 'Párrafo breve para su propuesta de valor o presentación de la empresa. Explique cómo ayuda su solución y por qué merece la pena.'
  },
  TMPL_PAGE_CONTENT_LABEL: { en: 'Text Header', de: 'Text-Header', fr: 'En-tête texte', es: 'Encabezado de texto' },
  TMPL_PAGE_CONTENT_DESC: { en: 'A clear, direct layout for important information and updates.', de: 'Ein klarer und direkter Ansatz. Nutzen Sie diesen Bereich für wichtige Informationen und Updates.', fr: 'Une mise en page claire pour les informations et mises à jour importantes.', es: 'Un diseño claro para información importante y actualizaciones.' },
  TMPL_HEADER_COLOR_BG_LABEL: { en: 'Header with color background', de: 'Header mit farbigem Hintergrund', fr: 'En-tête avec fond coloré', es: 'Encabezado con fondo de color' },
  TMPL_HEADER_COLOR_BG_DESC: { en: 'Solid color background behind your title and content. Quick to brand and easy to read.', de: 'Einfarbiger Hintergrund hinter Titel und Inhalt. Schnell an die Marke anpassbar.', fr: 'Fond uni derrière le titre et le contenu. Rapide à mettre aux couleurs de la marque.', es: 'Fondo sólido detrás del título y el contenido. Fácil de alinear con la marca.' },
  TMPL_VISUAL_TEXT_LABEL: { en: 'Image & Text', de: 'Bild & Text', fr: 'Image et texte', es: 'Imagen y texto' },
  TMPL_VISUAL_TEXT_DESC: { en: 'Balance visuals and copy. Ideal for highlights, testimonials, or introductions.', de: 'Kombinieren Sie Bild und Text ausgewogen. Ideal für Highlights, Referenzen oder Serviceeinführungen mit gleichwertiger Gewichtung.', fr: 'Équilibrez visuels et texte. Idéal pour les points forts ou témoignages.', es: 'Equilibre imagen y texto. Ideal para destacados o testimonios.' },
  TMPL_IMG_GALLERY_LABEL: { en: 'Image Gallery Carousel', de: 'Bildergalerie-Karussell', fr: 'Carrousel galerie d\'images', es: 'Carrusel de galería de imágenes' },
  TMPL_IMG_GALLERY_DESC: { en: 'A gallery-style carousel with a main image and thumbnail navigation.', de: 'Ein Galerie-Karussell mit Hauptbild und Thumbnail-Navigation.', fr: 'Carrousel avec image principale et miniatures.', es: 'Carrusel con imagen principal y miniaturas.' },
  TMPL_IMG_TEXT_LABEL: { en: 'Image / Text Slider', de: 'Bild-/Text-Slider', fr: 'Curseur image / texte', es: 'Control deslizante imagen / texto' },
  TMPL_CARDS_GRID_3_LABEL: { en: '3-Column Card Grid', de: '3-Spalten-Kartenraster', fr: 'Grille de cartes 3 colonnes', es: 'Cuadrícula de tarjetas de 3 columnas' },
  TMPL_CARDS_GRID_3_DESC: { en: 'Display content in a responsive three-column card grid. Ideal for news, services, or feature highlights.', de: 'Inhalte in einem responsiven Drei-Spalten-Kartenraster. Ideal für News, Services oder Highlights.', fr: 'Affichez le contenu en grille de cartes à trois colonnes.', es: 'Muestra contenido en una cuadrícula de tres columnas.' },
  TMPL_CARDS_SLIDER_LABEL: { en: 'Card Slider', de: 'Karten-Slider', fr: 'Curseur de cartes', es: 'Control deslizante de tarjetas' },
  TMPL_CARDS_SLIDER_DESC: { en: 'Horizontal card carousel with navigation arrows. Great for showcasing multiple items in limited space.', de: 'Horizontaler Karten-Karussell mit Pfeilen. Ideal für viele Inhalte auf wenig Platz.', fr: 'Carrousel horizontal de cartes avec flèches de navigation.', es: 'Carrusel horizontal de tarjetas con flechas de navegación.' },
  TMPL_CARDS_2COL_LABEL: { en: '2-Column Card Grid', de: '2-Spalten-Kartenraster', fr: 'Grille de cartes 2 colonnes', es: 'Cuadrícula de tarjetas de 2 columnas' },
  TMPL_CARDS_2COL_DESC: { en: 'Two-column layout with image-left cards. Suited for detailed content with visuals.', de: 'Zwei-Spalten-Layout mit Bild-links-Karten. Für detaillierte Inhalte mit Bildern.', fr: 'Mise en page deux colonnes avec image à gauche.', es: 'Diseño de dos columnas con imagen a la izquierda.' },
  TMPL_CONTACT_CENTERED_LABEL: { en: 'Centered Contact Form', de: 'Zentriertes Kontaktformular', fr: 'Formulaire de contact centré', es: 'Formulario de contacto centrado' },
  TMPL_CONTACT_CENTERED_DESC: { en: 'Clean centered contact form with name, email, and message fields.', de: 'Klares zentriertes Kontaktformular mit Name, E-Mail und Nachricht.', fr: 'Formulaire de contact centré avec nom, e-mail et message.', es: 'Formulario de contacto centrado con nombre, correo y mensaje.' },
  TMPL_CONTACT_LEFT_LABEL: { en: 'Left-Aligned Contact Form', de: 'Linksbündiges Kontaktformular', fr: 'Formulaire de contact aligné à gauche', es: 'Formulario de contacto alineado a la izquierda' },
  TMPL_CONTACT_LEFT_DESC: { en: 'Left-aligned contact form layout for content-heavy pages.', de: 'Linksbündiges Kontaktformular für textlastige Seiten.', fr: 'Formulaire aligné à gauche pour les pages riches en contenu.', es: 'Formulario alineado a la izquierda para páginas con mucho contenido.' },
  TMPL_IMG_TEXT_DESC: { en: 'A classic slider that shows one item at a time with navigation arrows.', de: 'Ein klassischer Slider, der jeweils ein Element mit Navigationspfeilen anzeigt.', fr: 'Curseur classique avec une slide à la fois et flèches de navigation.', es: 'Control deslizante clásico con una diapositiva y flechas.' },
  TMPL_CONTAINER_SECTION_CARD_LABEL: { en: 'Text Template', de: 'Textvorlage', fr: 'Modèle de texte', es: 'Plantilla de texto' },
  TMPL_CONTAINER_SECTION_CARD_DESC: { en: 'A simple container for text content. Ideal for policies, articles, and informational pages.', de: 'Ein klarer Container für reine Textinhalte. Perfekt für Richtlinien, Artikel und Informationsseiten.', fr: 'Conteneur simple pour le texte : politiques, articles, pages d\'information.', es: 'Contenedor de texto para políticas, artículos e información.' },
  LABEL_SHOW_TITLE_UNDERLINE: { en: 'Show line under title', de: 'Linie unter dem Titel anzeigen', fr: 'Afficher la ligne sous le titre', es: 'Mostrar línea bajo el título' },
  LABEL_BIND_PAGE_TITLE_DESCRIPTION: { en: 'Bind Page Title & Description', de: 'Seitentitel & -beschreibung binden', fr: 'Lier le titre et la description de la page', es: 'Vincular título y descripción de la página' },
  TOOLTIP_BIND_PAGE_TITLE_DESCRIPTION: {
    en: 'When enabled, the Text Template will automatically display the current Page Title and Page Description instead of manually entered content.',
    de: 'Wenn aktiviert, zeigt die Textvorlage automatisch den aktuellen Seitentitel und die Seitenbeschreibung an, anstatt manuell eingegebener Inhalte.',
    fr: 'Lorsque cette option est activée, le modèle de texte affiche automatiquement le titre et la description actuels de la page au lieu du contenu saisi manuellement.',
    es: 'Cuando está activado, la plantilla de texto muestra automáticamente el título y la descripción actuales de la página en lugar del contenido introducido manualmente.',
  },

  BTN_SHOW_PREVIEW: { en: 'Show Preview', de: 'Vorschau anzeigen', fr: 'Afficher l\'aperçu', es: 'Mostrar vista previa' },
  BTN_CHANGE_IMAGE: { en: 'Change Image', de: 'Bild ändern', fr: 'Changer l\'image', es: 'Cambiar imagen' },
  BTN_CONTINUE: { en: 'Continue', de: 'Weiter', fr: 'Continuer', es: 'Continuar' },

  TITLE_CONFIGURE_HEADER: { en: 'Configure Header', de: 'Kopfbereich konfigurieren', fr: 'Configurer l\'en-tête', es: 'Configurar encabezado' },
  LINK_CHANGE_TEMPLATE: { en: 'Change Template', de: 'Vorlage wechseln', fr: 'Changer de modèle', es: 'Cambiar plantilla' },
  TAB_TRANSLATION_UI: { en: 'Translation', de: 'Übersetzung', fr: 'Traduction', es: 'Traducción' },
  LABEL_ORIGINAL_CONTAINER_TITLE: { en: 'Original Container Title', de: 'Originaler Container-Titel', fr: 'Titre du conteneur d\'origine', es: 'Título original del contenedor' },
  LABEL_ORIGINAL_HEADING: { en: 'Original Heading', de: 'Originalüberschrift', fr: 'Titre d\'origine', es: 'Encabezado original' },
  LABEL_TRANSLATED_HEADING_FIELD: { en: 'Translated Heading', de: 'Übersetzte Überschrift', fr: 'Titre traduit', es: 'Encabezado traducido' },
  LABEL_TARGET_LANG: { en: 'Target', de: 'Ziel', fr: 'Cible', es: 'Destino' },
  PLACEHOLDER_ENTER_CONTAINER_TITLE: { en: 'Enter Container Title', de: 'Container-Titel eingeben', fr: 'Entrer le titre du conteneur', es: 'Introducir título del contenedor' },
  PLACEHOLDER_ENTER_MAIN_HEADING: { en: 'Enter Main Heading', de: 'Hauptüberschrift eingeben', fr: 'Entrer le titre principal', es: 'Introducir encabezado principal' },
  PLACEHOLDER_TRANSLATION_INPUT: { en: 'Enter translation', de: 'Übersetzung eingeben', fr: 'Entrer la traduction', es: 'Introducir traducción' },

  TITLE_EDIT_CONTACT_FORM_TEMPLATE: { en: 'Edit Contact Form Template', de: 'Kontaktformular-Vorlage bearbeiten', fr: 'Modifier le modèle de formulaire de contact', es: 'Editar plantilla de formulario de contacto' },
  TAB_TEXT_UPPER: { en: 'TEXT', de: 'TEXT', fr: 'TEXTE', es: 'TEXTO' },
  TAB_PREVIEW_UPPER: { en: 'PREVIEW', de: 'VORSCHAU', fr: 'APERÇU', es: 'VISTA PREVIA' },
  SECTION_HEADING_BLOCK: { en: 'Heading Section', de: 'Überschriftenbereich', fr: 'Section titre', es: 'Sección de encabezado' },
  SECTION_BACKGROUND_BLOCK: { en: 'Background Section', de: 'Hintergrundbereich', fr: 'Section arrière-plan', es: 'Sección de fondo' },
  LABEL_SUBHEADING_FIELD: { en: 'Subheading', de: 'Untertitel', fr: 'Sous-titre', es: 'Subtítulo' },
  PLACEHOLDER_FORM_TITLE: { en: 'Form Title', de: 'Formulartitel', fr: 'Titre du formulaire', es: 'Título del formulario' },
  PLACEHOLDER_OPTIONAL_SUBTITLE: { en: 'Optional Subtitle', de: 'Optionaler Untertitel', fr: 'Sous-titre facultatif', es: 'Subtítulo opcional' },
  PLACEHOLDER_SHORT_DESCRIPTION: { en: 'Short description...', de: 'Kurzbeschreibung...', fr: 'Brève description...', es: 'Breve descripción...' },
  LABEL_ALIGNMENT_BLOCK: { en: 'Alignment', de: 'Ausrichtung', fr: 'Alignement', es: 'Alineación' },
  ALIGN_CENTER_LABEL: { en: 'Center', de: 'Zentriert', fr: 'Centre', es: 'Centro' },
  ALIGN_LEFT_LABEL: { en: 'Left', de: 'Links', fr: 'Gauche', es: 'Izquierda' },
  BG_NONE: { en: 'No Background', de: 'Kein Hintergrund', fr: 'Sans arrière-plan', es: 'Sin fondo' },
  BG_COLOR: { en: 'Color', de: 'Farbe', fr: 'Couleur', es: 'Color' },
  BG_SITE_COLOR: { en: 'Site Color', de: 'Website-Farbe', fr: 'Couleur du site', es: 'Color del sitio' },
  BG_IMAGE: { en: 'Image', de: 'Bild', fr: 'Image', es: 'Imagen' },
  MSG_USES_SITE_BG_FROM_THEME: { en: 'Uses site background color from Theme settings.', de: 'Verwendet die Website-Hintergrundfarbe aus den Theme-Einstellungen.', fr: 'Utilise la couleur d\'arrière-plan du thème.', es: 'Usa el color de fondo del tema.' },
  LABEL_COLOR_SHORT: { en: 'Color', de: 'Farbe', fr: 'Couleur', es: 'Color' },
  LABEL_FIELD_REQUIRED_SUFFIX: { en: '(Required)', de: '(Pflichtfeld)', fr: '(Obligatoire)', es: '(Obligatorio)' },
  LABEL_NEW_FIELD: { en: 'New Field', de: 'Neues Feld', fr: 'Nouveau champ', es: 'Nuevo campo' },
  LABEL_TYPE_FIELD: { en: 'Type', de: 'Typ', fr: 'Type', es: 'Tipo' },
  LABEL_REQUIRED_FIELD_CHECK: { en: 'Required Field', de: 'Pflichtfeld', fr: 'Champ obligatoire', es: 'Campo obligatorio' },

  MSG_CONTACT_FORM_CUSTOMIZE_HINT: {
    en: 'Press "Continue" to customize the contact form.',
    de: 'Klicken Sie auf „Weiter“, um das Kontaktformular anzupassen.',
    fr: 'Appuyez sur « Continuer » pour personnaliser le formulaire de contact.',
    es: 'Pulse « Continuar » para personalizar el formulario de contacto.'
  },
  TOOLTIP_EDIT_CONTACT_FORM: { en: 'Edit contact form', de: 'Kontaktformular bearbeiten', fr: 'Modifier le formulaire de contact', es: 'Editar formulario de contacto' },

  MSG_TABLE_PREVIEW_PLACEHOLDER: { en: 'Data will appear here...', de: 'Daten werden hier angezeigt...', fr: 'Les données s\'afficheront ici...', es: 'Los datos aparecerán aquí...' },
  TABLE_PREVIEW_HEADER: { en: 'Table Preview', de: 'Tabellenvorschau', fr: 'Aperçu du tableau', es: 'Vista previa de la tabla' },

  PREVIEW_CONTAINER_SECTION_TITLE: { en: 'Text Template', de: 'Textvorlage', fr: 'Modèle de texte', es: 'Plantilla de texto' },
  PREVIEW_CONTAINER_SECTION_DESC: { en: 'A clean container for text content. Perfect for policies, articles, and informational pages.', de: 'Ein klarer Container für reine Textinhalte. Perfekt für Richtlinien, Artikel und Informationsseiten.', fr: 'Conteneur texte pour politiques, articles et pages d\'information.', es: 'Contenedor de texto para políticas, artículos e información.' },

  MAP_TYPE_BRIEFWAHL: { en: 'Postal Voting Portal', de: 'Briefwahl Portal', fr: 'Portail vote postal', es: 'Portal de voto postal' },
  MAP_TYPE_EUROPAWAHL: { en: 'Europawahl', de: 'Europawahl', fr: 'Europawahl', es: 'Europawahl' },
  LABEL_SELECT_DASH: { en: '-- Select --', de: '-- Auswählen --', fr: '-- Sélectionner --', es: '-- Seleccionar --' },

  DATA_SOURCE_CONTAINER_ITEMS: { en: 'Container Items', de: 'Container-Elemente', fr: 'Éléments de conteneur', es: 'Elementos de contenedor' },

  CONTAINER_TYPE_HERO: { en: 'Hero Header', de: 'Hero-Kopfbereich', fr: 'En-tête Hero', es: 'Encabezado Hero' },
  CONTAINER_TYPE_CONTACT_FORM: { en: 'Contact Form', de: 'Kontaktformular', fr: 'Formulaire de contact', es: 'Formulario de contacto' },
  CONTAINER_TYPE_IMAGE_TEXT: { en: 'Image & Text', de: 'Bild & Text', fr: 'Image et texte', es: 'Imagen y texto' },
  CONTAINER_TYPE_SLIDER: { en: 'Content Slider', de: 'Inhalts-Slider', fr: 'Curseur de contenu', es: 'Control deslizante de contenido' },
  CONTAINER_TYPE_CARD_GRID: { en: 'Card Grid', de: 'Kartenraster', fr: 'Grille de cartes', es: 'Cuadrícula de tarjetas' },
  CONTAINER_TYPE_DATA_GRID: { en: 'Cards', de: 'Karten', fr: 'Cartes', es: 'Tarjetas' },
  CONTAINER_TYPE_TABLE: { en: 'Table View', de: 'Tabellenansicht', fr: 'Vue tableau', es: 'Vista de tabla' },
  CONTAINER_TYPE_MAP: { en: 'Map', de: 'Karte', fr: 'Carte', es: 'Mapa' },
  CONTAINER_TYPE_CONTAINER_SECTION: { en: 'Text Template', de: 'Textvorlage', fr: 'Modèle de texte', es: 'Plantilla de texto' },
  CONTAINER_TYPE_DEFAULT: { en: 'Standard Section', de: 'Standard-Abschnitt', fr: 'Section standard', es: 'Sección estándar' },

  LABEL_CONTAINER_TITLE_SHORT: { en: 'Container Title', de: 'Container-Titel', fr: 'Titre du conteneur', es: 'Título del contenedor' },
  LABEL_CONTENT_PREVIEW: { en: 'Content Preview', de: 'Inhaltsvorschau', fr: 'Aperçu du contenu', es: 'Vista previa del contenido' },

  // --- FOOTER MANAGER LABELS ---
  LBL_BG_COLOR: { en: 'Background Color', de: 'Hintergrundfarbe', fr: 'Couleur de fond', es: 'Color de fondo' },
  LBL_COLOR_WHITE: { en: 'White', de: 'Weiß', fr: 'Blanc', es: 'Blanco' },
  LBL_COLOR_GREY: { en: 'Light Grey', de: 'Hellgrau', fr: 'Gris clair', es: 'Gris claro' },
  LBL_COLOR_SITE: { en: 'Site Color', de: 'Website-Farbe', fr: 'Couleur du site', es: 'Color del sitio' },
  LBL_COLOR_OTHER: { en: 'Other', de: 'Andere', fr: 'Autre', es: 'Otro' },
  LBL_FOOTER_SETTINGS: { en: 'Footer Settings', de: 'Fußzeileneinstellungen', fr: 'Paramètres de pied de page', es: 'Configuración de pie de página' },
  LBL_SUB_FOOTER_TEXT: { en: 'Sub-Footer Text', de: 'Unter-Fußzeilen-Text', fr: 'Texte sous le pied de page', es: 'Texto sub-pie de página' },
  LBL_FONT_SIZE_SETTINGS: { en: 'Font Size Settings', de: 'Schriftgrößeneinstellungen', fr: 'Paramètres de taille de police', es: 'Configuración de tamaño de fuente' },
  LBL_HEADING_SIZE: { en: 'Heading Size', de: 'Überschriftgröße', fr: 'Taille du titre', es: 'Tamaño del encabezado' },
  LBL_SUBHEADING_SIZE: { en: 'Subheading Size', de: 'Untertitelgröße', fr: 'Taille du sous-titre', es: 'Tamaño del subencabezado' },
  LBL_SELECT_TEMPLATE: { en: 'Select Template', de: 'Vorlage auswählen', fr: 'Sélectionner un modèle', es: 'Seleccionar plantilla' },
  LBL_VISUAL: { en: 'Visual', de: 'Visuell', fr: 'Visuel', es: 'Visual' },
  LBL_LIST: { en: 'List', de: 'Liste', fr: 'Liste', es: 'Lista' },
  LBL_BUILDER: { en: 'Builder', de: 'Builder', fr: 'Constructeur', es: 'Constructor' },
  LBL_LAYOUT_BUILDER: { en: 'Layout Builder', de: 'Layout-Builder', fr: 'Constructeur de mise en page', es: 'Constructor de diseño' },
  LBL_FOOTER_CONFIG: { en: 'Footer Configuration', de: 'Fußzeilen-Konfiguration', fr: 'Configuration du pied de page', es: 'Configuración de pie de página' },
  LBL_FOOTER_AREA: { en: 'Footer Area', de: 'Fußzeilenbereich', fr: 'Zone de pied de page', es: 'Área de pie de página' },
  LBL_INSIDE: { en: 'Inside', de: 'Innerhalb', fr: 'À l\'intérieur de', es: 'Dentro de' },
  LBL_LABEL_TEXT: { en: 'Label Text', de: 'Beschriftungstext', fr: 'Texte du libellé', es: 'Texto de etiqueta' },
  LBL_DESTINATION_URL: { en: 'Destination URL', de: 'Ziel-URL', fr: 'URL de destination', es: 'URL de destino' },
  LBL_COLUMN_HEADING: { en: 'Column Heading', de: 'Spaltenüberschrift', fr: 'En-tête de colonne', es: 'Encabezado de columna' },
  LBL_COLUMN_1: { en: 'Column 1 (Brand & Address)', de: 'Spalte 1 (Marke & Adresse)', fr: 'Colonne 1 (Marque & Adresse)', es: 'Columna 1 (Marca y Dirección)' },
  LBL_COLUMN_2_SOCIAL: { en: 'Column 2 (Social Links)', de: 'Spalte 2 (Soziale Links)', fr: 'Colonne 2 (Liens sociaux)', es: 'Columna 2 (Redes sociales)' },
  LBL_COLUMN_3: { en: 'Column 3 (Contact Info)', de: 'Spalte 3 (Kontaktinfo)', fr: 'Colonne 3 (Infos contact)', es: 'Columna 3 (Información de contacto)' },
  LBL_BOTTOM_BAR_LINKS: { en: 'Bottom Bar Links', de: 'Links in der unteren Leiste', fr: 'Liens de la barre inférieure', es: 'Enlaces de la barra inferior' },
  MSG_CORP_ONLY: { en: 'Corporate Template Only', de: 'Nur für Unternehmensvorlage', fr: 'Modèle Corporate uniquement', es: 'Solo plantilla corporativa' },
  MSG_NOT_SET: { en: 'Not set', de: 'Nicht festgelegt', fr: 'Non défini', es: 'No configurado' },
  MSG_NO_LINKS: { en: 'No links yet', de: 'Noch keine Links', fr: 'Aucun lien pour l\'instant', es: 'Sin enlaces aún' },
  MSG_SELECT_ELEMENT: { en: 'Select an element to edit', de: 'Element zum Bearbeiten auswählen', fr: 'Sélectionner un élément à éditer', es: 'Seleccionar un elemento para editar' },
  MSG_CLICK_ELEMENT: { en: 'Click on any element in the canvas to see its properties here.', de: 'Klicken Sie auf ein Element auf der Arbeitsfläche, um seine Eigenschaften zu sehen.', fr: 'Cliquez sur un élément dans la zone de travail pour voir ses propriétés.', es: 'Haga clic en cualquier elemento del lienzo para ver sus propiedades.' },
  MSG_DELETE_COL_CONFIRM: { en: 'Are you sure you want to delete this column and all its links?', de: 'Möchten Sie diese Spalte und alle ihre Links wirklich löschen?', fr: 'Êtes-vous sûr de vouloir supprimer cette colonne et tous ses liens ?', es: '¿Está seguro de que desea eliminar esta columna y todos sus enlaces?' },
  TITLE_EDIT_COLUMN: { en: 'Edit Column', de: 'Spalte bearbeiten', fr: 'Modifier la colonne', es: 'Editar columna' },
  TITLE_EDIT_LINK: { en: 'Edit Link', de: 'Link bearbeiten', fr: 'Modifier le lien', es: 'Editar enlace' },
  TITLE_COPYRIGHT: { en: 'Copyright', de: 'Urheberrecht', fr: 'Droits d\'auteur', es: 'Derechos de autor' },
  TITLE_SOCIAL_NETWORKS: { en: 'Social Networks', de: 'Soziale Netzwerke', fr: 'Réseaux sociaux', es: 'Redes sociales' },
  TITLE_LIVE_FOOTER_PREVIEW: { en: 'Live Footer Preview', de: 'Live-Fußzeilenvorschau', fr: 'Aperçu du pied de page en direct', es: 'Vista previa del pie de página en vivo' },
  SECTION_MAIN_NAV: { en: 'Main Navigation', de: 'Hauptnavigation', fr: 'Navigation principale', es: 'Navegación principal' },
  SECTION_CONTACT_INFO: { en: 'Contact Information', de: 'Kontaktinformationen', fr: 'Informations de contact', es: 'Información de contacto' },
  SECTION_BOTTOM_BAR: { en: 'Bottom Bar', de: 'Untere Leiste', fr: 'Barre inférieure', es: 'Barra inferior' },
  LABEL_ADD_LINK: { en: 'Add Link', de: 'Link hinzufügen', fr: 'Ajouter un lien', es: 'Agregar enlace' },
  BTN_ADD_COLUMN: { en: 'Add Column', de: 'Spalte hinzufügen', fr: 'Ajouter une colonne', es: 'Agregar columna' },
  BTN_DELETE_COLUMN: { en: 'Delete Column', de: 'Spalte löschen', fr: 'Supprimer la colonne', es: 'Eliminar columna' },
  BTN_REMOVE_LINK: { en: 'Remove Link', de: 'Link entfernen', fr: 'Supprimer le lien', es: 'Eliminar enlace' },
  BTN_REMOVE_GROUP: { en: 'Remove Group', de: 'Gruppe entfernen', fr: 'Supprimer le groupe', es: 'Eliminar grupo' },
  BTN_ADD_LINK_GROUP: { en: 'Add Link Group', de: 'Linkgruppe hinzufügen', fr: 'Ajouter un groupe de liens', es: 'Agregar grupo de enlaces' },
  BTN_ADD_NEW_ROW: { en: 'Add New Row', de: 'Neue Zeile hinzufügen', fr: 'Ajouter une nouvelle ligne', es: 'Agregar nueva fila' },
  BTN_ADD_SOCIAL_LINK: { en: 'Add Social Link', de: 'Social-Link hinzufügen', fr: 'Ajouter un lien social', es: 'Agregar enlace social' },
  DESC_MAIN_NAV: { en: 'Contains columns of links.', de: 'Enthält Spalten mit Links.', fr: 'Contient des colonnes de liens.', es: 'Contiene columnas de enlaces.' },
  LBL_PRIVACY_POLICY: { en: 'Privacy Policy', de: 'Datenschutzrichtlinie', fr: 'Politique de confidentialité', es: 'Política de privacidad' },
  LBL_TERMS_SERVICE: { en: 'Terms of Service', de: 'Nutzungsbedingungen', fr: 'Conditions d\'utilisation', es: 'Términos de servicio' },
  LBL_SEARCH: { en: 'Search Items', de: 'Elemente suchen', fr: 'Rechercher des éléments', es: 'Buscar elementos' },
  LBL_SELECT_LIST: { en: 'Select Source List', de: 'Quellliste auswählen', fr: 'Sélectionner la liste source', es: 'Seleccionar lista de origen' },
  LABEL_TRANSLATION_TARGET: { en: 'Target Language', de: 'Zielsprache', fr: 'Langue cible', es: 'Idioma de destino' },
  LABEL_FOOTER_AREA: { en: 'Footer Area', de: 'Fußzeilenbereich', fr: 'Zone de pied de page', es: 'Área de pie de página' },
  ALIGN_CENTER: { en: 'Center', de: 'Zentriert', fr: 'Centré', es: 'Centro' },
  ALIGN_LEFT: { en: 'Left', de: 'Links', fr: 'Gauche', es: 'Izquierda' },
  ALIGN_RIGHT: { en: 'Right', de: 'Rechts', fr: 'Droite', es: 'Derecha' },
  PLACEHOLDER_NEWS_DESC: { en: 'A brief description of the news.', de: 'Eine kurze Beschreibung der Nachricht.', fr: 'Une brève description de l\'actualité.', es: 'Una breve descripción de la noticia.' },
  TAB_SEO: { en: 'SEO Settings', de: 'SEO-Einstellungen', fr: 'Paramètres SEO', es: 'Configuración SEO' },
  TAB_UPLOAD_UPPER: { en: 'UPLOAD', de: 'HOCHLADEN', fr: 'TÉLÉCHARGER', es: 'SUBIR' },
  TAB_BASIC_INFO_NEWS: { en: 'Basic Information', de: 'Basisinformationen', fr: 'Informations de base', es: 'Información básica' },
  TAB_TRANSLATION_NEWS: { en: 'Translations', de: 'Übersetzungen', fr: 'Traductions', es: 'Traducciones' },

  // Additional UI labels seeded for full-language coverage across modals/lists
  LABEL_SYSTEM_KEY: { en: 'System Key', de: 'Systemschlüssel', fr: 'Clé système', es: 'Clave del sistema' },
  LABEL_TRANSLATION_DE: { en: 'Translation (DE)', de: 'Übersetzung (DE)', fr: 'Traduction (DE)', es: 'Traducción (DE)' },
  LABEL_SITE_NAME: { en: 'Site Name', de: 'Seitenname', fr: 'Nom du site', es: 'Nombre del sitio' },
  LABEL_READ: { en: 'Read', de: 'Gelesen', fr: 'Lu', es: 'Leído' },
  LABEL_NEW: { en: 'New', de: 'Neu', fr: 'Nouveau', es: 'Nuevo' },
  STATUS_PUBLISHED: { en: 'Published', de: 'Veröffentlicht', fr: 'Publié', es: 'Publicado' },
  STATUS_DRAFT: { en: 'Draft', de: 'Entwurf', fr: 'Brouillon', es: 'Borrador' },
  STATUS_READ: { en: 'Read', de: 'Gelesen', fr: 'Lu', es: 'Leído' },
  STATUS_NEW: { en: 'New', de: 'Neu', fr: 'Nouveau', es: 'Nuevo' },
  TITLE_IMAGE_PREVIEW_AREA: { en: 'Image Preview Area', de: 'Bildvorschau-Bereich', fr: 'Zone d\'aperçu de l\'image', es: 'Área de vista previa de imagen' },
  DESC_IMAGE_PREVIEW_AREA: { en: 'Upload an image to start editing.', de: 'Laden Sie ein Bild hoch, um mit der Bearbeitung zu beginnen.', fr: 'Téléchargez une image pour commencer la modification.', es: 'Sube una imagen para empezar a editar.' },
  LABEL_ALL_IMAGES: { en: 'All Images', de: 'Alle Bilder', fr: 'Toutes les images', es: 'Todas las imágenes' },
  LABEL_ROOT_UPLOAD: { en: 'Root Upload', de: 'Stammverzeichnis', fr: 'Racine de la bibliothèque', es: 'Subida a raíz' },
  LABEL_SELECT_FOLDER: { en: 'Select Folder*', de: 'Ordner auswählen*', fr: 'Sélectionner un dossier*', es: 'Seleccionar carpeta*' },
  PH_CHOOSE_FOLDER: { en: 'Choose a folder...', de: 'Ordner wählen...', fr: 'Choisir un dossier...', es: 'Elegir una carpeta...' },
  MSG_SELECT_UPLOAD_FOLDER: { en: 'Please select a folder for the new image.', de: 'Bitte wählen Sie einen Ordner für das neue Bild.', fr: 'Veuillez sélectionner un dossier pour la nouvelle image.', es: 'Seleccione una carpeta para la nueva imagen.' },
  // Image Management (Photo Gallery) — keep in sync with seedData.ts Image Management section
  LABEL_FOLDERS: { en: 'Folders', de: 'Ordner', fr: 'Dossiers', es: 'Carpetas' },
  LABEL_LOADING_IMAGES: { en: 'Loading images...', de: 'Bilder werden geladen...', fr: 'Chargement des images...', es: 'Cargando imágenes...' },
  PH_IMG_SEARCH: { en: 'Search by title or name...', de: 'Nach Titel oder Name suchen...', fr: 'Rechercher par titre ou nom...', es: 'Buscar por título o nombre...' },
  MSG_NO_RESULTS: { en: 'No results found for', de: 'Keine Ergebnisse gefunden für', fr: 'Aucun résultat trouvé pour', es: 'No se encontraron resultados para' },
  MSG_TRY_DIFFERENT_SEARCH: { en: 'Please try a different search term.', de: 'Bitte versuchen Sie es mit einem anderen Suchbegriff.', fr: 'Veuillez essayer un autre terme de recherche.', es: 'Por favor, intente con otro término de búsqueda.' },
  MSG_FOLDER_EMPTY: { en: 'This folder is empty!', de: 'Dieser Ordner ist leer!', fr: 'Ce dossier est vide !', es: '¡Esta carpeta está vacía!' },
  MSG_FOLDER_EMPTY_DESC: { en: 'Click "Add Image" to upload an image to this folder, or select another folder.', de: 'Klicken Sie auf "Bild hinzufügen", um ein Bild in diesen Ordner hochzuladen, oder wählen Sie einen anderen Ordner aus.', fr: 'Cliquez sur "Ajouter une image" pour télécharger une image dans ce dossier, ou sélectionnez un autre dossier.', es: 'Haga clic en "Agregar imagen" para subir una imagen a esta carpeta, o seleccione otra carpeta.' },
  TITLE_EDITING: { en: 'Editing', de: 'Bearbeiten', fr: 'Modification', es: 'Editando' },
  LABEL_REPLACE_IMAGE: { en: 'Replace Image', de: 'Bild ersetzen', fr: 'Remplacer l\'image', es: 'Reemplazar imagen' },
  LABEL_STEP_UPLOAD: { en: '1. Upload an Image', de: '1. Bild hochladen', fr: '1. Télécharger une image', es: '1. Subir una imagen' },
  LABEL_STEP_ADJUST: { en: '2. Adjust & Edit', de: '2. Anpassen & Bearbeiten', fr: '2. Ajuster et Modifier', es: '2. Ajustar y Editar' },
  LABEL_RESIZE: { en: 'Resize', de: 'Größe ändern', fr: 'Redimensionner', es: 'Redimensionar' },
  LABEL_FILTERS: { en: 'Filters', de: 'Filter', fr: 'Filtres', es: 'Filtros' },
  LABEL_IMAGE_COMPRESSION: { en: 'Image Compression', de: 'Bildkomprimierung', fr: 'Compression d\'image', es: 'Compresión de imagen' },
  LABEL_CURRENT_SIZE: { en: 'Current size', de: 'Aktuelle Größe', fr: 'Taille actuelle', es: 'Tamaño actual' },
  LABEL_IMAGE_PROPERTIES: { en: 'Image Properties', de: 'Bildeigenschaften', fr: 'Propriétés de l\'image', es: 'Propiedades de la imagen' },
  LABEL_IMAGE_USAGE: { en: 'Where This Image Is Used', de: 'Wo dieses Bild verwendet wird', fr: 'Où cette image est utilisée', es: 'Dónde se usa esta imagen' },
  LABEL_IMAGE_USAGE_COUNT: { en: '{0} places', de: '{0} Stellen', fr: '{0} emplacements', es: '{0} ubicaciones' },
  LABEL_IMAGE_USAGE_SUMMARY_PAGES: { en: 'On {0} page section(s)', de: 'In {0} Seitenabschnitt(en)', fr: 'Sur {0} section(s) de page', es: 'En {0} sección(es) de página' },
  LABEL_IMAGE_USAGE_SUMMARY_CONTENT: { en: '{0} content item(s)', de: '{0} Inhaltselement(e)', fr: '{0} élément(s) de contenu', es: '{0} elemento(s) de contenido' },
  LABEL_IMAGE_USAGE_SUMMARY_SITE: { en: 'Site branding', de: 'Website-Branding', fr: 'Image de marque du site', es: 'Marca del sitio' },
  LABEL_IMAGE_USAGE_GROUP_PAGES: { en: 'On your pages', de: 'Auf Ihren Seiten', fr: 'Sur vos pages', es: 'En sus páginas' },
  LABEL_IMAGE_USAGE_GROUP_CONTENT: { en: 'In content libraries', de: 'In Inhaltsbibliotheken', fr: 'Dans les bibliothèques de contenu', es: 'En bibliotecas de contenido' },
  LABEL_IMAGE_USAGE_GROUP_SITE: { en: 'Site branding', de: 'Website-Branding', fr: 'Image de marque du site', es: 'Marca del sitio' },
  LABEL_IMAGE_USAGE_SHOWN_ON_ONE: { en: 'Displayed on this page section:', de: 'Wird in diesem Seitenabschnitt angezeigt:', fr: 'Affiché dans cette section de page :', es: 'Se muestra en esta sección de página:' },
  LABEL_IMAGE_USAGE_SHOWN_ON_MANY: { en: 'Displayed on {0} page sections:', de: 'Wird in {0} Seitenabschnitten angezeigt:', fr: 'Affiché sur {0} sections de page :', es: 'Se muestra en {0} secciones de página:' },
  LABEL_IMAGE_USAGE_NOT_ON_PAGE: { en: 'Saved in {0} — not placed on a page yet', de: 'In {0} gespeichert — noch auf keiner Seite platziert', fr: 'Enregistré dans {0} — pas encore placé sur une page', es: 'Guardado en {0} — aún no colocado en una página' },
  LABEL_IMAGE_USAGE_SECTION_BG: { en: 'Section background', de: 'Abschnitt-Hintergrund', fr: 'Arrière-plan de section', es: 'Fondo de sección' },
  LABEL_IMAGE_USAGE_SLIDE: { en: 'Slider slide', de: 'Slider-Folie', fr: 'Diapositive du curseur', es: 'Diapositiva del control deslizante' },
  LABEL_IMAGE_USAGE_SLIDE_NAMED: { en: 'Slide: {0}', de: 'Folie: {0}', fr: 'Diapositive : {0}', es: 'Diapositiva: {0}' },
  LABEL_IMAGE_USAGE_AS_HEADER_LOGO: { en: 'Shown in the site header navigation', de: 'Wird in der Website-Kopfzeile angezeigt', fr: 'Affiché dans l\'en-tête du site', es: 'Se muestra en el encabezado del sitio' },
  LABEL_IMAGE_USAGE_AS_FOOTER_LOGO: { en: 'Shown in the site footer', de: 'Wird in der Website-Fußzeile angezeigt', fr: 'Affiché dans le pied de page du site', es: 'Se muestra en el pie de página del sitio' },
  LABEL_IMAGE_NOT_USED: { en: 'This image is not used on any page, section, or content item yet.', de: 'Dieses Bild wird noch auf keiner Seite, in keinem Abschnitt oder Inhaltselement verwendet.', fr: 'Cette image n\'est encore utilisée sur aucune page, section ou élément de contenu.', es: 'Esta imagen aún no se usa en ninguna página, sección o elemento de contenido.' },
  USAGE_LABEL_SITE: { en: 'Site', de: 'Website', fr: 'Site', es: 'Sitio' },
  USAGE_LABEL_HEADER: { en: 'Header', de: 'Kopfzeile', fr: 'En-tête', es: 'Encabezado' },
  USAGE_LABEL_FOOTER: { en: 'Footer', de: 'Fußzeile', fr: 'Pied de page', es: 'Pie de página' },
  USAGE_LABEL_SITE_LOGO: { en: 'Site logo', de: 'Website-Logo', fr: 'Logo du site', es: 'Logotipo del sitio' },
  USAGE_LABEL_FOOTER_LOGO: { en: 'Footer logo', de: 'Footer-Logo', fr: 'Logo du pied de page', es: 'Logotipo del pie de página' },
  USAGE_LABEL_PAGE_INFO: { en: 'Page info', de: 'Seiteninfo', fr: 'Infos de la page', es: 'Información de la página' },
  USAGE_LABEL_CONTENT_LIBRARY: { en: 'Content library', de: 'Inhaltsbibliothek', fr: 'Bibliothèque de contenu', es: 'Biblioteca de contenido' },
  USAGE_TYPE_NEWS: { en: 'News', de: 'Nachrichten', fr: 'Actualités', es: 'Noticias' },
  USAGE_TYPE_EVENTS: { en: 'Events', de: 'Veranstaltungen', fr: 'Événements', es: 'Eventos' },
  USAGE_TYPE_DOCUMENTS: { en: 'Documents', de: 'Dokumente', fr: 'Documents', es: 'Documentos' },
  USAGE_TYPE_CONTAINER_ITEMS: { en: 'Container items', de: 'Container-Elemente', fr: 'Éléments de conteneur', es: 'Elementos de contenedor' },
  USAGE_TYPE_CONTACTS: { en: 'Contacts', de: 'Kontakte', fr: 'Contacts', es: 'Contactos' },
  USAGE_TYPE_SLIDER_ITEMS: { en: 'Slider items', de: 'Slider-Elemente', fr: 'Éléments du curseur', es: 'Elementos del control deslizante' },
  USAGE_TYPE_SMART_PAGES: { en: 'Smart pages', de: 'Smart Pages', fr: 'Pages intelligentes', es: 'Páginas inteligentes' },
  USAGE_TYPE_SECTION: { en: 'Section', de: 'Abschnitt', fr: 'Section', es: 'Sección' },
  USAGE_TYPE_SITE: { en: 'Site', de: 'Website', fr: 'Site', es: 'Sitio' },
  USAGE_TYPE_ITEM: { en: 'Item', de: 'Element', fr: 'Élément', es: 'Elemento' },
  USAGE_ROLE_SECTION_BACKGROUND: { en: 'Section background image', de: 'Abschnitt-Hintergrundbild', fr: 'Image d\'arrière-plan de section', es: 'Imagen de fondo de sección' },
  USAGE_ROLE_SLIDE_IMAGE: { en: 'Slide image', de: 'Folienbild', fr: 'Image de diapositive', es: 'Imagen de diapositiva' },
  USAGE_ROLE_TAGGED_ITEM: { en: 'Displayed in this section', de: 'In diesem Abschnitt angezeigt', fr: 'Affiché dans cette section', es: 'Mostrado en esta sección' },
  USAGE_ROLE_ITEM_IMAGE: { en: 'Item image', de: 'Elementbild', fr: 'Image de l\'élément', es: 'Imagen del elemento' },
  USAGE_ROLE_PAGE_IMAGE: { en: 'Page thumbnail', de: 'Seitenminiatur', fr: 'Miniature de page', es: 'Miniatura de página' },
  USAGE_ROLE_LOGO: { en: 'Site logo', de: 'Website-Logo', fr: 'Logo du site', es: 'Logotipo del sitio' },
  USAGE_ROLE_FOOTER_LOGO: { en: 'Footer logo', de: 'Footer-Logo', fr: 'Logo du pied de page', es: 'Logotipo del pie de página' },
  PH_IMG_NAME_EXAMPLE: { en: 'e.g., my-vacation-photo.png', de: 'z.B. mein-urlaubsfoto.png', fr: 'ex: ma-photo-de-vacances.png', es: 'ej. mi-foto-de-vacaciones.png' },
  PH_IMG_TITLE_EXAMPLE: { en: 'e.g., Sunset at the Beach', de: 'z.B. Sonnenuntergang am Strand', fr: 'ex: Coucher de soleil à la plage', es: 'ej. Atardecer en la playa' },
  PH_IMG_DESC_EXAMPLE: { en: 'A brief description of the image.', de: 'Eine kurze Beschreibung des Bildes.', fr: 'Une brève description de l\'image.', es: 'Una breve descripción de la imagen.' },
  BTN_DELETE_ITEM: { en: 'Delete this item', de: 'Dieses Element löschen', fr: 'Supprimer cet élément', es: 'Eliminar este elemento' },
  BTN_COPY_SAVE_NEW: { en: 'Copy & Save as New', de: 'Kopieren & als neu speichern', fr: 'Copier et Enregistrer comme nouveau', es: 'Copiar y Guardar como nuevo' },
  BTN_SAVE_IMAGE: { en: 'Save Image', de: 'Bild speichern', fr: 'Enregistrer l\'image', es: 'Guardar imagen' },
  TITLE_CONFIRM_IMAGE_OPTIMIZATION: { en: 'Optimize Image?', de: 'Bild optimieren?', fr: 'Optimiser l\'image ?', es: '¿Optimizar imagen?' },
  MSG_CONFIRM_IMAGE_OPTIMIZATION: { en: 'Would you like to optimize this image before upload? Optimizing reduces file size while maintaining quality.', de: 'Möchten Sie dieses Bild vor dem Hochladen optimieren? Die Optimierung reduziert die Dateigröße bei gleichbleibender Qualität.', fr: 'Souhaitez-vous optimiser cette image avant le téléchargement ? L\'optimisation réduit la taille du fichier tout en conservant la qualité.', es: '¿Desea optimizar esta imagen antes de subirla? La optimización reduce el tamaño del archivo manteniendo la calidad.' },
  BTN_UPLOAD_ORIGINAL: { en: 'Upload Original', de: 'Original hochladen', fr: 'Télécharger l\'original', es: 'Subir original' },
  BTN_OPTIMIZE_IMAGE: { en: 'Optimize', de: 'Optimieren', fr: 'Optimiser', es: 'Optimizar' },
  MSG_CHOOSE_ADD_METHOD: { en: 'How would you like to add an image?', de: 'Wie möchten Sie ein Bild hinzufügen?', fr: 'Comment souhaitez-vous ajouter une image ?', es: '¿Cómo le gustaría agregar una imagen?' },
  LABEL_UPLOAD: { en: 'Upload', de: 'Hochladen', fr: 'Télécharger', es: 'Subir' },
  DESC_UPLOAD_DEVICE: { en: 'From your device', de: 'Von Ihrem Gerät', fr: 'Depuis votre appareil', es: 'Desde su dispositivo' },
  LABEL_FROM_URL: { en: 'From URL', de: 'Von URL', fr: 'Depuis une URL', es: 'Desde URL' },
  DESC_IMPORT_LINK: { en: 'Import via link', de: 'Über Link importieren', fr: 'Importer via un lien', es: 'Importar mediante enlace' },
  LABEL_PASTE: { en: 'Paste', de: 'Einfügen', fr: 'Coller', es: 'Pegar' },
  DESC_FROM_CLIPBOARD: { en: 'From clipboard', de: 'Aus der Zwischenablage', fr: 'Depuis le presse-papier', es: 'Desde el portapapeles' },
  LABEL_FROM_GALLERY: { en: 'From Gallery', de: 'Aus Galerie', fr: 'Depuis la galerie', es: 'Desde la galería' },
  DESC_USE_EXISTING_IMG: { en: 'Use existing image', de: 'Vorhandenes Bild verwenden', fr: 'Utiliser une image existante', es: 'Usar imagen existente' },
  BTN_BACK_OPTIONS: { en: 'Back to options', de: 'Zurück zu den Optionen', fr: 'Retour aux options', es: 'Volver a las opciones' },
  TITLE_UPLOAD_IMAGE: { en: 'Upload Your Image', de: 'Laden Sie Ihr Bild hoch', fr: 'Téléchargez votre image', es: 'Suba su imagen' },
  MSG_DRAG_DROP_FILE: { en: 'Drag & drop a file here or click to select a file', de: 'Datei hierher ziehen oder zum Auswählen klicken', fr: 'Glissez-déposez un fichier ici ou cliquez pour en sélectionner un', es: 'Arrastre y suelte un archivo aquí o haga clic para seleccionar uno' },
  TITLE_LOAD_FROM_URL: { en: 'Load Image from a URL', de: 'Bild von einer URL laden', fr: 'Charger une image depuis une URL', es: 'Cargar imagen desde una URL' },
  BTN_LOAD: { en: 'Load', de: 'Laden', fr: 'Charger', es: 'Cargar' },
  TITLE_PASTE_IMAGE: { en: 'Paste Image', de: 'Bild einfügen', fr: 'Coller l\'image', es: 'Pegar imagen' },
  MSG_PASTE_DIRECTIONS: { en: 'Just press Ctrl+V (or Cmd+V) anywhere on the page.', de: 'Drücken Sie einfach Strg+V (oder Cmd+V) an einer beliebigen Stelle auf der Seite.', fr: 'Appuyez simplement sur Ctrl+V (ou Cmd+V) n\'importe où sur la page.', es: 'Simplemente presione Ctrl+V (o Cmd+V) en cualquier lugar de la página.' },
  TITLE_SELECT_GALLERY: { en: 'Select from your gallery', de: 'Aus Ihrer Galerie auswählen', fr: 'Sélectionner depuis votre galerie', es: 'Seleccionar de su galería' },
  LABEL_LOADING_IMAGE: { en: 'Loading image...', de: 'Bild wird geladen...', fr: 'Chargement de l\'image...', es: 'Cargando imagen...' },
  LABEL_SELECT_IMAGE: { en: 'Select image', de: 'Bild auswählen', fr: 'Sélectionner l\'image', es: 'Seleccionar imagen' },
  MSG_GALLERY_EMPTY: { en: 'Your gallery is empty.', de: 'Ihre Galerie ist leer.', fr: 'Votre galerie est vide.', es: 'Tu galería está vacía.' },
  PHOTO_GALLERY: { en: 'Photo Gallery', de: 'Fotogalerie', fr: 'Galerie de photos', es: 'Galería de fotos' },
  TITLE_PHOTO_GALLERY: { en: 'Photo Gallery', de: 'Fotogalerie', fr: 'Galerie de photos', es: 'Galería de fotos' },
  MSG_DELETE_CONFIRM: { en: 'Are you sure you want to delete this item? This action cannot be undone.', de: 'Sind Sie sicher, dass Sie dieses Element löschen möchten? Dieser Vorgang kann nicht rückgängig gemacht werden.', fr: 'Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible.', es: '¿Está seguro de que desea eliminar este elemento? Esta acción no se puede deshacer.' },
  LABEL_FOLDER_CONTACTS: { en: 'Contacts', de: 'Kontakte', fr: 'Contacts', es: 'Contactos' },
  LABEL_FOLDER_PICTURES: { en: 'Pictures', de: 'Bilder', fr: 'Images', es: 'Imágenes' },
  LABEL_FOLDER_CONTAINERS: { en: 'Containers', de: 'Container', fr: 'Conteneurs', es: 'Contenedores' },
  LABEL_POSITION: { en: 'Position', de: 'Position', fr: 'Position', es: 'Posición' },
  LABEL_CORPORATE_VIEW: { en: 'Corporate View', de: 'Unternehmensansicht', fr: 'Vue Corporate', es: 'Vista corporativa' },
  BTN_ADD_RECORD: { en: 'Add Record', de: 'Eintrag hinzufügen', fr: 'Ajouter un enregistrement', es: 'Agregar registro' },
  MSG_LOADING_DATA: { en: 'Loading data...', de: 'Daten werden geladen...', fr: 'Chargement des données...', es: 'Cargando datos...' },
  MSG_NO_COLUMNS_SELECTED: { en: 'No columns selected', de: 'Keine Spalten ausgewählt', fr: 'Aucune colonne sélectionnée', es: 'No hay columnas seleccionadas' },
  MSG_NO_DATA_FOUND_IN_SOURCE: { en: 'No data found in {0}.', de: 'Keine Daten in {0} gefunden.', fr: 'Aucune donnée trouvée dans {0}.', es: 'No se encontraron datos en {0}.' },
  MSG_SELECT_DATA_SOURCE_FIRST: { en: 'Please select a Data Source in the Data tab first.', de: 'Bitte wählen Sie zuerst eine Datenquelle im Daten-Tab aus.', fr: 'Veuillez d’abord sélectionner une source de données dans l’onglet Données.', es: 'Seleccione primero una fuente de datos en la pestaña Datos.' },
  LABEL_ACTIVE_COLUMN_ORDER: { en: 'Active Column Order', de: 'Aktive Spaltenreihenfolge', fr: 'Ordre actif des colonnes', es: 'Orden activo de columnas' },
  OPTION_DETAIL_MODAL: { en: 'Detail Modal', de: 'Detail-Modal', fr: 'Modal de détail', es: 'Modal de detalle' },
  OPTION_OPEN_LINK: { en: 'Open Link', de: 'Link öffnen', fr: 'Ouvrir le lien', es: 'Abrir enlace' },
  PLACEHOLDER_ENTER_SUBHEADING: { en: 'Enter subheading...', de: 'Untertitel eingeben...', fr: 'Entrez le sous-titre...', es: 'Introduzca el subtítulo...' },
  PLACEHOLDER_ENTER_RICH_TEXT_DESCRIPTION: { en: 'Enter rich text description...', de: 'Rich-Text-Beschreibung eingeben...', fr: 'Entrez une description en texte enrichi...', es: 'Introduzca una descripción con formato...' },
  MSG_NO_CONTAINERS_ON_SITE: { en: 'No containers available on the site.', de: 'Keine Container auf der Website verfügbar.', fr: 'Aucun conteneur disponible sur le site.', es: 'No hay contenedores disponibles en el sitio.' },
  DIALOG_DELETE_CONTACT_TITLE: { en: 'Delete Contact', de: 'Kontakt löschen', fr: 'Supprimer le contact', es: 'Eliminar contacto' },
  DIALOG_DELETE_CONTACT_MESSAGE: { en: 'Are you sure you want to delete this contact? This action cannot be undone.', de: 'Möchten Sie diesen Kontakt wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.', fr: 'Voulez-vous vraiment supprimer ce contact ? Cette action est irréversible.', es: '¿Seguro que desea eliminar este contacto? Esta acción no se puede deshacer.' },
  DIALOG_DELETE_ITEM_TITLE: { en: 'Delete Item', de: 'Element löschen', fr: 'Supprimer l’élément', es: 'Eliminar elemento' },
  DIALOG_DELETE_ITEM_MESSAGE: { en: 'Are you sure you want to delete this item? This action cannot be undone.', de: 'Möchten Sie dieses Element wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.', fr: 'Voulez-vous vraiment supprimer cet élément ? Cette action est irréversible.', es: '¿Seguro que desea eliminar este elemento? Esta acción no se puede deshacer.' },
  LABEL_NAME: { en: 'Name', de: 'Name', fr: 'Nom', es: 'Nombre' },
  LABEL_ALT_TEXT: { en: 'Alt Text', de: 'Alternativtext', fr: 'Texte alternatif', es: 'Texto alternativo' },
  LABEL_COPYRIGHT: { en: 'Copyright', de: 'Urheberrecht', fr: 'Droits d’auteur', es: 'Derechos de autor' },
  LABEL_TARGET_FOLDER: { en: 'Target Folder', de: 'Zielordner', fr: 'Dossier cible', es: 'Carpeta de destino' },
  PLACEHOLDER_DESCRIPTION: { en: 'Description...', de: 'Beschreibung...', fr: 'Description...', es: 'Descripción...' },
  LABEL_TYPOGRAPHY_OPTIONS: { en: 'Typography Options', de: 'Typografie-Optionen', fr: 'Options de typographie', es: 'Opciones de tipografía' },
  LABEL_FULL_NAME_FONT_SIZE: { en: 'Full Name Font Size', de: 'Schriftgröße Vollständiger Name', fr: 'Taille de police du nom complet', es: 'Tamaño de fuente del nombre completo' },
  LABEL_FULL_NAME_FONT_WEIGHT: { en: 'Full Name Font Weight', de: 'Schriftstärke Vollständiger Name', fr: 'Graisse du nom complet', es: 'Peso de fuente del nombre completo' },
  LABEL_FULL_NAME_LINE_HEIGHT: { en: 'Full Name Line Height', de: 'Zeilenhöhe Vollständiger Name', fr: 'Hauteur de ligne du nom complet', es: 'Altura de línea del nombre completo' },
  LABEL_FULL_NAME_COLOR: { en: 'Full Name Color', de: 'Farbe Vollständiger Name', fr: 'Couleur du nom complet', es: 'Color del nombre completo' },
  LABEL_JOB_TITLE_FONT_SIZE: { en: 'Job Title Font Size', de: 'Schriftgröße Berufsbezeichnung', fr: 'Taille de police du titre du poste', es: 'Tamaño de fuente del puesto' },
  LABEL_JOB_TITLE_FONT_WEIGHT: { en: 'Job Title Font Weight', de: 'Schriftstärke Berufsbezeichnung', fr: 'Graisse du titre du poste', es: 'Peso de fuente del puesto' },
  LABEL_JOB_TITLE_LINE_HEIGHT: { en: 'Job Title Line Height', de: 'Zeilenhöhe Berufsbezeichnung', fr: 'Hauteur de ligne du titre du poste', es: 'Altura de línea del puesto' },
  LABEL_JOB_TITLE_COLOR: { en: 'Job Title Color', de: 'Farbe Berufsbezeichnung', fr: 'Couleur du titre du poste', es: 'Color del puesto' },
  LABEL_ORIGINAL_EN: { en: 'EN', de: 'EN', fr: 'EN', es: 'EN' },
  LBL_HEADING_WEIGHT: { en: 'Heading Weight', de: 'Überschriftsstärke', fr: 'Graisse du titre', es: 'Peso del encabezado' },
  LBL_SUBHEADING_WEIGHT: { en: 'Subheading Weight', de: 'Untertitelstärke', fr: 'Graisse du sous-titre', es: 'Peso del subtítulo' },
  LABEL_LABELS_COLOR: { en: 'Labels Color', de: 'Beschriftungsfarbe', fr: 'Couleur des libellés', es: 'Color de etiquetas' },
  LABEL_HEADER_TITLE_FONT_SIZE: { en: 'Header Title Font Size', de: 'Schriftgröße Header-Titel', fr: 'Taille du titre d’en-tête', es: 'Tamaño del título del encabezado' },
  LABEL_HEADER_TITLE_FONT_WEIGHT: { en: 'Header Title Font Weight', de: 'Schriftstärke Header-Titel', fr: 'Graisse du titre d’en-tête', es: 'Peso del título del encabezado' },
  LABEL_HEADER_TITLE_LINE_HEIGHT: { en: 'Header Title Line Height', de: 'Zeilenhöhe Header-Titel', fr: 'Hauteur de ligne du titre d’en-tête', es: 'Altura de línea del título del encabezado' },
  LABEL_SUBHEADING_FONT_SIZE: { en: 'Subheading Font Size', de: 'Schriftgröße Untertitel', fr: 'Taille du sous-titre', es: 'Tamaño del subtítulo' },
  LABEL_SUBHEADING_FONT_WEIGHT: { en: 'Subheading Font Weight', de: 'Schriftstärke Untertitel', fr: 'Graisse du sous-titre', es: 'Peso del subtítulo' },
  LABEL_SUBHEADING_LINE_HEIGHT: { en: 'Subheading Line Height', de: 'Zeilenhöhe Untertitel', fr: 'Hauteur de ligne du sous-titre', es: 'Altura de línea del subtítulo' },
  LABEL_TITLE_FONT_SIZE: { en: 'Title Font Size', de: 'Schriftgröße Titel', fr: 'Taille de police du titre', es: 'Tamaño de fuente del título' },
  LABEL_SUBTITLE_FONT_SIZE: { en: 'Subtitle Font Size', de: 'Schriftgröße Untertitel', fr: 'Taille de police du sous-titre', es: 'Tamaño de fuente del subtítulo' },
  LABEL_LABELS_FONT_SIZE: { en: 'Labels Font Size', de: 'Schriftgröße Beschriftungen', fr: 'Taille de police des libellés', es: 'Tamaño de fuente de etiquetas' },
  LABEL_TITLE_FONT_WEIGHT: { en: 'Title Font Weight', de: 'Schriftstärke Titel', fr: 'Graisse du titre', es: 'Peso de fuente del título' },
  LABEL_SUBTITLE_FONT_WEIGHT: { en: 'Subtitle Font Weight', de: 'Schriftstärke Untertitel', fr: 'Graisse du sous-titre', es: 'Peso de fuente del subtítulo' },
  LABEL_LABELS_FONT_WEIGHT: { en: 'Labels Font Weight', de: 'Schriftstärke Beschriftungen', fr: 'Graisse des libellés', es: 'Peso de fuente de etiquetas' },
  LABEL_TITLE_LINE_HEIGHT: { en: 'Title Line Height', de: 'Zeilenhöhe Titel', fr: 'Hauteur de ligne du titre', es: 'Altura de línea del título' },
  LABEL_SUBTITLE_LINE_HEIGHT: { en: 'Subtitle Line Height', de: 'Zeilenhöhe Untertitel', fr: 'Hauteur de ligne du sous-titre', es: 'Altura de línea del subtítulo' },
  LABEL_LABELS_LINE_HEIGHT: { en: 'Labels Line Height', de: 'Zeilenhöhe Beschriftungen', fr: 'Hauteur de ligne des libellés', es: 'Altura de línea de etiquetas' },
  LABEL_HERO_IMAGE_HEIGHT: { en: 'Image Height', de: 'Bildhöhe', fr: 'Hauteur de l image', es: 'Altura de imagen' },
  LABEL_HERO_IMAGE_OVERLAY: { en: 'Image Overlay', de: 'Bild-Overlay', fr: 'Superposition d\'image', es: 'Superposición de imagen' },
  LABEL_OVERLAY_COLOR: { en: 'Overlay Color', de: 'Overlay-Farbe', fr: 'Couleur de superposition', es: 'Color de superposición' },
  LABEL_OPACITY: { en: 'Opacity', de: 'Deckkraft', fr: 'Opacité', es: 'Opacidad' },
  LABEL_DEFAULT_600PX: { en: 'Default', de: 'Standard', fr: 'Par défaut', es: 'Predeterminado' },
  LABEL_FULL_SCREEN_MINUS_NAV: { en: 'Full Screen', de: 'Vollbild', fr: 'Plein écran', es: 'Pantalla completa' },
  PLACEHOLDER_HERO_CUSTOM_HEIGHT: { en: 'e.g. 720 or 80vh or calc(100vh - 96px)', de: 'z. B. 720 oder 80vh oder calc(100vh - 96px)', fr: 'ex. 720 ou 80vh ou calc(100vh - 96px)', es: 'p. ej. 720 o 80vh o calc(100vh - 96px)' },
  MSG_HERO_HEIGHT_HELPER: { en: 'Supports px, vh, %, rem, and calc(). Numbers are treated as px.', de: 'Unterstützt px, vh, %, rem und calc(). Zahlen werden als px interpretiert.', fr: 'Prend en charge px, vh, %, rem et calc(). Les nombres sont traités en px.', es: 'Admite px, vh, %, rem y calc(). Los números se interpretan como px.' },
  LABEL_SELECT_DATA_SOURCE_LIST: { en: 'Select Data Source (List)', de: 'Datenquelle (Liste) auswählen', fr: 'Sélectionner la source de données (liste)', es: 'Seleccionar fuente de datos (lista)' },
  LABEL_ACTION: { en: 'Action', de: 'Aktion', fr: 'Action', es: 'Acción' },
  LABEL_TITLE_ALIGNMENT: { en: 'Title Alignment', de: 'Titelausrichtung', fr: 'Alignement du titre', es: 'Alineación del título' },
  LABEL_SUBTITLE_COLOR: { en: 'Subtitle Color', de: 'Untertitelfarbe', fr: 'Couleur du sous-titre', es: 'Color del subtítulo' },
  LABEL_DESCRIPTION_FONT_SIZE: { en: 'Description Font Size', de: 'Schriftgröße Beschreibung', fr: 'Taille de police de la description', es: 'Tamaño de fuente de la descripción' },
  LABEL_DESCRIPTION_COLOR: { en: 'Description color', de: 'Beschreibungsfarbe', fr: 'Couleur de la description', es: 'Color de la descripción' },
  LABEL_BODY_TEXT_COLOR: { en: 'Body text color', de: 'Haupttextfarbe', fr: 'Couleur du texte corporel', es: 'Color de texto del cuerpo' },
  LABEL_EDITOR_TEXT_COLOR: { en: 'Editor text color', de: 'Editor-Textfarbe', fr: 'Couleur du texte de l\'éditeur', es: 'Color de texto del editor' },
  LABEL_SECONDARY_TEXT_COLOR: { en: 'Secondary text color', de: 'Sekundärtextfarbe', fr: 'Couleur du texte secondaire', es: 'Color de texto secundario' },
  LABEL_TABLE_FONT_SIZE: { en: 'Table Font Size', de: 'Tabellenschriftgröße', fr: 'Taille de police du tableau', es: 'Tamaño de fuente de tabla' },
  LABEL_TABLE_CONTENT_COLOR: { en: 'Table Content Color', de: 'Tabelleninhalt-Farbe', fr: 'Couleur du contenu du tableau', es: 'Color del contenido de la tabla' },
  LABEL_TITLE_BAR_TEXT: { en: 'Title Bar Text', de: 'Titelleisten-Text', fr: 'Texte de la barre de titre', es: 'Texto de la barra de título' },
  LABEL_TEXT_COLOR: { en: 'Text Color', de: 'Textfarbe', fr: 'Couleur du texte', es: 'Color del texto' },
  LABEL_BAR_WIDTH: { en: 'Bar Width', de: 'Leistenbreite', fr: 'Largeur de la barre', es: 'Ancho de barra' },
  LABEL_TRANSLATED_CONTAINER_TITLE: { en: 'Translated Container Title', de: 'Übersetzter Container-Titel', fr: 'Titre de conteneur traduit', es: 'Título de contenedor traducido' },
  LABEL_TRANSLATED_HEADING: { en: 'Translated Heading', de: 'Übersetzte Überschrift', fr: 'Titre traduit', es: 'Encabezado traducido' },
  LABEL_PLACEHOLDER: { en: 'Placeholder', de: 'Platzhalter', fr: 'Espace réservé', es: 'Marcador de posición' },
  MSG_SHOWING_PAGES_COUNT: { en: 'Showing {0} pages', de: 'Zeige {0} Seiten', fr: 'Affichage de {0} pages', es: 'Mostrando {0} páginas' },
  MSG_SHOWING_SECTIONS_COUNT: { en: 'Showing {0} sections', de: 'Zeige {0} Abschnitte', fr: 'Affichage de {0} sections', es: 'Mostrando {0} secciones' },
  LABEL_ROOT_LEVEL: { en: 'Root Level', de: 'Stammebene', fr: 'Niveau racine', es: 'Nivel raíz' },
  MSG_NOT_IN_NAVIGATION: { en: 'Not in Navigation', de: 'Nicht in Navigation', fr: 'Pas dans la navigation', es: 'No está en la navegación' },
  LBL_BY: { en: 'by', de: 'von', fr: 'par', es: 'por' },
  BTN_PUBLISH_CHANGES: { en: 'Publish Changes', de: 'Änderungen veröffentlichen', fr: 'Publier les modifications', es: 'Publicar cambios' },
  TITLE_ADD_NEW_IMAGE: { en: 'Add New Image', de: 'Neues Bild hinzufügen', fr: 'Ajouter une nouvelle image', es: 'Agregar nueva imagen' },
  LABEL_EDITING: { en: 'Editing', de: 'Bearbeiten', fr: 'Modification', es: 'Editando' },
  MSG_READY_TO_SAVE: { en: 'Ready to save', de: 'Bereit zum Speichern', fr: 'Prêt à enregistrer', es: 'Listo para guardar' },
  MSG_SAVING: { en: 'Saving...', de: 'Speichern...', fr: 'Enregistrement...', es: 'Guardando...' },
  BTN_SAVE_AND_ADD_TO_LIBRARY: { en: 'Save and add to library', de: 'Speichern und zur Bibliothek hinzufügen', fr: 'Enregistrer et ajouter à la bibliothèque', es: 'Guardar y agregar a la biblioteca' },
  BTN_ADD_IMAGE: { en: 'Add Image', de: 'Bild hinzufügen', fr: 'Ajouter une image', es: 'Agregar imagen' },
  MSG_NO_IMAGES_FOUND: { en: 'No images found', de: 'Keine Bilder gefunden', fr: 'Aucune image trouvée', es: 'No se encontraron imágenes' },
  MSG_UPLOAD_IMAGE_TO_START: { en: 'Upload a new image to get started.', de: 'Laden Sie ein neues Bild hoch, um zu beginnen.', fr: 'Téléchargez une nouvelle image pour commencer.', es: 'Sube una nueva imagen para comenzar.' },
  BTN_UPLOAD_NEW_IMAGE: { en: 'Upload New Image', de: 'Neues Bild hochladen', fr: 'Télécharger une nouvelle image', es: 'Subir nueva imagen' },
  DESC_TABLE_VIEW_TEMPLATE: { en: 'Organized columns of links.', de: 'Organisierte Link-Spalten.', fr: 'Colonnes de liens organisées.', es: 'Columnas organizadas de enlaces.' },
  DESC_CORPORATE_VIEW_TEMPLATE: { en: 'Professional layout with contact.', de: 'Professionelles Layout mit Kontakt.', fr: 'Mise en page professionnelle avec contact.', es: 'Diseño profesional con contacto.' },
  LABEL_EXTERNAL_SHORT: { en: 'EXT', de: 'EXT', fr: 'EXT', es: 'EXT' },
  LABEL_SECTION_SHORT: { en: 'SEC', de: 'ABS', fr: 'SEC', es: 'SEC' },
  STATUS_LOADED: { en: 'Loaded', de: 'Geladen', fr: 'Chargé', es: 'Cargado' },
  STATUS_PENDING: { en: 'Pending', de: 'Ausstehend', fr: 'En attente', es: 'Pendiente' },
  LABEL_CROPPED: { en: 'Cropped', de: 'Zugeschnitten', fr: 'Rogné', es: 'Recortado' },
  LABEL_FORMAT: { en: 'Format', de: 'Format', fr: 'Format', es: 'Formato' },
  LABEL_HQ_PREVIEW: { en: 'HQ Preview', de: 'HQ-Vorschau', fr: 'Aperçu HQ', es: 'Vista previa HQ' },
  LABEL_ENABLE_SEARCH_BAR: { en: 'Enable Search Bar', de: 'Suchleiste aktivieren', fr: 'Activer la barre de recherche', es: 'Activar barra de búsqueda' },
  LABEL_SHOW_TABLE_TITLE_BAR: { en: 'Show Table Title Bar', de: 'Tabellentitelleiste anzeigen', fr: 'Afficher la barre de titre du tableau', es: 'Mostrar barra de título de tabla' },
  MSG_CONTAINER_MATCHED_SUCCESS: { en: 'Container matched successfully.', de: 'Container erfolgreich zugeordnet.', fr: 'Conteneur correspondant trouvé.', es: 'Contenedor coincidente encontrado correctamente.' },
  MSG_ENTER_EXACT_TITLE_MATCH: { en: 'Enter the exact title. Matches across all pages.', de: 'Geben Sie den exakten Titel ein. Abgleich über alle Seiten.', fr: 'Entrez le titre exact. Correspondance sur toutes les pages.', es: 'Ingrese el título exacto. Coincide en todas las páginas.' },
  LABEL_SELECT_TIME: { en: 'Select time', de: 'Zeit auswählen', fr: 'Sélectionner l heure', es: 'Seleccionar hora' },
  MSG_NO_DATE: { en: 'No date', de: 'Kein Datum', fr: 'Aucune date', es: 'Sin fecha' },
  LABEL_SYSTEM: { en: 'System', de: 'System', fr: 'Système', es: 'Sistema' },
  LABEL_LAST_MODIFIED: { en: 'Last modified', de: 'Zuletzt geändert', fr: 'Dernière modification', es: 'Última modificación' },
  BTN_SHARE_THIS: { en: 'Share this', de: 'Teilen', fr: 'Partager cet élément', es: 'Compartir este' },
  BTN_DELETE_THIS_ITEM: { en: 'Delete this item', de: 'Dieses Element löschen', fr: 'Supprimer cet élément', es: 'Eliminar este elemento' },
  BTN_VERSION_HISTORY: { en: 'Version History', de: 'Versionsverlauf', fr: 'Historique des versions', es: 'Historial de versiones' },
  LABEL_PRIVACY_POLICY_CONSENT: { en: 'I have read the Privacy Policy note. I agree that my contact details and questions will be stored permanently.', de: 'Ich habe den Hinweis zur Datenschutzerklärung gelesen. Ich stimme zu, dass meine Kontaktdaten und Fragen dauerhaft gespeichert werden.', fr: 'J ai lu la note relative a la politique de confidentialite. J accepte que mes coordonnees et mes questions soient conservees durablement.', es: 'He leido la nota de la politica de privacidad. Acepto que mis datos de contacto y mis preguntas se almacenen de forma permanente.' },
  MSG_UPDATES_INSTANTLY: { en: 'Updates instantly', de: 'Aktualisiert sofort', fr: 'Mises à jour instantanées', es: 'Actualiza al instante' },
  NAV_HOME: { en: 'Home', de: 'Start', fr: 'Accueil', es: 'Inicio' },
  NAV_ABOUT: { en: 'About', de: 'Über uns', fr: 'À propos', es: 'Acerca de' },
  NAV_CONTACT: { en: 'Contact', de: 'Kontakt', fr: 'Contact', es: 'Contacto' },
  LABEL_BORDER_RADIUS_SCALE: { en: 'Border Radius: sm / md / lg', de: 'Eckenradius: sm / md / lg', fr: 'Rayon de bordure : sm / md / lg', es: 'Radio de borde: sm / md / lg' },
  STATUS_OPERATION_SUCCESSFUL: { en: 'Operation Successful', de: 'Vorgang erfolgreich', fr: 'Opération réussie', es: 'Operación exitosa' },
  STATUS_SYSTEM_WARNING: { en: 'System Warning', de: 'Systemwarnung', fr: 'Avertissement système', es: 'Advertencia del sistema' },
  STATUS_CRITICAL_ERROR: { en: 'Critical Error', de: 'Kritischer Fehler', fr: 'Erreur critique', es: 'Error crítico' },
  LABEL_ACTIVE_PAGE: { en: 'Active Page', de: 'Aktive Seite', fr: 'Page active', es: 'Página activa' },
  LABEL_INACTIVE_PAGE: { en: 'Inactive Page', de: 'Inaktive Seite', fr: 'Page inactive', es: 'Página inactiva' },
  LABEL_HIDDEN_MUTED: { en: 'Hidden / Muted', de: 'Ausgeblendet / Gedämpft', fr: 'Masqué / Atténué', es: 'Oculto / Atenuado' },
  MSG_NOT_CONFIGURED: { en: 'Not configured', de: 'Nicht konfiguriert', fr: 'Non configuré', es: 'No configurado' },
  LABEL_CONTAINERS_STATUS: { en: 'Containers Status', de: 'Container-Status', fr: 'Statut des conteneurs', es: 'Estado de contenedores' },
};

const toSharePointText = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const parseSharePointText = (value: any): any => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

/** Resolved URL for Images/default.* on the current site (populated after SharePoint load). */
export const getGlobalDefaultImage = (): string => useStore.getState().defaultImageUrl || '';

/** @deprecated Use getGlobalDefaultImage() — kept for gradual migration. */
export const GLOBAL_DEFAULT_IMAGE = '';

export const DEFAULT_THEME: ThemeConfig = {
  // Brand Colors (Corporate Blue #2f5596)
  '--primary-color': '#2f5596',
  '--secondary-color': '#1f3f73',
  '--brand-light': '#e6ecf7',
  '--brand-dark': '#1c355f',
  '--gradient-primary': 'linear-gradient(135deg, var(--primary-color)0%, #1f3f73 100%)',

  // Sidebar Specific
  '--sidebar-bg': '#ffffff',
  '--sidebar-text': '#1f2937',
  '--sidebar-text-muted': '#6b7280',
  '--sidebar-border-color': '#e5e7eb',

  '--sidebar-icon-color': '#2f5596',
  '--sidebar-link-color': '#2f5596',
  '--sidebar-link-hover-color': '#1f3f73',
  '--sidebar-active-text-color': '#2f5596',
  '--sidebar-active-indicator-color': '#2f5596',
  '--sidebar-button-color': '#2f5596',
  '--sidebar-active-bg': '#eff6ff',
  '--sidebar-hover-bg': '#f9fafb',

  // Text & Links
  '--text-primary': '#1f2937',
  '--text-secondary': '#4b5563',
  '--text-on-primary': '#ffffff',
  '--link-color': '#2f5596',
  '--link-hover-color': '#1f3f73',

  // Backgrounds
  '--bg-body': '#ffffff',
  '--bg-hover': '#eef2ff',

  // Buttons
  '--btn-primary-bg': '#2f5596',
  '--btn-primary-text': '#ffffff',
  '--btn-primary-hover-bg': '#1f3f73',
  '--btn-secondary-bg': '#ffffff',
  '--btn-secondary-text': '#1f2937',
  '--btn-padding-y': '0.5rem',
  '--btn-padding-x': '1.25rem',
  '--btn-font-size': '14px',

  // Add Section divider (between page sections in edit mode)
  '--add-section-btn-bg': '#2f5596',
  '--add-section-btn-text': '#ffffff',
  '--add-section-btn-hover-bg': '#1f3f73',
  '--add-section-btn-font-size': '12px',
  '--add-section-btn-padding-x': '0.75rem',
  '--add-section-btn-padding-y': '0.35rem',
  '--add-section-line-color': '#2f5596',
  '--add-section-line-thickness': '2px',

  // Status
  '--status-success': '#16a34a',
  '--status-warning': '#f59e0b',
  '--status-error': '#dc2626',

  // Borders
  '--border-radius-sm': '0px',
  '--border-radius-md': '0px',
  '--border-radius-lg': '0px',
  '--border-color': '#d1d5db',

  // Typography
  '--font-import-url': '',
  '--font-import-url-2': '',
  '--font-family-base': '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif',
  '--font-family-secondary': '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif',
  '--font-family-nav': '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif',

  '--heading-color': '#1f2937',
  '--heading-h1-color': 'var(--heading-color)',
  '--heading-h2-color': 'var(--heading-color)',
  '--heading-h3-color': 'var(--heading-color)',
  '--heading-h4-color': 'var(--heading-color)',
  '--heading-h5-color': 'var(--heading-color)',
  '--heading-h6-color': 'var(--heading-color)',

  '--font-size-base': '14px',
  '--font-size-p': '14px',
  '--font-size-h1': '42px',
  '--font-size-h2': '32px',
  '--font-size-h3': '24px',
  '--font-size-h4': '20px',
  '--font-size-h5': '16px',
  '--font-size-h6': '14px',
  '--font-weight-bold': '600',

  // Icon Styling
  '--icon-color': '#2f5596',
  '--edit-icon-bg': '#2563eb',
  '--edit-icon-color': '#ffffff',
  '--edit-icon-hover-bg': '#1d4ed8',

  // Site Wide Layout (New)
  '--header-bg': '#ffffff',
  '--footer-bg': '#2f5596',
  '--logo-width': '150px',
  '--footer-heading-color': '#ffffff',
  '--footer-text-color': '#e5e7eb',
};


const recalculateFolderCounts = (folders: ImageFolder[], images: ImageItem[]): ImageFolder[] => {
  return folders.map(f => {
    if (f.id === 'all') return { ...f, count: images.length };
    return { ...f, count: images.filter(i => i.folderId === f.id).length };
  });
};


const INITIAL_MOCK_USERS: PermissionUser[] = [
  { id: 'u1', name: 'Abhishek Tiwari', email: 'abhishek.tiwari@webstudio.de' },
  { id: 'u2', name: 'Aditi Mishra', email: 'aditi.mishra@webstudio.de' },
  { id: 'u3', name: 'Aman Munjal', email: 'aman.munjal@webstudio.de' },
  { id: 'u4', name: 'Amit Kumar', email: 'amit.kumar@webstudio.de' },
  { id: 'u5', name: 'Ankita Pandit', email: 'ankita.pandit@webstudio.de' },
  { id: 'u6', name: 'Shivdutt Mishra', email: 'shivdutt.mishra@webstudio.de' },
];



const INITIAL_MOCK_GROUPS: PermissionGroup[] = [];

const unescapeHtml = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&');
};

export type UpdateOptions = { suppressSuccess?: boolean };

interface AppState {
  viewMode: ViewMode;
  activeModal: ModalType;
  siteConfig: SiteConfig;
  themeConfig: ThemeConfig;
  pages: Page[];
  news: NewsItem[];
  events: EventItem[];
  documents: DocumentItem[];
  images: ImageItem[];
  imageFolders: ImageFolder[];
  /** Absolute URL of Images/default.* on the current SharePoint site. */
  defaultImageUrl: string;
  translationItems: TranslationItem[];
  permissionGroups: PermissionGroup[];
  permissionUsers: PermissionUser[];
  contactQueries: ContactQuery[];
  containerItems: ContainerItem[];
  contacts: ContactItem[];
  sliderItems: SliderItem[];
  sectionTemplates: SectionTemplate[];
  themeTemplates: ThemeTemplate[];
  webStudioUserRole: WebStudioUserRole;
  currentPageId: string;
  currentLanguage: LanguageCode;

  uiLabels: Record<string, MultilingualText>;
  editingLabelKey: string | null;
  editingContainerId: string | null;
  modalStack: ModalType[];
  successModal: { show: boolean; title?: string; message?: string; sourceModal?: ModalType };
  isNavLocked: boolean;
  /** Per-container flat browse view preference, persisted in APP_STATE. */
  browseFlatViewByContainer: Record<string, boolean>;

  toggleViewMode: () => void;
  setIsNavLocked: (locked: boolean) => void;
  setBrowseFlatView: (containerId: string, flatView: boolean) => void;
  openModal: (type: ModalType) => void;
  closeModal: () => void;
  showSuccessModal: (title?: string, message?: string, sourceModal?: ModalType) => void;
  hideSuccessModal: () => void;
  triggerSuccess: (itemName: string) => void;
  triggerTaggingSuccess: (action: 'tagged' | 'untagged') => void;
  updateThemeVar: (key: string, value: string) => void;
  setThemeConfig: (config: ThemeConfig) => void;
  setCurrentPage: (id: string) => void;
  resetTheme: () => void;
  setLanguage: (lang: LanguageCode) => void;
  setEditingContainerId: (id: string | null) => void;

  updateNavPosition: (pos: SiteConfig['navPosition']) => void;
  updateNavAlignment: (align: SiteConfig['navAlignment']) => void;
  updateHeaderConfig: (config: Partial<SiteConfig>) => void;
  updateLogo: (logo: SiteConfig['logo']) => void;
  addNavItem: (item: NavItem) => Promise<NavItem | null>;
  updateNavItem: (item: NavItem) => Promise<NavItem | null>;
  deleteNavItem: (id: string) => Promise<void>;

  addNews: (item: NewsItem) => Promise<NewsItem | null>;
  updateNews: (item: NewsItem, options?: UpdateOptions) => Promise<void>;
  deleteNews: (id: string) => Promise<void>;

  addEvent: (item: EventItem) => Promise<EventItem | null>;
  updateEvent: (item: EventItem, options?: UpdateOptions) => void;
  deleteEvent: (id: string) => void;

  addDocument: (item: DocumentItem) => Promise<DocumentItem | null>;
  updateDocument: (item: DocumentItem, options?: UpdateOptions) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;

  addContainerItem: (item: ContainerItem) => Promise<ContainerItem | null>;
  updateContainerItem: (item: ContainerItem, options?: UpdateOptions) => void;
  deleteContainerItem: (id: string) => void;

  addSliderItem: (item: SliderItem) => Promise<SliderItem | null>;
  updateSliderItem: (item: SliderItem, options?: UpdateOptions) => Promise<void>;
  deleteSliderItem: (id: string) => Promise<void>;

  addContact: (item: ContactItem) => Promise<ContactItem | null>;
  updateContact: (item: ContactItem, options?: UpdateOptions) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;

  addImage: (item: ImageItem) => void;
  uploadImage: (file: File, folderId?: string, metadata?: any) => Promise<ImageItem | null>;
  checkImageExists: (fileName: string, folderId?: string) => Promise<boolean>;
  updateImage: (item: ImageItem) => Promise<ImageItem | null>;
  deleteImage: (id: string) => Promise<void>;

  updateTranslationItem: (id: string, sourceList: string, original: string, lang: string, value: string) => Promise<void>;

  // Permission Actions
  createPermissionGroup: (group: PermissionGroup) => void;
  updatePermissionGroup: (group: PermissionGroup) => void;
  registerPermissionUser: (user: PermissionUser) => void;
  addMemberToGroup: (groupId: string, userId: string) => void;
  removeMemberFromGroup: (groupId: string, userId: string) => void;
  fetchGroupUsers: (groupId: string) => Promise<void>;

  // Contact Query Actions
  addContactQuery: (query: ContactQuery) => Promise<void>;
  submitContactQuery: (payload: import('./utils/contactFormApi').ContactSubmissionPayload) => Promise<import('./utils/contactFormApi').ContactSubmitResult>;
  updateContactQuery: (id: string, updates: Partial<ContactQuery>) => Promise<void>;
  deleteContactQuery: (ids: string[]) => Promise<void>;

  updateFooterConfig: (config: Partial<SiteConfig['footer']>) => void;

  openLabelEditor: (key: string) => void;
  updateLabel: (key: string, text: string, lang: LanguageCode) => Promise<void>;
  /** Like updateLabel but only updates uiLabels + SharePoint; does not change modals (for inline editors e.g. TooltipMenu). */
  updateUiLabel: (key: string, text: string, lang: LanguageCode) => Promise<void>;

  addPage: (page: Page) => Promise<Page | null>;
  updatePage: (page: Page, options?: UpdateOptions) => Promise<void>;
  publishPage: (pageId: string) => Promise<void>;
  deletePage: (id: string) => Promise<void>;
  addContainer: (pageId: string, container: Container) => Promise<Container | null>;
  updateContainer: (pageId: string, container: Container) => Promise<void>;
  deleteContainer: (pageId: string, cId: string) => Promise<void>;
  reorderContainers: (pageId: string, newOrder: Container[]) => Promise<void>;

  addSectionTemplate: (template: SectionTemplate) => Promise<SectionTemplate | null>;
  updateSectionTemplate: (template: SectionTemplate) => Promise<void>;
  deleteSectionTemplate: (id: string) => Promise<void>;
  getPublishedTemplatesForType: (containerType: ContainerType) => SectionTemplate[];
  addThemeTemplate: (template: Omit<ThemeTemplate, 'id'>) => Promise<ThemeTemplate | null>;
  updateThemeTemplate: (template: ThemeTemplate) => Promise<void>;
  deleteThemeTemplate: (id: string) => Promise<void>;
  getPublishedThemeTemplates: () => ThemeTemplate[];
  getSelectableThemeTemplates: () => ThemeTemplate[];
  applyThemeTemplate: (template: ThemeTemplate) => Promise<void>;

  // SharePoint Data Loading Actions
  loadFromSharePoint: () => Promise<void>;
  saveGlobalSettings: (type: 'theme' | 'site' | 'labels' | 'app') => Promise<void>;
  syncTranslations: () => Promise<void>;
  seedTranslations: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  isLoading: boolean;

  activeTranslationSource: string;
  setTranslationSource: (source: string) => void;
  translationSources: string[];

  // Helper functions for managing taggedItems
  removeItemFromContainers: (itemId: string) => Promise<void>;
  validateContainerTaggedItems: () => Promise<void>;
  persistContainerTaggingLookups: (pageId: string, container: Container) => Promise<void>;
  applyItemContainerLookupChanges: (itemId: string, listName: TaggableListName, nextContainerIds: string[]) => Promise<void>;
  applyItemPageLookupRemoval: (itemId: string, listName: TaggableListName, pageId: string) => Promise<void>;

  // Live preview sync — updates in-memory only, no SharePoint call
  syncContainerPreview: (pageId: string, container: Container) => void;
}

const normalizeSortOrder = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
};

let lastSuccessMessage = '';
let lastSuccessAt = 0;

const syncDefaultImageUrl = (images: ImageItem[], currentUrl: string): string => {
  return resolveDefaultImageUrl(images) || currentUrl;
};

export const useStore = create<AppState>()(
  (set, get) => ({
    viewMode: ViewMode.PREVIEW,
    activeModal: ModalType.NONE,
    themeConfig: DEFAULT_THEME,
    pages: [],
    news: [],
    events: [],
    documents: [],
    containerItems: [],
    contacts: [],
    sliderItems: [],
    sectionTemplates: [],
    themeTemplates: [],
    webStudioUserRole: 'standard' as WebStudioUserRole,
    images: [],
    imageFolders: [],
    defaultImageUrl: '',
    translationItems: [],
    permissionGroups: INITIAL_MOCK_GROUPS,
    permissionUsers: INITIAL_MOCK_USERS,
    contactQueries: [],
    currentPageId: '1',
    currentLanguage: getInitialCurrentLanguage(),
    uiLabels: INITIAL_UI_LABELS,
    editingLabelKey: null,
    editingContainerId: null,
    modalStack: [],
    successModal: { show: false },
    isNavLocked: true,
    browseFlatViewByContainer: {},
    isLoading: false,
    activeTranslationSource: 'TopNavigation',
    translationSources: [
      'TopNavigation',
      'SmartPages',
      'News',
      'Events',
      'Documents',
      'Containers',
      'GlobalSettings',
      'ContactQueries',
      'TranslationDictionary',
      'Images',
      'ContainerItems',
      'Contacts',
      'Labels'
    ],
    siteConfig: {
      name: '',
      languages: ['en'],
      defaultLanguage: 'en',
      navPosition: 'right',
      navAlignment: 'center',
      showBreadcrumb: true,
      headerWidth: 'full',
      headerWidthCustom: '',
      navigationWidth: undefined,
      navigationWidthCustom: '',
      headerBackgroundColor: '#ffffff',
      headerTopBackgroundColor: '#ffffff',
      headerBottomBackgroundColor: '#ffffff',
      headerLogoText: { en: '', de: '', fr: '', es: '' },
      headerLogoTextSpacing: '1rem',
      headerLogoTextFontSize: '1.25rem',
      headerTopAlignment: 'left',
      headerLogoMarginLeft: '0px',
      headerNavMarginLeft: '0px',
      headerNavHeight: '64px',
      headerLogoHeight: '64px',
      headerNavFontWeight: '700',
      headerNavHoverColor: '',
      headerSubmenuHoverBgColor: '',
      headerSubmenuHoverTextColor: '',
      headerMenuFontSize: '18px',
      headerMenuFontWeight: '500',
      headerMenuLineHeight: '1.4',
      headerMenuFontFamily: '',
      headerSubmenuFontSize: '18px',
      headerSubmenuFontWeight: '700',
      headerSubmenuLineHeight: '1.5',
      headerSubmenuFontFamily: '',
      headerSubmenuWidth: '100px',
      headerMenuTextTransform: 'uppercase',
      headerSubmenuTextTransform: 'none',
      headerBreadcrumbHeight: '30px',
      headerBreadcrumbFontSize: '14px',
      logo: { url: '', position: 'left', width: '150px' },
      navigation: [],
      footer: {
        template: 'Corporate',
        backgroundColor: '#f8f9fa',
        alignment: 'left',
        subFooterText: 'Powered By : Web Studio CMS',
        showBullets: true,
        fontSettings: { headingSize: '18px', subHeadingSize: '15px', headingWeight: '700', subHeadingWeight: '500' },
        columns: [
          { id: '1', title: 'Platform', links: [{ id: 'l1', label: 'SharePoint Online', url: '#' }, { id: 'l2', label: 'Power Platform', url: '#' }] },
          { id: '2', title: 'Legal', links: [{ id: 'l4', label: 'Privacy Policy', url: '#' }, { id: 'l5', label: 'Terms of Service', url: '#' }] },
          { id: '3', title: 'Company', links: [{ id: 'l7', label: 'About Us', url: '#' }, { id: 'l9', label: 'Contact', url: '#' }] }
        ],
        contactInfo: { address: 'Christinenstr 16, 10119 Berlin', email: 'info@webstudio.de', phone: '+49 30 868706600' },
        socialLinks: { linkedin: 'https://linkedin.com', facebook: '', twitter: '', instagram: '' },
        brandItems: [
          { id: '1', label: 'Company Name', value: 'Web Studio Corp' },
          { id: '2', label: 'Address', value: 'Christinenstr 16, 10119 Berlin' }
        ],
        contactItems: [
          { id: '1', label: 'Email', value: 'info@webstudio.de', type: 'Email' },
          { id: '2', label: 'Phone', value: '+49 30 868706600', type: 'Phone' }
        ],
        socialItems: [
          { id: '1', url: 'https://facebook.com', type: 'Facebook' },
          { id: '2', url: 'https://linkedin.com', type: 'LinkedIn' },
          { id: '3', url: 'https://twitter.com', type: 'Twitter' }
        ],
        bottomLinks: [
          { id: '1', label: 'Privacy Policy', url: '#' },
          { id: '2', label: 'Impress / Legal', url: '#' }
        ],
        copyright: { en: '© 2026 Web Studio Corp', de: '© 2026 Unternehmen Corp', fr: '© 2026 Entreprise Corp', es: '© 2026 Empresa Corp' }
      }
    },

    toggleViewMode: () => {
      if (!canAccessWebStudioEditor(get().webStudioUserRole)) return;
      set((state) => ({ viewMode: state.viewMode === ViewMode.PREVIEW ? ViewMode.EDIT : ViewMode.PREVIEW }));
    },
    openModal: (type) => {
      if (type !== ModalType.NONE && !canAccessWebStudioEditor(get().webStudioUserRole)) return;
      set((state) => {
        if (type === ModalType.NONE) return { activeModal: type, modalStack: [] };
        if (state.activeModal === type) return { successModal: { show: false, title: undefined, message: undefined } };

        // Ensure no duplicates in stack
        const newStack = state.modalStack.filter(m => m !== type);

        // Capture current modal to stack if it's not NONE
        if (state.activeModal !== ModalType.NONE) {
          newStack.push(state.activeModal);
        }

        return {
          activeModal: type,
          modalStack: newStack,
          // Prevent stale success popup from reappearing in newly opened modal contexts.
          successModal: { show: false, title: undefined, message: undefined }
        };
      });
    },

    setIsNavLocked: (locked) => {
      set({ isNavLocked: locked });
      get().saveGlobalSettings('app');
    },
    setBrowseFlatView: (containerId, flatView) => {
      set((state) => ({
        browseFlatViewByContainer: {
          ...state.browseFlatViewByContainer,
          [containerId]: flatView
        }
      }));
      get().saveGlobalSettings('app');
    },
    closeModal: () => set((state) => {
      // If we are closing certain modals, we might need to clear their associated state
      const isLabelEditor = state.activeModal === ModalType.LABEL_EDITOR;
      const editingLabelKey = isLabelEditor ? null : state.editingLabelKey;

      if (state.modalStack.length > 0) {
        const newStack = [...state.modalStack];
        const prevModal = newStack.pop() || ModalType.NONE;
        return {
          activeModal: prevModal,
          modalStack: newStack,
          editingLabelKey,
          successModal: { show: false, title: undefined, message: undefined }
        };
      }
      return {
        activeModal: ModalType.NONE,
        modalStack: [],
        editingLabelKey: null,
        editingContainerId: null,
        successModal: { show: false, title: undefined, message: undefined }
      };
    }),
    showSuccessModal: (title, message, sourceModal) => set({ successModal: { show: true, title, message, sourceModal } }),
    hideSuccessModal: () => set({ successModal: { show: false, title: undefined, message: undefined, sourceModal: undefined } }),
    triggerSuccess: (itemName) => {
      const state = get();
      const msgTemplate = state.uiLabels['MSG_SUCCESS']?.[state.currentLanguage] || '{0} has been updated successfully.';
      const nextMessage = msgTemplate.replace('{0}', itemName);
      const now = Date.now();

      // Avoid duplicate dialogs when multiple update calls happen quickly for the same item.
      if (lastSuccessMessage === nextMessage && now - lastSuccessAt < 1200) {
        return;
      }

      lastSuccessMessage = nextMessage;
      lastSuccessAt = now;
      state.showSuccessModal(undefined, nextMessage, state.activeModal);
    },
    triggerTaggingSuccess: (action) => {
      const state = get();
      const labelKey = action === 'tagged' ? 'MSG_ITEM_TAGGED_SUCCESS' : 'MSG_ITEM_UNTAGGED_SUCCESS';
      const fallback = action === 'tagged' ? 'Item tagged successfully.' : 'Item untagged successfully.';
      const message = state.uiLabels[labelKey]?.[state.currentLanguage] || fallback;
      state.showSuccessModal(undefined, message, state.activeModal);
    },
    updateThemeVar: (key, value) => {
      // Normalize key to lowercase to ensure consistency with CSS and translations
      const normalizedKey = key.toLowerCase();
      set((state) => ({
        themeConfig: { ...state.themeConfig, [normalizedKey]: value }
      }));
      get().saveGlobalSettings('theme');
    },
    setThemeConfig: (config) => {
      const normalizedConfig: ThemeConfig = {};
      Object.keys(config).forEach(k => {
        normalizedConfig[k.toLowerCase()] = config[k];
      });
      set({ themeConfig: normalizedConfig });
      get().saveGlobalSettings('theme');
    },
    setCurrentPage: (id) => {
      const state = get();
      const page = state.pages.find(p => p.id === id);
      if (page) {
        const currentHash = window.location.hash || '';
        const parsedRoute = parsePreviewHashRoute(currentHash, state.pages, state.siteConfig.navigation);
        const hasDeepLinkAnchor = !!getPreviewSectionAnchorFromHash(currentHash);
        const deepLinkBelongsToTargetPage = hasDeepLinkAnchor && parsedRoute.pageId === id;

        // Keep nested nav routes like #/home/test when they already resolve to this page.
        if (parsedRoute.pageId === id && currentHash && !deepLinkBelongsToTargetPage) {
          set({ currentPageId: id });
          get().saveGlobalSettings('app');
          return;
        }

        const routeSlug = page.slug === '/' ? '/home' : page.slug;
        const expectedHash = slugToPreviewHash(page.slug);

        // Preserve section deep links like "#/careers#meet-our-team" when they belong to this page.
        if (!deepLinkBelongsToTargetPage && currentHash !== expectedHash) {
          window.location.hash = routeSlug;
        }
        set({ currentPageId: id });
      }
      get().saveGlobalSettings('app');
    },
    resetTheme: () => {
      set({ themeConfig: DEFAULT_THEME });
      get().saveGlobalSettings('theme');
    },
    setLanguage: (lang) => {
      const enabled = getEnabledSiteLanguages(get().siteConfig);
      const nextLang = isLanguageEnabled(enabled, lang) ? lang : (get().siteConfig.defaultLanguage || 'en');
      set({ currentLanguage: nextLang });
      persistUiLanguage(nextLang);
      void get().saveGlobalSettings('app');
    },
    setEditingContainerId: (id) => {
      if (!canAccessWebStudioEditor(get().webStudioUserRole)) return;
      set({ editingContainerId: id });
      get().saveGlobalSettings('app');
    },
    setTranslationSource: (source) => set({ activeTranslationSource: source }),

    updateNavPosition: (pos) => {
      set((state) => ({ siteConfig: { ...state.siteConfig, navPosition: pos } }));
      get().saveGlobalSettings('site');
    },
    updateNavAlignment: (align) => {
      set((state) => ({ siteConfig: { ...state.siteConfig, navAlignment: align } }));
      get().saveGlobalSettings('site');
    },
    updateHeaderConfig: (config) => {
      set((state) => {
        const nextSiteConfig = normalizeSiteLayoutConfig({ ...state.siteConfig, ...config });
        if ('languages' in config) {
          nextSiteConfig.languages = normalizeSiteLanguages(nextSiteConfig.languages);
          nextSiteConfig.defaultLanguage = 'en';
        }
        const enabled = getEnabledSiteLanguages(nextSiteConfig);
        const currentLanguage = isLanguageEnabled(enabled, state.currentLanguage)
          ? state.currentLanguage
          : 'en';
        return {
          siteConfig: nextSiteConfig,
          themeConfig: applySiteLayoutWidthToTheme(nextSiteConfig, state.themeConfig),
          ...(currentLanguage !== state.currentLanguage ? { currentLanguage } : {}),
        };
      });
      if ('languages' in config) {
        const lang = get().currentLanguage;
        persistUiLanguage(lang);
      }
      void get().saveGlobalSettings('site');
      if (
        'headerWidth' in config ||
        'headerWidthCustom' in config ||
        'navigationWidth' in config ||
        'navigationWidthCustom' in config
      ) {
        void get().saveGlobalSettings('theme');
      }
    },
    updateLogo: (logo) => {
      set((state) => ({ siteConfig: { ...state.siteConfig, logo } }));
      get().saveGlobalSettings('site');
    },
    addNavItem: async (item) => {
      try {
        const state = get();
        // Dynamic Status
        let status: 'Draft' | 'Published' = item.status || 'Draft';
        if (item.type === 'External') {
          status = 'Published';
        } else if (item.type === 'Page' && item.pageId) {
          const linkedPage = state.pages.find(p => p.id === item.pageId);
          if (linkedPage?.status === 'Published') status = 'Published';
          else status = 'Draft';
        } else if (item.type === 'Container') {
          status = item.status === 'Published' ? 'Published' : 'Draft';
        }

        const { saveNavItem } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spData = {
          Title: item.title,
          ParentId: item.parentId !== 'root' ? Number(item.parentId) : null,
          NavType: item.type,
          SmartPageId: item.pageId ? Number(item.pageId) : null,
          ExternalURL: item.type === 'External' ? item.url || '' : '',
          ContainerId: item.type === 'Container' ? item.containerId || '' : '',
          SortOrder: normalizeSortOrder(item.order),
          IsVisible: item.isVisible,
          OpenInNewTab: item.openInNewTab || false,
          Status: status,
          Translations: JSON.stringify(item.translations || {})
        };
        const result = await saveNavItem(spData);
        const realId = result.Id || result.data.Id;
        const newItem: NavItem = {
          ...item,
          id: String(realId),
          status,
          modifiedDate: result.Modified || result.Created,
          createdDate: result.Created,
          createdBy: result.Author?.Title || 'System',
          modifiedBy: result.Editor?.Title || 'System'
        };
        set((state) => ({ siteConfig: { ...state.siteConfig, navigation: [...state.siteConfig.navigation, newItem] } }));
        return newItem;
      } catch (error) {
        console.error('Error adding nav item:', error);
        return null;
      }
    },

    updateNavItem: async (item) => {
      try {
        const state = get();
        // Dynamic Status: Page inherits from linked page; Container uses explicit status from editor.
        let status: 'Draft' | 'Published' = item.status || 'Draft';
        if (item.type === 'External') {
          status = 'Published';
        } else if (item.type === 'Page' && item.pageId) {
          const linkedPage = state.pages.find(p => p.id === item.pageId);
          if (linkedPage?.status === 'Published') status = 'Published';
          else status = 'Draft';
        } else if (item.type === 'Container') {
          status = item.status === 'Published' ? 'Published' : 'Draft';
        }

        const { updateNavItem: updateNavItemSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spData = {
          Title: item.title,
          ParentId: item.parentId !== 'root' ? Number(item.parentId) : null,
          NavType: item.type,
          SmartPageId: item.pageId ? Number(item.pageId) : null,
          ExternalURL: item.type === 'External' ? item.url || '' : '',
          ContainerId: item.type === 'Container' ? item.containerId || '' : '',
          SortOrder: normalizeSortOrder(item.order),
          IsVisible: item.isVisible,
          Status: status,
          OpenInNewTab: item.openInNewTab || false,
          Translations: JSON.stringify(item.translations || {})
        };
        const result = await updateNavItemSP(Number(item.id), spData);
        const finalItem: NavItem = {
          ...item,
          status,
          modifiedDate: result.Modified || result.Created,
          createdDate: result.Created,
          createdBy: result.Author?.Title || 'System',
          modifiedBy: result.Editor?.Title || 'System'
        };
        set((state) => ({
          siteConfig: {
            ...state.siteConfig,
            navigation: state.siteConfig.navigation.map(n => n.id === item.id ? finalItem : n)
          }
        }));
        // Show confirmation after successful update
        get().triggerSuccess(item.title || 'Navigation item');
        return finalItem;
      } catch (error) {
        console.error('Error updating nav item:', error);
        return null;
      }
    },

    deleteNavItem: async (id) => {
      try {
        const { deleteNavItem: deleteNavItemSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        await deleteNavItemSP(Number(id));
        set((state) => ({ siteConfig: { ...state.siteConfig, navigation: state.siteConfig.navigation.filter(n => n.id !== id && n.parentId !== id) } }));
      } catch (error) {
        console.error('Error deleting nav item:', error);
      }
    },

    addNews: async (item) => {
      try {
        const { saveNews } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spData = {
          Title: item.title,
          Status: item.status,
          PublishDate: item.publishDate,
          Description: item.description,
          ReadMoreURL: item.readMore?.url || '',
          ReadMoreText: item.readMore?.text || '',
          ReadMoreEnabled: item.readMore?.enabled || false,
          SEOConfig: JSON.stringify(item.seo || {}),
          Translations: JSON.stringify(item.translations || {}),
          // Keep ImageSlider compatible whether ImageUrl is Text or Hyperlink in SharePoint.
          ImageUrl: { Url: item.imageUrl || '', Description: item.imageName || '' },
          ImageName: item.imageName || ''
        };
        const savedItem = await saveNews(spData);
        const newItem = {
          ...item,
          id: String(savedItem.Id),
          createdBy: savedItem.Author?.Title || 'System',
          modifiedBy: savedItem.Editor?.Title || 'System',
          createdDate: savedItem.Created,
          modifiedDate: savedItem.Modified || savedItem.Created
        };
        set((state) => ({ news: [...state.news, newItem] })); get().triggerSuccess(item.title);
        return newItem;
      } catch (error) {
        console.error('Error adding news:', error);
        return null;
      }
    },

    updateNews: async (item, options) => {
      try {
        // Update local state immediately for responsiveness (Optimistic UI)
        set((state) => ({ news: state.news.map(n => n.id === item.id ? item : n) }));

        // Verify ID is numeric (real SP item) before calling service
        if (!isNaN(Number(item.id))) {
          const { updateNews: updateNewsSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
          if (updateNewsSP) {
            const spData = {
              Title: item.title,
              Status: item.status,
              PublishDate: item.publishDate,
              Description: item.description,
              ReadMoreURL: item.readMore?.url || '',
              ReadMoreText: item.readMore?.text || '',
              ReadMoreEnabled: item.readMore?.enabled || false,
              SEOConfig: JSON.stringify(item.seo || {}),
              Translations: JSON.stringify(item.translations || {}),
              ImageUrl: { Url: item.imageUrl || '', Description: item.imageName || '' },
              ImageName: item.imageName || ''
            };
            const updatedItem = await updateNewsSP(Number(item.id), spData);

            // Final sync with SP-authoritative metadata
            const finalItem = {
              ...item,
              createdBy: updatedItem?.Author?.Title || item.createdBy || 'System',
              modifiedBy: updatedItem?.Editor?.Title || 'System',
              createdDate: updatedItem?.Created || item.createdDate,
              modifiedDate: updatedItem?.Modified || updatedItem?.Created || item.modifiedDate
            };

            set((state) => ({ news: state.news.map(n => n.id === item.id ? finalItem : n) }));
            console.log(`✅ News updated in SharePoint with metadata: ${item.id}`);
          }
        } else {
          console.warn(`Skipping SP update for non-numeric News ID: ${item.id}`);
        }
        // Show confirmation after successful update
        if (!options?.suppressSuccess) {
          get().triggerSuccess(item.title || 'News item');
        }
      } catch (error) {
        console.error('Error updating news:', error);
        // Optionally revert local state here if needed
      }
    },

    deleteNews: async (id) => {
      try {
        if (!isNaN(Number(id))) {
          const { deleteNews: deleteNewsSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
          await deleteNewsSP(Number(id));
        } else {
          console.warn(`Skipping SP delete for non-numeric News ID: ${id}`);
        }
        set((state) => ({ news: state.news.filter(n => n.id !== id) }));

        // Remove from all containers' taggedItems
        get().removeItemFromContainers(id);
      } catch (error) {
        console.error('Error deleting news:', error);
      }
    },

    addEvent: async (item) => {
      try {
        const { saveEvent } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spData = {
          Title: item.title,
          StartDate: item.startDate,
          EndDate: item.endDate,
          Location: item.location,
          Description: item.description,
          Category: item.category,
          Translations: JSON.stringify(item.translations || {}),
          Status: item.status,
          // Keep ImageSlider compatible whether ImageUrl is Text or Hyperlink in SharePoint.
          ImageUrl: { Url: item.imageUrl || '', Description: item.imageName || '' },
          ImageName: item.imageName || '',
          ReadMoreURL: item.readMore?.url || '',
          ReadMoreText: item.readMore?.text || '',
          ReadMoreEnabled: item.readMore?.enabled || false,
          SEOConfig: JSON.stringify(item.seo || {})
        };
        const savedItem = await saveEvent(spData);
        const newItem = {
          ...item,
          id: String(savedItem.Id),
          createdBy: savedItem.Author?.Title || 'System',
          modifiedBy: savedItem.Editor?.Title || 'System',
          createdDate: savedItem.Created,
          modifiedDate: savedItem.Modified || savedItem.Created
        };
        set((state) => ({ events: [...state.events, newItem] })); get().triggerSuccess(item.title);
        return newItem;
      } catch (error) {
        console.error('Error adding event:', error);
        return null;
      }
    },
    updateEvent: async (item, options) => {
      try {
        // Update local state immediately
        set((state) => ({ events: state.events.map(n => n.id === item.id ? item : n) }));

        if (!isNaN(Number(item.id))) {
          const { updateEvent: updateEventSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
          if (updateEventSP) {
            const spData = {
              Title: item.title,
              StartDate: item.startDate,
              EndDate: item.endDate,
              Location: item.location,
              Description: item.description,
              Category: item.category,
              Translations: JSON.stringify(item.translations || {}),
              Status: item.status,
              ImageUrl: { Url: item.imageUrl || '', Description: item.imageName || '' },
              ImageName: item.imageName || '',
              ReadMoreURL: item.readMore?.url || '',
              ReadMoreText: item.readMore?.text || '',
              ReadMoreEnabled: item.readMore?.enabled || false,
              SEOConfig: JSON.stringify(item.seo || {})
            };
            await updateEventSP(Number(item.id), spData);
            console.log(`✅ Event updated in SharePoint: ${item.id}`);
          }
        } else {
          console.warn(`Skipping SP update for non-numeric Event ID: ${item.id}`);
        }
        // Show confirmation after successful update
        if (!options?.suppressSuccess) {
          get().triggerSuccess(item.title || 'Event');
        }
      } catch (error) {
        console.error('Error updating event:', error);
      }
    },
    deleteEvent: async (id) => {
      try {
        if (!isNaN(Number(id))) {
          const { deleteEvent: deleteEventSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
          await deleteEventSP(Number(id));
        } else {
          console.warn(`Skipping SP delete for non-numeric Event ID: ${id}`);
        }
        set((state) => ({ events: state.events.filter(n => n.id !== id) }));

        // Remove from all containers' taggedItems
        get().removeItemFromContainers(id);
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    },

    addDocument: async (item) => {
      try {
        const { saveDocument } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spData = {
          Title: item.title,
          DocStatus: item.status,
          DocumentYear: item.year,
          DocumentDescriptions: item.description,
          ItemRank: item.itemRank,
          DocType: item.type,
          FileRef: item.url,
          File: item.file,
          SortOrder: normalizeSortOrder(item.sortOrder),
          Translations: item.translations ? JSON.stringify(item.translations) : '{}',
          ImageUrl: { Url: item.imageUrl || '', Description: item.imageName || '' },
          ImageName: item.imageName || ''
        };
        const result = await saveDocument(spData);
        const savedItem = result?.data ?? result;
        const newItem: DocumentItem = {
          ...item,
          id: String(savedItem.Id),
          name: savedItem.FileLeafRef || item.name || item.title,
          url: savedItem.FileRef || item.url,
          createdBy: savedItem.Author?.Title || 'System',
          modifiedBy: savedItem.Editor?.Title || 'System',
          createdDate: savedItem.Created,
          modifiedDate: savedItem.Modified || savedItem.Created,
        };
        set((state) => ({ documents: [...state.documents, newItem] })); get().triggerSuccess(item.title || item.name || "Item");
        return newItem;
      } catch (error) {
        console.error('Error adding document:', error);
        return null;
      }
    },

    updateDocument: async (item, options) => {
      try {
        const { updateDocument: updateDocumentSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spData = {
          Title: item.title,
          Name: item.name, // Include for rename detection
          DocumentYear: item.year,
          DocStatus: item.status,
          ItemRank: item.itemRank,
          DocType: item.type,
          DocumentDescriptions: item.description,
          SortOrder: normalizeSortOrder(item.sortOrder),
          Translations: item.translations ? JSON.stringify(item.translations) : '{}',
          ImageUrl: { Url: item.imageUrl || '', Description: item.imageName || '' },
          ImageName: item.imageName || '',
        };
        const updatedItem = await updateDocumentSP(Number(item.id), spData);
        const savedItem = updatedItem?.data ?? updatedItem;
        const mergedItem: DocumentItem = {
          ...item,
          name: savedItem?.FileLeafRef || item.name,
          url: savedItem?.FileRef || item.url,
          createdBy: savedItem?.Author?.Title || item.createdBy || 'System',
          modifiedBy: savedItem?.Editor?.Title || item.modifiedBy || 'System',
          createdDate: savedItem?.Created || item.createdDate,
          modifiedDate: savedItem?.Modified || savedItem?.Created || item.modifiedDate,
        };
        set((state) => ({ documents: state.documents.map(n => n.id === item.id ? mergedItem : n) }));
        // Show confirmation after successful update
        if (!options?.suppressSuccess) {
          get().triggerSuccess(item.title || item.name || 'Document');
        }
      } catch (error) {
        console.error('Error updating document:', error);
      }
    },

    deleteDocument: async (id) => {
      try {
        const { deleteDocument: deleteDocumentSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        await deleteDocumentSP(Number(id));
        set((state) => ({ documents: state.documents.filter(n => n.id !== id) }));

        // Remove from all containers' taggedItems
        get().removeItemFromContainers(id);
      } catch (error) {
        console.error('Error deleting document:', error);
      }
    },

    addContainerItem: async (item) => {
      try {
        const { saveContainerItem } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spData = {
          Title: item.title,
          Status: item.status,
          SortOrder: normalizeSortOrder(item.sortOrder),
          Description: item.description,
          Translations: JSON.stringify(item.translations || {}),
          ImageUrl: { Url: item.imageUrl || '', Description: item.imageName || '' },
          ImageName: item.imageName || '',
          BtnEnabled: item.btnEnabled || false,
          BtnName: toSharePointText(item.btnName),
          BtnLinkType: item.btnLinkType || 'url',
          BtnUrl: item.btnUrl || '',
          BtnContainerId: item.btnContainerId || '',
          BtnTargetContainerTitle: item.btnTargetContainerTitle || '',
          BtnConfig: JSON.stringify(item.btnConfig || {})
        };
        const savedItem = await saveContainerItem(spData);
        const newItem = {
          ...item,
          id: String(savedItem.Id),
          createdBy: savedItem.Author?.Title || 'System',
          modifiedBy: savedItem.Editor?.Title || 'System',
          createdDate: savedItem.Created,
          modifiedDate: savedItem.Modified || savedItem.Created
        };
        set((state) => ({ containerItems: [...state.containerItems, newItem] })); get().triggerSuccess(item.title);
        return newItem;
      } catch (error) {
        console.error('Error adding container item:', error);
        return null;
      }
    },

    updateContainerItem: async (item, options) => {
      try {
        set((state) => ({ containerItems: state.containerItems.map(n => n.id === item.id ? item : n) }));
        if (!isNaN(Number(item.id))) {
          const { updateContainerItem: updateContainerItemSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
          const spData = {
            Title: item.title,
            Status: item.status,
            SortOrder: normalizeSortOrder(item.sortOrder),
            Description: item.description,
            Translations: JSON.stringify(item.translations || {}),
            // Keep ImageSlider compatible whether ImageUrl is Text or Hyperlink in SharePoint.
            ImageUrl: { Url: item.imageUrl || '', Description: item.imageName || '' },
            ImageName: item.imageName || '',
            BtnEnabled: item.btnEnabled || false,
            BtnName: toSharePointText(item.btnName),
            BtnLinkType: item.btnLinkType || 'url',
            BtnUrl: item.btnUrl || '',
            BtnContainerId: item.btnContainerId || '',
            BtnTargetContainerTitle: item.btnTargetContainerTitle || '',
            BtnConfig: JSON.stringify(item.btnConfig || {})
          };
          await updateContainerItemSP(Number(item.id), spData);
        }
        // Show confirmation after successful update
        if (!options?.suppressSuccess) {
          get().triggerSuccess(item.title || 'Container item');
        }
      } catch (error) {
        console.error('Error updating container item:', error);
      }
    },

    deleteContainerItem: async (id) => {
      try {
        if (!isNaN(Number(id))) {
          const { deleteContainerItem: deleteContainerItemSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
          await deleteContainerItemSP(Number(id));
        }
        set((state) => ({ containerItems: state.containerItems.filter(n => n.id !== id) }));

        // Remove from all containers' taggedItems
        get().removeItemFromContainers(id);
      } catch (error) {
        console.error('Error deleting container item:', error);
      }
    },

    addSliderItem: async (item) => {
      try {
        const { saveSliderItem } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spData = {
          Title: item.title,
          Subtitle: item.subtitle || '',
          Description: item.description || '',
          Status: item.status,
          SortOrder: normalizeSortOrder(item.sortOrder),
          CtaText: item.ctaText || '',
          CtaUrl: item.ctaUrl || '',
          Translations: JSON.stringify(item.translations || {}),
          ImageUrl: { Url: item.imageUrl || '', Description: item.imageName || '' },
          ImageName: item.imageName || '',
          ItemType: item.itemType || ''
        };
        const savedItem = await saveSliderItem(spData);
        const newItem = {
          ...item,
          id: String(savedItem.Id),
          createdBy: savedItem.Author?.Title || 'System',
          modifiedBy: savedItem.Editor?.Title || 'System',
          createdDate: savedItem.Created,
          modifiedDate: savedItem.Modified || savedItem.Created
        };
        set((state) => ({ sliderItems: [...state.sliderItems, newItem] })); get().triggerSuccess(item.title);
        return newItem;
      } catch (error) {
        console.error('Error adding slider item:', error);
        const localItem: SliderItem = {
          ...item,
          id: String(item.id || `slider_${Date.now()}`),
        };
        set((state) => ({
          sliderItems: state.sliderItems.some((entry) => String(entry.id) === String(localItem.id))
            ? state.sliderItems.map((entry) => (String(entry.id) === String(localItem.id) ? localItem : entry))
            : [...state.sliderItems, localItem],
        }));
        return localItem;
      }
    },

    updateSliderItem: async (item, options) => {
      try {
        set((state) => ({ sliderItems: state.sliderItems.map(n => n.id === item.id ? item : n) }));
        if (!isNaN(Number(item.id))) {
          const { updateSliderItem: updateSliderItemSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
          const spData = {
            Title: item.title,
            Subtitle: item.subtitle || '',
            Description: item.description || '',
            Status: item.status,
            SortOrder: normalizeSortOrder(item.sortOrder),
            CtaText: item.ctaText || '',
            CtaUrl: item.ctaUrl || '',
            Translations: JSON.stringify(item.translations || {}),
            // Keep ImageSlider compatible whether ImageUrl is Text or Hyperlink in SharePoint.
            ImageUrl: { Url: item.imageUrl || '', Description: item.imageName || '' },
            ImageName: item.imageName || '',
            ItemType: item.itemType || ''
          };
          await updateSliderItemSP(Number(item.id), spData);
        }
        // Show confirmation after successful update
        if (!options?.suppressSuccess) {
          get().triggerSuccess(item.title || 'Slider item');
        }
      } catch (error) {
        console.error('Error updating slider item:', error);
      }
    },

    deleteSliderItem: async (id) => {
      try {
        if (!isNaN(Number(id))) {
          const { deleteSliderItem: deleteSliderItemSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
          await deleteSliderItemSP(Number(id));
        }
        set((state) => ({ sliderItems: state.sliderItems.filter(n => n.id !== id) }));

        // Remove from all containers' taggedItems
        get().removeItemFromContainers(id);
      } catch (error) {
        console.error('Error deleting slider item:', error);
      }
    },

    addContact: async (item) => {
      try {
        const { saveContact } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spData = {
          Title: item.fullName,
          FirstName: item.firstName || '',
          LastName: item.lastName || '',
          Status: item.status,
          SortOrder: normalizeSortOrder(item.sortOrder),
          JobTitle: item.jobTitle || '',
          Company: item.company || '',
          Email: item.email || '',
          Phone: item.phone || '',
          Description: item.description,
          Translations: JSON.stringify(item.translations || {}),
          ImageUrl: { Url: item.imageUrl || '', Description: item.imageName || '' },
          ImageName: item.imageName || '',
          BtnEnabled: item.btnEnabled || false,
          BtnName: toSharePointText(item.btnName),
          BtnLinkType: item.btnLinkType || 'url',
          BtnUrl: item.btnUrl || '',
          BtnContainerId: item.btnContainerId || '',
          BtnTargetContainerTitle: item.btnTargetContainerTitle || '',
          BtnConfig: JSON.stringify(item.btnConfig || {})
        };
        const savedItem = await saveContact(spData);
        const newItem = {
          ...item,
          id: String(savedItem.Id),
          createdBy: savedItem.Author?.Title || 'System',
          modifiedBy: savedItem.Editor?.Title || 'System',
          createdDate: savedItem.Created,
          modifiedDate: savedItem.Modified || savedItem.Created
        };
        set((state) => ({ contacts: [...state.contacts, newItem] })); get().triggerSuccess(item.fullName);
        return newItem;
      } catch (error) {
        console.error('Error adding contact:', error);
        return null;
      }
    },

    updateContact: async (item, options) => {
      try {
        const updatedContact = {
          ...item,
          modifiedDate: new Date().toISOString(),
          imageCacheToken: Date.now(),
        };
        set((state) => ({ contacts: state.contacts.map(n => n.id === item.id ? updatedContact : n) }));
        if (!isNaN(Number(item.id))) {
          const { updateContact: updateContactSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
          const spData = {
            Title: item.fullName,
            FirstName: item.firstName || '',
            LastName: item.lastName || '',
            Status: item.status,
            SortOrder: normalizeSortOrder(item.sortOrder),
            JobTitle: item.jobTitle || '',
            Company: item.company || '',
            Email: item.email || '',
            Phone: item.phone || '',
            Description: item.description,
            Translations: JSON.stringify(item.translations || {}),
            // Contacts.ImageUrl is a Hyperlink field in SharePoint, so it must be sent as an object.
            ImageUrl: { Url: item.imageUrl || '', Description: item.imageName || '' },
            ImageName: item.imageName || '',
            BtnEnabled: item.btnEnabled || false,
            BtnName: toSharePointText(item.btnName),
            BtnLinkType: item.btnLinkType || 'url',
            BtnUrl: item.btnUrl || '',
            BtnContainerId: item.btnContainerId || '',
            BtnTargetContainerTitle: item.btnTargetContainerTitle || '',
            BtnConfig: JSON.stringify(item.btnConfig || {})
          };
          await updateContactSP(Number(item.id), spData);
          console.log(`✅ Contact updated in SharePoint: ${item.id}`);
        }
        // Show confirmation after successful update
        if (!options?.suppressSuccess) {
          get().triggerSuccess(item.fullName || item.email || 'Contact');
        }
      } catch (error) {
        console.error('Error updating contact:', error);
      }
    },

    deleteContact: async (id) => {
      try {
        if (!isNaN(Number(id))) {
          const { deleteContact: deleteContactSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
          await deleteContactSP(Number(id));
        }
        set((state) => ({ contacts: state.contacts.filter(n => n.id !== id) }));

        // Remove from all containers' taggedItems
        get().removeItemFromContainers(id);
      } catch (error) {
        console.error('Error deleting contact:', error);
      }
    },

    addImage: (item) => set((state) => {
      const newImages = [...state.images, item];
      return {
        images: newImages,
        imageFolders: recalculateFolderCounts(state.imageFolders, newImages),
        defaultImageUrl: syncDefaultImageUrl(newImages, state.defaultImageUrl),
      };
    }),

    checkImageExists: async (fileName: string, folderId: string = '') => {
      try {
        const { checkImageExists } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        return await checkImageExists(fileName, folderId);
      } catch (error) {
        console.error('Error checking image existence:', error);
        return false;
      }
    },

    uploadImage: async (file: File, folderId?: string, metadata?: any) => {
      try {
        const { uploadImage } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const result = await uploadImage(file, folderId, metadata);

        if (result && result.item) {
          const { getSiteAbsoluteUrl } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
          const siteUrl = await getSiteAbsoluteUrl();
          const host = new URL(siteUrl).origin;
          const fileRef = result.item.FileRef || '';
          const absoluteUrl = fileRef.startsWith('http') ? fileRef : `${host}${fileRef}`;

          const newItem: ImageItem = {
            id: String(result.item.Id),
            name: result.item.FileLeafRef,
            url: absoluteUrl,
            folderId: folderId || 'all',
            title: metadata?.Title || result.item.FileLeafRef,
            description: metadata?.Description || '',
            createdDate: result.item.Created || new Date().toISOString(),
            modifiedDate: result.item.Modified || new Date().toISOString(),
            createdBy: 'System'
          };

          set((state: AppState) => {
            const newImages = [...state.images.filter(img => img.id !== newItem.id), newItem];
            return {
              images: newImages,
              imageFolders: recalculateFolderCounts(state.imageFolders, newImages),
              defaultImageUrl: syncDefaultImageUrl(newImages, state.defaultImageUrl),
            };
          });
          return newItem;
        }
        return null;
      } catch (error) {
        console.error('Error uploading image:', error);
        return null;
      }
    },

    updateImage: async (item: ImageItem) => {
      try {
        const { updateImage } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');

        let fileToUpload: File | undefined;
        if (item.url && item.url.startsWith('data:')) {
          const response = await fetch(item.url);
          const blob = await response.blob();
          const mimeType =
            blob.type ||
            item.url.match(/^data:([^;]+)/)?.[1] ||
            (item.name?.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/png');
          fileToUpload = new File([blob], item.name, { type: mimeType });
        }

        const updatedMetadata = {
          Title: item.title,
          Description: item.description,
          AltText: item.altText,
          CopyrightInfo: item.copyright,
          Keywords: item.keywords,
          AssetCategory: item.folderId !== 'all' ? item.folderId : undefined
        };

        const result = await updateImage(Number(item.id), fileToUpload, updatedMetadata);

        const { getSiteAbsoluteUrl } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const siteUrl = await getSiteAbsoluteUrl();
        const host = new URL(siteUrl).origin;
        const fileRef = result.FileRef || '';
        const absoluteUrl = fileRef.startsWith('http') ? fileRef : `${host}${fileRef}`;

        const updatedItem: ImageItem = {
          ...item,
          id: String(result.Id),
          name: result.FileLeafRef,
          url: absoluteUrl,
          title: result.Title || result.FileLeafRef,
          description: result.Description || '',
          altText: result.AltText || '',
          copyright: result.CopyrightInfo || '',
          keywords: result.Keywords || '',
          modifiedDate: result.Modified || new Date().toISOString()
        };

        set((state: AppState) => {
          const newImages = state.images.map(i => i.id === updatedItem.id ? updatedItem : i);
          return {
            images: newImages,
            imageFolders: recalculateFolderCounts(state.imageFolders, newImages),
            defaultImageUrl: syncDefaultImageUrl(newImages, state.defaultImageUrl),
          };
        });
        return updatedItem;
      } catch (error) {
        console.error('Error updating image:', error);
        return null;
      }
    },
    deleteImage: async (id) => {
      try {
        const { deleteImage } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        await deleteImage(Number(id));

        set((state) => {
          const newImages = state.images.filter(i => i.id !== id);
          return {
            images: newImages,
            imageFolders: recalculateFolderCounts(state.imageFolders, newImages),
            defaultImageUrl: syncDefaultImageUrl(newImages, state.defaultImageUrl),
          };
        });
      } catch (error) {
        console.error('Error deleting image:', error);
      }
    },

    updateTranslationItem: async (id, sourceList, original, lang, value) => {
      set((state) => {
        const existingIndex = state.translationItems.findIndex(
          item => item.id === id && item.sourceList === sourceList
        );
        let updatedItems = [...state.translationItems];
        if (existingIndex >= 0) {
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            translations: { ...updatedItems[existingIndex].translations, [lang]: value },
            lastUpdated: new Date().toISOString()
          };
        } else {
          const newItem: TranslationItem = {
            id,
            sourceList,
            original,
            translations: { [lang]: value },
            lastUpdated: new Date().toISOString()
          };
          updatedItems.push(newItem);
        }

        // If source is Labels, also update the hardcoded sync source
        if (sourceList === 'Labels' && state.uiLabels[id]) {
          return {
            translationItems: updatedItems,
            uiLabels: {
              ...state.uiLabels,
              [id]: { ...state.uiLabels[id], [lang]: value }
            }
          };
        }

        return { translationItems: updatedItems };
      });

      // Persistence logic
      try {
        const state = get();
        const { upsertTranslation } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const targetItem = state.translationItems.find(i => i.id === id && i.sourceList === sourceList);
        if (targetItem) {
          await upsertTranslation(id, targetItem.translations, sourceList);
        }

        // If it's a label, also sync to GlobalSettings blob for fast boot
        if (sourceList === 'Labels') {
          await get().saveGlobalSettings('labels');
        }
      } catch (error) {
        console.error('Error persisting translation update:', error);
      }
    },

    // Permission Actions
    createPermissionGroup: (group) => set((state) => ({ permissionGroups: [...state.permissionGroups, group] })),
    updatePermissionGroup: (group) => set((state) => ({ permissionGroups: state.permissionGroups.map(g => g.id === group.id ? group : g) })),
    registerPermissionUser: (user) => set((state) => ({
      permissionUsers: state.permissionUsers.some(u => u.id === user.id)
        ? state.permissionUsers
        : [...state.permissionUsers, user],
    })),

    addMemberToGroup: async (groupId: string, userId: string) => {
      try {
        const user = get().permissionUsers.find(u => u.id === userId);
        if (!user) return;

        const { resolveSiteUserLoginName, addUserToSiteGroup } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spLoginName = await resolveSiteUserLoginName({
          groupId,
          userId,
          email: user.email,
        });

        if (!spLoginName) {
          console.error('Could not resolve SharePoint login for add:', { groupId, userId, email: user.email });
          return;
        }

        const added = await addUserToSiteGroup(groupId, user.email);
        if (!added) return;

        console.log(`✅ Added user ${user.name} to group ${groupId}`);
        set((state) => ({
          permissionGroups: state.permissionGroups.map(g => g.id === groupId ? { ...g, memberIds: [...g.memberIds, userId] } : g)
        }));
      } catch (error) {
        console.error("Error adding member to group:", error);
      }
    },
    removeMemberFromGroup: (groupId: string, userId: string) => set((state) => ({
      permissionGroups: state.permissionGroups.map(g => g.id === groupId ? { ...g, memberIds: g.memberIds.filter(id => id !== userId) } : g)
    })),
    fetchGroupUsers: async (groupId: string) => {
      try {
        const { getSiteGroupUsers } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const groupUsers = await getSiteGroupUsers(groupId);

        set((state) => {
          const newUsers = [...state.permissionUsers];
          groupUsers.forEach(gu => {
            if (!newUsers.some(u => u.id === gu.id)) {
              newUsers.push(gu);
            }
          });

          const newGroups = state.permissionGroups.map(g =>
            g.id === groupId ? { ...g, memberIds: groupUsers.map(gu => gu.id) } : g
          );

          return { permissionUsers: newUsers, permissionGroups: newGroups };
        });
      } catch (error) {
        console.error("Error fetching group users:", error);
      }
    },


    // Contact Query Actions
    addContactQuery: async (query) => {
      try {
        // Add to local state immediately for responsiveness
        set((state) => ({ contactQueries: [query, ...state.contactQueries] }));

        // Save to SharePoint
        const { saveContactQuery } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spData = {
          Title: query.email || 'Anonymous',
          SourcePageId: query.pageId ? Number(query.pageId) : null,
          QueryStatus: query.status,
          FormData: JSON.stringify({
            fields: query.fields,
            firstName: query.firstName,
            lastName: query.lastName,
            email: query.email,
            pageName: query.pageName,
            containerId: query.containerId,
            created: query.created
          })
        };
        const result = await saveContactQuery(spData);
        const realId = result.data ? result.data.Id : result.Id;

        // Update with real SharePoint ID
        set((state) => ({
          contactQueries: state.contactQueries.map(q =>
            q.id === query.id ? { ...q, id: String(realId) } : q
          )
        }));

        console.log(`✅ Contact query saved to SharePoint with ID: ${realId}`);
      } catch (error) {
        console.error('Error saving contact query:', error);
      }
    },

    submitContactQuery: async (payload) => {
      try {
        const { submitContactForm } = await import(/* webpackChunkName: 'contact-form-api' */ './utils/contactFormApi');
        const result = await submitContactForm(payload);
        if (result.success) {
          const { captchaId, captchaAnswer, _ws_company, formStartedAt, ...query } = payload;
          set((state) => ({ contactQueries: [query, ...state.contactQueries] }));
        }
        return result;
      } catch (error) {
        console.error('Error submitting contact query:', error);
        return { success: false, error: String(error) };
      }
    },

    deleteContactQuery: async (ids: string[]) => {
      try {
        // Delete from SharePoint
        const { deleteContactQueries } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const numericIds = ids.filter(id => !isNaN(Number(id))).map(id => Number(id));
        if (numericIds.length > 0) {
          await deleteContactQueries(numericIds);
        }

        // Update local state
        set((state) => ({ contactQueries: state.contactQueries.filter(q => !ids.includes(q.id)) }));
        console.log(`✅ Deleted ${ids.length} contact queries`);
      } catch (error) {
        console.error('Error deleting contact queries:', error);
      }
    },

    updateContactQuery: async (id: string, updates: Partial<ContactQuery>) => {
      try {
        // Update SharePoint
        const { updateContactQuery: updateContactQuerySP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spData: any = {};
        if (updates.status) spData.QueryStatus = updates.status;

        // If we have other fields to update, we'd add them here.
        // For now, status is the main one used by the UI.

        await updateContactQuerySP(Number(id), spData);

        // Update local state
        set((state) => ({
          contactQueries: state.contactQueries.map(q =>
            q.id === id ? { ...q, ...updates } : q
          )
        }));

        console.log(`✅ Contact query ${id} updated`);
      } catch (error) {
        console.error('Error updating contact query:', error);
      }
    },

    updateFooterConfig: (config) => set((state) => ({ siteConfig: { ...state.siteConfig, footer: { ...state.siteConfig.footer, ...config } } })),

    openLabelEditor: (key) => set((state) => {
      const newStack = [...state.modalStack];
      if (state.activeModal !== ModalType.NONE && state.activeModal !== ModalType.LABEL_EDITOR) {
        newStack.push(state.activeModal);
      }
      return { activeModal: ModalType.LABEL_EDITOR, editingLabelKey: key, modalStack: newStack };
    }),
    updateLabel: async (key, text, lang) => {
      set((state) => {
        const updatedLabels = { ...state.uiLabels, [key]: { ...state.uiLabels[key], [lang]: text } };
        const nextState: any = { uiLabels: updatedLabels, editingLabelKey: null };

        if (state.modalStack.length > 0) {
          const newStack = [...state.modalStack];
          nextState.activeModal = newStack.pop();
          nextState.modalStack = newStack;
        } else {
          nextState.activeModal = ModalType.NONE;
          nextState.modalStack = [];
        }

        return nextState;
      });

      // Backend Persistence
      try {
        const state = get();
        const { upsertTranslation } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');

        // 1. Save to TranslationDictionary list
        await upsertTranslation(key, state.uiLabels[key], 'Labels');

        // 2. Save to GlobalSettings (UI_LABELS blob)
        await get().saveGlobalSettings('labels');

        console.log(`✅ Label '${key}' persisted to SharePoint`);
      } catch (error) {
        console.error('❌ Error persisting label update:', error);
      }
    },

    updateUiLabel: async (key, text, lang) => {
      set((state) => {
        const base: MultilingualText =
          state.uiLabels[key] || INITIAL_UI_LABELS[key] || { en: '', de: '', fr: '', es: '' };
        return {
          uiLabels: { ...state.uiLabels, [key]: { ...base, [lang]: text } },
        };
      });

      try {
        const state = get();
        const { upsertTranslation } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        await upsertTranslation(key, state.uiLabels[key], 'Labels');
        await get().saveGlobalSettings('labels');
        console.log(`✅ UI label '${key}' persisted (inline)`);
      } catch (error) {
        console.error('❌ Error persisting UI label:', error);
      }
    },

    addPage: async (page) => {
      try {
        // 1. Save Page to SharePoint
        const { savePage, saveContainer } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spPageData = {
          Title: page.title.en,
          MultilingualTitle: JSON.stringify(page.title),
          Slug: page.slug,
          PageStatus: page.status,
          IsHomePage: page.isHomePage,
          Description: page.description,
          ImageUrl: page.imageUrl ? { Url: page.imageUrl, Description: page.imageName || '' } : null,
          ImageName: page.imageName || '',
          SortOrder: page.sortOrder || 0,
          SEOConfig: JSON.stringify(page.seo || {}),
          VersionNote: 'Initial Creation'
        };

        const savedPage = await savePage(spPageData);
        // PnPjs returns { data: { Id: ... } }
        const realPageId = String(savedPage.Id);

        // 2. Assign Real ID to Containers & Save Them
        const containersToSave = page.containers && page.containers.length > 0
          ? page.containers
          : [];

        const savedContainersWithIds: Container[] = [];

        for (let i = 0; i < containersToSave.length; i++) {
          const container = containersToSave[i];
          const spContainerData = {
            PageId: Number(realPageId),
            ContainerType: container.type,
            SortOrder: i,
            Settings: JSON.stringify(container.settings || {}),
            ContainerContent: JSON.stringify(container.content || {}),
            IsVisible: container.isVisible,
            Title: container.title || container.settings?.containerTitle || container.settings?.title || container.type,
            Status: container.status || 'Draft',
            BtnEnabled: container.settings?.btnEnabled || false,
            BtnName: toSharePointText(container.settings?.btnName),
            BtnLinkType: container.settings?.btnLinkType || 'url',
            BtnUrl: container.settings?.btnUrl || '',
            BtnContainerId: container.settings?.btnContainerId || ''
          };
          const savedContainer = await saveContainer(spContainerData);
          savedContainersWithIds.push({ ...container, id: String(savedContainer.data.Id), pageId: realPageId, order: i });
        }

        // 3. Update Local Store with Fully Populated Page
        const newPage: Page = {
          ...page,
          id: realPageId,
          title: page.title,
          containers: savedContainersWithIds,
          createdDate: savedPage.Created,
          modifiedDate: savedPage.Modified || savedPage.Created,
          createdBy: savedPage.Author?.Title || 'System',
          modifiedBy: savedPage.Editor?.Title || 'System'
        };

        set((state) => ({ pages: [...state.pages, newPage] }));
        console.log(`✅ Page created with ID: ${realPageId}`);
        return newPage;

      } catch (error) {
        console.error('Error adding page:', error);
        return null;
      }
    },

    updatePage: async (page, options) => {
      try {
        const { updatePage: updatePageSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spData = {
          Title: page.title.en,
          MultilingualTitle: JSON.stringify(page.title),
          Slug: page.slug,
          PageStatus: page.status,
          IsHomePage: page.isHomePage,
          Description: page.description,
          ImageUrl: page.imageUrl ? { Url: page.imageUrl, Description: page.imageName || '' } : null,
          ImageName: page.imageName || '',
          SortOrder: page.sortOrder || 0,
          SEOConfig: JSON.stringify(page.seo || {})
        };
        const updatedPage = await updatePageSP(Number(page.id), spData);
        const finalPage = {
          ...page,
          createdBy: updatedPage?.Author?.Title || page.createdBy || 'System',
          modifiedBy: updatedPage?.Editor?.Title || 'System',
          createdDate: updatedPage?.Created || page.createdDate,
          modifiedDate: updatedPage?.Modified || updatedPage?.Created || page.modifiedDate
        };
        set((state) => ({ pages: state.pages.map(p => p.id === page.id ? finalPage : p) }));
        // Show confirmation after successful update
        const pageTitle =
          (page as any)?.title?.en ||
          (page as any)?.title?.de ||
          (page as any)?.title?.fr ||
          'Page';
        if (!options?.suppressSuccess) {
          get().triggerSuccess(pageTitle);
        }
      } catch (error) {
        console.error('Error updating page:', error);
      }
    },

    publishPage: async (pageId: string) => {
      try {
        const { updatePage, updateContainer } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const state = get();
        const page = state.pages.find(p => p.id === pageId);
        if (!page) return;

        // 1. Update Page Status in SharePoint
        const spPageData = {
          PageStatus: 'Published' as const
        };
        await updatePage(Number(page.id), spPageData);

        // 2. Identify and Update unpublished Containers
        const publishedContainers: Container[] = [];

        for (const container of page.containers) {
          if (container.status !== 'Published') {
            const spContainerData = {
              Status: 'Published' as const
            };
            await updateContainer(Number(container.id), spContainerData);
            publishedContainers.push({ ...container, status: 'Published' as const });
          } else {
            publishedContainers.push(container);
          }
        }

        // 3. Identify and Update associated Navigation Items
        const { updateNavItem } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const updatedNavigation = [...state.siteConfig.navigation];
        for (let i = 0; i < updatedNavigation.length; i++) {
          const navItem = updatedNavigation[i];
          if (navItem.pageId === pageId && navItem.status !== 'Published') {
            await updateNavItem(Number(navItem.id), { Status: 'Published' });
            updatedNavigation[i] = { ...navItem, status: 'Published' as const };
          }
        }

        // 4. Update Local State
        set((state) => ({
          pages: state.pages.map(p => p.id === pageId ? { ...p, status: 'Published' as const, containers: publishedContainers } : p),
          siteConfig: { ...state.siteConfig, navigation: updatedNavigation }
        }));

        console.log(`✅ Page ${pageId}, its containers, and associated navigation published.`);
      } catch (error) {
        console.error('Error publishing page:', error);
      }
    },

    deletePage: async (id) => {
      try {
        const { deletePage: deletePageSP, deleteNavItem: deleteNavItemSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');

        const state = get();
        const pageToDelete = state.pages.find(p => p.id === id);
        if (!pageToDelete) return;

        // 1. Identify and delete associated navigation items from SharePoint
        const associatedNavItems = state.siteConfig.navigation.filter(n => n.pageId === id);
        for (const navItem of associatedNavItems) {
          try {
            await deleteNavItemSP(Number(navItem.id));
          } catch (navError) {
            console.error(`Error deleting associated nav item ${navItem.id}:`, navError);
          }
        }

        // 2. Delete the page itself from SharePoint
        await deletePageSP(Number(id));

        // 3. Update local state: remove page and all associated navigation items
        set((state) => {
          const navIdsToRemove = associatedNavItems.map(n => n.id);
          const updatedNavigation = state.siteConfig.navigation.filter(n =>
            n.pageId !== id && !navIdsToRemove.includes(n.parentId)
          );

          return {
            pages: state.pages.filter(p => p.id !== id),
            siteConfig: {
              ...state.siteConfig,
              navigation: updatedNavigation
            }
          };
        });

        // Deletion successful, no message requested
      } catch (error) {
        console.error('Error deleting page:', error);
      }
    },
    addContainer: async (pageId, container) => {
      try {
        console.log('📦 Adding container with settings:', container.settings);

        const page = get().pages.find((p) => p.id === pageId);
        const nextOrder = getNextContainerOrder(page?.containers || []);
        const containerWithOrder = { ...container, order: nextOrder };

        // Process settings to upload any external image URLs to SharePoint
        const processedSettings = { ...containerWithOrder.settings };

        // Check if container has a background image URL
        if (processedSettings.bgImage && typeof processedSettings.bgImage === 'string' && processedSettings.bgImage.trim() !== '') {
          console.log(`🔍 Found bgImage URL: ${processedSettings.bgImage}`);

          // Import the uploadImageFromUrl function
          const { uploadImageFromUrl } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');

          // Upload the image and get the SharePoint URL
          const sharePointUrl = await uploadImageFromUrl(
            processedSettings.bgImage,
            'Containers',
            {
              Title: containerWithOrder.title || containerWithOrder.content?.title?.en || 'Container Background',
              Description: `Background image for container ${containerWithOrder.type}`,
              AltText: 'Container background image'
            }
          );

          // Update the settings with the SharePoint URL
          if (sharePointUrl) {
            processedSettings.bgImage = sharePointUrl;
            console.log(`✅ Updated bgImage to SharePoint URL: ${sharePointUrl}`);
          }
        }

        const { saveContainer } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const spData = {
          PageId: Number(pageId),
          ContainerType: containerWithOrder.type,
          SortOrder: containerWithOrder.order,
          Settings: JSON.stringify(processedSettings),
          ContainerContent: JSON.stringify(containerWithOrder.content || {}),
          IsVisible: containerWithOrder.isVisible,
          Title: containerWithOrder.title || containerWithOrder.settings?.containerTitle || containerWithOrder.settings?.title || containerWithOrder.type,
          Status: 'Draft',
          BtnEnabled: processedSettings.btnEnabled || false,
          BtnName: toSharePointText(processedSettings.btnName),
          BtnLinkType: processedSettings.btnLinkType || 'url',
          BtnUrl: processedSettings.btnUrl || '',
          BtnContainerId: processedSettings.btnContainerId || '',
          BtnTargetContainerTitle: processedSettings.btnTargetContainerTitle || ''
        };
        const savedItem = await saveContainer(spData);
        // savedItem now contains full metadata from SPService
        const newContainer: Container = {
          ...containerWithOrder,
          id: String(savedItem.Id),
          status: 'Draft' as const,
          pageId,
          settings: processedSettings,
          createdBy: savedItem.Author?.Title || 'System',
          modifiedBy: savedItem.Editor?.Title || 'System',
          createdDate: savedItem.Created,
          modifiedDate: savedItem.Modified || savedItem.Created
        };
        set((state) => ({ pages: state.pages.map(p => p.id === pageId ? { ...p, containers: [...p.containers, newContainer] } : p) }));

        const nextTagged: string[] = Array.isArray(processedSettings.taggedItems)
          ? processedSettings.taggedItems.map((id) => String(id))
          : [];
        if (nextTagged.length > 0) {
          const contentListName = resolveContainerSourceList(newContainer);
          const syncOptions = contentListName ? { contentListName } : undefined;
          await syncLookupsForItemIds(get(), nextTagged, syncOptions);
          const affectedSet = new Set<string>(nextTagged);
          set((state) => ({
            news: applyContainerIdsToContentItems(state.news, affectedSet, state.pages, 'News'),
            events: applyContainerIdsToContentItems(state.events, affectedSet, state.pages, 'Events'),
            documents: applyContainerIdsToContentItems(state.documents, affectedSet, state.pages, 'Documents'),
            containerItems: applyContainerIdsToContentItems(state.containerItems, affectedSet, state.pages, 'ContainerItems'),
            contacts: applyContainerIdsToContentItems(state.contacts, affectedSet, state.pages, 'Contacts'),
            sliderItems: applyContainerIdsToContentItems(state.sliderItems, affectedSet, state.pages, 'ImageSlider'),
            pages: applyContainerIdsToContentItems(state.pages, affectedSet, state.pages, 'SmartPages'),
          }));
          set((state) => ({
            news: applyPageIdsToContentItems(state.news, affectedSet, state.pages, 'News'),
            events: applyPageIdsToContentItems(state.events, affectedSet, state.pages, 'Events'),
            documents: applyPageIdsToContentItems(state.documents, affectedSet, state.pages, 'Documents'),
            containerItems: applyPageIdsToContentItems(state.containerItems, affectedSet, state.pages, 'ContainerItems'),
            contacts: applyPageIdsToContentItems(state.contacts, affectedSet, state.pages, 'Contacts'),
            sliderItems: applyPageIdsToContentItems(state.sliderItems, affectedSet, state.pages, 'ImageSlider'),
            pages: applyPageIdsToContentItems(state.pages, affectedSet, state.pages, 'SmartPages'),
          }));
        }

        return newContainer;
      } catch (error) {
        console.error('Error adding container:', error);
        return null;
      }
    },

    updateContainer: async (pageId, container) => {
      try {
        if (!pageId || isNaN(Number(pageId)) || Number(pageId) === 0) {
          console.error('🚨 [updateContainer] Invalid pageId provided:', pageId, 'for container:', container.id);
          return;
        }

        const { getContainerById, updateContainer: updateContainerSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        let previousTaggedFromSp: string[] = [];
        try {
          const existingContainer = await getContainerById(Number(container.id));
          previousTaggedFromSp = parsePersistedTaggedItems(existingContainer?.Settings);
        } catch (readErr) {
          console.warn('Could not read persisted container taggedItems before update:', readErr);
        }

        const nextTagged: string[] = (container.settings?.taggedItems || []).map(String);

        console.log('🔄 Updating container with settings:', container.settings);

        // Process settings to upload any external image URLs to SharePoint
        const processedSettings = { ...container.settings };

        // Check if container has a background image URL that isn't already from SharePoint
        if (processedSettings.bgImage && typeof processedSettings.bgImage === 'string' && processedSettings.bgImage.trim() !== '') {
          console.log(`🔍 Found bgImage URL: ${processedSettings.bgImage}`);

          // Import the uploadImageFromUrl function
          const { uploadImageFromUrl } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');

          // Upload the image and get the SharePoint URL (will skip if already SharePoint URL)
          const sharePointUrl = await uploadImageFromUrl(
            processedSettings.bgImage,
            'Containers',
            {
              Title: container.title || container.content?.title?.en || 'Container Background',
              Description: `Background image for container ${container.type}`,
              AltText: 'Container background image'
            }
          );

          // Update the settings with the SharePoint URL
          if (sharePointUrl) {
            processedSettings.bgImage = sharePointUrl;
            console.log(`✅ Updated bgImage to SharePoint URL: ${sharePointUrl}`);
          }
        }

        const spData = {
          PageId: Number(pageId),
          ContainerType: container.type,
          SortOrder: container.order,
          Settings: JSON.stringify(processedSettings),
          ContainerContent: JSON.stringify(container.content || {}),
          IsVisible: container.isVisible,
          Title: container.title || container.settings?.containerTitle || container.settings?.title || container.type,
          Status: container.status || 'Draft',
          BtnEnabled: processedSettings.btnEnabled || false,
          BtnName: toSharePointText(processedSettings.btnName),
          BtnLinkType: processedSettings.btnLinkType || 'url',
          BtnUrl: processedSettings.btnUrl || '',
          BtnContainerId: processedSettings.btnContainerId || '',
          BtnTargetContainerTitle: processedSettings.btnTargetContainerTitle || ''
        };
        const updatedItem = await updateContainerSP(Number(container.id), spData);

        // Update local state with latest metadata from SharePoint
        const finalContainer: Container = {
          ...container,
          settings: processedSettings,
          createdBy: updatedItem?.Author?.Title || container.createdBy || 'System',
          modifiedBy: updatedItem?.Editor?.Title || 'System',
          createdDate: updatedItem?.Created || container.createdDate,
          modifiedDate: updatedItem?.Modified || updatedItem?.Created || container.modifiedDate
        };

        set((state) => ({
          pages: state.pages.map(p => p.id === pageId ?
            { ...p, containers: p.containers.map(c => c.id === container.id ? finalContainer : c) }
            : p)
        }));

        const affectedItemIds = collectAffectedItemIds(previousTaggedFromSp, nextTagged);
        if (affectedItemIds.length > 0) {
          const contentListName = resolveContainerSourceList(container);
          const syncOptions = contentListName ? { contentListName } : undefined;
          await syncLookupsForItemIds(get(), affectedItemIds, syncOptions);
          const affectedSet = new Set(affectedItemIds.map(String));
          set((state) => ({
            news: applyContainerIdsToContentItems(state.news, affectedSet, state.pages, 'News'),
            events: applyContainerIdsToContentItems(state.events, affectedSet, state.pages, 'Events'),
            documents: applyContainerIdsToContentItems(state.documents, affectedSet, state.pages, 'Documents'),
            containerItems: applyContainerIdsToContentItems(state.containerItems, affectedSet, state.pages, 'ContainerItems'),
            contacts: applyContainerIdsToContentItems(state.contacts, affectedSet, state.pages, 'Contacts'),
            sliderItems: applyContainerIdsToContentItems(state.sliderItems, affectedSet, state.pages, 'ImageSlider'),
            pages: applyContainerIdsToContentItems(state.pages, affectedSet, state.pages, 'SmartPages'),
          }));
          set((state) => ({
            news: applyPageIdsToContentItems(state.news, affectedSet, state.pages, 'News'),
            events: applyPageIdsToContentItems(state.events, affectedSet, state.pages, 'Events'),
            documents: applyPageIdsToContentItems(state.documents, affectedSet, state.pages, 'Documents'),
            containerItems: applyPageIdsToContentItems(state.containerItems, affectedSet, state.pages, 'ContainerItems'),
            contacts: applyPageIdsToContentItems(state.contacts, affectedSet, state.pages, 'Contacts'),
            sliderItems: applyPageIdsToContentItems(state.sliderItems, affectedSet, state.pages, 'ImageSlider'),
            pages: applyPageIdsToContentItems(state.pages, affectedSet, state.pages, 'SmartPages'),
          }));
        }
      } catch (error) {
        console.error('Error updating container:', error);
      }
    },

    persistContainerTaggingLookups: async (pageId, container) => {
      try {
        if (!pageId || isNaN(Number(pageId)) || !container?.id || isNaN(Number(container.id))) {
          return;
        }

        const { getContainerById, updateContainer: updateContainerSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        let previousTaggedFromSp: string[] = [];
        try {
          const existingContainer = await getContainerById(Number(container.id));
          previousTaggedFromSp = parsePersistedTaggedItems(existingContainer?.Settings);
        } catch (readErr) {
          console.warn('Could not read persisted container taggedItems:', readErr);
        }

        const nextTagged = (container.settings?.taggedItems || []).map(String);

        await updateContainerSP(Number(container.id), {
          Settings: JSON.stringify(container.settings || {}),
        });

        set((state) => ({
          pages: state.pages.map((page) => (
            page.id === pageId
              ? {
                ...page,
                containers: page.containers.map((entry) => (
                  entry.id === container.id ? { ...container } : entry
                )),
              }
              : page
          )),
        }));

        const affectedItemIds = collectAffectedItemIds(previousTaggedFromSp, nextTagged);
        if (affectedItemIds.length === 0) {
          return;
        }

        const contentListName = resolveContainerSourceList(container);
        const syncOptions = contentListName ? { contentListName } : undefined;
        await syncLookupsForItemIds(get(), affectedItemIds, syncOptions);
        const affectedSet = new Set(affectedItemIds.map(String));
        set((state) => ({
          news: applyContainerIdsToContentItems(state.news, affectedSet, state.pages, 'News'),
          events: applyContainerIdsToContentItems(state.events, affectedSet, state.pages, 'Events'),
          documents: applyContainerIdsToContentItems(state.documents, affectedSet, state.pages, 'Documents'),
          containerItems: applyContainerIdsToContentItems(state.containerItems, affectedSet, state.pages, 'ContainerItems'),
          contacts: applyContainerIdsToContentItems(state.contacts, affectedSet, state.pages, 'Contacts'),
          sliderItems: applyContainerIdsToContentItems(state.sliderItems, affectedSet, state.pages, 'ImageSlider'),
          pages: applyContainerIdsToContentItems(state.pages, affectedSet, state.pages, 'SmartPages'),
        }));
        set((state) => ({
          news: applyPageIdsToContentItems(state.news, affectedSet, state.pages, 'News'),
          events: applyPageIdsToContentItems(state.events, affectedSet, state.pages, 'Events'),
          documents: applyPageIdsToContentItems(state.documents, affectedSet, state.pages, 'Documents'),
          containerItems: applyPageIdsToContentItems(state.containerItems, affectedSet, state.pages, 'ContainerItems'),
          contacts: applyPageIdsToContentItems(state.contacts, affectedSet, state.pages, 'Contacts'),
          sliderItems: applyPageIdsToContentItems(state.sliderItems, affectedSet, state.pages, 'ImageSlider'),
          pages: applyPageIdsToContentItems(state.pages, affectedSet, state.pages, 'SmartPages'),
        }));
      } catch (error) {
        console.error('Error persisting container tagging lookups:', error);
      }
    },

    applyItemContainerLookupChanges: async (itemId, listName, nextContainerIds) => {
      try {
        const state = get();
        const previousContainerIds = getContainerIdsForItem(itemId, state.pages, listName);
        const result = applyContainerLookupSelection(itemId, listName, nextContainerIds, state.pages);

        set({ pages: result.pages });

        const { updateContainer: updateContainerSP, updateItemContainerLookup } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        for (const { container } of result.changedContainers) {
          await updateContainerSP(Number(container.id), {
            Settings: JSON.stringify(container.settings || {}),
          });
        }

        await updateItemContainerLookup(listName, Number(itemId), result.containerIds);
        const { syncPageLookupsForItemIds } = await import('./utils/pageLookupSync');
        await syncPageLookupsForItemIds(get(), [itemId], { contentListName: listName });

        const finalState = get();
        const reconciledContainerIds = getContainerIdsForItem(itemId, finalState.pages, listName);
        const reconciledPageIds = getPageIdsForItem(itemId, finalState.pages, listName);
        const normalizedItemId = String(itemId);
        const patch = { containerIds: reconciledContainerIds, pageIds: reconciledPageIds };

        set((current) => ({
          news: listName === 'News'
            ? current.news.map((item) => String(item.id) === normalizedItemId ? { ...item, ...patch } : item)
            : current.news,
          events: listName === 'Events'
            ? current.events.map((item) => String(item.id) === normalizedItemId ? { ...item, ...patch } : item)
            : current.events,
          documents: listName === 'Documents'
            ? current.documents.map((item) => String(item.id) === normalizedItemId ? { ...item, ...patch } : item)
            : current.documents,
          containerItems: listName === 'ContainerItems'
            ? current.containerItems.map((item) => String(item.id) === normalizedItemId ? { ...item, ...patch } : item)
            : current.containerItems,
          contacts: listName === 'Contacts'
            ? current.contacts.map((item) => String(item.id) === normalizedItemId ? { ...item, ...patch } : item)
            : current.contacts,
          sliderItems: listName === 'ImageSlider'
            ? current.sliderItems.map((item) => String(item.id) === normalizedItemId ? { ...item, ...patch } : item)
            : current.sliderItems,
          pages: listName === 'SmartPages'
            ? current.pages.map((item) => String(item.id) === normalizedItemId ? { ...item, ...patch } : item)
            : current.pages,
        }));

        const previousIdSet = new Set(previousContainerIds.map((id) => String(id)));
        const reconciledIdSet = new Set(reconciledContainerIds.map((id) => String(id)));
        const removedAny = previousContainerIds.some((id) => !reconciledIdSet.has(String(id)));
        const addedAny = reconciledContainerIds.some((id) => !previousIdSet.has(String(id)));

        if (removedAny) {
          get().triggerTaggingSuccess('untagged');
        } else if (addedAny) {
          get().triggerTaggingSuccess('tagged');
        }
      } catch (error) {
        console.error('Error applying container lookup changes from item form:', error);
      }
    },

    applyItemPageLookupRemoval: async (itemId, listName, pageId) => {
      try {
        const state = get();
        const result = applyPageLookupRemoval(itemId, listName, pageId, state.pages);

        set({ pages: result.pages });

        const { updateContainer: updateContainerSP, updateItemContainerLookup, updateItemPageLookup } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        for (const { container } of result.changedContainers) {
          await updateContainerSP(Number(container.id), {
            Settings: JSON.stringify(container.settings || {}),
          });
        }

        await updateItemContainerLookup(listName, Number(itemId), result.containerIds);
        await updateItemPageLookup(listName, Number(itemId), result.pageIds);

        const normalizedItemId = String(itemId);
        const patch = { containerIds: result.containerIds, pageIds: result.pageIds };
        set((current) => ({
          news: listName === 'News'
            ? current.news.map((item) => String(item.id) === normalizedItemId ? { ...item, ...patch } : item)
            : current.news,
          events: listName === 'Events'
            ? current.events.map((item) => String(item.id) === normalizedItemId ? { ...item, ...patch } : item)
            : current.events,
          documents: listName === 'Documents'
            ? current.documents.map((item) => String(item.id) === normalizedItemId ? { ...item, ...patch } : item)
            : current.documents,
          containerItems: listName === 'ContainerItems'
            ? current.containerItems.map((item) => String(item.id) === normalizedItemId ? { ...item, ...patch } : item)
            : current.containerItems,
          contacts: listName === 'Contacts'
            ? current.contacts.map((item) => String(item.id) === normalizedItemId ? { ...item, ...patch } : item)
            : current.contacts,
          sliderItems: listName === 'ImageSlider'
            ? current.sliderItems.map((item) => String(item.id) === normalizedItemId ? { ...item, ...patch } : item)
            : current.sliderItems,
          pages: listName === 'SmartPages'
            ? current.pages.map((item) => String(item.id) === normalizedItemId ? { ...item, ...patch } : item)
            : current.pages,
        }));

        get().triggerTaggingSuccess('untagged');
      } catch (error) {
        console.error('Error removing page lookup from item form:', error);
      }
    },

    deleteContainer: async (pageId, cId) => {
      try {
        const { deleteContainer: deleteContainerSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        await deleteContainerSP(Number(cId));
        set((state) => ({ pages: state.pages.map(p => p.id === pageId ? { ...p, containers: p.containers.filter(c => c.id !== cId) } : p) }));
      } catch (error) {
        console.error('Error deleting container:', error);
      }
    },
    reorderContainers: async (pageId, newOrder) => {
      const normalized = newOrder.map((c, i) => ({ ...c, order: i }));
      set((state) => ({
        pages: state.pages.map((p) =>
          p.id === pageId ? { ...p, containers: normalized } : p
        ),
      }));
      try {
        const { updateContainer: updateContainerSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        for (let i = 0; i < normalized.length; i++) {
          await updateContainerSP(Number(normalized[i].id), { SortOrder: i });
        }
      } catch (error) {
        console.error('Error persisting container order to SharePoint:', error);
      }
    },

    addSectionTemplate: async (template) => {
      try {
        const { saveSectionTemplate } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const saved = await saveSectionTemplate(template);
        set((state) => ({ sectionTemplates: [...state.sectionTemplates, saved] }));
        get().triggerSuccess(template.title);
        return saved;
      } catch (error) {
        console.error('Error saving section template:', error);
        return null;
      }
    },

    updateSectionTemplate: async (template) => {
      try {
        const { updateSectionTemplate: updateSectionTemplateSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const updated = await updateSectionTemplateSP(template);
        set((state) => ({
          sectionTemplates: state.sectionTemplates.map(t => t.id === updated.id ? updated : t),
        }));
        get().triggerSuccess(template.title);
      } catch (error) {
        console.error('Error updating section template:', error);
      }
    },

    deleteSectionTemplate: async (id) => {
      try {
        const { deleteSectionTemplate: deleteSectionTemplateSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        await deleteSectionTemplateSP(id);
        set((state) => ({
          sectionTemplates: state.sectionTemplates.filter(t => t.id !== id),
        }));
      } catch (error) {
        console.error('Error deleting section template:', error);
      }
    },

    getPublishedTemplatesForType: (containerType) => {
      return get().sectionTemplates.filter(
        t => t.containerType === containerType && t.status === 'Published'
      );
    },

    addThemeTemplate: async (template) => {
      try {
        const { saveThemeTemplate } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const saved = await saveThemeTemplate({ ...template, id: '' });
        set((state) => ({ themeTemplates: [...state.themeTemplates, saved] }));
        get().triggerSuccess(saved.title);
        return saved;
      } catch (error) {
        console.error('Error saving theme template:', error);
        return null;
      }
    },

    updateThemeTemplate: async (template) => {
      try {
        const { updateThemeTemplate: updateThemeTemplateSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const updated = await updateThemeTemplateSP(template);
        set((state) => ({
          themeTemplates: state.themeTemplates.map(t => t.id === updated.id ? updated : t),
        }));
        get().triggerSuccess(template.title);
      } catch (error) {
        console.error('Error updating theme template:', error);
      }
    },

    deleteThemeTemplate: async (id) => {
      try {
        const { deleteThemeTemplate: deleteThemeTemplateSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        await deleteThemeTemplateSP(id);
        set((state) => ({
          themeTemplates: state.themeTemplates.filter(t => t.id !== id),
        }));
      } catch (error) {
        console.error('Error deleting theme template:', error);
      }
    },

    getPublishedThemeTemplates: () => {
      return get().themeTemplates.filter(t => t.status === 'Published');
    },

    getSelectableThemeTemplates: () => {
      const published = get().getPublishedThemeTemplates();
      return orderThemeTemplatesWithDefaultFirst(published, DEFAULT_THEME, 'Default Theme');
    },

    applyThemeTemplate: async (template) => {
      const state = get();
      const mergedSiteConfig = applyStylingSiteConfig(state.siteConfig, template.stylingConfig || {});
      const mergedTheme = applySiteLayoutWidthToTheme(mergedSiteConfig, { ...template.themeConfig });

      const normalizedTheme: ThemeConfig = {};
      Object.entries(mergedTheme).forEach(([key, value]) => {
        normalizedTheme[key.toLowerCase()] = String(value ?? '');
      });

      set({
        themeConfig: normalizedTheme,
        siteConfig: mergedSiteConfig,
      });

      await get().saveGlobalSettings('theme');
      await get().saveGlobalSettings('site');
      get().triggerSuccess(template.title);
    },

    // SharePoint Data Loading Actions
    saveGlobalSettings: async (type) => {
      try {
        const { upsertGlobalSetting } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const state = get();
        let key = '';
        let data = '';

        if (type === 'theme') {
          key = 'THEME_CONFIG';
          data = JSON.stringify(state.themeConfig);
        } else if (type === 'site') {
          key = 'SITE_CONFIG';
          // Exclude navigation from config blob to avoid redundancy
          const { navigation: _navigation, ...configToSave } = state.siteConfig;
          data = JSON.stringify(configToSave);
        } else if (type === 'labels') {
          key = 'UI_LABELS';
          data = JSON.stringify(state.uiLabels);
        } else if (type === 'app') {
          key = 'APP_STATE';
          data = JSON.stringify({
            currentPageId: state.currentPageId,
            currentLanguage: state.currentLanguage,
            editingContainerId: state.editingContainerId,
            isNavLocked: state.isNavLocked,
            browseFlatViewByContainer: state.browseFlatViewByContainer
          });
        }

        if (key && data) {
          await upsertGlobalSetting(key, { ConfigData: data });
          console.log(`✅ Saved ${type} settings to SharePoint`);
        }
      } catch (error) {
        console.error(`❌ Error saving ${type} settings:`, error);
      }
    },

    syncTranslations: async () => {
      try {
        const { upsertTranslation } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const state = get();

        for (const item of state.translationItems) {
          await upsertTranslation(item.id, item.translations, item.sourceList);
        }
        console.log('✅ Translations synced to SharePoint');
      } catch (error) {
        console.error('❌ Error syncing translations:', error);
      }
    },

    seedTranslations: async () => {
      try {
        const { upsertTranslation } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
        const state = get();
        const existingItems = state.translationItems;
        const newItems = [...existingItems];
        let addedCount = 0;

        for (const key of Object.keys(INITIAL_UI_LABELS)) {
          const exists = existingItems.some(t => t.id === key);
          if (!exists) {
            const labelItem = INITIAL_UI_LABELS[key];
            const newItem: TranslationItem = {
              id: key,
              sourceList: 'Labels',
              original: labelItem.en,
              translations: {
                de: labelItem.de,
                fr: labelItem.fr,
                es: labelItem.es,
                en: labelItem.en
              },
              lastUpdated: new Date().toISOString()
            };
            newItems.push(newItem);
            await upsertTranslation(newItem.id, newItem.translations, newItem.sourceList);
            addedCount++;
          }
        }

        if (addedCount > 0) {
          set({ translationItems: newItems });
          console.log(`✅ Seeded ${addedCount} translations to SharePoint`);
        } else {
          console.log('ℹ️ No new translations to seed');
        }
      } catch (error) {
        console.error('❌ Error seeding translations:', error);
      }
    },

    setLoading: (loading: boolean) => set({ isLoading: loading }),

    loadFromSharePoint: async () => {
      try {
        set({ isLoading: true });
        console.log('🔄 Loading data from SharePoint...');

        // Dynamically import SP service functions
        const {
          getPages,
          getPermissionGroups,
          getPermissionUsers,
          getContainersByPageId,
          getNavigation,
          getNews,
          getEvents,
          getDocuments,
          getImages,
          getFolders,
          getGlobalSettings,
          getTranslations,
          getContainerItems,
          getContactQueries,
          getContacts,
          getSliderItems,
          getSectionTemplates,
          getThemeTemplates,
          getWebStudioUserRole,
        } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');

        // Load all data in parallel
        const [spPages, spNav, spGroups, spUsers, spNews, spEvents, spDocs, spSettings, spTranslations, spContainerItems, spContactQueries, spContacts, spSliderItems, spSectionTemplates, spThemeTemplates, userRole] = await Promise.all([
          getPages().catch(err => { console.error('Error loading pages:', err); return []; }),
          getNavigation().catch(err => { console.error('Error loading nav:', err); return []; }),
          getPermissionGroups().catch(err => { console.error('Error loading permission groups:', err); return []; }),
          getPermissionUsers().catch(err => { console.error('Error loading permission users:', err); return []; }),
          getNews().catch(err => { console.error('Error loading news:', err); return []; }),
          getEvents().catch(err => { console.error('Error loading events:', err); return []; }),
          getDocuments().catch(err => { console.error('Error loading documents:', err); return []; }),
          getGlobalSettings().catch(err => { console.error('Error loading settings:', err); return []; }),
          getTranslations().catch(err => { console.error('Error loading translations:', err); return []; }),
          getContainerItems().catch(err => { console.error('Error loading container items:', err); return []; }),
          getContactQueries().catch(err => { console.error('Error loading contact queries:', err); return []; }),
          getContacts().catch(err => { console.error('Error loading contacts:', err); return []; }),
          getSliderItems().catch(err => { console.error('Error loading slider items:', err); return []; }),
          getSectionTemplates().catch(err => { console.error('Error loading section templates:', err); return []; }),
          getThemeTemplates().catch(err => { console.error('Error loading theme templates:', err); return []; }),
          getWebStudioUserRole().catch(err => { console.error('Error loading user role:', err); return 'standard' as WebStudioUserRole; }),
        ]);

        set({
          sectionTemplates: spSectionTemplates,
          themeTemplates: spThemeTemplates,
          webStudioUserRole: userRole,
          viewMode: canAccessWebStudioEditor(userRole) ? ViewMode.EDIT : ViewMode.PREVIEW,
          activeModal: canAccessWebStudioEditor(userRole) ? get().activeModal : ModalType.NONE,
          editingContainerId: canAccessWebStudioEditor(userRole) ? get().editingContainerId : null,
        });

        console.log('📊 SharePoint Data Loaded:', { spPages, spNav, spNews, spDocs, spSettings, spTranslations, spContainerItems, spContactQueries });

        // --- Process Global Settings ---
        let loadedTheme = DEFAULT_THEME;
        let loadedSiteConfig = get().siteConfig;
        let loadedUiLabels = INITIAL_UI_LABELS;

        if (spSettings.length > 0) {
          const themeItem = spSettings.find((i: any) => i.Title === 'THEME_CONFIG');
          if (themeItem && themeItem.ConfigData) {
            try {
              const parsedTheme = JSON.parse(themeItem.ConfigData);
              loadedTheme = { ...DEFAULT_THEME, ...parsedTheme };
            } catch (e) {
              console.error('Error parsing theme config:', e);
            }
          }

          const siteItem = spSettings.find((i: any) => i.Title === 'SITE_CONFIG');
          if (siteItem && siteItem.ConfigData) {
            try {
              const parsedSite = JSON.parse(siteItem.ConfigData);
              // Merge with existing structure to ensure no missing keys
              loadedSiteConfig = {
                ...loadedSiteConfig,
                ...parsedSite,
                languages: normalizeSiteLanguages(parsedSite.languages ?? loadedSiteConfig.languages),
                defaultLanguage: 'en',
              };
            } catch (e) {
              console.error('Error parsing site config:', e);
            }
          }

          const labelsItem = spSettings.find((i: any) => i.Title === 'UI_LABELS');
          if (labelsItem && labelsItem.ConfigData) {
            try {
              const parsedLabels = JSON.parse(labelsItem.ConfigData);
              loadedUiLabels = { ...loadedUiLabels, ...parsedLabels };
            } catch (e) {
              console.error('Error parsing UI labels:', e);
            }
          }

          const appItem = spSettings.find((i: any) => i.Title === 'APP_STATE');
          if (appItem && appItem.ConfigData) {
            try {
              const parsedApp = JSON.parse(appItem.ConfigData);
              if (parsedApp.currentPageId) set({ currentPageId: parsedApp.currentPageId });
              // Load language dynamically from APP_STATE
              if (parsedApp.currentLanguage) set({ currentLanguage: parsedApp.currentLanguage });
              if (parsedApp.editingContainerId) set({ editingContainerId: parsedApp.editingContainerId });
              if (parsedApp.hasOwnProperty('isNavLocked')) set({ isNavLocked: parsedApp.isNavLocked });
              if (parsedApp.browseFlatViewByContainer && typeof parsedApp.browseFlatViewByContainer === 'object') {
                set({ browseFlatViewByContainer: parsedApp.browseFlatViewByContainer });
              }
            } catch (e) {
              console.error('Error parsing APP state:', e);
            }
          }

          // Force normalization of themeConfig keys to lowercase to prevent casing mismatches
          if (loadedTheme) {
            const normalizedTheme: ThemeConfig = {};
            Object.keys(loadedTheme).forEach(k => {
              normalizedTheme[k.toLowerCase()] = loadedTheme[k];
            });
            loadedTheme = normalizedTheme;
          }

          loadedSiteConfig = normalizeSiteLayoutConfig(loadedSiteConfig);
          loadedTheme = applySiteLayoutWidthToTheme(loadedSiteConfig, loadedTheme);

          const sourcesItem = spSettings.find((i: any) => i.Title === 'TRANSLATION_SOURCES');
          if (sourcesItem && sourcesItem.ConfigData) {
            try {
              const parsedSources = JSON.parse(sourcesItem.ConfigData);
              if (Array.isArray(parsedSources)) set({ translationSources: parsedSources });
            } catch (e) {
              console.error('Error parsing TRANSLATION_SOURCES:', e);
            }
          }
        }

        // --- Process Translations from List ---
        // Build translationItems from TranslationDictionary records (single source of truth).
        // Only merge "Labels" records into uiLabels.
        const loadedTranslationItems: TranslationItem[] = [];
        if (spTranslations && spTranslations.length > 0) {
          spTranslations.forEach((t: any) => {
            if (!t?.Title) return;
            const sourceList = t.SourceList || 'General';
            const translations = {
              en: t.EN || '',
              de: t.DE || '',
              fr: t.FR || '',
              es: t.ES || ''
            };

            loadedTranslationItems.push({
              id: t.Title,
              sourceList,
              original: t.EN || t.Title,
              translations,
              lastUpdated: new Date().toISOString()
            });

            // Only label-like entries should affect UI labels.
            const isKnownLabelKey = !!INITIAL_UI_LABELS[t.Title];
            if (sourceList === 'Labels' || isKnownLabelKey) {
              loadedUiLabels[t.Title] = {
                en: translations.en || loadedUiLabels[t.Title]?.en || '',
                de: translations.de || loadedUiLabels[t.Title]?.de || '',
                fr: translations.fr || loadedUiLabels[t.Title]?.fr || '',
                es: translations.es || loadedUiLabels[t.Title]?.es || ''
              };
            }
          });
        }

        // Ensure every UI label key exists in translationItems for Labels source,
        // even if it is not yet present in TranslationDictionary.
        Object.keys(loadedUiLabels).forEach((key) => {
          if (!loadedTranslationItems.some((item) => item.id === key)) {
            loadedTranslationItems.push({
              id: key,
              sourceList: 'Labels',
              original: loadedUiLabels[key]?.en || key,
              translations: loadedUiLabels[key],
              lastUpdated: new Date().toISOString()
            });
          }
        });

        // Transform SharePoint data to store format
        // const transformedGroups: PermissionGroup[] = spGroups.map((group: any) => ({
        //   if(!group?.name?.includes('Custom')||!group.name?.includes('SharingLinks')){
        //   id: String(group.id),
        //   name: group?.name,
        //   description: group?.description || '',
        //   type: group?.name?.includes('Owners') ? 'Owners' :
        //     group?.name?.includes('Members') ? 'Members' :
        //       group?.name?.includes('Visitors') ? 'Visitors' : 'Custom',
        //   memberIds: [] as string[]
        //   }
        // }));
        const transformedUsers: PermissionUser[] = spUsers.map((user: PermissionUser) => ({
          id: String(user.id),
          name: user.name,
          email: user.email,
        }));
        const transformedPages: Page[] = await Promise.all(
          spPages.map(async (spPage: any) => {
            // Load containers for this page
            const spContainers = await getContainersByPageId(spPage.Id).catch(() => [] as any[]);

            return {
              id: String(spPage.Id),
              title: spPage.MultilingualTitle ? JSON.parse(spPage.MultilingualTitle) : { en: spPage.Title },
              slug: spPage.Slug || '/',
              status: spPage.PageStatus || 'Draft',
              createdBy: spPage.Author?.Title || 'System',
              modifiedBy: spPage.Editor?.Title || 'System',
              createdDate: spPage.Created || spPage.Modified || new Date().toISOString(),
              modifiedDate: spPage.Modified || new Date().toISOString(),
              description: unescapeHtml(spPage.Description || ''),
              isHomePage: spPage.IsHomePage || false,
              imageUrl: spPage.ImageUrl?.Url || '',
              imageName: spPage.ImageName || '',
              sortOrder: spPage.SortOrder || 0,
              seo: spPage.SEOConfig ? JSON.parse(spPage.SEOConfig) : undefined,
              containerIds: parseContainerLookupIds(spPage),
              pageIds: parsePageLookupIds(spPage, 'SmartPages'),
              containers: spContainers.map((c: any) => {
                const parsedSettings = c.Settings ? JSON.parse(c.Settings) : {};
                // Merge dedicated button columns into settings (SP columns are source of truth)
                if (c.BtnEnabled !== undefined && c.BtnEnabled !== null) parsedSettings.btnEnabled = c.BtnEnabled;
                if (c.BtnName !== undefined && c.BtnName !== null) parsedSettings.btnName = parseSharePointText(c.BtnName);
                if (c.BtnLinkType) parsedSettings.btnLinkType = c.BtnLinkType;
                if (c.BtnUrl) parsedSettings.btnUrl = c.BtnUrl;
                if (c.BtnContainerId) parsedSettings.btnContainerId = c.BtnContainerId;
                if (c.BtnTargetContainerTitle) parsedSettings.btnTargetContainerTitle = c.BtnTargetContainerTitle;

                const displaySettings = ensureContainerDisplaySortSettings(parsedSettings, c.ContainerType);
                const normalizedSettings =
                    c.ContainerType === ContainerType.HERO
                        ? normalizeHeroTemplateSettings(displaySettings)
                        : (c.ContainerType === ContainerType.CARD_GRID || c.ContainerType === ContainerType.DATA_GRID)
                            ? normalizeCardGridTemplateSettings(displaySettings)
                            : displaySettings;

                return {
                  id: String(c.Id),
                  pageId: c.PageId ? String(c.PageId) : (c.Page?.Id ? String(c.Page.Id) : ''),
                  type: (Object.values(ContainerType).includes(c.ContainerType)
                    ? c.ContainerType
                    : String(c.ContainerType || '').toUpperCase()) as ContainerType,
                  order: c.SortOrder || 0,
                  isVisible: c.IsVisible !== false,
                  settings: normalizedSettings,
                  status: c.Status || 'Draft',
                  content: c.ContainerContent ? ((): any => {
                    const parsed = JSON.parse(c.ContainerContent);
                    // Unescape description in translations if present
                    if (parsed.translations) {
                      Object.keys(parsed.translations).forEach(lang => {
                        if (parsed.translations[lang].description) {
                          parsed.translations[lang].description = unescapeHtml(parsed.translations[lang].description);
                        }
                      });
                    }
                    const containerType = (Object.values(ContainerType).includes(c.ContainerType)
                      ? c.ContainerType
                      : String(c.ContainerType || '').toUpperCase()) as ContainerType;
                    return hydrateTemplateContentForContainer(
                      containerType,
                      parsed,
                      normalizedSettings,
                      {}
                    );
                  })() : {},
                  title: c.Title || '',
                  createdBy: c.Author?.Title || 'System',
                  modifiedBy: c.Editor?.Title || 'System',
                  createdDate: c.Created,
                  modifiedDate: c.Modified || c.Created
                };
              }).sort(compareContainersByOrder)
            };
          })
        );

        const transformedNav: NavItem[] = spNav.map((item: any) => ({
          id: String(item.Id),
          parentId: item.Parent?.Id ? String(item.Parent.Id) : 'root',
          title: item.Title,
          type: item.NavType || 'Page',
          pageId: item.SmartPage?.Id ? String(item.SmartPage.Id) : undefined,
          url: item.ExternalURL || undefined,
          containerId: item.ContainerId || undefined,
          isVisible: item.IsVisible !== false,
          openInNewTab: item.OpenInNewTab || false,
          order: item.SortOrder || 0,
          status: item.Status || 'Draft',
          translations: item.Translations ? JSON.parse(item.Translations) : {},
          createdBy: item.Author?.Title || 'System',
          modifiedBy: item.Editor?.Title || 'System',
          createdDate: item.Created,
          modifiedDate: item.Modified || item.Created
        }));

        const transformedNews: NewsItem[] = spNews.map((item: any) => ({
          id: String(item.Id),
          title: item.Title,
          status: item.Status || 'Draft',
          publishDate: item.PublishDate || new Date().toISOString(),
          description: unescapeHtml(item.Description || ''),
          imageUrl: typeof item.ImageUrl === 'string' ? item.ImageUrl : (item.ImageUrl?.Url || ''),
          imageName: item.ImageName || item.ImageUrl?.Description || '',
          readMore: {
            enabled: item.ReadMoreEnabled || false,
            text: item.ReadMoreText || '',
            url: item.ReadMoreURL || ''
          },
          seo: item.SEOConfig ? JSON.parse(item.SEOConfig) : { title: '', description: '', keywords: '' },
          translations: item.Translations ? ((): any => {
            const parsed = JSON.parse(item.Translations);
            Object.keys(parsed).forEach(lang => {
              if (parsed[lang].description) {
                parsed[lang].description = unescapeHtml(parsed[lang].description);
              }
            });
            return parsed;
          })() : {},
          createdBy: item.Author?.Title || 'System',
          modifiedBy: item.Editor?.Title || 'System',
          createdDate: item.Created,
          modifiedDate: item.Modified || item.Created,
          containerIds: parseContainerLookupIds(item),
          pageIds: parsePageLookupIds(item, 'News'),
        }));

        const transformedEvents: EventItem[] = spEvents.map((item: any) => ({
          id: String(item.Id),
          title: item.Title,
          status: item.Status || 'Draft',
          startDate: item.StartDate || new Date().toISOString(),
          endDate: item.EndDate || '',
          location: item.Location || '',
          description: unescapeHtml(item.Description || ''),
          category: item.Category || 'General',
          imageUrl: item.ImageUrl?.Url || '',
          imageName: item.ImageName || '',
          readMore: {
            enabled: item.ReadMoreEnabled || false,
            text: item.ReadMoreText || '',
            url: item.ReadMoreURL || ''
          },
          seo: item.SEOConfig ? JSON.parse(item.SEOConfig) : { title: '', description: '', keywords: '' },
          translations: item.Translations ? ((): any => {
            const parsed = JSON.parse(item.Translations);
            Object.keys(parsed).forEach(lang => {
              if (parsed[lang].description) {
                parsed[lang].description = unescapeHtml(parsed[lang].description);
              }
            });
            return parsed;
          })() : {},
          createdBy: item.Author?.Title || 'System',
          modifiedBy: item.Editor?.Title || 'System',
          createdDate: item.Created,
          modifiedDate: item.Modified || item.Created,
          containerIds: parseContainerLookupIds(item),
          pageIds: parsePageLookupIds(item, 'Events'),
        }));

        const transformedDocs: DocumentItem[] = spDocs.map((item: any) => ({
          id: String(item.Id),
          title: (item.Title && String(item.Title).trim())
            || (item.Name ? item.Name.replace(/\.[^/.]+$/, '') : ''),
          name: item.Name, // File name (FileLeafRef)
          status: item.DocStatus || 'Draft',
          date: item.Modified || new Date().toISOString(),
          type: resolveDocumentType(item.DocType, item.Name, item.FileRef) as DocumentItem['type'],
          year: item.DocumentYear || new Date().getFullYear().toString(),
          description: unescapeHtml(item.DocumentDescriptions || ''),
          itemRank: item.ItemRank || 5,
          sortOrder: item.SortOrder || 0,
          url: item.FileRef,
          encodedAbsUrl: item.EncodedAbsUrl || '',
          imageUrl: typeof item.ImageUrl === 'string' ? item.ImageUrl : (item.ImageUrl?.Url || ''),
          imageName: item.ImageName || item.ImageUrl?.Description || '',
          translations: item.Translations ? ((): any => {
            const parsed = JSON.parse(item.Translations);
            Object.keys(parsed).forEach(lang => {
              if (parsed[lang].description) {
                parsed[lang].description = unescapeHtml(parsed[lang].description);
              }
            });
            return parsed;
          })() : {},
          createdBy: item.AuthorName || 'System',
          modifiedBy: item.EditorName || 'System',
          createdDate: item.Created,
          modifiedDate: item.Modified || item.Created,
          containerIds: parseContainerLookupIds(item),
          pageIds: parsePageLookupIds(item, 'Documents'),
        }));

        // --- IMAGES ---
        // Fetch Folders first, then Images
        let transformedImages: ImageItem[] = [];
        let imageFolders: ImageFolder[] = [];
        try {
          const folders = await getFolders();
          const images = await getImages(folders);

          // Transform folders to ImageFolder type
          imageFolders = [
            { id: 'all', name: 'All Images', count: images.length },
            ...folders.map(f => ({
              id: f.id,
              name: f.name,
              count: images.filter(i => String(i.AssetCategory).toLowerCase() === String(f.id).toLowerCase()).length
            }))
          ];

          transformedImages = images.map((img: any) => ({
            id: String(img.Id),
            name: img.FileName,
            url: img.ImageUrl,
            folderId: img.AssetCategory || 'all',
            title: img.Title || img.FileName,
            description: img.Description || '',
            altText: img.AltText || '',
            copyright: img.CopyrightInfo || '',
            keywords: img.Keywords || '',
            width: img.ImageWidth,
            height: img.ImageHeight,
            createdDate: img.Created,
            createdBy: img.AuthorName || 'Unknown',
            modifiedDate: img.Modified,
            modifiedBy: img.EditorName || '',
          }));

        } catch (e) { console.error('Error loading images/folders', e); }

        let defaultImageUrl = resolveDefaultImageUrl(transformedImages);
        if (!defaultImageUrl) {
          try {
            const { getDefaultImageUrl } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
            defaultImageUrl = await getDefaultImageUrl();
          } catch (defaultImgErr) {
            console.warn('Could not resolve default image from Images library:', defaultImgErr);
          }
        }

        const transformedContainerItems: ContainerItem[] = spContainerItems.map((item: any) => ({
          id: String(item.Id),
          title: item.Title,
          status: item.Status || 'Draft',
          sortOrder: item.SortOrder || 0,
          description: unescapeHtml(item.Description || ''),
          imageUrl: item.ImageUrl?.Url || '',
          imageName: item.ImageName || '',
          btnEnabled: item.BtnEnabled || false,
          btnName: item.BtnName || '',
          btnLinkType: item.BtnLinkType || 'url',
          btnUrl: item.BtnUrl || '',
          btnContainerId: item.BtnContainerId || '',
          btnTargetContainerTitle: item.BtnTargetContainerTitle || '',
          btnConfig: item.BtnConfig ? JSON.parse(item.BtnConfig) : {},
          translations: item.Translations ? ((): any => {
            const parsed = JSON.parse(item.Translations);
            Object.keys(parsed).forEach(lang => {
              if (parsed[lang].description) {
                parsed[lang].description = unescapeHtml(parsed[lang].description);
              }
            });
            return parsed;
          })() : {},
          createdBy: item.Author?.Title || 'System',
          modifiedBy: item.Editor?.Title || 'System',
          createdDate: item.Created,
          modifiedDate: item.Modified || item.Created,
          containerIds: parseContainerLookupIds(item),
          pageIds: parsePageLookupIds(item, 'ContainerItems'),
        }));

        // --- CONTACTS ---
        const transformedContacts: ContactItem[] = spContacts.map((item: any) => ({
          id: String(item.Id),
          fullName: item.Title || '',
          firstName: item.FirstName || '',
          lastName: item.LastName || '',
          status: item.Status || 'Draft',
          sortOrder: item.SortOrder || 0,
          jobTitle: item.JobTitle || '',
          company: item.Company || '',
          email: item.Email || '',
          phone: item.Phone || '',
          description: unescapeHtml(item.Description || ''),
          imageUrl: item.ImageUrl?.Url || '',
          imageName: item.ImageName || '',
          btnEnabled: item.BtnEnabled || false,
          btnName: item.BtnName || '',
          btnLinkType: item.BtnLinkType || 'url',
          btnUrl: item.BtnUrl || '',
          btnContainerId: item.BtnContainerId || '',
          btnTargetContainerTitle: item.BtnTargetContainerTitle || '',
          btnConfig: item.BtnConfig ? JSON.parse(item.BtnConfig) : {},
          translations: item.Translations ? ((): any => {
            const parsed = JSON.parse(item.Translations);
            Object.keys(parsed).forEach(lang => {
              if (parsed[lang].description) {
                parsed[lang].description = unescapeHtml(parsed[lang].description);
              }
            });
            return parsed;
          })() : {},
          createdBy: item.Author?.Title || 'System',
          modifiedBy: item.Editor?.Title || 'System',
          createdDate: item.Created,
          modifiedDate: item.Modified || item.Created,
          containerIds: parseContainerLookupIds(item),
          pageIds: parsePageLookupIds(item, 'Contacts'),
        }));

        // --- CONTACT QUERIES ---
        const transformedContactQueries: ContactQuery[] = spContactQueries.map((item: any) => {
          let formData: any = {};
          try {
            formData = item.FormData ? JSON.parse(item.FormData) : {};
          } catch (e) {
            console.error('Error parsing FormData for contact query:', e);
          }

          return {
            id: String(item.Id),
            pageId: item.SourcePage?.Id ? String(item.SourcePage.Id) : formData.pageId || '',
            pageName: item.SourcePage?.Title || formData.pageName || 'Unknown Page',
            containerId: formData.containerId || '',
            created: item.Created || formData.created || new Date().toISOString(),
            status: item.QueryStatus || 'New',
            email: formData.email || item.Title || 'Anonymous',
            firstName: formData.firstName,
            lastName: formData.lastName,
            smartPage: formData.pageName,
            fields: formData.fields || []
          };
        });

        // --- SLIDER ITEMS ---
        const transformedSliderItems = spSliderItems.map((item: any) => ({
          id: String(item.Id),
          title: item.Title || '',
          subtitle: item.Subtitle || '',
          description: item.Description || '',
          status: item.Status || 'Draft',
          sortOrder: item.SortOrder || 0,
          ctaText: item.CtaText || '',
          ctaUrl: item.CtaUrl || '',
          imageUrl: item.ImageUrl?.Url || '',
          imageName: item.ImageName || '',
          itemType: item.ItemType || '',
          translations: item.Translations ? JSON.parse(item.Translations) : {},
          createdDate: item.Created,
          modifiedDate: item.Modified || item.Created,
          createdBy: item.Author?.Title || 'System',
          modifiedBy: item.Editor?.Title || item.Author?.Title || 'System',
          containerIds: parseContainerLookupIds(item),
          pageIds: parsePageLookupIds(item, 'ImageSlider'),
        }));

        const applyReconciledTaggingIds = <T extends { id: string; containerIds?: string[]; pageIds?: string[] }>(
          items: T[],
          listName: TaggableListName,
          reconciledItems: Array<{ id: string; listName: TaggableListName; containerIds: string[]; pageIds?: string[] }>
        ): T[] => {
          const byId = new Map(
            reconciledItems
              .filter((entry) => entry.listName === listName)
              .map((entry) => [entry.id, entry])
          );
          return items.map((entry) => {
            const reconciled = byId.get(entry.id);
            if (!reconciled) {
              return {
                ...entry,
                containerIds: entry.containerIds || [],
                pageIds: entry.pageIds || [],
              };
            }
            return {
              ...entry,
              containerIds: reconciled.containerIds || [],
              pageIds: reconciled.pageIds || [],
            };
          });
        };

        const taggableItemsForReconcile = [
          ...spNews.map((item) => enrichTaggableItemWithPageLookup(toTaggableContentItem(item, 'News'), item)),
          ...spEvents.map((item) => enrichTaggableItemWithPageLookup(toTaggableContentItem(item, 'Events'), item)),
          ...spDocs.map((item) => enrichTaggableItemWithPageLookup(toTaggableContentItem(item, 'Documents'), item)),
          ...spContainerItems.map((item) => enrichTaggableItemWithPageLookup(toTaggableContentItem(item, 'ContainerItems'), item)),
          ...spContacts.map((item) => enrichTaggableItemWithPageLookup(toTaggableContentItem(item, 'Contacts'), item)),
          ...spSliderItems.map((item) => enrichTaggableItemWithPageLookup(toTaggableContentItem(item, 'ImageSlider'), item)),
          ...spPages.map((item) => enrichTaggableItemWithPageLookup(toTaggableContentItem(item, 'SmartPages'), item)),
        ];

        const containerTaggingReconciliation = reconcileContainerTagging(transformedPages, taggableItemsForReconcile);
        const pageTaggingReconciliation = reconcilePageTagging(
          containerTaggingReconciliation.pages,
          containerTaggingReconciliation.items
        );
        const reconciledPages = pageTaggingReconciliation.pages;
        const reconciledTaggingItems = pageTaggingReconciliation.items;
        const reconciledNews = applyReconciledTaggingIds(transformedNews, 'News', reconciledTaggingItems);
        const reconciledEvents = applyReconciledTaggingIds(transformedEvents, 'Events', reconciledTaggingItems);
        const reconciledDocs = applyReconciledTaggingIds(transformedDocs, 'Documents', reconciledTaggingItems);
        const reconciledContainerItems = applyReconciledTaggingIds(transformedContainerItems, 'ContainerItems', reconciledTaggingItems);
        const reconciledContacts = applyReconciledTaggingIds(transformedContacts, 'Contacts', reconciledTaggingItems);
        const reconciledSliderItems = applyReconciledTaggingIds(transformedSliderItems, 'ImageSlider', reconciledTaggingItems);
        const reconciledSmartPages = applyReconciledTaggingIds(reconciledPages, 'SmartPages', reconciledTaggingItems);

        // Update store with SharePoint data (fallback to mock if empty)
        // Update store with SharePoint data (No Mock Fallbacks)
        // --- Navigation Logic to Set Default Page ---
        // 1. Find "HOME" in Navigation (Case Insensitive)
        let defaultPageId = '';
        const homeNavItem = transformedNav.find(n => n.title.toUpperCase() === 'HOME' && n.pageId);

        if (homeNavItem && homeNavItem.pageId) {
          defaultPageId = homeNavItem.pageId;
        } else {
          // 2. Fallback: Run "any" navigation.
          // We prioritize ROOT items to match the user's likely expectation (Top/First Sidebar Item)
          const rootItems = transformedNav.filter(n => n.parentId === 'root').sort((a, b) => a.order - b.order);
          const firstRootPage = rootItems.find(n => n.type === 'Page' && n.pageId);

          if (firstRootPage && firstRootPage.pageId) {
            defaultPageId = firstRootPage.pageId;
          } else {
            // If no root pages, try ANY page in navigation (sorted by order)
            const sortedNav = [...transformedNav].sort((a, b) => a.order - b.order);
            const firstPageNav = sortedNav.find(n => n.type === 'Page' && n.pageId);

            if (firstPageNav && firstPageNav.pageId) {
              defaultPageId = firstPageNav.pageId;
            } else if (reconciledSmartPages.length > 0) {
              // Fallback: First generic page (no nav item)
              defaultPageId = reconciledSmartPages[0].id;
            }
          }
        }

        // Verify the page actually exists in our loaded pages
        const defaultPageExists = reconciledSmartPages.find(p => p.id === defaultPageId);
        if (!defaultPageExists && reconciledSmartPages.length > 0) {
          defaultPageId = reconciledSmartPages[0].id;
        }

        // If no hash is set (root), or if we want to enforce the default logic
        // construct the correct slug for the determined default page
        if (defaultPageExists) {
          const targetSlug = defaultPageExists.slug;
          // Only redirect if at root or if necessary. 
          // If the user already has a hash, App.tsx will likely handle it. 
          // However, if the current hash is invalid or just empty, we set this.
          if (
            !window.location.hash ||
            window.location.hash === '#/' ||
            window.location.hash === '#' ||
            window.location.hash === '#/home'
          ) {
            window.location.hash = targetSlug === '/' ? '/home' : targetSlug;
          }
        }

        const finalSiteConfig = {
          ...loadedSiteConfig,
          navigation: transformedNav,
          languages: normalizeSiteLanguages(loadedSiteConfig.languages),
          defaultLanguage: 'en' as LanguageCode,
        };
        const enabledLangs = getEnabledSiteLanguages(finalSiteConfig);
        const resolvedCurrentLanguage = isLanguageEnabled(enabledLangs, get().currentLanguage)
          ? get().currentLanguage
          : 'en';

        set({
          pages: reconciledSmartPages,
          news: reconciledNews,
          permissionGroups: spGroups,
          permissionUsers: transformedUsers,
          events: reconciledEvents,
          documents: reconciledDocs,
          containerItems: reconciledContainerItems,
          contacts: reconciledContacts,
          sliderItems: reconciledSliderItems,
          contactQueries: transformedContactQueries,
          images: transformedImages,
          imageFolders: imageFolders,
          defaultImageUrl,
          siteConfig: finalSiteConfig,
          themeConfig: loadedTheme,
          uiLabels: loadedUiLabels,
          translationItems: loadedTranslationItems,
          currentPageId: defaultPageId || '1', // Ensure valid ID
          currentLanguage: resolvedCurrentLanguage,
          isLoading: false
        });
        persistUiLanguage(resolvedCurrentLanguage);

        console.log('✅ SharePoint data loaded successfully');

        if (containerTaggingReconciliation.lookupUpdates.length > 0) {
          await persistItemContainerLookups(containerTaggingReconciliation.lookupUpdates);
        }

        const pageLookupUpdates = [
          ...pageTaggingReconciliation.pageLookupUpdates,
        ];
        if (pageLookupUpdates.length > 0) {
          await persistItemPageLookups(pageLookupUpdates);
        }

        if (pageTaggingReconciliation.containerLookupUpdates.length > 0) {
          await persistItemContainerLookups(pageTaggingReconciliation.containerLookupUpdates);
        }

        const containersToPersist = [
          ...containerTaggingReconciliation.containersToPersist,
          ...pageTaggingReconciliation.containersToPersist,
        ];
        const persistedContainerKeys = new Set<string>();
        if (containersToPersist.length > 0) {
          const { updateContainer: updateContainerSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
          for (const { pageId, containerId } of containersToPersist) {
            const persistKey = `${pageId}:${containerId}`;
            if (persistedContainerKeys.has(persistKey)) continue;
            persistedContainerKeys.add(persistKey);
            const page = reconciledSmartPages.find((entry) => entry.id === pageId);
            const container = page?.containers.find((entry) => entry.id === containerId);
            if (!page || !container) continue;

            await updateContainerSP(Number(container.id), {
              PageId: Number(page.id),
              ContainerType: container.type,
              SortOrder: container.order,
              Settings: JSON.stringify(container.settings || {}),
              ContainerContent: JSON.stringify(container.content || {}),
              IsVisible: container.isVisible,
              Title: container.title || container.settings?.containerTitle || container.settings?.title || container.type,
              BtnEnabled: container.settings?.btnEnabled || false,
              BtnName: toSharePointText(container.settings?.btnName),
              BtnLinkType: container.settings?.btnLinkType || 'url',
              BtnUrl: container.settings?.btnUrl || '',
              BtnContainerId: container.settings?.btnContainerId || '',
              BtnTargetContainerTitle: container.settings?.btnTargetContainerTitle || '',
            });
          }
        }

        // Validate and clean up invalid taggedItems references
        await get().validateContainerTaggedItems();
      } catch (error) {
        console.error('❌ Error loading SharePoint data:', error);
        set({ isLoading: false });
      }
    },

    // Helper function to remove a deleted item from all containers' taggedItems
    removeItemFromContainers: async (itemId: string) => {
      try {
        const state = get();
        let hasChanges = false;

        const updatedPages = state.pages.map(page => {
          const updatedContainers = page.containers.map(container => {
            const taggedItems = container.settings?.taggedItems;
            if (taggedItems && Array.isArray(taggedItems) && taggedItems.includes(itemId)) {
              hasChanges = true;
              const newTaggedItems = taggedItems.filter((id: string) => id !== itemId);
              console.log(`🧹 Removing item ${itemId} from container ${container.id} in page ${page.id}`);
              return {
                ...container,
                settings: {
                  ...container.settings,
                  taggedItems: newTaggedItems
                }
              };
            }
            return container;
          });

          if (updatedContainers.some((c, i) => c !== page.containers[i])) {
            return { ...page, containers: updatedContainers };
          }
          return page;
        });

        if (hasChanges) {
          set({ pages: updatedPages });

          // Update SharePoint for each modified container
          const { updateContainer: updateContainerSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
          for (const page of updatedPages) {
            for (const container of page.containers) {
              const originalContainer = state.pages
                .find(p => p.id === page.id)
                ?.containers.find(c => c.id === container.id);

              if (originalContainer && originalContainer.settings?.taggedItems !== container.settings?.taggedItems) {
                const spData = {
                  PageId: Number(page.id),
                  ContainerType: container.type,
                  SortOrder: container.order,
                  Settings: JSON.stringify(container.settings || {}),
                  ContainerContent: JSON.stringify(container.content || {}),
                  IsVisible: container.isVisible,
                  Title: container.title || container.settings?.containerTitle || container.settings?.title || container.type,
                  BtnEnabled: container.settings?.btnEnabled || false,
                  BtnName: toSharePointText(container.settings?.btnName),
                  BtnLinkType: container.settings?.btnLinkType || 'url',
                  BtnUrl: container.settings?.btnUrl || '',
                  BtnContainerId: container.settings?.btnContainerId || ''
                };
                await updateContainerSP(Number(container.id), spData);
                console.log(`✅ Updated container ${container.id} in SharePoint`);
              }
            }
          }

          await syncLookupsForItemIds(get(), [itemId]);
          set((state) => {
            const listName = resolveListNameForItemId(itemId, state);
            const containerIds = listName
              ? getContainerIdsForItem(itemId, state.pages, listName)
              : [];
            const pageIds = listName
              ? getPageIdsForItem(itemId, state.pages, listName)
              : [];
            return {
              news: state.news.map((item) => item.id === itemId ? { ...item, containerIds, pageIds } : item),
              events: state.events.map((item) => item.id === itemId ? { ...item, containerIds, pageIds } : item),
              documents: state.documents.map((item) => item.id === itemId ? { ...item, containerIds, pageIds } : item),
              containerItems: state.containerItems.map((item) => item.id === itemId ? { ...item, containerIds, pageIds } : item),
              contacts: state.contacts.map((item) => item.id === itemId ? { ...item, containerIds, pageIds } : item),
              sliderItems: state.sliderItems.map((item) => item.id === itemId ? { ...item, containerIds, pageIds } : item),
              pages: state.pages.map((item) => item.id === itemId ? { ...item, containerIds, pageIds } : item),
            };
          });
        }
      } catch (error) {
        console.error('Error removing item from containers:', error);
      }
    },

    // Helper function to validate and clean up invalid taggedItems on load
    validateContainerTaggedItems: async () => {
      try {
        const state = get();
        const allItemIds = new Set([
          ...state.news.map(n => n.id),
          ...state.events.map(e => e.id),
          ...state.documents.map(d => d.id),
          ...state.containerItems.map(c => c.id),
          ...state.contacts.map(c => c.id),
          ...state.sliderItems.map(s => s.id),
          ...state.pages.map(p => p.id)
        ]);

        let hasChanges = false;

        const updatedPages = state.pages.map(page => {
          const updatedContainers = page.containers.map(container => {
            const taggedItems = container.settings?.taggedItems;
            if (taggedItems && Array.isArray(taggedItems)) {
              const validTaggedItems = taggedItems.filter((id: string) => allItemIds.has(id));

              if (validTaggedItems.length !== taggedItems.length) {
                hasChanges = true;
                const removedIds = taggedItems.filter((id: string) => !allItemIds.has(id));
                console.log(`🧹 Cleaning invalid IDs from container ${container.id}: ${removedIds.join(', ')}`);

                return {
                  ...container,
                  settings: {
                    ...container.settings,
                    taggedItems: validTaggedItems
                  }
                };
              }
            }
            return container;
          });

          if (updatedContainers.some((c, i) => c !== page.containers[i])) {
            return { ...page, containers: updatedContainers };
          }
          return page;
        });

        if (hasChanges) {
          set({ pages: updatedPages });

          // Update SharePoint for each modified container
          const { updateContainer: updateContainerSP } = await import(/* webpackChunkName: 'sp-service' */ './services/SPService');
          for (const page of updatedPages) {
            for (const container of page.containers) {
              const originalContainer = state.pages
                .find(p => p.id === page.id)
                ?.containers.find(c => c.id === container.id);

              if (originalContainer && originalContainer.settings?.taggedItems !== container.settings?.taggedItems) {
                const spData = {
                  PageId: Number(page.id),
                  ContainerType: container.type,
                  SortOrder: container.order,
                  Settings: JSON.stringify(container.settings || {}),
                  ContainerContent: JSON.stringify(container.content || {}),
                  IsVisible: container.isVisible,
                  Title: container.title || container.settings?.containerTitle || container.settings?.title || container.type,
                  BtnEnabled: container.settings?.btnEnabled || false,
                  BtnName: toSharePointText(container.settings?.btnName),
                  BtnLinkType: container.settings?.btnLinkType || 'url',
                  BtnUrl: container.settings?.btnUrl || '',
                  BtnContainerId: container.settings?.btnContainerId || ''
                };
                await updateContainerSP(Number(container.id), spData);
                console.log(`✅ Validated and updated container ${container.id} in SharePoint`);
              }
            }
          }

          console.log('✅ Container taggedItems validation completed');
        }
      } catch (error) {
        console.error('Error validating container taggedItems:', error);
      }
    },

    // Live preview sync — patches in-memory only, zero SharePoint overhead
    syncContainerPreview: (pageId, container) => {
      const normalizedContainer = {
        ...container,
        settings: ensureContainerDisplaySortSettings(container.settings || {}, container.type),
      };
      set((state) => ({
        pages: state.pages.map((p) =>
          p.id === pageId
            ? { ...p, containers: p.containers.map((c) => (c.id === container.id ? normalizedContainer : c)) }
            : p
        ),
      }));
    },
  })
);

/** Legacy SharePoint label rows may still expose old hero template names; prefer bundled defaults for these keys. */
const PREFER_INITIAL_UI_LABEL_KEYS = new Set([
  'HERO_TMPL_TEXT_HEADER',
  'HERO_TMPL_TEXT_HEADER_DESC',
  'HERO_TMPL_COLOR_BG',
  'HERO_TMPL_COLOR_BG_DESC',
  'HERO_TMPL_IMAGE_BG',
  'HERO_TMPL_IMAGE_BG_DESC',
  'HERO_TMPL_IMAGE_TEXT',
  'HERO_TMPL_IMAGE_TEXT_DESC',
  'LABEL_TEXT_TITLE',
  'LABEL_TITLE_COLOR_BG',
  'LABEL_TITLE_IMAGE_BG',
  'LABEL_LAYOUT_DESIGN',
  'LABEL_HERO_TEMPLATE_IMAGE_TEXT',
  'TMPL_PAGE_CONTENT_LABEL',
  'TMPL_PAGE_CONTENT_DESC',
  'TMPL_HERO_IMG_LABEL',
  'TMPL_HERO_IMG_DESC',
  'TMPL_HEADER_COLOR_BG_LABEL',
  'TMPL_HEADER_COLOR_BG_DESC',
  'TMPL_VISUAL_TEXT_LABEL',
  'TMPL_VISUAL_TEXT_DESC',
  'TITLE_SELECT_TMPL_DATA_GRID',
  'TAB_CONTAINER_DATA_GRID',
  'LABEL_DATA_GRID_EDITOR',
  'CONTAINER_TYPE_DATA_GRID',
  'TITLE_SELECT_TMPL_CONTAINER_SECTION',
  'TAB_CONTAINER_CONTAINER_SECTION',
  'TMPL_CONTAINER_SECTION_CARD_LABEL',
  'TMPL_CONTAINER_SECTION_CARD_DESC',
  'PREVIEW_CONTAINER_SECTION_TITLE',
  'PREVIEW_CONTAINER_SECTION_DESC',
  'CONTAINER_TYPE_CONTAINER_SECTION',
  'LABEL_CONTAINER_SECTION_EDITOR',
  'LABEL_SHOW_TITLE_UNDERLINE',
  'LABEL_BIND_PAGE_TITLE_DESCRIPTION',
  'TOOLTIP_BIND_PAGE_TITLE_DESCRIPTION',
  'LABEL_HEADING_BACKGROUND',
  'LABEL_EDITOR_TEXT_COLOR',
  'THEME_VAR_--heading-color',
  'THEME_VAR_--heading-h1-color',
  'THEME_VAR_--heading-h2-color',
  'THEME_VAR_--heading-h3-color',
  'THEME_VAR_--heading-h4-color',
  'THEME_VAR_--heading-h5-color',
  'THEME_VAR_--heading-h6-color',
  'THEME_VAR_--font-size-h1',
  'THEME_VAR_--font-size-h2',
  'THEME_VAR_--font-size-h3',
  'THEME_VAR_--font-size-h4',
  'THEME_VAR_--font-size-h5',
  'THEME_VAR_--font-size-h6',
  'THEME_VAR_--border-radius-sm',
  'THEME_VAR_--border-radius-md',
  'THEME_VAR_--border-radius-lg',
  'MSG_MULTIPLE_USERS_FOUND',
  'PLACEHOLDER_SEARCH_USER',
  'PLACEHOLDER_EXACT_USER',
  'TITLE_EDIT_TRANSLATION',
  'TAB_BASIC_INFO',
  'TAB_BASIC_INFO_NEWS',
  'TAB_IMAGE_INFO',
  'LABEL_TRANSLATION',
  'LABEL_ORIGINAL_ENGLISH',
  'TAB_TRANSLATION',
  'MSG_FIELD_REQUIRED_NAMED',
  'MSG_INVALID_EMAIL',
  'MSG_FORM_ERROR_SUMMARY',
  'MSG_FORM_HAS_ERRORS',
  'MSG_ACCEPT_PRIVACY',
  'MSG_INCORRECT_CAPTCHA',
  'MSG_SUBMIT_ERROR',
]);

export const getTranslation = (key: string, lang: LanguageCode): string => {
  const uiLabels = useStore.getState().uiLabels;
  const item = PREFER_INITIAL_UI_LABEL_KEYS.has(key)
    ? (INITIAL_UI_LABELS[key] || uiLabels[key])
    : (uiLabels[key] || INITIAL_UI_LABELS[key]);
  if (!item) return key;
  return item[lang] || item.en || item.de || item.fr || item.es || key;
};

const LANGUAGE_KEYS: LanguageCode[] = ['en', 'de', 'fr', 'es'];

const isMultilingualRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return LANGUAGE_KEYS.some((key) => typeof record[key] === 'string');
};

const pickLocalizedString = (record: Record<string, unknown>, key: string): string => {
  const val = record[key];
  return typeof val === 'string' ? val : '';
};

/**
 * Read only the requested language value (no fallback).
 * Use in translation editors so cleared fields stay empty; use getLocalizedText for preview.
 */
export const getExactLocalizedText = (text: any, lang: LanguageCode): string => {
  if (!text) return '';
  if (typeof text === 'string') return lang === 'en' ? text : '';
  if (!isMultilingualRecord(text)) return '';
  return pickLocalizedString(text as Record<string, unknown>, lang);
};

/** Resolve multilingual or plain text; missing translations fall back to English/original. */
export const getLocalizedText = (text: any, lang: LanguageCode): string => {
  if (typeof text === 'string') return text;
  if (!text || typeof text !== 'object') return '';
  try {
    if (!isMultilingualRecord(text)) return '';
    const record = text as Record<string, unknown>;

    const requested = lang === 'en' ? pickLocalizedString(record, 'en') : pickLocalizedString(record, lang);
    if (requested.trim()) return requested;

    const base = pickLocalizedString(record, 'en');
    if (base.trim()) return base;

    for (const key of LANGUAGE_KEYS) {
      if (key === lang) continue;
      const fallback = pickLocalizedString(record, key);
      if (fallback.trim()) return fallback;
    }
    return '';
  } catch (e) {
    return '';
  }
};

const coerceItemFieldToString = (value: any, lang: LanguageCode): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (isMultilingualRecord(value)) return getLocalizedText(value, lang);
    return '';
  }
  return String(value);
};

export const getItemTranslation = (item: any, lang: LanguageCode, field: string | string[]): string => {
  if (!item) return '';

  const getFromField = (f: string): string => {
    const raw = item[f];

    // 1. Multilingual field on the item itself
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && isMultilingualRecord(raw)) {
      return getLocalizedText(raw, lang);
    }

    // 2. English/base field wins for EN (avoids stale EN in translations masking editor updates)
    if (lang === 'en') {
      const base = coerceItemFieldToString(raw, lang);
      if (base.trim()) return base;
    }

    // 3. Per-language translations object
    const langTranslations = item.translations?.[lang];
    if (langTranslations) {
      if (typeof langTranslations === 'string' && f === 'title') {
        const titleTranslation = langTranslations.trim();
        if (titleTranslation) return titleTranslation;
      } else if (typeof langTranslations === 'object' && langTranslations[f]) {
        const fieldTranslation = coerceItemFieldToString(langTranslations[f], lang).trim();
        if (fieldTranslation) return fieldTranslation;
      }
    }

    // 4. Original scalar / multilingual base field
    const original = coerceItemFieldToString(raw, lang);
    if (original.trim()) return original;

    // 5. Legacy: EN stored only under translations.en
    const enFromTranslations = item.translations?.en;
    if (typeof enFromTranslations === 'string' && f === 'title' && enFromTranslations.trim()) {
      return enFromTranslations;
    }
    if (enFromTranslations && typeof enFromTranslations === 'object' && enFromTranslations[f]) {
      const fromEnBucket = coerceItemFieldToString(enFromTranslations[f], 'en').trim();
      if (fromEnBucket) return fromEnBucket;
    }

    // 6. Last resort for EN mode: another language bucket (never use for non-EN UI)
    if (lang === 'en' && item.translations?.de) {
      const deBucket = item.translations.de;
      if (typeof deBucket === 'string' && f === 'title' && deBucket.trim()) return deBucket;
      if (typeof deBucket === 'object' && deBucket[f]) {
        const fromDe = coerceItemFieldToString(deBucket[f], lang).trim();
        if (fromDe) return fromDe;
      }
    }

    return '';
  };

  const fields = Array.isArray(field) ? field : [field];
  for (const f of fields) {
    const val = getFromField(f);
    if (val.trim()) return val;
  }

  return '';
};

export const getGlobalTranslation = (id: string, translationItems: any[], lang: LanguageCode, fallback: string): string => {
  const item = translationItems?.find(t => t.id === id);
  if (!item) return fallback;
  const base = (item.translations?.en ?? fallback ?? '').toString().trim();
  if (lang === 'en') {
    return item.translations?.en || fallback || '';
  }
  const translated = (item.translations?.[lang] ?? '').toString().trim();
  if (translated) return translated;
  if (base) return base;
  return fallback || '';
};
