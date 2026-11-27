'use server';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { hasInvalidActionOrigin } from '@/lib/actionOrigin';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';
import { booleanFields, numberFields, textFields, pricePaise, boundedInteger, boundedText, CATALOG_PATH, type CatalogConfig, type ConfigResponse, type PlanConfig } from './config';
import { editV2Catalog } from './v2Config';

function editLegacyCatalog(current: CatalogConfig, form: FormData): CatalogConfig {
  const region = form.get('region');
  if (region !== 'GURUGRAM' && region !== 'REST_INDIA') throw new Error('Choose a supported region');
  const integer = (name: string) => boundedInteger(String(form.get(name) || ''), name);
  const text = (name: string) => boundedText(String(form.get(name) || ''), name);
  const previous = current.regions[region];
  const plans = previous.plans.map(old => {
    const plan: PlanConfig = { ...old, amountPaise: pricePaise(String(form.get(`${old.product}.price`) || ''), true) };
    for (const field of textFields) if (form.has(`${old.product}.${field}`)) plan[field] = text(`${old.product}.${field}`);
    for (const field of numberFields) plan[field] = integer(`${old.product}.${field}`);
    for (const field of booleanFields) plan[field] = form.get(`${old.product}.${field}`) === 'on';
    return plan;
  });
  const addon = {
    ...previous.addon, enabled: form.get('addon.enabled') === 'on',
    title: text('addon.title'), description: text('addon.description'),
    amountPaise: pricePaise(String(form.get('addon.price') || ''), false), sessions: integer('addon.sessions'), validityDays: integer('addon.validityDays'),
  };
  return { ...current, regions: { ...current.regions, [region]: { label: text('label'), plans, addon } } };
}

const conflictMessage = 'Another admin changed the plans. Reload before saving.';

export async function savePlansAction(_state: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  if (await hasInvalidActionOrigin()) return { ok: false, message: 'Cross-origin request rejected' };
  try {
    const rawVersion = form.get('version');
    const expectedVersion = Number(rawVersion);
    if (typeof rawVersion !== 'string' || !/^\d+$/.test(rawVersion) || !Number.isSafeInteger(expectedVersion)) {
      throw new Error('Reload the plan editor');
    }
    const current = (await gatewayJson<{ data: ConfigResponse }>(CATALOG_PATH)).data;
    const isV2 = current.config.schemaVersion === 2;
    if (current.version !== expectedVersion || isV2 === form.has('region')) {
      return { ok: false, conflict: true, message: conflictMessage };
    }
    const config = current.config.schemaVersion === 2
      ? editV2Catalog(current.config, form)
      : editLegacyCatalog(current.config, form);
    const result = await gatewayJson<{ data: ConfigResponse }>(CATALOG_PATH, { method: 'PUT', body: JSON.stringify({ expectedVersion, config }) });
    revalidatePath('/coaching-plans');
    revalidatePath('/fulfillment');
    return { ok: true, message: `Published version ${result.data.version}. New purchases use these terms; existing memberships keep their purchased offer.` };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not save plans';
    return { ok: false, message, ...(message === conflictMessage && { conflict: true }) };
  }
}
