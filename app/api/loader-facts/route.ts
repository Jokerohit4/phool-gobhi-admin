import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL;

const MAX_LIMIT = 50;
const MAX_OFFSET = 10000;

function clampInt(raw: string | null, min: number, max: number): number | null {
  if (raw === null || !/^\d{1,9}$/.test(raw)) return null;
  return Math.min(max, Math.max(min, Number(raw)));
}

// Public content passthrough (the gateway route needs no auth). One 10-fact
// batch per request so the portal never downloads the whole corpus.
export async function GET(req: Request) {
  if (!GATEWAY_URL) {
    return NextResponse.json({ error: 'GATEWAY_URL is not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const query = new URLSearchParams();
  // Clamp numeric paging params; ignore anything that is not a plain
  // non-negative integer rather than forwarding it to the gateway.
  const limit = clampInt(searchParams.get('limit'), 1, MAX_LIMIT);
  const offset = clampInt(searchParams.get('offset'), 0, MAX_OFFSET);
  if (limit !== null) query.set('limit', String(limit));
  if (offset !== null) query.set('offset', String(offset));
  const audience = searchParams.get('audience');
  if (audience !== null && /^[A-Za-z0-9_-]{1,32}$/.test(audience)) query.set('audience', audience);

  const suffix = query.toString();
  try {
    const res = await fetch(`${GATEWAY_URL}/content/loader-facts${suffix ? `?${suffix}` : ''}`, {
      cache: 'no-store',
    });
    const body = await res.json().catch(() => null);
    // This route sits behind the staff session (proxy), so it must never be
    // cached by shared caches: `private`, and only for successful responses.
    return NextResponse.json(body, {
      status: res.status,
      headers: {
        'Cache-Control': res.ok ? 'private, max-age=300, stale-while-revalidate=86400' : 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Gateway unreachable' }, { status: 502 });
  }
}
