import { describe, it, expect } from 'vitest';
import { COHORTS, cohortLabel, isCohort, parseUserIds } from '../cohorts';

describe('cohorts', () => {
  it('lists the four backend values', () => {
    expect([...COHORTS]).toEqual(['FRIENDS_AND_FAMILY', 'GENERATED_ACCOUNTS', 'TESTING_ACCOUNTS', 'UNKNOWN_USERS']);
  });
  it('validates and labels', () => {
    expect(isCohort('TESTING_ACCOUNTS')).toBe(true);
    expect(isCohort('VIP')).toBe(false);
    expect(isCohort(undefined)).toBe(false);
    expect(cohortLabel('FRIENDS_AND_FAMILY')).toBe('friends and family');
  });
  it('parses ids across separators and dedupes', () => {
    expect(parseUserIds('1, 2 3\n4,,2')).toEqual([1, 2, 3, 4]);
  });
  it('rejects bad input instead of skipping it', () => {
    expect(parseUserIds('')).toBeNull();
    expect(parseUserIds('1, abc')).toBeNull();
    expect(parseUserIds('0')).toBeNull();
    expect(parseUserIds('-3')).toBeNull();
    expect(parseUserIds('1.5')).toBeNull();
  });
});
