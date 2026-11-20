import { ActionForm } from '@/components/ui/ActionForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { gatewayJson } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { controlCampaign, updateCampaign } from '../actions';
import { CampaignForm, NotificationPreview } from '../CampaignForm';
import { campaignApi, displayTime, type Campaign, type CampaignOptions, type Run } from '../campaigns';
import { InlineError } from '@/components/ui/InlineError';

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const path = campaignApi + '/campaigns/' + encodeURIComponent(id);

  let loaded: { campaign: Campaign; runs: Run[]; options: CampaignOptions } | null = null;
  let error = '';
  try {
    const [{ data: campaign }, { data: runs }, options] = await Promise.all([
      gatewayJson<{ data: Campaign }>(path),
      gatewayJson<{ data: Run[] }>(path + '/runs'),
      gatewayJson<CampaignOptions>(campaignApi + '/options'),
    ]);
    loaded = { campaign, runs, options };
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load campaign';
  }

  if (!loaded) {
    return (
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Notifications', href: '/notifications' }, { label: 'Campaign' }]} />
        <PageHeader title="Campaign" />
        <InlineError title="Could not load campaign" message={error} retryHref={`/notifications/${id}`} />
      </div>
    );
  }

  const { campaign, runs, options } = loaded;
  const { config, status } = campaign;
  const resumable = status === 'draft' || status === 'paused';
  const editable = resumable && (config.mode !== 'once' || campaign.run_count === 0);
  const counts = ['queued', 'sending', 'accepted', 'failed', 'skipped', 'unknown'];

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: 'Notifications', href: '/notifications' }, { label: config.name }]} />
      <PageHeader title={config.name} subtitle={<span className="capitalize">{status}{campaign.next_at && '  ' + displayTime(campaign.next_at)}</span>} />

      <Card>
        <div className="flex flex-wrap items-start gap-3">
          {resumable && (
            <ActionForm action={controlCampaign.bind(null, id, 'activate')} confirmMessage="Activate this campaign with its saved audience and timing?">
              <SubmitButton pendingText="Activating?">{status === 'paused' ? 'Resume' : 'Activate'}</SubmitButton>
            </ActionForm>
          )}
          {status === 'active' && (
            <ActionForm action={controlCampaign.bind(null, id, 'pause')}>
              <SubmitButton pendingText="Pausing?">Pause</SubmitButton>
            </ActionForm>
          )}
          {!['cancelled', 'completed'].includes(status) && (
            <ActionForm action={controlCampaign.bind(null, id, 'cancel')} confirmMessage="Cancel this campaign and discard pending campaign sends?">
              <SubmitButton pendingText="Cancelling?" variant="danger">Cancel campaign</SubmitButton>
            </ActionForm>
          )}
          {status !== 'cancelled' && (
            <ActionForm action={controlCampaign.bind(null, id, 'test')} className="flex flex-wrap items-center gap-2">
              <input aria-label="Test customer ID" className="rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" name="userId" type="number" min={1} max={2147483647} placeholder="Test customer ID" required />
              <SubmitButton pendingText="Queuing?">Send test</SubmitButton>
            </ActionForm>
          )}
        </div>
      </Card>

      {editable ? <CampaignForm key={JSON.stringify(config)} options={options} config={config} action={updateCampaign.bind(null, id)} /> : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)]">
          <Card>
            <dl className="grid content-start gap-2 text-sm">
              <dt className="font-semibold">Audience</dt>
              <dd>{config.audience.type === 'all' ? 'All eligible customers' : (config.audience.cohorts ?? config.audience.userIds)?.join(', ')}</dd>
              <dt className="font-semibold">Trigger</dt>
              <dd>{config.mode === 'event' ? options.events[config.event ?? ''] : config.mode === 'recurring' ? 'Recurring' : 'One-time'}</dd>
              <dt className="font-semibold">Starts</dt><dd>{config.startAt ? displayTime(config.startAt) : 'On activation'}</dd>
              {config.endAt && <><dt className="font-semibold">Ends</dt><dd>{displayTime(config.endAt)}</dd></>}
              {config.mode === 'recurring' && <><dt className="font-semibold">Repeat</dt><dd>Every {config.intervalMinutes} minutes, up to {config.maxRuns} sends</dd></>}
              {config.mode === 'event' && <><dt className="font-semibold">Event delivery</dt><dd>{config.delayMinutes} min delay, {config.cooldownMinutes} min cooldown, up to {config.maxPerUser} per customer</dd></>}
            </dl>
          </Card>
          <NotificationPreview {...config} />
        </div>
      )}

      <section className="flex flex-col gap-3">
        <PageHeader title="Recent delivery runs" subtitle="Accepted means Firebase accepted the send request. Unknown indicates the result could not be confirmed." />
        <Card className="p-0 overflow-hidden">
          <Table>
            <Thead>
              <Th>Scheduled for</Th>
              <Th>Run</Th>
              {counts.map((label) => <Th key={label}><span className="capitalize">{label}</span></Th>)}
            </Thead>
            <tbody>
              {runs.map((run) => (
                <Tr key={run.id}>
                  <Td className="whitespace-nowrap">{displayTime(run.due_at)}</Td>
                  <Td className="capitalize">{run.kind}{!run.expanded && '  selecting audience'}</Td>
                  {counts.map((label) => <Td key={label}>{run.counts[label] ?? 0}</Td>)}
                </Tr>
              ))}
              {runs.length === 0 && <EmptyRow colSpan={2 + counts.length}>No delivery runs yet.</EmptyRow>}
            </tbody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
