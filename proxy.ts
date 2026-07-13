import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, errors as joseErrors } from 'jose';
import { ACCESS_COOKIE, REFRESH_COOKIE, ACCESS_COOKIE_MAX_AGE } from '@/lib/cookieNames';

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);
const GATEWAY_URL = process.env.GATEWAY_URL;

async function verifyGobhi(token: string) {
  const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
  return payload.role === 'gobhi' ? payload : null;
}

function redirectToLogin(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return redirectToLogin(request);

  try {
    const payload = await verifyGobhi(token);
    return payload ? NextResponse.next() : redirectToLogin(request);
  } catch (err) {
    if (!(err instanceof joseErrors.JWTExpired)) {
      return redirectToLogin(request);
    }
    // Access token expired but might still have a valid refresh token —
    // try a silent refresh so a 15-minute token lifetime doesn't force a
    // re-login every 15 minutes during a staff session.
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return redirectToLogin(request);

  try {
    const refreshRes = await fetch(`${GATEWAY_URL}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: refreshToken }),
    });
    if (!refreshRes.ok) return redirectToLogin(request);

    const { accessToken } = await refreshRes.json();
    const payload = accessToken ? await verifyGobhi(accessToken) : null;
    if (!payload) return redirectToLogin(request);

    const response = NextResponse.next();
    response.cookies.set(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_COOKIE_MAX_AGE,
    });
    return response;
  } catch {
    return redirectToLogin(request);
  }
}

export const config = {
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
