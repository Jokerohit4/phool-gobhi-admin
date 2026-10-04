'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { loadFlagRegistry } from './flagRegistry';
import type { ActionState } from '@/components/ui/ActionForm';

// Fixed 4-row shape matching booking-service's DEFAULT_CANCELLATION_TIERS —
// editing adds/removes tiers is deliberately out of scope for v1, just the
// numbers within each existing tier.
const TIER_KEYS = ['tier0', 'tier1', 'tier2', 'tier3'] as const;

export async function updateCancellationPolicyAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession();

  const tiers = TIER_KEYS.map((key, i) => {
    const isLast = i === TIER_KEYS.length - 1;
    const maxHoursRaw = String(formData.get(`${key}_maxHours`) || '').trim();
    const refundPercent = Number(formData.get(`${key}_refundPercent`) || 0);
    const blocked = formData.get(`${key}_blocked`) === 'on';
    return {
      maxHoursNotice: isLast || maxHoursRaw === '' ? null : Number(maxHoursRaw),
      blocked,
      refundRate: Math.max(0, Math.min(100, refundPercent)) / 100,
    };
  });

  try {
    await gatewayJson('/api/bookings/cancellation-policy', {
      method: 'PUT',
      body: JSON.stringify({ tiers }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to save policy' };
  }

  revalidatePath('/settings');
  return { ok: true, message: 'Cancellation policy updated' };
}

// IST has no DST and a fixed +5:30 offset, so this is a plain constant rather
// than a real timezone conversion. The datetime-local input's value is
// treated as IST wall-clock (not the admin's browser timezone) so the page
// renders identically regardless of where the admin is signed in from —
// launchInputToUtcIso is the inverse of utcIsoToLaunchInput in page.tsx.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function launchInputToUtcIso(value: string): string | null {
  if (!value) return null;
  const asIfUtc = new Date(`${value}:00.000Z`).getTime();
  if (Number.isNaN(asIfUtc)) return null;
  return new Date(asIfUtc - IST_OFFSET_MS).toISOString();
}

export async function updateLaunchGateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  const enabled = formData.get('enabled') === 'on';
  const launchAtRaw = String(formData.get('launchAt') || '').trim();
  // Enabled + no date = held gated indefinitely (deliberate manual-hold state).
  const launchAt = launchInputToUtcIso(launchAtRaw);

  try {
    await gatewayJson('/api/auth/launch-gate/admin', {
      method: 'PUT',
      body: JSON.stringify({ enabled, launchAt }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to save launch gate' };
  }

  revalidatePath('/settings');
  return { ok: true, message: 'Launch gate updated' };
}

const APP_VERSION_KEYS: Array<{ app: 'customer' | 'partner'; platform: 'android' | 'ios' }> = [
  { app: 'customer', platform: 'android' },
  { app: 'customer', platform: 'ios' },
  { app: 'partner', platform: 'android' },
  { app: 'partner', platform: 'ios' },
];

// The feature-flag shape is deliberately NOT declared here any more.
//
// This interface used to list fifteen flag names by hand, and auth-service's
// DEFAULT_FEATURES listed its own set, and the customer app's AppConfigModel
// listed a third. They drifted, silently, and the drift was invisible: nothing
// compared them.
//
//   - `runTracker` shipped and was the only flag off in dev, and was not in this
//     list — so it could not be switched on from this portal at all. Only a
//     direct config-blob edit or a code deploy reached it.
//   - `referral` was read by the customer app but declared nowhere, so it used
//     the client's own fail-open default forever with no backend gate.
//   - `fhirExport` had been checked by health-service since ABHA Stage 0 and
//     appeared in no list at all.
//
// The flag list now comes from GET /api/auth/app-config/registry via
// loadFlagRegistry in ./flagRegistry. This interface survives only as the shape
// of the `features` key in the config blob, which is an open map: an admin
// saving the settings form can set any flag the registry knows about, and one it
// does not know about is preserved untouched rather than dropped.
type FeatureFlags = Record<string, { enabled: boolean }>;

interface MaintenanceConfig {
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  message: string;
}

type MaintenanceConfigMap = Record<'wallet' | 'gyms', MaintenanceConfig>;

const DEFAULT_MAINTENANCE: MaintenanceConfigMap = {
  wallet: { enabled: false, startsAt: null, endsAt: null, message: '' },
  gyms: { enabled: false, startsAt: null, endsAt: null, message: '' },
};

// The whole config blob lives in one row (versions + features + maintenance
// share the same JSON), so every writer must read-modify-write rather than
// replace the blob — otherwise saving the app versions would silently drop
// the feature flags / maintenance windows and vice versa.
async function loadCurrentAppConfig(): Promise<{
  versions: Record<string, Record<string, unknown>>;
  features: FeatureFlags;
  maintenance: MaintenanceConfigMap;
}> {
  const { data } = await gatewayJson<{ data: Record<string, unknown> }>('/api/auth/app-config/admin');
  const { features, maintenance, ...versions } = data;
  return {
    versions: versions as Record<string, Record<string, unknown>>,
    // No defaults merged in here any more. auth-service already spreads the flag
    // registry's defaults under the stored blob before serving it, so whatever
    // this endpoint returns IS the effective value of every known flag. Merging a
    // second copy of the defaults locally is what let the portal and the server
    // disagree about what "unset" meant.
    features: (features as FeatureFlags) || {},
    maintenance: {
      wallet: { ...DEFAULT_MAINTENANCE.wallet, ...((maintenance as Partial<MaintenanceConfigMap>)?.wallet || {}) },
      gyms: { ...DEFAULT_MAINTENANCE.gyms, ...((maintenance as Partial<MaintenanceConfigMap>)?.gyms || {}) },
    },
  };
}

export async function updateAppVersionConfigAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession();

  try {
    const current = await loadCurrentAppConfig();

    const config: Record<string, Record<string, unknown>> = {};
    for (const { app, platform } of APP_VERSION_KEYS) {
      const prefix = `${app}_${platform}`;
      config[app] = config[app] || {};
      config[app][platform] = {
        minVersion: String(formData.get(`${prefix}_minVersion`) || '').trim(),
        latestVersion: String(formData.get(`${prefix}_latestVersion`) || '').trim(),
        updateUrl: String(formData.get(`${prefix}_updateUrl`) || '').trim(),
        message: String(formData.get(`${prefix}_message`) || '').trim(),
      };
    }

    await gatewayJson('/api/auth/app-config/admin', {
      method: 'PUT',
      body: JSON.stringify({ config: { ...config, maintenance: current.maintenance, features: current.features } }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to save app version config' };
  }

  revalidatePath('/settings');
  return { ok: true, message: 'App version config updated' };
}

export async function updateFeatureFlagsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  try {
    // The list of flags to write comes from the server's registry, not from this
    // file. If the registry endpoint is unreachable the save is refused rather
    // than falling back to a local list: a fallback here would silently write
    // back a subset and turn every flag it omits off, which is the exact failure
    // this was restructured to prevent.
    const { flags, failed } = await loadFlagRegistry();
    if (failed || !flags.length) {
      return { ok: false, message: 'Could not load the feature-flag registry — refusing to save so no flag is dropped' };
    }

    const current = await loadCurrentAppConfig();

    // Start from what is stored so a flag the form does not render is preserved.
    // Rebuilding the object from the form alone used to wipe healthPersonalisation
    // and recapSharing every time anyone saved this page; they fell back to
    // false in auth-service, so the failure was silent and fail-safe rather than
    // dangerous, but it still reset them without telling anyone.
    const features: FeatureFlags = { ...current.features };
    for (const flag of flags) {
      // The checkbox is named after the flag's clientKey, which is what the
      // customer app reads — so the form and the app cannot disagree about which
      // flag a toggle controls. fhirExport has clientKey null (it is a
      // query-parameter branch on an existing route, with no app surface), so it
      // is rendered but its toggle is posted under the flag name.
      const field = flag.clientKey || flag.name;
      features[flag.name] = { enabled: formData.get(field) === 'on' };
    }

    await gatewayJson('/api/auth/app-config/admin', {
      method: 'PUT',
      body: JSON.stringify({ config: { ...current.versions, maintenance: current.maintenance, features } }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to save feature flags' };
  }

  revalidatePath('/settings');
  return { ok: true, message: 'Feature flags updated' };
}

export async function updateMaintenanceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  const feature = String(formData.get('feature') || '');
  if (feature !== 'wallet' && feature !== 'gyms') {
    return { ok: false, message: 'Unknown maintenance target' };
  }

  const enabled = formData.get('enabled') === 'on';
  const startsAt = launchInputToUtcIso(String(formData.get('startsAt') || '').trim());
  const endsAt = launchInputToUtcIso(String(formData.get('endsAt') || '').trim());
  if (startsAt && endsAt && new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
    return { ok: false, message: 'Start must be before end' };
  }
  const message = String(formData.get('message') || '').trim();

  try {
    const current = await loadCurrentAppConfig();
    const maintenance: MaintenanceConfigMap = {
      ...current.maintenance,
      [feature]: { enabled, startsAt, endsAt, message },
    };
    await gatewayJson('/api/auth/app-config/admin', {
      method: 'PUT',
      body: JSON.stringify({ config: { ...current.versions, maintenance, features: current.features } }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to save maintenance window' };
  }

  revalidatePath('/settings');
  return { ok: true, message: `${feature === 'wallet' ? 'Wallet' : 'Gyms'} maintenance updated` };
}

export async function updateOtpConfigAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  const provider = String(formData.get('provider') || '');

  try {
    await gatewayJson('/api/auth/otp-config/admin', {
      method: 'PUT',
      body: JSON.stringify({ provider }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to save OTP provider' };
  }

  revalidatePath('/settings');
  return { ok: true, message: 'OTP provider updated' };
}

export async function updateProfileCompletionBonusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession();

  const amount = Number(formData.get('amount'));
  if (!Number.isInteger(amount) || amount < 0 || amount > 1000) {
    return { ok: false, message: 'Enter a whole rupee amount between 0 and 1000 (0 disables the bonus)' };
  }

  try {
    await gatewayJson('/api/auth/profile-completion-bonus/admin', {
      method: 'PUT',
      body: JSON.stringify({ amount }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to save bonus amount' };
  }

  revalidatePath('/settings');
  return { ok: true, message: `Profile-completion bonus updated to ₹${amount}` };
}

export async function addOtpSkipAllowlistAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  const phone = String(formData.get('phone') || '').trim();
  const note = String(formData.get('note') || '').trim() || undefined;

  if (!phone) return { ok: false, message: 'Phone number is required' };

  try {
    await gatewayJson('/api/auth/otp-config/admin/skip-allowlist', {
      method: 'POST',
      body: JSON.stringify({ phone, note }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to add number' };
  }

  revalidatePath('/settings');
  return { ok: true, message: `Added ${phone}` };
}

export async function removeOtpSkipAllowlistAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = formData.get('id');

  try {
    await gatewayJson(`/api/auth/otp-config/admin/skip-allowlist/${id}`, { method: 'DELETE' });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to remove number' };
  }

  revalidatePath('/settings');
  return { ok: true, message: 'Number removed' };
}

interface WalletTopupConfigPayload {
  presets: number[];
  allowCustomAmount: boolean;
  minCustomAmount: number | null;
  maxCustomAmount: number | null;
}

// The backend's PUT replaces presets/allowCustomAmount/min/max together (it
// validates the "empty presets requires allowCustomAmount" invariant across
// all four at once) — so every action here reads the current config first
// and resubmits the full object, same read-modify-write shape as
// updateCancellationPolicyAction's tiers array.
async function getCurrentWalletTopupConfig(): Promise<WalletTopupConfigPayload> {
  const { data } = await gatewayJson<{ data: WalletTopupConfigPayload }>('/api/wallet/topup-config');
  return data;
}

export async function addWalletTopupPresetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  const amount = Number(formData.get('amount'));
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, message: 'Enter a whole positive rupee amount' };
  }

  try {
    const current = await getCurrentWalletTopupConfig();
    if (current.presets.includes(amount)) {
      return { ok: false, message: `₹${amount} is already a preset` };
    }
    await gatewayJson('/api/wallet/topup-config', {
      method: 'PUT',
      body: JSON.stringify({ ...current, presets: [...current.presets, amount] }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to add preset' };
  }

  revalidatePath('/settings');
  return { ok: true, message: `Added ₹${amount}` };
}

export async function removeWalletTopupPresetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  const amount = Number(formData.get('amount'));

  try {
    const current = await getCurrentWalletTopupConfig();
    const presets = current.presets.filter((a) => a !== amount);
    await gatewayJson('/api/wallet/topup-config', {
      method: 'PUT',
      body: JSON.stringify({ ...current, presets }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to remove preset' };
  }

  revalidatePath('/settings');
  return { ok: true, message: `Removed ₹${amount}` };
}

export async function updateWalletTopupCustomAmountAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession();

  const allowCustomAmount = formData.get('allowCustomAmount') === 'on';
  const minRaw = String(formData.get('minCustomAmount') || '').trim();
  const maxRaw = String(formData.get('maxCustomAmount') || '').trim();

  try {
    const current = await getCurrentWalletTopupConfig();
    await gatewayJson('/api/wallet/topup-config', {
      method: 'PUT',
      body: JSON.stringify({
        presets: current.presets,
        allowCustomAmount,
        minCustomAmount: allowCustomAmount && minRaw !== '' ? Number(minRaw) : null,
        maxCustomAmount: allowCustomAmount && maxRaw !== '' ? Number(maxRaw) : null,
      }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to save custom-amount settings' };
  }

  revalidatePath('/settings');
  return { ok: true, message: 'Custom-amount settings updated' };
}
