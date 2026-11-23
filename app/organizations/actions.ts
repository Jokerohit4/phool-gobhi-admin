'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { parsePositiveId, INVALID_ID_MESSAGE } from '@/lib/ids';
import { describeAddResult, istDateToIso, parseMemberLines, type AddMembersResult } from '@/lib/orgApi';
import type { ActionState } from '@/components/ui/ActionForm';

// Every action authenticates first (test-enforced) and validates ids before
// they go into a gateway path. Membership is created ONLY here: customers have
// no way to join a company.

const BASE = '/api/challenges/admin/orgs';
const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
const fail = (err: unknown, fallback: string): ActionState => ({ ok: false, message: err instanceof Error ? err.message : fallback });

// Date input + "no end date" checkbox -> undefined (leave alone), null (clear) or an ISO instant.
function endDate(fd: FormData, field: string, noEndField: string): string | null | undefined | 'invalid' {
  if (fd.get(noEndField) === 'on') return null;
  const raw = text(fd, field);
  if (!raw) return undefined;
  return istDateToIso(raw, 'end') ?? 'invalid';
}

export async function createOrgAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const name = text(formData, 'name');
  if (!name) return { ok: false, message: 'Company name is required' };
  const start = text(formData, 'startsAt');
  const startsAt = start ? istDateToIso(start, 'start') : undefined;
  if (start && !startsAt) return { ok: false, message: 'Start date is not valid' };
  const expiresAt = endDate(formData, 'expiresAt', 'noExpiry');
  if (expiresAt === 'invalid') return { ok: false, message: 'Expiry date is not valid' };
  try {
    await gatewayJson(BASE, {
      method: 'POST',
      body: JSON.stringify({
        name, startsAt, expiresAt: expiresAt ?? null,
        contactName: text(formData, 'contactName') || null,
        contactEmail: text(formData, 'contactEmail') || null,
        notes: text(formData, 'notes') || null,
      }),
    });
  } catch (err) {
    return fail(err, 'Could not create the company');
  }
  revalidatePath('/organizations');
  return { ok: true, message: `Created ${name}. Now add its people and a leaderboard.` };
}

export async function updateOrgAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = parsePositiveId(formData.get('id'));
  if (id === null) return { ok: false, message: INVALID_ID_MESSAGE };
  const expiresAt = endDate(formData, 'expiresAt', 'noExpiry');
  if (expiresAt === 'invalid') return { ok: false, message: 'Expiry date is not valid' };
  const status = text(formData, 'status');
  if (status && !['active', 'archived'].includes(status)) return { ok: false, message: 'Invalid status' };
  try {
    await gatewayJson(`${BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: text(formData, 'name') || undefined,
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        ...(status ? { status } : {}),
        contactName: text(formData, 'contactName') || null,
        contactEmail: text(formData, 'contactEmail') || null,
        notes: text(formData, 'notes') || null,
      }),
    });
  } catch (err) {
    return fail(err, 'Could not save the company');
  }
  revalidatePath(`/organizations/${id}`);
  revalidatePath('/organizations');
  return { ok: true, message: 'Saved' };
}

export async function addMembersAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = parsePositiveId(formData.get('id'));
  if (id === null) return { ok: false, message: INVALID_ID_MESSAGE };
  const parsed = parseMemberLines(String(formData.get('members') ?? ''));
  if (parsed.error) return { ok: false, message: parsed.error };
  try {
    const { data } = await gatewayJson<{ data: AddMembersResult }>(`${BASE}/${id}/members`, {
      method: 'POST', body: JSON.stringify({ members: parsed.rows }),
    });
    revalidatePath(`/organizations/${id}`);
    return { ok: data.invalid.length === 0, message: describeAddResult(data) };
  } catch (err) {
    return fail(err, 'Could not add people');
  }
}

export async function removeMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = parsePositiveId(formData.get('id'));
  const memberId = parsePositiveId(formData.get('memberId'));
  if (id === null || memberId === null) return { ok: false, message: INVALID_ID_MESSAGE };
  try {
    await gatewayJson(`${BASE}/${id}/members/${memberId}`, { method: 'DELETE' });
  } catch (err) {
    return fail(err, 'Could not remove this person');
  }
  revalidatePath(`/organizations/${id}`);
  return { ok: true, message: 'Removed' };
}

export async function setMemberTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = parsePositiveId(formData.get('id'));
  const memberId = parsePositiveId(formData.get('memberId'));
  if (id === null || memberId === null) return { ok: false, message: INVALID_ID_MESSAGE };
  const raw = text(formData, 'teamId');
  const teamId = raw === '' ? null : parsePositiveId(raw);
  if (raw !== '' && teamId === null) return { ok: false, message: INVALID_ID_MESSAGE };
  try {
    await gatewayJson(`${BASE}/${id}/members/${memberId}`, { method: 'PUT', body: JSON.stringify({ teamId }) });
  } catch (err) {
    return fail(err, 'Could not change the team');
  }
  revalidatePath(`/organizations/${id}`);
  return { ok: true, message: 'Team updated' };
}

export async function createTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = parsePositiveId(formData.get('id'));
  if (id === null) return { ok: false, message: INVALID_ID_MESSAGE };
  const name = text(formData, 'name');
  if (!name) return { ok: false, message: 'Team name is required' };
  try {
    await gatewayJson(`${BASE}/${id}/teams`, { method: 'POST', body: JSON.stringify({ name }) });
  } catch (err) {
    return fail(err, 'Could not create the team');
  }
  revalidatePath(`/organizations/${id}`);
  return { ok: true, message: `Created team ${name}` };
}

export async function deleteTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = parsePositiveId(formData.get('id'));
  const teamId = parsePositiveId(formData.get('teamId'));
  if (id === null || teamId === null) return { ok: false, message: INVALID_ID_MESSAGE };
  try {
    await gatewayJson(`${BASE}/${id}/teams/${teamId}`, { method: 'DELETE' });
  } catch (err) {
    return fail(err, 'Could not delete the team');
  }
  revalidatePath(`/organizations/${id}`);
  return { ok: true, message: 'Team deleted. Its members now have no team.' };
}

export async function createBoardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = parsePositiveId(formData.get('id'));
  if (id === null) return { ok: false, message: INVALID_ID_MESSAGE };
  const name = text(formData, 'name');
  if (!name) return { ok: false, message: 'Leaderboard name is required' };
  const start = text(formData, 'startsAt');
  const startsAt = start ? istDateToIso(start, 'start') : undefined;
  if (start && !startsAt) return { ok: false, message: 'Start date is not valid' };
  const endsAt = endDate(formData, 'endsAt', 'noEnd');
  if (endsAt === 'invalid') return { ok: false, message: 'End date is not valid' };
  try {
    await gatewayJson(`${BASE}/${id}/leaderboards`, {
      method: 'POST',
      body: JSON.stringify({
        name, description: text(formData, 'description') || null, scoring: text(formData, 'scoring') || 'active_days',
        startsAt, endsAt: endsAt ?? null, showTeams: formData.get('showTeams') === 'on',
      }),
    });
  } catch (err) {
    return fail(err, 'Could not create the leaderboard');
  }
  revalidatePath(`/organizations/${id}`);
  return { ok: true, message: `Created leaderboard ${name}` };
}

export async function updateBoardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const id = parsePositiveId(formData.get('id'));
  const boardId = parsePositiveId(formData.get('boardId'));
  if (id === null || boardId === null) return { ok: false, message: INVALID_ID_MESSAGE };
  const endsAt = endDate(formData, 'endsAt', 'noEnd');
  if (endsAt === 'invalid') return { ok: false, message: 'End date is not valid' };
  const status = text(formData, 'status');
  if (status && !['active', 'archived'].includes(status)) return { ok: false, message: 'Invalid status' };
  try {
    await gatewayJson(`${BASE}/${id}/leaderboards/${boardId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: text(formData, 'name') || undefined,
        description: text(formData, 'description') || null,
        ...(endsAt !== undefined ? { endsAt } : {}),
        ...(status ? { status } : {}),
        showTeams: formData.get('showTeams') === 'on',
      }),
    });
  } catch (err) {
    return fail(err, 'Could not save the leaderboard');
  }
  revalidatePath(`/organizations/${id}`);
  return { ok: true, message: 'Saved' };
}
