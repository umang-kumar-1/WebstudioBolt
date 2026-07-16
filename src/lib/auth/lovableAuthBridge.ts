import { isLovableEditorEmbed, isStandaloneAuthMode } from './msalConfig';

export const LOVABLE_AUTH_MESSAGE_TYPE = 'webstudio-msal-auth-complete';

const FROM_EDITOR_PARAM = 'fromEditor';

export const isFromEditorStandaloneAuth = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    isStandaloneAuthMode() && new URLSearchParams(window.location.search).get(FROM_EDITOR_PARAM) === '1'
  );
};

export const notifyEditorAuthComplete = (): void => {
  if (typeof window === 'undefined' || !window.opener) return;
  try {
    window.opener.postMessage({ type: LOVABLE_AUTH_MESSAGE_TYPE }, window.location.origin);
  } catch (error) {
    console.warn('[Auth] could not notify editor opener:', error);
  }
};

export const tryCloseStandaloneAuthTab = (): boolean => {
  if (typeof window === 'undefined') return false;
  window.close();
  return false;
};

export const subscribeEditorAuthComplete = (onComplete: () => void): (() => void) => {
  const handler = (event: MessageEvent) => {
    if (event.data?.type !== LOVABLE_AUTH_MESSAGE_TYPE) return;
    if (event.origin !== window.location.origin) return;
    onComplete();
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
};

export const shouldListenForEditorAuthReturn = (): boolean => isLovableEditorEmbed();
