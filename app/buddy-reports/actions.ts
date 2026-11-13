'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import {
  reviewReport,
  releaseHold,
  reinstateUser,
  clearGenderChange,
  fetchReportContext,
  type BuddyMessage,
} from '@/lib/buddyApi';
import type { ActionState } from '@/components/ui/ActionForm';

const REPORTS_PATH = '/buddy-reports';

function numericField(formData: FormData, key: string): number | null {
  const value = Number(formData.get(key));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function resolutionNote(formData: FormData): string {
  return String(formData.get('resolutionNote') || '').trim();
}

// Every mutating action shares the same shape: authenticate, call the gateway,
// revalidate the queue, and turn any failure into a readable ActionState rather
// than a thrown error (the ActionForm renders `message` to the admin).
async function mutate(work: () => Promise<void>, successMessage: string): Promise<ActionState> {
  await requireSession();
  try {
    await work();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Something went wrong' };
  }
  revalidatePath(REPORTS_PATH);
  return { ok: true, message: successMessage };
}

export async function dismissReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = numericField(formData, 'id');
  if (id == null) return { ok: false, message: 'Missing report id' };
  return mutate(
    () => reviewReport(id, { status: 'dismissed', resolutionNote: resolutionNote(formData) }),
    'Report dismissed',
  );
}

export async function actionReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = numericField(formData, 'id');
  if (id == null) return { ok: false, message: 'Missing report id' };
  return mutate(
    () => reviewReport(id, { status: 'actioned', resolutionNote: resolutionNote(formData) }),
    'Report marked actioned',
  );
}

export async function suspendReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = numericField(formData, 'id');
  if (id == null) return { ok: false, message: 'Missing report id' };
  return mutate(
    () => reviewReport(id, { status: 'actioned', suspend: true, resolutionNote: resolutionNote(formData) }),
    'Report actioned and user suspended',
  );
}

export async function releaseHoldAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = numericField(formData, 'userId');
  if (userId == null) return { ok: false, message: 'Missing user id' };
  return mutate(() => releaseHold(userId), 'Hold released');
}

export async function reinstateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = numericField(formData, 'userId');
  if (userId == null) return { ok: false, message: 'Missing user id' };
  return mutate(() => reinstateUser(userId), 'User reinstated');
}

export async function clearGenderChangeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = numericField(formData, 'userId');
  if (userId == null) return { ok: false, message: 'Missing user id' };
  return mutate(() => clearGenderChange(userId), 'Gender change cleared');
}

// Loaded lazily when a report row is expanded. Returns data rather than an
// ActionState because the caller renders the result directly.
export async function loadReportContextAction(reportId: number): Promise<BuddyMessage[]> {
  await requireSession();
  return fetchReportContext(reportId);
}
