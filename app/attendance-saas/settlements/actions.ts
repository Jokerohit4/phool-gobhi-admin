'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

// No automated bank transfer — this just marks the ledger settled once
// gobhi has actually made the manual transfer outside the app, same
// posture as the existing wallet payout flow (see /payouts).
export async function settleBankSettlementsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const partnerId = formData.get('partnerId');
  if (!partnerId) return { ok: false, message: 'Missing partner id' };

  try {
    await gatewayJson(`/api/wallet/bank-settlements/admin/${partnerId}/settle`, { method: 'POST' });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to record settlement' };
  }

  revalidatePath('/attendance-saas/settlements');
  return { ok: true, message: 'Marked settled' };
}
