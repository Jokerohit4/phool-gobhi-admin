import { describe, expect, it } from 'vitest';
import {
  formatCount, formatDuration, formatRate, funnelSteps, hasNoPushEvents, parsePushDays, parsePushFilters,
  parsePushPlatform, parsePushRole, parsePushSort, parsePushType, pushFunnelQuery, pushHref, safeRatio,
  sortPushTypes, typeOptions, unknownPlatformShare, type PushTypeRow,
} from '../pushAnalytics';

describe('push param whitelisting', () => {
  it('only accepts 7, 30, 90 days', () => {
    expect(parsePushDays('7')).toBe(7);
    expect(parsePushDays('90')).toBe(90);
    for (const bad of [undefined, '', '1', '365', '30&x=1', '07', 'abc', '30.0']) expect(parsePushDays(bad)).toBe(30);
  });
  it('whitelists platform and role', () => {
    expect(parsePushPlatform('ios')).toBe('ios');
    expect(parsePushPlatform('unknown')).toBe('');
    expect(parsePushPlatform('ios&days=1')).toBe('');
    expect(parsePushRole('partner')).toBe('partner');
    expect(parsePushRole('admin')).toBe('');
  });
  it('accepts safe push types only', () => {
    expect(parsePushType('booking_confirmed')).toBe('booking_confirmed');
    expect(parsePushType('nudge:first_step')).toBe('nudge:first_step');
    for (const bad of ['a b', 'x&days=1', '../x', 'a/b', '', 'x'.repeat(65), '<script>']) expect(parsePushType(bad)).toBe('');
  });
  it('builds an encoded gateway query from whitelisted values', () => {
    const f = parsePushFilters({ days: '7', type: 'nudge:comeback', platform: 'android', role: 'customer' });
    expect(pushFunnelQuery(f)).toBe('days=7&type=nudge%3Acomeback&platform=android&role=customer');
    expect(pushFunnelQuery(parsePushFilters({ days: 'zzz', type: 'bad type' }))).toBe('days=30');
  });
  it('builds page links that carry filters and drop empties', () => {
    const f = parsePushFilters({ days: '90', platform: 'ios' });
    const s = parsePushSort(undefined, undefined);
    expect(pushHref(f, s)).toBe('/push?days=90&platform=ios&sort=sent&dir=desc');
    expect(pushHref(f, s, { platform: '' })).toBe('/push?days=90&sort=sent&dir=desc');
  });
});

describe('formatting', () => {
  it('formats 0..1 rates as percentages', () => {
    expect(formatRate(0.75)).toBe('75%');
    expect(formatRate(0.6667)).toBe('66.7%');
    expect(formatRate(1)).toBe('100%');
    expect(formatRate(0)).toBe('0%');
  });
  it('guards missing and non-finite rates', () => {
    for (const v of [null, undefined, NaN, Infinity]) expect(formatRate(v)).toBe('—');
  });
  it('guards divide-by-zero', () => {
    expect(safeRatio(3, 0)).toBeNull();
    expect(safeRatio(0, 0)).toBeNull();
    expect(safeRatio(1, 4)).toBe(0.25);
  });
  it('labels p50/p90 durations', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(120)).toBe('2m');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(3900)).toBe('1h 5m');
    expect(formatDuration(7200)).toBe('2h');
    expect(formatDuration(-1)).toBe('—');
  });
  it('formats counts', () => {
    expect(formatCount(1234567)).toBe('12,34,567');
    expect(formatCount(undefined)).toBe('—');
  });
});

describe('funnel and empty state', () => {
  it('detects the no-events state', () => {
    expect(hasNoPushEvents(undefined)).toBe(true);
    expect(hasNoPushEvents({ sent: 0, failed: 0, delivered: 0, opened: 0 })).toBe(true);
    expect(hasNoPushEvents({ sent: 0, failed: 1, delivered: 0, opened: 0 })).toBe(false);
  });
  it('computes funnel shares of sent without dividing by zero', () => {
    expect(funnelSteps({ sent: 4, delivered: 3, opened: 2 }).map((s) => s.pctOfSent)).toEqual([1, 0.75, 0.5]);
    expect(funnelSteps({ sent: 0, delivered: 0, opened: 1 }).map((s) => s.pctOfSent)).toEqual([null, null, null]);
  });
  it('computes the unknown-platform share', () => {
    expect(unknownPlatformShare([{ platform: 'unknown', sent: 3 }, { platform: 'ios', sent: 1 }])).toBe(0.75);
    expect(unknownPlatformShare([])).toBeNull();
  });
});

describe('type table sorting', () => {
  const row = (type: string, sent: number, openRate: number): PushTypeRow => ({ type, sent, failed: 0, delivered: 0, opened: 0, deliveredRate: 0, openRate });
  const rows = [row('b', 5, 0.1), row('a', 5, 0.9), row('c', 9, 0.5)];
  it('defaults to most sent first and sorts ties by name', () => {
    expect(sortPushTypes(rows, parsePushSort(undefined, undefined)).map((r) => r.type)).toEqual(['c', 'a', 'b']);
  });
  it('sorts by rate and by name, both directions, without mutating', () => {
    expect(sortPushTypes(rows, parsePushSort('openRate', 'desc')).map((r) => r.type)).toEqual(['a', 'c', 'b']);
    expect(sortPushTypes(rows, parsePushSort('type', undefined)).map((r) => r.type)).toEqual(['a', 'b', 'c']);
    expect(sortPushTypes(rows, parsePushSort('sent', 'asc')).map((r) => r.type)).toEqual(['a', 'b', 'c']);
    expect(rows.map((r) => r.type)).toEqual(['b', 'a', 'c']);
  });
  it('ignores unknown sort keys', () => {
    expect(parsePushSort('__proto__', 'sideways')).toEqual({ key: 'sent', dir: 'desc' });
  });
  it('keeps the selected type selectable', () => {
    expect(typeOptions([{ type: 'a', sent: 1 }], 'zz')).toEqual(['a', 'zz']);
    expect(typeOptions(undefined, '')).toEqual([]);
  });
});
