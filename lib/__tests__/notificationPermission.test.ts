import { describe, expect, it } from 'vitest';
import {
  formatMutedRate, hasNoReports, mutedRatio, parsePermDays, permissionErrorMessage, permissionQuery, rowTotal, statusUsers,
} from '../notificationPermission';

describe('notification permission params', () => {
  it('only accepts 7, 14, 30 days', () => {
    expect(parsePermDays('7')).toBe(7);
    expect(parsePermDays('30')).toBe(30);
    for (const bad of [undefined, '', '90', '14&x=1', '014', 'abc']) expect(parsePermDays(bad)).toBe(14);
  });
  it('builds a query with an optional whitelisted platform', () => {
    expect(permissionQuery(7, '')).toBe('days=7');
    expect(permissionQuery(30, 'ios')).toBe('days=30&platform=ios');
    expect(permissionQuery(14, 'ios&x=1')).toBe('days=14');
  });
});

describe('notification permission helpers', () => {
  it('guards divide by zero', () => {
    expect(mutedRatio(0, 0)).toBeNull();
    expect(mutedRatio(1, 4)).toBe(0.25);
    expect(formatMutedRate(mutedRatio(0, 0))).toBe('—');
  });
  it('formats rates', () => {
    expect(formatMutedRate(0.25)).toBe('25%');
    expect(formatMutedRate(0.1234)).toBe('12.3%');
    expect(formatMutedRate(NaN)).toBe('—');
  });
  it('reads status counts and row totals', () => {
    expect(statusUsers([{ status: 'granted', users: 5 }, { status: 'denied', users: 2 }], 'denied')).toBe(2);
    expect(statusUsers(undefined, 'granted')).toBe(0);
    expect(rowTotal({ granted: 1, denied: 2, not_determined: 3, provisional: 4 })).toBe(10);
  });
  it('detects an empty report', () => {
    expect(hasNoReports(undefined)).toBe(true);
    expect(hasNoReports({ reportingUsers: 0 })).toBe(true);
    expect(hasNoReports({ reportingUsers: 3 })).toBe(false);
  });
  it('maps missing-endpoint errors to a friendly note', () => {
    expect(permissionErrorMessage(new Error('Request failed (404)'))).toContain('not available');
    expect(permissionErrorMessage(new Error('boom'))).toBe('boom');
    expect(permissionErrorMessage(null)).toContain('Could not load');
  });
});
