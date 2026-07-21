'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

export async function createJobOpeningAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const title = String(formData.get('title') || '').trim();
  const department = String(formData.get('department') || '').trim();
  const location = String(formData.get('location') || '').trim();
  const employmentType = String(formData.get('employmentType') || '');
  const description = String(formData.get('description') || '').trim();

  if (!title || !department || !location || !employmentType || !description) {
    return { ok: false, message: 'All fields are required' };
  }

  try {
    await gatewayJson('/api/auth/admin/jobs', {
      method: 'POST',
      body: JSON.stringify({ title, department, location, employmentType, description }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to create job opening' };
  }

  revalidatePath('/jobs');
  return { ok: true, message: `Posted ${title}` };
}

export async function setJobOpeningActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = formData.get('id');
  const isActive = formData.get('isActive') === 'true';

  try {
    await gatewayJson(`/api/auth/admin/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to update job opening' };
  }

  revalidatePath('/jobs');
  return { ok: true, message: isActive ? 'Reopened on the careers page' : 'Closed — hidden from the careers page' };
}

export async function deleteJobOpeningAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = formData.get('id');

  try {
    await gatewayJson(`/api/auth/admin/jobs/${id}`, { method: 'DELETE' });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to delete job opening' };
  }

  revalidatePath('/jobs');
  return { ok: true, message: 'Job opening deleted' };
}
