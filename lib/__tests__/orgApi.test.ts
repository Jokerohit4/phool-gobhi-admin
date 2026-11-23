import { describe, it, expect } from 'vitest';
import {
  istDateToIso, isoToIstDate, parseMemberLines, describeAddResult, expiryLabel, boardEndLabel, MAX_MEMBERS_PER_REQUEST,
} from '../orgApi';

describe('IST date conversion', () => {
  it('start of day is 18:30Z the day before; end of day is 18:29:59.999Z the same day', () => {
    expect(istDateToIso('2026-12-11', 'start')).toBe('2026-12-10T18:30:00.000Z');
    expect(istDateToIso('2026-12-10', 'end')).toBe('2026-12-10T18:29:59.999Z');
  });
  it('rejects anything that is not a plain date', () => {
    expect(istDateToIso('', 'end')).toBeNull();
    expect(istDateToIso('10/12/2026', 'end')).toBeNull();
    expect(istDateToIso('2026-13-40', 'end')).toBeNull();
  });
  it('round-trips an end-of-day expiry back to the same IST date for the form', () => {
    expect(isoToIstDate(istDateToIso('2026-12-31', 'end'))).toBe('2026-12-31');
    expect(isoToIstDate(null)).toBe('');
    expect(isoToIstDate('garbage')).toBe('');
  });
});

describe('parseMemberLines', () => {
  it('reads phone, name, team from commas or tabs and skips blanks and a header row', () => {
    const { rows, error } = parseMemberLines('phone,name,team\n9876543210, Asha Rao, Sales\n\n9876543211\tBala\tOps\n+91 98765 43212');
    expect(error).toBeUndefined();
    expect(rows).toEqual([
      { phone: '9876543210', name: 'Asha Rao', team: 'Sales' },
      { phone: '9876543211', name: 'Bala', team: 'Ops' },
      { phone: '+91 98765 43212' },
    ]);
  });
  it('does not mistake a first data row for a header', () => {
    expect(parseMemberLines('9876543210').rows).toHaveLength(1);
  });
  it('asks for at least one number', () => {
    expect(parseMemberLines('  \n ').error).toMatch(/at least one/);
  });
  it('refuses more than the backend accepts', () => {
    const many = Array.from({ length: MAX_MEMBERS_PER_REQUEST + 1 }, (_, i) => `98765${String(i).padStart(5, '0')}`).join('\n');
    const out = parseMemberLines(many);
    expect(out.error).toMatch(/at most 500/);
    expect(out.rows).toEqual([]);
  });
});

describe('labels', () => {
  const base = { status: 'active' as const, expiresAt: null, unlimited: true, daysLeft: null };
  it('says plainly what an expired profile means', () => {
    expect(expiryLabel({ ...base, status: 'expired', unlimited: false, expiresAt: '2026-01-01T00:00:00Z' })).toMatch(/normal account/);
    expect(expiryLabel(base)).toBe('No expiry');
    expect(expiryLabel({ ...base, unlimited: false, expiresAt: 'x', daysLeft: 12 })).toBe('Expires in 12 days');
    expect(expiryLabel({ ...base, unlimited: false, expiresAt: 'x', daysLeft: 1 })).toBe('Expires within a day');
    expect(expiryLabel({ ...base, status: 'archived' })).toBe('Archived');
  });
  it('boards read "No end date" when unlimited', () => {
    const f = () => 'D';
    expect(boardEndLabel({ status: 'live', unlimited: true, endsAt: null }, f)).toBe('No end date');
    expect(boardEndLabel({ status: 'live', unlimited: false, endsAt: 'x' }, f)).toBe('Ends D');
    expect(boardEndLabel({ status: 'ended', unlimited: false, endsAt: 'x' }, f)).toBe('Ended D');
  });
  it('summarises an add: counts first, then what was skipped and why', () => {
    const s = describeAddResult({ added: 3, linked: 1, invited: 2, reactivated: 0, alreadyMember: 1, invalid: [{ row: 4, phone: '12', reason: 'invalid_phone' }] });
    expect(s).toContain('3 added');
    expect(s).toContain('2 invited');
    expect(s).toContain('row 4: not a valid mobile number');
    expect(describeAddResult({ added: 0, linked: 0, invited: 0, reactivated: 0, alreadyMember: 0, invalid: [] })).toBe('Nothing to add');
  });
});
