// Friendly display names for raw event names — keep in sync with
// phool-gobhi-backend/docs/analytics-events.json, the source of truth for
// the event names themselves.
export const EVENT_LABELS: Record<string, string> = {
  onboarding_started: 'Started onboarding',
  onboarding_step_completed: 'Completed a step',
  gym_created: 'Gym submitted',
  gym_approved: 'Approved',
  gym_rejected: 'Rejected',
  gym_viewed: 'Viewed gym',
  slot_selected: 'Selected slot',
  book_tapped: 'Tapped book',
  booking_confirmed: 'Booking confirmed',
  checkin_requested: 'Check-in requested',
  attendance_verified: 'Attendance verified',
  booking_completed: 'Session completed',
  otp_requested: 'OTP requested',
  otp_submitted: 'OTP submitted',
  signup_completed: 'Signed up',
  login_completed: 'Logged in',
  topup_tapped: 'Tapped top-up',
  wallet_topup_order_created: 'Order created',
  wallet_topup_succeeded: 'Top-up succeeded',
  wallet_topup_failed: 'Top-up failed',
  buddy_profile_created: 'Profile created',
  buddy_swiped: 'Swiped',
  buddy_matched: 'Matched',
  buddy_message_sent: 'Message sent',
  buddy_unmatched: 'Unmatched',
  buddy_blocked: 'Blocked',
};

export function labelFor(event: string): string {
  return EVENT_LABELS[event] ?? event;
}

/** Orders a {event, users|n} rows array into a fixed step sequence, filling 0 for any step with no rows yet. */
export function toOrderedSteps<T extends { event: string }>(
  rows: T[],
  order: string[],
  valueKey: keyof T,
): { label: string; value: number }[] {
  const byEvent = new Map(rows.map((r) => [r.event, Number(r[valueKey]) || 0]));
  return order.map((event) => ({ label: labelFor(event), value: byEvent.get(event) ?? 0 }));
}

export interface StepWithDropoff {
  label: string;
  value: number;
  pctOfPrevious: number | null; // null for the first step — nothing to compare against
  pctOfTop: number | null;
}

/** Annotates ordered funnel steps with drop-off percentages, computed from the raw counts, not re-fetched. */
export function withDropoff(steps: { label: string; value: number }[]): StepWithDropoff[] {
  const top = steps[0]?.value ?? 0;
  return steps.map((s, i) => {
    const prev = i > 0 ? steps[i - 1].value : null;
    return {
      ...s,
      pctOfPrevious: i === 0 || !prev ? null : Math.round((s.value / prev) * 100),
      pctOfTop: i === 0 || !top ? null : Math.round((s.value / top) * 100),
    };
  });
}
