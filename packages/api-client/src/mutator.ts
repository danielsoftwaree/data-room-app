/**
 * Custom fetch used by all generated endpoints.
 *
 * Orval (fetch client) types each response as `{ data, status, headers }`,
 * so this mutator must resolve to that envelope. Non-2xx responses throw
 * ApiError carrying the server-provided message.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(extractMessage(body) ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

/** Narrow an unknown error (e.g. from a mutation) to a user-facing message. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function extractMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;

  // ApiErrorResponse contract: { error: { code, message } }.
  const nested = (body as { error?: unknown }).error;
  if (nested && typeof nested === 'object' && 'message' in nested) {
    const message = (nested as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }

  // Fallback for plain Nest-shaped bodies ({ message }), e.g. from proxies.
  if ('message' in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  }
  return undefined;
}

export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const response = await fetch(withApiBaseUrl(url), withDemoUserHeader(options));
  const body = await readResponseBody(response);
  if (!response.ok) throw new ApiError(response.status, body);
  return { data: body, status: response.status, headers: response.headers } as T;
};

function withDemoUserHeader(options: RequestInit): RequestInit {
  const userId = getDemoUserId();
  if (!userId) return options;
  const headers = new Headers(options.headers);
  headers.set('x-user-id', userId);
  return { ...options, headers };
}

function getDemoUserId(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem('demo-user-id')?.trim() ?? '';
}

function withApiBaseUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return url;

  const path = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${path}`;
}

function getApiBaseUrl(): string {
  const raw = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;
  return raw?.trim().replace(/\/+$/, '') ?? '';
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => undefined);
  }

  return response.blob();
}
