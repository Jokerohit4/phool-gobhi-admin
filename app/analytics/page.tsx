import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FunnelBarChart } from '@/components/charts/FunnelBarChart';
import { FunnelStepsTable } from '@/components/charts/FunnelStepsTable';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { StatTile } from '@/components/charts/StatTile';
import { SectionHeading } from '@/components/charts/SectionHeading';
import { toOrderedSteps, withDropoff, labelFor } from '@/lib/analyticsLabels';
import { formatDateIST, formatDateTimeIST } from '@/lib/dateFormat';

interface EventCountRow {
  event: string;
  users?: number;
  n?: number;
  distinct_users?: number;
}

interface OnboardingFunnelData {
  stepCounts: EventCountRow[];
  byStep: { step: string | null; completions: number }[];
  weeklyApprovals: { week: string; approvals: number }[];
  runRatePerWeek: number;
}

interface ApprovalSlaData {
  gyms: {
    gym_id: string;
    created_ts: string;
    resolved_ts: string | null;
    outcome: string | null;
    hours_to_resolve: string | null;
  }[];
  medianHoursToResolve: number | null;
}

interface ConversionFunnelData {
  steps: EventCountRow[];
  failuresByReason: { reason: string | null; n: number }[];
}

interface FulfillmentFunnelData {
  steps: EventCountRow[];
  byMethod: { method: string | null; n: number }[];
}

interface SimpleFunnelData {
  steps: EventCountRow[];
}

interface SupplyHealthData {
  gyms: {
    gym_id: string;
    approved_ts: string;
    city: string | null;
    booking_count: number;
    last_booking_ts: string | null;
  }[];
}

interface CityBreakdownData {
  cities: { city: string; gymsCreated: number; gymsApproved: number; bookings: number; gmv: number }[];
}

interface RevenueTrendData {
  days: { day: string; bookings: number; gmv: number }[];
}

interface RetentionCohort {
  cohortWeek: string;
  cohortSize: number;
  weeks: { offset: number; activeUsers: number; retentionRate: number | null }[];
}

interface RetentionCohortsData {
  cohorts: RetentionCohort[];
}

interface GiftBonusPayoutsData {
  days: { day: string; giftDays: number; bonusAmount: number }[];
  totalGiftDays: number;
  totalBonusAmount: number;
  bonusCount: number;
  closedOutCount: number;
}

interface JourneyEvent {
  event: string;
  properties: Record<string, unknown>;
  source: 'server' | 'client';
  service: string;
  ts: string;
}

interface UserJourneyData {
  events: JourneyEvent[];
  summary: {
    totalEvents: number;
    firstSeen: string | null;
    lastSeen: string | null;
    apps: string[];
    services: string[];
    sessionCount: number;
  };
  profile: { name: string | null; phone: string | null; role: string | null; type: string | null } | null;
}

const VIEWS = ['supply', 'conversion', 'fulfillment', 'activation', 'wallet', 'buddy', 'city', 'revenue', 'retention', 'giftBonus', 'user'] as const;
type View = (typeof VIEWS)[number];

function isView(value: string | undefined): value is View {
  return VIEWS.includes(value as View);
}

const VIEW_LABELS: Record<View, string> = {
  supply: 'Supply',
  conversion: 'Conversion',
  fulfillment: 'Fulfillment',
  activation: 'Activation',
  wallet: 'Wallet',
  buddy: 'Buddy',
  city: 'By City',
  revenue: 'Revenue',
  retention: 'Retention',
  giftBonus: 'Gift & Bonus Payouts',
  user: 'User Journey',
};

// Grouped for the tab bar so 9 tabs read as three questions ("how's supply
// doing / how's revenue shaped / who is this person") rather than one flat
// undifferentiated row.
const VIEW_GROUPS: { label: string; views: View[] }[] = [
  { label: 'Funnels', views: ['supply', 'conversion', 'fulfillment', 'activation', 'wallet', 'buddy'] },
  { label: 'Breakdowns', views: ['city', 'revenue', 'retention', 'giftBonus'] },
  { label: 'Lookup', views: ['user'] },
];

// Client events carry the app they came from (customer/partner/website) plus
// platform (android/ios/web) in properties — the only place that lives, since
// it's set by each app's own analytics_service.dart / AnalyticsBootstrap, not
// derivable from the event name. Server events have no client app context at
// all (a server never knows which app triggered it), so the closest "origin"
// there is which backend service emitted the truth event.
// Postgres jsonb doesn't preserve insertion order (it reorders keys, shortest
// first), so a long user_agent string can land before the property that
// actually says what happened (e.g. screen_viewed's screen_name) and eat the
// whole truncated row width, leaving that row looking blank. ip is worse than
// noisy: for web traffic it's the BFF's own serverless egress address, not
// the visitor's, so it flaps between requests and isn't a real signal at all.
// Both are dropped from the inline summary (still available via the row's
// title tooltip) so whatever the event's real payload is stays visible.
const HIDDEN_INLINE_PROPS = ['app', 'platform', 'session_id', 'ip', 'user_agent'];

function formatProperties(properties: Record<string, unknown>, hide: string[]): string {
  return Object.entries(properties)
    .filter(([k]) => !hide.includes(k))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(' · ');
}

function originFor(event: JourneyEvent): string {
  if (event.source === 'client') {
    const app = event.properties?.app as string | undefined;
    const platform = event.properties?.platform as string | undefined;
    return [app, platform].filter(Boolean).join(' · ') || 'unknown app';
  }
  return event.service || 'unknown service';
}

function formatHours(h: string | null): string {
  if (h == null) return '—';
  const n = Number(h);
  return n < 1 ? `${Math.round(n * 60)}m` : `${n.toFixed(1)}h`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; days?: string; distinctId?: string }>;
}) {
  await requireSession();
  const { view: rawView, days: rawDays, distinctId } = await searchParams;
  const view: View = isView(rawView) ? rawView : 'supply';
  const days = rawDays && Number(rawDays) > 0 ? rawDays : '30';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Analytics"
        subtitle="Funnels computed live from analytics_events — see phool-gobhi-backend/docs/ANALYTICS.md for the event dictionary."
      />

      <div className="flex flex-wrap items-start justify-between gap-y-2 border-b border-gray-200 pb-3 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {VIEW_GROUPS.map((group, i) => (
            <div key={group.label} className={`flex items-center gap-x-3 ${i > 0 ? 'border-l border-gray-200 pl-5 dark:border-gray-800' : ''}`}>
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{group.label}</span>
              <div className="flex flex-wrap gap-1">
                {group.views.map((v) => (
                  <Link
                    key={v}
                    href={`/analytics?view=${v}&days=${days}`}
                    className={`rounded px-2.5 py-1 text-sm transition-colors ${
                      v === view
                        ? 'bg-emerald-600 font-medium text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                  >
                    {VIEW_LABELS[v]}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        {view !== 'user' && view !== 'retention' && (
          <div className="flex gap-1">
            {['7', '30', '90'].map((d) => (
              <Link
                key={d}
                href={`/analytics?view=${view}&days=${d}`}
                className={`rounded px-2.5 py-1 text-sm transition-colors ${
                  d === days
                    ? 'bg-gray-800 font-medium text-white dark:bg-gray-200 dark:text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                {d}d
              </Link>
            ))}
          </div>
        )}
      </div>

      {view === 'supply' && <SupplyView days={days} />}
      {view === 'conversion' && <ConversionView days={days} />}
      {view === 'fulfillment' && <FulfillmentView days={days} />}
      {view === 'activation' && <ActivationView days={days} />}
      {view === 'wallet' && <WalletView days={days} />}
      {view === 'buddy' && <BuddyView days={days} />}
      {view === 'city' && <CityView days={days} />}
      {view === 'revenue' && <RevenueView days={days} />}
      {view === 'retention' && <RetentionView />}
      {view === 'giftBonus' && <GiftBonusView days={days} />}
      {view === 'user' && <UserJourneyView distinctId={distinctId} />}
    </div>
  );
}

async function SupplyView({ days }: { days: string }) {
  const [{ data: funnel }, { data: sla }, { data: health }] = await Promise.all([
    gatewayJson<{ data: OnboardingFunnelData }>(`/api/bookings/admin/analytics/onboarding-funnel?days=${days}`),
    gatewayJson<{ data: ApprovalSlaData }>(`/api/bookings/admin/analytics/approval-sla?days=${days}`),
    gatewayJson<{ data: SupplyHealthData }>(`/api/bookings/admin/analytics/supply-health`),
  ]);

  const steps = withDropoff(
    toOrderedSteps(
      funnel.stepCounts,
      ['onboarding_started', 'onboarding_step_completed', 'gym_created', 'gym_approved', 'gym_rejected'],
      'users',
    ),
  );
  const deadWeight = health.gyms.filter((g) => g.booking_count === 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile
          label="Approval run-rate"
          value={`${funnel.runRatePerWeek}/week`}
          hint="trailing 4-week average — a trend, not a forecast model"
        />
        <StatTile label="Median time to resolve" value={formatHours(String(sla.medianHoursToResolve ?? ''))} />
        <StatTile
          label="Approved, zero bookings (7+ days)"
          value={deadWeight.length}
          status={deadWeight.length > 0 ? 'warning' : 'default'}
        />
      </div>

      <Card>
        <SectionHeading title="Onboarding → approval funnel" />
        <FunnelBarChart steps={steps} />
        <div className="mt-3">
          <FunnelStepsTable steps={steps} />
        </div>
      </Card>

      <Card>
        <SectionHeading
          title="Supply health"
          subtitle="Approved gyms with little or no real activity — the bottleneck isn't just approval count, it's active supply"
        />
        <Table>
          <Thead>
            <Th>Gym</Th>
            <Th>City</Th>
            <Th>Approved</Th>
            <Th>Bookings</Th>
            <Th>Last booking</Th>
          </Thead>
          <tbody>
            {health.gyms.map((g) => (
              <Tr key={g.gym_id}>
                <Td>
                  <Link href={`/gyms/${g.gym_id}`} className="underline">
                    Gym #{g.gym_id}
                  </Link>
                </Td>
                <Td>{g.city ?? '—'}</Td>
                <Td>{formatDateIST(g.approved_ts)}</Td>
                <Td className="tabular-nums">
                  {g.booking_count === 0 ? (
                    <span className="flex items-center gap-2">
                      <span className="font-medium">0</span>
                      <StatusBadge tone="pending">no bookings yet</StatusBadge>
                    </span>
                  ) : (
                    g.booking_count
                  )}
                </Td>
                <Td>{g.last_booking_ts ? formatDateIST(g.last_booking_ts) : 'Never'}</Td>
              </Tr>
            ))}
            {health.gyms.length === 0 && <EmptyRow colSpan={5}>No gyms approved more than 7 days ago yet.</EmptyRow>}
          </tbody>
        </Table>
      </Card>

      {funnel.byStep.length > 0 && (
        <Card>
          <SectionHeading title="Step completions" subtitle="onboarding_step_completed, by step number" />
          <Table>
            <Thead>
              <Th>Step</Th>
              <Th>Completions</Th>
            </Thead>
            <tbody>
              {funnel.byStep.map((row) => (
                <Tr key={row.step ?? 'unknown'}>
                  <Td>{row.step ?? '—'}</Td>
                  <Td>{row.completions}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <SectionHeading title="Approval SLA by gym" subtitle="Most recently submitted first" />
        <Table>
          <Thead>
            <Th>Gym</Th>
            <Th>Submitted</Th>
            <Th>Resolved</Th>
            <Th>Outcome</Th>
            <Th>Time to resolve</Th>
          </Thead>
          <tbody>
            {sla.gyms.map((g) => (
              <Tr key={g.gym_id}>
                <Td>
                  <Link href={`/gyms/${g.gym_id}`} className="underline">
                    Gym #{g.gym_id}
                  </Link>
                </Td>
                <Td>{formatDateTimeIST(g.created_ts)}</Td>
                <Td>{g.resolved_ts ? formatDateTimeIST(g.resolved_ts) : '—'}</Td>
                <Td>
                  <StatusBadge tone={g.outcome === 'gym_approved' ? 'approved' : g.outcome === 'gym_rejected' ? 'rejected' : 'pending'}>
                    {g.outcome ? labelFor(g.outcome) : 'Pending'}
                  </StatusBadge>
                </Td>
                <Td>{formatHours(g.hours_to_resolve)}</Td>
              </Tr>
            ))}
            {sla.gyms.length === 0 && <EmptyRow colSpan={5}>No gyms submitted in this window.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

async function ConversionView({ days }: { days: string }) {
  const { data } = await gatewayJson<{ data: ConversionFunnelData }>(
    `/api/bookings/admin/analytics/conversion-funnel?days=${days}`,
  );
  const steps = withDropoff(
    toOrderedSteps(data.steps, ['gym_viewed', 'slot_selected', 'book_tapped', 'booking_confirmed'], 'users'),
  );

  return (
    <>
      <Card>
        <SectionHeading title="Booking conversion funnel" />
        <FunnelBarChart steps={steps} />
        <div className="mt-3">
          <FunnelStepsTable steps={steps} />
        </div>
      </Card>
      <Card>
        <SectionHeading title="Failed bookings by reason" />
        <Table>
          <Thead>
            <Th>Reason</Th>
            <Th>Count</Th>
          </Thead>
          <tbody>
            {data.failuresByReason.map((r) => (
              <Tr key={r.reason ?? 'unknown'}>
                <Td>{r.reason ?? 'unknown'}</Td>
                <Td>{r.n}</Td>
              </Tr>
            ))}
            {data.failuresByReason.length === 0 && <EmptyRow colSpan={2}>No failures in this window.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

async function FulfillmentView({ days }: { days: string }) {
  const { data } = await gatewayJson<{ data: FulfillmentFunnelData }>(
    `/api/bookings/admin/analytics/fulfillment-funnel?days=${days}`,
  );
  const steps = withDropoff(
    toOrderedSteps(
      data.steps,
      ['booking_confirmed', 'checkin_requested', 'attendance_verified', 'booking_completed'],
      'users',
    ),
  );

  return (
    <>
      <Card>
        <SectionHeading title="Fulfillment funnel" subtitle="Confirmed → checked in → attendance verified → completed" />
        <FunnelBarChart steps={steps} />
        <div className="mt-3">
          <FunnelStepsTable steps={steps} />
        </div>
      </Card>
      <Card>
        <SectionHeading title="Attendance verification method" />
        <Table>
          <Thead>
            <Th>Method</Th>
            <Th>Count</Th>
          </Thead>
          <tbody>
            {data.byMethod.map((r) => (
              <Tr key={r.method ?? 'unknown'}>
                <Td>{r.method === 'qr_scan' ? 'Partner QR scan' : r.method === 'qr_geofence_self' ? 'Customer self-check-in' : (r.method ?? 'unknown')}</Td>
                <Td>{r.n}</Td>
              </Tr>
            ))}
            {data.byMethod.length === 0 && <EmptyRow colSpan={2}>No verified attendance in this window.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

async function ActivationView({ days }: { days: string }) {
  const { data } = await gatewayJson<{ data: SimpleFunnelData }>(`/api/bookings/admin/analytics/activation?days=${days}`);
  const steps = toOrderedSteps(
    data.steps,
    ['otp_requested', 'otp_submitted', 'signup_completed', 'login_completed'],
    'distinct_users',
  );

  return (
    <Card>
      <SectionHeading title="Activation" subtitle="Signup is new users; login is returning users — both follow the same OTP steps" />
      <FunnelBarChart steps={steps} />
    </Card>
  );
}

async function WalletView({ days }: { days: string }) {
  const { data } = await gatewayJson<{ data: SimpleFunnelData }>(`/api/bookings/admin/analytics/wallet-funnel?days=${days}`);
  const steps = withDropoff(
    toOrderedSteps(data.steps, ['topup_tapped', 'wallet_topup_order_created', 'wallet_topup_succeeded'], 'users'),
  );
  const failed = data.steps.find((s) => s.event === 'wallet_topup_failed');

  return (
    <>
      <Card>
        <SectionHeading title="Wallet top-up funnel" />
        <FunnelBarChart steps={steps} />
        <div className="mt-3">
          <FunnelStepsTable steps={steps} />
        </div>
      </Card>
      {failed && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatTile label="Failed top-ups" value={failed.users ?? 0} status={(failed.users ?? 0) > 0 ? 'warning' : 'default'} />
        </div>
      )}
    </>
  );
}

async function BuddyView({ days }: { days: string }) {
  const { data } = await gatewayJson<{ data: SimpleFunnelData }>(`/api/bookings/admin/analytics/buddy-funnel?days=${days}`);
  const steps = withDropoff(
    toOrderedSteps(data.steps, ['buddy_profile_created', 'buddy_swiped', 'buddy_matched', 'buddy_message_sent'], 'users'),
  );
  const unmatched = data.steps.find((s) => s.event === 'buddy_unmatched')?.users ?? 0;
  const blocked = data.steps.find((s) => s.event === 'buddy_blocked')?.users ?? 0;

  return (
    <>
      <Card>
        <SectionHeading title="Buddy engagement funnel" subtitle="Not yet in docs/ANALYTICS.md's original funnel list — added here first" />
        <FunnelBarChart steps={steps} />
        <div className="mt-3">
          <FunnelStepsTable steps={steps} />
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Unmatched" value={unmatched} />
        <StatTile label="Blocked" value={blocked} />
      </div>
    </>
  );
}

async function CityView({ days }: { days: string }) {
  const { data } = await gatewayJson<{ data: CityBreakdownData }>(`/api/bookings/admin/analytics/city-breakdown?days=${days}`);

  return (
    <Card>
      <SectionHeading title="By city" subtitle="Gym supply and booking activity, side by side — no city should have one without the other" />
      <Table>
        <Thead>
          <Th>City</Th>
          <Th>Gyms submitted</Th>
          <Th>Gyms approved</Th>
          <Th>Bookings</Th>
          <Th>GMV</Th>
        </Thead>
        <tbody>
          {data.cities.map((c) => (
            <Tr key={c.city}>
              <Td>{c.city}</Td>
              <Td className="tabular-nums">{c.gymsCreated}</Td>
              <Td className="tabular-nums">{c.gymsApproved}</Td>
              <Td className="tabular-nums">{c.bookings}</Td>
              <Td className="tabular-nums">₹{c.gmv.toLocaleString()}</Td>
            </Tr>
          ))}
          {data.cities.length === 0 && <EmptyRow colSpan={5}>No gym or booking activity in this window.</EmptyRow>}
        </tbody>
      </Table>
    </Card>
  );
}

async function RevenueView({ days }: { days: string }) {
  const { data } = await gatewayJson<{ data: RevenueTrendData }>(`/api/bookings/admin/analytics/revenue-trend?days=${days}`);
  const totalGmv = data.days.reduce((sum, d) => sum + d.gmv, 0);
  const totalBookings = data.days.reduce((sum, d) => sum + d.bookings, 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Total GMV" value={`₹${totalGmv.toLocaleString()}`} />
        <StatTile label="Total bookings" value={totalBookings} />
        <StatTile
          label="Avg. booking value"
          value={`₹${totalBookings > 0 ? Math.round(totalGmv / totalBookings).toLocaleString() : 0}`}
        />
      </div>
      <Card>
        <SectionHeading title="GMV per day" />
        <TrendLineChart
          points={data.days.map((d) => ({ day: d.day, value: d.gmv }))}
          valueFormat="currency"
        />
      </Card>
      <Card>
        <SectionHeading title="Bookings per day" />
        <TrendLineChart points={data.days.map((d) => ({ day: d.day, value: d.bookings }))} />
      </Card>
    </>
  );
}

async function GiftBonusView({ days }: { days: string }) {
  // wallet-service, not booking-service — it owns GymSubscription/the wallet
  // credits, unlike every other view above (all booking-service).
  const { data } = await gatewayJson<{ data: GiftBonusPayoutsData }>(`/api/wallet/admin/analytics/gift-bonus-payouts?days=${days}`);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Plans closed out" value={data.closedOutCount} />
        <StatTile label="Gift days granted" value={data.totalGiftDays} />
        <StatTile label="Bonuses paid" value={data.bonusCount} />
        <StatTile label="Bonus ₹ paid" value={`₹${data.totalBonusAmount.toLocaleString()}`} />
      </div>
      <Card>
        <SectionHeading
          title="Gift days granted per day"
          subtitle="Self-funded from each subscription's own missed-day breakage — capped so this can never exceed what that plan already collected"
        />
        <TrendLineChart points={data.days.map((d) => ({ day: d.day, value: d.giftDays }))} />
      </Card>
      <Card>
        <SectionHeading
          title="Attendance bonus ₹ paid per day"
          subtitle="Real cost with no funding offset — most visible on 100%-attendance weekly plans, where there's no missed-day breakage to draw from"
        />
        <TrendLineChart
          points={data.days.map((d) => ({ day: d.day, value: d.bonusAmount }))}
          valueFormat="currency"
        />
      </Card>
    </>
  );
}

const RETENTION_WEEK_OFFSETS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

function retentionCellClass(rate: number | null): string {
  if (rate == null) return 'text-gray-300 dark:text-gray-700';
  if (rate >= 0.5) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
  if (rate >= 0.25) return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
  return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400';
}

async function RetentionView() {
  const { data } = await gatewayJson<{ data: RetentionCohortsData }>('/api/bookings/admin/analytics/retention?weeks=12');
  // Newest cohort first — the most recent weeks are what a founder watching a
  // just-launched cohort actually cares about checking day to day.
  const cohorts = [...data.cohorts].sort((a, b) => (a.cohortWeek < b.cohortWeek ? 1 : -1));

  return (
    <Card>
      <SectionHeading
        title="Weekly booking retention"
        subtitle="Of customers whose first booking landed in a given week, what share booked again N weeks later — a funnel can look healthy while this leaks"
      />
      {cohorts.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No booking_confirmed events yet in the analytics store.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="whitespace-nowrap px-2 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                  Cohort week
                </th>
                <th className="whitespace-nowrap px-2 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                  Size
                </th>
                {RETENTION_WEEK_OFFSETS.map((o) => (
                  <th key={o} className="whitespace-nowrap px-2 py-1.5 text-center text-xs font-medium uppercase tracking-wide text-gray-400">
                    Week {o}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => {
                const byOffset = new Map(c.weeks.map((w) => [w.offset, w]));
                return (
                  <tr key={c.cohortWeek} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="whitespace-nowrap px-2 py-1.5">{formatDateIST(c.cohortWeek)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{c.cohortSize}</td>
                    {RETENTION_WEEK_OFFSETS.map((o) => {
                      const w = byOffset.get(o);
                      return (
                        <td key={o} className={`whitespace-nowrap px-2 py-1.5 text-center tabular-nums ${retentionCellClass(w?.retentionRate ?? null)}`}>
                          {w ? `${Math.round((w.retentionRate ?? 0) * 100)}%` : '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

async function UserJourneyView({ distinctId }: { distinctId?: string }) {
  return (
    <>
      <Card>
        <form action="/analytics" method="get" className="flex gap-2">
          <input type="hidden" name="view" value="user" />
          <input
            type="text"
            name="distinctId"
            defaultValue={distinctId ?? ''}
            placeholder="Phone number, User ID (e.g. 9), or anon_... id"
            className="flex-1 rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <button type="submit" className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
            Look up
          </button>
        </form>
      </Card>
      {distinctId && <UserJourneyResults distinctId={distinctId} />}
    </>
  );
}

async function UserJourneyResults({ distinctId }: { distinctId: string }) {
  let data: UserJourneyData;
  try {
    ({ data } = await gatewayJson<{ data: UserJourneyData }>(
      `/api/bookings/admin/analytics/user-journey?distinctId=${encodeURIComponent(distinctId)}&days=365`,
    ));
  } catch (err) {
    return (
      <Card>
        <div className="text-sm text-red-600">
          {err instanceof Error ? err.message : `Couldn't load a journey for "${distinctId}".`}
        </div>
      </Card>
    );
  }

  if (data.summary.totalEvents === 0) {
    return (
      <Card>
        <div className="text-sm text-gray-500">No events found for &ldquo;{distinctId}&rdquo; in the last year.</div>
      </Card>
    );
  }

  // Detect session boundaries: a divider whenever a client event's session_id
  // differs from the last one seen. Server events carry no session_id and
  // render inline without resetting this — they aren't part of any app
  // session, they're just truth events that happened at that point in time.
  let lastSessionId: string | null = null;
  const rows: { boundary?: string; event: JourneyEvent }[] = [];
  for (const event of data.events) {
    const sid = (event.properties?.session_id as string | undefined) ?? null;
    if (sid && sid !== lastSessionId) {
      rows.push({ boundary: `Session started — ${formatDateTimeIST(event.ts)}`, event });
      lastSessionId = sid;
    } else {
      rows.push({ event });
    }
  }

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-lg font-semibold">
              {data.profile?.name || 'Unknown identity'}
              {data.profile?.phone && <span className="ml-2 text-sm text-gray-500">{data.profile.phone}</span>}
            </div>
            <div className="text-xs text-gray-500">distinct_id: {distinctId}</div>
          </div>
          <div className="ml-auto grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <span className="text-gray-500">Events</span> <span className="font-medium">{data.summary.totalEvents}</span>
            </div>
            <div>
              <span className="text-gray-500">Sessions</span> <span className="font-medium">{data.summary.sessionCount}</span>
            </div>
            <div>
              <span className="text-gray-500">First seen</span>{' '}
              <span className="font-medium">{data.summary.firstSeen ? formatDateIST(data.summary.firstSeen) : '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">Last seen</span>{' '}
              <span className="font-medium">{data.summary.lastSeen ? formatDateIST(data.summary.lastSeen) : '—'}</span>
            </div>
          </div>
        </div>
        {(data.summary.apps.length > 0 || data.summary.services.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.summary.apps.map((a) => (
              <span
                key={a}
                className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
              >
                {a}
              </span>
            ))}
            {data.summary.services.map((s) => (
              <span key={s} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {s}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeading title="Timeline" subtitle="Client taps and server truth events, interleaved chronologically. Times shown in IST." />
        <div className="flex flex-col gap-1">
          {rows.map((row, i) => (
            <div key={i}>
              {row.boundary && (
                <div className="mb-1 mt-3 border-t pt-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-gray-800">
                  {row.boundary}
                </div>
              )}
              <div className="flex items-start gap-3 rounded px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <span className="w-36 shrink-0 font-mono text-xs text-gray-400">{formatDateTimeIST(row.event.ts)}</span>
                <span
                  className={`w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium ${
                    row.event.source === 'server'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {row.event.source}
                </span>
                <span className="w-32 shrink-0 truncate rounded-full bg-gray-100 px-2 py-0.5 text-center text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {originFor(row.event)}
                </span>
                <span className="font-medium">{labelFor(row.event.event)}</span>
                <span
                  className="truncate text-xs text-gray-400"
                  title={formatProperties(row.event.properties, ['app', 'platform', 'session_id'])}
                >
                  {formatProperties(row.event.properties, HIDDEN_INLINE_PROPS)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
