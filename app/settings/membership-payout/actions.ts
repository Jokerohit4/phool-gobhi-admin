'use server';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { hasInvalidActionOrigin } from '@/lib/actionOrigin';
import { gatewayJson } from '@/lib/api';
import { configErrorState, expectedUpdatedAtFrom } from '@/lib/configConcurrency';
import { pricePaise } from '@/lib/rupees';
import { parsePositiveId } from '@/lib/ids';
import type { ActionState } from '@/components/ui/ActionForm';
import { GYM_PAYOUT_PATH, MEMBERSHIP_PAYOUT_PAGE, MEMBERSHIP_PAYOUT_PATH } from './config';

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

export async function saveGymPayoutAction(_state: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  if (await hasInvalidActionOrigin()) return { ok: false, message: 'Cross-origin request rejected' };
  const gymId = parsePositiveId(form.get('gymId'));
  if (gymId === null) return { ok: false, message: 'Invalid gym id' };
  try {
    const payoutPaise = pricePaise(String(form.get('payoutRupees') ?? ''), false, 2147483647);
    await gatewayJson(`${GYM_PAYOUT_PATH}/${gymId}`, {
      method: 'PUT',
      body: JSON.stringify({ payoutPaise, expectedUpdatedAt: expectedUpdatedAtFrom(form) }),
    });
    revalidatePath(MEMBERSHIP_PAYOUT_PAGE);
    return { ok: true, message: `Payout for gym ${gymId} saved.` };
  } catch (error) {
    return configErrorState(error, 'Could not save the gym payout');
  }
}

export async function removeGymPayoutAction(_state: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  if (await hasInvalidActionOrigin()) return { ok: false, message: 'Cross-origin request rejected' };
  const gymId = parsePositiveId(form.get('gymId'));
  if (gymId === null) return { ok: false, message: 'Invalid gym id' };
  try {
    await gatewayJson(`${GYM_PAYOUT_PATH}/${gymId}`, {
      method: 'DELETE',
      body: JSON.stringify({ expectedUpdatedAt: expectedUpdatedAtFrom(form) }),
    });
    revalidatePath(MEMBERSHIP_PAYOUT_PAGE);
    return { ok: true, message: `Payout override for gym ${gymId} removed.` };
  } catch (error) {
    return configErrorState(error, 'Could not remove the gym payout');
  }
}
