import { isUserAuthRequired, tryAcquireUserGraphToken } from '../auth/authTokenBridge';

/**
 * Acquires a Microsoft Graph bearer token.
 * With MSAL user auth enabled, uses the signed-in user's delegated token (SPFx parity).
 */
let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;
let inFlight: Promise<string> | null = null;

export const clearGraphTokenCache = (): void => {
  cachedToken = null;
  inFlight = null;
};

export const acquireGraphToken = async (): Promise<string> => {
  if (isUserAuthRequired()) {
    const userToken = await tryAcquireUserGraphToken();
    if (userToken) return userToken;
    throw new Error('Sign in required to access SharePoint data.');
  }

  throw new Error('User authentication is required. Configure VITE_AZURE_* and sign in.');
};
