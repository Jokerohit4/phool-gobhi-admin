import { describe, it, expect, vi, beforeEach } from 'vitest';

const gatewayJson = vi.fn();
const gatewayFetch = vi.fn();
vi.mock('../api', () => ({
  gatewayJson: (...args: unknown[]) => gatewayJson(...args),
  gatewayFetch: (...args: unknown[]) => gatewayFetch(...args),
}));

const { fetchContentQueue, fetchPendingCount, ContentApiError, reviewContent } = await import('../contentApi');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchContentQueue', () => {
  it('builds the query from the filters and unwraps {data}', async () => {
    gatewayJson.mockResolvedValue({ data: { items: [{ type: 'exercise', id: 1 }], total: 1 } });
    const queue = await fetchContentQueue({ type: 'exercise', lang: 'hi', status: 'pending' });
    expect(gatewayJson).toHaveBeenCalledWith('/api/health/content/admin/queue?type=exercise&lang=hi&status=pending');
    expect(queue.total).toBe(1);
    expect(queue.items).toHaveLength(1);
  });

  it('degrades a malformed body to an empty queue', async () => {
    gatewayJson.mockResolvedValue({ data: null });
    expect(await fetchContentQueue({ status: 'pending' })).toEqual({ items: [], total: 0 });
  });

  it('counts pending items for one language across both types', async () => {
    gatewayJson.mockResolvedValue({ data: { items: [], total: 4 } });
    expect(await fetchPendingCount('hinglish')).toBe(4);
    expect(gatewayJson).toHaveBeenCalledWith('/api/health/content/admin/queue?lang=hinglish&status=pending');
  });
});

describe('mutations keep the backend error code', () => {
  it('throws ContentApiError with status and code', async () => {
    gatewayFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: 'changed', code: 'CONTENT_CHANGED' }), { status: 409 }),
    );
    const err = await reviewContent('article', 3, 'approve', 2).catch((e) => e);
    expect(err).toBeInstanceOf(ContentApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONTENT_CHANGED');
  });
});
