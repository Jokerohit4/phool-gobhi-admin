'use server';

import { revalidatePath } from 'next/cache';

import { gatewayJson } from '@/lib/api';
import { requireSession } from '@/lib/auth';
// The shared state shape - its `ok` is optional (the initial state has
// neither field), so redeclaring it here with required fields makes the
// action incompatible with <ActionForm>.
import type { ActionState } from '@/components/ui/ActionForm';

/// DPDPA purpose limitation, made editable rather than hardcoded.
///
/// The period governs ONE thing: suggestion impressions and votes, which
/// exist to compute an aggregate action rate and stop being useful as
/// per-user rows once counted. It does not touch a user's own training
/// history — health-service refuses to conflate those buckets, and the
/// bounds below mirror its own validation so the portal cannot ask for
/// something the service will reject.
export async function updateRetentionPolicyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const raw = String(formData.get('suggestionFeedbackDays') || '').trim();
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 30 || days > 3650) {
    // Checked here as well as server-side so a typo comes back as a
    // sentence rather than a 400.
    return { ok: false, message: 'Enter a whole number of days between 30 and 3650' };
  }

  try {
    await gatewayJson('/api/health/admin/retention-policy', {
      method: 'PUT',
      body: JSON.stringify({ suggestionFeedbackDays: days }),
    });
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to save the retention period',
    };
  }

  revalidatePath('/health');
  return { ok: true, message: `Telemetry now expires after ${days} days` };
}
