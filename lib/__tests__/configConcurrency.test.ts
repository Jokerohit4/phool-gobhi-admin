import { describe, it, expect } from 'vitest';
import {
  CONFLICT_MESSAGE,
  configErrorState,
  expectedUpdatedAtFrom,
  isConfigConflict,
  readUpdatedAt,
} from '../configConcurrency';
import { restoreFormValues, type RestorableField } from '../formRestore';

const ISO = '2026-10-01T10:00:00.000Z';

describe('readUpdatedAt', () => {
  it('reads the top-level shape (auth-service)', () => {
    expect(readUpdatedAt({ data: {}, updatedAt: ISO })).toBe(ISO);
  });
  it('reads the nested shape (booking / wallet / challenge)', () => {
    expect(readUpdatedAt({ data: { updatedAt: ISO } })).toBe(ISO);
  });
  it('returns null when there is no row yet, or the value is junk', () => {
    expect(readUpdatedAt({ data: {}, updatedAt: null })).toBeNull();
    expect(readUpdatedAt({ data: { updatedAt: 'nope' } })).toBeNull();
    expect(readUpdatedAt(null)).toBeNull();
    expect(readUpdatedAt(undefined)).toBeNull();
  });
});

describe('expectedUpdatedAtFrom', () => {
  it('returns the posted token', () => {
    const fd = new FormData();
    fd.set('expectedUpdatedAt', ISO);
    expect(expectedUpdatedAtFrom(fd)).toBe(ISO);
  });
  it('is undefined when absent, blank, malformed or oversized (no concurrency check)', () => {
    const fd = new FormData();
    expect(expectedUpdatedAtFrom(fd)).toBeUndefined();
    fd.set('expectedUpdatedAt', '  ');
    expect(expectedUpdatedAtFrom(fd)).toBeUndefined();
    fd.set('expectedUpdatedAt', 'garbage');
    expect(expectedUpdatedAtFrom(fd)).toBeUndefined();
    fd.set('expectedUpdatedAt', ISO + 'x'.repeat(80));
    expect(expectedUpdatedAtFrom(fd)).toBeUndefined();
  });
  it('disappears from a JSON body when undefined', () => {
    expect(JSON.stringify({ a: 1, expectedUpdatedAt: expectedUpdatedAtFrom(new FormData()) })).toBe('{"a":1}');
  });
});

describe('configErrorState', () => {
  it('maps CONFIG_CONFLICT to the per-section conflict message and flag', () => {
    const err = Object.assign(new Error('This setting was changed by someone else. Reload and try again.'), {
      status: 409,
      errorCode: 'CONFIG_CONFLICT',
    });
    expect(isConfigConflict(err)).toBe(true);
    expect(configErrorState(err, 'fallback')).toEqual({ ok: false, conflict: true, message: CONFLICT_MESSAGE });
    expect(CONFLICT_MESSAGE).toContain('reload');
    expect(CONFLICT_MESSAGE).toContain('re-apply your edit');
  });
  it('leaves other 409s and ordinary errors alone', () => {
    const dup = Object.assign(new Error('This number is already on the list'), { status: 409 });
    expect(isConfigConflict(dup)).toBe(false);
    expect(configErrorState(dup, 'fallback')).toEqual({ ok: false, message: 'This number is already on the list' });
    expect(configErrorState('boom', 'fallback')).toEqual({ ok: false, message: 'fallback' });
  });
});

describe('restoreFormValues', () => {
  const field = (over: Partial<RestorableField>): RestorableField => ({ type: 'text', value: '', ...over });

  it('puts typed text, checkbox and select values back', () => {
    const fd = new FormData();
    fd.set('minVersion', '2.0.0');
    fd.set('enabled', 'on');
    fd.set('provider', 'skip');
    const fields: RestorableField[] = [
      field({ name: 'minVersion', value: '1.0.0' }),
      field({ name: 'enabled', type: 'checkbox', value: 'on', checked: false }),
      field({ name: 'other', type: 'checkbox', value: 'on', checked: true }),
      field({ name: 'provider', type: 'radio', value: 'skip', checked: false }),
      field({ name: 'provider', type: 'radio', value: 'firebase', checked: true }),
    ];
    restoreFormValues(fields, fd);
    expect(fields[0].value).toBe('2.0.0');
    expect(fields[1].checked).toBe(true);
    expect(fields[2].checked).toBe(false);
    expect(fields[3].checked).toBe(true);
    expect(fields[4].checked).toBe(false);
  });

  it('never touches the concurrency token or hidden fields', () => {
    const fd = new FormData();
    fd.set('expectedUpdatedAt', 'tampered');
    fd.set('feature', 'gyms');
    const token = field({ name: 'expectedUpdatedAt', type: 'hidden', value: ISO });
    const hidden = field({ name: 'feature', type: 'hidden', value: 'wallet' });
    restoreFormValues([token, hidden], fd);
    expect(token.value).toBe(ISO);
    expect(hidden.value).toBe('wallet');
  });
});
