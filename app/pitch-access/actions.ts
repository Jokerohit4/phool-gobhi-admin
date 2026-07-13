'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

export async function addPitchAccessAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const type = String(formData.get('type') || '');
  const value = String(formData.get('value') || '').trim();
  const note = String(formData.get('note') || '').trim() || undefined;

  if (!type || !value) return { ok: false, message: 'Type and value are required' };

  try {
    await gatewayJson('/api/auth/admin/pitch-access', {
      method: 'POST',
      body: JSON.stringify({ type, value, note }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to add contact' };
  }

  revalidatePath('/pitch-access');
  return { ok: true, message: `Added ${value}` };
}

export async function removePitchAccessAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = formData.get('id');

  try {
    await gatewayJson(`/api/auth/admin/pitch-access/${id}`, { method: 'DELETE' });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to remove contact' };
  }

  revalidatePath('/pitch-access');
  return { ok: true, message: 'Contact removed' };
}
