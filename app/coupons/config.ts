import { parseISTFormDate } from '@/lib/istFormDate';
import { pricePaise } from '@/lib/rupees';

export const COUPONS_PATH = '/api/wallet/coaching/admin/coupons';
const MAX_INT = 2147483647;

export type CouponFields = {
  kind: 'fixed' | 'percent';
  value: number;
  offerKeys: string[] | null;
  activeFrom: string | null;
  activeTo: string | null;
  maxRedemptions: number | null;
  perCustomerLimit: number | null;
};

export type Coupon = CouponFields & {
  code: string;
  enabled: boolean;
  updatedAt: string;
  redemptionCounts: { reserved: number; redeemed: number; released: number };
};

export function couponCode(raw: FormDataEntryValue | null): string {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!/^[A-Z0-9_-]{1,32}$/.test(code)) {
    throw new Error('Use 1 to 32 letters, digits, underscores or hyphens for the coupon code');
  }
  return code;
}

function positiveInt(value: string, max: number, label: string): number {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(number) || number < 1 || number > max) {
    throw new Error(`${label} must be a whole number from 1 to ${max}`);
  }
  return number;
}

export function couponFields(form: FormData): CouponFields {
  const read = (name: string) => String(form.get(name) ?? '').trim();
  const kind = read('kind');
  if (kind !== 'fixed' && kind !== 'percent') throw new Error('Choose a fixed or percentage discount');
  const value = kind === 'fixed' ? pricePaise(read('value'), false, MAX_INT) : positiveInt(read('value'), 99, 'Percent');

  const eligibility = read('eligibility');
  if (eligibility !== 'all' && eligibility !== 'selected') throw new Error('Choose coupon eligibility');
  const offerKeys = eligibility === 'all' ? null : [...new Set(read('offerKeys').split(/[\s,]+/).filter(Boolean))];

  const from = read('activeFrom');
  const to = read('activeTo');
  const activeFrom = from ? parseISTFormDate(from, 'start date and time') : null;
  const activeTo = to ? parseISTFormDate(to, 'end date and time') : null;
  if (activeFrom && activeTo && Date.parse(activeFrom) >= Date.parse(activeTo)) {
    throw new Error('The active window must end after it starts');
  }

  const limit = (name: string, label: string) => {
    const raw = read(name);
    return raw ? positiveInt(raw, MAX_INT, label) : null;
  };

  return {
    kind, value, offerKeys, activeFrom, activeTo,
    maxRedemptions: limit('maxRedemptions', 'Total limit'),
    perCustomerLimit: limit('perCustomerLimit', 'Per-customer limit'),
  };
}
