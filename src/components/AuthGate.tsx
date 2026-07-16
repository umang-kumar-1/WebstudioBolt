import { useMsal } from '@azure/msal-react';
import { useEffect, useState, type ReactNode } from 'react';

import { isMsalConfigured } from '../lib/auth/msalConfig';
import { subscribeAuthError } from '../lib/auth/authErrorStore';
import { LovableEditorAuthListener, StandaloneAuthReturnHandler } from './LovableAuthBridge';
import { LoginPage } from './LoginPage';

interface AuthGateProps {
  children: ReactNode;
}

export const AuthGate = ({ children }: AuthGateProps) => {
  const { instance, accounts, inProgress } = useMsal();
  const [authError, setLocalAuthError] = useState<string | null>(null);

  useEffect(() => subscribeAuthError(setLocalAuthError), []);

  useEffect(() => {
    const cached = instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? accounts[0] ?? null;
    if (cached) instance.setActiveAccount(cached);
  }, [instance, accounts]);

  if (!isMsalConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-red-50 p-6 text-sm text-red-800">
        <p>
          Sign-in is not configured. Set <code>VITE_AZURE_TENANT_ID</code> and{' '}
          <code>VITE_AZURE_CLIENT_ID</code> in <code>.env</code>.
        </p>
      </div>
    );
  }

  if (inProgress === 'startup' || inProgress === 'handleRedirect') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-600">
        Completing sign-in…
      </div>
    );
  }

  const activeAccount = instance.getActiveAccount() ?? accounts[0] ?? null;
  if (!activeAccount) {
    return (
      <>
        <LovableEditorAuthListener />
        <LoginPage authError={authError} />
      </>
    );
  }

  return (
    <>
      <StandaloneAuthReturnHandler />
      {children}
    </>
  );
};
