import type { CSSProperties } from 'react';

export const resolveCardGapRem = (spacing?: string): number => {
    if (spacing === 'compact') return 1;
    if (spacing === 'wide') return 3;
    return 2;
};

/** Width of one slider card so exactly `cols` fit with gaps between them. */
export const resolveSliderCardWidth = (cols: number, spacing?: string): string => {
    const gapRem = resolveCardGapRem(spacing);
    if (cols <= 1) return '100%';
    return `calc((100% - ${(cols - 1) * gapRem}rem) / ${cols})`;
};

/** Grid / slider gap via inline styles — SPFx Tailwind bundle lacks many gap-x/gap-y utilities. */
export const resolveCardGridGapStyle = (options: {
    useFlatBrowseList: boolean;
    isSlider: boolean;
    useOldCardLayout?: boolean;
    spacing?: string;
}): CSSProperties => {
    const { useFlatBrowseList, isSlider, useOldCardLayout, spacing } = options;
    if (useFlatBrowseList) return {};

    if (isSlider) {
        const gapRem = resolveCardGapRem(spacing);
        return { columnGap: `${gapRem}rem` };
    }

    if (useOldCardLayout) {
        return { columnGap: '1rem', rowGap: '4rem' };
    }
    if (spacing === 'compact') {
        return { columnGap: '1rem', rowGap: '1.5rem' };
    }
    if (spacing === 'wide') {
        return { columnGap: '3rem', rowGap: '4rem' };
    }
    return { columnGap: '2rem', rowGap: '3rem' };
};
