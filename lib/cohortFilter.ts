// Account-cohort lens for the Analytics page (?cohort=...). The value is "all"
// or a comma list of AccountCohort names; the backend (booking-service
// utils/cohortScope.js) validates it again and applies it to events by user id.
import { COHORTS, cohortLabel, type Cohort } from '@/app/users/cohorts';

export const COHORT_PRESETS = [
  { label: 'All accounts', value: 'all' },
  { label: 'Unknown users', value: 'UNKNOWN_USERS', hint: 'Everyone not tagged as friends & family, generated or testing, plus anonymous visitors' },
  { label: 'Friends & family', value: 'FRIENDS_AND_FAMILY' },
  { label: 'Generated', value: 'GENERATED_ACCOUNTS' },
  { label: 'Testing', value: 'TESTING_ACCOUNTS' },
  { label: 'All internal', value: 'FRIENDS_AND_FAMILY,GENERATED_ACCOUNTS,TESTING_ACCOUNTS', hint: 'Friends & family, generated and testing together' },
] as const;

// Normalises the query param: unknown/blank -> "all"; any valid combination ->
// canonical enum order; every cohort selected -> "all".
export function cohortSelection(raw?: string): string {
  if (!raw) return 'all';
  const wanted = new Set(
    raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
  );
  if (wanted.size === 0 || wanted.has('ALL')) return 'all';
  const known = COHORTS.filter((c) => wanted.has(c));
  if (known.length === 0 || known.length !== wanted.size) return 'all';
  return known.length === COHORTS.length ? 'all' : known.join(',');
}

// "&cohort=..." for a URL that already has a query string; empty for "all".
export function cohortQs(cohort: string): string {
  return cohort === 'all' ? '' : `&cohort=${encodeURIComponent(cohort)}`;
}

export function cohortSummary(cohort: string): string {
  if (cohort === 'all') return 'All accounts';
  const preset = COHORT_PRESETS.find((p) => p.value === cohort);
  if (preset) return preset.label;
  return cohort.split(',').map((c) => cohortLabel(c as Cohort)).join(' + ');
}

// Views whose data is user-activity events and so can be segmented by cohort.
// Supply, gift & bonus payouts, user journey and the website geography panel
// are deliberately left out: they describe partners, payouts, one person, or
// anonymous footfall rather than segments of users.
export const COHORT_VIEWS = new Set([
  'traffic', 'reach', 'customerOnboarding', 'conversion', 'fulfillment', 'activation',
  'wallet', 'buddy', 'city', 'revenue', 'retention', 'signupRetention', 'badges', 'eventSearch', 'funnels',
]);
