// Carries a config row's updatedAt (the optimistic-concurrency token) through a
// form post. Render it inside every form that edits a shared config; the server
// action reads it with expectedUpdatedAtFrom() and sends it as expectedUpdatedAt.
// Renders nothing when the page could not load a token (no row saved yet, or an
// older backend), which is the backward-compatible "no check" path.
import { EXPECTED_UPDATED_AT_FIELD } from '@/lib/configConcurrency';

export function ExpectedUpdatedAt({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  return <input type="hidden" name={EXPECTED_UPDATED_AT_FIELD} value={value} />;
}
