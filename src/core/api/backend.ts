import { auth } from '@/src/core/firebase/auth';
import { isFirebaseConfigured } from '@/src/core/firebase/config';

// Authenticated access to the JetSetter Cloud Functions (flightData,
// translate, duffelApi, …). Every request carries the caller's Firebase ID
// token; all provider keys stay server-side.
//
// EXPO_PUBLIC_API_BASE is the functions base URL, e.g.
//   https://us-central1-jetsetter-pro.cloudfunctions.net

export const apiBase = (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

export function isBackendConfigured(): boolean {
  return isFirebaseConfigured() && apiBase.length > 0;
}

export class BackendError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
    this.name = 'BackendError';
  }
}

async function idToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new BackendError('unauthorized', 401);
  return user.getIdToken();
}

async function parseError(res: Response): Promise<never> {
  let code = 'unknown';
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) code = body.error;
  } catch {
    // non-JSON error body
  }
  throw new BackendError(code, res.status);
}

export async function authedGet<T>(fn: string, params: Record<string, string>): Promise<T> {
  const token = await idToken();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${apiBase}/${fn}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as T;
}

export async function authedPost<T>(fn: string, body: unknown): Promise<T> {
  const token = await idToken();
  const res = await fetch(`${apiBase}/${fn}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as T;
}
