export const ACCESS_COOKIE = 'pg_admin_at';
export const REFRESH_COOKIE = 'pg_admin_rt';

// Mirrors auth-service's generateTokens.js expiries.
export const ACCESS_COOKIE_MAX_AGE = 60 * 15; // 15 minutes
export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Host-only (no Domain) — this app doesn't share its session across
// subdomains the way the website/partner-web pair does, so no explicit
// domain scoping is needed here.
export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
