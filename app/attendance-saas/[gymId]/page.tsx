import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateIST } from '@/lib/dateFormat';

interface Member {
  id: number;
  name: string | null;
  phone: string | null;
  createdAt: string;
}

interface SubscriptionRow {
  customerId: number;
  planType: string;
  price: number;
  status: 'active' | 'cancelled';
  startDate: string;
  endDate: string;
}

interface GymLite {
  id: number;
  name: string;
}

interface MemberActivityRow {
  customerId: number;
  customerName: string | null;
  visitCount: number;
  totalMinutes: number;
  mostCommonHour: number;
  consistencyRatio: number;
}

interface MemberActivity {
  windowDays: number;
  members: MemberActivityRow[];
}

const ACTIVITY_DAY_OPTIONS = [7, 30, 90];

type SortKey = 'mostVisits' | 'leastVisits' | 'mostTime' | 'leastTime' | 'mostRoutine' | 'mostVaried';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'mostVisits', label: 'Most active' },
  { key: 'leastVisits', label: 'Least active' },
  { key: 'mostTime', label: 'Most time spent' },
  { key: 'leastTime', label: 'Least time spent' },
  { key: 'mostRoutine', label: 'Same time, every visit' },
  { key: 'mostVaried', label: 'Different times' },
];

function sortActivity(rows: MemberActivityRow[], sort: SortKey): MemberActivityRow[] {
  const sorted = [...rows];
  switch (sort) {
    case 'mostVisits':
      return sorted.sort((a, b) => b.visitCount - a.visitCount);
    case 'leastVisits':
      return sorted.sort((a, b) => a.visitCount - b.visitCount);
    case 'mostTime':
      return sorted.sort((a, b) => b.totalMinutes - a.totalMinutes);
    case 'leastTime':
      return sorted.sort((a, b) => a.totalMinutes - b.totalMinutes);
    case 'mostRoutine':
      return sorted.sort((a, b) => b.consistencyRatio - a.consistencyRatio);
    case 'mostVaried':
      return sorted.sort((a, b) => a.consistencyRatio - b.consistencyRatio);
    default:
      return sorted;
  }
}

function formatHour(hour: number) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${period}`;
}

function isCurrentlyActive(sub: SubscriptionRow): boolean {
  return sub.status === 'active' && new Date(sub.endDate) >= new Date();
}

export default async function AttendanceSaasMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ gymId: string }>;
  searchParams: Promise<{ days?: string; sort?: string }>;
}) {
  await requireSession();
  const { gymId } = await params;
  const { days: daysParam, sort: sortParam } = await searchParams;
  const activityDays = ACTIVITY_DAY_OPTIONS.includes(Number(daysParam)) ? Number(daysParam) : 7;
  const activitySort: SortKey = SORT_OPTIONS.some((o) => o.key === sortParam) ? (sortParam as SortKey) : 'mostVisits';

  let gym: GymLite;
  try {
    const res = await gatewayJson<{ data: GymLite }>(`/api/gyms/admin/${gymId}`);
    gym = res.data;
  } catch {
    notFound();
  }

  const [{ data: members }, { data: subscriptions }, { data: activity }] = await Promise.all([
    gatewayJson<{ data: Member[] }>(`/api/auth/admin/attendance-saas/members/${gymId}`),
    gatewayJson<{ data: SubscriptionRow[] }>(`/api/wallet/subscriptions/admin/by-gym/${gymId}`),
    gatewayJson<{ data: MemberActivity }>(`/api/bookings/admin/gym/${gymId}/member-activity?days=${activityDays}`),
  ]);
  const sortedActivity = sortActivity(activity.members, activitySort);

  // One gym's subscriptions only ever belong to that gym's own linked
  // members here, but a member can have bought more than once (renewals) —
  // aggregate per customerId rather than assuming one row each.
  const subsByCustomer = new Map<number, SubscriptionRow[]>();
  for (const sub of subscriptions) {
    const list = subsByCustomer.get(sub.customerId) ?? [];
    list.push(sub);
    subsByCustomer.set(sub.customerId, list);
  }

  const rows = members.map((member) => {
    const subs = subsByCustomer.get(member.id) ?? [];
    const totalPaid = subs.reduce((sum, s) => sum + s.price, 0);
    const activeNow = subs.some(isCurrentlyActive);
    return { member, subscriptionCount: subs.length, totalPaid, activeNow };
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${gym.name} — members`}
        subtitle={
          <>
            Individual attendance-SaaS registrations at this gym.{' '}
            <Link href="/attendance-saas" className="underline">
              Back to Attendance SaaS
            </Link>
          </>
        }
      />

      <Table>
        <Thead>
          <Th>Name</Th>
          <Th>Phone</Th>
          <Th>Registered</Th>
          <Th>Subscriptions</Th>
          <Th>Total paid</Th>
          <Th>Status</Th>
        </Thead>
        <tbody>
          {rows.map(({ member, subscriptionCount, totalPaid, activeNow }) => (
            <Tr key={member.id}>
              <Td>{member.name ?? '—'}</Td>
              <Td>{member.phone ?? '—'}</Td>
              <Td>{formatDateIST(member.createdAt)}</Td>
              <Td>{subscriptionCount}</Td>
              <Td>₹{totalPaid.toFixed(2)}</Td>
              <Td>
                {activeNow ? (
                  <StatusBadge tone="approved">Active</StatusBadge>
                ) : subscriptionCount > 0 ? (
                  <StatusBadge tone="pending">Lapsed</StatusBadge>
                ) : (
                  <StatusBadge tone="rejected">No subscription yet</StatusBadge>
                )}
              </Td>
            </Tr>
          ))}
          {rows.length === 0 && <EmptyRow colSpan={6}>No one has registered at this gym yet.</EmptyRow>}
        </tbody>
      </Table>

      <PageHeader
        title="Attendance activity"
        subtitle={`Based on verified attendance in the last ${activity.windowDays} day${activity.windowDays === 1 ? '' : 's'}. Time spent is booked session length, not a measured presence duration.`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map((o) => (
            <Link
              key={o.key}
              href={`/attendance-saas/${gymId}?days=${activityDays}&sort=${o.key}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                o.key === activitySort ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800'
              }`}
            >
              {o.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 text-sm">
          {ACTIVITY_DAY_OPTIONS.map((d) => (
            <Link
              key={d}
              href={`/attendance-saas/${gymId}?days=${d}&sort=${activitySort}`}
              className={`rounded px-3 py-1 ${d === activityDays ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
            >
              {d}d
            </Link>
          ))}
        </div>
      </div>
      <Table>
        <Thead>
          <Th>Member</Th>
          <Th>Visits</Th>
          <Th>Time spent</Th>
          <Th>Usual time</Th>
          <Th>Timing</Th>
        </Thead>
        <tbody>
          {sortedActivity.map((row) => (
            <Tr key={row.customerId}>
              <Td>{row.customerName || `Customer #${row.customerId}`}</Td>
              <Td>{row.visitCount}</Td>
              <Td>{(row.totalMinutes / 60).toFixed(1)}h</Td>
              <Td>{formatHour(row.mostCommonHour)}</Td>
              <Td>
                {row.visitCount < 2 ? (
                  <span className="text-gray-400">Not enough visits yet</span>
                ) : row.consistencyRatio >= 0.6 ? (
                  <StatusBadge tone="approved">
                    Routine ({Math.round(row.consistencyRatio * 100)}% at {formatHour(row.mostCommonHour)})
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="read">Varies</StatusBadge>
                )}
              </Td>
            </Tr>
          ))}
          {sortedActivity.length === 0 && (
            <EmptyRow colSpan={5}>No verified attendance in this window yet.</EmptyRow>
          )}
        </tbody>
      </Table>
    </div>
  );
}
