import { gatewayJson } from './api';

// Server-only typed access to buddy-service's admin moderation surface
// (W7 contract). Client components must NOT import this module at runtime -
// it pulls in `next/headers` through lib/api. They take types with `import type`
// and the display helpers from app/buddy-reports/reportDisplay.ts instead.

export type ReportSeverity = 'normal' | 'high';
export type ReportStatus = 'open' | 'dismissed' | 'actioned';

// A photo is either a bare URL string or an object carrying `url`, depending on
// whether buddy-service returns the model row or a flattened projection.
export type PhotoRef = string | { url?: string | null };

export interface ReportParty {
  userId: number | null;
  name: string | null;
  // Set when the reported user erased their account: the Report survives, the
  // pointer to the person does not (reportedUserId is null).
  erased?: boolean;
  bio?: string | null;
  photos?: PhotoRef[];
}

export interface BuddyReport {
  id: number;
  reason: string;
  details: string | null;
  // Contract: server sets severity on every report. Optional here only so a
  // response from a server that predates W7 still type-checks.
  severity?: ReportSeverity | null;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  resolutionNote: string | null;
  reporter: ReportParty;
  reportedUser: ReportParty;
  priorReportCount: number;
  genderChanged: boolean;
}

export interface BuddyMessage {
  fromUserId: number;
  body: string;
  createdAt: string;
}

export interface GenderChange {
  userId: number;
  firstName: string | null;
  genderChangedAt: string | null;
  genderChangedTo: string | null;
  genderChangeClearedAt: string | null;
}

// buddy-service wraps payloads in `{ data: ... }`, matching every other
// controller in that service. A bare array is accepted too so a shape change
// degrades to an empty table instead of a render crash.
function unwrapList<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  const data = (body as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

export async function fetchReports(status: ReportStatus = 'open'): Promise<BuddyReport[]> {
  const body = await gatewayJson(`/api/buddy/reports?status=${status}`);
  return unwrapList<BuddyReport>(body);
}

export async function fetchReportContext(reportId: number): Promise<BuddyMessage[]> {
  const body = await gatewayJson<unknown>(`/api/buddy/reports/${reportId}/context`);
  if (Array.isArray(body)) return body as BuddyMessage[];
  const obj = (body ?? {}) as { messages?: unknown; data?: unknown };
  if (Array.isArray(obj.messages)) return obj.messages as BuddyMessage[];
  if (Array.isArray(obj.data)) return obj.data as BuddyMessage[];
  const nested = (obj.data ?? {}) as { messages?: unknown };
  return Array.isArray(nested.messages) ? (nested.messages as BuddyMessage[]) : [];
}

export async function fetchGenderChanges(): Promise<GenderChange[]> {
  const body = await gatewayJson('/api/buddy/moderation/gender-changes');
  return unwrapList<GenderChange>(body);
}

export async function reviewReport(
  reportId: number,
  input: { status: 'dismissed' | 'actioned'; suspend?: boolean; resolutionNote?: string },
): Promise<void> {
  await gatewayJson(`/api/buddy/reports/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function releaseHold(userId: number): Promise<void> {
  await gatewayJson(`/api/buddy/reports/users/${userId}/release-hold`, { method: 'PATCH' });
}

export async function reinstateUser(userId: number): Promise<void> {
  await gatewayJson(`/api/buddy/reports/users/${userId}/reinstate`, { method: 'PATCH' });
}

export async function clearGenderChange(userId: number): Promise<void> {
  await gatewayJson(`/api/buddy/moderation/gender-changes/${userId}/clear`, { method: 'PATCH' });
}
