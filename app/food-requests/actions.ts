'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) || '').trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function listLines(formData: FormData, key: string): string[] {
  return String(formData.get(key) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function setFoodRequestStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const id = formData.get('id');
  const status = String(formData.get('status') || '');
  const note = String(formData.get('reviewNote') || '').trim();

  if (!['resolved', 'declined'].includes(status)) {
    return { ok: false, message: 'Pick a review outcome' };
  }

  try {
    await gatewayJson(`/api/health/admin/food-requests/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ status, reviewNote: note }),
    });
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to update request',
    };
  }

  revalidatePath('/food-requests');
  return {
    ok: true,
    message: status === 'resolved' ? 'Marked resolved' : 'Declined the request',
  };
}

export interface CreateFoodResult {
  food: { id: number; name: string; source: string };
  created: boolean;
  resolvedRequests: number;
}

export async function createFoodItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const name = String(formData.get('name') || '').trim();
  if (!name) return { ok: false, message: 'Name the food' };

  const body = {
    name,
    aliases: listLines(formData, 'aliases'),
    basis: String(formData.get('basis') || 'cooked'),
    kcal: num(formData, 'kcal'),
    proteinG: num(formData, 'proteinG'),
    carbsG: num(formData, 'carbsG'),
    fatG: num(formData, 'fatG'),
    fibreG: num(formData, 'fibreG'),
    ironMg: num(formData, 'ironMg'),
    magnesiumMg: num(formData, 'magnesiumMg'),
    calciumMg: num(formData, 'calciumMg'),
    zincMg: num(formData, 'zincMg'),
    nonVeg: formData.get('nonVeg') === 'on',
    source: String(formData.get('source') || 'estimate'),
    verified: formData.get('verified') === 'on',
    verifiedBy: String(formData.get('verifiedBy') || '').trim() || 'gobhi',
    reviewNote: String(formData.get('reviewNote') || '').trim(),
  };

  let result: CreateFoodResult;
  try {
    result = await gatewayJson<CreateFoodResult>('/api/health/admin/food-items', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to add the food',
    };
  }

  revalidatePath('/food-requests');
  return {
    ok: true,
    message:
      result.resolvedRequests > 0
        ? `Added ${name} — closed ${result.resolvedRequests} pending request${result.resolvedRequests === 1 ? '' : 's'} for it`
        : `Added ${name} to the catalogue`,
  };
}