import { isUserAuthRequired, tryAcquireUserSharePointToken } from '../auth/authTokenBridge';

/**
 * SharePoint REST (_api) requires a token scoped to the SharePoint resource.
 * Uses the signed-in user's delegated token so permissions/groups work like SPFx.
 */
let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;
let inFlight: Promise<string> | null = null;

export const clearSharePointTokenCache = (): void => {
  cachedToken = null;
  inFlight = null;
};

export const acquireSharePointToken = async (): Promise<string> => {
  if (cachedToken && cachedToken.expiresAtMs > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }
  if (inFlight) return inFlight;

  if (isUserAuthRequired()) {
    inFlight = (async () => {
      const userToken = await tryAcquireUserSharePointToken();
      if (!userToken) {
        throw new Error('Sign in required to access SharePoint REST APIs.');
      }
      cachedToken = { accessToken: userToken, expiresAtMs: Date.now() + 55 * 60 * 1000 };
      return userToken;
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  throw new Error('User authentication is required. Configure VITE_AZURE_* and sign in.');
};
