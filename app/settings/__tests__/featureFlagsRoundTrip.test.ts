import { describe, it, expect, vi, beforeEach } from 'vitest';

// The whole config blob (app versions + feature flags + maintenance windows)
// lives in ONE row, so every settings writer has to read-modify-write. This
// file covers the feature-flag writer, and the property under test is the one
// that has silently broken before: saving one toggle must not disturb any
// other flag.
//
// The historical bug is in this file's own comments: the action used to
// rebuild `features` from the form alone, so any flag the form did not render
// was dropped on every save. healthPersonalisation and recapSharing were reset
// that way, repeatedly. It failed SAFE (auth-service defaults them false) so
// nobody noticed for months - a feature quietly switching itself off is exactly
// the kind of failure that gets discovered by a user, not by monitoring.
//
// So this asserts the full post-write state, flag by flag, rather than the one
// flag that was toggled.

vi.mock('@/lib/auth', () => ({ requireSession: vi.fn(async () => ({ id: 1, role: 'gobhi' })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const gatewayJson = vi.fn();
vi.mock('@/lib/api', () => ({ gatewayJson: (...args: unknown[]) => gatewayJson(...args) }));

const loadFlagRegistry = vi.fn();
vi.mock('@/app/settings/flagRegistry', () => ({
  loadFlagRegistry: (...args: unknown[]) => loadFlagRegistry(...args),
}));

const { updateFeatureFlagsAction } = await import('../actions');

// The real registry, as auth-service serves it: 20 flags, only buddy and
// referral defaulting on, and fhirExport deliberately clientKey: null (a
// query-parameter branch on an existing route with no app surface to gate).
const REGISTRY = [
  { name: 'workoutTracking', clientKey: 'workoutTrackingEnabled', group: 'training', deps: [] },
  { name: 'healthMetrics', clientKey: 'healthMetricsEnabled', group: 'health', deps: ['workoutTracking'] },
  { name: 'healthVault', clientKey: 'healthVaultEnabled', group: 'health', deps: [] },
  { name: 'healthLedger', clientKey: 'healthLedgerEnabled', group: 'health', deps: ['healthMetrics'] },
  { name: 'foodPhotoLogging', clientKey: 'foodPhotoLoggingEnabled', group: 'health', deps: ['healthLedger'] },
  { name: 'healthPersonalisation', clientKey: 'healthPersonalisationEnabled', group: 'health', deps: ['healthMetrics'] },
  { name: 'recapSharing', clientKey: 'recapSharingEnabled', group: 'health', deps: ['healthMetrics'] },
  { name: 'fitnessAssistant', clientKey: 'fitnessAssistantEnabled', group: 'health', deps: ['healthMetrics'] },
  { name: 'runTracker', clientKey: 'runTrackerEnabled', group: 'health', deps: ['healthMetrics'] },
  { name: 'cycleTracking', clientKey: 'cycleTrackingEnabled', group: 'health', deps: ['healthMetrics'] },
  { name: 'fhirExport', clientKey: null, group: 'health', deps: ['healthMetrics'] },
  { name: 'badges', clientKey: 'badgesEnabled', group: 'gamification', deps: [] },
  { name: 'streaksCoins', clientKey: 'streaksCoinsEnabled', group: 'gamification', deps: [] },
  { name: 'challenges', clientKey: 'challengesEnabled', group: 'gamification', deps: [] },
  { name: 'buddyPairedStreaks', clientKey: 'buddyPairedStreaksEnabled', group: 'gamification', deps: [] },
  { name: 'buddy', clientKey: 'buddyEnabled', group: 'social', deps: [] },
  { name: 'referral', clientKey: 'referralEnabled', group: 'social', deps: [] },
  { name: 'brandedOnboarding', clientKey: 'brandedOnboardingEnabled', group: 'onboarding', deps: [] },
  { name: 'homeTrackHome', clientKey: 'homeTrackHomeEnabled', group: 'onboarding', deps: ['workoutTracking'] },
  { name: 'nonPartnerAttendance', clientKey: 'nonPartnerAttendanceEnabled', group: 'ops', deps: [] },
].map((f) => ({
  ...f,
  defaultEnabled: f.name === 'buddy' || f.name === 'referral',
  enabled: f.name === 'buddy' || f.name === 'referral',
  blockedBy: [],
  blastRadius: '',
  rationale: '',
}));

// A stored blob with a deliberately uneven mix, because a round trip that only
// ever sees uniform values cannot distinguish "preserved" from "reset to
// default". healthPersonalisation and recapSharing are on here specifically:
// they are the two the old form-only rebuild used to wipe.
const STORED_ON = new Set([
  'buddy',
  'referral',
  'healthPersonalisation',
  'recapSharing',
  'badges',
  'runTracker',
]);

const STORED_FEATURES: Record<string, { enabled: boolean }> = Object.fromEntries(
  REGISTRY.map((f) => [f.name, { enabled: STORED_ON.has(f.name) }])
);

const STORED_VERSIONS = {
  customer: {
    android: { minVersion: '1.4.0', latestVersion: '1.6.0', updateUrl: 'https://play.google.com/…', message: '' },
    ios: { minVersion: '', latestVersion: '', updateUrl: '', message: '' },
  },
  partner: { android: { minVersion: '', latestVersion: '', updateUrl: '', message: '' }, ios: { minVersion: '', latestVersion: '', updateUrl: '', message: '' } },
};

const STORED_MAINTENANCE = {
  wallet: { enabled: false, startsAt: null, endsAt: null, message: '' },
  gyms: { enabled: true, startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-10-02T00:00:00.000Z', message: 'Gym list maintenance' },
};

let stored: Record<string, unknown>;
let puts: Array<Record<string, unknown>>;

/** A real browser posts every rendered checkbox: 'on' when ticked, absent when not. */
function formWith(checked: Set<string>) {
  const fd = new FormData();
  for (const flag of REGISTRY) {
    if (checked.has(flag.name)) fd.set(flag.clientKey || flag.name, 'on');
  }
  return fd;
}

/**
 * What the settings page actually submits: every registry flag, ticked
 * according to the value the server reported, with `overrides` applied on top
 * to stand in for the admin clicking one toggle.
 */
function formAsPageRenders(overrides: Record<string, boolean> = {}) {
  const fd = new FormData();
  for (const flag of REGISTRY) {
    const on = overrides[flag.name] ?? STORED_FEATURES[flag.name].enabled;
    if (on) fd.set(flag.clientKey || flag.name, 'on');
  }
  return fd;
}

function writtenFeatures(): Record<string, { enabled: boolean }> {
  expect(puts).toHaveLength(1);
  const body = puts[0];
  return (body.config as { features: Record<string, { enabled: boolean }> }).features;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Shaped exactly as GET /api/auth/app-config/admin returns it: `features`
  // nested under its own key, siblings being the version maps + maintenance.
  // Flattening the flags into the top level here silently yields an empty
  // `current.features`, and then every flag is rebuilt from an unchecked form -
  // which is the wipe this test exists to catch, so the fixture had better be
  // right about the envelope.
  stored = { features: structuredClone(STORED_FEATURES), ...structuredClone(STORED_VERSIONS), maintenance: structuredClone(STORED_MAINTENANCE) };
  puts = [];
  loadFlagRegistry.mockResolvedValue({ flags: REGISTRY, failed: false });
  gatewayJson.mockImplementation(async (path: string, init?: { method?: string; body?: string }) => {
    if (init?.method === 'PUT') {
      puts.push(JSON.parse(init.body as string));
      return { data: { ok: true } };
    }
    if (path === '/api/auth/app-config/admin') return { data: structuredClone(stored) };
    throw new Error(`unexpected GET ${path}`);
  });
});

describe('updateFeatureFlagsAction round trip', () => {
  it('writes every registry flag even when the form carries no keys at all', async () => {
    // An unchecked checkbox is not submitted, so "every flag off" and "the form
    // rendered nothing" arrive as the SAME empty FormData. There is no way for
    // this action to tell them apart, which means it cannot refuse an empty
    // form without also blocking a legitimate turn-everything-off.
    //
    // So this is pinned as documented behaviour rather than guarded: bulk
    // profiles (all-off, launch-candidate, consent-minimal) must go through
    // auth-service's seedFeatureFlags script, which addresses flags by name and
    // so is immune to whatever a stale settings page happens to render.
    //
    // The partial-render case - some flags missing from the POST - is the one
    // that quietly resets features, and it is covered by the registry being the
    // single source for both the render and this loop.
    const result = await updateFeatureFlagsAction({ ok: false, message: '' }, new FormData());

    expect(result.ok).toBe(true);
    const features = writtenFeatures();
    expect(Object.keys(features).sort()).toEqual(REGISTRY.map((f) => f.name).sort());
    expect(Object.values(features).every((v) => v.enabled === false)).toBe(true);
  });

  it('leaves the other 19 flags at their stored value when one is toggled', async () => {
    const result = await updateFeatureFlagsAction(
      { ok: false, message: '' },
      formAsPageRenders({ challenges: true })
    );

    expect(result.ok).toBe(true);
    const features = writtenFeatures();

    expect(Object.keys(features).sort()).toEqual(REGISTRY.map((f) => f.name).sort());
    for (const flag of REGISTRY) {
      if (flag.name === 'challenges') continue;
      expect(features[flag.name], `${flag.name} was disturbed by an unrelated save`).toEqual(
        STORED_FEATURES[flag.name]
      );
    }
    expect(features.challenges).toEqual({ enabled: true });
  });

  it('changes exactly the flag that was toggled, in either direction', async () => {
    for (const [flag, to] of [
      ['challenges', true],
      ['badges', false],
    ] as const) {
      puts = [];
      await updateFeatureFlagsAction({ ok: false, message: '' }, formAsPageRenders({ [flag]: to }));
      const features = writtenFeatures();
      const changed = REGISTRY
        .map((f) => f.name)
        .filter((name) => features[name].enabled !== STORED_FEATURES[name].enabled);
      expect(changed, `toggling ${flag} should change only ${flag}`).toEqual([flag]);
    }
  });

  it('treats the rendered form as authoritative, so unticking really does switch off', async () => {
    // The flip side of the above, and the reason the action overwrites rather
    // than merges: a rendered-but-unticked checkbox means OFF, not "leave
    // whatever was stored". If this ever silently became a merge, no admin
    // would be able to turn a feature off.
    const result = await updateFeatureFlagsAction({ ok: false, message: '' }, formWith(new Set()));

    expect(result.ok).toBe(true);
    const features = writtenFeatures();
    for (const flag of REGISTRY) {
      expect(features[flag.name], `${flag.name} should be off`).toEqual({ enabled: false });
    }
  });

  it('posts a null-clientKey flag under its own name', async () => {
    // fhirExport has clientKey: null - it is a query-parameter branch on an
    // existing route with no app surface, so the form posts it by flag name.
    // Reading clientKey unconditionally would write a key literally called
    // "null" and leave the real flag stuck at its stored value.
    const result = await updateFeatureFlagsAction({ ok: false, message: '' }, formWith(new Set(['fhirExport'])));

    expect(result.ok).toBe(true);
    const features = writtenFeatures();
    expect(features.fhirExport).toEqual({ enabled: true });
    expect(features).not.toHaveProperty('null');
    expect(features).not.toHaveProperty('undefined');
  });

  it('preserves a stored flag the registry does not know about', async () => {
    // A flag written by a newer auth-service, or one an operator added by hand.
    // The action starts from the stored blob precisely so an unrendered key
    // survives; dropping it would silently delete a flag the portal has never
    // heard of.
    stored = {
      features: { ...structuredClone(STORED_FEATURES), somethingFromANewerServer: { enabled: true } },
      ...structuredClone(STORED_VERSIONS),
      maintenance: structuredClone(STORED_MAINTENANCE),
    };

    await updateFeatureFlagsAction({ ok: false, message: '' }, formWith(new Set()));

    const features = writtenFeatures();
    expect(features.somethingFromANewerServer).toEqual({ enabled: true });
  });

  it('resubmits app versions and maintenance windows alongside the flags', async () => {
    // One row, three concerns. A flag save that rebuilt the blob from the
    // flags alone would drop the force-update minimums and the maintenance
    // windows - which is how a min-version gate or a maintenance lock gets
    // switched off by someone toggling an unrelated feature.
    await updateFeatureFlagsAction({ ok: false, message: '' }, formWith(new Set(['badges'])));

    const config = puts[0].config as Record<string, unknown>;
    expect(config.customer).toEqual(STORED_VERSIONS.customer);
    expect(config.partner).toEqual(STORED_VERSIONS.partner);
    expect(config.maintenance).toEqual(STORED_MAINTENANCE);
  });

  it('refuses to save at all when the registry cannot be loaded', async () => {
    // The dangerous version of this bug is a fallback list: saving would write
    // back a subset and turn every omitted flag off. Refusing is the only safe
    // response, so assert no PUT is attempted.
    loadFlagRegistry.mockResolvedValue({ flags: [], failed: true });

    const result = await updateFeatureFlagsAction({ ok: false, message: '' }, formWith(new Set(['runTracker'])));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/refusing to save/i);
    expect(puts).toHaveLength(0);
  });

  it('also refuses when the registry returns an empty list without flagging a failure', async () => {
    loadFlagRegistry.mockResolvedValue({ flags: [], failed: false });

    const result = await updateFeatureFlagsAction({ ok: false, message: '' }, formWith(new Set(['runTracker'])));

    expect(result.ok).toBe(false);
    expect(puts).toHaveLength(0);
  });

  it('surfaces a gateway failure instead of reporting success', async () => {
    gatewayJson.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === 'PUT') throw new Error('gateway down');
      if (path === '/api/auth/app-config/admin') return { data: structuredClone(stored) };
      throw new Error(`unexpected GET ${path}`);
    });

    const result = await updateFeatureFlagsAction({ ok: false, message: '' }, formWith(new Set(['runTracker'])));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/gateway down/);
  });
});
