export const ACCESS_COOKIE = 'pg_admin_at';
export const REFRESH_COOKIE = 'pg_admin_rt';

// Mirrors auth-service's generateTokens.js expiries.
export const ACCESS_COOKIE_MAX_AGE = 60 * 15; // 15 minutes
export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
