// Helpers for the Push analytics dashboard (/push). Everything that goes into a
// gateway path is whitelisted here first: days in {7,30,90}, platform/role from
// fixed enums, push type as a short safe string.

export const PUSH_DAYS = [7, 30, 90] as const;
export type PushDays = (typeof PUSH_DAYS)[number];
export const PUSH_DEFAULT_DAYS: PushDays = 30;

export const PUSH_PLATFORMS = ['ios', 'android'] as const;
export const PUSH_ROLES = ['customer', 'partner', 'gobhi'] as const;

const TYPE_PATTERN = /^[A-Za-z0-9_:.-]{1,64}$/;

export function parsePushDays(value: string | undefined): PushDays {
  const n = Number(value);
  return (PUSH_DAYS as readonly number[]).includes(n) && String(n) === (value ?? '').trim() ? (n as PushDays) : PUSH_DEFAULT_DAYS;
}

export function parsePushPlatform(value: string | undefined): string {
  return (PUSH_PLATFORMS as readonly string[]).includes(value ?? '') ? (value as string) : '';
}

export function parsePushRole(value: string | undefined): string {
  return (PUSH_ROLES as readonly string[]).includes(value ?? '') ? (value as string) : '';
}

// Types look like `booking_confirmed` or `nudge:comeback`. Anything else is dropped.
export function parsePushType(value: string | undefined): string {
  return value && TYPE_PATTERN.test(value) ? value : '';
}

export interface PushFilters {
  days: PushDays;
  type: string;
  platform: string;
  role: string;
}

export function parsePushFilters(raw: { days?: string; type?: string; platform?: string; role?: string }): PushFilters {
  return {
    days: parsePushDays(raw.days),
    type: parsePushType(raw.type),
    platform: parsePushPlatform(raw.platform),
    role: parsePushRole(raw.role),
  };
}

// Gateway query for push-funnel (already whitelisted values, still encoded).
export function pushFunnelQuery(f: PushFilters): string {
  const p = new URLSearchParams({ days: String(f.days) });
  if (f.type) p.set('type', f.type);
  if (f.platform) p.set('platform', f.platform);
  if (f.role) p.set('role', f.role);
  return p.toString();
}

// Page URL carrying the current filters, with optional overrides ('' removes a key).
export function pushHref(f: PushFilters, sort: PushSort, overrides: Partial<Record<'days' | 'type' | 'platform' | 'role' | 'sort' | 'dir', string>> = {}): string {
  const base: Record<string, string> = {
    days: String(f.days), type: f.type, platform: f.platform, role: f.role, sort: sort.key, dir: sort.dir,
  };
  const merged = { ...base, ...overrides };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
  return `/push?${p.toString()}`;
}

// ---- formatting ----

// Rates arrive as 0..1. Null / non-finite means "no denominator": show a dash.
export function formatRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return '—';
  const pct = Math.round(rate * 1000) / 10;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

// Divide-by-zero safe ratio (0..1), null when the denominator is 0.
export function safeRatio(numerator: number, denominator: number): number | null {
  return denominator > 0 && Number.isFinite(numerator) ? numerator / denominator : null;
}

export function formatCount(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-IN') : '—';
}

// Seconds -> "45s", "2m 5s", "1h 5m". Null (no opens measured) -> dash.
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}m ${r}s` : `${m}m`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ---- API shapes (booking-service push-funnel / push-types) ----

export interface PushTotals {
  sent: number;
  failed: number;
  delivered: number;
  opened: number;
  deliveredRate: number;
  openRate: number;
  openOfDeliveredRate: number;
}

export interface PushTypeRow {
  type: string;
  sent: number;
  failed: number;
  delivered: number;
  opened: number;
  deliveredRate: number;
  openRate: number;
}

export interface PushFunnelData {
  days: number;
  generatedAt: string;
  totals: PushTotals;
  byType: PushTypeRow[];
  byDay: { date: string; sent: number; delivered: number; opened: number }[];
  byPlatform: { platform: string; sent: number; delivered: number; opened: number }[];
  timeToOpenSeconds: { p50: number | null; p90: number | null; count: number };
  failuresByCode: { code: string; count: number }[];
}

export interface PushTypesData {
  days: number;
  generatedAt: string;
  types: { type: string; sent: number }[];
}

// No push has been recorded at all (apps and backend only just started).
export function hasNoPushEvents(totals: Pick<PushTotals, 'sent' | 'failed' | 'delivered' | 'opened'> | undefined): boolean {
  if (!totals) return true;
  return totals.sent + totals.failed + totals.delivered + totals.opened === 0;
}

export function funnelSteps(totals: Pick<PushTotals, 'sent' | 'delivered' | 'opened'>): { label: string; value: number; pctOfSent: number | null }[] {
  return [
    { label: 'Sent', value: totals.sent },
    { label: 'Delivered', value: totals.delivered },
    { label: 'Opened', value: totals.opened },
  ].map((s) => ({ ...s, pctOfSent: safeRatio(s.value, totals.sent) }));
}

// Share of sent pushes whose platform is still unknown (updated apps not shipped).
export function unknownPlatformShare(byPlatform: { platform: string; sent: number }[]): number | null {
  const total = byPlatform.reduce((sum, p) => sum + p.sent, 0);
  const unknown = byPlatform.filter((p) => p.platform === 'unknown').reduce((sum, p) => sum + p.sent, 0);
  return safeRatio(unknown, total);
}

// ---- sorting of the by-type table ----

export const PUSH_SORT_KEYS = ['type', 'sent', 'failed', 'delivered', 'opened', 'deliveredRate', 'openRate'] as const;
export type PushSortKey = (typeof PUSH_SORT_KEYS)[number];
export interface PushSort { key: PushSortKey; dir: 'asc' | 'desc' }

export function parsePushSort(key: string | undefined, dir: string | undefined): PushSort {
  const k = (PUSH_SORT_KEYS as readonly string[]).includes(key ?? '') ? (key as PushSortKey) : 'sent';
  const d = dir === 'asc' || dir === 'desc' ? dir : k === 'type' ? 'asc' : 'desc';
  return { key: k, dir: d };
}

export function sortPushTypes(rows: PushTypeRow[], sort: PushSort): PushTypeRow[] {
  const mult = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const cmp = sort.key === 'type' ? a.type.localeCompare(b.type) : (a[sort.key] ?? 0) - (b[sort.key] ?? 0);
    return cmp !== 0 ? cmp * mult : a.type.localeCompare(b.type);
  });
}

// Type dropdown options: most-sent first from push-types, keeping the applied
// type selectable even when it is outside the window's list.
export function typeOptions(types: { type: string; sent: number }[] | undefined, selected: string): string[] {
  const names = (types ?? []).map((t) => t.type);
  return selected && !names.includes(selected) ? [...names, selected] : names;
}
