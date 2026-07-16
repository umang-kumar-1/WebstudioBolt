const isBootstrapCdnUrl = (url: string): boolean => {
  const normalized = String(url || '').toLowerCase();
  return (
    normalized.includes('cdn.jsdelivr.net/npm/bootstrap') ||
    normalized.includes('stackpath.bootstrapcdn.com/bootstrap') ||
    normalized.includes('maxcdn.bootstrapcdn.com/bootstrap') ||
    normalized.includes('bootstrapcdn.com') ||
    (normalized.includes('bootstrap') && normalized.includes('cdn.jsdelivr.net'))
  );
};

export const removeBootstrapCdnAssets = (): void => {
  if (typeof document === 'undefined') return;

  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]')) as HTMLLinkElement[];
  links.forEach((link) => {
    if (isBootstrapCdnUrl(link.href)) {
      link.remove();
    }
  });

  const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
  scripts.forEach((script) => {
    if (isBootstrapCdnUrl(script.src)) {
      script.remove();
    }
  });
};

export const startBootstrapCdnBlocker = (): MutationObserver | null => {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return null;

  removeBootstrapCdnAssets();
  const observer = new MutationObserver(() => removeBootstrapCdnAssets());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return observer;
};

export const stopBootstrapCdnBlocker = (observer: MutationObserver | null): MutationObserver | null => {
  if (observer) observer.disconnect();
  return null;
};
