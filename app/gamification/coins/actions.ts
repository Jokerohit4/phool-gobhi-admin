'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

const MILESTONE_ROW_COUNT = 4;

export async function updateEconomyConfigAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  const coinsPerCheckin = Number(formData.get('coinsPerCheckin'));
  const weeklyTargetBonus = Number(formData.get('weeklyTargetBonus'));
  const pairedStreakWeeklyBonus = Number(formData.get('pairedStreakWeeklyBonus'));
  const qualifyingCheckinsPerWeek = Number(formData.get('qualifyingCheckinsPerWeek'));

  const milestones: Record<string, number> = {};
  for (let i = 0; i < MILESTONE_ROW_COUNT; i++) {
    const week = String(formData.get(`milestoneWeek_${i}`) || '').trim();
    const amount = String(formData.get(`milestoneAmount_${i}`) || '').trim();
    if (!week) continue;
    milestones[week] = Number(amount || 0);
  }

  try {
    await gatewayJson('/api/challenges/admin/coins/economy-config', {
      method: 'PUT',
      body: JSON.stringify({ coinsPerCheckin, weeklyTargetBonus, milestones, pairedStreakWeeklyBonus, qualifyingCheckinsPerWeek }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to save coin economy config' };
  }

  revalidatePath('/gamification/coins');
  return { ok: true, message: 'Coin economy config updated' };
}

// ─── On/off switches for the coin system ──────────────────────────────
// These are the same auth-service app-config feature flags Settings > Feature
// flags edits (streaksCoins gates every coin/streak route server-side,
// buddyPairedStreaks gates just the paired-streak bonus) — surfaced here too
// so "turn coins off entirely" lives next to the numbers it controls instead
// of requiring a trip to a different page. The whole features blob (plus
// versions/maintenance) must be read and resubmitted together, same
// read-modify-write requirement as Settings' updateFeatureFlagsAction, since
// PUT /app-config/admin replaces the config wholesale.
//
// This file used to carry its own `FeatureFlags` interface and
// `DEFAULT_FEATURES` literal listing five flag names — a THIRD hand-maintained
// copy of the same list (Settings' page.tsx and actions.ts had two more). The
// open map below plus auth-service spreading the registry's defaults before
// serving means the effective value of every known flag is already resolved by
// the time it reaches here, so there is nothing to default locally and nothing
// to keep in sync.
type FeatureFlags = Record<string, { enabled: boolean }>;

async function loadCurrentAppConfig(): Promise<{
  versions: Record<string, Record<string, unknown>>;
  features: FeatureFlags;
  maintenance: Record<string, unknown>;
}> {
  const { data } = await gatewayJson<{ data: Record<string, unknown> }>('/api/auth/app-config/admin');
  const { features, maintenance, ...versions } = data;
  return {
    versions: versions as Record<string, Record<string, unknown>>,
    features: (features as FeatureFlags) || {},
    maintenance: (maintenance as Record<string, unknown>) || {},
  };
}

export async function setCoinFeatureFlagsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  const streaksCoinsEnabled = formData.get('streaksCoinsEnabled') === 'on';
  const buddyPairedStreaksEnabled = formData.get('buddyPairedStreaksEnabled') === 'on';

  try {
    const current = await loadCurrentAppConfig();
    const features: FeatureFlags = {
      ...current.features,
      streaksCoins: { enabled: streaksCoinsEnabled },
      buddyPairedStreaks: { enabled: buddyPairedStreaksEnabled },
    };
    await gatewayJson('/api/auth/app-config/admin', {
      method: 'PUT',
      body: JSON.stringify({ config: { ...current.versions, maintenance: current.maintenance, features } }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to update flags' };
  }

  revalidatePath('/gamification/coins');
  return { ok: true, message: 'Coin system switches updated' };
}

export async function createCatalogItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  const key = String(formData.get('key') || '').trim();
  const category = String(formData.get('category') || '').trim();
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const coinCost = Number(formData.get('coinCost'));
  const discountAmountRaw = String(formData.get('discountAmount') || '').trim();
  const discountAmount = discountAmountRaw ? Number(discountAmountRaw) : null;

  if (!key || !category || !title || !Number.isInteger(coinCost) || coinCost <= 0) {
    return { ok: false, message: 'Key, category, title and a positive whole coinCost are required' };
  }

  try {
    await gatewayJson('/api/challenges/admin/coins/catalog', {
      method: 'POST',
      body: JSON.stringify({ key, category, title, description: description || null, coinCost, discountAmount }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to create catalog item' };
  }

  revalidatePath('/gamification/coins');
  return { ok: true, message: `Created "${title}"` };
}

export async function setCatalogItemActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = formData.get('id');
  const isActive = formData.get('isActive') === 'true';

  try {
    await gatewayJson(`/api/challenges/admin/coins/catalog/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ isActive }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to update catalog item' };
  }

  revalidatePath('/gamification/coins');
  return { ok: true, message: isActive ? 'Item re-activated' : 'Item deactivated' };
}
