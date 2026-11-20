import { formatDateTimeIST } from '@/lib/dateFormat';

export const APP_OPTIONS = ['customer', 'partner'] as const;
export const PLATFORM_OPTIONS = ['android', 'ios'] as const;

export interface AppVersionEntry {
  minVersion: string;
  latestVersion: string;
  updateUrl: string;
  message: string;
}

export type AppVersionConfig = Record<
  (typeof APP_OPTIONS)[number],
  Record<(typeof PLATFORM_OPTIONS)[number], AppVersionEntry>
>;

export type FeatureFlags = Record<string, { enabled: boolean }>;

export interface MaintenanceEntry {
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  message: string;
}

export type MaintenanceConfig = Record<'wallet' | 'gyms', MaintenanceEntry>;

export interface CancellationTier {
  maxHoursNotice: number | null;
  refundRate: number;
  blocked: boolean;
}

export interface CancellationPolicy {
  tiers: CancellationTier[];
  updatedAt: string | null;
}

export type OtpProvider = 'fast2sms' | 'firebase' | 'skip';

export interface OtpSkipAllowlistEntry {
  id: number;
  phone: string;
  note: string | null;
  createdAt: string;
}

export interface WalletTopupConfig {
  presets: number[];
  allowCustomAmount: boolean;
  minCustomAmount: number | null;
  maxCustomAmount: number | null;
  updatedAt: string | null;
}

export interface ProfileCompletionBonusConfig {
  amount: number;
  updatedAt: string | null;
}

export const OTP_PROVIDER_OPTIONS: Array<{ value: OtpProvider; label: string; description: string }> = [
  { value: 'firebase', label: 'Firebase phone auth', description: 'Default ? real Firebase phone verification, no SMS cost.' },
  {
    value: 'fast2sms',
    label: 'Fast2SMS (real SMS, paid)',
    description: 'Real paid SMS to every phone number ? only used when explicitly selected here.',
  },
  {
    value: 'skip',
    label: 'Skip (allowlist only, for testing)',
    description:
      'Allowlisted numbers below verify with 123456, no real OTP sent. Every other number falls back to real Firebase phone verification ? Fast2SMS never fires unless it?s explicitly selected above.',
  },
];

// Inverse of launchInputToUtcIso in actions.ts ? same fixed +5:30 IST offset,
// reversed: treat the stored UTC instant as IST wall clock for the input.
export function utcIsoToLaunchInput(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const ist = new Date(ms + 330 * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}T${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
}

export const MAINTENANCE_SECTIONS = [
  { feature: 'wallet' as const, label: 'Wallet', blurb: 'Blocks wallet, top-up, and transactions pages/APIs.' },
  { feature: 'gyms' as const, label: 'Gyms', blurb: 'Blocks gym browsing, details, and booking pages/APIs.' },
];

export const EMPTY_MAINTENANCE_ENTRY: MaintenanceEntry = {
  enabled: false,
  startsAt: null,
  endsAt: null,
  message: '',
};

export const EMPTY_APP_VERSION_ENTRY: AppVersionEntry = {
  minVersion: '',
  latestVersion: '',
  updateUrl: '',
  message: '',
};

export const APP_VERSION_ROWS: { app: 'customer' | 'partner'; platform: 'android' | 'ios'; label: string }[] = [
  { app: 'customer', platform: 'android', label: 'Customer ? Android' },
  { app: 'customer', platform: 'ios', label: 'Customer ? iOS' },
  { app: 'partner', platform: 'android', label: 'Partner ? Android' },
  { app: 'partner', platform: 'ios', label: 'Partner ? iOS' },
];

export function normalizeAppVersionConfig(raw: unknown): AppVersionConfig {
  const config = raw as Record<string, Record<string, Partial<AppVersionEntry>>> | null | undefined;
  const merged = {} as AppVersionConfig;
  for (const { app, platform } of APP_VERSION_ROWS) {
    merged[app] = merged[app] || ({} as AppVersionConfig['customer']);
    merged[app][platform] = { ...EMPTY_APP_VERSION_ENTRY, ...(config?.[app]?.[platform] || {}) };
  }
  return merged;
}

export function normalizeTiers(raw: unknown): CancellationTier[] {
  const tiers = Array.isArray(raw) ? ([...(raw as CancellationTier[])] as CancellationTier[]) : [];
  if (tiers.length === 0) {
    tiers.push(
      { maxHoursNotice: 1, refundRate: 0, blocked: true },
      { maxHoursNotice: 2, refundRate: 0.5, blocked: false },
      { maxHoursNotice: 3, refundRate: 0.75, blocked: false },
      { maxHoursNotice: null, refundRate: 1, blocked: false },
    );
  }
  tiers.sort((a, b) => {
    if (a.maxHoursNotice === null) return 1;
    if (b.maxHoursNotice === null) return -1;
    return a.maxHoursNotice - b.maxHoursNotice;
  });
  while (tiers.length < 4) tiers.push({ maxHoursNotice: null, refundRate: 1, blocked: false });
  return tiers.slice(0, 4);
}

export function formatDateIST(value: string) {
  try {
    return formatDateTimeIST(value);
  } catch {
    return value;
  }
}

export { formatDateTimeIST };
