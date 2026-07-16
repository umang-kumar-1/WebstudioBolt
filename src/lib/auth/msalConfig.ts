import type { Configuration } from '@azure/msal-browser';

const tenantId = (import.meta.env.VITE_AZURE_TENANT_ID as string | undefined)?.trim() || '';
const clientId = (import.meta.env.VITE_AZURE_CLIENT_ID as string | undefined)?.trim() || '';
const envRedirectUri = (import.meta.env.VITE_MSAL_REDIRECT_URI as string | undefined)?.trim() || '';

export const getCurrentOrigin = (): string => {
  if (typeof window !== 'undefined') return window.location.origin;
  return (import.meta.env.VITE_MSAL_REDIRECT_URI as string | undefined)?.trim() || 'http://localhost:8080';
};

/** Redirect URI must match the real app origin registered in Entra SPA redirect URIs. */
export const getMsalRedirectUri = (): string => {
  if (typeof window !== 'undefined') return window.location.origin;
  return envRedirectUri || 'http://localhost:8080'; 
};

export const getMsalPopupRedirectUri = (): string => `${getMsalRedirectUri()}/auth-popup.html`;

export const getMsalPopupRelayUri = (): string => `${getMsalRedirectUri()}/auth-relay.html`;

export const getEnvMsalRedirectUri = (): string => envRedirectUri;

export const isRunningInIframe = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export const isRunningInPopup = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.opener);
};

/** Lovable deploy/preview hosts use different origins than local dev. */
export const isLovableHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.endsWith('.lovable.app') || host.endsWith('.lovableproject.com');
};

/** Lovable editor preview (`id-preview--*.lovable.app`) — redirect is blocked by Microsoft in embedded contexts. */
export const isLovablePreviewHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.startsWith('id-preview--');
};

const STANDALONE_AUTH_PARAM = 'standalone';

/** Set when the user opened a top-level tab explicitly for sign-in (via ?standalone=1). */
export const isStandaloneAuthMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has(STANDALONE_AUTH_PARAM);
};

/** True when running inside the Lovable editor preview shell (iframe or id-preview host). */
export const isLovableEditorEmbed = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (isStandaloneAuthMode()) return false;
  if (isRunningInIframe()) return true;
  // id-preview--*.lovable.app is only served inside the Lovable editor preview.
  if (isLovablePreviewHost()) return true;
  return false;
};

export const isLovableEmbeddedPreview = (): boolean => isLovableEditorEmbed();

/** Prefer opening a standalone tab for sign-in (Lovable editor embed only). */
export const shouldPreferNewTabSignIn = (): boolean => isLovableEditorEmbed();

export const shouldUsePopupInteraction = (): boolean => {
  if (isRunningInPopup()) return false;
  if (isStandaloneAuthMode()) return false;
  // Popups and redirects are both blocked inside the Lovable editor — use a new tab instead.
  if (isLovableEditorEmbed()) return false;
  return isRunningInIframe();
};

/** URL for a top-level sign-in tab on the same origin as the editor preview (shared MSAL cache). */
export const getStandaloneSignInUrl = (): string => {
  if (typeof window === 'undefined') return '';
  const url = new URL(`${window.location.pathname}${window.location.search}${window.location.hash}`, window.location.origin);
  url.searchParams.set(STANDALONE_AUTH_PARAM, '1');
  url.searchParams.set('fromEditor', '1');
  return url.toString();
};

export const hasMsalAuthResponseInUrl = (): boolean => {
  if (typeof window === 'undefined') return false;
  const authParams = new URLSearchParams(window.location.hash.replace(/^#/, '') || window.location.search);
  return authParams.has('code') || authParams.has('error') || authParams.has('state');
};

export const hasMsalInteractionInProgress = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem('msal.interaction.status') !== null || window.localStorage.getItem('msal.interaction.status') !== null;
};

/** Clears an abandoned MSAL lock from a failed popup/redirect, but never while handling a real auth response. */
export const clearStaleMsalInteractionStatus = (): boolean => {
  if (typeof window === 'undefined' || hasMsalAuthResponseInUrl()) return false;
  if (!hasMsalInteractionInProgress()) return false;
  window.sessionStorage.removeItem('msal.interaction.status');
  window.localStorage.removeItem('msal.interaction.status');
  return true;
};

export const getMsalRuntimeDiagnostics = () => {
  const currentOrigin = getCurrentOrigin();
  const redirectUri = getMsalRedirectUri();
  const envRedirectUri = getEnvMsalRedirectUri();
  const inIframe = isRunningInIframe();
  const inPopup = isRunningInPopup();
  const lovableHost = isLovableHost();
  const lovablePreview = isLovablePreviewHost();
  const standaloneAuth = isStandaloneAuthMode();
  const lovableEditorEmbed = isLovableEditorEmbed();

  return {
    currentOrigin,
    requiredAzureRedirectUri: currentOrigin,
    popupAzureRedirectUri: getMsalPopupRedirectUri(),
    popupRelayUri: getMsalPopupRelayUri(),
    redirectUri,
    envRedirectUri,
    redirectMatchesCurrentOrigin: redirectUri === currentOrigin,
    interactionInProgress: hasMsalInteractionInProgress(),
    inIframe,
    inPopup,
    lovableHost,
    lovablePreview,
    standaloneAuth,
    lovableEditorEmbed,
    preferNewTabSignIn: shouldPreferNewTabSignIn(),
    loginMethod: shouldUsePopupInteraction() ? 'loginPopup()' : 'loginRedirect()',
  };
};

export const isMsalConfigured = (): boolean => Boolean(tenantId && clientId);

/** Built at runtime so redirect URIs and cache settings match the current browser context. */
export const buildMsalConfig = (): Configuration => {
  const inIframe = isRunningInIframe();
  // Lovable preview iframe + standalone tab share the same origin — use localStorage in both.
  const cacheLocation = inIframe && !isLovableHost() ? 'sessionStorage' : 'localStorage';

  return {
    auth: {
      clientId: clientId || '00000000-0000-0000-0000-000000000000',
      authority: tenantId
        ? `https://login.microsoftonline.com/${tenantId}`
        : 'https://login.microsoftonline.com/common',
      redirectUri: getMsalRedirectUri(),
      postLogoutRedirectUri: getMsalRedirectUri(),
      popupRelayUri: getMsalPopupRelayUri(),
    },
    cache: {
      cacheLocation,
    },
    system: {
      popupBridgeTimeout: 300_000, 
    },
  };
};
