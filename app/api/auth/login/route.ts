import { NextResponse } from 'next/server';
import { setSessionCookies } from '@/lib/auth';

const GATEWAY_URL = process.env.GATEWAY_URL;

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  // Any role can log in — the backend doesn't gate this by role, so the
  // admin app must reject non-staff accounts itself.
  if (data?.user?.role !== 'gobhi') {
    return NextResponse.json({ error: 'This account does not have staff access.' }, { status: 403 });
  }

  await setSessionCookies(data.accessToken, data.refreshToken);
  return NextResponse.json({ ok: true });
}
