import { useCallback, useEffect, useState } from 'react';

export class PublicApiError extends Error {
  status: number;
  details: Record<string, string>;
  constructor(status: number, message: string, details: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'fetch',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new PublicApiError(0, 'সার্ভারের সাথে সংযোগ করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const info = (data ?? {}) as { message?: string; details?: Record<string, string> };
    throw new PublicApiError(response.status, info.message ?? 'অনুরোধ সম্পন্ন করা যায়নি।', info.details ?? {});
  }
  return data as T;
}

interface FetchState<T> {
  data: T | null;
  error: PublicApiError | null;
  loading: boolean;
}

/** GET helper with loading/error state. Pass null to skip fetching. Keeps old data while reloading. */
export function useFetch<T>(path: string | null): FetchState<T> & { reload: () => void } {
  const [state, setState] = useState<FetchState<T>>({ data: null, error: null, loading: path !== null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: null }));
    request<T>('GET', path, undefined, controller.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          data: null,
          error: error instanceof PublicApiError ? error : new PublicApiError(0, 'অনুরোধ সম্পন্ন করা যায়নি।'),
          loading: false,
        });
      });
    return () => controller.abort();
  }, [path, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { ...state, reload };
}
