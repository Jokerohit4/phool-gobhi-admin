import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CONFLICT_MESSAGE } from '@/lib/configConcurrency';
import { saveMembershipPayoutAction } from './actions';
import { MEMBERSHIP_PAYOUT_PATH } from './config';
import MembershipPayoutPage from './page';

const { gatewayJson } = vi.hoisted(() => ({ gatewayJson: vi.fn() }));
vi.mock('@/lib/api', () => ({ gatewayJson }));
vi.mock('@/lib/auth', () => ({ requireSession: vi.fn() }));
vi.mock('@/lib/actionOrigin', () => ({ hasInvalidActionOrigin: async () => false }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const token = '2026-10-01T10:00:00.000Z';
function payoutForm(value: string) {
  const form = new FormData();
  form.set('payoutRupees', value);
  form.set('expectedUpdatedAt', token);
  return form;
}

beforeEach(() => gatewayJson.mockReset().mockResolvedValue({}));

it('converts payout rupees to exact paise and sends the conflict token', async () => {
  expect(await saveMembershipPayoutAction({}, payoutForm('75.29'))).toMatchObject({ ok: true });
  expect(gatewayJson).toHaveBeenCalledWith(MEMBERSHIP_PAYOUT_PATH, {
    method: 'PUT', body: JSON.stringify({ payoutPaise: 7529, expectedUpdatedAt: token }),
  });
});

it('rejects fractional paise and zero, and shows a stale-save message', async () => {
  for (const value of ['75.001', '0']) expect(await saveMembershipPayoutAction({}, payoutForm(value))).toMatchObject({ ok: false });
  expect(gatewayJson).not.toHaveBeenCalled();
  gatewayJson.mockRejectedValueOnce(Object.assign(new Error('stale'), { errorCode: 'CONFIG_CONFLICT' }));
  expect(await saveMembershipPayoutAction({}, payoutForm('75'))).toEqual({ ok: false, conflict: true, message: CONFLICT_MESSAGE });
});

it('renders the backend default and adds a token only when the backend provides one', async () => {
  gatewayJson.mockResolvedValueOnce({ data: { payoutPaise: 7500, updatedAt: null } });
  const defaultHTML = renderToStaticMarkup(await MembershipPayoutPage());
  expect(defaultHTML).toContain('value="75.00"');
  expect(defaultHTML).not.toContain('name="expectedUpdatedAt"');
  gatewayJson.mockResolvedValueOnce({ data: { payoutPaise: 7529, updatedAt: token } });
  const savedHTML = renderToStaticMarkup(await MembershipPayoutPage());
  expect(savedHTML).toContain('value="75.29"');
  expect(savedHTML).toContain(`name="expectedUpdatedAt" value="${token}"`);
});

it('renders a load error without showing a writable default', async () => {
  gatewayJson.mockRejectedValueOnce(new Error('Something went wrong on our side. Please try again.'));
  const html = renderToStaticMarkup(await MembershipPayoutPage());
  expect(html).toContain('Could not load the membership payout');
  expect(html).not.toContain('name="payoutRupees"');
});
