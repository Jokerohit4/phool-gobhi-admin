import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
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
      <Link className="text-sm underline" href="/notifications"> Push campaigns</Link>
      <PageHeader title="New push campaign" subtitle="Draft a customer push campaign with its audience, timing, and content." />
      <CampaignForm options={options} action={createCampaign} />
    </div>
  );
}
