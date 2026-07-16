/**
 * Contact form & CAPTCHA API configuration.
 * Override via build-time env where supported (WebStudioPreview uses Vite).
 */
const trimSlash = (url: string) => url.replace(/\/+$/, '');

/** Default PHP API root for public contact form / CAPTCHA endpoints. */
const defaultApiRoot = 'https://staging.hochhuth-consulting.de/PHPAPISHAREPOINT';

const apiRoot = trimSlash(defaultApiRoot);

export const contactApiConfig = {
  apiRoot,
  contactFormUrl: `${apiRoot}/ContactForm.php`,
  captchaUrl: `${apiRoot}/Captcha.php`,
} as const;

export const buildCaptchaImageUrl = (captchaId: string, baseUrl: string = contactApiConfig.captchaUrl): string => {
  const url = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  url.searchParams.set('id', captchaId);
  url.searchParams.set('format', 'svg');
  url.searchParams.set('_', String(Date.now()));
  return url.toString();
};
