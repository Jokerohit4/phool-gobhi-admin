'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { gatewayJson } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import type { ActionState } from '@/components/ui/ActionForm';

export async function fulfillmentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const userId = Number(form.get('userId')), action = String(form.get('action') || '');
  if (!Number.isInteger(userId) || userId < 1) return { ok: false, message: 'Invalid customer' };
  try {
    if (action === 'FREE_SESSION' || action === 'ADDON_SESSION') {
      await gatewayJson(`/api/wallet/coaching/admin/fulfillment/${userId}/sessions`, { method: 'POST', body: JSON.stringify({ kind: action, idempotencyKey: String(form.get('idempotencyKey') || randomUUID()) }) });
    } else if (action === 'GYM') {
      await gatewayJson(`/api/wallet/coaching/admin/fulfillment/${userId}/gym`, { method: 'PATCH', body: JSON.stringify({ status: form.get('status') }) });
    } else if (action === 'FULFILLMENT_STATUS' || action === 'CARE_STATUS') {
      const id = Number(form.get('requestId'));
      if (!Number.isInteger(id) || id < 1) return { ok: false, message: 'Invalid request' };
      await gatewayJson(action === 'CARE_STATUS' ? `/api/health/guidance/admin/requests/${id}` : `/api/wallet/coaching/admin/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status: form.get('status') }) });
    } else if (action === 'REVIEW') {
      await gatewayJson(`/api/health/guidance/admin/${userId}/review`, { method: 'POST', body: JSON.stringify({ sourceReportId: Number(form.get('sourceReportId')), confirmedAt: String(form.get('confirmedAt') || ''), clinicianName: String(form.get('clinicianName') || '').trim(), clinicianRegistration: String(form.get('clinicianRegistration') || '').trim(), clinicalNote: String(form.get('clinicalNote') || '').trim(), clinicalStatus: form.get('clinicalStatus'), agreedActions: String(form.get('agreedActions') || '').split('\n').map(x => x.trim()).filter(Boolean), attestReviewed: form.get('attestReviewed') === 'on' }) });
    } else return { ok: false, message: 'Unknown action' };
    revalidatePath('/fulfillment');
    return { ok: true, message: 'Saved' };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not save this action' }; }
}
