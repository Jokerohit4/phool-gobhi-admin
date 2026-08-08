'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

// Matches the fixed-row step builder in FunnelsView — one filter pair per
// step keeps the create form a static grid (no client-side add/remove list),
// consistent with every other form in this app. The backend still accepts
// richer multi-filter steps via the raw API; this form just doesn't expose it.
const MAX_STEPS = 6;

export async function createFunnelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  const name = String(formData.get('name') || '').trim();
  const steps: { event: string; filters: Record<string, string> }[] = [];
  for (let i = 1; i <= MAX_STEPS; i++) {
    const event = String(formData.get(`step${i}_event`) || '').trim();
    if (!event) continue;
    const filterKey = String(formData.get(`step${i}_filterKey`) || '').trim();
    const filterValue = String(formData.get(`step${i}_filterValue`) || '').trim();
    const filters = filterKey && filterValue ? { [filterKey]: filterValue } : {};
    steps.push({ event, filters });
  }

  if (!name) return { ok: false, message: 'Name is required' };
  if (steps.length < 2) return { ok: false, message: 'A funnel needs at least 2 steps (fill in the Event column for each)' };

  try {
    await gatewayJson('/api/bookings/admin/analytics/funnels', {
      method: 'POST',
      body: JSON.stringify({ name, steps }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to create funnel' };
  }

  revalidatePath('/analytics');
  return { ok: true, message: `Created "${name}"` };
}

export async function deleteFunnelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = formData.get('id');

  try {
    await gatewayJson(`/api/bookings/admin/analytics/funnels/${id}`, { method: 'DELETE' });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to delete funnel' };
  }

  revalidatePath('/analytics');
  return { ok: true, message: 'Funnel deleted' };
}

// Read-only Server Functions (not tied to a <form>) — called directly from
// the client-side filter builders below to drive the event -> property ->
// value autocomplete cascade. Never throw: a failed suggestion lookup should
// degrade to "no suggestions," not break the field the admin is typing in.

export async function getKnownEventsAction(): Promise<{ event: string; n: number }[]> {
  await requireSession();
  try {
    const { data } = await gatewayJson<{ data: { events: { event: string; n: number }[] } }>(
      '/api/bookings/admin/analytics/known-events?limit=100',
    );
    return data.events;
  } catch {
    return [];
  }
}

export async function getKnownPropertyKeysAction(event: string): Promise<string[]> {
  await requireSession();
  if (!event.trim()) return [];
  try {
    const { data } = await gatewayJson<{ data: { keys: string[] } }>(
      `/api/bookings/admin/analytics/known-properties?event=${encodeURIComponent(event)}`,
    );
    return data.keys;
  } catch {
    return [];
  }
}

export async function getKnownPropertyValuesAction(event: string, key: string): Promise<{ value: string; n: number }[]> {
  await requireSession();
  if (!event.trim() || !key.trim()) return [];
  try {
    const { data } = await gatewayJson<{ data: { values: { value: string; n: number }[] } }>(
      `/api/bookings/admin/analytics/known-values?event=${encodeURIComponent(event)}&key=${encodeURIComponent(key)}&limit=20`,
    );
    return data.values;
  } catch {
    return [];
  }
}
