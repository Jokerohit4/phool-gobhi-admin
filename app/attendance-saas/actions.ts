'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

// Charges the attendance-SaaS monthly bill for a (gym, month) —
// users-joined-that-month x flat fee, debit from the partner wallet. The
// backend computes + applies idempotently (negative partner balance allowed),
// so a double-submit can never charge the same month twice.
export async function applyAttendanceSaasBillAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const gymId = formData.get('gymId');
  const month = formData.get('month');
  if (!gymId || !month) return { ok: false, message: 'Missing gym or month' };

  try {
    await gatewayJson(`/api/wallet/attendance-saas/bill/${gymId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ month }),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to apply bill' };
  }

  revalidatePath('/attendance-saas');
  return { ok: true, message: 'Bill charged to partner wallet' };
}