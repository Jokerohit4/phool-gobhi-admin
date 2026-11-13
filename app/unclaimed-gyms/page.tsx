import { requireSession } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { formatDateIST } from '@/lib/dateFormat';
import {
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
  loadUnclaimedGymRows,
  parseClaimStatus,
  peopleTrainHereLabel,
  type UnclaimedGymRow,
} from './unclaimedGyms';

export const dynamic = 'force-dynamic';

// Matches the pill style used by the buddy-reports and food-requests queues.
function pillClass(active: boolean): string {
  return `rounded px-3 py-1 text-sm font-medium ${
    active
      ? 'bg-emerald-600 text-white'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
  }`;
}

function statusHref(status: string): string {
  return status === 'unclaimed' ? '/unclaimed-gyms' : `/unclaimed-gyms?claimStatus=${status}`;
}

export default async function UnclaimedGymsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const params = await searchParams;
  const claimStatus = parseClaimStatus(params.claimStatus);

  let rows: UnclaimedGymRow[] = [];
  let loadError: string | null = null;
  try {
    rows = await loadUnclaimedGymRows(claimStatus);
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Could not load unclaimed gyms';
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Unclaimed gyms"
        subtitle="Gyms our customers train at that are not partners yet, newest first. The people count only appears once at least 5 different people have checked in there."
      />

      <div className="flex gap-2">
        {CLAIM_STATUSES.map((s) => (
          <a key={s} href={statusHref(s)} className={pillClass(claimStatus === s)}>
            {CLAIM_STATUS_LABELS[s]}
          </a>
        ))}
      </div>

      {loadError && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-red-300 text-sm text-red-700 dark:border-red-800 dark:text-red-400">
          <span>Could not load unclaimed gyms: {loadError}</span>
          <a
            href={statusHref(claimStatus)}
            className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
          >
            Retry
          </a>
        </Card>
      )}

      {!loadError && (
        <Table>
          <Thead>
            <Th>Gym</Th>
            <Th>City</Th>
            <Th>Status</Th>
            <Th>Added</Th>
          </Thead>
          <tbody>
            {rows.map(({ gym, peopleCount }) => {
              const people = peopleTrainHereLabel(peopleCount);
              return (
                <Tr key={gym.id}>
                  <Td className="max-w-md">
                    <p className="font-medium">{gym.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{gym.address}</p>
                    {people && (
                      <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">{people}</p>
                    )}
                  </Td>
                  <Td>{gym.city || '—'}</Td>
                  <Td>
                    {CLAIM_STATUS_LABELS[gym.claimStatus] ?? gym.claimStatus}
                    {gym.claimedGymId != null && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Partner gym #{gym.claimedGymId}</p>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {formatDateIST(gym.createdAt)}
                  </Td>
                </Tr>
              );
            })}
            {rows.length === 0 && (
              <EmptyRow colSpan={4}>
                {claimStatus === 'unclaimed'
                  ? 'No unclaimed gyms yet.'
                  : `No ${CLAIM_STATUS_LABELS[claimStatus].toLowerCase()} gyms.`}
              </EmptyRow>
            )}
          </tbody>
        </Table>
      )}
    </div>
  );
}
