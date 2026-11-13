import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

vi.stubEnv('JWT_SECRET', 'test-secret-key-for-vitest');

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

const { verifyAccessToken, requireSession } = await import('../auth');
const { cookies } = await import('next/headers');
const { redirect } = await import('next/navigation');

const secret = new TextEncoder().encode('test-secret-key-for-vitest');

function makeToken(payload: Record<string, unknown>, options?: { expiresIn?: string }) {
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt();
  if (options?.expiresIn) jwt.setExpirationTime(options.expiresIn);
  return jwt.sign(secret);
}

describe('verifyAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns session user for valid gobhi token', async () => {
    const token = await makeToken({ id: 1, role: 'gobhi', type: 'trainer' });
    const result = await verifyAccessToken(token);
    expect(result).toEqual({ id: 1, role: 'gobhi', type: 'trainer' });
  });

  it('returns null for customer role', async () => {
    const token = await makeToken({ id: 2, role: 'customer', type: 'general' });
    const result = await verifyAccessToken(token);
    expect(result).toBeNull();
  });

  it('returns null for partner role', async () => {
    const token = await makeToken({ id: 3, role: 'partner', type: 'general' });
    const result = await verifyAccessToken(token);
    expect(result).toBeNull();
  });

  it('returns null for expired token', async () => {
    const token = await makeToken({ id: 1, role: 'gobhi', type: 'trainer' }, { expiresIn: '0s' });
    await new Promise((r) => setTimeout(r, 10));
    const result = await verifyAccessToken(token);
    expect(result).toBeNull();
  });

  it('returns null for token signed with wrong secret', async () => {
    const wrongSecret = new TextEncoder().encode('wrong-secret');
    const token = await new SignJWT({ id: 1, role: 'gobhi', type: 'trainer' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .sign(wrongSecret);
    const result = await verifyAccessToken(token);
    expect(result).toBeNull();
  });

  it('returns null for malformed token', async () => {
    const result = await verifyAccessToken('not.a.valid.jwt');
    expect(result).toBeNull();
  });

  it('returns null for empty string', async () => {
    const result = await verifyAccessToken('');
    expect(result).toBeNull();
  });

  it('coerces id to number', async () => {
    const token = await makeToken({ id: 42, role: 'gobhi', type: 'cleaner' });
    const result = await verifyAccessToken(token);
    expect(result?.id).toBe(42);
    expect(typeof result?.id).toBe('number');
  });
});

describe('requireSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns session when valid cookie exists', async () => {
    const token = await makeToken({ id: 1, role: 'gobhi', type: 'trainer' });
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: token }),
      set: vi.fn(),
      delete: vi.fn(),
      has: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    const result = await requireSession();
    expect(result).toEqual({ id: 1, role: 'gobhi', type: 'trainer' });
  });

  it('redirects to /login when no cookie exists', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn(),
      delete: vi.fn(),
      has: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    await requireSession();
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('redirects to /login when cookie has non-gobhi token', async () => {
    const token = await makeToken({ id: 1, role: 'customer', type: 'general' });
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: token }),
      set: vi.fn(),
      delete: vi.fn(),
      has: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    await requireSession();
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
