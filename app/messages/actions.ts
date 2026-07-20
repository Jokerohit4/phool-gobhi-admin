'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

export async function setMessageReadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = formData.get('id');
  const isRead = formData.get('isRead') === 'true';

  try {
    await gatewayJson(`/api/auth/admin/contact-messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to update message' };
  }

  revalidatePath('/messages');
  return { ok: true, message: isRead ? 'Marked as read' : 'Marked as unread' };
}
