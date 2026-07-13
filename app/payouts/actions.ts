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

  try {
    await gatewayJson(`/api/wallet/${userId}/payout`, {
      method: 'POST',
      body: JSON.stringify({
        // Empty amount means "pay out the full balance" (payoutWalletService defaults to it).
        amount: amountRaw ? Number(amountRaw) : undefined,
        description,
      }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to record payout' };
  }

  revalidatePath('/payouts');
  return { ok: true, message: amountRaw ? `Payout of ₹${amountRaw} recorded` : 'Full balance paid out' };
}
