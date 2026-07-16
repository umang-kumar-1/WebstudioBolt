/** Base name of the default image in the Images library (any extension: default.png, default.jpg, …). */
export const DEFAULT_IMAGE_BASE_NAME = 'default';

export type DefaultImageCandidate = { name?: string; url?: string };

/** Strip path/query and return lowercase filename stem (no extension). */
export function getImageFileStem(fileName: string): string {
  const base = (fileName.split('?')[0].split('/').pop() || fileName).trim();
  const dot = base.lastIndexOf('.');
  return (dot > 0 ? base.slice(0, dot) : base).toLowerCase();
}

/** True when the file is a default placeholder (default.png, default.jpg, default.webp, …). */
export function isDefaultImageFileName(fileName: string): boolean {
  return getImageFileStem(fileName) === DEFAULT_IMAGE_BASE_NAME;
}

const isRootImagesLibraryFile = (url: string): boolean => {
  try {
    const normalized = decodeURIComponent(url).toLowerCase();
    const idx = normalized.indexOf('/images/');
    if (idx < 0) return true;
    const afterLibrary = normalized.slice(idx + '/images/'.length);
    return !afterLibrary.includes('/');
  } catch {
    return false;
  }
};

/** Resolve default.* from a loaded Images library list (prefers root folder). */
export function resolveDefaultImageUrl(images: DefaultImageCandidate[]): string {
  const matches = images.filter((img) => {
    if (isDefaultImageFileName(img.name || '')) return true;
    const urlName = img.url?.split('/').pop()?.split('?')[0] || '';
    return isDefaultImageFileName(urlName);
  });
  if (matches.length === 0) return '';

  const rootMatch = matches.find((img) => isRootImagesLibraryFile(img.url || ''));
  return (rootMatch || matches[0]).url || '';
}

/** Gallery lookup for default.* in the Images library (prefers root folder). */
export function resolveGalleryDefaultImage(
  images: DefaultImageCandidate[]
): { url: string; name: string } | undefined {
  const defaultUrl = resolveDefaultImageUrl(images);
  if (!defaultUrl) return undefined;

  const defaultMatch = images.find((img) => img.url === defaultUrl);
  const name =
    defaultMatch?.name ||
    defaultUrl.split('/').pop()?.split('?')[0] ||
    DEFAULT_IMAGE_BASE_NAME;
  return { url: defaultUrl, name };
}

/** @deprecated Use resolveGalleryDefaultImage */
export function resolveGalleryDefaultLogo(
  images: DefaultImageCandidate[]
): { url: string; name: string } | undefined {
  return resolveGalleryDefaultImage(images);
}
