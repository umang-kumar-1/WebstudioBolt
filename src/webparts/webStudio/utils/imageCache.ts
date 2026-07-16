export const withImageCacheBust = (url?: string, token?: string | number) => {
    if (!url) return '';
    const safeToken = token ?? Date.now();
    return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(safeToken))}`;
};
