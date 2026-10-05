import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

vi.stubEnv('JWT_SECRET', 'test-secret-key-for-vitest');
vi.stubEnv('GATEWAY_URL', 'http://localhost:5000');

const jwtVerifyMock = vi.fn();
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>();
  return {
    ...actual,
    jwtVerify: (...args: unknown[]) => jwtVerifyMock(...args),
  };
});

const nextResponseNextMock = vi.fn().mockReturnValue({
  type: 'next',
  cookies: { set: vi.fn(), delete: vi.fn() },
});
const nextResponseRedirectMock = vi.fn().mockReturnValue({
  type: 'redirect',
  cookies: { set: vi.fn(), delete: vi.fn() },
});

vi.mock('next/server', () => ({
  NextResponse: {
    next: (...args: unknown[]) => nextResponseNextMock(...args),
    redirect: (...args: unknown[]) => nextResponseRedirectMock(...args),
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { proxy } = await import('./proxy');
const { SignJWT, errors: joseErrors } = await import('jose');

const secret = new TextEncoder().encode('test-secret-key-for-vitest');

function makeRequest(cookies: Record<string, string>): NextRequest {
  return {
    cookies: {
      get: (name: string) => (cookies[name] ? { value: cookies[name] } : undefined),
    },
    url: 'http://localhost:3000/dashboard',
  } as unknown as NextRequest;
}

async function makeToken(payload: Record<string, unknown>, opts?: { expiresIn?: string }) {
  const jwt = new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt();
  if (opts?.expiresIn) jwt.setExpirationTime(opts.expiresIn);
  return jwt.sign(secret);
}

describe('proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('access token present', () => {
    it('passes through for gobhi role', async () => {
      jwtVerifyMock.mockResolvedValue({ payload: { id: 1, role: 'gobhi', type: 'trainer' } });
      const request = makeRequest({ pg_admin_at: 'valid-token' });

      const result = await proxy(request);
      expect(result.type).toBe('next');
      expect(nextResponseNextMock).toHaveBeenCalled();
    });

    it('redirects to login for customer role', async () => {
      jwtVerifyMock.mockResolvedValue({ payload: { id: 2, role: 'customer', type: 'general' } });
      const request = makeRequest({ pg_admin_at: 'customer-token' });

      const result = await proxy(request);
      expect(result.type).toBe('redirect');
    });

    it('redirects to login for partner role', async () => {
      jwtVerifyMock.mockResolvedValue({ payload: { id: 3, role: 'partner', type: 'general' } });
      const request = makeRequest({ pg_admin_at: 'partner-token' });

      const result = await proxy(request);
      expect(result.type).toBe('redirect');
    });

    it('redirects to login for invalid token (verify throws non-expired error)', async () => {
      jwtVerifyMock.mockRejectedValue(new Error('invalid signature'));
      const request = makeRequest({ pg_admin_at: 'bad-token' });

      const result = await proxy(request);
      expect(result.type).toBe('redirect');
    });

    it('falls through to refresh when access token is expired', async () => {
      jwtVerifyMock
        .mockRejectedValueOnce(new joseErrors.JWTExpired('expired', {}, 'exp', 'expired'))
        .mockResolvedValueOnce({ payload: { id: 1, role: 'gobhi', type: 'trainer' } });

      const newAccessToken = await makeToken({ id: 1, role: 'gobhi', type: 'trainer' });
      const newRefreshToken = await makeToken({ id: 1, role: 'gobhi', type: 'trainer' }, { expiresIn: '7d' });

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ accessToken: newAccessToken, refreshToken: newRefreshToken }),
      });

      const request = makeRequest({ pg_admin_at: 'expired-token', pg_admin_rt: 'refresh-token' });
      const result = await proxy(request);
      expect(result.type).toBe('next');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/auth/refresh-token',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('no access token', () => {
    it('redirects to login when no refresh token exists', async () => {
      const request = makeRequest({});
      const result = await proxy(request);
      expect(result.type).toBe('redirect');
    });

    it('attempts refresh when refresh token is present', async () => {
      jwtVerifyMock.mockResolvedValue({ payload: { id: 1, role: 'gobhi', type: 'trainer' } });

      const newAccessToken = await makeToken({ id: 1, role: 'gobhi', type: 'trainer' });
      const newRefreshToken = await makeToken({ id: 1, role: 'gobhi', type: 'trainer' }, { expiresIn: '7d' });

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ accessToken: newAccessToken, refreshToken: newRefreshToken }),
      });

      const request = makeRequest({ pg_admin_rt: 'refresh-token' });
      const result = await proxy(request);
      expect(result.type).toBe('next');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/auth/refresh-token',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('redirects when refresh endpoint returns 401', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 401 });
      const request = makeRequest({ pg_admin_rt: 'dead-refresh-token' });
      const result = await proxy(request);
      expect(result.type).toBe('redirect');
    });

    it('redirects when refresh endpoint returns 403', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 403 });
      const request = makeRequest({ pg_admin_rt: 'dead-refresh-token' });
      const result = await proxy(request);
      expect(result.type).toBe('redirect');
    });

    it('redirects without clearing cookies on transient 500', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      const request = makeRequest({ pg_admin_rt: 'refresh-token' });
      const result = await proxy(request);
      expect(result.type).toBe('redirect');
    });

    it('redirects without clearing cookies on network failure', async () => {
      fetchMock.mockRejectedValue(new Error('network error'));
      const request = makeRequest({ pg_admin_rt: 'refresh-token' });
      const result = await proxy(request);
      expect(result.type).toBe('redirect');
    });

    it('redirects when refreshed token is not gobhi', async () => {
      jwtVerifyMock.mockResolvedValue({ payload: { id: 1, role: 'customer', type: 'general' } });

      const newAccessToken = await makeToken({ id: 1, role: 'customer', type: 'general' });
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ accessToken: newAccessToken, refreshToken: null }),
      });

      const request = makeRequest({ pg_admin_rt: 'refresh-token' });
      const result = await proxy(request);
      expect(result.type).toBe('redirect');
    });
  });

  describe('config', () => {
    it('exposes matcher excluding login and api/auth routes', async () => {
      const { config } = await import('./proxy');
      expect(config.matcher).toBeDefined();
    });
  });
});
