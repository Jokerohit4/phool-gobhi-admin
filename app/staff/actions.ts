'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

export async function inviteStaffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const gobhiType = String(formData.get('gobhiType') || '');

  if (!name || !email || !password || !gobhiType) {
    return { ok: false, message: 'All fields are required' };
  }

  try {
    await gatewayJson('/api/auth/admin/staff', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, gobhiType }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to invite staff account' };
  }

  revalidatePath('/staff');
  return { ok: true, message: `Invited ${name} (${email})` };
}

export async function setStaffStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = formData.get('id');
  const isActive = formData.get('isActive') === 'true';

  try {
    await gatewayJson(`/api/auth/admin/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to update staff status' };
  }

  revalidatePath('/staff');
  return { ok: true, message: isActive ? 'Access restored' : 'Access revoked' };
}
