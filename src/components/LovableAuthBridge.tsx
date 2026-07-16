import { useMsal } from '@azure/msal-react';
import { useEffect, useState } from 'react';

import {
  isFromEditorStandaloneAuth,
  notifyEditorAuthComplete,
  shouldListenForEditorAuthReturn,
  subscribeEditorAuthComplete,
  tryCloseStandaloneAuthTab,
} from '../lib/auth/lovableAuthBridge';

/** Returns the editor iframe to a signed-in state after standalone-tab login. */
export const LovableEditorAuthListener = () => {
  useEffect(() => {
    if (!shouldListenForEditorAuthReturn()) return;
    return subscribeEditorAuthComplete(() => {
      console.log('[Auth] standalone sign-in complete — reloading editor preview');
      window.location.reload();
    });
  }, []);

  return null;
};

/** Closes the standalone sign-in tab and notifies the editor opener. */
export const StandaloneAuthReturnHandler = () => {
  const { accounts } = useMsal();
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!isFromEditorStandaloneAuth()) return;
    if (accounts.length === 0) return;

    setClosing(true);
    notifyEditorAuthComplete();

    const timer = window.setTimeout(() => {
      tryCloseStandaloneAuthTab();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [accounts.length]);

  if (!closing) return null;

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-white/95 p-6">
      <div className="max-w-md rounded-xl border border-green-200 bg-green-50 p-6 text-center shadow-lg">
        <p className="text-lg font-bold text-green-900">Sign-in complete</p>
        <p className="mt-2 text-sm text-green-800">
          Returning to the Lovable editor… If this tab does not close automatically, switch back to the editor tab and
          refresh.
        </p>
      </div>
    </div>
  );
};
