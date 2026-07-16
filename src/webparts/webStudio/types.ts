
// Enums
export enum ContainerType {
  HERO = 'HERO',
  IMAGE_TEXT = 'IMAGE_TEXT',
  SLIDER = 'SLIDER',
  CARD_GRID = 'CARD_GRID',
  CONTACT_FORM = 'CONTACT_FORM',
  DATA_GRID = 'DATA_GRID',
  TABLE = 'TABLE',
  MAP = 'MAP',
  CONTAINER_SECTION = 'CONTAINER_SECTION'
}

export enum ModalType {
  NONE = 'NONE',
  NAVIGATION = 'NAVIGATION',
  NEWS = 'NEWS',
  EVENTS = 'EVENTS',
  DOCUMENTS = 'DOCUMENTS',
  CONTACTS = 'CONTACTS',
  FOOTER = 'FOOTER',
  SITE_MGMT = 'SITE_MGMT',
  CONTAINER_EDITOR = 'CONTAINER_EDITOR',
  SLIDER_MANAGER = 'SLIDER_MANAGER', // New Isolated Modal
  IMAGES = 'IMAGES',
  TRANSLATION = 'TRANSLATION',
  PERMISSIONS = 'PERMISSIONS',
  CONTACT_QUERIES = 'CONTACT_QUERIES',
  STYLING = 'STYLING',
  THEME_TEMPLATES = 'THEME_TEMPLATES',
  PAGE_INFO = 'PAGE_INFO',
  VERSION_HISTORY = 'VERSION_HISTORY',
  CONTAINER_ITEMS = 'CONTAINER_ITEMS',
  LABEL_EDITOR = 'LABEL_EDITOR'
}

export enum ViewMode {
  PREVIEW = 'PREVIEW',
  EDIT = 'EDIT'
}

// Styling & Theming
export interface ThemeConfig {
  [key: string]: string;
}

// Multilingual Core
export type LanguageCode = 'en' | 'de' | 'fr' | 'es';

export interface MultilingualText {
  en: string;
  de?: string;
  fr?: string;
  es?: string;
}

// Content Models
export interface NavItem {
  id: string;
  parentId: string; // 'root' for top level
  title: string; // Simplified for this specific requirement
  type: 'Page' | 'External' | 'Container';
  url?: string;
  pageId?: string; // Reference to a Smart Page
  containerId?: string; // Reference to a Container
  isVisible: boolean;
  openInNewTab: boolean;
  order: number;
  status?: 'Draft' | 'Published'; // Navigation item status
  translations?: Record<string, string>;
  createdBy?: string;
  modifiedBy?: string;
  createdDate?: string;
  modifiedDate?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  status: 'Draft' | 'Published';
  publishDate: string;
  description: string;
  imageUrl?: string;
  imageName?: string;
  readMore: {
    enabled: boolean;
    text?: string;
    url?: string;
  };
  seo?: {
    title: string;
    description: string;
    keywords?: string;
  };
  translations?: Record<string, {
    title: string;
    description: string;
    readMoreText?: string;
  }>;
  createdBy?: string;
  modifiedBy?: string;
  createdDate?: string;
  modifiedDate?: string;
  containerIds?: string[];
  pageIds?: string[];
}

export interface EventItem {
  id: string;
  title: string;
  status: 'Draft' | 'Published';
  startDate: string;
  endDate?: string;
  location?: string;
  category?: string;
  description: string;
  imageUrl?: string;
  imageName?: string;
  readMore: {
    enabled: boolean;
    text?: string;
    url?: string;
  };
  seo?: {
    title: string;
    description: string;
    keywords?: string;
  };
  translations?: Record<string, {
    title: string;
    description: string;
    readMoreText?: string;
    category?: string;
    location?: string;
  }>;
  createdBy?: string;
  modifiedBy?: string;
  createdDate?: string;
  modifiedDate?: string;
  containerIds?: string[];
  pageIds?: string[];
}

export interface DocumentItem {
  id: string;
  title: string;
  name?: string; // File name (FileLeafRef) - separate from title metadata
  status: 'Draft' | 'Published';
  date: string;
  type: 'PDF' | 'Word' | 'Excel' | 'PPT' | 'Link' | 'Other';
  year: string;
  description: string;
  imageUrl?: string;
  imageName?: string;
  url?: string;
  itemRank?: number;
  file?: File;
  translations?: Record<string, {
    title: string;
    description: string;
    readMoreText?: string;
  }>;
  sortOrder?: number;
  createdBy?: string;
  modifiedBy?: string;
  createdDate?: string;
  modifiedDate?: string;
  authorName?: string;
  editorName?: string;
  containerIds?: string[];
  pageIds?: string[];
}

export interface ContainerItem {
  id: string;
  title: string;
  status: 'Draft' | 'Published';
  sortOrder: number;
  description: string;
  imageUrl?: string;
  imageName?: string;
  translations?: Record<string, {
    title: string;
    description: string;
  }>;
  createdBy?: string;
  modifiedBy?: string;
  createdDate?: string;
  modifiedDate?: string;
  btnEnabled?: boolean;
  btnName?: string;
  btnLinkType?: 'url' | 'container';
  btnUrl?: string;
  btnContainerId?: string;
  btnTargetContainerTitle?: string;
  btnConfig?: Record<string, ActionButtonConfig>;
  containerIds?: string[];
  pageIds?: string[];
}

export interface ActionButtonConfig {
  btnEnabled?: boolean;
  btnName?: string;
  btnLinkType?: 'url' | 'container';
  btnUrl?: string;
  btnContainerId?: string;
  btnTargetContainerTitle?: string;
  btnFontSize?: number | string;
  btnFontWeight?: number | string;
  btnLetterCase?: string;
  btnRadiusPreset?: 'none' | 'sm' | 'lg' | 'full' | 'custom';
  btnRadiusCustom?: {
    topLeft?: string;
    topRight?: string;
    bottomRight?: string;
    bottomLeft?: string;
  };
}

export interface ContactItem {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  status: 'Draft' | 'Published';
  sortOrder: number;
  jobTitle?: string;
  company?: string;
  email?: string;
  phone?: string;
  description: string;
  imageUrl?: string;
  imageName?: string;
  imageCacheToken?: number;
  translations?: Record<string, {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    company?: string;
    description?: string;
  }>;
  createdBy?: string;
  modifiedBy?: string;
  createdDate?: string;
  modifiedDate?: string;
  btnEnabled?: boolean;
  btnName?: string;
  btnLinkType?: 'url' | 'container';
  btnUrl?: string;
  btnContainerId?: string;
  btnTargetContainerTitle?: string;
  btnConfig?: Record<string, ActionButtonConfig>;
  btnFontSize?: number | string;
  btnFontWeight?: number | string;
  btnLetterCase?: string;
  btnRadiusPreset?: ActionButtonConfig['btnRadiusPreset'];
  btnRadiusCustom?: ActionButtonConfig['btnRadiusCustom'];
  fullNameFontSize?: number | string;
  fullNameFontWeight?: number;
  fullNameLineHeight?: number | string;
  fullNameColor?: string;
  jobTitleFontSize?: number | string;
  jobTitleFontWeight?: number;
  jobTitleLineHeight?: number | string;
  jobTitleColor?: string;
  containerIds?: string[];
  pageIds?: string[];
}

export type SliderImageRadiusPreset = 'none' | 'sm' | 'lg' | 'full' | 'custom';

export interface SliderImageRadiusCustom {
  topLeft?: string;
  topRight?: string;
  bottomRight?: string;
  bottomLeft?: string;
}

export interface SliderImageSettings {
  radiusPreset?: SliderImageRadiusPreset;
  radiusCustom?: SliderImageRadiusCustom;
}

export interface SliderItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  imageName?: string;
  imageSettings?: SliderImageSettings;
  ctaText?: string;
  ctaUrl?: string;
  sortOrder: number;
  status: 'Draft' | 'Published';
  itemType?: string; // Type of slider (e.g., img_text, img_gallery)
  translations?: Record<string, {
    title?: string;
    subtitle?: string;
    description?: string;
    ctaText?: string;
  }>;
  createdDate?: string;
  modifiedDate?: string;
  containerIds?: string[];
  pageIds?: string[];
}

export interface ImageItem {
  id: string;
  name: string;
  url: string;
  folderId: string;
  width?: number;
  height?: number;
  size?: string;
  type?: string;
  createdDate?: string;
  createdBy?: string;
  modifiedDate?: string;
  modifiedBy?: string;
  description?: string;
  title?: string;
  altText?: string;
  copyright?: string;
  keywords?: string;
}

export interface ImageFolder {
  id: string;
  name: string;
  count: number;
}

export interface TranslationItem {
  id: string;
  sourceList: string;
  original: string; // English
  translations: {
    de?: string;
    fr?: string;
    es?: string;
    en?: string;
  };
  lastUpdated?: string;
}

// Permission Models
export interface PermissionUser {
  id: string;
  name: string;
  email: string;
}

export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  type: 'Owners' | 'Members' | 'Visitors' | 'Custom' | 'SuperAdmin' | 'SiteAdmin';
  memberIds: string[];
}

export interface ContactQueryField {
  label: string;
  value: string;
  type: string;
  id: string;
}

export interface ContactQuery {
  id: string;
  // Metadata
  pageId?: string;
  pageName: string;
  containerId?: string;
  created: string; // ISO String
  status: 'New' | 'Read' | 'Replied';

  // Flattened for easy access (from fields)
  firstName?: string;
  lastName?: string;
  email?: string;
  submitDestination?: string;
  smartPage?: string; // Legacy support
  captchaId?: string;
  captchaAnswer?: string;
  website?: string;

  // Dynamic Data
  fields: ContactQueryField[];
  btnConfig?: Record<string, {
    btnEnabled?: boolean;
    btnName?: string;
    btnLinkType?: 'url' | 'container';
    btnUrl?: string;
    btnContainerId?: string;
  }>;
}

export interface Container {
  id: string;
  pageId: string; // Explicit binding to page
  type: ContainerType;
  order: number;
  settings: Record<string, any>; // Flexible config based on type
  content: Record<string, MultilingualText | any>; // Values are now multilingual
  title?: string; // Container Title (metadata)
  isVisible: boolean;
  status: 'Draft' | 'Published';
  btnEnabled?: boolean;
  btnName?: string;
  btnLinkType?: 'url' | 'container';
  btnUrl?: string;
  btnContainerId?: string;
  btnTargetContainerTitle?: string;
  createdBy?: string;
  modifiedBy?: string;
  createdDate?: string;
  modifiedDate?: string;
}

export interface Page {
  id: string;
  title: MultilingualText;
  slug: string;
  status: 'Draft' | 'Published';
  createdBy: string;
  modifiedBy: string;
  createdDate?: string;
  modifiedDate: string;
  containers: Container[];
  // New fields for Page Info Editor
  description?: string;
  isHomePage?: boolean;
  imageUrl?: string;
  imageName?: string;
  sortOrder?: number;
  seo?: {
    title: string;
    description: string;
    keywords: string;
  };
  containerIds?: string[];
  /** Page lookup IDs — pages where this Smart Page is tagged (same Page field as other lists). */
  pageIds?: string[];
  /** Parent Smart Page when this page is a sub-page under another page. */
  parentPageId?: string;
}

export type NavPosition = 'right' | 'near_logo' | 'below_logo';

export interface FooterLink {
  id: string;
  label: string;
  url: string;
  translations?: Record<string, string>;
  modified?: string;
}

export interface FooterColumn {
  id: string;
  title: string;
  links: FooterLink[];
  translations?: Record<string, string>;
  modified?: string;
}

export interface SiteConfig {
  name: string;
  languages: LanguageCode[];
  defaultLanguage: LanguageCode;
  navPosition: NavPosition;
  navAlignment: 'left' | 'center' | 'right';
  /** When false, breadcrumb trail is hidden in site preview. Defaults to true. */
  showBreadcrumb?: boolean;
  headerWidth: 'full' | 'standard' | 'custom';
  /** Used when headerWidth is `custom` (e.g. 1280px, 90rem, 95%). */
  headerWidthCustom?: string;
  /** Navigation bar width; unset = match page; full = 100% header area; custom = fixed override. */
  navigationWidth?: 'full' | 'standard' | 'custom';
  navigationWidthCustom?: string;
  headerBackgroundColor: string;
  headerTopBackgroundColor?: string;
  headerBottomBackgroundColor?: string;
  headerLogoText?: MultilingualText;
  headerLogoTextSpacing?: string;
  headerLogoTextAlignment?: 'up' | 'centre' | 'down';
  headerLogoTextFontSize?: string;
  headerTopAlignment?: 'left' | 'center' | 'right';
  headerLogoMarginLeft?: string;
  headerNavMarginLeft?: string;
  headerNavHeight?: string;
  headerLogoHeight?: string;
  headerNavFontWeight?: string;
  headerNavHoverColor?: string;
  headerSubmenuHoverBgColor?: string;
  headerSubmenuHoverTextColor?: string;
  headerMenuFontFamily?: string;
  headerMenuFontSize?: string;
  headerMenuFontWeight?: string;
  headerMenuLineHeight?: string;
  headerMenuTextTransform?: string;
  headerSubmenuFontFamily?: string;
  headerSubmenuFontSize?: string;
  headerSubmenuFontWeight?: string;
  headerSubmenuLineHeight?: string;
  headerSubmenuTextTransform?: string;
  headerSubmenuWidth?: string;
  headerBreadcrumbHeight?: string;
  headerBreadcrumbFontSize?: string;
  logo: {
    url: string;
    position: 'left' | 'center' | 'right';
    width: string;
  };
  navigation: NavItem[];
  footer: {
    template: 'Table' | 'Corporate';
    backgroundColor: string; // can be 'white', 'light-grey', 'site-color', or custom hex
    alignment: 'left' | 'center' | 'right';
    subFooterText: string;
    showBullets?: boolean;
    fontSettings: {
      headingSize: string;
      subHeadingSize: string;
      headingWeight?: string;
      subHeadingWeight?: string;
    };
    columns: FooterColumn[]; // For Table View
    contactInfo: {
      address: string;
      email: string;
      phone: string;
    };
    socialLinks: {
      linkedin: string;
      facebook: string;
      twitter: string;
      instagram: string;
    };
    brandItems?: { id: string, label: string, value: string, translations?: Record<string, string> }[];
    contactItems?: { id: string, label: string, value: string, type: string, icon?: string, translations?: Record<string, string> }[];
    socialItems?: { id: string, url: string, type: string, icon?: string }[];
    bottomLinks?: FooterLink[];
    logo?: string;
    copyright: MultilingualText;
    translations?: Record<string, {
      subFooterText?: string;
    }>;
    modified?: string;
  };
}

// AI Service Types
export interface AIThemeRequest {
  prompt: string;
  currentConfig?: ThemeConfig;
}

/** Reusable section template stored in the Templates SharePoint list. */
export interface SectionTemplate {
  id: string;
  title: string;
  description?: string;
  containerType: ContainerType;
  status: 'Draft' | 'Published';
  settings: Record<string, unknown>;
  content: Record<string, unknown>;
  /** Field keys Site Admins may edit when using this template (`null` = legacy default grants). */
  editableFields?: string[] | null;
  sortOrder?: number;
  createdBy?: string;
  modifiedBy?: string;
  createdDate?: string;
  modifiedDate?: string;
}

/** Global site theme template (CSS variables + header/layout styling). */
export interface ThemeTemplate {
  id: string;
  title: string;
  themeConfig: ThemeConfig;
  /** Header, typography, and layout fields from SiteConfig edited in the theme editor. */
  stylingConfig: Record<string, unknown>;
  status: 'Draft' | 'Published';
  createdBy?: string;
  modifiedBy?: string;
  createdDate?: string;
  modifiedDate?: string;
}

export type WebStudioUserRole = 'super_admin' | 'site_admin' | 'editor' | 'standard';
