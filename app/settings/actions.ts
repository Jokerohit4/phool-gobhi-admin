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
