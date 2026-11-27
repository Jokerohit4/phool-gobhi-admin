'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { gatewayJson } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { hasInvalidActionOrigin } from '@/lib/actionOrigin';
import { parseISTFormDate } from '@/lib/istFormDate';
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
  if (await hasInvalidActionOrigin()) return { ok: false, message: 'Cross-origin request rejected' };
  const userId = parsePositiveId(form.get('userId')), action = String(form.get('action') || '');
  if (userId === null) return { ok: false, message: 'Invalid customer' };
  try {
    if (action === 'FREE_SESSION' || action === 'ADDON_SESSION') {
      await gatewayJson(`/api/wallet/coaching/admin/fulfillment/${userId}/sessions`, { method: 'POST', body: JSON.stringify({ kind: action, idempotencyKey: KEY_RE.test(String(form.get('idempotencyKey') || '')) ? String(form.get('idempotencyKey')) : randomUUID() }) });
    } else if (action === 'GYM') {
      const status = oneOf(form.get('status'), GYM_STATUSES);
      if (!status) return { ok: false, message: 'Invalid pass status' };
      await gatewayJson(`/api/wallet/coaching/admin/fulfillment/${userId}/gym`, { method: 'PATCH', body: JSON.stringify({ status }) });
    } else if (action === 'FULFILLMENT_STATUS' || action === 'CARE_STATUS') {
      const id = parsePositiveId(form.get('requestId'));
      if (id === null) return { ok: false, message: 'Invalid request' };
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

export async function logSessionAction(_state: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  if (await hasInvalidActionOrigin()) return { ok: false, message: 'Cross-origin request rejected' };
  const userId = parsePositiveId(form.get('userId'));
  if (userId === null || userId > 2147483647) return { ok: false, message: 'Invalid customer ID' };
  const kind = oneOf(form.get('kind'), ['trainer', 'nutritionist'] as const);
  if (kind === null) return { ok: false, message: 'Choose trainer or nutritionist' };
  const mode = oneOf(form.get('mode'), ['online', 'in_person'] as const);
  if (mode === null) return { ok: false, message: 'Choose online or in person' };
  const idempotencyKey = form.get('idempotencyKey');
  if (typeof idempotencyKey !== 'string' || !/^[\w-]{8,100}$/.test(idempotencyKey)) {
    return { ok: false, message: 'Reload the form to get a valid session request identifier' };
  }
  const rawDuration = form.get('durationMinutes');
  const durationMinutes = parsePositiveId(rawDuration);
  if (rawDuration && (durationMinutes === null || durationMinutes > 2147483647)) {
    return { ok: false, message: 'Duration must be a positive whole number of minutes' };
  }
  const rawNote = form.get('note');
  if (rawNote !== null && (typeof rawNote !== 'string' || rawNote.length > 500 || rawNote.includes('\0'))) {
    return { ok: false, message: 'Note must be text of at most 500 characters' };
  }
  try {
    const heldAt = parseISTFormDate(String(form.get('heldAt') ?? ''), 'session date and time');
    if (Date.parse(heldAt) > Date.now()) return { ok: false, message: 'Enter a session time in the past' };
    await gatewayJson(`/api/wallet/coaching/admin/fulfillment/${userId}/session-log`, {
      method: 'POST',
      body: JSON.stringify({ kind, mode, heldAt, durationMinutes, note: rawNote?.trim() || null, idempotencyKey }),
    });
    revalidatePath('/fulfillment');
    return { ok: true, message: 'Session logged.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not log session' };
  }
}

export async function resolveSessionAction(_state: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  if (await hasInvalidActionOrigin()) return { ok: false, message: 'Cross-origin request rejected' };
  const id = parsePositiveId(form.get('sessionId'));
  if (id === null || id > 2147483647) return { ok: false, message: 'Invalid session ID' };
  const resolution = oneOf(form.get('resolution'), ['upheld', 'recredited'] as const);
  if (resolution === null) return { ok: false, message: 'Choose upheld or re-credited' };
  try {
    await gatewayJson(`/api/wallet/coaching/admin/sessions/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution }),
    });
    revalidatePath('/fulfillment');
    return { ok: true, message: resolution === 'upheld' ? 'Session upheld.' : 'Session re-credited.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not resolve dispute' };
  }
}

export async function reverseCheckinPayoutAction(_state: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  if (await hasInvalidActionOrigin()) return { ok: false, message: 'Cross-origin request rejected' };
  const id = parsePositiveId(form.get('bookingId'));
  if (id === null || id > 2147483647) return { ok: false, message: 'Invalid booking ID' };
  try {
    await gatewayJson(`/api/bookings/admin/bookings/${id}/reverse-checkin-payout`, { method: 'POST' });
    revalidatePath('/fulfillment');
    return { ok: true, message: `Check-in payout reversed for booking #${id}.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not reverse check-in payout' };
  }
}
