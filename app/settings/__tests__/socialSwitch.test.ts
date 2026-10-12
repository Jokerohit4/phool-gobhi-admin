import { describe, it, expect, vi, beforeEach } from 'vitest';

// The social switch writes config.social.enabled through the existing
// app-config admin PUT, which replaces the whole blob. The property under test:
// a save changes social.enabled and NOTHING else.

vi.mock('@/lib/auth', () => ({ requireSession: vi.fn(async () => ({ id: 1, role: 'gobhi' })) }));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const gatewayJson = vi.fn();
vi.mock('@/lib/api', () => ({ gatewayJson: (...args: unknown[]) => gatewayJson(...args) }));

const { updateSocialSwitchAction } = await import('../actions');
const { withSocialEnabled, socialEnabledFrom } = await import('@/lib/socialApi');
const { needsSocialConfirm } = await import('../SocialSwitch');

const STORED = {
  customer: { android: { minVersion: '1.4.0', latestVersion: '1.6.0', updateUrl: 'x', message: '' } },
  partner: { ios: { minVersion: '', latestVersion: '', updateUrl: '', message: '' } },
  features: { buddy: { enabled: true }, coachJourney: { enabled: false }, otp: { provider: 'firebase' } },
  maintenance: { wallet: { enabled: false, startsAt: null, endsAt: null, message: '' } },
  social: { enabled: false, note: 'kept' },
};

let puts: Array<{ config: Record<string, unknown> }>;
let stored: Record<string, unknown> | null;

function form(on: boolean): FormData {
  const fd = new FormData();
  if (on) fd.set('socialEnabled', 'on');
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  puts = [];
  stored = structuredClone(STORED);
  gatewayJson.mockImplementation(async (p: string, init?: { method?: string; body?: string }) => {
    if (init?.method === 'PUT') {
      puts.push(JSON.parse(init.body as string));
      return { data: {} };
    }
    if (p === '/api/auth/app-config/admin') return { data: stored };
    throw new Error(`unexpected GET ${p}`);
  });
});

describe('updateSocialSwitchAction', () => {
  it('sets only social.enabled and keeps every other config key', async () => {
    const result = await updateSocialSwitchAction({}, form(true));

    expect(result).toEqual({ ok: true, message: 'Social features switched on' });
    expect(puts).toHaveLength(1);
    expect(puts[0].config).toEqual({ ...STORED, social: { enabled: true, note: 'kept' } });
    expect(revalidatePath).toHaveBeenCalledWith('/settings');
  });

  it('switches off without touching features (never changes a flag value)', async () => {
    stored = { ...structuredClone(STORED), social: { enabled: true } };
    await updateSocialSwitchAction({}, form(false));
    expect(puts[0].config.social).toEqual({ enabled: false });
    expect(puts[0].config.features).toEqual(STORED.features);
  });

  it('adds social to a blob that never had it', async () => {
    const { social: _omit, ...withoutSocial } = structuredClone(STORED);
    void _omit;
    stored = withoutSocial;
    await updateSocialSwitchAction({}, form(true));
    expect(puts[0].config).toEqual({ ...withoutSocial, social: { enabled: true } });
  });

  it('refuses to write when the current config cannot be read', async () => {
    stored = null;
    const result = await updateSocialSwitchAction({}, form(true));
    expect(result.ok).toBe(false);
    expect(puts).toHaveLength(0);
  });

  it('surfaces a gateway failure instead of reporting success', async () => {
    gatewayJson.mockRejectedValue(new Error('auth-service unavailable'));
    const result = await updateSocialSwitchAction({}, form(true));
    expect(result).toEqual({ ok: false, message: 'auth-service unavailable' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('social helpers', () => {
  it('defaults to off unless a stored true', () => {
    expect(socialEnabledFrom({})).toBe(false);
    expect(socialEnabledFrom(null)).toBe(false);
    expect(socialEnabledFrom({ social: { enabled: 'true' } })).toBe(false);
    expect(socialEnabledFrom({ social: { enabled: true } })).toBe(true);
  });

  it('withSocialEnabled replaces a malformed social value', () => {
    expect(withSocialEnabled({ a: 1, social: 'yes' }, false)).toEqual({ a: 1, social: { enabled: false } });
  });

  it('asks for confirmation only when turning social on', () => {
    expect(needsSocialConfirm(false, true)).toBe(true);
    expect(needsSocialConfirm(true, true)).toBe(false);
    expect(needsSocialConfirm(true, false)).toBe(false);
    expect(needsSocialConfirm(false, false)).toBe(false);
  });
});
