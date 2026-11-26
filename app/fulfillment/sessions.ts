export const DISPUTED_SESSIONS_PATH = '/api/wallet/coaching/admin/sessions/disputed';
export const DISPUTED_PAGE_SIZE = 20;

export type DisputedSessions = {
  sessions: {
    id: number;
    userId: number;
    kind: 'trainer' | 'nutritionist';
    mode: 'online' | 'in_person';
    heldAt: string;
    durationMinutes: number | null;
    disputeReason: string | null;
  }[];
  total: number;
  page: number;
  limit: number;
};
