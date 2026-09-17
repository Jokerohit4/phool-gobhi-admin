import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionForm } from '@/components/ui/ActionForm';
import { applyAttendanceSaasBillAction } from './actions';
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

// Monthly flat-per-user bill for a (gym, month) — same shape the gateway
// serves, the "users joined that month" numerator from auth-service.
interface AttendanceSaasBill {
  gymId: number;
  month: string;
  usersJoined: number;
  flatFeePerUser: number;
  amountDue: number;
  appliedAt: string | null;
  attendanceSaasOptedOut: boolean;
  subscriptionPricingMode: 'percentage' | 'flatPerUser';
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
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

export default async function AttendanceSaasPage({ searchParams }: { searchParams?: Promise<{ month?: string }> }) {
  await requireSession();

  const sp = await searchParams ?? {};
  const month = /^\d{4}-\d{2}$/.test(sp.month || '') ? sp.month! : currentMonth();

  const [{ data: gyms }, { data: summaryRows }] = await Promise.all([
    gatewayJson<{ data: GymLite[] }>('/api/gyms/admin/all?status=approved'),
    gatewayJson<{ data: SubscriptionSummaryRow[] }>('/api/wallet/subscriptions/admin/by-gym'),
  ]);

  // Read-only per-gym bill for the selected month (users joined x flat fee).
  // The wallet endpoint computes it and reports appliedAt when already
  // charged; the apply button below actually debits the partner wallet.
  const [{ data: bills }] = await Promise.all([
    gatewayJson<{ data: AttendanceSaasBill[] }>('/api/wallet/attendance-saas/bills', {
      method: 'POST',
      body: JSON.stringify({ gymIds: gyms.map((g) => g.id), month }),
      headers: { 'Content-Type': 'application/json' },
    }),
  ]);
  const billByGym = new Map(bills.map((b) => [b.gymId, b]));

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
subtitle={
          <>
            Per-gym subscription (registration) revenue — the gym-supply acquisition wedge, separate from
            marketplace booking commission. Every registration carries a platform commission from day one, no free
            period.{' '}
            <Link href="/attendance-saas/settlements" className="underline">
              Bank settlements →
            </Link>
          </>
        }
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

      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Monthly registration bill</h2>
            <p className="text-sm text-gray-500">
              ₹{DEFAULT_SUBSCRIPTION_FLAT_FEE_PER_USER} per user joined that month (or the gym&apos;s flat-fee
              override), debited from the partner wallet — negative balance allowed, charged with one click.
            </p>
          </div>
          <form className="flex items-end gap-2" action="">
            <label className="flex flex-col text-sm text-gray-600">
              Month
              <input
                type="month"
                name="month"
                defaultValue={month}
                className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <button type="submit" className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white">
              Load
            </button>
          </form>
        </div>

        <Table>
          <Thead>
            <Th>Gym</Th>
            <Th>Joined this month</Th>
            <Th>Flat fee</Th>
            <Th>Amount due</Th>
            <Th>Bill status</Th>
            <Th>Charge</Th>
          </Thead>
          <tbody>
            {rows.map(({ gym }) => {
              const bill = billByGym.get(gym.id);
              const usersJoined = bill?.usersJoined ?? 0;
              const fee = bill?.flatFeePerUser ?? DEFAULT_SUBSCRIPTION_FLAT_FEE_PER_USER;
              const amountDue = bill?.amountDue ?? 0;
              const alreadyApplied = !!bill?.appliedAt;
              return (
                <Tr key={gym.id}>
                  <Td>{gym.name}</Td>
                  <Td>{usersJoined}</Td>
                  <Td>₹{fee}/user</Td>
                  <Td>₹{amountDue.toFixed(2)}</Td>
                  <Td>
                    {alreadyApplied ? (
                      <StatusBadge tone="approved">Billed {bill!.appliedAt ? formatDateIST(bill!.appliedAt) : ''}</StatusBadge>
                    ) : amountDue > 0 ? (
                      <StatusBadge tone="pending">Open</StatusBadge>
                    ) : (
                      <StatusBadge tone="read">No joiners</StatusBadge>
                    )}
                  </Td>
                  <Td>
                    {!alreadyApplied && amountDue > 0 && (
                      <ActionForm
                        action={applyAttendanceSaasBillAction}
                        confirmMessage={`Charge ₹${amountDue.toFixed(2)} for ${month} to ${gym.name}'s partner wallet? This can go negative.`}
                      >
                        <input type="hidden" name="gymId" value={gym.id} />
                        <input type="hidden" name="month" value={month} />
                        <button type="submit" className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white">
                          Charge
                        </button>
                      </ActionForm>
                    )}
                  </Td>
                </Tr>
              );
            })}
            {rows.length === 0 && <EmptyRow colSpan={6}>No approved gyms yet.</EmptyRow>}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
