import { useEffect, useState } from 'react';

/** Match mobile nav breakpoint — based on preview pane width, not window. */
export const NARROW_PREVIEW_MAX_PX = 767;

export function useNarrowPreview(rootId = 'preview-main-scroll'): boolean {
    const [isNarrow, setIsNarrow] = useState(() => {
        if (typeof window === 'undefined') return false;
        const el = document.getElementById(rootId);
        return (el?.clientWidth ?? window.innerWidth) <= NARROW_PREVIEW_MAX_PX;
    });

    useEffect(() => {
        const el = document.getElementById(rootId);
        if (!el) return;

        const measure = () => {
            setIsNarrow(el.clientWidth <= NARROW_PREVIEW_MAX_PX);
        };

        measure();

        const ro = new ResizeObserver(() => {
            requestAnimationFrame(measure);
        });
        ro.observe(el);
        window.addEventListener('resize', measure);

        return () => {
            ro.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [rootId]);

    return isNarrow;
}
