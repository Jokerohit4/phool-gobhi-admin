// Types and pure helpers for the company programme dashboard and the report
// handed to a company's HR contact. Nothing here talks to the network.
//
// Privacy line: the DASHBOARD is staff-only and carries follow-up lists with
// names and phones. The REPORT (print page + CSV) is what gets sent to the
// company, so it is built ONLY from aggregates: no names, no phones, and any
// team with fewer than `minGroupSize` participants is left out so nobody can
// be picked out of a tiny group.

import type { OrgBoard, OrgSummary } from './orgApi';

export interface DashTeam {
  teamId: number;
  name: string;
  members: number;
  participants: number;
  activeParticipants: number;
  avgActiveDays: number;
  participationRate: number | null;
  small: boolean;
}

export interface DashStats {
  window: { startDay: string; endDay: string; days: number };
  funnel: { key: string; label: string; value: number }[];
  counts: { added: number; invited: number; joined: number; optedOut: number; pendingConsent: number | null; participants: number };
  rates: { joined: number | null; consented: number | null; active: number | null; activeLast7Days: number | null };
  activeLast7Days: number;
  activeInPeriod: number;
  avgActiveDays: number;
  totals: { activeDays: number; workoutDays: number; checkinDays: number; steps: number };
  daily: { day: string; activeMembers: number }[];
  weekly: { weekStart: string; activeMembers: number }[];
  distribution: { key: string; label: string; members: number }[];
  teams: DashTeam[];
}

export interface Dashboard {
  programme: OrgSummary;
  leaderboards: OrgBoard[];
  periodDays: 7 | 30 | 90;
  notStarted: boolean;
  minGroupSize: number;
  stats: DashStats;
  actions: {
    notSignedIn: { phone: string; name: string | null; addedAt: string }[];
    needsConsent: { name: string | null; phone: string }[];
  };
  complete: boolean;
}

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

export function parsePeriod(value: string | undefined): Period {
  const n = Number(value);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30;
}

export const INSTALL_LINK = 'https://www.phoolgobhi.com/app';

export function pctText(value: number | null | undefined): string {
  return value == null ? '-' : `${value}%`;
}

// ---- Aggregate-only report ------------------------------------------------

export interface ReportView {
  company: string;
  period: { startDay: string; endDay: string; days: number };
  programmeStatus: string;
  expires: string; // 'No expiry' or a date
  headline: { label: string; value: string }[];
  funnel: { label: string; value: number }[];
  weekly: { weekStart: string; activeMembers: number }[];
  distribution: { label: string; members: number }[];
  teams: { name: string; participants: number; avgActiveDays: number; participationRate: number | null }[];
  hiddenTeams: number;
  notes: string[];
}

export function buildReportView(d: Dashboard, formatDate: (iso: string) => string): ReportView {
  const s = d.stats;
  const shown = s.teams.filter((t) => t.participants >= d.minGroupSize);
  return {
    company: d.programme.name,
    period: s.window,
    programmeStatus: d.programme.status,
    expires: d.programme.unlimited || !d.programme.expiresAt ? 'No expiry' : formatDate(d.programme.expiresAt),
    headline: [
      { label: 'People invited', value: String(s.counts.added) },
      { label: 'Signed in to the app', value: `${s.counts.joined} (${pctText(s.rates.joined)})` },
      { label: 'Agreed to join the leaderboard', value: `${s.counts.participants} (${pctText(s.rates.consented)} of those eligible)` },
      { label: 'Active in this period', value: `${s.activeInPeriod} (${pctText(s.rates.active)} of participants)` },
      { label: 'Active in the last 7 days', value: `${s.activeLast7Days} (${pctText(s.rates.activeLast7Days)})` },
      { label: 'Average active days per participant', value: String(s.avgActiveDays) },
      { label: 'Workout days logged', value: String(s.totals.workoutDays) },
      { label: 'Gym check-in days', value: String(s.totals.checkinDays) },
      { label: 'Total steps', value: s.totals.steps.toLocaleString('en-IN') },
    ],
    funnel: s.funnel.map((f) => ({ label: f.label, value: f.value })),
    weekly: s.weekly,
    distribution: s.distribution.map((x) => ({ label: x.label, members: x.members })),
    teams: shown.map((t) => ({
      name: t.name, participants: t.participants, avgActiveDays: t.avgActiveDays, participationRate: t.participationRate,
    })),
    hiddenTeams: s.teams.length - shown.length,
    notes: [
      'Only people who signed in, agreed to share their health data and did not opt out of leaderboards are counted as participants.',
      `This report contains no names or contact details. Teams with fewer than ${d.minGroupSize} participants are not shown.`,
      'An active day is a day with a gym check-in, a finished workout of 10+ minutes, or 3,000+ steps recorded by the phone.',
    ],
  };
}

// A cell that starts with = + - @ is treated as a formula by spreadsheets; the
// company name and team names are typed by staff, so neutralise them.
export function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildReportCsv(r: ReportView): string {
  const rows: (string | number | null)[][] = [];
  rows.push(['Phool Gobhi company programme report']);
  rows.push(['Company', r.company]);
  rows.push(['Period', `${r.period.startDay} to ${r.period.endDay}`, `${r.period.days} days`]);
  rows.push(['Programme status', r.programmeStatus]);
  rows.push(['Expires', r.expires]);
  rows.push([]);
  rows.push(['Summary']);
  rows.push(['Measure', 'Value']);
  for (const h of r.headline) rows.push([h.label, h.value]);
  rows.push([]);
  rows.push(['Participation funnel']);
  rows.push(['Stage', 'People']);
  for (const f of r.funnel) rows.push([f.label, f.value]);
  rows.push([]);
  rows.push(['Weekly active participants']);
  rows.push(['Week starting (Monday)', 'Active participants']);
  for (const w of r.weekly) rows.push([w.weekStart, w.activeMembers]);
  rows.push([]);
  rows.push(['Active days per participant']);
  rows.push(['Active days', 'Participants']);
  for (const x of r.distribution) rows.push([x.label, x.members]);
  rows.push([]);
  rows.push(['Teams']);
  rows.push(['Team', 'Participants', 'Average active days', 'Participation rate (%)']);
  for (const t of r.teams) rows.push([t.name, t.participants, t.avgActiveDays, t.participationRate]);
  if (r.hiddenTeams > 0) rows.push([`${r.hiddenTeams} smaller team(s) not shown`]);
  rows.push([]);
  for (const n of r.notes) rows.push([n]);
  // UTF-8 BOM so Excel reads rupee signs / non-ASCII company names correctly.
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function reportFilename(company: string, endDay: string): string {
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'company';
  return `${slug}-programme-report-${endDay}.csv`;
}

// ---- Staff helpers --------------------------------------------------------

export function inviteMessage(company: string): string {
  return [
    `Hi! ${company} is running a wellness challenge on Phool Gobhi.`,
    '',
    `1. Install the app: ${INSTALL_LINK}`,
    '2. Sign in with the mobile number HR shared with us.',
    '3. On the home screen, open "Your company" and tap "Join the leaderboard".',
    '',
    'To be ranked you will be asked to agree to share your activity. Your workouts, steps and gym check-ins count, and no watch is needed. Colleagues see your name, rank and score, nothing else. You can leave any time.',
  ].join('\n');
}

export function phonesText(list: { phone: string }[]): string {
  return list.map((p) => p.phone).join('\n');
}
