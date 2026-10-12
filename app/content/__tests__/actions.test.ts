import { describe, it, expect, vi, beforeEach } from 'vitest';

// The server actions authenticate, call the gateway through lib/contentApi,
// and revalidate /content. Mock the seams (gatewayFetch, session, cache) so
// the tests assert the exact request each action sends and the message the
// reviewer sees.

const gatewayFetch = vi.fn();
const gatewayJson = vi.fn();
vi.mock('@/lib/api', () => ({
  gatewayFetch: (...args: unknown[]) => gatewayFetch(...args),
  gatewayJson: (...args: unknown[]) => gatewayJson(...args),
}));

const requireSession = vi.fn();
vi.mock('@/lib/auth', () => ({ requireSession: (...args: unknown[]) => requireSession(...args) }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const { reviewContentAction, editContentAction } = await import('../actions');
const { CONTENT_CHANGED_MESSAGE } = await import('../contentDisplay');

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireSession.mockResolvedValue({ userId: 1, role: 'gobhi' });
  gatewayFetch.mockResolvedValue(jsonResponse(200, { data: { id: 5, version: 3 } }));
});

describe('reviewContentAction', () => {
  it('approves with the version that was on screen', async () => {
    const result = await reviewContentAction({ type: 'exercise', id: 5, decision: 'approve', version: 2 });
    expect(gatewayFetch).toHaveBeenCalledWith('/api/health/content/admin/exercise/5/approve', {
      method: 'POST',
      body: JSON.stringify({ version: 2 }),
    });
    expect(revalidatePath).toHaveBeenCalledWith('/content');
    expect(result).toEqual({ ok: true, message: 'Approved' });
  });

  it('rejects an article with its displayed version', async () => {
    await reviewContentAction({ type: 'article', id: 8, decision: 'reject', version: 4 });
    expect(gatewayFetch).toHaveBeenCalledWith('/api/health/content/admin/article/8/reject', {
      method: 'POST',
      body: JSON.stringify({ version: 4 }),
    });
  });

  it('turns 409 CONTENT_CHANGED into the reload message and refetches', async () => {
    gatewayFetch.mockResolvedValue(
      jsonResponse(409, { error: 'This item changed since you opened it.', code: 'CONTENT_CHANGED' }),
    );
    const result = await reviewContentAction({ type: 'exercise', id: 5, decision: 'approve', version: 2 });
    expect(result).toEqual({ ok: false, message: CONTENT_CHANGED_MESSAGE, reload: true });
    expect(CONTENT_CHANGED_MESSAGE).toBe('This item changed — reload to review the new version');
    expect(revalidatePath).toHaveBeenCalledWith('/content');
  });

  it('shows other gateway errors as-is without reloading', async () => {
    gatewayFetch.mockResolvedValue(jsonResponse(404, { error: 'Content not found', code: 'NOT_FOUND' }));
    const result = await reviewContentAction({ type: 'exercise', id: 5, decision: 'approve', version: 2 });
    expect(result).toEqual({ ok: false, message: 'Content not found' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('refuses a bad type, id or version without calling the gateway', async () => {
    const bad = [
      { type: 'video', id: 5, decision: 'approve', version: 1 },
      { type: 'exercise', id: 0, decision: 'approve', version: 1 },
      { type: 'exercise', id: 5, decision: 'approve', version: 0 },
      { type: 'exercise', id: 5, decision: 'publish', version: 1 },
    ];
    for (const input of bad) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await reviewContentAction(input as any);
      expect(result.ok).toBe(false);
    }
    expect(gatewayFetch).not.toHaveBeenCalled();
  });

  it('authenticates before calling the gateway', async () => {
    await reviewContentAction({ type: 'exercise', id: 5, decision: 'approve', version: 2 });
    expect(requireSession).toHaveBeenCalled();
  });
});

describe('editContentAction', () => {
  it('sends only the exercise list fields and reports the new version', async () => {
    const result = await editContentAction({
      type: 'exercise',
      id: 5,
      fields: { steps: ['Stand', 'Push'], feelCues: ['Chest'], mistakes: ['Elbows'], reviewStatus: 'approved', version: 99 },
    });
    expect(gatewayFetch).toHaveBeenCalledWith('/api/health/content/admin/exercises/5', {
      method: 'PUT',
      body: JSON.stringify({ steps: ['Stand', 'Push'], feelCues: ['Chest'], mistakes: ['Elbows'] }),
    });
    expect(result).toEqual({ ok: true, message: 'Back to pending — version 3' });
    expect(revalidatePath).toHaveBeenCalledWith('/content');
  });

  it('sends only title and body for an article', async () => {
    await editContentAction({
      type: 'article',
      id: 7,
      fields: { title: 'Hi', body: 'Text', approvedAt: 'now', lang: 'en' },
    });
    const [path, init] = gatewayFetch.mock.calls[0];
    expect(path).toBe('/api/health/content/admin/articles/7');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ title: 'Hi', body: 'Text' });
  });

  it('returns a validation error as a readable message', async () => {
    gatewayFetch.mockResolvedValue(
      jsonResponse(400, { error: 'steps must have 1-20 non-empty lines', code: 'INVALID_FIELD' }),
    );
    const result = await editContentAction({ type: 'exercise', id: 5, fields: { steps: [] } });
    expect(result).toEqual({ ok: false, message: 'steps must have 1-20 non-empty lines' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
