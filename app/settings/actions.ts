'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
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

export async function updateAppVersionConfigAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession();

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

  try {
    await gatewayJson('/api/auth/app-config/admin', {
      method: 'PUT',
      body: JSON.stringify({ config }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to save app version config' };
  }

  revalidatePath('/settings');
  return { ok: true, message: 'App version config updated' };
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
