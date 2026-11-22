import { describe, it, expect } from 'vitest';
import { parsePositiveId, parsePathSegment } from '../ids';

describe('parsePositiveId', () => {
  it('accepts positive integers', () => {
    expect(parsePositiveId('1')).toBe(1);
    expect(parsePositiveId(' 42 ')).toBe(42);
  });
  it.each(['', '0', '-1', '1.5', '1e3', '12abc', '1/2', '../x', '007', null, undefined])('rejects %j', (v) => {
    expect(parsePositiveId(v as string | null | undefined)).toBeNull();
  });
  it('rejects non-string form entries (files)', () => {
    expect(parsePositiveId(new File(['x'], 'x.txt'))).toBeNull();
  });
});

describe('parsePathSegment', () => {
  it('encodes unsafe characters', () => {
    expect(parsePathSegment('a/b?c')).toBe('a%2Fb%3Fc');
  });
  it('rejects empty and oversized values', () => {
    expect(parsePathSegment('  ')).toBeNull();
    expect(parsePathSegment('x'.repeat(200))).toBeNull();
    expect(parsePathSegment(null)).toBeNull();
  });
});
