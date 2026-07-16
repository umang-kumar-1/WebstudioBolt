/** Normalize data-grid source labels used across editors and preview. */
export const normalizeDataGridSource = (source?: string): string | undefined => {
    if (!source) return undefined;
    if (source === 'Contacts') return 'Contact';
    if (source === 'SmartPages') return 'Smart Pages';
    return source;
};

const ITEM_CARD_SOURCES = new Set(['News', 'Event', 'Document', 'Container Items', 'Contact', 'ImageSlider', 'Smart Pages']);

export const isSmartPagesSource = (source?: string): boolean => normalizeDataGridSource(source) === 'Smart Pages';

export const isItemCardSource = (source?: string): boolean => {
    const normalized = normalizeDataGridSource(source);
    return !!normalized && ITEM_CARD_SOURCES.has(normalized);
};
