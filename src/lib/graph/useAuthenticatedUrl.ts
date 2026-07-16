import { useEffect, useState } from 'react';
import { resolveAuthenticatedUrl, isSharePointUrl } from './authenticatedContent';

/**
 * Resolves a (possibly SharePoint-hosted) URL into something a plain <img>/<a> tag can use.
 * SharePoint URLs are fetched via Microsoft Graph with the user's bearer token and turned into
 * a blob: object URL; anything else (bundled assets, external URLs, data/blob URIs) is returned as-is.
 */
export const useAuthenticatedUrl = (url: string | null | undefined): { resolvedUrl: string; loading: boolean; error: boolean } => {
  const [resolvedUrl, setResolvedUrl] = useState<string>(!url || !isSharePointUrl(url) ? url || '' : '');
  const [loading, setLoading] = useState<boolean>(!!url && isSharePointUrl(url));
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    if (!url) {
      setResolvedUrl('');
      setLoading(false);
      setError(false);
      return;
    }

    if (!isSharePointUrl(url)) {
      setResolvedUrl(url);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);
    resolveAuthenticatedUrl(url)
      .then((resolved) => {
        if (!cancelled) {
          setResolvedUrl(resolved);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load authenticated SharePoint content', err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { resolvedUrl, loading, error };
};
