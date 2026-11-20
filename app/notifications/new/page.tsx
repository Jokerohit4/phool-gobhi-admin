import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { gatewayJson } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { campaignApi, type CampaignOptions } from '../campaigns';
import { CampaignForm } from '../CampaignForm';
import { createCampaign } from '../actions';
import { InlineError } from '@/components/ui/InlineError';

export default async function NewCampaignPage() {
  await requireSession();
  let options: CampaignOptions | null = null;
  let error = '';
  try {
    options = await gatewayJson<CampaignOptions>(campaignApi + '/options');
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load campaign options';
  }
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: 'Notifications', href: '/notifications' }, { label: 'New campaign' }]} />
      <PageHeader title="New push campaign" subtitle="Draft a customer push campaign with its audience, timing, and content." />
      {error && <InlineError title="Could not load campaign options" message={error} retryHref="/notifications/new" />}
      {options && <CampaignForm options={options} action={createCampaign} />}
    </div>
  );
}
