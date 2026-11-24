import { describe, it, expect } from 'vitest';
import {
  buildReportView, buildReportCsv, csvCell, parsePeriod, reportFilename, inviteMessage, phonesText, INSTALL_LINK,
  type Dashboard,
} from '../orgDashboard';

const team = (over: Partial<Dashboard['stats']['teams'][number]> = {}) => ({
  teamId: 1, name: 'Sales', members: 6, participants: 5, activeParticipants: 4, avgActiveDays: 3.2, participationRate: 80, small: false, ...over,
});

function dash(over: Partial<Dashboard> = {}): Dashboard {
  return {
    programme: {
      id: 1, name: 'Acme Corp', slug: 'acme-corp', status: 'active', startsAt: '2026-12-01T00:00:00Z', expiresAt: null,
      unlimited: true, daysLeft: null, convertedAt: null, contactName: null, contactEmail: null, notes: null,
    },
    leaderboards: [],
    periodDays: 30,
    notStarted: false,
    minGroupSize: 3,
    complete: true,
    stats: {
      window: { startDay: '2026-12-01', endDay: '2026-12-14', days: 14 },
      funnel: [
        { key: 'added', label: 'Added by staff', value: 10 }, { key: 'joined', label: 'Signed in to the app', value: 8 },
        { key: 'consented', label: 'Agreed to share health data', value: 6 }, { key: 'active', label: 'Active in this period', value: 5 },
      ],
      counts: { added: 10, invited: 2, joined: 8, optedOut: 1, pendingConsent: 1, participants: 6 },
      rates: { joined: 80, consented: 85.7, active: 83.3, activeLast7Days: 66.7 },
      activeLast7Days: 4, activeInPeriod: 5, avgActiveDays: 3.5,
      totals: { activeDays: 21, workoutDays: 12, checkinDays: 4, steps: 123456 },
      daily: [], weekly: [{ weekStart: '2026-11-30', activeMembers: 5 }, { weekStart: '2026-12-07', activeMembers: 4 }],
      distribution: [{ key: '0', label: '0 days', members: 1 }, { key: '1-2', label: '1-2 days', members: 5 }],
      teams: [team(), team({ teamId: 2, name: 'Ops (tiny)', participants: 2, small: true })],
    },
    actions: {
      notSignedIn: [{ phone: '9000000004', name: 'Dev Private', addedAt: '2026-12-01T00:00:00Z' }],
      needsConsent: [{ name: 'Bala Private', phone: '9876543202' }],
    },
    ...over,
  };
}
const fmt = (iso: string) => iso.slice(0, 10);

describe('report view is aggregate-only', () => {
  it('contains no names or phone numbers from the staff follow-up lists', () => {
    const r = buildReportView(dash(), fmt);
    const json = JSON.stringify(r) + buildReportCsv(r);
    expect(json).not.toContain('Dev Private');
    expect(json).not.toContain('Bala Private');
    expect(json).not.toContain('9000000004');
    expect(json).not.toContain('9876543202');
  });

  it('leaves out teams below the minimum group size, and says how many', () => {
    const r = buildReportView(dash(), fmt);
    expect(r.teams.map((t) => t.name)).toEqual(['Sales']);
    expect(r.hiddenTeams).toBe(1);
    expect(buildReportCsv(r)).not.toContain('Ops (tiny)');
    expect(buildReportCsv(r)).toContain('1 smaller team(s) not shown');
  });

  it('a team exactly at the minimum is shown', () => {
    const r = buildReportView(dash({ stats: { ...dash().stats, teams: [team({ participants: 3, small: false })] } }), fmt);
    expect(r.teams).toHaveLength(1);
    expect(r.hiddenTeams).toBe(0);
  });

  it('headline reads sensibly, including a company with no expiry', () => {
    const r = buildReportView(dash(), fmt);
    expect(r.expires).toBe('No expiry');
    expect(Object.fromEntries(r.headline.map((h) => [h.label, h.value]))['Signed in to the app']).toBe('8 (80%)');
    expect(r.notes.join(' ')).toMatch(/no names or contact details/);
  });

  it('shows the expiry date when there is one', () => {
    const d = dash();
    d.programme = { ...d.programme, unlimited: false, expiresAt: '2027-01-31T00:00:00Z' };
    expect(buildReportView(d, fmt).expires).toBe('2027-01-31');
  });
});

describe('CSV', () => {
  it('escapes quotes, commas and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('x\ny')).toBe('"x\ny"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(0)).toBe('0');
  });

  it('neutralises spreadsheet formulas in staff-typed names', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    const r = buildReportView(dash({ programme: { ...dash().programme, name: '=cmd|calc' } }), fmt);
    expect(buildReportCsv(r)).toContain("Company,'=cmd|calc");
  });

  it('starts with a BOM, uses CRLF and carries every section', () => {
    const csv = buildReportCsv(buildReportView(dash(), fmt));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('\r\n');
    for (const section of ['Summary', 'Participation funnel', 'Weekly active participants', 'Active days per participant', 'Teams']) {
      expect(csv).toContain(section);
    }
  });

  it('builds a safe filename', () => {
    expect(reportFilename('Acme Corp / Ltd.', '2026-12-14')).toBe('acme-corp-ltd-programme-report-2026-12-14.csv');
    expect(reportFilename('!!!', '2026-12-14')).toBe('company-programme-report-2026-12-14.csv');
  });
});

describe('helpers', () => {
  it('period is limited to 7, 30 or 90 and defaults to 30', () => {
    expect(parsePeriod('7')).toBe(7);
    expect(parsePeriod('90')).toBe(90);
    expect(parsePeriod('15')).toBe(30);
    expect(parsePeriod(undefined)).toBe(30);
    expect(parsePeriod('abc')).toBe(30);
  });

  it('the announcement names the company, the install link and the consent step', () => {
    const m = inviteMessage('Acme Corp');
    expect(m).toContain('Acme Corp');
    expect(m).toContain(INSTALL_LINK);
    expect(m).toMatch(/Join the leaderboard/);
    expect(m).toMatch(/agree to share/);
  });

  it('phone lists are one per line', () => {
    expect(phonesText([{ phone: '1' }, { phone: '2' }])).toBe('1\n2');
  });
});
