import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Renders each config page with a fake gateway and checks the hidden
// `expectedUpdatedAt` field reaches every form that edits a shared config row,
// carrying the row's updatedAt from the load (not a fresh value or a blank).

vi.mock('@/lib/auth', () => ({ requireSession: vi.fn(async () => ({ id: 1, role: 'gobhi' })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/settings', useRouter: () => ({}) }));

const gatewayJson = vi.fn();
vi.mock('@/lib/api', () => ({ gatewayJson: (...args: unknown[]) => gatewayJson(...args) }));
vi.mock('@/app/settings/flagRegistry', () => ({
  loadFlagRegistry: async () => ({
    failed: false,
    flags: [{ name: 'buddy', clientKey: 'buddyEnabled', group: 'social', deps: [], defaultEnabled: false, enabled: false, blockedBy: [], blastRadius: '', rationale: '' }],
  }),
  registryDrift: () => ({ missing: [], unexpected: [] }),
}));

const APP = '2026-10-01T10:00:00.000Z';
const GATE = '2026-10-02T10:00:00.000Z';
const OTP = '2026-10-03T10:00:00.000Z';
const BONUS = '2026-10-04T10:00:00.000Z';
const POLICY = '2026-10-05T10:00:00.000Z';
const TOPUP = '2026-10-06T10:00:00.000Z';
const ECON = '2026-10-07T10:00:00.000Z';

const RESPONSES: Record<string, unknown> = {
  '/api/auth/app-config/admin': { data: { customer: {}, features: {}, maintenance: {} }, updatedAt: APP },
  '/api/auth/launch-gate/admin': { data: { enabled: false, launchAt: null }, updatedAt: GATE },
  '/api/auth/otp-config/admin': { data: { provider: 'firebase' }, updatedAt: OTP },
  '/api/auth/otp-config/admin/skip-allowlist': { data: [] },
  '/api/auth/profile-completion-bonus/admin': { data: { amount: 20 }, updatedAt: BONUS },
  '/api/bookings/cancellation-policy': { data: { tiers: [], updatedAt: POLICY } },
  '/api/wallet/topup-config': {
    data: { presets: [200], allowCustomAmount: false, minCustomAmount: null, maxCustomAmount: null, updatedAt: TOPUP },
  },
  '/api/challenges/admin/coins/economy-config': {
    data: { coinsPerCheckin: 10, weeklyTargetBonus: 20, milestones: {}, pairedStreakWeeklyBonus: 15, qualifyingCheckinsPerWeek: 2, updatedAt: ECON },
  },
  '/api/challenges/admin/coins/catalog': { data: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  gatewayJson.mockImplementation(async (path: string) => {
    if (!(path in RESPONSES)) throw new Error(`unexpected gateway call ${path}`);
    return RESPONSES[path];
  });
});

async function html(loader: () => Promise<{ default: () => Promise<React.ReactElement> }>) {
  const { default: Page } = await loader();
  return renderToStaticMarkup(await Page());
}

function tokens(markup: string): string[] {
  return [...markup.matchAll(/<input[^>]*name="expectedUpdatedAt"[^>]*>/g)].map((m) => /value="([^"]*)"/.exec(m[0])?.[1] ?? '');
}

describe('settings pages carry expectedUpdatedAt in every config form', () => {
  it('app versions: the app-config token', async () => {
    expect(tokens(await html(() => import('../app-versions/page')))).toEqual([APP]);
  });

  it('flags & social: flag form and social switch both carry the app-config token', async () => {
    expect(tokens(await html(() => import('../flags-social/page')))).toEqual([APP, APP]);
  });

  it('launch & maintenance: gate uses its own token, both maintenance forms the app-config token', async () => {
    expect(tokens(await html(() => import('../launch-maintenance/page')))).toEqual([GATE, APP, APP]);
  });

  it('otp & auth: the OTP provider form carries the OTP row token', async () => {
    expect(tokens(await html(() => import('../otp-auth/page')))).toEqual([OTP]);
  });

  it('policy & billing: each form carries its own row token', async () => {
    const found = tokens(await html(() => import('../policy-billing/page')));
    // cancellation policy, remove-preset (one preset), add-preset, custom amount, bonus
    expect(found).toEqual([POLICY, TOPUP, TOPUP, TOPUP, BONUS]);
  });

  it('coins: switches use the app-config token, economy form its own', async () => {
    expect(tokens(await html(() => import('@/app/gamification/coins/page')))).toEqual([APP, ECON]);
  });

  it('renders no token field (and still renders) when the backend sends no updatedAt', async () => {
    gatewayJson.mockImplementation(async (path: string) => {
      const base = RESPONSES[path] as { data?: unknown } | undefined;
      if (!base) throw new Error(`unexpected gateway call ${path}`);
      return { data: base.data };
    });
    expect(tokens(await html(() => import('../otp-auth/page')))).toEqual([]);
    expect(tokens(await html(() => import('../app-versions/page')))).toEqual([]);
  });
});
