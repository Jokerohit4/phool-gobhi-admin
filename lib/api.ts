import { cookies } from 'next/headers';
import { ACCESS_COOKIE, REFRESH_COOKIE, ACCESS_COOKIE_MAX_AGE } from './cookieNames';

const GATEWAY_URL = process.env.GATEWAY_URL;

async function refreshAccessToken(): Promise<string | null> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const res = await fetch(`${GATEWAY_URL}/api/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: refreshToken }),
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  if (!body.accessToken) return null;

  try {
    store.set(ACCESS_COOKIE, body.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_COOKIE_MAX_AGE,
    });
  } catch {
    // Called from a Server Component render, where cookie writes aren't
    // allowed. Proxy already refreshes on expiry for page navigations, so
    // this only fires in a narrow race — the fresh token below still
    // serves this one request even though it can't be persisted here.
  }
  return body.accessToken;
}

// Server-only: attaches the staff session's access token to a gateway call,
// and transparently refreshes+retries once on a 401 (expired token mid-session).
export async function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;

  const doFetch = (accessToken?: string) =>
    fetch(`${GATEWAY_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      cache: 'no-store',
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await doFetch(refreshed);
  }
  return res;
}

export async function gatewayJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await gatewayFetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body as T;
}
