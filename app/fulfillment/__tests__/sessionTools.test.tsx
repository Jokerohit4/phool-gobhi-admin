import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { logSessionAction, resolveSessionAction, reverseCheckinPayoutAction } from '../actions';
import FulfillmentPage from '../page';
import { SessionLogForm } from '../SessionTools';
import { DISPUTED_SESSIONS_PATH } from '../sessions';

const { gatewayJson } = vi.hoisted(() => ({ gatewayJson: vi.fn() }));
vi.mock('@/lib/api', () => ({ gatewayJson }));
vi.mock('@/lib/auth', () => ({ requireSession: vi.fn() }));
vi.mock('@/lib/actionOrigin', () => ({ hasInvalidActionOrigin: async () => false }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const key = 'a6d8a0b5-2051-4e3c-b5eb-dff67ad744aa';
function form(fields: Record<string, string>) {
  const result = new FormData();
  for (const [name, value] of Object.entries(fields)) result.set(name, value);
  return result;
}

const session = { userId: '7', kind: 'trainer', mode: 'online', heldAt: '2020-01-01T15:30', idempotencyKey: key };

beforeEach(() => {
  gatewayJson.mockReset().mockResolvedValue({});
});

describe('session log', () => {
  it('renders one new UUID for each form render', () => {
    const keys = Array.from({ length: 2 }, () => {
      const html = renderToStaticMarkup(SessionLogForm());
      const matches = [...html.matchAll(/name="idempotencyKey" value="([a-f0-9-]{36})"/g)];
      expect(matches).toHaveLength(1);
      return matches[0][1];
    });
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('reuses the submitted key across retries and records the held time in UTC', async () => {
    const fields = form({ ...session, kind: 'nutritionist', durationMinutes: '30', note: 'Completed' });
    gatewayJson.mockRejectedValueOnce(new Error('Something went wrong on our side. Please try again.'));
    expect(await logSessionAction({}, fields)).toEqual({ ok: false, message: 'Something went wrong on our side. Please try again.' });
    expect(await logSessionAction({}, fields)).toMatchObject({ ok: true });
    const expectedCall = ['/api/wallet/coaching/admin/fulfillment/7/session-log', {
      method: 'POST', body: JSON.stringify({
        kind: 'nutritionist', mode: 'online', heldAt: '2020-01-01T10:00:00.000Z',
        durationMinutes: 30, note: 'Completed', idempotencyKey: key,
      }),
    }];
    expect(gatewayJson.mock.calls).toEqual([expectedCall, expectedCall]);
  });

  it('omits optional values as null and rejects bad identifiers, dates, keys and durations', async () => {
    const invalidFields: Record<string, string>[] = [
      { userId: '8/../4' }, { kind: 'other' }, { mode: 'phone' }, { heldAt: '9999-01-01T10:00' },
      { heldAt: '2020-02-30T10:00' }, { idempotencyKey: '' }, { idempotencyKey: 'bad key' }, { durationMinutes: '1.5' },
    ];
    for (const overrides of invalidFields) {
      expect(await logSessionAction({}, form({ ...session, ...overrides }))).toMatchObject({ ok: false });
    }
    expect(gatewayJson).not.toHaveBeenCalled();
    expect(await logSessionAction({}, form(session))).toMatchObject({ ok: true });
    expect(JSON.parse(gatewayJson.mock.calls[0][1].body)).toMatchObject({ durationMinutes: null, note: null });
  });
});

it('posts both dispute resolutions and rejects an invalid resolution or session ID', async () => {
  for (const resolution of ['upheld', 'recredited']) {
    expect(await resolveSessionAction({}, form({ sessionId: '9', resolution }))).toMatchObject({ ok: true });
    expect(gatewayJson).toHaveBeenLastCalledWith('/api/wallet/coaching/admin/sessions/9/resolve', {
      method: 'POST', body: JSON.stringify({ resolution }),
    });
  }
  expect(await resolveSessionAction({}, form({ sessionId: '1e2', resolution: 'upheld' }))).toMatchObject({ ok: false });
  expect(await resolveSessionAction({}, form({ sessionId: '9', resolution: 'pending' }))).toMatchObject({ ok: false });
  expect(gatewayJson).toHaveBeenCalledTimes(2);
});

it('posts a check-in reversal for a valid booking ID and shows a safe gateway rejection', async () => {
  expect(await reverseCheckinPayoutAction({}, form({ bookingId: '12/../x' }))).toMatchObject({ ok: false });
  expect(gatewayJson).not.toHaveBeenCalled();
  expect(await reverseCheckinPayoutAction({}, form({ bookingId: '12' }))).toEqual({
    ok: true, message: 'Check-in payout reversed for booking #12.',
  });
  expect(gatewayJson).toHaveBeenCalledWith('/api/bookings/admin/bookings/12/reverse-checkin-payout', { method: 'POST' });
  const message = 'This booking has no settled check-in payout';
  gatewayJson.mockRejectedValueOnce(new Error(message));
  expect(await reverseCheckinPayoutAction({}, form({ bookingId: '12' }))).toEqual({ ok: false, message });
});

it('renders dispute details and paging when care fails independently', async () => {
  gatewayJson.mockResolvedValueOnce({ data: [] }).mockRejectedValueOnce(new Error('Care unavailable')).mockResolvedValueOnce({
    data: {
      sessions: [{
        id: 9, userId: 7, kind: 'trainer', mode: 'online', heldAt: '2020-01-01T10:00:00Z', durationMinutes: 30,
        disputeReason: 'Booked time differed', name: 'Do not show', phone: '1234567890',
      }],
      total: 45, page: 2, limit: 20,
    },
  });
  const html = renderToStaticMarkup(await FulfillmentPage({ searchParams: Promise.resolve({ disputesPage: '2' }) }));
  expect(gatewayJson).toHaveBeenCalledWith(DISPUTED_SESSIONS_PATH + '?page=2&limit=20');
  expect(html).toContain('Could not load care records');
  expect(html).toContain('Session #9 · Customer #7');
  expect(html).toContain('Booked time differed');
  expect(html).toContain('name="resolution" value="upheld"');
  expect(html).toContain('name="resolution" value="recredited"');
  expect(html).toContain('disputesPage=3#disputed-sessions');
  expect(html).toContain('Log a coaching session');
  expect(html).toContain('Reverse check-in payout');
  expect(html).not.toContain('Do not show');
  expect(html).not.toContain('1234567890');
});

it('keeps independent forms available when the dispute queue fails', async () => {
  gatewayJson.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: { profiles: [], requests: [] } })
    .mockRejectedValueOnce(new Error('Queue unavailable'));
  const html = renderToStaticMarkup(await FulfillmentPage({ searchParams: Promise.resolve({ disputesPage: '../x' }) }));
  expect(gatewayJson).toHaveBeenCalledWith(DISPUTED_SESSIONS_PATH + '?page=1&limit=20');
  expect(html).toContain('Could not load disputed sessions');
  expect(html).toContain('Log a coaching session');
  expect(html).toContain('Reverse check-in payout');
});
