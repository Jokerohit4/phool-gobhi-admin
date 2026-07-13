'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

export async function approveGymAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const gymId = formData.get('gymId');
  try {
    await gatewayJson(`/api/gyms/${gymId}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ approved: true }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to approve gym' };
  }
  revalidatePath('/gyms');
  revalidatePath(`/gyms/${gymId}`);
  return { ok: true, message: 'Gym approved' };
}

export async function rejectGymAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const gymId = formData.get('gymId');
  const reason = String(formData.get('reason') || '').trim();
  if (!reason) return { ok: false, message: 'A reason is required to reject a gym' };
  try {
    await gatewayJson(`/api/gyms/${gymId}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ approved: false, reason }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to reject gym' };
  }
  revalidatePath('/gyms');
  revalidatePath(`/gyms/${gymId}`);
  return { ok: true, message: 'Gym rejected' };
}
