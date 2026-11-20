import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatDateIST } from '@/lib/dateFormat';
import { COHORTS, cohortLabel, isCohort } from './cohorts';
import { setUserCohortAction, bulkSetCohortAction } from './actions';
import { FilterBar } from '@/components/ui/FilterBar';
import { InlineError } from '@/components/ui/InlineError';
import { Section } from '@/components/ui/Section';

interface UserRow {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  accountCohort: string;
  createdAt: string;
}

interface UsersResponse {
  data: {
    users: UserRow[];
    counts: Record<string, number>;
    nextCursor: number | null;
  };
}

const SELECT_CLASS = 'rounded border px-2 py-1 text-sm dark:bg-gray-900';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string; cursor?: string }>;
}) {
  await requireSession();
  const { cohort: rawCohort, cursor } = await searchParams;
  const cohort = isCohort(rawCohort) ? rawCohort : undefined;

  const qs = new URLSearchParams({ limit: '50' });
  if (cohort) qs.set('cohort', cohort);
  if (cursor && /^\d+$/.test(cursor)) qs.set('cursor', cursor);
  let data: UsersResponse['data'] = { users: [], counts: {}, nextCursor: null };
  let error = '';
  try {
    ({ data } = await gatewayJson<UsersResponse>(`/api/auth/admin/users?${qs.toString()}`));
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load users';
  }

  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);
  const nextParams = new URLSearchParams();
  if (cohort) nextParams.set('cohort', cohort);
  if (data.nextCursor) nextParams.set('cursor', String(data.nextCursor));
  const nextHref = data.nextCursor ? `/users?${nextParams.toString()}` : null;

  return (
    <div className="flex flex-col gap-8">
      <Section>
        <Breadcrumbs items={[{ label: 'Users & cohorts' }]} />
        <PageHeader
          title="Users & cohorts"
          subtitle="Who each account is: friends & family, generated, testing or unknown. Use it to build beta cohorts."
        />
        {error && <InlineError title="Could not load users" message={error} retryHref={`/users${cohort ? `?cohort=${cohort}` : ''}`} />}
        <FilterBar className="text-sm">
          <Link
            href="/users"
            className={`rounded-full border px-3 py-1 ${!cohort ? 'bg-emerald-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            All ({total})
          </Link>
          {COHORTS.map((c) => (
            <Link
              key={c}
              href={`/users?cohort=${c}`}
              className={`rounded-full border px-3 py-1 capitalize ${cohort === c ? 'bg-emerald-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              {cohortLabel(c)} ({data.counts[c] ?? 0})
            </Link>
          ))}
        </FilterBar>

        <Table>
          <Thead>
            <Th>ID</Th>
            <Th>Name</Th>
            <Th>Phone</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Joined</Th>
            <Th>Cohort</Th>
          </Thead>
          <tbody>
            {data.users.map((u) => (
              <Tr key={u.id}>
                <Td>{u.id}</Td>
                <Td>{u.name || '-'}</Td>
                <Td>{u.phone || '-'}</Td>
                <Td>{u.email || '-'}</Td>
                <Td className="capitalize">{u.role}</Td>
                <Td>{formatDateIST(u.createdAt)}</Td>
                <Td>
                  <ActionForm action={setUserCohortAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <select name="accountCohort" defaultValue={u.accountCohort} className={SELECT_CLASS}>
                      {COHORTS.map((c) => (
                        <option key={c} value={c}>{cohortLabel(c)}</option>
                      ))}
                    </select>
                    <SubmitButton variant="secondary" pendingText="Saving…">Save</SubmitButton>
                  </ActionForm>
                </Td>
              </Tr>
            ))}
            {!error && data.users.length === 0 && <EmptyRow colSpan={7}>No users in this cohort.</EmptyRow>}
            {error && data.users.length === 0 && <EmptyRow colSpan={7}>Could not load users.</EmptyRow>}
          </tbody>
        </Table>
        {nextHref && (
          <Link href={nextHref} className="w-fit text-sm text-emerald-700 underline">
            Next page →
          </Link>
        )}
      </Section>

      <Section>
        <PageHeader title="Bulk assign" subtitle="Paste user ids (comma, space or new-line separated), up to 500." />
        <Card className="max-w-md">
          <ActionForm
            action={bulkSetCohortAction}
            confirmMessage="Change the cohort of every listed user?"
            className="flex flex-col gap-3"
          >
            <label className="text-sm font-medium" htmlFor="userIds">User ids</label>
            <textarea id="userIds" name="userIds" required rows={4} className="rounded border px-3 py-2 text-sm dark:bg-gray-900" />
            <label className="text-sm font-medium" htmlFor="accountCohort">Cohort</label>
            <select id="accountCohort" name="accountCohort" required defaultValue="" className="rounded border px-3 py-2 text-sm dark:bg-gray-900">
              <option value="" disabled>Select…</option>
              {COHORTS.map((c) => (
                <option key={c} value={c}>{cohortLabel(c)}</option>
              ))}
            </select>
            <SubmitButton pendingText="Applying…" className="w-fit">Apply</SubmitButton>
          </ActionForm>
        </Card>
      </Section>
    </div>
  );
}
