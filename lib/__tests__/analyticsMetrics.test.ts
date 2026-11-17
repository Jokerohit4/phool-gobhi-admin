import { describe, expect, it } from 'vitest';
import { analyticsDays, averagePer } from '../analyticsMetrics';

describe('analytics window', () => {
  it('accepts supported whole-day windows and normalizes URL values', () => {
    for (const days of ['1', '7', '30', '90', '365']) expect(analyticsDays(days)).toBe(days);
    expect(analyticsDays('007')).toBe('7');
  });

  it('defaults invalid windows so the UI and API agree', () => {
    for (const days of [undefined, '', '0', '-7', '366', 'Infinity', 'NaN', '7&country=India', '1.5']) {
      expect(analyticsDays(days)).toBe('30');
    }
  });
});

describe('traffic averages', () => {
  it('does not imply zero engagement when the denominator is missing', () => {
    expect(averagePer(0, 0)).toBe('—');
    expect(averagePer(12, 0)).toBe('—');
  });

  it('keeps real zero values and rounds ratios to two decimal places', () => {
    expect(averagePer(0, 5)).toBe('0');
    expect(averagePer(100, 30)).toBe('3.33');
    expect(averagePer(15, 10)).toBe('1.5');
  });
});
