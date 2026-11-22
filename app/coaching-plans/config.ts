export type PlanConfig = {
  product: string; title: string; description: string; badge: string; ctaLabel: string;
  enabled: boolean; featured: boolean; amountPaise: number | null; durationDays: number;
  gymAccess: boolean; gymArea: string; gymVisitsPerMonth: number; gymDescription: string;
  trainerSupport: boolean; freeFormSessions: number; trainerDescription: string;
  checkInsPerWeek: number; coachingDescription: string; mealRoutine: boolean; mealDescription: string;
  dietitianReview: boolean; doctorClearanceForRed: boolean; clinicalDescription: string;
  labCredits: number; labDescription: string; onboardingDescription: string;
};
export type AddonConfig = { enabled: boolean; title: string; description: string; amountPaise: number; sessions: number; validityDays: number };
export type RegionConfig = { label: string; plans: PlanConfig[]; addon: AddonConfig };
export type CatalogConfig = { regions: Record<'GURUGRAM' | 'REST_INDIA', RegionConfig> };
export type ConfigResponse = { version: number; config: CatalogConfig; updatedAt: string | null; updatedBy: number | null; history?: { version: number; updatedBy: number; createdAt: string }[] };
export const textFields = ['title', 'description', 'badge', 'ctaLabel', 'gymArea', 'gymDescription', 'trainerDescription', 'coachingDescription', 'mealDescription', 'clinicalDescription', 'labDescription', 'onboardingDescription'] as const;
export const numberFields = ['durationDays', 'gymVisitsPerMonth', 'freeFormSessions', 'checkInsPerWeek', 'labCredits'] as const;
export const booleanFields = ['enabled', 'featured', 'gymAccess', 'trainerSupport', 'mealRoutine', 'dietitianReview', 'doctorClearanceForRed'] as const;

export function pricePaise(value: string, optional: boolean): number | null {
  const raw = value.trim();
  if (raw === '' && optional) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error('Enter a price in rupees with at most two decimal places');
  const [whole, fraction = ''] = raw.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000000) throw new Error('Enter a price from ₹0.01 to ₹10,00,000');
  return amount;
}

// Upper bounds for the numeric plan fields (inclusive). Anything above is
// almost certainly a typo, and these values feed pricing/entitlement logic.
export const numberLimits: Record<string, number> = {
  durationDays: 3650,
  gymVisitsPerMonth: 62,
  freeFormSessions: 1000,
  checkInsPerWeek: 21,
  labCredits: 100,
  sessions: 1000,
  validityDays: 3650,
};

// Maximum characters for text fields; `title`/`badge`/`ctaLabel`/`gymArea`/
// `label` are short labels, the rest are descriptions.
export const textLimits: Record<string, number> = {
  label: 100,
  title: 100,
  badge: 40,
  ctaLabel: 60,
  gymArea: 120,
};
export const DEFAULT_TEXT_LIMIT = 1000;

export function boundedInteger(raw: string, name: string): number {
  const field = name.split('.').at(-1) || name;
  if (!/^\d{1,9}$/.test(raw)) throw new Error(`Enter a whole number for ${field}`);
  const value = Number(raw);
  const max = numberLimits[field];
  if (max !== undefined && value > max) throw new Error(`${field} must be at most ${max}`);
  return value;
}

export function boundedText(value: string, name: string): string {
  const field = name.split('.').at(-1) || name;
  const max = textLimits[field] ?? DEFAULT_TEXT_LIMIT;
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error(`${field} must be ${max} characters or fewer`);
  return trimmed;
}
