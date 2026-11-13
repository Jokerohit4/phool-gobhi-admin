import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActionState } from '@/components/ui/ActionForm';

// The server actions authenticate, call the gateway through lib/buddyApi, and
// revalidate the queue. Mock the seams so the tests can assert each action's
// gateway call, its readable ActionState, and that a failure never crashes the
// admin UI.

const gatewayJson = vi.fn();
vi.mock('@/lib/api', () => ({ gatewayJson: (...args: unknown[]) => gatewayJson(...args) }));

const requireSession = vi.fn();
vi.mock('@/lib/auth', () => ({ requireSession: (...args: unknown[]) => requireSession(...args) }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const {
  dismissReportAction,
  actionReportAction,
  suspendReportAction,
  releaseHoldAction,
  reinstateAction,
  clearGenderChangeAction,
  loadReportContextAction,
} = await import('../actions');

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const prev: ActionState = { ok: false };

beforeEach(() => {
  vi.clearAllMocks();
  requireSession.mockResolvedValue({ userId: 1, role: 'gobhi' });
  gatewayJson.mockResolvedValue({});
});

describe('report review actions', () => {
  it('dismisses a report with the note and revalidates the queue', async () => {
    const result = await dismissReportAction(prev, formData({ id: '7', resolutionNote: ' fine ' }));
    expect(gatewayJson).toHaveBeenCalledWith('/api/buddy/reports/7', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'dismissed', resolutionNote: 'fine' }),
    });
    expect(revalidatePath).toHaveBeenCalledWith('/buddy-reports');
    expect(result).toMatchObject({ ok: true });
  });

  it('marks a report actioned', async () => {
    await actionReportAction(prev, formData({ id: '8' }));
    const [, init] = gatewayJson.mock.calls[0];
    expect(JSON.parse(init.body).status).toBe('actioned');
  });

  it('actions and suspends in one call', async () => {
    await suspendReportAction(prev, formData({ id: '9', resolutionNote: 'threat' }));
    const [, init] = gatewayJson.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      status: 'actioned',
      suspend: true,
      resolutionNote: 'threat',
    });
  });

  it('rejects a missing or invalid id without calling the gateway', async () => {
    const result = await dismissReportAction(prev, formData({ id: 'abc' }));
    expect(result.ok).toBe(false);
    expect(gatewayJson).not.toHaveBeenCalled();
  });

  it('turns a gateway error into a readable ActionState', async () => {
    gatewayJson.mockRejectedValue(new Error('buddy-service unavailable'));
    const result = await dismissReportAction(prev, formData({ id: '7' }));
    expect(result).toEqual({ ok: false, message: 'buddy-service unavailable' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('user moderation actions', () => {
  it('releases a moderation hold', async () => {
    const result = await releaseHoldAction(prev, formData({ userId: '42' }));
    expect(gatewayJson).toHaveBeenCalledWith('/api/buddy/reports/users/42/release-hold', {
      method: 'PATCH',
    });
    expect(result).toMatchObject({ ok: true });
  });

  it('reinstates a user', async () => {
    await reinstateAction(prev, formData({ userId: '42' }));
    expect(gatewayJson).toHaveBeenCalledWith('/api/buddy/reports/users/42/reinstate', {
      method: 'PATCH',
    });
  });

  it('clears a gender change', async () => {
    await clearGenderChangeAction(prev, formData({ userId: '42' }));
    expect(gatewayJson).toHaveBeenCalledWith('/api/buddy/moderation/gender-changes/42/clear', {
      method: 'PATCH',
    });
  });

  it('rejects a missing user id without calling the gateway', async () => {
    const result = await releaseHoldAction(prev, formData({}));
    expect(result.ok).toBe(false);
    expect(gatewayJson).not.toHaveBeenCalled();
  });
});

describe('loadReportContextAction', () => {
  it('returns the messages for an expanded row', async () => {
    gatewayJson.mockResolvedValue({ data: { messages: [{ fromUserId: 1, body: 'hi', createdAt: 'x' }] } });
    const messages = await loadReportContextAction(11);
    expect(gatewayJson).toHaveBeenCalledWith('/api/buddy/reports/11/context');
    expect(messages).toHaveLength(1);
  });

  it('authenticates before reading any context', async () => {
    gatewayJson.mockResolvedValue({ data: { messages: [] } });
    await loadReportContextAction(11);
    expect(requireSession).toHaveBeenCalled();
  });
});
