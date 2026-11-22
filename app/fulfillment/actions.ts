'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { gatewayJson } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { parsePositiveId } from '@/lib/ids';
import type { ActionState } from '@/components/ui/ActionForm';

const GYM_STATUSES = ['NOT_ISSUED', 'AWAITING_ASSIGNMENT', 'ASSIGNED', 'ACTIVE', 'CANCELLED'] as const;
const FULFILLMENT_STATUSES = ['CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;
const CARE_STATUSES = ['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;
const CLINICAL_STATUSES = ['CLEARED', 'FOLLOW_UP_REQUIRED', 'NOT_CLEARED'] as const;
const MAX_NOTE = 2000;
const MAX_NAME = 120;
const MAX_ACTIONS = 20;
const MAX_ACTION_LENGTH = 300;
const KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;

function oneOf<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export async function fulfillmentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const userId = Number(form.get('userId')), action = String(form.get('action') || '');
  if (!Number.isInteger(userId) || userId < 1) return { ok: false, message: 'Invalid customer' };
  try {
    if (action === 'FREE_SESSION' || action === 'ADDON_SESSION') {
      await gatewayJson(`/api/wallet/coaching/admin/fulfillment/${userId}/sessions`, { method: 'POST', body: JSON.stringify({ kind: action, idempotencyKey: KEY_RE.test(String(form.get('idempotencyKey') || '')) ? String(form.get('idempotencyKey')) : randomUUID() }) });
    } else if (action === 'GYM') {
      const status = oneOf(form.get('status'), GYM_STATUSES);
      if (!status) return { ok: false, message: 'Invalid pass status' };
      await gatewayJson(`/api/wallet/coaching/admin/fulfillment/${userId}/gym`, { method: 'PATCH', body: JSON.stringify({ status }) });
    } else if (action === 'FULFILLMENT_STATUS' || action === 'CARE_STATUS') {
      const id = Number(form.get('requestId'));
      if (!Number.isInteger(id) || id < 1) return { ok: false, message: 'Invalid request' };
      const status = oneOf(form.get('status'), action === 'CARE_STATUS' ? CARE_STATUSES : FULFILLMENT_STATUSES);
      if (!status) return { ok: false, message: 'Invalid status' };
      await gatewayJson(action === 'CARE_STATUS' ? `/api/health/guidance/admin/requests/${id}` : `/api/wallet/coaching/admin/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    } else if (action === 'REVIEW') {
      const sourceReportId = parsePositiveId(form.get('sourceReportId'));
      if (sourceReportId === null) return { ok: false, message: 'Invalid source report' };
      const clinicalStatus = oneOf(form.get('clinicalStatus'), CLINICAL_STATUSES);
      if (!clinicalStatus) return { ok: false, message: 'Choose a review outcome' };
      const clinicianName = String(form.get('clinicianName') || '').trim();
      const clinicianRegistration = String(form.get('clinicianRegistration') || '').trim();
      const clinicalNote = String(form.get('clinicalNote') || '').trim();
      const agreedActions = String(form.get('agreedActions') || '').split('\n').map(x => x.trim()).filter(Boolean);
      if (clinicianName.length > MAX_NAME || clinicianRegistration.length > MAX_NAME) return { ok: false, message: `Clinician name and registration must be ${MAX_NAME} characters or fewer` };
      if (clinicalNote.length > MAX_NOTE) return { ok: false, message: `Clinical note must be ${MAX_NOTE} characters or fewer` };
      if (agreedActions.length > MAX_ACTIONS || agreedActions.some(a => a.length > MAX_ACTION_LENGTH)) return { ok: false, message: `Up to ${MAX_ACTIONS} agreed actions, each ${MAX_ACTION_LENGTH} characters or fewer` };
      await gatewayJson(`/api/health/guidance/admin/${userId}/review`, { method: 'POST', body: JSON.stringify({ sourceReportId, confirmedAt: String(form.get('confirmedAt') || ''), clinicianName, clinicianRegistration, clinicalNote, clinicalStatus, agreedActions, attestReviewed: form.get('attestReviewed') === 'on' }) });
    } else return { ok: false, message: 'Unknown action' };
    revalidatePath('/fulfillment');
    return { ok: true, message: 'Saved' };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not save this action' }; }
}
