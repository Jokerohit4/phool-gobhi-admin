import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClearSessionCookies = vi.fn();

vi.mock('@/lib/auth', () => ({
  clearSessionCookies: (...args: unknown[]) => mockClearSessionCookies(...args),
}));

import { POST } from '../logout/route';

beforeEach(() => {
  vi.clearAllMocks();
  mockClearSessionCookies.mockResolvedValue(undefined);
});

describe('POST /api/auth/logout', () => {
  it('clears session cookies and returns ok', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(mockClearSessionCookies).toHaveBeenCalled();
    const json = await res.json();
    expect(json.ok).toBe(true);
  });
});
