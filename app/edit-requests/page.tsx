import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { CHANGE_TYPE_LABELS } from '@/lib/editRequests';

interface EditRequestRow {
  id: number;
  gymId: number;
  partnerId: number;
  changeType: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  gym: { name: string; city: string; partnerId: number };
}

const TABS = ['pending', 'approved', 'rejected'] as const;
type Tab = (typeof TABS)[number];

function isTab(value: string | undefined): value is Tab {
  return TABS.includes(value as Tab);
}

export default async function EditRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireSession();
  const { status: rawStatus } = await searchParams;
  const status: Tab = isTab(rawStatus) ? rawStatus : 'pending';

  const { data: requests } = await gatewayJson<{ data: EditRequestRow[] }>(
    `/api/gyms/edit-requests?status=${status}`
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Partner Edit Requests" subtitle="Changes to already-approved gyms, held until you review them" />

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={`/edit-requests?status=${tab}`}
            className={`rounded px-3 py-1 text-sm capitalize ${
              tab === status ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            {tab}
          </Link>
        ))}
      </div>

      <Table>
        <Thead>
          <Th>Gym</Th>
          <Th>Partner ID</Th>
          <Th>Change</Th>
          <Th>Submitted</Th>
        </Thead>
        <tbody>
          {requests.map((r) => (
            <Tr key={r.id}>
              <Td>
                <Link href={`/edit-requests/${r.id}`} className="underline">
                  {r.gym.name}
                </Link>{' '}
                <span className="text-gray-500">· {r.gym.city}</span>
              </Td>
              <Td>
                <Link href={`/gyms?partnerId=${r.gym.partnerId}`} className="underline">
                  {r.gym.partnerId}
                </Link>
              </Td>
              <Td>
                <StatusBadge tone={r.status}>{CHANGE_TYPE_LABELS[r.changeType] ?? r.changeType}</StatusBadge>
              </Td>
              <Td>{new Date(r.createdAt).toLocaleString()}</Td>
            </Tr>
          ))}
          {requests.length === 0 && <EmptyRow colSpan={4}>No {status} edit requests.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
