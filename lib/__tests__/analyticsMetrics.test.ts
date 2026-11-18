import { describe, expect, it } from 'vitest';
import { analyticsDays, averagePer, rangeButtonLabel, rangeSentence, rangeWindowName } from '../analyticsMetrics';

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

describe('today window', () => {
  it('passes "today" through in any case and keeps the numeric windows', () => {
    expect(analyticsDays('today')).toBe('today');
    expect(analyticsDays(' Today ')).toBe('today');
    expect(analyticsDays('7')).toBe('7');
    expect(analyticsDays('todayx')).toBe('30');
  });
  it('words the window for buttons and headings', () => {
    expect(rangeButtonLabel('today')).toBe('Today');
    expect(rangeButtonLabel('30')).toBe('30 days');
    expect(rangeButtonLabel('30', true)).toBe('30d');
    expect(rangeSentence('today')).toBe('Today (since midnight IST)');
    expect(rangeSentence('90')).toBe('Last 90 days');
    expect(rangeWindowName('today')).toBe('today (since midnight IST)');
    expect(rangeWindowName('7')).toBe('7-day');
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
