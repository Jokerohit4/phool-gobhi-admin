import { NextResponse } from 'next/server';
import { clearSessionCookies } from '@/lib/auth';
import { guardJsonPost } from '@/lib/csrf';

export async function POST(request: Request) {
  const rejected = guardJsonPost(request);
  if (rejected) return rejected;
  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
