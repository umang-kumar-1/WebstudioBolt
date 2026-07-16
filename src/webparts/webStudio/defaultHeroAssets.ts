import { useStore } from './store';

/**
 * Hero / template default image URLs — resolved from Images/default.* on the current site.
 * Populated when SharePoint data loads (see store.defaultImageUrl).
 */
export const getDefaultHeroBannerImageUrl = (): string => useStore.getState().defaultImageUrl || '';

/** @deprecated Use getDefaultHeroBannerImageUrl() for dynamic site URL. */
export const DEFAULT_HERO_BANNER_IMAGE_URL = '';

/** @deprecated Use getDefaultHeroBannerImageUrl() for dynamic site URL. */
export const DEFAULT_VISUAL_TEXT_IMAGE_URL = '';

/** @deprecated Use getGlobalDefaultImage() from store. */
export const DEFAULT_APP_IMAGE_URL = '';
