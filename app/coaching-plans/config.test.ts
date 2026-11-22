import { describe, expect, it } from 'vitest';
import { pricePaise, boundedInteger, boundedText } from './config';

describe('editable coaching prices', () => {
  it('converts rupees exactly to paise and preserves unpublished prices', () => {
    expect(pricePaise('4499', true)).toBe(449900);
    expect(pricePaise('1234.56', true)).toBe(123456);
    expect(pricePaise('0.29', true)).toBe(29);
    expect(pricePaise('', true)).toBeNull();
    expect(pricePaise('1000000', false)).toBe(100000000);
  });
  it('rejects zero, negatives, fractional paise and scientific notation', () => {
    for (const value of ['', '0', '-1', '1.001', '1e3', 'NaN', '1000000.01']) expect(() => pricePaise(value, false)).toThrow();
  });
});

describe('bounded plan fields', () => {
  it('accepts integers within the per-field limit', () => {
    expect(boundedInteger('30', 'p.durationDays')).toBe(30);
    expect(boundedInteger('21', 'p.checkInsPerWeek')).toBe(21);
  });
  it('rejects non-integers and over-limit values', () => {
    expect(() => boundedInteger('22', 'p.checkInsPerWeek')).toThrow(/at most 21/);
    expect(() => boundedInteger('99999999', 'p.durationDays')).toThrow(/at most 3650/);
    expect(() => boundedInteger('1.5', 'p.labCredits')).toThrow(/whole number/);
    expect(() => boundedInteger('-1', 'p.labCredits')).toThrow();
    expect(() => boundedInteger('', 'p.labCredits')).toThrow();
    expect(() => boundedInteger('9'.repeat(30), 'p.labCredits')).toThrow();
  });
  it('trims and caps text length', () => {
    expect(boundedText('  hi  ', 'p.title')).toBe('hi');
    expect(() => boundedText('x'.repeat(101), 'p.title')).toThrow(/100/);
    expect(() => boundedText('x'.repeat(1001), 'p.description')).toThrow(/1000/);
  });
});
