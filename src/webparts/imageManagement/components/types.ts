/** Images at the picture library root (not in a subfolder) use this folder id. */
export const ROOT_FOLDER_ID = 0;

export interface Folder {
  id: number;
  name: string;
  serverRelativeUrl?: string;
}

export interface Image {
  id: number;
  folderId: number;
  src: string;
  name: string;
  title: string;
  description: string;
  altText?: string;
  copyright?: string;
  keywords?: string;
  created?: string;
  modified?: string;
  modifiedDate?: string;
  author?: string;
  editor?: string;
  uniqueId?: string;
  authorId?: number;
  editorId?: number;
  /** 0–100: 100 = original library size, 0 = toward 1 MB. */
  imageCompression?: number;
  /** Reference byte size at 100% (first upload / library original). */
  originalFileSizeBytes?: number;
  /** Current file size in the picture library. */
  fileSizeBytes?: number;
  width?: number;
  height?: number;
}

export enum FilterType {
  NONE = 'none',
  GRAYSCALE = 'grayscale(100%)',
  SEPIA = 'sepia(100%)',
  INVERT = 'invert(100%)',
  BLUR = 'blur(5px)',
}

export interface Dimensions {
  width: number;
  height: number;
}
