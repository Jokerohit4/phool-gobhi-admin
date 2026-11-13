import { describe, it, expect, vi, beforeEach } from 'vitest';

// lib/buddyApi.ts wraps the buddy-service admin moderation endpoints and
// unwraps their `{ data }` envelopes. Mock the gateway so the tests assert the
// exact paths, methods and bodies the admin panel sends.

const gatewayJson = vi.fn();
vi.mock('@/lib/api', () => ({ gatewayJson: (...args: unknown[]) => gatewayJson(...args) }));

const {
  fetchReports,
  fetchReportContext,
  fetchGenderChanges,
  reviewReport,
  releaseHold,
  reinstateUser,
  clearGenderChange,
} = await import('../buddyApi');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchReports', () => {
  it('requests the status filter and unwraps the data envelope', async () => {
    gatewayJson.mockResolvedValue({ data: [{ id: 1, reason: 'threat' }] });
    const rows = await fetchReports('actioned');
    expect(gatewayJson).toHaveBeenCalledWith('/api/buddy/reports?status=actioned');
    expect(rows).toEqual([{ id: 1, reason: 'threat' }]);
  });

  it('defaults to the open queue', async () => {
    gatewayJson.mockResolvedValue({ data: [] });
    await fetchReports();
    expect(gatewayJson).toHaveBeenCalledWith('/api/buddy/reports?status=open');
  });

  it('accepts a bare array response', async () => {
    gatewayJson.mockResolvedValue([{ id: 2 }]);
    expect(await fetchReports()).toEqual([{ id: 2 }]);
  });

  it('degrades to an empty list on an unexpected shape', async () => {
    gatewayJson.mockResolvedValue({ nope: true });
    expect(await fetchReports()).toEqual([]);
  });
});

describe('fetchGenderChanges', () => {
  it('requests the moderation list and unwraps data', async () => {
    gatewayJson.mockResolvedValue({ data: [{ userId: 9, firstName: 'Rita' }] });
    const rows = await fetchGenderChanges();
    expect(gatewayJson).toHaveBeenCalledWith('/api/buddy/moderation/gender-changes');
    expect(rows[0]).toMatchObject({ userId: 9, firstName: 'Rita' });
  });
});

describe('fetchReportContext', () => {
  it('requests the context route and reads messages from the data envelope', async () => {
    gatewayJson.mockResolvedValue({ data: { messages: [{ fromUserId: 1, body: 'hi', createdAt: 'x' }] } });
    const messages = await fetchReportContext(11);
    expect(gatewayJson).toHaveBeenCalledWith('/api/buddy/reports/11/context');
    expect(messages).toEqual([{ fromUserId: 1, body: 'hi', createdAt: 'x' }]);
  });

  it('reads a top-level messages field', async () => {
    gatewayJson.mockResolvedValue({ messages: [{ fromUserId: 2, body: 'yo', createdAt: 'x' }] });
    expect(await fetchReportContext(11)).toHaveLength(1);
  });

  it('reads a bare array', async () => {
    gatewayJson.mockResolvedValue([{ fromUserId: 3, body: 'a', createdAt: 'x' }]);
    expect(await fetchReportContext(11)).toHaveLength(1);
  });

  it('returns [] when there is no chat', async () => {
    gatewayJson.mockResolvedValue({ data: { messages: [] } });
    expect(await fetchReportContext(11)).toEqual([]);
  });

  it('returns [] for a malformed response', async () => {
    gatewayJson.mockResolvedValue({ data: 42 });
    expect(await fetchReportContext(11)).toEqual([]);
  });
});

describe('reviewReport', () => {
  it('PATCHes the report with the given status and note', async () => {
    gatewayJson.mockResolvedValue({});
    await reviewReport(7, { status: 'dismissed', resolutionNote: 'not a violation' });
    expect(gatewayJson).toHaveBeenCalledWith('/api/buddy/reports/7', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'dismissed', resolutionNote: 'not a violation' }),
    });
  });

  it('includes suspend:true for an action-plus-suspend decision', async () => {
    gatewayJson.mockResolvedValue({});
    await reviewReport(7, { status: 'actioned', suspend: true });
    const [, init] = gatewayJson.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ status: 'actioned', suspend: true });
  });
});

describe('user moderation helpers', () => {
  it('releases a hold', async () => {
    gatewayJson.mockResolvedValue({});
    await releaseHold(42);
    expect(gatewayJson).toHaveBeenCalledWith('/api/buddy/reports/users/42/release-hold', {
      method: 'PATCH',
    });
  });

  it('reinstates a user', async () => {
    gatewayJson.mockResolvedValue({});
    await reinstateUser(42);
    expect(gatewayJson).toHaveBeenCalledWith('/api/buddy/reports/users/42/reinstate', {
      method: 'PATCH',
    });
  });

  it('clears a gender change', async () => {
    gatewayJson.mockResolvedValue({});
    await clearGenderChange(42);
    expect(gatewayJson).toHaveBeenCalledWith('/api/buddy/moderation/gender-changes/42/clear', {
      method: 'PATCH',
    });
  });
});
