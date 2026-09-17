import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateIST } from '@/lib/dateFormat';

// Platform defaults, mirroring wallet-service's DEFAULT_SUBSCRIPTION_SAAS_COMMISSION_PERCENT /
// DEFAULT_SUBSCRIPTION_FLAT_FEE_PER_USER.
const DEFAULT_SUBSCRIPTION_SAAS_COMMISSION_PERCENT = 1;
const DEFAULT_SUBSCRIPTION_FLAT_FEE_PER_USER = 1;

interface GymLite {
  id: number;
  name: string;
  city: string;
  partnershipStartDate: string | null;
  subscriptionCommissionPct: number | null;
  subscriptionPricingMode: 'percentage' | 'flatPerUser';
  subscriptionFlatFeePerUser: number | null;
}

interface SubscriptionSummaryRow {
  gymId: number;
  subscriptionCount: number;
  activeCount: number;
  totalRevenue: number;
  totalPlatformShare: number;
}

const EMPTY_SUMMARY: Omit<SubscriptionSummaryRow, 'gymId'> = {
  subscriptionCount: 0,
  activeCount: 0,
  totalRevenue: 0,
  totalPlatformShare: 0,
};

function effectiveRateLabel(gym: GymLite): string {
  if (gym.subscriptionPricingMode === 'flatPerUser') {
    const fee = gym.subscriptionFlatFeePerUser ?? DEFAULT_SUBSCRIPTION_FLAT_FEE_PER_USER;
    return gym.subscriptionFlatFeePerUser != null ? `₹${fee}/customer (override)` : `₹${fee}/customer (default)`;
  }
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

  const liveCount = gyms.filter((g) => g.partnershipStartDate).length;
  const notStartedCount = gyms.length - liveCount;
  const totalSubscriptions = summaryRows.reduce((sum, r) => sum + r.subscriptionCount, 0);
  const totalPlatformShare = summaryRows.reduce((sum, r) => sum + r.totalPlatformShare, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Attendance SaaS"
        subtitle="Per-gym subscription (registration) revenue — the gym-supply acquisition wedge, separate from marketplace booking commission. Every registration carries a platform commission from day one, no free period."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <div className="text-sm text-gray-500">Live</div>
          <div className="text-2xl font-semibold">{liveCount}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">Not started</div>
          <div className="text-2xl font-semibold">{notStartedCount}</div>
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
          <Th>Status</Th>
          <Th>Rate</Th>
          <Th>Subscriptions</Th>
          <Th>Active</Th>
          <Th>Revenue</Th>
          <Th>Platform share</Th>
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
                {gym.partnershipStartDate ? (
                  <StatusBadge tone="approved">Live</StatusBadge>
                ) : (
                  <StatusBadge tone="rejected">Not started</StatusBadge>
                )}
                <div className="text-xs text-gray-500">
                  {gym.partnershipStartDate ? `Since ${formatDateIST(gym.partnershipStartDate)}` : 'Set on first approval'}
                </div>
              </Td>
              <Td>{effectiveRateLabel(gym)}</Td>
              <Td>{summary.subscriptionCount}</Td>
              <Td>{summary.activeCount}</Td>
              <Td>₹{summary.totalRevenue.toFixed(2)}</Td>
              <Td>₹{summary.totalPlatformShare.toFixed(2)}</Td>
            </Tr>
          ))}
          {rows.length === 0 && <EmptyRow colSpan={7}>No approved gyms yet.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
