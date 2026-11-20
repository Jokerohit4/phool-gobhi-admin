'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/components/ui/ActionForm';
import { gatewayJson } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { campaignApi, type Campaign } from './campaigns';

function errorState(error: unknown): ActionState {
  return { ok: false, message: error instanceof Error ? error.message : 'Campaign request failed' };
}

async function save(id: string | null, form: FormData): Promise<Campaign> {
  const field = (key: string) => String(form.get(key) ?? '').trim();
  const number = (key: string) => field(key) ? Number(field(key)) : null;
  const date = (key: string) => field(key) ? field(key) + ':00+05:30' : null;
  const userIds = field('userIds').split(/[\s,]+/).filter(Boolean).map(value => /^\d+$/.test(value) ? Number(value) : null);
  const path = field('destination');
  const parameter = field('parameterKey');
  const deepLink = path + (parameter ? '?' + new URLSearchParams({ [parameter]: field('parameterValue') }) : '');
  const result = await gatewayJson<{ data: Campaign }>(campaignApi + '/campaigns' + (id ? '/' + encodeURIComponent(id) : ''), {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify({
      name: field('name'), title: field('title'), subtitle: field('subtitle'),
      imageUrl: field('imageUrl'), deepLink,
      audience: { type: field('audience'), cohorts: form.getAll('cohorts'), userIds },
      mode: field('mode'), startAt: date('startAt'), endAt: date('endAt'),
      intervalMinutes: Number(field('intervalAmount')) * Number(field('intervalUnit')), maxRuns: number('maxRuns'),
      event: field('event'), delayMinutes: number('delayMinutes'),
      cooldownMinutes: number('cooldownMinutes'), maxPerUser: number('maxPerUser'),
    }),
  });
  revalidatePath('/notifications');
  revalidatePath('/notifications/' + result.data.id);
  return result.data;
}

export async function createCampaign(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  let campaign: Campaign;
  try {
    campaign = await save(null, form);
  } catch (error) {
    return errorState(error);
  }
  redirect('/notifications/' + campaign.id);
}

export async function updateCampaign(id: string, _previous: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  try {
    await save(id, form);
    return { ok: true, message: 'Campaign saved' };
  } catch (error) {
    return errorState(error);
  }
}

export async function controlCampaign(
  id: string, action: 'activate' | 'pause' | 'cancel' | 'test', _previous: ActionState, form: FormData,
): Promise<ActionState> {
  await requireSession();
  try {
    const path = campaignApi + '/campaigns/' + encodeURIComponent(id);
    await gatewayJson(path + (action === 'test' ? '/test' : '/status'), {
      method: 'POST',
      body: JSON.stringify(action === 'test' ? { userId: Number(form.get('userId')) } : { action }),
    });
    revalidatePath('/notifications');
    revalidatePath('/notifications/' + id);
    return { ok: true, message: action === 'test' ? 'Test push queued' : 'Campaign updated' };
  } catch (error) {
    return errorState(error);
  }
}
