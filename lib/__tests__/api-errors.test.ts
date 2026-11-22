import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => ({ value: 'tok' }), set: vi.fn() }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { gatewayJson, GatewayError, GENERIC_SERVER_ERROR } = await import('../api');

function respond(status: number, body: unknown) {
  mockFetch.mockResolvedValue({ ok: status < 400, status, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('gatewayJson error mapping', () => {
  it('returns the body on success', async () => {
    respond(200, { data: 1 });
    await expect(gatewayJson('/x')).resolves.toEqual({ data: 1 });
  });

  it('keeps 4xx validation messages', async () => {
    respond(400, { error: 'Amount must be positive' });
    await expect(gatewayJson('/x')).rejects.toMatchObject({ message: 'Amount must be positive', status: 400 });
  });

  it('falls back to a status message for 4xx without a usable error', async () => {
    respond(404, {});
    await expect(gatewayJson('/x')).rejects.toThrow('Request failed (404)');
  });

  it('hides 5xx details and logs them instead', async () => {
    respond(500, { error: 'PrismaClientKnownRequestError: relation "users" does not exist' });
    const err = (await gatewayJson('/x').catch((e) => e)) as Error;
    expect(err).toBeInstanceOf(GatewayError);
    expect(err.message).toBe(GENERIC_SERVER_ERROR);
    expect(console.error).toHaveBeenCalled();
  });

  it('hides network failure details', async () => {
    mockFetch.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5000'));
    await expect(gatewayJson('/x')).rejects.toThrow(GENERIC_SERVER_ERROR);
  });
});
