'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

export async function approveReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = formData.get('id');
  try {
    await gatewayJson(`/api/auth/admin/platform-reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isApproved: true }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to approve review' };
  }
  revalidatePath('/reviews');
  return { ok: true, message: 'Review approved' };
}

export async function unapproveReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = formData.get('id');
  try {
    await gatewayJson(`/api/auth/admin/platform-reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isApproved: false }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to unapprove review' };
  }
  revalidatePath('/reviews');
  return { ok: true, message: 'Review hidden' };
}

export async function deleteReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = formData.get('id');
  try {
    await gatewayJson(`/api/auth/admin/platform-reviews/${id}`, { method: 'DELETE' });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to remove review' };
  }
  revalidatePath('/reviews');
  return { ok: true, message: 'Review removed' };
}
