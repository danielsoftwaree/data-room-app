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
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  }
  return undefined;
}

export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const response = await fetch(url, options);
  const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) throw new ApiError(response.status, body);
  return { data: body, status: response.status, headers: response.headers } as T;
};
