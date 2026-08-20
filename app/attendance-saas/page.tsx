import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { describeHoneymoonStatus, isInHoneymoon } from '@/lib/honeymoon';

// Platform default, mirroring wallet-service's DEFAULT_SUBSCRIPTION_SAAS_COMMISSION_PERCENT.
const DEFAULT_SUBSCRIPTION_SAAS_COMMISSION_PERCENT = 1;

interface GymLite {
  id: number;
  name: string;
  city: string;
  partnershipStartDate: string | null;
  subscriptionCommissionPct: number | null;
}

interface SubscriptionSummaryRow {
  gymId: number;
  subscriptionCount: number;
  activeCount: number;
  honeymoonSubscriptionCount: number;
  totalRevenue: number;
  totalPlatformShare: number;
}

const EMPTY_SUMMARY: Omit<SubscriptionSummaryRow, 'gymId'> = {
  subscriptionCount: 0,
  activeCount: 0,
  honeymoonSubscriptionCount: 0,
  totalRevenue: 0,
  totalPlatformShare: 0,
};

function effectiveRateLabel(gym: GymLite): string {
  if (isInHoneymoon(gym.partnershipStartDate)) return '0% (honeymoon)';
  const rate = gym.subscriptionCommissionPct ?? DEFAULT_SUBSCRIPTION_SAAS_COMMISSION_PERCENT;
  return gym.subscriptionCommissionPct != null ? `${rate}% (override)` : `${rate}% (default)`;
}

export default async function AttendanceSaasPage() {
  await requireSession();

  const [{ data: gyms }, { data: summaryRows }] = await Promise.all([
    gatewayJson<{ data: GymLite[] }>('/api/gyms/admin/all?status=approved'),
    gatewayJson<{ data: SubscriptionSummaryRow[] }>('/api/wallet/subscriptions/admin/by-gym'),
  ]);

  const summaryByGym = new Map(summaryRows.map((r) => [r.gymId, r]));
  const rows = gyms
    .map((gym) => ({ gym, summary: summaryByGym.get(gym.id) ?? { gymId: gym.id, ...EMPTY_SUMMARY } }))
    .sort((a, b) => b.summary.totalRevenue - a.summary.totalRevenue);

  const honeymoonCount = gyms.filter((g) => isInHoneymoon(g.partnershipStartDate)).length;
  const liveCount = gyms.filter((g) => g.partnershipStartDate && !isInHoneymoon(g.partnershipStartDate)).length;
  const totalSubscriptions = summaryRows.reduce((sum, r) => sum + r.subscriptionCount, 0);
  const totalPlatformShare = summaryRows.reduce((sum, r) => sum + r.totalPlatformShare, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Attendance SaaS"
        subtitle="Per-gym honeymoon status and subscription (registration) revenue — the gym-supply acquisition wedge, separate from marketplace booking commission."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <div className="text-sm text-gray-500">In honeymoon</div>
          <div className="text-2xl font-semibold">{honeymoonCount}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">Past honeymoon</div>
          <div className="text-2xl font-semibold">{liveCount}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">Total subscriptions</div>
          <div className="text-2xl font-semibold">{totalSubscriptions}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">Platform share generated</div>
          <div className="text-2xl font-semibold">₹{totalPlatformShare.toFixed(2)}</div>
        </Card>
      </div>

      <Table>
        <Thead>
          <Th>Gym</Th>
          <Th>Honeymoon</Th>
          <Th>Rate</Th>
          <Th>Subscriptions</Th>
          <Th>Active</Th>
          <Th>Revenue</Th>
          <Th>Platform share</Th>
          <Th>Roster</Th>
        </Thead>
        <tbody>
          {rows.map(({ gym, summary }) => (
            <Tr key={gym.id}>
              <Td>
                <Link href={`/gyms/${gym.id}`} className="underline">
                  {gym.name}
                </Link>
                <div className="text-xs text-gray-500">{gym.city}</div>
              </Td>
              <Td>
                {isInHoneymoon(gym.partnershipStartDate) ? (
                  <StatusBadge tone="pending">In honeymoon</StatusBadge>
                ) : gym.partnershipStartDate ? (
                  <StatusBadge tone="approved">Live</StatusBadge>
                ) : (
                  <StatusBadge tone="rejected">Not started</StatusBadge>
                )}
                <div className="text-xs text-gray-500">{describeHoneymoonStatus(gym.partnershipStartDate)}</div>
              </Td>
              <Td>{effectiveRateLabel(gym)}</Td>
              <Td>{summary.subscriptionCount}</Td>
              <Td>{summary.activeCount}</Td>
              <Td>₹{summary.totalRevenue.toFixed(2)}</Td>
              <Td>₹{summary.totalPlatformShare.toFixed(2)}</Td>
              <Td>
                <Link href={`/attendance-saas/${gym.id}`} className="underline">
                  View members
                </Link>
              </Td>
            </Tr>
          ))}
          {rows.length === 0 && <EmptyRow colSpan={8}>No approved gyms yet.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
