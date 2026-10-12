import { gatewayJson } from '@/lib/api';

// The feature-flag registry, read from auth-service.
//
// WHY THIS FILE EXISTS
//
// The admin portal used to declare its own list of feature-flag names — in
// `actions.ts` for the write path, in `page.tsx` for the render path, plus a
// `DEFAULT_FEATURES` literal in each that carried the comment "must match
// auth-service's own DEFAULT_FEATURES exactly". That comment was an admission
// the three could drift, and they did:
//
//   - `runTracker` shipped server-side and was the only flag off in dev, and was
//     absent from both lists. It could not be switched on from this portal at
//     all — only a direct config-blob edit or a code deploy reached it, which is
//     precisely what shipping a feature behind a flag is supposed to prevent.
//   - `referral` was read by the customer app and declared nowhere, so it used
//     the client's own fail-open default forever, with no backend gate and no
//     control here.
//   - `fhirExport` had been checked by health-service since ABHA Stage 0 and
//     appeared in no list at all.
//
// auth-service now owns the list (`config/featureFlagRegistry.js`) and serves it
// from `GET /api/auth/app-config/registry`. This module is the single place in
// this app that fetches it, and `app/auth-service` never redeclares a name.
//
// Kept in its own module rather than in `actions.ts` because that file is
// `'use server'`, where Next.js requires every export to be an async function —
// and a page importing a loader from there would be importing across that
// boundary.

export interface FlagRegistryEntry {
  name: string;
  /** What the flag does when nothing has been stored for it. */
  defaultEnabled: boolean;
  /** The live effective value: the stored blob, or `defaultEnabled`. */
  enabled: boolean;
  /** The customer app's field for this flag; null when there is no app surface. */
  clientKey: string | null;
  /** Rendering group. */
  group: string;
  /** Flags this one sits on top of. */
  deps: string[];
  /** deps that name a flag that does not exist — should always be empty. */
  blockedBy: string[];
  /** One line on what turning this off actually switches off. */
  blastRadius: string;
  /** Why the flag is separate, and what is known to be wrong with it. */
  rationale: string;
}

/**
 * `failed: true` means the caller must NOT fall back to a locally-declared list.
 * A silent fallback here is the exact drift this replaced: it would render some
 * subset of toggles, and saving would write back only that subset — turning
 * every omitted flag off. Both callers treat `failed` as "show the error, refuse
 * to save".
 */
export async function loadFlagRegistry(): Promise<{
  flags: FlagRegistryEntry[];
  failed: boolean;
}> {
  try {
    const { data } = await gatewayJson<{ data: FlagRegistryEntry[] }>(
      '/api/auth/app-config/registry'
    );
    return { flags: Array.isArray(data) ? data : [], failed: false };
  } catch (err) {
    console.error('loadFlagRegistry: registry endpoint unreachable:', err);
    return { flags: [], failed: true };
  }
}

// ---------------------------------------------------------------------------
// Expected registry (parity mirror)
//
// A mirror of auth-service's `config/featureFlagRegistry.js` (name, default,
// deps, clientKey, group — in the same order). It is NOT a source for rendering
// or saving: the live list above is still the only thing either path uses, and
// a failed registry load still refuses to save. This copy exists for two checks
// only:
//
//   - the parity test pins it (and, when the backend repo is checked out next to
//     this one, compares it with the real file), so a flag added to auth without
//     the portal knowing shows up as a failing test rather than a surprise;
//   - the settings page compares it with the live registry and warns when the
//     auth-service it is talking to is older or newer than this portal.
//
// Registering a name here never changes a flag's value. Values only change
// when an admin saves the flags form.
export interface ExpectedFlag {
  name: string;
  defaultEnabled: boolean;
  deps: string[];
  clientKey: string | null;
  group: string;
}

export const EXPECTED_FLAGS: readonly ExpectedFlag[] = [
  { name: 'workoutTracking', defaultEnabled: false, deps: [], clientKey: 'workoutTrackingEnabled', group: 'training' },
  { name: 'healthMetrics', defaultEnabled: false, deps: ['workoutTracking'], clientKey: 'healthMetricsEnabled', group: 'health' },
  { name: 'healthVault', defaultEnabled: false, deps: [], clientKey: 'healthVaultEnabled', group: 'health' },
  { name: 'healthLedger', defaultEnabled: false, deps: ['healthMetrics'], clientKey: 'healthLedgerEnabled', group: 'health' },
  { name: 'foodPhotoLogging', defaultEnabled: false, deps: ['healthLedger'], clientKey: 'foodPhotoLoggingEnabled', group: 'health' },
  { name: 'healthPersonalisation', defaultEnabled: false, deps: ['healthMetrics'], clientKey: 'healthPersonalisationEnabled', group: 'health' },
  { name: 'recapSharing', defaultEnabled: false, deps: ['healthMetrics'], clientKey: 'recapSharingEnabled', group: 'health' },
  { name: 'fitnessAssistant', defaultEnabled: false, deps: ['healthMetrics'], clientKey: 'fitnessAssistantEnabled', group: 'health' },
  { name: 'runTracker', defaultEnabled: false, deps: ['healthMetrics'], clientKey: 'runTrackerEnabled', group: 'health' },
  { name: 'cycleTracking', defaultEnabled: false, deps: ['healthMetrics'], clientKey: 'cycleTrackingEnabled', group: 'health' },
  { name: 'fhirExport', defaultEnabled: false, deps: ['healthMetrics'], clientKey: null, group: 'health' },
  { name: 'badges', defaultEnabled: false, deps: [], clientKey: 'badgesEnabled', group: 'gamification' },
  { name: 'streaksCoins', defaultEnabled: false, deps: [], clientKey: 'streaksCoinsEnabled', group: 'gamification' },
  { name: 'challenges', defaultEnabled: false, deps: [], clientKey: 'challengesEnabled', group: 'gamification' },
  { name: 'buddyPairedStreaks', defaultEnabled: false, deps: [], clientKey: 'buddyPairedStreaksEnabled', group: 'gamification' },
  { name: 'buddy', defaultEnabled: false, deps: [], clientKey: 'buddyEnabled', group: 'social' },
  { name: 'referral', defaultEnabled: true, deps: [], clientKey: 'referralEnabled', group: 'social' },
  { name: 'brandedOnboarding', defaultEnabled: false, deps: [], clientKey: 'brandedOnboardingEnabled', group: 'onboarding' },
  { name: 'homeTrackHome', defaultEnabled: false, deps: ['workoutTracking'], clientKey: 'homeTrackHomeEnabled', group: 'onboarding' },
  { name: 'coachJourney', defaultEnabled: false, deps: ['workoutTracking', 'nonPartnerAttendance'], clientKey: 'coachJourneyEnabled', group: 'coach' },
  { name: 'selfLinkGym', defaultEnabled: false, deps: [], clientKey: 'selfLinkGymEnabled', group: 'coach' },
  { name: 'referralHomeTrigger', defaultEnabled: false, deps: ['coachJourney'], clientKey: 'referralHomeTriggerEnabled', group: 'coach' },
  { name: 'coachAssistant', defaultEnabled: false, deps: ['coachJourney'], clientKey: 'coachAssistantEnabled', group: 'coach' },
  { name: 'nonPartnerAttendance', defaultEnabled: false, deps: [], clientKey: 'nonPartnerAttendanceEnabled', group: 'ops' },
];

/** Names the live registry lacks (auth-service older than this portal) and
 * names it has that this portal does not expect (auth-service newer). */
export function registryDrift(live: ReadonlyArray<{ name: string }>): {
  missing: string[];
  unexpected: string[];
} {
  const liveNames = new Set(live.map((f) => f.name));
  const expectedNames = new Set(EXPECTED_FLAGS.map((f) => f.name));
  return {
    missing: EXPECTED_FLAGS.map((f) => f.name).filter((n) => !liveNames.has(n)),
    unexpected: [...liveNames].filter((n) => !expectedNames.has(n)),
  };
}
