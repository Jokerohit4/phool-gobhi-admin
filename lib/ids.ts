// Parses a form/query value as a positive safe integer id. Returns null for
// anything else (empty, decimals, signs, exponents, path fragments like
// "5/../x"), so ids can be interpolated into gateway paths without letting
// the caller steer the request elsewhere.
export function parsePositiveId(value: FormDataEntryValue | string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[1-9]\d{0,14}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}

export const INVALID_ID_MESSAGE = 'Invalid id';

// For ids whose shape the admin app does not control (string / slug ids):
// returns a URL-encoded single path segment, or null when empty or absurd.
export function parsePathSegment(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return null;
  return encodeURIComponent(trimmed);
}
