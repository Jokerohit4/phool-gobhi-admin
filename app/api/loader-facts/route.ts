import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL;

// Public content passthrough (the gateway route needs no auth). One 10-fact
// batch per request so the portal never downloads the whole corpus.
export async function GET(req: Request) {
  if (!GATEWAY_URL) {
    return NextResponse.json({ error: 'GATEWAY_URL is not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const query = new URLSearchParams();
  for (const key of ['offset', 'limit', 'audience']) {
    const value = searchParams.get(key);
    if (value !== null) query.set(key, value);
  }

  const suffix = query.toString();
  try {
    const res = await fetch(`${GATEWAY_URL}/content/loader-facts${suffix ? `?${suffix}` : ''}`, {
      cache: 'no-store',
    });
    const body = await res.json().catch(() => null);
    return NextResponse.json(body, {
      status: res.status,
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400' },
    });
  } catch {
    return NextResponse.json({ error: 'Gateway unreachable' }, { status: 502 });
  }
}
