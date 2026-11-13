// Pure helpers for the content review queue (D4). No server imports here, so
// both the page (server) and the item rows (client) can use them.

export const CONTENT_TYPES = ['exercise', 'article'] as const;
export const CONTENT_LANGS = ['en', 'hinglish', 'hi'] as const;
export const CONTENT_STATUSES = ['pending', 'approved', 'rejected'] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];
export type ContentLang = (typeof CONTENT_LANGS)[number];
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const LANG_LABELS: Record<ContentLang, string> = {
  en: 'English',
  hinglish: 'Hinglish',
  hi: 'Hindi',
};

export const STATUS_LABELS: Record<ContentStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const EXERCISE_LIST_FIELDS = ['steps', 'feelCues', 'mistakes'] as const;
export type ExerciseListField = (typeof EXERCISE_LIST_FIELDS)[number];

export const EXERCISE_FIELD_LABELS: Record<ExerciseListField, string> = {
  steps: 'Steps',
  feelCues: 'Feel cues',
  mistakes: 'Mistakes',
};

export const CONTENT_CHANGED_MESSAGE = 'This item changed — reload to review the new version';

export interface QueueFilters {
  type: ContentType | null;
  lang: ContentLang | null;
  status: ContentStatus;
}

function pick<T extends string>(allowed: readonly T[], value: unknown): T | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/// searchParams → filters. Unknown values fall back to "all" (type, lang) or
/// to pending (status) instead of sending the backend a value it would 400 on.
export function parseFilters(params: Record<string, string | string[] | undefined>): QueueFilters {
  return {
    type: pick(CONTENT_TYPES, params.type),
    lang: pick(CONTENT_LANGS, params.lang),
    status: pick(CONTENT_STATUSES, params.status) ?? 'pending',
  };
}

/// Filters → the queue endpoint's query string (without the leading "?").
export function buildQueueQuery(filters: Partial<QueueFilters>): string {
  const qs = new URLSearchParams();
  if (filters.type) qs.set('type', filters.type);
  if (filters.lang) qs.set('lang', filters.lang);
  if (filters.status) qs.set('status', filters.status);
  return qs.toString();
}

/// Link to the /content page with one filter changed. `null` clears it.
export function filterHref(current: QueueFilters, change: Partial<QueueFilters>): string {
  const next = { ...current, ...change };
  const qs = new URLSearchParams();
  if (next.type) qs.set('type', next.type);
  if (next.lang) qs.set('lang', next.lang);
  if (next.status && next.status !== 'pending') qs.set('status', next.status);
  const s = qs.toString();
  return s ? `/content?${s}` : '/content';
}

// Safety words a reviewer must check line by line in a translation. Latin
// words match at a word start, so "stopping", "painful", "rukna" and "dard"
// count but "standard" does not. Devanagari matches anywhere (JS \b only
// understands ASCII word characters). Any digit - Latin or Devanagari - counts,
// because reps, seconds and kilos are where a bad translation hurts someone.
const LATIN_SAFETY = /\b(stop|pain|hurt|doctor|trainer|ruk|dard)/i;
const DEVANAGARI_SAFETY = /(रुक|दर्द|डॉक्टर|ट्रेनर)/;
const ANY_DIGIT = /[0-9०-९]/;

export function isSafetyLine(line: string | null | undefined): boolean {
  if (!line) return false;
  return LATIN_SAFETY.test(line) || DEVANAGARI_SAFETY.test(line) || ANY_DIGIT.test(line);
}

/// True when a translation and its English master have a different number of
/// lines. A missing master (no English row yet) is not a mismatch.
export function lineCountDiffers(
  translation: readonly unknown[] | null | undefined,
  master: readonly unknown[] | null | undefined,
): boolean {
  if (!master) return false;
  return (translation?.length ?? 0) !== master.length;
}

/// Article bodies are reviewed paragraph by paragraph.
export function bodyParagraphs(body: string | null | undefined): string[] {
  if (!body) return [];
  return body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/// One textarea line per list item: blank lines are dropped, the rest trimmed.
export function textToLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function linesToText(lines: readonly string[] | null | undefined): string {
  return (lines ?? []).join('\n');
}

export type ExerciseEdit = Partial<Record<ExerciseListField, string[]>>;
export interface ArticleEdit {
  title?: string;
  body?: string;
}

/// Keep only the fields the backend lets an admin edit for this type. Status,
/// version, reviewer and language never travel in an edit.
export function editPayload(type: ContentType, input: Record<string, unknown>): ExerciseEdit | ArticleEdit {
  if (type === 'exercise') {
    const out: ExerciseEdit = {};
    for (const f of EXERCISE_LIST_FIELDS) {
      const v = input[f];
      if (Array.isArray(v)) out[f] = v.map((s) => String(s).trim()).filter(Boolean);
      else if (typeof v === 'string') out[f] = textToLines(v);
    }
    return out;
  }
  const out: ArticleEdit = {};
  if (typeof input.title === 'string') out.title = input.title.trim();
  if (typeof input.body === 'string') out.body = input.body.trim();
  return out;
}

export function isContentType(value: unknown): value is ContentType {
  return typeof value === 'string' && (CONTENT_TYPES as readonly string[]).includes(value);
}
