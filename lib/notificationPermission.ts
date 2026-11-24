// Helpers for the "Notification permission" section of the Push analytics page.
// Params are whitelisted before they reach a gateway path.

export const PERM_DAYS = [7, 14, 30] as const;
export type PermDays = (typeof PERM_DAYS)[number];
export const PERM_DEFAULT_DAYS: PermDays = 14;

export function parsePermDays(value: string | undefined): PermDays {
  const n = Number(value);
  return (PERM_DAYS as readonly number[]).includes(n) && String(n) === (value ?? '').trim() ? (n as PermDays) : PERM_DEFAULT_DAYS;
}

// Gateway query: days plus the optional ios|android platform (already whitelisted by the page).
export function permissionQuery(days: PermDays, platform: string): string {
  const p = new URLSearchParams({ days: String(days) });
  if (platform === 'ios' || platform === 'android') p.set('platform', platform);
  return p.toString();
}

export interface PermissionCounts {
  granted: number;
  denied: number;
  not_determined: number;
  provisional: number;
}

export interface NotificationPermissionData {
  days: number;
  generatedAt: string;
  reportingUsers: number;
  mutedUsers: number;
  mutedRate: number;
  byStatus: { status: string; users: number }[];
  byPlatform: ({ platform: string } & PermissionCounts)[];
  byApp: ({ app: string } & PermissionCounts)[];
  lastReportAt: string | null;
}

// Users with a given status; 0 when the status is absent from the list.
export function statusUsers(byStatus: { status: string; users: number }[] | undefined, status: string): number {
  return (byStatus ?? []).filter((s) => s.status === status).reduce((sum, s) => sum + (Number.isFinite(s.users) ? s.users : 0), 0);
}

// Muted share (0..1) from counts; null when nobody reported (no divide by zero).
export function mutedRatio(muted: number, reporting: number): number | null {
  return reporting > 0 && Number.isFinite(muted) ? muted / reporting : null;
}

// Percent text for a 0..1 ratio; null / non-finite -> dash.
export function formatMutedRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return '—';
  const pct = Math.round(rate * 1000) / 10;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

export function rowTotal(c: PermissionCounts): number {
  return c.granted + c.denied + c.not_determined + c.provisional;
}

export function hasNoReports(data: Pick<NotificationPermissionData, 'reportingUsers'> | undefined): boolean {
  return !data || !(data.reportingUsers > 0);
}

// Friendly text for a failed fetch; the endpoint is not deployed everywhere yet.
export function permissionErrorMessage(reason: unknown): string {
  const msg = reason instanceof Error ? reason.message : '';
  if (/404|503|not found|unavailable/i.test(msg)) return 'The notification permission report is not available on this backend yet.';
  return msg || 'Could not load notification permission data.';
}
