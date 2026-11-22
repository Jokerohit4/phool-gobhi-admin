import { describe, it, expect, vi, beforeEach } from 'vitest';

const gatewayJson = vi.fn();
vi.mock('@/lib/api', () => ({ gatewayJson: (...args: unknown[]) => gatewayJson(...args) }));
const requireSession = vi.fn();
vi.mock('@/lib/auth', () => ({ requireSession: (...args: unknown[]) => requireSession(...args) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { fulfillmentAction } = await import('../actions');

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const review = {
  userId: '7', action: 'REVIEW', sourceReportId: '12', confirmedAt: '2026-01-01', clinicianName: 'Dr A',
  clinicianRegistration: 'REG1', clinicalNote: 'ok', clinicalStatus: 'CLEARED', agreedActions: 'a\nb',
};

beforeEach(() => {
  vi.clearAllMocks();
  requireSession.mockResolvedValue({ id: 1, role: 'gobhi', type: 'manager' });
  gatewayJson.mockResolvedValue({});
});

describe('fulfillmentAction validation', () => {
  it('rejects unknown statuses for every status action', async () => {
    for (const action of ['GYM', 'FULFILLMENT_STATUS', 'CARE_STATUS']) {
      const res = await fulfillmentAction({}, form({ userId: '7', action, requestId: '3', status: 'HACKED' }));
      expect(res.ok).toBe(false);
    }
    expect(gatewayJson).not.toHaveBeenCalled();
  });

  it('accepts a whitelisted status and forwards it', async () => {
    const res = await fulfillmentAction({}, form({ userId: '7', action: 'GYM', status: 'ACTIVE' }));
    expect(res.ok).toBe(true);
    expect(JSON.parse(gatewayJson.mock.calls[0][1].body)).toEqual({ status: 'ACTIVE' });
  });

  it('accepts a valid review and rejects bad sourceReportId / outcome / long text', async () => {
    expect((await fulfillmentAction({}, form(review))).ok).toBe(true);
    gatewayJson.mockClear();
    for (const bad of [
      { sourceReportId: 'abc' }, { sourceReportId: '0' }, { sourceReportId: '' },
      { clinicalStatus: 'PENDING' }, { clinicalNote: 'x'.repeat(2001) },
      { agreedActions: Array(25).fill('a').join('\n') }, { clinicianName: 'x'.repeat(121) },
    ]) {
      const res = await fulfillmentAction({}, form({ ...review, ...bad }));
      expect(res.ok).toBe(false);
    }
    expect(gatewayJson).not.toHaveBeenCalled();
  });

  it('keeps a well-formed session idempotency key and replaces a malformed one', async () => {
    const key = 'abcdefabcdefabcdef12';
    await fulfillmentAction({}, form({ userId: '7', action: 'FREE_SESSION', idempotencyKey: key }));
    await fulfillmentAction({}, form({ userId: '7', action: 'FREE_SESSION', idempotencyKey: 'bad key!' }));
    const keys = gatewayJson.mock.calls.map(([, init]) => JSON.parse(init.body).idempotencyKey);
    expect(keys[0]).toBe(key);
    expect(keys[1]).not.toBe('bad key!');
    expect(keys[1]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
