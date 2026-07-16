/** Slider template concept — typography, tab window, and layout constants. */

export const SLIDER_CONCEPT_DESC_CLAMP_LINES = 7;
export const SLIDER_CONCEPT_VISIBLE_TAB_SLOTS = 3;
export const SLIDER_CONCEPT_TAB_GAP_PX = 24;

/** Shift tab strip so the active slide stays visible (concept: hide first tab when reaching item 4). */
export function getSliderTabWindowStart(
    currentIndex: number,
    totalTabs: number,
    visibleSlots: number = SLIDER_CONCEPT_VISIBLE_TAB_SLOTS
): number {
    if (totalTabs <= visibleSlots) return 0;
    const maxStart = totalTabs - visibleSlots;
    const start = Math.max(0, currentIndex - (visibleSlots - 1));
    return Math.min(start, maxStart);
}

export type SliderTabNavigationSource = 'tab' | 'navigate';

/**
 * Resolve the visible tab window when selecting a slide.
 * Tab clicks on the rightmost visible tab shift the strip left (revealing the next tab),
 * matching arrow-button behaviour.
 */
export function resolveGalleryTabWindowStart(
    targetIndex: number,
    currentWindowStart: number,
    totalTabs: number,
    visibleSlots: number = SLIDER_CONCEPT_VISIBLE_TAB_SLOTS,
    source: SliderTabNavigationSource = 'navigate'
): number {
    if (totalTabs <= visibleSlots) return 0;

    const maxStart = totalTabs - visibleSlots;

    if (source === 'navigate') {
        return getSliderTabWindowStart(targetIndex, totalTabs, visibleSlots);
    }

    const lastVisibleIdx = currentWindowStart + visibleSlots - 1;
    const firstVisibleIdx = currentWindowStart;

    if (targetIndex === lastVisibleIdx && targetIndex < totalTabs - 1) {
        return Math.min(currentWindowStart + 1, maxStart);
    }

    if (targetIndex === firstVisibleIdx && targetIndex > 0) {
        return Math.max(currentWindowStart - 1, 0);
    }

    if (targetIndex >= currentWindowStart && targetIndex <= lastVisibleIdx) {
        return currentWindowStart;
    }

    return getSliderTabWindowStart(targetIndex, totalTabs, visibleSlots);
}

export function buildSliderFontFamilyCss(sliderId: string): string {
    return `
        #${sliderId} .slider-container-title,
        #${sliderId} .slider-slide-title {
            font-family: var(--font-family-secondary, sans-serif) !important;
        }
        #${sliderId} .slider-container-subtitle,
        #${sliderId} .slider-container-desc,
        #${sliderId} .slider-container-desc *,
        #${sliderId} .slider-slide-desc,
        #${sliderId} .slider-slide-desc *,
        #${sliderId} .ws-slider-read-more,
        #${sliderId} .ws-slider-nav-tab,
        #${sliderId} .ws-slider-nav-tab__index,
        #${sliderId} .ws-slider-slide-counter {
            font-family: var(--font-family-base, sans-serif) !important;
        }
    `;
}

export function buildSliderConceptBaseCss(sliderId: string, isGalleryCarousel: boolean): string {
    if (!isGalleryCarousel) {
        return buildSliderFontFamilyCss(sliderId);
    }

    return `
        ${buildSliderFontFamilyCss(sliderId)}
        #${sliderId}.ws-gallery-carousel .slider-container-title {
            font-size: 32px;
            line-height: 44px;
            font-weight: 600;
            letter-spacing: 0;
        }
        #${sliderId}.ws-gallery-carousel .slider-container-subtitle {
            font-size: 18px;
            line-height: 24px;
            font-weight: 400;
            color: #555555;
        }
        #${sliderId}.ws-gallery-carousel .slider-slide-title {
            font-size: 20px;
            line-height: 24px;
            font-weight: 500;
            color: var(--primary-color);
            letter-spacing: 0;
        }
        #${sliderId}.ws-gallery-carousel .slider-slide-desc,
        #${sliderId}.ws-gallery-carousel .slider-slide-desc * {
            font-size: 16px;
            line-height: 24px;
            font-weight: 400;
            color: #333333;
        }
        #${sliderId}.ws-gallery-carousel .ws-slider-read-more {
            font-size: 16px;
            line-height: 24px;
            font-weight: 400;
            color: var(--primary-color);
        }
        #${sliderId}.ws-gallery-carousel .ws-slider-nav-tab {
            font-size: 13px;
            line-height: 17px;
            font-weight: 700;
            text-transform: uppercase;
            color: #777777;
        }
        #${sliderId}.ws-gallery-carousel .ws-slider-nav-tab--active {
            color: var(--primary-color);
        }
        #${sliderId}.ws-gallery-carousel .ws-slider-nav-tab__index {
            font-size: 18px;
            line-height: 26px;
            font-weight: 700;
            color: #DBDBDB;
            letter-spacing: 0;
        }
        #${sliderId}.ws-gallery-carousel .ws-slider-nav-tab--active .ws-slider-nav-tab__index {
            color: var(--primary-color);
        }
        #${sliderId}.ws-gallery-carousel .ws-slider-slide-counter {
            font-size: 13px;
            line-height: 17px;
            font-weight: 400;
            color: #777777;
        }
    `;
}
