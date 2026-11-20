import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { InlineError } from '@/components/ui/InlineError';
import { gatewayJson } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { campaignApi, displayTime, type Campaign } from './campaigns';

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  await requireSession();
  const { before } = await searchParams;
  const result = await gatewayJson<{ data: Campaign[]; next: string | null }>(
    campaignApi + '/campaigns' + (before ? '?before=' + encodeURIComponent(before) : ''),
  ).then((data) => ({ data }), (error) => ({ error: error instanceof Error ? error.message : 'Could not load campaigns' }));

  if ('error' in result) {
    return (
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Notifications' }]} />
        <PageHeader title="Push campaigns" subtitle="Create and manage customer push notification campaigns." />
        <InlineError title="Could not load campaigns" message={result.error} retryHref="/notifications" />
      </div>
    );
  }

  const { data, next } = result.data;
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: 'Notifications' }]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Push campaigns" subtitle="Create and manage customer push notification campaigns." />
        <Link href="/notifications/new" className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white">New campaign</Link>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <Thead>
            <Th>Campaign</Th>
            <Th>Audience</Th>
            <Th>Trigger</Th>
            <Th>Status</Th>
            <Th>Next send</Th>
          </Thead>
          <tbody>
            {data.map((campaign) => (
              <Tr key={campaign.id}>
                <Td><Link className="font-medium underline" href={'/notifications/' + campaign.id}>{campaign.config.name}</Link></Td>
                <Td>{{ all: 'All eligible customers', cohorts: 'Account cohorts', users: 'Selected customers' }[campaign.config.audience.type]}</Td>
                <Td>{{ once: 'One-time', recurring: 'Recurring', event: 'Customer event' }[campaign.config.mode]}</Td>
                <Td className="capitalize">{campaign.status}</Td>
                <Td>{displayTime(campaign.next_at)}</Td>
              </Tr>
            ))}
            {data.length === 0 && <EmptyRow colSpan={5}>No campaigns on this page.</EmptyRow>}
          </tbody>
        </Table>
      </Card>

      {next && <Link className="text-sm underline" href={'/notifications?before=' + encodeURIComponent(next)}>Older campaigns</Link>}
    </div>
  );
}
