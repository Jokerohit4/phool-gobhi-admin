import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CONFLICT_MESSAGE } from '@/lib/configConcurrency';
import { createCouponAction, updateCouponAction } from './actions';
import { COUPONS_PATH, type Coupon } from './config';
import CouponsPage from './page';

const { gatewayJson, headers, requireSession } = vi.hoisted(() => ({
  gatewayJson: vi.fn(), headers: vi.fn(), requireSession: vi.fn(),
}));
vi.mock('@/lib/api', () => ({ gatewayJson }));
vi.mock('@/lib/auth', () => ({ requireSession }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({ headers }));

const token = '2026-10-01T10:00:00.000Z';

function couponForm(fields: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ code: 'fall-26', kind: 'fixed', value: '125.29', eligibility: 'all', ...fields })) {
    form.set(key, value);
  }
  return form;
}

beforeEach(() => {
  gatewayJson.mockReset().mockResolvedValue({});
  headers.mockReset().mockResolvedValue(new Headers({ origin: 'https://admin.example', host: 'admin.example' }));
  requireSession.mockReset().mockResolvedValue({});
});

describe('coaching coupons', () => {
  it('creates a fixed coupon with limits and an IST active window', async () => {
    expect(await createCouponAction({}, couponForm({
      eligibility: 'selected', offerKeys: 'MED_30, MED_90 MED_30', activeFrom: '2026-10-01T15:30:00.123',
      activeTo: '2026-11-01T15:30', maxRedemptions: '100', perCustomerLimit: '2',
    }))).toMatchObject({ ok: true });
    const [url, request] = gatewayJson.mock.calls[0];
    expect(url).toBe(COUPONS_PATH);
    expect(request.method).toBe('POST');
    expect(JSON.parse(request.body)).toEqual({
      code: 'FALL-26', kind: 'fixed', value: 12529, offerKeys: ['MED_30', 'MED_90'],
      activeFrom: '2026-10-01T10:00:00.123Z', activeTo: '2026-11-01T10:00:00.000Z',
      maxRedemptions: 100, perCustomerLimit: 2,
    });
  });

  it.each<Record<string, string>>([
    { code: '../x' },
    { kind: 'bogus' },
    { value: '1.001' },
    { kind: 'percent', value: '100' },
    { kind: 'percent', value: '12.5' },
    { maxRedemptions: '0' },
    { perCustomerLimit: '1e2' },
    { activeFrom: '2026-02-30T09:00' },
    { activeFrom: '2026-11-01T10:00', activeTo: '2026-10-01T10:00' },
  ])('rejects invalid coupon form input %o', async fields => {
    expect(await createCouponAction({}, couponForm(fields))).toMatchObject({ ok: false });
    expect(gatewayJson).not.toHaveBeenCalled();
  });

  it('edits and disables with PATCH, carrying the optional token and leaving the code out of the body', async () => {
    await updateCouponAction({}, couponForm({ operation: 'edit', expectedUpdatedAt: token, kind: 'percent', value: '15' }));
    await updateCouponAction({}, couponForm({ operation: 'disable', expectedUpdatedAt: token }));
    await updateCouponAction({}, couponForm({ operation: 'enable' }));
    expect(gatewayJson.mock.calls.map(([url, request]) => [url, request.method, JSON.parse(request.body)])).toEqual([
      [COUPONS_PATH + '/FALL-26', 'PATCH', {
        kind: 'percent', value: 15, expectedUpdatedAt: token, offerKeys: null,
        activeFrom: null, activeTo: null, maxRedemptions: null, perCustomerLimit: null,
      }],
      [COUPONS_PATH + '/FALL-26', 'PATCH', { enabled: false, expectedUpdatedAt: token }],
      [COUPONS_PATH + '/FALL-26', 'PATCH', { enabled: true }],
    ]);
  });

  it('reports edit and disable conflicts while preserving duplicate-code errors', async () => {
    for (const operation of ['edit', 'disable']) {
      gatewayJson.mockRejectedValueOnce(Object.assign(new Error('stale'), { errorCode: 'CONFIG_CONFLICT' }));
      expect(await updateCouponAction({}, couponForm({ operation, expectedUpdatedAt: token }))).toEqual({
        ok: false, conflict: true, message: CONFLICT_MESSAGE,
      });
    }
    const message = 'A coupon with this code already exists';
    gatewayJson.mockRejectedValueOnce(Object.assign(new Error(message), { status: 409 }));
    expect(await createCouponAction({}, couponForm())).toEqual({ ok: false, message });
  });

  it('authenticates and rejects mismatched origins before any gateway call', async () => {
    requireSession.mockRejectedValueOnce(new Error('unauthenticated'));
    await expect(createCouponAction({}, couponForm())).rejects.toThrow('unauthenticated');
    headers.mockResolvedValue(new Headers({ origin: 'https://other.example', host: 'admin.example' }));
    expect(await createCouponAction({}, couponForm())).toEqual({ ok: false, message: 'Cross-origin request rejected' });
    expect(await updateCouponAction({}, couponForm({ operation: 'disable' }))).toMatchObject({ ok: false });
    expect(gatewayJson).not.toHaveBeenCalled();
  });

  it('renders counts and per-form tokens even when catalog keys fail to load', async () => {
    const coupon: Coupon = {
      code: 'FALL-26', kind: 'fixed', value: 12529, enabled: true, updatedAt: token, offerKeys: ['MED_30'],
      activeFrom: token, activeTo: null, maxRedemptions: 100, perCustomerLimit: 2,
      redemptionCounts: { reserved: 2, redeemed: 3, released: 4 },
    };
    gatewayJson.mockResolvedValueOnce({ data: [coupon] }).mockRejectedValueOnce(new Error('Unavailable'));
    const html = renderToStaticMarkup(await CouponsPage());
    expect(html).toContain('Reserved 2 · Redeemed 3 · Released 4');
    expect(html).toContain('Could not load catalog offer keys');
    expect(html).toContain('value="2026-10-01T15:30:00.000"');
    expect(html.match(new RegExp('name="expectedUpdatedAt" value="' + token + '"', 'g'))).toHaveLength(2);
    expect(html.match(/name="code"/g)).toHaveLength(3);
  });
});
