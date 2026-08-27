'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

export async function createSpotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const challengeId = String(formData.get('challengeId') || '');
  const sequence = Number(formData.get('sequence') || 0);
  const label = String(formData.get('label') || '').trim();
  const lat = Number(formData.get('lat'));
  const lng = Number(formData.get('lng'));
  const radiusMeters = Number(formData.get('radiusMeters') || 75);
  const code = String(formData.get('code') || '').trim();

  if (!label || !code || Number.isNaN(lat) || Number.isNaN(lng)) {
    return { ok: false, message: 'Label, code, lat and lng are required' };
  }

  try {
    await gatewayJson(`/api/challenges/admin/challenges/${challengeId}/checkpoint-spots`, {
      method: 'POST',
      body: JSON.stringify({ sequence, label, lat, lng, radiusMeters, code }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to add checkpoint spot' };
  }

  revalidatePath(`/gamification/challenges/${challengeId}/spots`);
  return { ok: true, message: `Added "${label}"` };
}
