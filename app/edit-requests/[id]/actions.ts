'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

export async function approveEditRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const requestId = formData.get('requestId');
  try {
    await gatewayJson(`/api/gyms/edit-requests/${requestId}/approve`, { method: 'PUT' });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to approve change' };
  }
  revalidatePath('/edit-requests');
  revalidatePath(`/edit-requests/${requestId}`);
  return { ok: true, message: 'Change approved and applied' };
}

export async function rejectEditRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const requestId = formData.get('requestId');
  const reason = String(formData.get('reason') || '').trim();
  if (!reason) return { ok: false, message: 'A reason is required to reject a change' };
  try {
    await gatewayJson(`/api/gyms/edit-requests/${requestId}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to reject change' };
  }
  revalidatePath('/edit-requests');
  revalidatePath(`/edit-requests/${requestId}`);
  return { ok: true, message: 'Change rejected' };
}
