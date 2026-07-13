import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  REFRESH_COOKIE_MAX_AGE,
} from './cookieNames';

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);

export interface SessionUser {
  id: number;
  role: string;
  type: string;
}

export async function verifyAccessToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    if (payload.role !== 'gobhi') return null;
    return { id: Number(payload.id), role: String(payload.role), type: String(payload.type) };
  } catch {
    return null;
  }
}

// Defense-in-depth: call at the top of every Server Action and page render.
// Proxy already gates page navigations, but per Next.js docs Server Actions
// aren't covered by the proxy matcher chain on their own, so this must be
// re-checked here too rather than relying on proxy alone.
export async function requireSession(): Promise<SessionUser> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  const session = token ? await verifyAccessToken(token) : null;
  if (!session) {
    redirect('/login');
  }
  return session;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function setSessionCookies(accessToken: string, refreshToken: string) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_COOKIE_MAX_AGE));
  store.set(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_COOKIE_MAX_AGE));
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}
