import { gatewayJson } from '@/lib/api';

// Server-only data for /unclaimed-gyms: places customers check into that are
// not partner gyms yet (gym-service UnclaimedGym), each with the "N people
// already train here" figure from booking-service. The count is null under 5
// people (privacy floor, enforced server-side), and null is never shown.

export const CLAIM_STATUSES = ['unclaimed', 'claim_pending', 'claimed'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  unclaimed: 'Unclaimed',
  claim_pending: 'Claim pending',
  claimed: 'Claimed',
};

export interface UnclaimedGym {
  id: number;
  googlePlaceId: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  addedByUserId: number;
  claimStatus: ClaimStatus;
  claimedGymId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UnclaimedGymRow {
  gym: UnclaimedGym;
  /** null = under the privacy floor, or the count could not be loaded. */
  peopleCount: number | null;
  countFailed: boolean;
}

export function parseClaimStatus(value: unknown): ClaimStatus {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' && (CLAIM_STATUSES as readonly string[]).includes(v)
    ? (v as ClaimStatus)
    : 'unclaimed';
}

/// The line shown under a gym, or null to show nothing.
export function peopleTrainHereLabel(count: number | null | undefined): string | null {
  return typeof count === 'number' && Number.isFinite(count) && count > 0
    ? `${count} people already train here`
    : null;
}

export async function fetchUnclaimedGyms(claimStatus: ClaimStatus): Promise<UnclaimedGym[]> {
  const body = await gatewayJson<{ data?: unknown } | unknown[]>(
    `/api/gyms/unclaimed?claimStatus=${claimStatus}`,
  );
  const data = Array.isArray(body) ? body : (body as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as UnclaimedGym[]) : [];
}

export async function fetchPeopleCount(unclaimedGymId: number): Promise<number | null> {
  const body = await gatewayJson<{ count?: unknown; data?: { count?: unknown } }>(
    `/api/bookings/admin/unclaimed-gyms/${unclaimedGymId}/people-count`,
  );
  const count = body?.count !== undefined ? body.count : body?.data?.count;
  return typeof count === 'number' && Number.isFinite(count) ? count : null;
}

/// The list, then every gym's count in parallel. A count that fails is shown
/// as nothing for that gym; it never takes the list down (allSettled, not all).
export async function loadUnclaimedGymRows(claimStatus: ClaimStatus): Promise<UnclaimedGymRow[]> {
  const gyms = await fetchUnclaimedGyms(claimStatus);
  const counts = await Promise.allSettled(gyms.map((g) => fetchPeopleCount(g.id)));
  return gyms.map((gym, i) => {
    const result = counts[i];
    return result.status === 'fulfilled'
      ? { gym, peopleCount: result.value, countFailed: false }
      : { gym, peopleCount: null, countFailed: true };
  });
}
