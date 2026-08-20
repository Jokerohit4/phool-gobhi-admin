'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

export async function approveGymAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const gymId = formData.get('gymId');
  try {
    await gatewayJson(`/api/gyms/${gymId}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ approved: true }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to approve gym' };
  }
  revalidatePath('/gyms');
  revalidatePath(`/gyms/${gymId}`);
  return { ok: true, message: 'Gym approved' };
}

export async function rejectGymAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const gymId = formData.get('gymId');
  const reason = String(formData.get('reason') || '').trim();
  if (!reason) return { ok: false, message: 'A reason is required to reject a gym' };
  try {
    await gatewayJson(`/api/gyms/${gymId}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ approved: false, reason }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to reject gym' };
  }
  revalidatePath('/gyms');
  revalidatePath(`/gyms/${gymId}`);
  return { ok: true, message: 'Gym rejected' };
}

export async function updateGymCommissionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const gymId = formData.get('gymId');
  const commissionPct = Number(formData.get('commissionPct'));
  if (Number.isNaN(commissionPct) || commissionPct < 0 || commissionPct > 100) {
    return { ok: false, message: 'Commission must be a number between 0 and 100' };
  }
  try {
    await gatewayJson(`/api/gyms/${gymId}/commission`, {
      method: 'PUT',
      body: JSON.stringify({ commissionPct }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to update commission' };
  }
  revalidatePath(`/gyms/${gymId}`);
  return { ok: true, message: 'Commission updated' };
}

// Attendance-SaaS wedge: overrides the post-honeymoon commission wallet-
// service applies to this gym's subscription (GymSubscription) purchases —
// separate from commissionPct above, which only governs one-off bookings.
// Blank input resets to the platform default (currently 1%) rather than
// pinning a fixed number.
export async function updateGymSubscriptionCommissionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession();
  const gymId = formData.get('gymId');
  const raw = String(formData.get('subscriptionCommissionPct') ?? '').trim();
  let subscriptionCommissionPct: number | null;
  if (raw === '') {
    subscriptionCommissionPct = null;
  } else {
    subscriptionCommissionPct = Number(raw);
    if (Number.isNaN(subscriptionCommissionPct) || subscriptionCommissionPct < 0 || subscriptionCommissionPct > 100) {
      return { ok: false, message: 'Subscription commission must be a number between 0 and 100, or blank for the default' };
    }
  }
  try {
    await gatewayJson(`/api/gyms/${gymId}/subscription-commission`, {
      method: 'PUT',
      body: JSON.stringify({ subscriptionCommissionPct }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to update subscription commission' };
  }
  revalidatePath(`/gyms/${gymId}`);
  return { ok: true, message: 'Subscription commission updated' };
}

// Picks which formula wallet-service applies to this gym's post-honeymoon
// attendance-SaaS commission: a percentage of the plan price
// (subscriptionCommissionPct, above), or a flat fee per registration
// regardless of price. subscriptionFlatFeePerUser is only meaningful when
// mode is 'flatPerUser'; blank there resets to the platform default.
export async function updateGymSubscriptionPricingModeAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession();
  const gymId = formData.get('gymId');
  const subscriptionPricingMode = String(formData.get('subscriptionPricingMode') ?? '');
  if (subscriptionPricingMode !== 'percentage' && subscriptionPricingMode !== 'flatPerUser') {
    return { ok: false, message: 'Pricing mode must be "percentage" or "flatPerUser"' };
  }
  const rawFee = String(formData.get('subscriptionFlatFeePerUser') ?? '').trim();
  let subscriptionFlatFeePerUser: number | null;
  if (rawFee === '') {
    subscriptionFlatFeePerUser = null;
  } else {
    subscriptionFlatFeePerUser = Number(rawFee);
    if (Number.isNaN(subscriptionFlatFeePerUser) || subscriptionFlatFeePerUser < 0) {
      return { ok: false, message: 'Flat fee per user must be a non-negative number, or blank for the default' };
    }
  }
  try {
    await gatewayJson(`/api/gyms/${gymId}/subscription-pricing-mode`, {
      method: 'PUT',
      body: JSON.stringify({ subscriptionPricingMode, subscriptionFlatFeePerUser }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to update subscription pricing mode' };
  }
  revalidatePath(`/gyms/${gymId}`);
  return { ok: true, message: 'Subscription pricing mode updated' };
}

// Soft delete/restore — reversible, so this is the safe default when a
// gym needs to come down (spam listing, partner request, policy issue).
export async function setGymActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const gymId = formData.get('gymId');
  const isActive = formData.get('isActive') === 'true';
  try {
    await gatewayJson(`/api/gyms/admin/${gymId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isActive }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to update gym status' };
  }
  revalidatePath('/gyms');
  revalidatePath(`/gyms/${gymId}`);
  return { ok: true, message: isActive ? 'Gym reactivated' : 'Gym deactivated' };
}

// Hard delete — permanent. The backend itself refuses this (409) if the
// gym has any booking history, so this can only succeed for gyms that
// never had real activity.
export async function deleteGymAdminAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const gymId = formData.get('gymId');
  try {
    await gatewayJson(`/api/gyms/admin/${gymId}`, { method: 'DELETE' });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to delete gym' };
  }
  revalidatePath('/gyms');
  redirect('/gyms');
}

export async function deleteReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const gymId = formData.get('gymId');
  const reviewId = formData.get('reviewId');
  try {
    await gatewayJson(`/api/gyms/${gymId}/reviews/${reviewId}`, { method: 'DELETE' });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to remove review' };
  }
  revalidatePath(`/gyms/${gymId}`);
  return { ok: true, message: 'Review removed' };
}
