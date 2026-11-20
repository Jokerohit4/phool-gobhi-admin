import { describe, expect, it } from 'vitest';
import { pricePaise } from './config';

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
