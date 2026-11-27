'use server';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { hasInvalidActionOrigin } from '@/lib/actionOrigin';
import { gatewayJson } from '@/lib/api';
import { configErrorState, expectedUpdatedAtFrom } from '@/lib/configConcurrency';
import { parsePathSegment } from '@/lib/ids';
import type { ActionState } from '@/components/ui/ActionForm';
import { COUPONS_PATH, couponCode, couponFields } from './config';

export async function createCouponAction(_state: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  if (await hasInvalidActionOrigin()) return { ok: false, message: 'Cross-origin request rejected' };
  try {
    const code = couponCode(form.get('code'));
    await gatewayJson(COUPONS_PATH, {
      method: 'POST',
      body: JSON.stringify({ code, ...couponFields(form) }),
    });
    revalidatePath('/coupons');
    return { ok: true, message: `Created coupon ${code}.` };
  } catch (error) {
    return configErrorState(error, 'Could not create coupon');
  }
}

export async function updateCouponAction(_state: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  if (await hasInvalidActionOrigin()) return { ok: false, message: 'Cross-origin request rejected' };
  try {
    const code = parsePathSegment(couponCode(form.get('code')));
    if (code === null) throw new Error('Invalid coupon code');
    const operation = form.get('operation');
    if (operation !== 'edit' && operation !== 'enable' && operation !== 'disable') {
      throw new Error('Choose a coupon action');
    }
    const expectedUpdatedAt = expectedUpdatedAtFrom(form);
    const patch = operation === 'edit' ? couponFields(form) : { enabled: operation === 'enable' };
    await gatewayJson(`${COUPONS_PATH}/${code}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...patch, expectedUpdatedAt }),
    });
    revalidatePath('/coupons');
    const message = operation === 'edit' ? 'Coupon saved.' : operation === 'enable' ? 'Coupon enabled.' : 'Coupon disabled.';
    return { ok: true, message };
  } catch (error) {
    return configErrorState(error, 'Could not update coupon');
  }
}
