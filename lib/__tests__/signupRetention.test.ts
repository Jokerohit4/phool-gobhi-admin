import { describe, expect, it } from 'vitest';
import {
  cohortLabel, formatMinutes, formatPct100, formatReturnCount, formatReturnPct, isSmallSample, istDate,
  parseSignupGranularity, parseSignupPlatform, parseSignupWindow, returnRate, signupChartRows, signupRetentionQuery,
  type SignupCohort,
} from '../signupRetention';

describe('signup retention params', () => {
  it('whitelists platform (default app) and granularity (default week)', () => {
    for (const p of ['app', 'ios', 'android', 'web', 'all']) expect(parseSignupPlatform(p)).toBe(p);
    for (const bad of [undefined, 'both', 'ios&x=1', '']) expect(parseSignupPlatform(bad)).toBe('app');
    expect(parseSignupGranularity('day')).toBe('day');
    expect(parseSignupGranularity('month')).toBe('week');
  });
  it('whitelists the signup window', () => {
    expect(parseSignupWindow('90')).toBe(90);
    for (const bad of [undefined, '7', '365', 'today', '30&x']) expect(parseSignupWindow(bad)).toBe(30);
  });
  it('computes IST dates and the gateway query', () => {
    const now = Date.parse('2026-11-23T20:00:00Z'); // 01:30 on the 24th in IST
    expect(istDate(now)).toBe('2026-11-24');
    expect(istDate(now, 30)).toBe('2026-10-25');
    expect(signupRetentionQuery({ windowDays: 30, platform: 'app', granularity: 'week' }, now))
      .toBe('since=2026-10-25&until=2026-11-24&platform=app&granularity=week');
  });
});

describe('return rates', () => {
  it('treats eligible 0 as not yet measurable, never 0%', () => {
    expect(returnRate({ returned: 0, eligible: 0 })).toBeNull();
    expect(formatReturnPct({ returned: 0, eligible: 0 })).toBe('—');
    expect(formatReturnCount({ returned: 0, eligible: 0 })).toBe('—');
    expect(formatReturnPct(undefined)).toBe('—');
  });
  it('shows a real zero as 0% when people were eligible', () => {
    expect(formatReturnPct({ returned: 0, eligible: 19 })).toBe('0%');
    expect(formatReturnCount({ returned: 0, eligible: 19 })).toBe('0/19');
  });
  it('formats rates and counts', () => {
    expect(formatReturnPct({ returned: 7, eligible: 24 })).toBe('29.2%');
    expect(formatReturnPct({ returned: 1, eligible: 2 })).toBe('50%');
    expect(formatReturnCount({ returned: 7, eligible: 24 })).toBe('7/24');
  });
  it('formats secondary columns with null guards', () => {
    expect(formatPct100(null)).toBe('—');
    expect(formatPct100(88)).toBe('88%');
    expect(formatPct100(16.7)).toBe('16.7%');
    expect(formatMinutes(null)).toBe('—');
    expect(formatMinutes(1.14)).toBe('1.1 min');
  });
  it('flags small samples under 5', () => {
    expect(isSmallSample(4)).toBe(true);
    expect(isSmallSample(5)).toBe(false);
    expect(isSmallSample(0)).toBe(true);
  });
});

describe('chart rows', () => {
  const c = (start: string, size: number, d1: [number, number], d7: [number, number]): SignupCohort => ({
    start, size, d1: { returned: d1[0], eligible: d1[1] }, d3: { returned: 0, eligible: 0 }, d7: { returned: d7[0], eligible: d7[1] },
    onboardedPct: null, workoutWithin24hPct: null, medianActiveMinutesDay1: null,
  });
  it('labels buckets without timezone drift', () => {
    expect(cohortLabel('2026-11-16', 'week')).toBe('Wk 16 Nov');
    expect(cohortLabel('2026-11-02', 'day')).toBe('2 Nov');
    expect(cohortLabel('garbage', 'day')).toBe('garbage');
  });
  it('orders oldest first and keeps unmeasurable days null', () => {
    const rows = signupChartRows([c('2026-11-16', 25, [7, 24], [0, 0]), c('2026-11-09', 10, [5, 10], [2, 8])], 'week');
    expect(rows.map((r) => r.label)).toEqual(['Wk 9 Nov', 'Wk 16 Nov']);
    expect(rows[0]).toMatchObject({ d1: 50, d3: null, d7: 25 });
    expect(rows[1]).toMatchObject({ d1: 29.2, d3: null, d7: null });
  });
});
