'use server';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { hasInvalidActionOrigin } from '@/lib/actionOrigin';
import { gatewayJson } from '@/lib/api';
import { configErrorState, expectedUpdatedAtFrom } from '@/lib/configConcurrency';
import { pricePaise } from '@/lib/rupees';
import type { ActionState } from '@/components/ui/ActionForm';
import { MEMBERSHIP_PAYOUT_PAGE, MEMBERSHIP_PAYOUT_PATH } from './config';

export async function saveMembershipPayoutAction(_state: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  if (await hasInvalidActionOrigin()) return { ok: false, message: 'Cross-origin request rejected' };
  try {
    const payoutPaise = pricePaise(String(form.get('payoutRupees') ?? ''), false, 2147483647);
    await gatewayJson(MEMBERSHIP_PAYOUT_PATH, {
      method: 'PUT',
      body: JSON.stringify({ payoutPaise, expectedUpdatedAt: expectedUpdatedAtFrom(form) }),
    });
    revalidatePath(MEMBERSHIP_PAYOUT_PAGE);
    return { ok: true, message: 'Membership payout saved.' };
  } catch (error) {
    return configErrorState(error, 'Could not save the membership payout');
  }
}
