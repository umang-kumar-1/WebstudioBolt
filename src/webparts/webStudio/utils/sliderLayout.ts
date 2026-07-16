import { SliderItem } from '../types';

/** Slide layout ids — must not appear as visible subtitle/copy text. */
export const SLIDER_LAYOUT_IDS = [
    'text_overlay',
    'split_left_img',
    'split_right_img',
    'solid_color',
] as const;

export type SliderLayoutId = (typeof SLIDER_LAYOUT_IDS)[number];

/** Split slider: text panel 60%, image frame 40%. */
export const SLIDER_SPLIT_TEXT_WIDTH = '60%';
export const SLIDER_SPLIT_MEDIA_WIDTH = '40%';

export function isSliderSplitLayout(layout?: string | null): boolean {
    return layout === 'split_left_img' || layout === 'split_right_img';
}

export function getSliderSplitMediaClassName(layout?: string | null, objectCover = true): string {
    if (!isSliderSplitLayout(layout)) {
        return `absolute inset-0 w-full h-full${objectCover ? ' object-cover' : ''}`;
    }
    const imageOnRight = layout === 'split_right_img' ? ' ws-slider-split-media--img-right' : '';
    return `absolute top-0 bottom-0 h-full ws-slider-split-media${imageOnRight}${objectCover ? ' object-cover' : ''}`;
}

export function getSliderSplitPlaceholderClassName(layout?: string | null): string {
    if (!isSliderSplitLayout(layout)) {
        return 'absolute inset-0 w-full h-full bg-gray-800';
    }
    const imageOnRight = layout === 'split_right_img' ? ' ws-slider-split-media--img-right' : '';
    return `absolute top-0 bottom-0 h-full bg-gray-800 ws-slider-split-media${imageOnRight}`;
}

export function isSliderLayoutToken(value: unknown): value is SliderLayoutId {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    return (SLIDER_LAYOUT_IDS as readonly string[]).includes(trimmed);
}

/** Strip legacy layout values mistakenly stored in subtitle/subheading fields. */
export function sanitizeSliderSubtitleForDisplay(value: string): string {
    if (!value) return '';
    const trimmed = value.trim();
    return isSliderLayoutToken(trimmed) ? '' : value;
}

/** Build ordered display items for image/text sliders — merges SharePoint items with local slide metadata. */
export const buildImageTextSliderDisplayItems = (
    settings: { taggedItems?: unknown[]; slides?: unknown[] } | null | undefined,
    sliderItems: SliderItem[]
): SliderItem[] => {
    const taggedIds = (settings?.taggedItems || []).map((id) => String(id));
    const slidesMeta = (settings?.slides || []) as Array<Record<string, unknown>>;
    const order = taggedIds.length > 0
        ? taggedIds
        : slidesMeta.map((slide) => String(slide.id));

    return order.map((id) => {
        const spItem = sliderItems.find((item) => String(item.id) === id);
        if (spItem) return spItem;

        const meta = slidesMeta.find((slide) => String(slide.id) === id);
        if (!meta) return null;

        const title = String(meta.title || 'New Slide');
        return {
            id,
            title,
            subtitle: String(meta.subtitle || ''),
            description: String(meta.desc || meta.description || ''),
            status: 'Draft' as const,
            sortOrder: 0,
            ctaText: String(meta.cta || ''),
            ctaUrl: String(meta.url || ''),
            imageUrl: String(meta.image || meta.img || ''),
            imageName: String(meta.imageName || ''),
            itemType: 'img_text',
            translations: (meta.translations as SliderItem['translations']) || {
                en: {
                    title,
                    subtitle: String(meta.subtitle || ''),
                    description: String(meta.desc || meta.description || ''),
                    ctaText: String(meta.cta || ''),
                },
            },
        };
    }).filter(Boolean) as SliderItem[];
};

export const DEFAULT_SLIDE_ADJUSTMENTS = {
    zoom: 1,
    rotate: 0,
    brightness: 100,
    contrast: 100,
};

export interface EffectiveSlideDesign {
    layout: string;
    imageHeightMode: string;
    imageCustomHeight: string;
    adjustments: typeof DEFAULT_SLIDE_ADJUSTMENTS;
}

/** Merge template-level slide design defaults with per-slide overrides. */
export const resolveEffectiveSlideDesign = (
    slide: Record<string, unknown> | null | undefined,
    containerSettings: Record<string, unknown> | null | undefined,
    options: { preferTemplateDefaults?: boolean } = {}
): EffectiveSlideDesign => {
    const preferTemplate = options.preferTemplateDefaults !== false;
    const templateLayout = containerSettings?.defaultSlideLayout;
    const templateHeight = containerSettings?.slideImageHeightMode;
    const templateCustomHeight = containerSettings?.slideImageCustomHeight;
    const templateAdjustments = containerSettings?.slideImageAdjustments as Partial<typeof DEFAULT_SLIDE_ADJUSTMENTS> | undefined;

    const slideLayout = slide?.layout ? String(slide.layout) : '';
    const layout = preferTemplate && templateLayout
        ? String(templateLayout)
        : (slideLayout || (templateLayout ? String(templateLayout) : 'text_overlay'));

    const imageHeightMode = preferTemplate && templateHeight
        ? String(templateHeight)
        : String(slide?.imageHeightMode || templateHeight || 'default');

    const imageCustomHeight = preferTemplate && templateCustomHeight !== undefined
        ? String(templateCustomHeight || '')
        : String(slide?.imageCustomHeight ?? templateCustomHeight ?? '');

    const slideAdjustments = (slide?.adjustments || {}) as Partial<typeof DEFAULT_SLIDE_ADJUSTMENTS>;
    const adjustments = preferTemplate && templateAdjustments
        ? { ...DEFAULT_SLIDE_ADJUSTMENTS, ...templateAdjustments }
        : { ...DEFAULT_SLIDE_ADJUSTMENTS, ...templateAdjustments, ...slideAdjustments };

    return { layout, imageHeightMode, imageCustomHeight, adjustments };
};

export const createImageTextSlideEntry = (
    id: string,
    title: string,
    templateSettings?: Record<string, unknown> | null
) => {
    const design = resolveEffectiveSlideDesign(null, templateSettings || undefined, { preferTemplateDefaults: true });
    return {
        id,
        title,
        subtitle: '',
        desc: '',
        image: '',
        imageName: '',
        cta: '',
        layout: design.layout,
        url: '',
        imageHeightMode: design.imageHeightMode,
        imageCustomHeight: design.imageCustomHeight,
        adjustments: { ...design.adjustments },
    };
};
