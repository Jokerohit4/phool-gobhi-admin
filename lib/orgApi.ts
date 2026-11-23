// Types and small pure helpers for the Companies (corporate wellness) pages.
// The backend lives in challenge-service; staff reach it through the gateway at
// /api/challenges/admin/orgs. Nothing here talks to the network.

export type OrgStatus = 'active' | 'expired' | 'archived';
export type BoardStatus = 'live' | 'upcoming' | 'ended' | 'archived';
export type Scoring = 'active_days' | 'workout_days' | 'steps';

export interface OrgSummary {
  id: number;
  name: string;
  slug: string;
  status: OrgStatus;
  startsAt: string;
  expiresAt: string | null;
  unlimited: boolean;
  daysLeft: number | null;
  convertedAt: string | null;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdAt?: string;
  activeMembers?: number;
  invitedMembers?: number;
  leaderboards?: number;
}

export interface OrgMember {
  id: number;
  phone: string;
  status: 'active' | 'invited';
  userId: number | null;
  name: string | null;
  teamId: number | null;
  teamName: string | null;
  addedAt: string;
  joinedAt: string | null;
}

export interface OrgTeam { id: number; name: string; members: number }

export interface OrgBoard {
  id: number;
  orgId: number;
  name: string;
  description: string | null;
  scoring: Scoring;
  showTeams: boolean;
  status: BoardStatus;
  startsAt: string;
  // The EFFECTIVE end: the earlier of the board's own end and the company's expiry.
  endsAt: string | null;
  unlimited: boolean;
  // What staff configured on the board itself (null = no end date).
  configuredEndsAt: string | null;
  archived: boolean;
}

export interface OrgDetail extends Omit<OrgSummary, 'leaderboards'> {
  // The list view returns a count; the detail view returns the boards themselves.
  teams: OrgTeam[];
  members: OrgMember[];
  leaderboards: OrgBoard[];
}

export interface AddMembersResult {
  added: number;
  linked: number;
  invited: number;
  reactivated: number;
  alreadyMember: number;
  invalid: { row: number; phone: string | null; reason: string }[];
}

export const SCORING_LABEL: Record<Scoring, string> = {
  active_days: 'Active days (check-in, workout or 3,000+ steps)',
  workout_days: 'Workout days (finished workout, 10+ min)',
  steps: 'Total steps',
};

export const MAX_MEMBERS_PER_REQUEST = 500;

const IST = 'Asia/Kolkata';

// <input type="date"> gives 'YYYY-MM-DD'. Staff think in IST, so a start date
// means the start of that IST day and an end date means the END of that IST
// day (an expiry "on 31 Dec" lets people use the programme all of 31 Dec).
export function istDateToIso(date: string, edge: 'start' | 'end'): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ISO -> 'YYYY-MM-DD' in IST, for pre-filling a date input.
export function isoToIstDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export interface ParsedMemberLine { phone: string; name?: string; team?: string }

// Staff paste one person per line: "phone", "phone, name" or "phone, name, team"
// (commas or tabs, so a spreadsheet paste works). A header row is skipped.
export function parseMemberLines(text: string): { rows: ParsedMemberLine[]; error?: string } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedMemberLine[] = [];
  lines.forEach((line, index) => {
    const parts = line.split(/[\t,]/).map((p) => p.trim());
    const phone = parts[0] ?? '';
    if (index === 0 && /[a-z]/i.test(phone) && !/\d{6,}/.test(phone)) return; // header row
    if (!phone) return;
    rows.push({ phone, ...(parts[1] ? { name: parts[1] } : {}), ...(parts[2] ? { team: parts[2] } : {}) });
  });
  if (rows.length === 0) return { rows, error: 'Paste at least one phone number' };
  if (rows.length > MAX_MEMBERS_PER_REQUEST) {
    return { rows: [], error: `Add at most ${MAX_MEMBERS_PER_REQUEST} people at a time (you pasted ${rows.length})` };
  }
  return { rows };
}

export function describeAddResult(r: AddMembersResult): string {
  const parts: string[] = [];
  if (r.added) parts.push(`${r.added} added`);
  if (r.reactivated) parts.push(`${r.reactivated} re-added`);
  if (r.linked) parts.push(`${r.linked} already have the app`);
  if (r.invited) parts.push(`${r.invited} invited (will be linked when they sign up)`);
  if (r.alreadyMember) parts.push(`${r.alreadyMember} were already members`);
  if (r.invalid.length) {
    const shown = r.invalid.slice(0, 5).map((i) => `row ${i.row}: ${REASONS[i.reason] ?? i.reason}`).join('; ');
    parts.push(`${r.invalid.length} skipped (${shown}${r.invalid.length > 5 ? '; …' : ''})`);
  }
  return parts.join(' · ') || 'Nothing to add';
}

const REASONS: Record<string, string> = {
  invalid_phone: 'not a valid mobile number',
  duplicate_in_request: 'listed twice',
};

export function expiryLabel(org: Pick<OrgSummary, 'status' | 'expiresAt' | 'unlimited' | 'daysLeft'>): string {
  if (org.status === 'archived') return 'Archived';
  if (org.status === 'expired') return 'Expired: now a normal account for every member';
  if (org.unlimited || !org.expiresAt) return 'No expiry';
  const left = org.daysLeft ?? 0;
  return left <= 1 ? 'Expires within a day' : `Expires in ${left} days`;
}

export function boardEndLabel(b: Pick<OrgBoard, 'status' | 'unlimited' | 'endsAt'>, format: (iso: string) => string): string {
  if (b.unlimited || !b.endsAt) return 'No end date';
  return b.status === 'ended' ? `Ended ${format(b.endsAt)}` : `Ends ${format(b.endsAt)}`;
}
