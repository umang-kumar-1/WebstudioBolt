import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';
import { useEffect } from 'react';

import {
  registerGraphTokenAcquirer,
  registerSharePointTokenAcquirer,
  setUserAuthRequired,
} from './authTokenBridge';
import { getMsalPopupRedirectUri, getMsalRedirectUri, shouldUsePopupInteraction } from './msalConfig';
import { graphDelegatedScopes, sharePointResourceScopes } from './scopes';

/** Registers MSAL silent-token acquirers used by graphAuth.ts / spRestAuth.ts. */
export const TokenBridgeRegistration = () => {
  const { instance, accounts } = useMsal();

  useEffect(() => {
    setUserAuthRequired(true);

    const resolveAccount = () => instance.getActiveAccount() ?? accounts[0] ?? null;

    registerGraphTokenAcquirer(async () => {
      const account = resolveAccount();
      if (!account) return null;
      try {
        const result = await instance.acquireTokenSilent({
          scopes: [...graphDelegatedScopes],
          account,
        });
        return result.accessToken;
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          const scopes = [...graphDelegatedScopes];
          if (shouldUsePopupInteraction()) {
            const redirectUri = getMsalPopupRedirectUri();
            const result = await instance.acquireTokenPopup({ scopes, account, redirectUri });
            return result.accessToken;
          }
          const redirectUri = getMsalRedirectUri();
          await instance.acquireTokenRedirect({ scopes, account, redirectUri });
          return null;
        }
        throw error;
      }
    });

    registerSharePointTokenAcquirer(async () => {
      const account = resolveAccount();
      const spScopes = sharePointResourceScopes();
      if (!account || spScopes.length === 0) return null;
      try {
        const result = await instance.acquireTokenSilent({
          scopes: spScopes,
          account,
        });
        return result.accessToken;
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          if (shouldUsePopupInteraction()) {
            const redirectUri = getMsalPopupRedirectUri();
            const result = await instance.acquireTokenPopup({ scopes: spScopes, account, redirectUri });
            return result.accessToken;
          }
          const redirectUri = getMsalRedirectUri();
          await instance.acquireTokenRedirect({ scopes: spScopes, account, redirectUri });
          return null;
        }
        throw error;
      }
    });

    return () => {
      registerGraphTokenAcquirer(null);
      registerSharePointTokenAcquirer(null);
      setUserAuthRequired(false);
    };
  }, [instance, accounts]);

  return null;
};
