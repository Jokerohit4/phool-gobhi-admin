import { describe, it, expect, vi, beforeEach } from 'vitest';

const gatewayJson = vi.fn();
vi.mock('@/lib/api', () => ({ gatewayJson: (...args: unknown[]) => gatewayJson(...args) }));

const { loadUnclaimedGymRows, peopleTrainHereLabel, parseClaimStatus } = await import('../unclaimedGyms');

const gym = (id: number) => ({
  id,
  googlePlaceId: `p${id}`,
  name: `Gym ${id}`,
  address: 'Somewhere',
  city: 'Gurugram',
  lat: 0,
  lng: 0,
  addedByUserId: 1,
  claimStatus: 'unclaimed',
  claimedGymId: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('peopleTrainHereLabel', () => {
  it('shows the count when there is one', () => {
    expect(peopleTrainHereLabel(7)).toBe('7 people already train here');
  });

  it('hides a null count (under 5 people)', () => {
    expect(peopleTrainHereLabel(null)).toBeNull();
    expect(peopleTrainHereLabel(undefined)).toBeNull();
  });
});

describe('loadUnclaimedGymRows', () => {
  it('lists gyms from gym-service and attaches each people count', async () => {
    gatewayJson.mockImplementation(async (p: string) => {
      if (p === '/api/gyms/unclaimed?claimStatus=unclaimed') return { data: [gym(1), gym(2)] };
      if (p === '/api/bookings/admin/unclaimed-gyms/1/people-count') return { count: 12 };
      if (p === '/api/bookings/admin/unclaimed-gyms/2/people-count') return { count: null };
      throw new Error(`unexpected ${p}`);
    });
    const rows = await loadUnclaimedGymRows('unclaimed');
    expect(rows.map((r) => [r.gym.id, r.peopleCount, r.countFailed])).toEqual([
      [1, 12, false],
      [2, null, false],
    ]);
    expect(peopleTrainHereLabel(rows[1].peopleCount)).toBeNull();
  });

  it('keeps the list when one count fails', async () => {
    gatewayJson.mockImplementation(async (p: string) => {
      if (p.startsWith('/api/gyms/unclaimed')) return { data: [gym(1), gym(2), gym(3)] };
      if (p.includes('/2/')) throw new Error('booking-service down');
      return { count: 6 };
    });
    const rows = await loadUnclaimedGymRows('unclaimed');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({ peopleCount: null, countFailed: true });
    expect(rows[0].peopleCount).toBe(6);
    expect(rows[2].peopleCount).toBe(6);
  });

  it('throws when the list itself fails, so the page shows its error state', async () => {
    gatewayJson.mockRejectedValue(new Error('gym-service down'));
    await expect(loadUnclaimedGymRows('unclaimed')).rejects.toThrow('gym-service down');
  });

  it('returns no rows for an empty list without asking for counts', async () => {
    gatewayJson.mockResolvedValue({ data: [] });
    expect(await loadUnclaimedGymRows('claimed')).toEqual([]);
    expect(gatewayJson).toHaveBeenCalledTimes(1);
    expect(gatewayJson).toHaveBeenCalledWith('/api/gyms/unclaimed?claimStatus=claimed');
  });
});

describe('parseClaimStatus', () => {
  it('defaults to unclaimed and accepts the known statuses', () => {
    expect(parseClaimStatus(undefined)).toBe('unclaimed');
    expect(parseClaimStatus('bogus')).toBe('unclaimed');
    expect(parseClaimStatus('claim_pending')).toBe('claim_pending');
  });
});
