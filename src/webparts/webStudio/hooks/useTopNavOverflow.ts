import { useCallback, useEffect, useState, type RefObject } from 'react';

const MOBILE_MAX = '(max-width: 767px)';

function getLogoContentWidth(header: HTMLElement): number {
    const logoWrap = header.querySelector('.ws-header-logo-wrap');
    if (!logoWrap) {
        const fallback = header.querySelector('.ws-header-top-row > div:first-child, .ws-header-inner > div:first-child');
        return fallback?.getBoundingClientRect().width ?? 0;
    }

    const img = logoWrap.querySelector('img');
    if (img) {
        return img.getBoundingClientRect().width + 8;
    }

    let width = 0;
    logoWrap.querySelectorAll('.header-logo-text').forEach((el) => {
        width += el.getBoundingClientRect().width;
    });
    if (width > 0) return width + 8;

    const first = logoWrap.querySelector(':scope > div') as HTMLElement | null;
    return first?.getBoundingClientRect().width ?? 0;
}

function getLangWidth(header: HTMLElement): number {
    const langEl =
        header.querySelector('.ws-top-nav-lang-desktop') ||
        header.querySelector('.ws-top-nav-lang-tablet') ||
        header.querySelector('.ws-top-nav-below-logo-row .flex-shrink-0');
    return langEl?.getBoundingClientRect().width ?? 0;
}

/**
 * On tablet/desktop viewports, returns true when root nav items do not fit in the
 * header row — caller should switch to the hamburger menu.
 */
export function useTopNavOverflow(
    headerRef: RefObject<HTMLElement | null>,
    navPosition: string,
    itemCount: number,
    deps: unknown[] = []
): boolean {
    const [navOverflows, setNavOverflows] = useState(false);

    const measure = useCallback(() => {
        if (typeof window === 'undefined') return;

        if (window.matchMedia(MOBILE_MAX).matches || itemCount === 0) {
            setNavOverflows(false);
            return;
        }

        const header = headerRef.current;
        if (!header) return;

        const measureNav = header.querySelector('.ws-top-nav-measure-slot .ws-top-nav-bar') as HTMLElement | null;
        if (!measureNav) {
            setNavOverflows(false);
            return;
        }

        const neededWidth = measureNav.scrollWidth;
        if (neededWidth <= 0) {
            setNavOverflows(false);
            return;
        }

        const visibleHost = header.querySelector(
            '.ws-top-nav-desktop-wrap .ws-top-nav-scroll-host, .ws-top-nav-below-logo-row .ws-top-nav-scroll-host'
        ) as HTMLElement | null;
        const visibleBar = visibleHost?.querySelector('.ws-top-nav-bar') as HTMLElement | null;
        if (visibleHost && visibleHost.clientWidth > 0 && visibleBar) {
            setNavOverflows(visibleBar.scrollWidth > visibleHost.clientWidth + 2);
            return;
        }

        const topRow = header.querySelector('.ws-header-top-row') as HTMLElement | null;
        const topWidth = topRow?.clientWidth ?? header.clientWidth;
        const langWidth = getLangWidth(header);
        const logoContentWidth = getLogoContentWidth(header);
        let availableWidth = 0;

        if (navPosition === 'below_logo') {
            const inner = header.querySelector('.ws-top-nav-below-logo-row .ws-header-inner') as HTMLElement | null;
            if (inner && inner.clientWidth > 0) {
                availableWidth = Math.max(0, inner.clientWidth - langWidth - 16);
            } else {
                availableWidth = Math.max(0, topWidth - langWidth - 24);
            }
        } else if (navPosition === 'near_logo') {
            const nearWrap = header.querySelector('.ws-top-nav-desktop-wrap.ws-near-logo') as HTMLElement | null;
            if (nearWrap && nearWrap.clientWidth > 0) {
                availableWidth = nearWrap.clientWidth;
            } else {
                const actions = header.querySelector('.ws-header-actions') as HTMLElement | null;
                const actionsWidth = actions?.getBoundingClientRect().width ?? langWidth + 16;
                availableWidth = Math.max(0, topWidth - logoContentWidth - actionsWidth - 16);
            }
        } else {
            availableWidth = Math.max(0, topWidth - logoContentWidth - langWidth - 24);
        }

        setNavOverflows(neededWidth > availableWidth + 2);
    }, [headerRef, navPosition, itemCount]);

    useEffect(() => {
        const run = () => requestAnimationFrame(() => requestAnimationFrame(measure));

        run();

        const header = headerRef.current;
        if (!header) return;

        const ro = new ResizeObserver(run);
        ro.observe(header);

        const mobileMq = window.matchMedia(MOBILE_MAX);
        mobileMq.addEventListener('change', run);
        window.addEventListener('resize', run);

        return () => {
            ro.disconnect();
            mobileMq.removeEventListener('change', run);
            window.removeEventListener('resize', run);
        };
    }, [measure, headerRef, ...deps]);

    return navOverflows;
}
