'use server';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';
import { booleanFields, numberFields, textFields, pricePaise, type ConfigResponse, type PlanConfig } from './config';

export async function savePlansAction(_state: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const region = form.get('region');
  if (region !== 'GURUGRAM' && region !== 'REST_INDIA') return { ok: false, message: 'Choose a supported region' };
  try {
    const expectedVersion = Number(form.get('version'));
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error('Reload the plan editor');
    const current = (await gatewayJson<{ data: ConfigResponse }>('/api/wallet/coaching/admin/config')).data;
    if (current.version !== expectedVersion) throw new Error('Another admin changed the plans. Reload before saving.');
    const integer = (name: string) => {
      const raw = String(form.get(name) || '');
      if (!/^\d+$/.test(raw)) throw new Error(`Enter a whole number for ${name.split('.').at(-1)}`);
      return Number(raw);
    };
    const previous = current.config.regions[region];
    const plans = previous.plans.map(old => {
      const plan: PlanConfig = { ...old, amountPaise: pricePaise(String(form.get(`${old.product}.price`) || ''), true) };
      for (const field of textFields) if (form.has(`${old.product}.${field}`)) plan[field] = String(form.get(`${old.product}.${field}`) || '').trim();
      for (const field of numberFields) plan[field] = integer(`${old.product}.${field}`);
      for (const field of booleanFields) plan[field] = form.get(`${old.product}.${field}`) === 'on';
      return plan;
    });
    const addon = {
      ...previous.addon, enabled: form.get('addon.enabled') === 'on',
      title: String(form.get('addon.title') || '').trim(), description: String(form.get('addon.description') || '').trim(),
      amountPaise: pricePaise(String(form.get('addon.price') || ''), false)!, sessions: integer('addon.sessions'), validityDays: integer('addon.validityDays'),
    };
    const config = { ...current.config, regions: { ...current.config.regions, [region]: { label: String(form.get('label') || '').trim(), plans, addon } } };
    const result = await gatewayJson<{ data: ConfigResponse }>('/api/wallet/coaching/admin/config', { method: 'PUT', body: JSON.stringify({ expectedVersion, config }) });
    revalidatePath('/coaching-plans'); revalidatePath('/fulfillment');
    return { ok: true, message: `Published version ${result.data.version}. New purchases use these terms; existing memberships keep their purchased offer.` };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not save plans' }; }
}
