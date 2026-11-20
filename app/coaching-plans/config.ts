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
