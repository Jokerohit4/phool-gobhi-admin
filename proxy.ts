import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, errors as joseErrors } from 'jose';
import { ACCESS_COOKIE, REFRESH_COOKIE, ACCESS_COOKIE_MAX_AGE, REFRESH_COOKIE_MAX_AGE, cookieOptions } from '@/lib/cookieNames';

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);
const GATEWAY_URL = process.env.GATEWAY_URL;

async function verifyGobhi(token: string) {
  const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
  return payload.role === 'gobhi' ? payload : null;
}

function redirectToLogin(request: NextRequest, clearCookies = true) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  if (clearCookies) {
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;

  if (token) {
    try {
      const payload = await verifyGobhi(token);
      if (payload) return NextResponse.next();
      return redirectToLogin(request);
    } catch (err) {
      if (!(err instanceof joseErrors.JWTExpired)) {
        return redirectToLogin(request);
      }
      // fall through — access token expired, try a silent refresh below.
    }
  }
  // Either there was no access-token cookie at all (its own 15-minute
  // maxAge already expired browser-side — the NORMAL case after any 15+
  // minute gap between page loads, not evidence of a dead session) or the
  // JWT itself had expired above. Either way, a still-valid refresh token
  // (7-day cookie) should get a fresh session silently instead of forcing
  // a full re-login every 15 minutes of inactivity — this branch used to
  // be reached ONLY on an expired-but-present token, so a merely-absent
  // one skipped straight to redirectToLogin's default clearCookies=true,
  // wiping a perfectly good refresh token instead of using it.

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return redirectToLogin(request);

  try {
    const refreshRes = await fetch(`${GATEWAY_URL}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: refreshToken }),
    });
    if (!refreshRes.ok) {
      // A 401/403 proves the refresh token is dead — clear the session. A
      // transient 5xx (deploy warm-up, DB blip) is NOT proof: redirect to
      // login without clearing, so the session survives the blip.
      const authFailure = refreshRes.status === 401 || refreshRes.status === 403;
      return redirectToLogin(request, authFailure);
    }

    const { accessToken, refreshToken: rotatedRefreshToken } = await refreshRes.json();
    const payload = accessToken ? await verifyGobhi(accessToken) : null;
    if (!payload) return redirectToLogin(request);

    const response = NextResponse.next();
    response.cookies.set(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_COOKIE_MAX_AGE));
    // Refresh tokens rotate server-side and the old one becomes single-use —
    // see the identical fix (and full explanation) in lib/api.ts's
    // refreshAccessToken(). Without this every session gets force-logged-out
    // on its second silent refresh.
    if (rotatedRefreshToken) {
      response.cookies.set(REFRESH_COOKIE, rotatedRefreshToken, cookieOptions(REFRESH_COOKIE_MAX_AGE));
    }
    return response;
  } catch {
    // Network failure talking to the gateway — transient, not a dead
    // session. Preserve the cookies so the staff login survives.
    return redirectToLogin(request, false);
  }
}

export const config = {
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
