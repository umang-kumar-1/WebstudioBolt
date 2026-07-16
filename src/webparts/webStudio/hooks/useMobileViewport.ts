import { useEffect, useState } from 'react';

const MOBILE_MAX = '(max-width: 767px)';

export function useMobileViewport(): boolean {
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(MOBILE_MAX).matches;
    });

    useEffect(() => {
        const mq = window.matchMedia(MOBILE_MAX);
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    return isMobile;
}
