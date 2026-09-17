import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { formatDateTimeIST, formatDateIST } from '@/lib/dateFormat';

interface GymLite {
  id: number;
  name: string;
  city: string;
}

interface LiveSession {
  id: number;
  gymId: number;
  customerId: number;
  customerName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  attendedAt: string;
  attendanceMethod: string | null;
}

interface LiveOccupancy {
  totalActive: number;
  byGym: { gymId: number; count: number }[];
  sessions: LiveSession[];
}

interface HeatmapCell {
  date: string;
  hour: number;
  count: number;
}

interface WeekdayHourCell {
  weekday: number;
  hour: number;
  count: number;
}

interface Heatmap {
  days: number;
  cells: HeatmapCell[];
  weekdayHourPattern: WeekdayHourCell[];
}

interface TopGym {
  gymId: number;
  revenue: number;
  completedBookings: number;
  attendanceCount: number;
}

interface TopGymsResponse {
  days: number;
  gyms: TopGym[];
}

const TABS = ['live', 'heatmap', 'leaderboard'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { live: 'Live Now', heatmap: 'Heatmap', leaderboard: 'Leaderboard' };

const DAY_OPTIONS = [7, 30, 90];
const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const METHOD_LABEL: Record<string, string> = {
  qr_scan: 'QR scan',
  qr_geofence_self: 'Self check-in',
  manual_verify: 'Manual verify',
  manual_override: 'Manual override',
};

function formatRupees(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function isTab(value: string | undefined): value is Tab {
  return TABS.includes(value as Tab);
}

function gymLabel(gymId: number, gymsById: Map<number, GymLite>) {
  const gym = gymsById.get(gymId);
  return gym ? `${gym.name} (${gym.city})` : `Gym #${gymId}`;
}

export default async function LiveTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; gymId?: string; days?: string }>;
}) {
  await requireSession();
  const { tab: rawTab, gymId: rawGymId, days: rawDays } = await searchParams;
  const tab: Tab = isTab(rawTab) ? rawTab : 'live';
  const days = DAY_OPTIONS.includes(Number(rawDays)) ? Number(rawDays) : 30;
  const gymIdFilter = rawGymId ? Number(rawGymId) : undefined;

  const { data: gyms } = await gatewayJson<{ data: GymLite[] }>('/api/gyms/admin/all');
  const gymsById = new Map(gyms.map((g) => [g.id, g]));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Live Tracking"
        subtitle="Who's here right now, when gyms are busiest, and which gyms are performing best."
      />

      <div className="flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/live?tab=${t}`}
            className={`rounded px-3 py-1 text-sm ${
              t === tab ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            {TAB_LABEL[t]}
          </Link>
        ))}
        <Link
          href="/live?tab=live"
          className="ml-auto rounded px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          ↻ Refresh
        </Link>
      </div>

      {tab === 'live' && <LiveNowTab gymsById={gymsById} />}
      {tab === 'heatmap' && <HeatmapTab gyms={gyms} gymId={gymIdFilter} days={days} />}
      {tab === 'leaderboard' && <LeaderboardTab gymsById={gymsById} days={days} />}
    </div>
  );
}

async function LiveNowTab({ gymsById }: { gymsById: Map<number, GymLite> }) {
  const { data: live } = await gatewayJson<{ data: LiveOccupancy }>('/api/bookings/admin/live');

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-sm text-gray-500">People in session, platform-wide</div>
          <div className="text-2xl font-semibold">{live.totalActive}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">Gyms with at least 1 active session</div>
          <div className="text-2xl font-semibold">{live.byGym.length}</div>
        </Card>
      </div>

      <PageHeader title="By gym" />
      <Table>
        <Thead>
          <Th>Gym</Th>
          <Th>Active now</Th>
        </Thead>
        <tbody>
          {live.byGym.map((row) => (
            <Tr key={row.gymId}>
              <Td>
                <Link href={`/gyms/${row.gymId}`} className="underline">
                  {gymLabel(row.gymId, gymsById)}
                </Link>
              </Td>
              <Td>{row.count}</Td>
            </Tr>
          ))}
          {live.byGym.length === 0 && <EmptyRow colSpan={2}>No one currently checked in anywhere.</EmptyRow>}
        </tbody>
      </Table>

      <PageHeader title="Sessions" subtitle="Every booking currently checked in and in progress." />
      <Table>
        <Thead>
          <Th>Customer</Th>
          <Th>Gym</Th>
          <Th>Slot</Th>
          <Th>Checked in</Th>
          <Th>Method</Th>
        </Thead>
        <tbody>
          {live.sessions.map((s) => (
            <Tr key={s.id}>
              <Td>{s.customerName || `Customer #${s.customerId}`}</Td>
              <Td>
                <Link href={`/gyms/${s.gymId}`} className="underline">
                  {gymLabel(s.gymId, gymsById)}
                </Link>
              </Td>
              <Td>
                {s.startTime}–{s.endTime}
              </Td>
              <Td>{formatDateTimeIST(s.attendedAt)}</Td>
              <Td>{s.attendanceMethod ? METHOD_LABEL[s.attendanceMethod] ?? s.attendanceMethod : '—'}</Td>
            </Tr>
          ))}
          {live.sessions.length === 0 && <EmptyRow colSpan={5}>No one currently checked in anywhere.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}

async function HeatmapTab({ gyms, gymId, days }: { gyms: GymLite[]; gymId?: number; days: number }) {
  const query = new URLSearchParams({ days: String(days) });
  if (gymId) query.set('gymId', String(gymId));
  const { data: heatmap } = await gatewayJson<{ data: Heatmap }>(`/api/bookings/admin/attendance-heatmap?${query}`);

  const byKey = new Map(heatmap.weekdayHourPattern.map((c) => [`${c.weekday}-${c.hour}`, c.count]));
  const maxCount = Math.max(1, ...heatmap.weekdayHourPattern.map((c) => c.count));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  function intensityClass(count: number) {
    if (count === 0) return 'bg-gray-50 dark:bg-gray-900';
    const ratio = count / maxCount;
    if (ratio > 0.75) return 'bg-emerald-600 text-white';
    if (ratio > 0.5) return 'bg-emerald-400 text-white';
    if (ratio > 0.25) return 'bg-emerald-200 dark:text-gray-900';
    return 'bg-emerald-100 dark:text-gray-900';
  }

  const recentDates = [...new Set(heatmap.cells.map((c) => c.date))].sort().slice(-14);
  const cellsByDateHour = new Map(heatmap.cells.map((c) => [`${c.date}-${c.hour}`, c.count]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <form action="/live" method="GET" className="flex items-center gap-2">
          <input type="hidden" name="tab" value="heatmap" />
          <select name="gymId" defaultValue={gymId ?? ''} className="rounded border px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-800">
            <option value="">All gyms (platform-wide)</option>
            {gyms.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.city})
              </option>
            ))}
          </select>
          <select name="days" defaultValue={days} className="rounded border px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-800">
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-emerald-600 px-3 py-1 text-sm text-white">
            Apply
          </button>
        </form>
      </div>

      <div>
        <PageHeader
          title="Weekday x hour pattern"
          subtitle="Which day of the week and hour of the day sees the most verified attendance, over the selected window."
        />
        <div className="overflow-x-auto rounded-lg border dark:border-gray-800">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1"></th>
                {hours.map((h) => (
                  <th key={h} className="px-1 py-1 font-medium text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAY_LABEL.map((label, weekday) => (
                <tr key={weekday}>
                  <td className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-300">{label}</td>
                  {hours.map((h) => {
                    const count = byKey.get(`${weekday}-${h}`) ?? 0;
                    return (
                      <td key={h} className={`h-7 w-7 ${intensityClass(count)}`} title={`${count} attendances`}>
                        {count > 0 ? count : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <PageHeader title="By date (last 14 days with data)" subtitle="Literal per-day, per-hour breakdown." />
        {recentDates.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">No verified attendance in this window yet.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {recentDates.map((date) => {
              const dayCells = hours
                .map((h) => ({ hour: h, count: cellsByDateHour.get(`${date}-${h}`) ?? 0 }))
                .filter((c) => c.count > 0);
              const dayTotal = dayCells.reduce((sum, c) => sum + c.count, 0);
              return (
                <Card key={date} className="flex items-center gap-4">
                  <div className="w-28 shrink-0 text-sm font-medium">{formatDateIST(date)}</div>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {dayCells.map((c) => (
                      <span
                        key={c.hour}
                        className="rounded bg-emerald-100 px-2 py-0.5 text-xs dark:bg-emerald-900/40 dark:text-emerald-300"
                      >
                        {c.hour}:00 · {c.count}
                      </span>
                    ))}
                    {dayCells.length === 0 && <span className="text-xs text-gray-400">No attendance</span>}
                  </div>
                  <div className="shrink-0 text-sm font-semibold">{dayTotal} total</div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

async function LeaderboardTab({ gymsById, days }: { gymsById: Map<number, GymLite>; days: number }) {
  const { data: leaderboard } = await gatewayJson<{ data: TopGymsResponse }>(
    `/api/bookings/admin/top-gyms?days=${days}&limit=50`,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {DAY_OPTIONS.map((d) => (
          <Link
            key={d}
            href={`/live?tab=leaderboard&days=${d}`}
            className={`rounded px-3 py-1 text-sm ${
              d === days ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            Last {d}d
          </Link>
        ))}
      </div>

      <PageHeader title="Top-performing gyms" subtitle="Ranked by revenue — attendance shown alongside." />
      <Table>
        <Thead>
          <Th>Rank</Th>
          <Th>Gym</Th>
          <Th>Revenue</Th>
          <Th>Completed bookings</Th>
          <Th>Attendance count</Th>
        </Thead>
        <tbody>
          {leaderboard.gyms.map((row, i) => (
            <Tr key={row.gymId}>
              <Td>
                {i === 0 ? <StatusBadge tone="active">#1</StatusBadge> : `#${i + 1}`}
              </Td>
              <Td>
                <Link href={`/gyms/${row.gymId}`} className="underline">
                  {gymLabel(row.gymId, gymsById)}
                </Link>
              </Td>
              <Td>{formatRupees(row.revenue)}</Td>
              <Td>{row.completedBookings}</Td>
              <Td>{row.attendanceCount}</Td>
            </Tr>
          ))}
          {leaderboard.gyms.length === 0 && <EmptyRow colSpan={5}>No completed bookings in this window.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
