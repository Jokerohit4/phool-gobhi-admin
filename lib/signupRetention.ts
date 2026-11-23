// Helpers for the "Signup retention" analytics view (D1/D3/D7 by signup cohort).

export const SIGNUP_PLATFORMS = ['app', 'ios', 'android', 'web', 'all'] as const;
export type SignupPlatform = (typeof SIGNUP_PLATFORMS)[number];
export const SIGNUP_GRANULARITIES = ['week', 'day'] as const;
export type SignupGranularity = (typeof SIGNUP_GRANULARITIES)[number];
// Signup-day windows; the API only accepts the last 180 days.
export const SIGNUP_WINDOWS = [14, 30, 90, 180] as const;
export const SIGNUP_DEFAULT_WINDOW = 30;
export const SMALL_SAMPLE_THRESHOLD = 5;

export function parseSignupPlatform(value: string | undefined): SignupPlatform {
  return (SIGNUP_PLATFORMS as readonly string[]).includes(value ?? '') ? (value as SignupPlatform) : 'app';
}

export function parseSignupGranularity(value: string | undefined): SignupGranularity {
  return (SIGNUP_GRANULARITIES as readonly string[]).includes(value ?? '') ? (value as SignupGranularity) : 'week';
}

export function parseSignupWindow(value: string | undefined): number {
  const n = Number(value);
  return (SIGNUP_WINDOWS as readonly number[]).includes(n) && String(n) === (value ?? '').trim() ? n : SIGNUP_DEFAULT_WINDOW;
}

// YYYY-MM-DD of "now" in IST (the API's signup-day calendar).
export function istDate(now: number = Date.now(), minusDays = 0): string {
  return new Date(now + 5.5 * 3600 * 1000 - minusDays * 86400 * 1000).toISOString().slice(0, 10);
}

// Gateway query string; since/until are computed here, never taken from the URL.
export function signupRetentionQuery(opts: { windowDays: number; platform: SignupPlatform; granularity: SignupGranularity; cohortQs?: string }, now: number = Date.now()): string {
  const p = new URLSearchParams({
    since: istDate(now, opts.windowDays),
    until: istDate(now),
    platform: opts.platform,
    granularity: opts.granularity,
  });
  return `${p.toString()}${opts.cohortQs ?? ''}`;
}

export interface ReturnCount { returned: number; eligible: number }

export interface SignupCohort {
  start: string;
  size: number;
  d1: ReturnCount;
  d3: ReturnCount;
  d7: ReturnCount;
  anyLater?: ReturnCount;
  onboarded?: number;
  onboardedPct: number | null;
  workoutWithin24h?: number;
  workoutWithin24hPct: number | null;
  medianActiveMinutesDay1: number | null;
  activeMinutesSample?: number;
}

export interface SignupRetentionData {
  since: string;
  until: string;
  platform: string;
  granularity: string;
  generatedAt: string;
  cohorts: SignupCohort[];
  total: SignupCohort | null;
}

// eligible 0 means "day N has not fully passed yet": null, never 0%.
export function returnRate(c: ReturnCount | undefined): number | null {
  if (!c || !(c.eligible > 0)) return null;
  return c.returned / c.eligible;
}

export function formatReturnCount(c: ReturnCount | undefined): string {
  return c && c.eligible > 0 ? `${c.returned}/${c.eligible}` : '—';
}

export function formatReturnPct(c: ReturnCount | undefined): string {
  const r = returnRate(c);
  if (r === null) return '—';
  const pct = Math.round(r * 1000) / 10;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

// API *Pct values are already 0-100 (one decimal) or null.
export function formatPct100(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

export function formatMinutes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} min`;
}

export function isSmallSample(size: number): boolean {
  return size < SMALL_SAMPLE_THRESHOLD;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-11-16" -> "16 Nov" (week cohorts: "Wk 16 Nov"). Parsed by hand, no timezone shifts.
export function cohortLabel(start: string, granularity: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  if (!m) return start;
  const label = `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]}`;
  return granularity === 'week' ? `Wk ${label}` : label;
}

export interface SignupChartRow {
  label: string;
  size: number;
  d1: number | null;
  d3: number | null;
  d7: number | null;
}

// Chart rows oldest first. Rates are 0-100 so the axis reads in percent;
// not-yet-measurable days stay null (no bar), never 0.
export function signupChartRows(cohorts: SignupCohort[], granularity: string): SignupChartRow[] {
  const pct = (c: ReturnCount | undefined) => {
    const r = returnRate(c);
    return r === null ? null : Math.round(r * 1000) / 10;
  };
  return [...cohorts]
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    .map((c) => ({ label: cohortLabel(c.start, granularity), size: c.size, d1: pct(c.d1), d3: pct(c.d3), d7: pct(c.d7) }));
}
