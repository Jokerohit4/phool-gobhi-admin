'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { parsePositiveId } from '@/lib/ids';
import type { ActionState } from '@/components/ui/ActionForm';

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;
const MAX_PAYOUT_AMOUNT = 10_000_000;
const MAX_DESCRIPTION = 500;

export async function recordPayoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const userId = parsePositiveId(formData.get('userId'));
  if (userId === null) return { ok: false, message: 'Invalid partner' };
  // Stable per form render (set by the page when the form is rendered), so a
  // double-click or retried submit of the same form cannot pay out twice.
  const idempotencyKey = String(formData.get('idempotencyKey') || '').trim();
  if (!IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
    return { ok: false, message: 'This form is out of date. Refresh the page and try again.' };
  }
  const amountRaw = String(formData.get('amount') || '').trim();
  const description = String(formData.get('description') || '').trim() || undefined;

  // A non-numeric amount becomes NaN, which silently passes the backend's
  // own `<=0`/`<balance` guards (both are false for NaN) — reject it here
  // with a real error message instead of forwarding it.
  let amount: number | undefined;
  if (amountRaw) {
    amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_PAYOUT_AMOUNT) {
      return { ok: false, message: 'Amount must be a positive number' };
    }
    // Rupees with at most 2 decimal places.
    if (Math.round(amount * 100) / 100 !== amount) {
      return { ok: false, message: 'Amount can have at most 2 decimal places' };
    }
  }
  if (description && description.length > MAX_DESCRIPTION) {
    return { ok: false, message: `Note must be ${MAX_DESCRIPTION} characters or fewer` };
  }

  try {
    await gatewayJson(`/api/wallet/${userId}/payout`, {
      method: 'POST',
      body: JSON.stringify({
        // Empty amount means "pay out the full balance" (payoutWalletService defaults to it).
        amount,
        description,
        idempotencyKey,
      }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to record payout' };
  }

  revalidatePath('/payouts');
  return { ok: true, message: amountRaw ? `Payout of ₹${amountRaw} recorded` : 'Full balance paid out' };
}
