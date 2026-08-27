'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

export async function createDefinitionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const key = String(formData.get('key') || '').trim();
  const type = String(formData.get('type') || '').trim();
  const category = String(formData.get('category') || '').trim();
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const defaultVerificationMethod = String(formData.get('defaultVerificationMethod') || '').trim();
  const requiresGeofenceWithQr = formData.get('requiresGeofenceWithQr') === 'on';

  if (!key || !type || !category || !title || !defaultVerificationMethod) {
    return { ok: false, message: 'Key, type, category, title and verification method are required' };
  }

  try {
    await gatewayJson('/api/challenges/admin/challenges/definitions', {
      method: 'POST',
      body: JSON.stringify({ key, type, category, title, description: description || null, defaultVerificationMethod, requiresGeofenceWithQr }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to create challenge definition' };
  }

  revalidatePath('/gamification/challenges');
  return { ok: true, message: `Created definition "${title}"` };
}

export async function createChallengeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const challengeDefinitionId = Number(formData.get('challengeDefinitionId'));
  const city = String(formData.get('city') || '').trim();
  const targetCount = Number(formData.get('targetCount'));
  const rewardCoins = Number(formData.get('rewardCoins'));

  if (!challengeDefinitionId || !city || !Number.isInteger(targetCount) || targetCount <= 0) {
    return { ok: false, message: 'Definition, city and a positive targetCount are required' };
  }

  try {
    await gatewayJson('/api/challenges/admin/challenges', {
      method: 'POST',
      body: JSON.stringify({ challengeDefinitionId, city, targetCount, rewardCoins }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to create challenge' };
  }

  revalidatePath('/gamification/challenges');
  return { ok: true, message: `Created challenge in ${city}` };
}

export async function setChallengeStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = formData.get('id');
  const status = String(formData.get('status') || '');

  try {
    await gatewayJson(`/api/challenges/admin/challenges/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to update challenge status' };
  }

  revalidatePath('/gamification/challenges');
  return { ok: true, message: `Status set to ${status}` };
}

export async function createSponsorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const type = String(formData.get('type') || '').trim();
  const name = String(formData.get('name') || '').trim();
  const contactInfo = String(formData.get('contactInfo') || '').trim();

  if (!type || !name) {
    return { ok: false, message: 'Type and name are required' };
  }

  try {
    await gatewayJson('/api/challenges/admin/sponsors', {
      method: 'POST',
      body: JSON.stringify({ type, name, contactInfo: contactInfo || null }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to create sponsor' };
  }

  revalidatePath('/gamification/challenges');
  return { ok: true, message: `Added sponsor "${name}"` };
}
