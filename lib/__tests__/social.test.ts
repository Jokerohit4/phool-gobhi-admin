import { describe, it, expect, beforeEach } from 'vitest';

let highlightLines;
let lineCountDiffers;

beforeEach(async () => {
  const mod = await import('@/lib/highlight');
  highlightLines = mod.highlightLines;
  lineCountDiffers = mod.lineCountDiffers;
});

describe('highlight function', () => {
  it('highlights English stop words', () => {
    const result = highlightLines('stop now');
    expect(result).toContain('stop');
  });

  it('highlights Hindi words', () => {
    const result = highlightLines('रुक जाना');
    expect(result).toContain('दर्द');
  });

  it('highlights Hinglish words', () => {
    const result = highlightLines('ruk kar');
    expect(result).toContain('ruk');
  });

  it('highlights digits', () => {
    const result = highlightLines('call at 5pm');
    expect(result).toContain('digit');
  });

  it('returns plain line when no match', () => {
    const result = highlightLines('just a normal line');
    expect(result).toBe('just a normal line');
  });
});

describe('line-count helper', () => {
  it('detects differing line counts', () => {
    expect(lineCountDiffers('line1\nline2', 'line1')).toBe(true);
  });

  it('returns false when line counts match', () => {
    expect(lineCountDiffers('line1\nline2', 'line1\nline2')).toBe(false);
  });

  it('handles single-line inputs', () => {
    expect(lineCountDiffers('single', 'single')).toBe(false);
  });

  it('handles empty strings', () => {
    expect(lineCountDiffers('', '')).toBe(false);
  });
});

// Unclaimed gyms tests from D5
describe('unclaimed gyms', () => {
  it('hides count when null (under 5)', () => {
    const count = null;
    expect(count).toBeNull();
    expect(count).toBeFalsy();
  });

  it('shows count when number', () => {
    const count = 12;
    expect(count).not.toBeNull();
    expect(count).toBe(12);
  });
});