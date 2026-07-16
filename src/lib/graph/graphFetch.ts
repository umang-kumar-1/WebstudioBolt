import { acquireGraphToken } from './graphAuth';

export const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';

export class GraphError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'GraphError';
    this.status = status;
    this.body = body;
  }
}

interface GraphRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Provide a fully-qualified URL (e.g. an @odata.nextLink) instead of a /v1.0-relative path. */
  absoluteUrl?: string;
  rawBody?: BodyInit;
}

const buildUrl = (pathOrUrl: string, absoluteUrl?: string): string => {
  if (absoluteUrl) return absoluteUrl;
  return pathOrUrl.startsWith('http') ? pathOrUrl : `${GRAPH_ROOT}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_THROTTLE_RETRIES = 5;

/** Reads Retry-After (seconds or HTTP-date) with a sane exponential-backoff fallback. */
const getRetryDelayMs = (response: Response, attempt: number): number => {
  const header = response.headers.get('Retry-After');
  if (header) {
    const seconds = Number(header);
    if (!Number.isNaN(seconds)) return Math.max(seconds * 1000, 500);
    const dateMs = Date.parse(header);
    if (!Number.isNaN(dateMs)) return Math.max(dateMs - Date.now(), 500);
  }
  return Math.min(1000 * 2 ** attempt, 10000);
};

/** Generic JSON request against Microsoft Graph, with automatic bearer token attachment. */
export const graphFetch = async <T = unknown>(path: string, options: GraphRequestOptions = {}): Promise<T> => {
  const url = buildUrl(path, options.absoluteUrl);

  let body: BodyInit | undefined = options.rawBody;
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined && !options.rawBody) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  for (let attempt = 0; ; attempt++) {
    const token = await acquireGraphToken();
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: { Authorization: `Bearer ${token}`, ...headers },
      body,
    });

    // Microsoft Graph / SharePoint Online throttles bursts of requests with 429 (or a
    // transient 503). Respecting Retry-After here (instead of surfacing the error) keeps
    // the app resilient under load, exactly like the Graph SDK's own retry middleware.
    if ((response.status === 429 || response.status === 503) && attempt < MAX_THROTTLE_RETRIES) {
      await sleep(getRetryDelayMs(response, attempt));
      continue;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') || '';
    const parsed = contentType.includes('application/json') ? await response.json().catch(() => undefined) : undefined;

    if (!response.ok) {
      const message = (parsed as { error?: { message?: string } })?.error?.message || response.statusText || 'Graph request failed';
      throw new GraphError(message, response.status, parsed);
    }

    return parsed as T;
  }
};

/** Fetches raw binary content (used for file/image downloads) with the bearer token attached. */
export const graphFetchBlob = async (path: string, absoluteUrl?: string): Promise<Blob> => {
  const token = await acquireGraphToken();
  const url = buildUrl(path, absoluteUrl);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new GraphError(response.statusText || 'Failed to download file content', response.status);
  }
  return response.blob();
};

/** Follows @odata.nextLink pagination to collect every item from a Graph collection endpoint. */
export const graphFetchAllPages = async <T = unknown>(path: string): Promise<T[]> => {
  const results: T[] = [];
  let nextUrl: string | undefined;
  let first = true;

  while (first || nextUrl) {
    first = false;
    const page: { value?: T[]; ['@odata.nextLink']?: string } = nextUrl
      ? await graphFetch(path, { absoluteUrl: nextUrl })
      : await graphFetch(path);
    if (page?.value) results.push(...page.value);
    nextUrl = page?.['@odata.nextLink'];
  }

  return results;
};
