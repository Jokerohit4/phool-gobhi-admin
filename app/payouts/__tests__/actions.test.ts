import { describe, it, expect, vi, beforeEach } from 'vitest';

const gatewayJson = vi.fn();
vi.mock('@/lib/api', () => ({ gatewayJson: (...args: unknown[]) => gatewayJson(...args) }));

const requireSession = vi.fn();
vi.mock('@/lib/auth', () => ({ requireSession: (...args: unknown[]) => requireSession(...args) }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { recordPayoutAction } = await import('../actions');

const KEY = '3f2b1c9e-7a44-4d0e-9b6a-1c2d3e4f5a6b';

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireSession.mockResolvedValue({ id: 1, role: 'gobhi', type: 'manager' });
  gatewayJson.mockResolvedValue({});
});

describe('recordPayoutAction', () => {
  it('sends the form idempotencyKey in the JSON body', async () => {
    const res = await recordPayoutAction({}, form({ userId: '42', amount: '150.50', description: 'Oct', idempotencyKey: KEY }));
    expect(res.ok).toBe(true);
    expect(gatewayJson).toHaveBeenCalledTimes(1);
    const [path, init] = gatewayJson.mock.calls[0];
    expect(path).toBe('/api/wallet/42/payout');
    expect(JSON.parse(init.body)).toEqual({ amount: 150.5, description: 'Oct', idempotencyKey: KEY });
  });

  it('sends the same key when the same form is submitted twice', async () => {
    const fd = () => form({ userId: '42', amount: '10', idempotencyKey: KEY });
    await recordPayoutAction({}, fd());
    await recordPayoutAction({}, fd());
    const keys = gatewayJson.mock.calls.map(([, init]) => JSON.parse(init.body).idempotencyKey);
    expect(keys).toEqual([KEY, KEY]);
  });

  it('rejects a missing or malformed idempotency key without calling the gateway', async () => {
    for (const idempotencyKey of ['', 'short', 'has spaces and/slashes 1234567890']) {
      const res = await recordPayoutAction({}, form({ userId: '42', amount: '10', idempotencyKey }));
      expect(res.ok).toBe(false);
    }
    expect(gatewayJson).not.toHaveBeenCalled();
  });

  it.each(['', 'abc', '0', '-3', '4.5', '1/../2', '42?x=1'])('rejects invalid userId %j', async (userId) => {
    const res = await recordPayoutAction({}, form({ userId, amount: '10', idempotencyKey: KEY }));
    expect(res).toEqual({ ok: false, message: 'Invalid partner' });
    expect(gatewayJson).not.toHaveBeenCalled();
  });

  it.each(['abc', '0', '-5', 'NaN', 'Infinity', '1.234', '999999999'])('rejects invalid amount %j', async (amount) => {
    const res = await recordPayoutAction({}, form({ userId: '42', amount, idempotencyKey: KEY }));
    expect(res.ok).toBe(false);
    expect(gatewayJson).not.toHaveBeenCalled();
  });

  it('allows an empty amount (pay out full balance) and still sends the key', async () => {
    const res = await recordPayoutAction({}, form({ userId: '42', amount: '', idempotencyKey: KEY }));
    expect(res.ok).toBe(true);
    expect(JSON.parse(gatewayJson.mock.calls[0][1].body).idempotencyKey).toBe(KEY);
  });
});
