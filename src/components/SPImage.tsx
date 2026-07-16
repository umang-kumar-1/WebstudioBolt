import React, { forwardRef } from 'react';
import { useAuthenticatedUrl } from '../lib/graph/useAuthenticatedUrl';

type SPImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

/**
 * Drop-in replacement for <img> that transparently loads SharePoint-hosted images using the
 * signed-in user's Microsoft Graph token (required since the app no longer runs inside the
 * SharePoint page and can't rely on ambient session cookies). Non-SharePoint sources
 * (bundled assets, external URLs) render exactly like a normal <img>. Forwards `ref` so it
 * remains a true drop-in replacement for callers (e.g. react-image-crop) that need the DOM node.
 */
export const SPImage = forwardRef<HTMLImageElement, SPImageProps>(({ src, ...rest }, ref) => {
  const { resolvedUrl, loading } = useAuthenticatedUrl(src);
  if (loading) {
    return <div className={rest.className} style={{ ...(rest.style || {}), background: 'rgba(0,0,0,0.04)' }} aria-busy="true" />;
  }
  // eslint-disable-next-line jsx-a11y/alt-text
  return <img ref={ref} src={resolvedUrl} {...rest} />;
});
SPImage.displayName = 'SPImage';

export default SPImage;
