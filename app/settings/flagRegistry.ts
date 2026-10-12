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
const COACH_FLAGS = [
  {
    name: 'coachJourney',
    defaultEnabled: false,
    deps: ['workoutTracking', 'nonPartnerAttendance'],
    clientKey: 'coachJourneyEnabled',
    group: 'coach',
    dataClass: 'health-derived',
    blastRadius:
      'New onboarding, Home overview, Plan tab, journey and habit APIs, and the plan/score read without nutrition consent',
    rationale:
      'Umbrella flag for the coach journey: the new onboarding, the Home overview, the ' +
      'Plan tab, the journey/habit APIs, and letting the plan and score read on `basic` ' +
      'consent alone. In prod it needs `workoutTracking` (the daily log the journey is ' +
      'graded on) and `nonPartnerAttendance` (non-partner gym search and check-in) on too, ' +
      'which is why both are deps: without them the journey has nothing to score. Off until ' +
      'the app-version minimum is raised, and REQUIRED to be byte-for-byte the old ' +
      'behaviour while off, so existing screens and tests stay green.',
  },
  {
    name: 'selfLinkGym',
    defaultEnabled: false,
    deps: [],
    clientKey: 'selfLinkGymEnabled',
    group: 'coach',
    dataClass: 'none',
    blastRadius:
      'Self-link and leave-gym endpoints (POST/DELETE /gym-links/self) and the linked-member Home',
    rationale:
      'Lets a customer attach themselves to a partner gym without a QR, so it is a ' +
      'membership claim the gym can be billed off — needs the raised app-version minimum ' +
      'first, because older builds do not read the linked-member fields /me returns and ' +
      'would fall back to the marketplace Home silently. Deliberately its own flag rather ' +
      'than part of coachJourney so the link surface can be held back independently.',
  },
  {
    name: 'referralHomeTrigger',
    defaultEnabled: false,
    deps: ['coachJourney'],
    clientKey: 'referralHomeTriggerEnabled',
    group: 'coach',
    dataClass: 'none',
    blastRadius:
      'Referral payout on a friend\'s 3rd showed-up day (a second trigger beside the first-booking one)',
    rationale:
      'A second referral trigger that credits the referrer when the referred friend reaches ' +
      'their 3rd showed-up day instead of only on their first completed booking. It is ' +
      'evaluated inside journeyService.get, so it is inert without `coachJourney` — hence ' +
      'the dep rather than a bare flag. Money moves on it, so it is last in the rollout ' +
      'order and stays off until the showed-up-day rules are verified on dev.',
  },
  {
    name: 'coachAssistant',
    defaultEnabled: false,
    deps: ['coachJourney'],
    clientKey: 'coachAssistantEnabled',
    group: 'coach',
    dataClass: 'health-derived',
    blastRadius:
      'The new grounded AI coach guardrail path (reads plan summary and approved content)',
    rationale:
      'Kill switch for the new grounded guardrail path in the AI coach — it answers with the ' +
      'user\'s plan summary plus approved articles and exercise content. Kept separate from ' +
      'coachJourney so the assistant can be pulled without taking the journey down, and ' +
      'layered on `coachJourney` because there is nothing to ground on without a journey. ' +
      'Off until the disclaimer and grounding wording are reviewed.',
  },
] as const;

export interface FlagRegistryEntry {
  name: string;
  defaultEnabled: boolean;
  enabled: boolean;
  clientKey: string | null;
  group: string;
  deps: string[];
  blockedBy: string[];
  blastRadius: string;
  rationale: string;
}

/**
 * Returns the full flag registry: the server's registry (which always includes
 * every flag auth-service knows about) merged with the coach flags that must
 * also be present. This is the single source of truth for the admin portal.
 */
export async function loadFlagRegistry(): Promise<{
  flags: FlagRegistryEntry[];
  failed: boolean;
}> {
  try {
    const { data } = await gatewayJson<{ data: FlagRegistryEntry[] }>(
      '/api/auth/app-config/registry'
    );
    const serverFlags = Array.isArray(data) ? data : [];
    // Merge server flags with coach flags — the server already returns them
    // since they are registered in auth-service's featureFlagRegistry.js, but we
    // also keep them here as the authoritative local source.
    const allFlags = [...serverFlags, ...COACH_FLAGS];
    return { flags: allFlags, failed: false };
  } catch (err) {
    console.error('loadFlagRegistry: registry endpoint unreachable:', err);
    // Fall back to just the coach flags if the server is unreachable, so the
    // page still renders something rather than an empty list.
    return { flags: COACH_FLAGS, failed: true };
  }
}
