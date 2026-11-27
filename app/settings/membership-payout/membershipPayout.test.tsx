import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CONFLICT_MESSAGE } from '@/lib/configConcurrency';
import { removeGymPayoutAction, saveGymPayoutAction, saveMembershipPayoutAction } from './actions';
import { GYM_PAYOUT_PATH, MEMBERSHIP_PAYOUT_PATH } from './config';
import MembershipPayoutPage from './page';

const { gatewayJson, requireSession, hasInvalidActionOrigin } = vi.hoisted(() => ({
  gatewayJson: vi.fn(),
  requireSession: vi.fn(),
  hasInvalidActionOrigin: vi.fn(),
}));
vi.mock('@/lib/api', () => ({ gatewayJson }));
vi.mock('@/lib/auth', () => ({ requireSession }));
vi.mock('@/lib/actionOrigin', () => ({ hasInvalidActionOrigin }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const token = '2026-10-01T10:00:00.000Z';
function payoutForm(value: string) {
  const form = new FormData();
  form.set('payoutRupees', value);
  form.set('expectedUpdatedAt', token);
  return form;
}

beforeEach(() => {
  gatewayJson.mockReset().mockResolvedValue({ data: [] });
  requireSession.mockReset().mockResolvedValue(undefined);
  hasInvalidActionOrigin.mockReset().mockResolvedValue(false);
});

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
  expect(html).not.toContain('Save payout');
  expect(html).toContain('Add or update override');
});

function gymForm(gymId = '42') {
  const form = payoutForm('82.50');
  form.set('gymId', gymId);
  return form;
}

it('creates and updates a gym payout in paise', async () => {
  const form = gymForm();
  expect(await saveGymPayoutAction({}, form)).toMatchObject({ ok: true });
  expect(gatewayJson).toHaveBeenLastCalledWith(`${GYM_PAYOUT_PATH}/42`, {
    method: 'PUT', body: JSON.stringify({ payoutPaise: 8250, expectedUpdatedAt: token }),
  });
  form.delete('expectedUpdatedAt');
  expect(await saveGymPayoutAction({}, form)).toMatchObject({ ok: true });
  expect(gatewayJson).toHaveBeenLastCalledWith(`${GYM_PAYOUT_PATH}/42`, {
    method: 'PUT', body: JSON.stringify({ payoutPaise: 8250 }),
  });
});

it('removes a gym override with its conflict token', async () => {
  expect(await removeGymPayoutAction({}, gymForm())).toMatchObject({ ok: true });
  expect(gatewayJson).toHaveBeenCalledWith(`${GYM_PAYOUT_PATH}/42`, {
    method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt: token }),
  });
});

it.each([saveGymPayoutAction, removeGymPayoutAction])('%s guards access, validates IDs and reports conflicts', async (action) => {
  requireSession.mockRejectedValueOnce(new Error('Session required'));
  await expect(action({}, gymForm())).rejects.toThrow('Session required');
  expect(hasInvalidActionOrigin).not.toHaveBeenCalled();
  hasInvalidActionOrigin.mockResolvedValueOnce(true);
  expect(await action({}, gymForm())).toEqual({ ok: false, message: 'Cross-origin request rejected' });
  expect(await action({}, gymForm('42/../43'))).toEqual({ ok: false, message: 'Invalid gym id' });
  expect(gatewayJson).not.toHaveBeenCalled();
  gatewayJson.mockRejectedValueOnce(Object.assign(new Error('stale'), { errorCode: 'CONFIG_CONFLICT' }));
  expect(await action({}, gymForm())).toEqual({ ok: false, conflict: true, message: CONFLICT_MESSAGE });
});

it('shows the default, override and removal token', async () => {
  gatewayJson.mockResolvedValueOnce({ data: { payoutPaise: 7500, updatedAt: null } })
    .mockResolvedValueOnce({ data: [{ gymId: 42, payoutPaise: 8250, updatedAt: token }] });
  const html = renderToStaticMarkup(await MembershipPayoutPage());
  expect(gatewayJson).toHaveBeenCalledWith(GYM_PAYOUT_PATH);
  expect(html).toContain('Gyms without an override receive ₹75.00 per visit.');
  expect(html).toContain('₹82.50');
  expect(html).toContain('name="gymId" value="42"');
  expect(html).toContain(`name="expectedUpdatedAt" value="${token}"`);
  expect(html).toContain('Remove');
});

it('keeps the default editable when the override list fails', async () => {
  gatewayJson.mockResolvedValueOnce({ data: { payoutPaise: 7500, updatedAt: null } })
    .mockRejectedValueOnce(new Error('Something went wrong on our side. Please try again.'));
  const html = renderToStaticMarkup(await MembershipPayoutPage());
  expect(html).toContain('Could not load gym payout overrides');
  expect(html).toContain('Save payout');
  expect(html).not.toContain('Add or update override');
});
