import { createServerFn } from '@tanstack/react-start';

/**
 * App-only (client-credentials) Microsoft Graph authentication.
 *
 * Replaces the old MSAL delegated user login: instead of a person signing in
 * interactively, this app authenticates as *itself* against Entra ID and gets a
 * token with Application permissions (Sites.ReadWrite.All, Files.ReadWrite.All).
 *
 * The client secret (AZURE_CLIENT_SECRET) only ever lives in server env vars —
 * it is NEVER exposed to the browser. Only the short-lived access token this
 * function returns is sent to the client, exactly like any Graph access token.
 */
const graphCredentials = () => {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) return null;
  return { tenantId, clientId, clientSecret };
};

type TokenCacheEntry = { accessToken: string; expiresAtMs: number };

const tokenCache = new Map<string, TokenCacheEntry>();
const inFlightTokens = new Map<string, Promise<TokenCacheEntry>>();

const spHostname = (): string => {
  const hostname = process.env.VITE_SP_HOSTNAME || process.env.SP_HOSTNAME;
  if (!hostname) {
    throw new Error('SharePoint hostname is not configured. Set VITE_SP_HOSTNAME (or SP_HOSTNAME) in server env.');
  }
  return hostname;
};

const fetchAppOnlyToken = async (scope: string): Promise<TokenCacheEntry> => {
  const creds = graphCredentials();
  if (!creds) {
    throw new Error(
      'Graph app-only auth is not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID and AZURE_CLIENT_SECRET (server env vars, no VITE_ prefix).'
    );
  }

  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope,
    grant_type: 'client_credentials',
  });

  const response = await fetch(`https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`App-only token request failed (${scope}): ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in?: number };
  const expiresIn = Number(data.expires_in ?? 3600);
  return {
    accessToken: data.access_token,
    expiresAtMs: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  };
};

/** Server-only: returns a cached token for the given scope when still valid. */
const getServerToken = async (scope: string): Promise<TokenCacheEntry> => {
  const cached = tokenCache.get(scope);
  if (cached && cached.expiresAtMs > Date.now() + 30_000) {
    return cached;
  }

  const inFlight = inFlightTokens.get(scope);
  if (inFlight) return inFlight;

  const promise = fetchAppOnlyToken(scope)
    .then((token) => {
      tokenCache.set(scope, token);
      return token;
    })
    .finally(() => {
      inFlightTokens.delete(scope);
    });

  inFlightTokens.set(scope, promise);
  return promise;
};

const getServerGraphToken = (): Promise<TokenCacheEntry> =>
  getServerToken('https://graph.microsoft.com/.default');

const getServerSharePointToken = (): Promise<TokenCacheEntry> =>
  getServerToken(`https://${spHostname()}/.default`);

/** Callable from client code: runs on the server, returns a short-lived Graph access token. */
export const getGraphAccessToken = createServerFn({ method: 'GET' }).handler(async () => {
  return getServerGraphToken();
});

/** Callable from client code: SharePoint REST token (site groups / site users). */
export const getSharePointAccessToken = createServerFn({ method: 'GET' }).handler(async () => {
  return getServerSharePointToken();
});
