import { describe, expect, it } from 'vitest';
import { dailyTrafficPoints, engagementDuration, trafficSelection, type TrafficReport } from '../traffic';

describe('traffic selection', () => {
  it('defaults to All and only applies Android/iOS to the mobile products', () => {
    expect(trafficSelection()).toEqual({ product: 'all', platform: 'both' });
    expect(trafficSelection('customer', 'ios')).toEqual({ product: 'customer', platform: 'ios' });
    expect(trafficSelection('partner', 'android')).toEqual({ product: 'partner', platform: 'android' });
    expect(trafficSelection('website', 'ios')).toEqual({ product: 'website', platform: 'both' });
    expect(trafficSelection('constructor', 'android')).toEqual({ product: 'all', platform: 'both' });
    expect(trafficSelection('customer', 'web')).toEqual({ product: 'customer', platform: 'both' });
  });
});

describe('engagement display', () => {
  it('distinguishes missing time from observed zero and formats elapsed durations', () => {
    expect(engagementDuration(null)).toBe('—');
    expect(engagementDuration(0)).toBe('0s');
    expect(engagementDuration(89.8)).toBe('1m 30s');
    expect(engagementDuration(3670)).toBe('1h 1m');
  });

  it('fills inactive IST dates without dropping a partial boundary date', () => {
    const report = {
      asOf: '2026-11-17T19:00:00.000Z', filters: { days: 2 },
      daily: [{ label: '2026-11-16', users: 5, views: 8 }, { label: '2026-11-18', users: 1, views: 2 }],
    } as TrafficReport;
    expect(dailyTrafficPoints(report, 'users')).toEqual([
      { day: '2026-11-16', value: 5 }, { day: '2026-11-17', value: 0 }, { day: '2026-11-18', value: 1 },
    ]);
    report.asOf = '2026-11-17T18:30:00.000Z';
    expect(dailyTrafficPoints(report, 'views').map(point => point.day)).toEqual(['2026-11-16', '2026-11-17']);
  });
});
