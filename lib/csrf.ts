import { NextResponse } from 'next/server';

// Origin / fetch-metadata guard for cookie-authenticated Route Handlers.
// Route Handlers are not covered by Server Action CSRF protection, and the
// session cookies are SameSite=Lax, so a cross-site top-level GET (or a
// cross-site form POST in some browsers) can still reach them.
//
//  - Sec-Fetch-Site: cross-site  -> reject
//  - Origin present and not same-origin as the request host -> reject
//  - neither header present (curl, server-to-server, older clients) -> allow
//
// Same-origin is decided against the Host / X-Forwarded-Host the request
// actually arrived on, so it works behind Vercel without extra config.
export function isCrossOrigin(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return true;

  const origin = request.headers.get('origin');
  if (origin !== null) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return true; // "null" or malformed origin
    }
    const forwarded = request.headers.get('x-forwarded-host');
    const host = (forwarded ? forwarded.split(',')[0].trim() : null) || request.headers.get('host') || new URL(request.url).host;
    if (originHost !== host) return true;
  }
  return false;
}

export function rejectCrossOrigin(request: Request): NextResponse | null {
  if (!isCrossOrigin(request)) return null;
  return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
}

// Requiring application/json on state-changing POSTs means a plain HTML form
// (text/plain, urlencoded, multipart) cannot be used to reach the handler.
export function requireJsonContentType(request: Request): NextResponse | null {
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (type.split(';')[0].trim() === 'application/json') return null;
  return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
}

// Combined guard for the JSON POST routes.
export function guardJsonPost(request: Request): NextResponse | null {
  return rejectCrossOrigin(request) ?? requireJsonContentType(request);
}
