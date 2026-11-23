import { describe, it, expect, vi, beforeEach } from 'vitest';

// Optimistic concurrency for the settings server actions. Each action must
//   1. forward the page's hidden `expectedUpdatedAt` as `expectedUpdatedAt` in
//      the PUT body (and omit the key entirely when the form had none), and
//   2. turn a CONFIG_CONFLICT from the backend into the per-section conflict
//      message with `conflict: true`, not a raw error.
// The fake gateway below is a real compare-and-set per config row, so the
// two-admins scenario is exercised end to end at the action layer.

vi.mock('@/lib/auth', () => ({ requireSession: vi.fn(async () => ({ id: 1, role: 'gobhi' })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const gatewayJson = vi.fn();
vi.mock('@/lib/api', () => ({ gatewayJson: (...args: unknown[]) => gatewayJson(...args) }));
vi.mock('@/app/settings/flagRegistry', () => ({
  loadFlagRegistry: async () => ({
    failed: false,
    flags: [{ name: 'buddy', clientKey: 'buddyEnabled', group: 'social', deps: [], defaultEnabled: false, enabled: false }],
  }),
}));

const settings = await import('../actions');
const coins = await import('@/app/gamification/coins/actions');
const { CONFLICT_MESSAGE } = await import('@/lib/configConcurrency');

const T0 = '2026-10-01T10:00:00.000Z';
const T1 = '2026-10-01T10:05:00.000Z';

class FakeConflict extends Error {
  status = 409;
  errorCode = 'CONFIG_CONFLICT';
  constructor() {
    super('This setting was changed by someone else. Reload and try again.');
  }
}

type Row = { updatedAt: string; body?: Record<string, unknown> };
let rows: Record<string, Row>;
let writes: Array<{ path: string; body: Record<string, unknown> }>;

const WALLET_PATH = '/api/wallet/topup-config';
const APP_CONFIG_PATH = '/api/auth/app-config/admin';

function pathKey(path: string) {
  return path;
}

beforeEach(() => {
  vi.clearAllMocks();
  rows = {};
  writes = [];
  gatewayJson.mockImplementation(async (path: string, init?: { method?: string; body?: string }) => {
    const method = init?.method ?? 'GET';
    const row = (rows[pathKey(path)] ??= { updatedAt: T0 });
    if (method === 'GET') {
      if (path === APP_CONFIG_PATH) return { data: { customer: {}, features: {}, maintenance: {} }, updatedAt: row.updatedAt };
      if (path === WALLET_PATH) {
        return { data: { presets: [200, 500], allowCustomAmount: false, minCustomAmount: null, maxCustomAmount: null, updatedAt: row.updatedAt } };
      }
      return { data: {}, updatedAt: row.updatedAt };
    }
    const body = JSON.parse(init!.body!) as Record<string, unknown>;
    if (body.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== row.updatedAt) throw new FakeConflict();
    writes.push({ path, body });
    row.updatedAt = T1;
    row.body = body;
    return { data: {}, updatedAt: T1 };
  });
});

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const prev = {};

// Every settings action that writes a config row, with the form it needs and
// the path it PUT/POSTs to.
const CASES: Array<{
  name: string;
  run: (fd: FormData) => Promise<{ ok?: boolean; message?: string; conflict?: boolean }>;
  fields: Record<string, string>;
  path: string;
}> = [
  {
    name: 'cancellation policy',
    run: (fd) => settings.updateCancellationPolicyAction(prev, fd),
    fields: { tier0_maxHours: '1', tier0_refundPercent: '0', tier1_maxHours: '4', tier1_refundPercent: '30', tier2_maxHours: '8', tier2_refundPercent: '50', tier3_refundPercent: '100' },
    path: '/api/bookings/cancellation-policy',
  },
  { name: 'launch gate', run: (fd) => settings.updateLaunchGateAction(prev, fd), fields: { enabled: 'on' }, path: '/api/auth/launch-gate/admin' },
  { name: 'app versions', run: (fd) => settings.updateAppVersionConfigAction(prev, fd), fields: { customer_android_minVersion: '1.0.0' }, path: APP_CONFIG_PATH },
  { name: 'feature flags', run: (fd) => settings.updateFeatureFlagsAction(prev, fd), fields: { buddyEnabled: 'on' }, path: APP_CONFIG_PATH },
  { name: 'social switch', run: (fd) => settings.updateSocialSwitchAction(prev, fd), fields: { socialEnabled: 'on' }, path: APP_CONFIG_PATH },
  { name: 'maintenance', run: (fd) => settings.updateMaintenanceAction(prev, fd), fields: { feature: 'wallet', enabled: 'on' }, path: APP_CONFIG_PATH },
  { name: 'otp provider', run: (fd) => settings.updateOtpConfigAction(prev, fd), fields: { provider: 'firebase' }, path: '/api/auth/otp-config/admin' },
  { name: 'profile-completion bonus', run: (fd) => settings.updateProfileCompletionBonusAction(prev, fd), fields: { amount: '25' }, path: '/api/auth/profile-completion-bonus/admin' },
  { name: 'topup add preset', run: (fd) => settings.addWalletTopupPresetAction(prev, fd), fields: { amount: '1000' }, path: WALLET_PATH },
  { name: 'topup remove preset', run: (fd) => settings.removeWalletTopupPresetAction(prev, fd), fields: { amount: '200' }, path: WALLET_PATH },
  { name: 'topup custom amount', run: (fd) => settings.updateWalletTopupCustomAmountAction(prev, fd), fields: { allowCustomAmount: 'on', minCustomAmount: '50', maxCustomAmount: '5000' }, path: WALLET_PATH },
  {
    name: 'coin economy',
    run: (fd) => coins.updateEconomyConfigAction(prev, fd),
    fields: { coinsPerCheckin: '10', weeklyTargetBonus: '20', pairedStreakWeeklyBonus: '15', qualifyingCheckinsPerWeek: '2' },
    path: '/api/challenges/admin/coins/economy-config',
  },
  { name: 'coin feature flags', run: (fd) => coins.setCoinFeatureFlagsAction(prev, fd), fields: { streaksCoinsEnabled: 'on' }, path: APP_CONFIG_PATH },
];

describe.each(CASES)('$name', ({ run, fields, path }) => {
  it('forwards the page token as expectedUpdatedAt and saves', async () => {
    const result = await run(form({ ...fields, expectedUpdatedAt: T0 }));
    expect(result.ok).toBe(true);
    expect(result.conflict).toBeUndefined();
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe(path);
    expect(writes[0].body.expectedUpdatedAt).toBe(T0);
  });

  it('sends no expectedUpdatedAt key when the form had no token (backward compatible)', async () => {
    const result = await run(form(fields));
    expect(result.ok).toBe(true);
    expect(writes).toHaveLength(1);
    expect('expectedUpdatedAt' in writes[0].body).toBe(false);
  });

  it('a stale token returns the conflict message and flag, and writes nothing', async () => {
    rows[path] = { updatedAt: T1 }; // someone saved after this page loaded
    const result = await run(form({ ...fields, expectedUpdatedAt: T0 }));
    expect(result).toEqual({ ok: false, conflict: true, message: CONFLICT_MESSAGE });
    expect(writes).toHaveLength(0);
  });
});

describe('two admins, one page load', () => {
  it('the second save of the same app-config blob conflicts instead of overwriting', async () => {
    // Admin A saves flags, admin B (same stale token) then saves app versions.
    const a = await settings.updateFeatureFlagsAction(prev, form({ buddyEnabled: 'on', expectedUpdatedAt: T0 }));
    const b = await settings.updateAppVersionConfigAction(prev, form({ customer_android_minVersion: '9.9.9', expectedUpdatedAt: T0 }));
    expect(a.ok).toBe(true);
    expect(b).toEqual({ ok: false, conflict: true, message: CONFLICT_MESSAGE });
    expect(writes).toHaveLength(1);
  });

  it('after reloading (fresh token) the same edit goes through', async () => {
    await settings.updateFeatureFlagsAction(prev, form({ buddyEnabled: 'on', expectedUpdatedAt: T0 }));
    const retry = await settings.updateAppVersionConfigAction(prev, form({ customer_android_minVersion: '9.9.9', expectedUpdatedAt: T1 }));
    expect(retry.ok).toBe(true);
  });
});

describe('non-conflict failures keep their own message', () => {
  it('a 4xx validation error is not reported as a conflict', async () => {
    gatewayJson.mockRejectedValueOnce(Object.assign(new Error('provider must be one of fast2sms, firebase, skip'), { status: 400 }));
    const result = await settings.updateOtpConfigAction(prev, form({ provider: 'nope', expectedUpdatedAt: T0 }));
    expect(result).toEqual({ ok: false, message: 'provider must be one of fast2sms, firebase, skip' });
  });
});
