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
