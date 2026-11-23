// Optimistic concurrency for shared config edits.
//
// Backend contract (auth-, booking-, wallet-, challenge-service admin config):
//   - The admin GET returns the row's `updatedAt` (top-level on auth-service,
//     inside `data` on the others) - the ETag for that config.
//   - The admin PUT accepts an optional `expectedUpdatedAt`. If it no longer
//     matches the stored value the backend answers 409
//     { errorCode: 'CONFIG_CONFLICT', currentUpdatedAt } and writes nothing.
//
// Admin side: the page loads `updatedAt`, the form carries it in a hidden
// `expectedUpdatedAt` field, the server action forwards it, and a conflict is
// shown as a per-section message instead of silently overwriting.
//
// This file deliberately has no import from '@/lib/api': conflicts are detected
// structurally (errorCode / status) so tests that mock gatewayJson alone keep
// working and the helpers stay usable from any action file.

import type { ActionState } from '@/components/ui/ActionForm';

export const CONFIG_CONFLICT_CODE = 'CONFIG_CONFLICT';
export const EXPECTED_UPDATED_AT_FIELD = 'expectedUpdatedAt';

export const CONFLICT_MESSAGE =
  'Someone else changed this - reload to see the latest, then re-apply your edit.';

// Accepts the shapes the services use: `{ updatedAt }` (auth-service) or
// `{ data: { updatedAt } }` (booking / wallet / challenge). Returns an ISO
// string or null (no row has ever been saved, or the backend predates this).
export function readUpdatedAt(res: unknown): string | null {
  const top = (res as { updatedAt?: unknown } | null | undefined)?.updatedAt;
  const nested = (res as { data?: { updatedAt?: unknown } } | null | undefined)?.data?.updatedAt;
  const raw = top ?? nested;
  if (typeof raw !== 'string' || !raw) return null;
  return Number.isNaN(Date.parse(raw)) ? null : raw;
}

// The token a form posted back. Undefined (not '') when absent so the caller
// can spread it straight into a JSON body and the key simply disappears -
// that is the backward-compatible "no concurrency check" path.
export function expectedUpdatedAtFrom(formData: FormData): string | undefined {
  const raw = formData.get(EXPECTED_UPDATED_AT_FIELD);
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  if (!value || value.length > 64 || Number.isNaN(Date.parse(value))) return undefined;
  return value;
}

export function isConfigConflict(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  // Only the explicit code: other 409s (duplicate allowlist number, slot-time
  // mismatch) are unrelated and keep their own messages.
  return (err as { errorCode?: unknown }).errorCode === CONFIG_CONFLICT_CODE;
}

// ActionState for a failed save: the conflict message (and a `conflict` flag the
// form uses to keep the admin's typed values) or the usual error text.
export function configErrorState(err: unknown, fallback: string): ActionState {
  if (isConfigConflict(err)) return { ok: false, conflict: true, message: CONFLICT_MESSAGE };
  return { ok: false, message: err instanceof Error ? err.message : fallback };
}
