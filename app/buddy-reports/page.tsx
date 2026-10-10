import { requireSession } from '@/lib/auth';
import { fetchGenderChanges, fetchReports } from '@/lib/buddyApi';
import type { BuddyReport, GenderChange } from '@/lib/buddyApi';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatDateTimeIST } from '@/lib/dateFormat';
import { ReportRow } from './ReportRow';
import { clearGenderChangeAction } from './actions';
import { REPORT_STATUSES, REPORT_STATUS_LABELS } from './reportDisplay';

export const dynamic = 'force-dynamic';

const STATUS_VALUES = ['open', 'actioned', 'dismissed'] as const;
type StatusTab = (typeof STATUS_VALUES)[number];

function isStatusTab(value: string | undefined): value is StatusTab {
  return value != null && (STATUS_VALUES as readonly string[]).includes(value);
}

// Matches the pill style used by the food-requests queue's sub-tabs.
function tabClass(active: boolean, tone: 'top' | 'subtle' = 'top'): string {
  const base = 'rounded px-3 py-1 text-sm font-medium';
  if (tone === 'top') {
    return `${base} ${
      active
        ? 'bg-emerald-600 text-white'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
    }`;
  }
  return `${base} ${
    active
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }`;
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <a href={href} className={tabClass(active)}>
      {children}
    </a>
  );
}

export default async function BuddyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  await requireSession();
  const params = await searchParams;
  const tab = params.tab === 'gender' ? 'gender' : 'reports';
  const status: StatusTab = isStatusTab(params.status) ? params.status : 'open';

  let reports: BuddyReport[] = [];
  let genderChanges: GenderChange[] = [];
  let loadError: string | null = null;

  try {
    if (tab === 'gender') {
      genderChanges = await fetchGenderChanges();
    } else {
      reports = await fetchReports(status);
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Could not load buddy moderation data';
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Buddy reports"
        subtitle="Safety reports from gym buddy, ordered by severity then newest. Moderation works even while gym buddy is switched off."
      />

      <div className="flex gap-2">
        <TabLink href="/buddy-reports" active={tab === 'reports'}>
          Reports
        </TabLink>
        <TabLink href="/buddy-reports?tab=gender" active={tab === 'gender'}>
          Gender changes
        </TabLink>
      </div>

      {loadError && (
        <Card className="border-red-300 text-sm text-red-700 dark:border-red-800 dark:text-red-400">
          {loadError}
        </Card>
      )}

      {tab === 'reports' && (
        <section className="flex flex-col gap-4">
          <div className="flex gap-2">
            {REPORT_STATUSES.map((s) => (
              <a
                key={s}
                href={`/buddy-reports?status=${s}`}
                className={tabClass(status === s, 'subtle')}
              >
                {REPORT_STATUS_LABELS[s]}
              </a>
            ))}
          </div>

          <Table>
            <Thead>
              <Th>Status</Th>
              <Th>Report</Th>
              <Th>People</Th>
              <Th>Reported profile</Th>
              <Th>Submitted</Th>
              <Th>Actions</Th>
            </Thead>
            <tbody>
              {reports.map((report) => (
                <ReportRow key={report.id} report={report} />
              ))}
              {!loadError && reports.length === 0 && (
                <EmptyRow colSpan={6}>
                  {status === 'open'
                    ? 'No open reports — the queue is clear.'
                    : `No ${REPORT_STATUS_LABELS[status].toLowerCase()} reports.`}
                </EmptyRow>
              )}
            </tbody>
          </Table>
        </section>
      )}

      {tab === 'gender' && (
        <section className="flex flex-col gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Users blocked from women-only discovery because they changed their gender to
            female. Clear restores them once the change is verified as genuine.
          </p>
          <Table>
            <Thead>
              <Th>User</Th>
              <Th>Changed at</Th>
              <Th>Changed to</Th>
              <Th>Cleared</Th>
              <Th>Actions</Th>
            </Thead>
            <tbody>
              {genderChanges.map((g) => (
                <Tr key={g.userId}>
                  <Td>
                    <p className="font-medium">{g.firstName ?? `#${g.userId}`}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">#{g.userId}</p>
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {g.genderChangedAt ? formatDateTimeIST(g.genderChangedAt) : '—'}
                  </Td>
                  <Td>{g.genderChangedTo ?? '—'}</Td>
                  <Td className="whitespace-nowrap text-xs">
                    {g.genderChangeClearedAt ? formatDateTimeIST(g.genderChangeClearedAt) : 'Never'}
                  </Td>
                  <Td>
                    <ActionForm action={clearGenderChangeAction}>
                      <input type="hidden" name="userId" value={g.userId} />
                      <SubmitButton variant="secondary" pendingText="Clearing…">
                        Clear
                      </SubmitButton>
                    </ActionForm>
                  </Td>
                </Tr>
              ))}
              {!loadError && genderChanges.length === 0 && (
                <EmptyRow colSpan={5}>No blocked gender changes.</EmptyRow>
              )}
            </tbody>
          </Table>
        </section>
      )}
    </div>
  );
}
