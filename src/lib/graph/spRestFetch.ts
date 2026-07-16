import { acquireSharePointToken } from './spRestAuth';
import { getSiteUrl } from './siteResolver';

export class SpRestError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'SpRestError';
    this.status = status;
    this.body = body;
  }
}

interface SpRestRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

interface SpVerboseEnvelope<T> {
  d: T;
}

const ODATA_VERBOSE = 'application/json;odata=verbose';
const ODATA_NOMETADATA = 'application/json;odata=nometadata';

const unwrapVerboseEnvelope = <T>(parsed: unknown): T => {
  if (parsed && typeof parsed === 'object' && parsed !== null && 'd' in parsed) {
    return (parsed as SpVerboseEnvelope<T>).d;
  }
  return parsed as T;
};

const unwrapResultsFromPayload = <T>(payload: T | { results: T[] } | T[]): T[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && 'results' in payload) {
    const results = (payload as { results: T[] }).results;
    if (Array.isArray(results)) return results;
  }
  return payload ? [payload as T] : [];
};

const unwrapResults = <T>(payload: SpVerboseEnvelope<T | { results: T[] }> | T | { results: T[] }): T[] => {
  if (payload && typeof payload === 'object' && 'd' in payload) {
    return unwrapResultsFromPayload((payload as SpVerboseEnvelope<T | { results: T[] }>).d);
  }
  return unwrapResultsFromPayload(payload as T | { results: T[] });
};

const unwrapSingle = <T>(payload: SpVerboseEnvelope<T> | T): T => {
  if (payload && typeof payload === 'object' && 'd' in payload) {
    return (payload as SpVerboseEnvelope<T>).d;
  }
  return payload as T;
};

export const spRestFetch = async <T = unknown>(
  relativePath: string,
  options: SpRestRequestOptions = {}
): Promise<T> => {
  const siteUrl = await getSiteUrl();
  const token = await acquireSharePointToken();
  const url = `${siteUrl}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: ODATA_VERBOSE,
    ...options.headers,
  };

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = ODATA_VERBOSE;
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  const parsed = contentType.includes('json') ? await response.json().catch(() => undefined) : undefined;

  if (!response.ok) {
    throw new SpRestError(
      `SharePoint REST ${options.method || 'GET'} ${relativePath} failed: ${response.status}`,
      response.status,
      parsed
    );
  }

  return unwrapVerboseEnvelope<T>(parsed);
};

export const spRestFetchAll = async <T>(relativePath: string): Promise<T[]> => {
  const payload = await spRestFetch<T | { results: T[] }>(relativePath);
  return unwrapResultsFromPayload(payload);
};

export const spRestFetchOne = async <T>(relativePath: string): Promise<T> => {
  return spRestFetch<T>(relativePath);
};

export const spRestFetchOneAtWebPath = async <T>(
  serverRelativeWebPath: string,
  relativePath: string
): Promise<T | null> => {
  const siteUrl = await getSiteUrl();
  const origin = new URL(siteUrl).origin;
  const normalizedPath = serverRelativeWebPath.startsWith('/')
    ? serverRelativeWebPath
    : `/${serverRelativeWebPath}`;
  const baseUrl = `${origin}${normalizedPath}`;
  const token = await acquireSharePointToken();
  const url = `${baseUrl}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: ODATA_VERBOSE },
  });
  if (!response.ok) return null;
  const parsed = await response.json();
  return unwrapVerboseEnvelope<T>(parsed);
};

export const resolveLoginNameByEmail = async (email: string): Promise<string | null> => {
  const escaped = email.replace(/'/g, "''");
  const users = await spRestFetchAll<{
    Id: number;
    Title: string;
    Email: string;
    LoginName: string;
    UserPrincipalName?: string;
  }>(`/_api/web/siteusers?$filter=Email eq '${escaped}'`);

  if (!users.length) return null;

  const loginNames = users.map((u) => u.LoginName).filter(Boolean);
  const preferred = loginNames.find((name) => !name.includes('hhhhteams.onmicrosoft.com'));
  return preferred || loginNames[0] || null;
};

export { unwrapResults, unwrapSingle, ODATA_NOMETADATA };
