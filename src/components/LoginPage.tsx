import { useMsal } from '@azure/msal-react';
import { LogIn } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { setAuthError } from '../lib/auth/authErrorStore';
import {
  clearStaleMsalInteractionStatus,
  getMsalPopupRedirectUri,
  getMsalRuntimeDiagnostics,
  getStandaloneSignInUrl,
  hasMsalInteractionInProgress,
  isLovableEditorEmbed,
  shouldPreferNewTabSignIn,
  shouldUsePopupInteraction,
} from '../lib/auth/msalConfig';
import { getLoginRequestScopes } from '../lib/auth/scopes';

interface LoginPageProps {
  authError?: string | null;
}

const AUTOLOGIN_FLAG = 'msal.autologin.started';

export const LoginPage = ({ authError }: LoginPageProps) => {
  const { instance, inProgress } = useMsal();
  const diagnostics = getMsalRuntimeDiagnostics();
  const autoStartedRef = useRef(false);
  const preferNewTab = shouldPreferNewTabSignIn();
  const standaloneSignInUrl = getStandaloneSignInUrl();

  const handleLogin = async () => {
    if (isLovableEditorEmbed()) {
      setAuthError(
        'Microsoft sign-in does not work inside the Lovable editor preview. Click "Open in new tab" below.',
      );
      return;
    }

    setAuthError(null);

    try {
      clearStaleMsalInteractionStatus();
      const scopes = getLoginRequestScopes();
      if (shouldUsePopupInteraction()) {
        const redirectUri = getMsalPopupRedirectUri();
        console.log('[MSAL] loginPopup called. redirectUri:', redirectUri);
        const result = await instance.loginPopup({ scopes, redirectUri });
        if (result?.account) instance.setActiveAccount(result.account);
      } else {
        const redirectUri = window.location.origin;
        console.log('[MSAL] loginRedirect called. URL:', window.location.href, 'redirectUri:', redirectUri);
        window.sessionStorage.setItem(AUTOLOGIN_FLAG, '1');
        await instance.loginRedirect({ scopes, redirectUri });
      }
    } catch (err) {
      window.sessionStorage.removeItem(AUTOLOGIN_FLAG);
      console.error('Login failed:', err);
      setAuthError(err instanceof Error ? err.message : String(err));
    }
  };

  // Auto-start loginRedirect in standalone/new-tab mode only.
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (isLovableEditorEmbed()) return;
    if (inProgress !== 'none') return;
    if (instance.getActiveAccount() || instance.getAllAccounts().length > 0) return;
    if (hasMsalInteractionInProgress()) return;
    if (window.sessionStorage.getItem(AUTOLOGIN_FLAG) === '1') return;
    autoStartedRef.current = true;
    console.log('[MSAL] auto-starting loginRedirect (standalone mode)');
    void handleLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress]);

  const openInNewTab = () => {
    const opened = window.open(standaloneSignInUrl, '_blank');
    if (!opened) {
      setAuthError('Popup blocked. Copy the sign-in link below and paste it into a new browser tab.');
    }
  };

  const copySignInLink = async () => {
    try {
      await navigator.clipboard.writeText(standaloneSignInUrl);
      setAuthError(null);
    } catch {
      setAuthError('Could not copy link. Select and copy the URL shown below manually.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <div className="rounded-lg bg-[var(--brand-light,#eff6ff)] p-4 text-[var(--primary-color,#2563eb)]">
            <LogIn className="h-10 w-10" />
          </div>
        </div>
        <h1 className="text-center text-2xl font-bold text-gray-900">Web Studio Enterprise CMS</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Sign in with your Microsoft work account to access this site.
        </p>
        {preferNewTab ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            You are inside the Lovable editor preview. Sign in opens a new tab on the same preview URL — after
            Microsoft login you will return to the editor automatically.
          </p>
        ) : null}
        <div className="mt-5 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
          {preferNewTab ? (
            <>
              <p className="font-bold text-gray-900">Sign-in link (same preview origin — opens in new tab)</p>
              <code className="mt-2 block break-all rounded-sm bg-white p-2 text-[11px] text-gray-800">
                {standaloneSignInUrl}
              </code>
              <p className="mt-3 font-bold text-gray-900">Azure Redirect URI to add</p>
              <code className="mt-2 block break-all rounded-sm bg-white p-2 text-[11px] text-gray-800">
                {diagnostics.requiredAzureRedirectUri}
              </code>
            </>
          ) : (
            <>
              <p className="font-bold text-gray-900">Azure Redirect URI to add</p>
              <code className="mt-2 block break-all rounded-sm bg-white p-2 text-[11px] text-gray-800">
                {diagnostics.requiredAzureRedirectUri}
              </code>
            </>
          )}
          <dl className="mt-3 space-y-1">
            <div className="flex justify-between gap-3">
              <dt>Current origin</dt>
              <dd className="break-all text-right font-semibold">{diagnostics.currentOrigin}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>MSAL flow</dt>
              <dd className="font-semibold">{diagnostics.loginMethod}</dd>
            </div>
          </dl>
          {!preferNewTab && shouldUsePopupInteraction() ? (
            <div className="mt-3 border-t border-gray-200 pt-3">
              <p className="font-bold text-gray-900">Also add for popup sign-in</p>
              <code className="mt-2 block break-all rounded-sm bg-white p-2 text-[11px] text-gray-800">
                {diagnostics.popupAzureRedirectUri}
              </code>
            </div>
          ) : null}
        </div>
        {authError ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 break-words">
            {authError}
          </p>
        ) : null}
        {preferNewTab ? (
          <>
            <button
              type="button"
              onClick={openInNewTab}
              className="mt-6 w-full rounded-sm bg-[var(--btn-primary-bg,#2563eb)] px-4 py-3 text-sm font-bold text-white hover:opacity-90"
            >
              Open in new tab to sign in
            </button>
            <button
              type="button"
              onClick={() => void copySignInLink()}
              className="mt-3 w-full rounded-sm border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Copy sign-in link
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void handleLogin()}
            className="mt-6 w-full rounded-sm bg-[var(--btn-primary-bg,#2563eb)] px-4 py-3 text-sm font-bold text-white hover:opacity-90"
          >
            Sign in with Microsoft
          </button>
        )}
      </div>
    </div>
  );
};
