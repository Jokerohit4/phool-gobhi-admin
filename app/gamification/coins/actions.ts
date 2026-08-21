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
      body: JSON.stringify({ coinsPerCheckin, weeklyTargetBonus, milestones, pairedStreakWeeklyBonus }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to save coin economy config' };
  }

  revalidatePath('/gamification/coins');
  return { ok: true, message: 'Coin economy config updated' };
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
