// Mirrors the AccountCohort enum in auth-service (prisma/schema.prisma).
export const COHORTS = [
  'FRIENDS_AND_FAMILY',
  'GENERATED_ACCOUNTS',
  'TESTING_ACCOUNTS',
  'UNKNOWN_USERS',
] as const;
export type Cohort = (typeof COHORTS)[number];

export function isCohort(value: string | undefined | null): value is Cohort {
  return COHORTS.includes(value as Cohort);
}

export function cohortLabel(cohort: string): string {
  return cohort.toLowerCase().replace(/_/g, ' ');
}

// Accepts ids separated by commas, spaces or newlines. Returns null on any
// token that is not a positive integer so a typo is rejected, not skipped.
export function parseUserIds(raw: string): number[] | null {
  const tokens = raw.split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const ids: number[] = [];
  for (const t of tokens) {
    if (!/^\d+$/.test(t)) return null;
    const n = Number(t);
    if (!Number.isSafeInteger(n) || n <= 0) return null;
    ids.push(n);
  }
  return [...new Set(ids)];
}
