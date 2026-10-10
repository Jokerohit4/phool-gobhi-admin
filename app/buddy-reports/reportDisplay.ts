import type { ReportSeverity, ReportStatus, PhotoRef } from '@/lib/buddyApi';

// Pure display helpers shared by the server page and the client row component.
// Deliberately free of any server-only import so a Client Component can use it.

// The minimum a report needs to be classed, so a partial/legacy response still
// renders instead of throwing.
export interface SeverityInput {
  reason: string | null | undefined;
  severity?: string | null;
}

export const REPORT_STATUSES: ReportStatus[] = ['open', 'actioned', 'dismissed'];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  actioned: 'Actioned',
  dismissed: 'Dismissed',
};

// Admin-facing labels for the ReportReason enum. The enum carries both `spam`
// and `scam`, but the product ships one "Spam or scam" label for either; `other`
// holds the user's own words in `details`.
export const REPORT_REASON_LABELS: Record<string, string> = {
  harassment: 'Harassment',
  threat: 'Threatening me',
  underage: 'Seems under 18',
  impersonation: 'Fake profile',
  inappropriate_content: 'Inappropriate content',
  scam: 'Spam or scam',
  spam: 'Spam or scam',
  other: 'Something else',
};

// Contract: threats and suspected minors are the two high-severity reasons. The
// server stamps `severity` on every report; this set is only the fallback for a
// response from a server that predates W7.
export const HIGH_SEVERITY_REASONS = new Set(['threat', 'underage']);

export function reportReasonLabel(reason: string | null | undefined): string {
  if (!reason) return 'Unknown';
  return REPORT_REASON_LABELS[reason] ?? reason;
}

export function reportSeverity(report: SeverityInput): ReportSeverity {
  if (report.severity === 'high') return 'high';
  if (report.severity === 'normal') return 'normal';
  return report.reason != null && HIGH_SEVERITY_REASONS.has(report.reason) ? 'high' : 'normal';
}

export function isHighSeverity(report: SeverityInput): boolean {
  return reportSeverity(report) === 'high';
}

export function photoUrl(photo: PhotoRef): string | null {
  if (typeof photo === 'string') return photo || null;
  return photo?.url ?? null;
}

export function reportPartLabel(party: { userId: number | null; name: string | null; erased?: boolean }): string {
  if (!party || party.erased) return 'Account deleted';
  return party.name ?? (party.userId != null ? `#${party.userId}` : 'Unknown');
}
