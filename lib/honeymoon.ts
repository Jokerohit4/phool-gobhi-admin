import { formatDateIST } from '@/lib/dateFormat';

// Mirrors wallet-service's SUBSCRIPTION_SAAS_HONEYMOON_DAYS default — display
// only, the authoritative value (env-overridable) lives in wallet-service.
export const SUBSCRIPTION_SAAS_HONEYMOON_DAYS = 30;

export function honeymoonEndDate(partnershipStartDate: string): Date {
  return new Date(new Date(partnershipStartDate).getTime() + SUBSCRIPTION_SAAS_HONEYMOON_DAYS * 24 * 60 * 60 * 1000);
}

// Pulled out of any component so the Date.now() read isn't attributed to
// component render (every page calling this is server-rendered fresh per
// request anyway, so "now" here is always request time).
export function isInHoneymoon(partnershipStartDate: string | null): boolean {
  if (!partnershipStartDate) return false;
  return honeymoonEndDate(partnershipStartDate).getTime() > Date.now();
}

export function describeHoneymoonStatus(partnershipStartDate: string | null): string {
  if (!partnershipStartDate) return 'Not started — set on first approval';
  const end = honeymoonEndDate(partnershipStartDate);
  return isInHoneymoon(partnershipStartDate)
    ? `Active until ${formatDateIST(end.toISOString())}`
    : `Ended ${formatDateIST(end.toISOString())}`;
}
