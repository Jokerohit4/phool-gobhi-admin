'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { GatewayError, gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';
import { isCohort, parseUserIds } from './cohorts';

export async function deleteUserDataAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = String(formData.get('id') ?? '');
  const scope = String(formData.get('scope') ?? '');
  if (!/^\d{1,10}$/.test(id) || Number(id) < 1 || Number(id) > 2147483647 || !/^[a-z]+$/.test(scope)) {
    return { ok: false, message: 'Select a user and data category' };
  }
  try {
    const { message } = await gatewayJson<{ message: string }>(
      `/api/auth/admin/users/${id}/data/${scope}`,
      { method: 'DELETE' },
    );
    revalidatePath('/users');
    return { ok: true, message };
  } catch (err) {
    const message = err instanceof GatewayError && err.status < 500
      ? err.message
      : 'Deletion could not be confirmed. Some data may already be gone. Refresh the list and retry if the account is still present.';
    return { ok: false, message };
  }
}

export async function setUserCohortAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = Number(formData.get('id'));
  const accountCohort = String(formData.get('accountCohort') || '');
  if (!Number.isInteger(id) || id <= 0 || !isCohort(accountCohort)) {
    return { ok: false, message: 'Invalid user or cohort' };
  }
  try {
    await gatewayJson(`/api/auth/admin/users/${id}/cohort`, {
      method: 'PATCH',
      body: JSON.stringify({ accountCohort }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to update cohort' };
  }
  revalidatePath('/users');
  return { ok: true, message: 'Saved' };
}

export async function bulkSetCohortAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const accountCohort = String(formData.get('accountCohort') || '');
  const userIds = parseUserIds(String(formData.get('userIds') || ''));
  if (!isCohort(accountCohort)) return { ok: false, message: 'Pick a cohort' };
  if (!userIds) return { ok: false, message: 'Enter user ids separated by commas, spaces or new lines' };
  if (userIds.length > 500) return { ok: false, message: 'At most 500 users at a time' };
  try {
    const { data } = await gatewayJson<{ data: { updated: number; notFound: number[] } }>(
      '/api/auth/admin/users/cohort/bulk',
      { method: 'PATCH', body: JSON.stringify({ userIds, accountCohort }) },
    );
    revalidatePath('/users');
    const missing = data.notFound.length ? ` Not found: ${data.notFound.join(', ')}.` : '';
    return { ok: true, message: `Updated ${data.updated} user(s).${missing}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Bulk update failed' };
  }
}
