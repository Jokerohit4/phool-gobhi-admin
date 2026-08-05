'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

export async function recordPayoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const userId = formData.get('userId');
  const amountRaw = String(formData.get('amount') || '').trim();
  const description = String(formData.get('description') || '').trim() || undefined;

  // A non-numeric amount becomes NaN, which silently passes the backend's
  // own `<=0`/`<balance` guards (both are false for NaN) — reject it here
  // with a real error message instead of forwarding it.
  let amount: number | undefined;
  if (amountRaw) {
    amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, message: 'Amount must be a positive number' };
    }
  }

  try {
    await gatewayJson(`/api/wallet/${userId}/payout`, {
      method: 'POST',
      body: JSON.stringify({
        // Empty amount means "pay out the full balance" (payoutWalletService defaults to it).
        amount,
        description,
      }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to record payout' };
  }

  revalidatePath('/payouts');
  return { ok: true, message: amountRaw ? `Payout of ₹${amountRaw} recorded` : 'Full balance paid out' };
}
