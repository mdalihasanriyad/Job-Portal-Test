export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  status: number;
  code: string;
  details: FieldErrors;
  constructor(status: number, code: string, message: string, details: FieldErrors = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'fetch',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'সার্ভারের সাথে সংযোগ করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।');
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const info = (data ?? {}) as { error?: string; message?: string; details?: FieldErrors };
    if (response.status === 401 && path !== '/api/auth/login') unauthorizedHandler?.();
    throw new ApiError(
      response.status,
      info.error ?? 'error',
      info.message ?? 'অনুরোধ সম্পন্ন করা যায়নি।',
      info.details ?? {},
    );
  }
  return data as T;
}
