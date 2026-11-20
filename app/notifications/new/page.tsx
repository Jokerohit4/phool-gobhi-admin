import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { gatewayJson } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { campaignApi, type CampaignOptions } from '../campaigns';
import { CampaignForm } from '../CampaignForm';
import { createCampaign } from '../actions';

export default async function NewCampaignPage() {
  await requireSession();
  const options = await gatewayJson<CampaignOptions>(campaignApi + '/options');
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: 'Notifications', href: '/notifications' }, { label: 'New campaign' }]} />
      <PageHeader title="New push campaign" subtitle="Draft a customer push campaign with its audience, timing, and content." />
      <CampaignForm options={options} action={createCampaign} />
    </div>
  );
}
