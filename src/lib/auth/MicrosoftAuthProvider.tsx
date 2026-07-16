import { MsalProvider } from '@azure/msal-react';
import { useEffect, useState, type ReactNode } from 'react';

import { clearStaleMsalInteractionStatus, isMsalConfigured, isRunningInPopup } from './msalConfig';
import { getMsalInstance } from './msalInstance';
import { TokenBridgeRegistration } from './tokenBridgeRegistration';

interface MicrosoftAuthProviderProps {
  children: ReactNode;
}

export const MicrosoftAuthProvider = ({ children }: MicrosoftAuthProviderProps) => {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isMsalConfigured()) {
      setReady(true);
      return;
    }

    let cancelled = false;
    const instance = getMsalInstance();
    clearStaleMsalInteractionStatus();

    const activateCachedAccount = () => {
      const cached = instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null;
      if (cached) instance.setActiveAccount(cached);
    };

    instance
      .initialize()
      .then(async () => {
        console.log('[MSAL] initialized. URL:', window.location.href);
        if (isRunningInPopup()) {
          console.log('[MSAL] running in popup — skipping handleRedirectPromise');
          return null;
        }
        const result = await instance.handleRedirectPromise();
        console.log('[MSAL] handleRedirectPromise result:', result);
        return result;
      })
      .then((result) => {
        if (cancelled) return;
        if (result?.account) {
          console.log('[MSAL] active account set from redirect:', result.account.username);
          instance.setActiveAccount(result.account);
          window.sessionStorage.removeItem('msal.autologin.started');
          return;
        }
        const accounts = instance.getAllAccounts();
        console.log('[MSAL] existing accounts:', accounts.map((a) => a.username));
        if (accounts.length > 0) {
          instance.setActiveAccount(accounts[0]);
          window.sessionStorage.removeItem('msal.autologin.started');
        }
      })
      .catch((err) => {
        console.error('MSAL initialize/redirect failed:', err);
        const errorCode = typeof err === 'object' && err !== null && 'errorCode' in err ? String(err.errorCode) : '';
        if (!cancelled && errorCode !== 'no_token_request_cache_error') {
          setInitError(err instanceof Error ? err.message : String(err));
        }
        activateCachedAccount();
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-600">
        Completing sign-in…
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-red-50 p-6 text-sm text-red-800">
        <p>Sign-in failed to initialize: {initError}</p>
      </div>
    );
  }

  if (!isMsalConfigured()) {
    return <>{children}</>;
  }

  return (
    <MsalProvider instance={getMsalInstance()}>
      <TokenBridgeRegistration />
      {children}
    </MsalProvider>
  );
};
