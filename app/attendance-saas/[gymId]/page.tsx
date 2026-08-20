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

function isCurrentlyActive(sub: SubscriptionRow): boolean {
  return sub.status === 'active' && new Date(sub.endDate) >= new Date();
}

export default async function AttendanceSaasMembersPage({
  params,
}: {
  params: Promise<{ gymId: string }>;
}) {
  await requireSession();
  const { gymId } = await params;

  let gym: GymLite;
  try {
    const res = await gatewayJson<{ data: GymLite }>(`/api/gyms/admin/${gymId}`);
    gym = res.data;
  } catch {
    notFound();
  }

  const [{ data: members }, { data: subscriptions }] = await Promise.all([
    gatewayJson<{ data: Member[] }>(`/api/auth/admin/attendance-saas/members/${gymId}`),
    gatewayJson<{ data: SubscriptionRow[] }>(`/api/wallet/subscriptions/admin/by-gym/${gymId}`),
  ]);

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
    </div>
  );
}
