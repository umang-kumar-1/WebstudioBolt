import { useMsal } from '@azure/msal-react';

import { getMsalRedirectUri, shouldUsePopupInteraction } from '../lib/auth/msalConfig';

export const UserSessionBar = () => {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() ?? accounts[0];

  if (!account) return null;

  const handleSignOut = async () => {
    const postLogoutRedirectUri = getMsalRedirectUri();
    if (shouldUsePopupInteraction()) {
      await instance.logoutPopup({ postLogoutRedirectUri });
      return;
    }
    await instance.logoutRedirect({ postLogoutRedirectUri });
  };

  return (
    <div className="fixed top-0 right-0 z-[9999] flex items-center gap-3 bg-white/90 px-4 py-2 text-xs shadow-sm backdrop-blur">
      <span className="font-semibold text-gray-700">{account.name || account.username}</span>
      <button type="button" onClick={handleSignOut} className="font-bold text-[var(--primary-color,#2563eb)] hover:underline">
        Sign out
      </button>
    </div>
  );
};
