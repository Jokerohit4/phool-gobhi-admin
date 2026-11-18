import { describe, it, expect } from 'vitest';
import { COHORT_PRESETS, COHORT_VIEWS, cohortQs, cohortSelection, cohortSummary } from '../cohortFilter';

describe('cohortSelection', () => {
  it('defaults to all for missing, blank, "all" or junk', () => {
    expect(cohortSelection(undefined)).toBe('all');
    expect(cohortSelection('')).toBe('all');
    expect(cohortSelection('all')).toBe('all');
    expect(cohortSelection('VIP')).toBe('all');
    expect(cohortSelection('TESTING_ACCOUNTS,VIP')).toBe('all');
  });
  it('canonicalises order and case, and collapses every cohort to all', () => {
    expect(cohortSelection('testing_accounts,friends_and_family')).toBe('FRIENDS_AND_FAMILY,TESTING_ACCOUNTS');
    expect(cohortSelection('UNKNOWN_USERS,TESTING_ACCOUNTS,GENERATED_ACCOUNTS,FRIENDS_AND_FAMILY')).toBe('all');
  });
});

describe('cohortQs / cohortSummary', () => {
  it('omits the param for all and encodes lists', () => {
    expect(cohortQs('all')).toBe('');
    expect(cohortQs('FRIENDS_AND_FAMILY,TESTING_ACCOUNTS')).toBe('&cohort=FRIENDS_AND_FAMILY%2CTESTING_ACCOUNTS');
  });
  it('names presets and custom combinations', () => {
    expect(cohortSummary('all')).toBe('All accounts');
    expect(cohortSummary('UNKNOWN_USERS')).toBe('Unknown users');
    expect(cohortSummary('FRIENDS_AND_FAMILY,TESTING_ACCOUNTS')).toBe('friends and family + testing accounts');
  });
  it('every preset is already canonical', () => {
    for (const p of COHORT_PRESETS) expect(cohortSelection(p.value)).toBe(p.value);
  });
});

describe('COHORT_VIEWS', () => {
  it('covers user-activity views and leaves out supply, payouts and a single journey', () => {
    for (const v of ['traffic', 'conversion', 'retention', 'funnels']) expect(COHORT_VIEWS.has(v)).toBe(true);
    for (const v of ['supply', 'giftBonus', 'user']) expect(COHORT_VIEWS.has(v)).toBe(false);
  });
});
