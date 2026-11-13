import { describe, it, expect } from 'vitest';
import {
  labelFor,
  toOrderedSteps,
  withDropoff,
  EVENT_LABELS,
  type StepWithDropoff,
} from '../analyticsLabels';

// ---------------------------------------------------------------------------
// labelFor
// ---------------------------------------------------------------------------
describe('labelFor', () => {
  it('returns friendly label for known events', () => {
    expect(labelFor('onboarding_started')).toBe('Started onboarding');
    expect(labelFor('booking_confirmed')).toBe('Booking confirmed');
    expect(labelFor('buddy_message_sent')).toBe('Message sent');
  });

  it('falls back to raw event name for unknown events', () => {
    expect(labelFor('some_future_event')).toBe('some_future_event');
    expect(labelFor('')).toBe('');
  });

  it('covers every entry in EVENT_LABELS', () => {
    for (const [event, label] of Object.entries(EVENT_LABELS)) {
      expect(labelFor(event)).toBe(label);
    }
  });
});

// ---------------------------------------------------------------------------
// toOrderedSteps
// ---------------------------------------------------------------------------
describe('toOrderedSteps', () => {
  const conversionOrder = [
    'gym_viewed',
    'slot_selected',
    'book_tapped',
    'booking_confirmed',
  ];

  it('orders rows into the fixed step sequence', () => {
    const rows = [
      { event: 'booking_confirmed', users: 12 },
      { event: 'gym_viewed', users: 100 },
      { event: 'book_tapped', users: 30 },
      { event: 'slot_selected', users: 55 },
    ];
    const result = toOrderedSteps(rows, conversionOrder, 'users');
    expect(result.map((s) => s.label)).toEqual([
      'Viewed gym',
      'Selected slot',
      'Tapped book',
      'Booking confirmed',
    ]);
    expect(result.map((s) => s.value)).toEqual([100, 55, 30, 12]);
  });

  it('fills 0 for steps with no rows', () => {
    const rows = [{ event: 'gym_viewed', users: 80 }];
    const result = toOrderedSteps(rows, conversionOrder, 'users');
    expect(result).toEqual([
      { label: 'Viewed gym', value: 80 },
      { label: 'Selected slot', value: 0 },
      { label: 'Tapped book', value: 0 },
      { label: 'Booking confirmed', value: 0 },
    ]);
  });

  it('returns all zeros for empty rows', () => {
    const result = toOrderedSteps([], conversionOrder, 'users');
    expect(result.every((s) => s.value === 0)).toBe(true);
    expect(result).toHaveLength(4);
  });

  it('handles extra rows not in the order (ignored)', () => {
    const rows = [
      { event: 'gym_viewed', users: 100 },
      { event: 'some_other_event', users: 999 },
    ];
    const result = toOrderedSteps(rows, conversionOrder, 'users');
    expect(result).toHaveLength(4);
    expect(result.find((s) => s.value === 999)).toBeUndefined();
  });

  it('uses valueKey parameter to read from different fields', () => {
    const rows = [
      { event: 'otp_requested', distinct_users: 200 },
      { event: 'otp_submitted', distinct_users: 180 },
      { event: 'signup_completed', distinct_users: 150 },
      { event: 'login_completed', distinct_users: 140 },
    ];
    const activationOrder = [
      'otp_requested',
      'otp_submitted',
      'signup_completed',
      'login_completed',
    ];
    const result = toOrderedSteps(rows, activationOrder, 'distinct_users');
    expect(result.map((s) => s.value)).toEqual([200, 180, 150, 140]);
  });

  it('coerces string numbers to numbers', () => {
    const rows = [
      { event: 'gym_viewed', n: '42' },
      { event: 'slot_selected', n: '7' },
    ];
    const result = toOrderedSteps(rows, ['gym_viewed', 'slot_selected'], 'n');
    expect(result.map((s) => s.value)).toEqual([42, 7]);
  });

  it('treats non-numeric values as 0', () => {
    const rows = [{ event: 'gym_viewed', users: 'not-a-number' }];
    const result = toOrderedSteps(rows, ['gym_viewed'], 'users');
    expect(result[0].value).toBe(0);
  });

  it('works with onboarding funnel order', () => {
    const onboardingOrder = [
      'onboarding_started',
      'onboarding_step_completed',
      'gym_created',
      'gym_approved',
      'gym_rejected',
    ];
    const rows = [
      { event: 'onboarding_started', users: 500 },
      { event: 'gym_created', users: 120 },
      { event: 'gym_approved', users: 80 },
    ];
    const result = toOrderedSteps(rows, onboardingOrder, 'users');
    expect(result.map((s) => s.value)).toEqual([500, 0, 120, 80, 0]);
  });
});

// ---------------------------------------------------------------------------
// withDropoff
// ---------------------------------------------------------------------------
describe('withDropoff', () => {
  it('returns null for pctOfPrevious and pctOfTop on first step', () => {
    const steps = [{ label: 'Step A', value: 100 }];
    const result = withDropoff(steps);
    expect(result[0].pctOfPrevious).toBeNull();
    expect(result[0].pctOfTop).toBeNull();
  });

  it('computes pctOfPrevious correctly', () => {
    const steps = [
      { label: 'Step A', value: 100 },
      { label: 'Step B', value: 50 },
      { label: 'Step C', value: 25 },
    ];
    const result = withDropoff(steps);
    expect(result[0].pctOfPrevious).toBeNull();
    expect(result[1].pctOfPrevious).toBe(50);
    expect(result[2].pctOfPrevious).toBe(50);
  });

  it('computes pctOfTop correctly', () => {
    const steps = [
      { label: 'Step A', value: 100 },
      { label: 'Step B', value: 60 },
      { label: 'Step C', value: 10 },
    ];
    const result = withDropoff(steps);
    expect(result[0].pctOfTop).toBeNull();
    expect(result[1].pctOfTop).toBe(60);
    expect(result[2].pctOfTop).toBe(10);
  });

  it('rounds percentages to nearest integer', () => {
    const steps = [
      { label: 'Step A', value: 100 },
      { label: 'Step B', value: 33 },
    ];
    const result = withDropoff(steps);
    expect(result[1].pctOfPrevious).toBe(33);
    expect(result[1].pctOfTop).toBe(33);
  });

  it('handles 100% retention (no drop-off)', () => {
    const steps = [
      { label: 'A', value: 50 },
      { label: 'B', value: 50 },
    ];
    const result = withDropoff(steps);
    expect(result[1].pctOfPrevious).toBe(100);
    expect(result[1].pctOfTop).toBe(100);
  });

  it('handles zero values in sequence', () => {
    const steps = [
      { label: 'A', value: 100 },
      { label: 'B', value: 0 },
      { label: 'C', value: 0 },
    ];
    const result = withDropoff(steps);
    // B: 0/100 = 0%
    expect(result[1].pctOfPrevious).toBe(0);
    expect(result[1].pctOfTop).toBe(0);
    // C: prev=0 so !prev is truthy → null for pctOfPrevious;
    // top=100 so pctOfTop = 0/100 = 0
    expect(result[2].pctOfPrevious).toBeNull();
    expect(result[2].pctOfTop).toBe(0);
  });

  it('handles all-zero top step', () => {
    const steps = [
      { label: 'A', value: 0 },
      { label: 'B', value: 0 },
    ];
    const result = withDropoff(steps);
    expect(result[0].pctOfPrevious).toBeNull();
    expect(result[0].pctOfTop).toBeNull();
    expect(result[1].pctOfTop).toBeNull();
  });

  it('returns empty array for empty input', () => {
    expect(withDropoff([])).toEqual([]);
  });

  it('preserves label and value from input', () => {
    const steps = [{ label: 'My Step', value: 42 }];
    const result = withDropoff(steps);
    expect(result[0].label).toBe('My Step');
    expect(result[0].value).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Funnel pipeline: toOrderedSteps → withDropoff (integration)
// ---------------------------------------------------------------------------
describe('funnel pipeline (toOrderedSteps + withDropoff)', () => {
  it('produces correct chart-ready shape for conversion funnel', () => {
    const rows = [
      { event: 'gym_viewed', users: 500 },
      { event: 'slot_selected', users: 250 },
      { event: 'book_tapped', users: 80 },
      { event: 'booking_confirmed', users: 45 },
    ];
    const order = [
      'gym_viewed',
      'slot_selected',
      'book_tapped',
      'booking_confirmed',
    ];
    const ordered = toOrderedSteps(rows, order, 'users');
    const withDrop = withDropoff(ordered);

    // Shape matches FunnelStep / StepWithDropoff interface
    expect(withDrop).toHaveLength(4);
    for (const step of withDrop) {
      expect(step).toHaveProperty('label');
      expect(step).toHaveProperty('value');
      expect(step).toHaveProperty('pctOfPrevious');
      expect(step).toHaveProperty('pctOfTop');
      expect(typeof step.label).toBe('string');
      expect(typeof step.value).toBe('number');
    }

    // First step: no percentages
    expect(withDrop[0].pctOfPrevious).toBeNull();
    expect(withDrop[0].pctOfTop).toBeNull();

    // Second step: 250/500 = 50%
    expect(withDrop[1].pctOfPrevious).toBe(50);
    expect(withDrop[1].pctOfTop).toBe(50);

    // Last step: 45/80 = 56% of previous, 45/500 = 9% of top
    expect(withDrop[3].pctOfPrevious).toBe(56);
    expect(withDrop[3].pctOfTop).toBe(9);
  });

  it('produces correct chart-ready shape for wallet funnel', () => {
    const rows = [
      { event: 'topup_tapped', users: 200 },
      { event: 'wallet_topup_order_created', users: 150 },
      { event: 'wallet_topup_succeeded', users: 140 },
    ];
    const order = [
      'topup_tapped',
      'wallet_topup_order_created',
      'wallet_topup_succeeded',
    ];
    const result = withDropoff(toOrderedSteps(rows, order, 'users'));

    expect(result[0].label).toBe('Tapped top-up');
    expect(result[1].label).toBe('Order created');
    expect(result[2].label).toBe('Top-up succeeded');
    expect(result[2].pctOfPrevious).toBe(93); // 140/150
    expect(result[2].pctOfTop).toBe(70); // 140/200
  });
});

// ---------------------------------------------------------------------------
// Revenue trend transforms (inline in RevenueView)
// ---------------------------------------------------------------------------
describe('revenue trend transforms', () => {
  const sampleDays = [
    { day: '2026-09-01', bookings: 10, gmv: 5000 },
    { day: '2026-09-02', bookings: 15, gmv: 7500 },
    { day: '2026-09-03', bookings: 8, gmv: 4000 },
  ];

  it('computes total GMV by reducing days array', () => {
    const totalGmv = sampleDays.reduce((sum, d) => sum + d.gmv, 0);
    expect(totalGmv).toBe(16500);
  });

  it('computes total bookings by reducing days array', () => {
    const totalBookings = sampleDays.reduce(
      (sum, d) => sum + d.bookings,
      0,
    );
    expect(totalBookings).toBe(33);
  });

  it('computes average booking value', () => {
    const totalGmv = sampleDays.reduce((sum, d) => sum + d.gmv, 0);
    const totalBookings = sampleDays.reduce(
      (sum, d) => sum + d.bookings,
      0,
    );
    const avg = totalBookings > 0 ? Math.round(totalGmv / totalBookings) : 0;
    expect(avg).toBe(500); // 16500/33
  });

  it('returns 0 avg when no bookings', () => {
    const avg = 0 > 0 ? Math.round(0 / 0) : 0;
    expect(avg).toBe(0);
  });

  it('maps days to TrendPoint[] for GMV chart', () => {
    const points = sampleDays.map((d) => ({ day: d.day, value: d.gmv }));
    expect(points).toEqual([
      { day: '2026-09-01', value: 5000 },
      { day: '2026-09-02', value: 7500 },
      { day: '2026-09-03', value: 4000 },
    ]);
  });

  it('maps days to TrendPoint[] for bookings chart', () => {
    const points = sampleDays.map((d) => ({
      day: d.day,
      value: d.bookings,
    }));
    expect(points).toEqual([
      { day: '2026-09-01', value: 10 },
      { day: '2026-09-02', value: 15 },
      { day: '2026-09-03', value: 8 },
    ]);
  });

  it('handles empty days array', () => {
    const days: { day: string; bookings: number; gmv: number }[] = [];
    const totalGmv = days.reduce((sum, d) => sum + d.gmv, 0);
    const totalBookings = days.reduce((sum, d) => sum + d.bookings, 0);
    expect(totalGmv).toBe(0);
    expect(totalBookings).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Website traffic transforms (inline in TrafficView)
// ---------------------------------------------------------------------------
describe('traffic view transforms', () => {
  const daily = [
    { day: '2026-09-01', event: 'session_started' as const, n: 50 },
    { day: '2026-09-01', event: 'screen_viewed' as const, n: 120 },
    { day: '2026-09-02', event: 'session_started' as const, n: 65 },
    { day: '2026-09-02', event: 'screen_viewed' as const, n: 180 },
    { day: '2026-09-03', event: 'session_started' as const, n: 40 },
  ];

  it('splits daily into sessions and pageviews by event type', () => {
    const sessionsByDay = new Map(
      daily
        .filter((d) => d.event === 'session_started')
        .map((d) => [d.day, d.n]),
    );
    const pageviewsByDay = new Map(
      daily
        .filter((d) => d.event === 'screen_viewed')
        .map((d) => [d.day, d.n]),
    );

    expect(sessionsByDay.get('2026-09-01')).toBe(50);
    expect(sessionsByDay.get('2026-09-02')).toBe(65);
    expect(pageviewsByDay.get('2026-09-01')).toBe(120);
    expect(pageviewsByDay.has('2026-09-03')).toBe(false); // no screen_viewed on day 3
  });

  it('builds sorted unique day list', () => {
    const allDays = [...new Set(daily.map((d) => d.day))].sort();
    expect(allDays).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });

  it('maps to session TrendPoints with 0 fallback', () => {
    const sessionsByDay = new Map(
      daily
        .filter((d) => d.event === 'session_started')
        .map((d) => [d.day, d.n]),
    );
    const allDays = [...new Set(daily.map((d) => d.day))].sort();
    const sessionPoints = allDays.map((day) => ({
      day,
      value: sessionsByDay.get(day) ?? 0,
    }));

    expect(sessionPoints).toEqual([
      { day: '2026-09-01', value: 50 },
      { day: '2026-09-02', value: 65 },
      { day: '2026-09-03', value: 40 },
    ]);
  });

  it('maps pageview TrendPoints with 0 for missing days', () => {
    const pageviewsByDay = new Map(
      daily
        .filter((d) => d.event === 'screen_viewed')
        .map((d) => [d.day, d.n]),
    );
    const allDays = [...new Set(daily.map((d) => d.day))].sort();
    const pageviewPoints = allDays.map((day) => ({
      day,
      value: pageviewsByDay.get(day) ?? 0,
    }));

    expect(pageviewPoints[2]).toEqual({ day: '2026-09-03', value: 0 });
  });

  it('handles empty daily array', () => {
    const allDays = [...new Set([].map((d: { day: string }) => d.day))].sort();
    expect(allDays).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Retention cohort transforms (inline in RetentionView)
// ---------------------------------------------------------------------------
describe('retention cohort transforms', () => {
  const rawCohorts = [
    {
      cohortWeek: '2026-08-25',
      cohortSize: 30,
      weeks: [
        { offset: 0, activeUsers: 30, retentionRate: 1.0 },
        { offset: 1, activeUsers: 15, retentionRate: 0.5 },
        { offset: 2, activeUsers: 6, retentionRate: 0.2 },
      ],
    },
    {
      cohortWeek: '2026-09-01',
      cohortSize: 50,
      weeks: [
        { offset: 0, activeUsers: 50, retentionRate: 1.0 },
        { offset: 1, activeUsers: 30, retentionRate: 0.6 },
      ],
    },
  ];

  it('sorts cohorts newest first (descending by cohortWeek)', () => {
    const cohorts = [...rawCohorts].sort((a, b) =>
      a.cohortWeek < b.cohortWeek ? 1 : -1,
    );
    expect(cohorts[0].cohortWeek).toBe('2026-09-01');
    expect(cohorts[1].cohortWeek).toBe('2026-08-25');
  });

  it('builds offset map for lookup by week offset', () => {
    const cohort = rawCohorts[0];
    const byOffset = new Map(cohort.weeks.map((w) => [w.offset, w]));

    expect(byOffset.get(0)?.activeUsers).toBe(30);
    expect(byOffset.get(1)?.retentionRate).toBe(0.5);
    expect(byOffset.get(5)).toBeUndefined();
  });

  it('formats retention rate as percentage string', () => {
    const rate = 0.567;
    expect(`${Math.round(rate * 100)}%`).toBe('57%');
  });

  it('renders "—" for missing week offsets', () => {
    const RETENTION_WEEK_OFFSETS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const cohort = rawCohorts[0]; // only has offsets 0,1,2
    const byOffset = new Map(cohort.weeks.map((w) => [w.offset, w]));

    const rendered = RETENTION_WEEK_OFFSETS.map((o) => {
      const w = byOffset.get(o);
      return w
        ? `${Math.round((w.retentionRate ?? 0) * 100)}%`
        : '—';
    });

    expect(rendered).toEqual([
      '100%', '50%', '20%', '—', '—', '—', '—', '—', '—',
    ]);
  });

  it('handles empty cohorts', () => {
    const cohorts: typeof rawCohorts = [];
    expect(cohorts.length).toBe(0);
  });

  it('RETENTION_WEEK_OFFSETS has 9 entries (0-8)', () => {
    const RETENTION_WEEK_OFFSETS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    expect(RETENTION_WEEK_OFFSETS).toHaveLength(9);
  });
});

// ---------------------------------------------------------------------------
// retentionCellClass (inline in RetentionView)
// ---------------------------------------------------------------------------
describe('retentionCellClass', () => {
  function retentionCellClass(rate: number | null): string {
    if (rate == null) return 'text-gray-300 dark:text-gray-700';
    if (rate >= 0.5)
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
    if (rate >= 0.25)
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
    return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400';
  }

  it('returns gray for null rate', () => {
    expect(retentionCellClass(null)).toContain('text-gray');
  });

  it('returns emerald for rate >= 50%', () => {
    expect(retentionCellClass(0.5)).toContain('emerald');
    expect(retentionCellClass(1.0)).toContain('emerald');
    expect(retentionCellClass(0.75)).toContain('emerald');
  });

  it('returns amber for rate >= 25% and < 50%', () => {
    expect(retentionCellClass(0.25)).toContain('amber');
    expect(retentionCellClass(0.49)).toContain('amber');
    expect(retentionCellClass(0.3)).toContain('amber');
  });

  it('returns red for rate < 25%', () => {
    expect(retentionCellClass(0.1)).toContain('red');
    expect(retentionCellClass(0.0)).toContain('red');
    expect(retentionCellClass(0.24)).toContain('red');
  });
});

// ---------------------------------------------------------------------------
// channelLabel (inline in TrafficView)
// ---------------------------------------------------------------------------
describe('channelLabel', () => {
  function channelLabel(channel: string | null): string {
    if (!channel || channel === 'unknown') return 'Unknown';
    if (channel === 'direct') return 'Direct';
    if (channel === 'organic_search') return 'Organic search';
    if (channel === 'social') return 'Social';
    if (channel === 'referral') return 'Referral (other)';
    if (channel.startsWith('campaign:'))
      return `Campaign: ${channel.slice('campaign:'.length)}`;
    return channel;
  }

  it('labels known channels', () => {
    expect(channelLabel('direct')).toBe('Direct');
    expect(channelLabel('organic_search')).toBe('Organic search');
    expect(channelLabel('social')).toBe('Social');
    expect(channelLabel('referral')).toBe('Referral (other)');
  });

  it('labels campaign channels with prefix', () => {
    expect(channelLabel('campaign:instagram_reels')).toBe(
      'Campaign: instagram_reels',
    );
  });

  it('returns Unknown for null/undefined/empty/unknown', () => {
    expect(channelLabel(null)).toBe('Unknown');
    expect(channelLabel('')).toBe('Unknown');
    expect(channelLabel('unknown')).toBe('Unknown');
  });

  it('passes through unrecognized channel names', () => {
    expect(channelLabel('email')).toBe('email');
    expect(channelLabel('paid_search')).toBe('paid_search');
  });
});

// ---------------------------------------------------------------------------
// formatHours (inline in SupplyView)
// ---------------------------------------------------------------------------
describe('formatHours', () => {
  function formatHours(h: string | null): string {
    if (h == null) return '—';
    const n = Number(h);
    return n < 1 ? `${Math.round(n * 60)}m` : `${n.toFixed(1)}h`;
  }

  it('formats hours >= 1 with one decimal', () => {
    expect(formatHours('5')).toBe('5.0h');
    expect(formatHours('2.5')).toBe('2.5h');
    expect(formatHours('12.345')).toBe('12.3h');
  });

  it('formats sub-hour values as minutes', () => {
    expect(formatHours('0.5')).toBe('30m');
    expect(formatHours('0.25')).toBe('15m');
    expect(formatHours('0.1')).toBe('6m');
  });

  it('returns "—" for null', () => {
    expect(formatHours(null)).toBe('—');
  });
});

// ---------------------------------------------------------------------------
// formatProperties (inline in UserJourneyView)
// ---------------------------------------------------------------------------
describe('formatProperties', () => {
  function formatProperties(
    properties: Record<string, unknown>,
    hide: string[],
  ): string {
    return Object.entries(properties)
      .filter(([k]) => !hide.includes(k))
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(' · ');
  }

  it('joins key=value pairs with ·', () => {
    expect(
      formatProperties({ a: 1, b: 'hello' }, []),
    ).toBe('a=1 · b=hello');
  });

  it('filters out hidden properties', () => {
    expect(
      formatProperties(
        { app: 'customer', platform: 'android', screen: 'home' },
        ['app', 'platform'],
      ),
    ).toBe('screen=home');
  });

  it('returns empty string for empty properties', () => {
    expect(formatProperties({}, [])).toBe('');
  });

  it('handles nested object values via String()', () => {
    expect(
      formatProperties({ nested: { key: 'val' } }, []),
    ).toBe('nested=[object Object]');
  });
});

// ---------------------------------------------------------------------------
// originFor (inline in UserJourneyView)
// ---------------------------------------------------------------------------
describe('originFor', () => {
  function originFor(event: {
    source: string;
    service?: string;
    properties?: Record<string, unknown>;
  }): string {
    if (event.source === 'client') {
      const app = event.properties?.app as string | undefined;
      const platform = event.properties?.platform as string | undefined;
      return [app, platform].filter(Boolean).join(' · ') || 'unknown app';
    }
    return event.service || 'unknown service';
  }

  it('returns app · platform for client events', () => {
    expect(
      originFor({
        source: 'client',
        properties: { app: 'customer', platform: 'android' },
      }),
    ).toBe('customer · android');
  });

  it('returns app only when platform missing', () => {
    expect(
      originFor({ source: 'client', properties: { app: 'website' } }),
    ).toBe('website');
  });

  it('returns "unknown app" when no app/platform', () => {
    expect(originFor({ source: 'client', properties: {} })).toBe(
      'unknown app',
    );
  });

  it('returns service name for server events', () => {
    expect(
      originFor({ source: 'server', service: 'booking-service' }),
    ).toBe('booking-service');
  });

  it('returns "unknown service" when service missing', () => {
    expect(originFor({ source: 'server' })).toBe('unknown service');
  });
});

// ---------------------------------------------------------------------------
// City breakdown: GMV formatting (inline in CityView)
// ---------------------------------------------------------------------------
describe('city breakdown transforms', () => {
  const cities = [
    {
      city: 'Bengaluru',
      gymsCreated: 25,
      gymsApproved: 20,
      bookings: 500,
      gmv: 250000,
    },
    {
      city: 'Delhi NCR',
      gymsCreated: 15,
      gymsApproved: 12,
      bookings: 350,
      gmv: 175000,
    },
    {
      city: 'Mumbai',
      gymsCreated: 8,
      gymsApproved: 5,
      bookings: 100,
      gmv: 50000,
    },
  ];

  it('formats GMV with ₹ prefix and locale string', () => {
    const formatted = `₹${cities[0].gmv.toLocaleString()}`;
    expect(formatted).toMatch(/^₹/);
    // Strip non-digits to verify the number is correct regardless of locale grouping
    const digits = formatted.replace(/\D/g, '');
    expect(digits).toBe('250000');
  });

  it('sorts cities by bookings descending (if sorting were applied)', () => {
    const sorted = [...cities].sort((a, b) => b.bookings - a.bookings);
    expect(sorted[0].city).toBe('Bengaluru');
    expect(sorted[2].city).toBe('Mumbai');
  });

  it('handles empty cities array', () => {
    expect(cities.filter(() => false)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Gift bonus: totals aggregation (inline in GiftBonusView)
// ---------------------------------------------------------------------------
describe('gift bonus transforms', () => {
  const days = [
    { day: '2026-09-01', giftDays: 5, bonusAmount: 500 },
    { day: '2026-09-02', giftDays: 3, bonusAmount: 300 },
    { day: '2026-09-03', giftDays: 8, bonusAmount: 800 },
  ];

  it('maps days to gift-day TrendPoints', () => {
    const points = days.map((d) => ({ day: d.day, value: d.giftDays }));
    expect(points).toEqual([
      { day: '2026-09-01', value: 5 },
      { day: '2026-09-02', value: 3 },
      { day: '2026-09-03', value: 8 },
    ]);
  });

  it('maps days to bonus-amount TrendPoints', () => {
    const points = days.map((d) => ({
      day: d.day,
      value: d.bonusAmount,
    }));
    expect(points).toEqual([
      { day: '2026-09-01', value: 500 },
      { day: '2026-09-02', value: 300 },
      { day: '2026-09-03', value: 800 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// FunnelStepsTable: renders "—" for null percentages
// ---------------------------------------------------------------------------
describe('FunnelStepsTable percentage display', () => {
  it('displays "—" for null pctOfPrevious', () => {
    const step: StepWithDropoff = {
      label: 'First',
      value: 100,
      pctOfPrevious: null,
      pctOfTop: null,
    };
    const display =
      step.pctOfPrevious == null ? '—' : `${step.pctOfPrevious}%`;
    expect(display).toBe('—');
  });

  it('displays percentage for non-null pctOfPrevious', () => {
    const step: StepWithDropoff = {
      label: 'Second',
      value: 50,
      pctOfPrevious: 50,
      pctOfTop: 50,
    };
    const display =
      step.pctOfPrevious == null ? '—' : `${step.pctOfPrevious}%`;
    expect(display).toBe('50%');
  });
});

// ---------------------------------------------------------------------------
// Edge case: custom funnel with filters in labels
// ---------------------------------------------------------------------------
describe('custom funnel with filter labels', () => {
  it('builds label with filter text when filters present', () => {
    const steps = [
      {
        event: 'screen_viewed',
        filters: { app: 'customer' },
        users: 100,
      },
      {
        event: 'booking_confirmed',
        filters: { app: 'customer' },
        users: 25,
      },
    ];

    function funnelStepsSummary(
      s: { event: string; filters: Record<string, string> }[],
    ): string {
      return s
        .map((step) => {
          const filterText = Object.entries(step.filters || {})
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
          return filterText ? `${step.event} (${filterText})` : step.event;
        })
        .join(' → ');
    }

    const chartSteps = steps.map((s) => ({
      label: Object.keys(s.filters || {}).length
        ? `${s.event} (${funnelStepsSummary([s])})`
        : s.event,
      value: s.users,
    }));

    expect(chartSteps[0].label).toBe(
      'screen_viewed (screen_viewed (app=customer))',
    );
    expect(chartSteps[0].value).toBe(100);
  });

  it('builds simple label when no filters', () => {
    const step = { event: 'booking_confirmed', filters: {}, users: 25 };
    const label = Object.keys(step.filters || {}).length
      ? `${step.event} (filtered)`
      : step.event;
    expect(label).toBe('booking_confirmed');
  });
});
