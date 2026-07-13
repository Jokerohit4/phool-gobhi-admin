import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';

interface Gym {
  id: number;
  name: string;
  city: string;
  partnerId: number;
  isApproved: boolean;
  rejectionReason: string | null;
  createdAt: string;
}

const TABS = ['pending', 'approved', 'rejected'] as const;
type Tab = (typeof TABS)[number];

function isTab(value: string | undefined): value is Tab {
  return TABS.includes(value as Tab);
}

export default async function GymsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireSession();
  const { status: rawStatus } = await searchParams;
  const status: Tab = isTab(rawStatus) ? rawStatus : 'pending';

  const { data: gyms } = await gatewayJson<{ data: Gym[] }>(`/api/gyms/admin/all?status=${status}`);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Gym approval queue" />

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={`/gyms?status=${tab}`}
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
          <Th>Name</Th>
          <Th>City</Th>
          <Th>Partner ID</Th>
          <Th>Submitted</Th>
        </Thead>
        <tbody>
          {gyms.map((gym) => (
            <Tr key={gym.id}>
              <Td>
                <Link href={`/gyms/${gym.id}`} className="underline">{gym.name}</Link>
              </Td>
              <Td>{gym.city}</Td>
              <Td>{gym.partnerId}</Td>
              <Td>{new Date(gym.createdAt).toLocaleDateString()}</Td>
            </Tr>
          ))}
          {gyms.length === 0 && <EmptyRow colSpan={4}>No gyms in this status.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
