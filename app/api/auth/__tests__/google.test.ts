import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetSessionCookies = vi.fn();

vi.mock('@/lib/auth', () => ({
  setSessionCookies: (...args: unknown[]) => mockSetSessionCookies(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubEnv('GATEWAY_URL', 'http://gateway:5000');

import { POST } from '../google/route';

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/auth/google', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSetSessionCookies.mockResolvedValue(undefined);
});

describe('POST /api/auth/google', () => {
  it('sets session cookies and returns ok for gobhi role', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        accessToken: 'at_g',
        refreshToken: 'rt_g',
        user: { role: 'gobhi' },
      }),
    });
    const res = await POST(makeRequest({ idToken: 'firebase-id-token' }));
    expect(res.status).toBe(200);
    expect(mockSetSessionCookies).toHaveBeenCalledWith('at_g', 'rt_g');
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('returns 403 for non-gobhi role', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        accessToken: 'at_1',
        refreshToken: 'rt_1',
        user: { role: 'partner' },
      }),
    });
    const res = await POST(makeRequest({ idToken: 'firebase-id-token' }));
    expect(res.status).toBe(403);
    expect(mockSetSessionCookies).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.error).toMatch(/staff access/i);
  });

  it('forwards gateway error status', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Invalid token' }),
    });
    const res = await POST(makeRequest({ idToken: 'bad-token' }));
    expect(res.status).toBe(401);
    expect(mockSetSessionCookies).not.toHaveBeenCalled();
  });

  it('propagates fetch errors when gateway is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(POST(makeRequest({ idToken: 'tok' }))).rejects.toThrow('ECONNREFUSED');
  });
});
