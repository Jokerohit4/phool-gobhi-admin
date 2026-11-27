import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { formatDateTimeIST } from '@/lib/dateFormat';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { InlineError } from '@/components/ui/InlineError';
import { CATALOG_PATH, type ConfigResponse } from './config';
import { LegacyEditor } from './LegacyEditor';
import { CatalogEditor } from './CatalogEditor';

export default async function CoachingPlansPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  await requireSession();
  const [result] = await Promise.allSettled([gatewayJson<{ data: ConfigResponse }>(CATALOG_PATH)]);
  const region = (await searchParams).region === 'REST_INDIA' ? 'REST_INDIA' : 'GURUGRAM';

  return <div className="space-y-5">
    <Breadcrumbs items={[{ label: 'Coaching catalog' }]} />
    <PageHeader title="Coaching catalog" subtitle="Published changes apply to new purchases." />
    <div className="flex flex-wrap gap-4 text-sm">
      <Link href="/fulfillment" className="underline">Fulfillment</Link>
      <Link href="/coupons" className="underline">Coupons</Link>
      <Link href="/reports" className="underline">Saved reports</Link>
    </div>
    {result.status === 'rejected' ? (
      <InlineError title="Could not load catalog" message={result.reason instanceof Error ? result.reason.message : 'Could not load catalog'} retryHref="/coaching-plans" />
    ) : <Catalog data={result.value.data} region={region} />}
  </div>;
}

function Catalog({ data, region }: { data: ConfigResponse; region: 'GURUGRAM' | 'REST_INDIA' }) {
  return <>
    <p className="text-sm text-gray-500">
      Version {data.version}
      {data.updatedAt && <> · Last saved {formatDateTimeIST(data.updatedAt)} IST by staff #{data.updatedBy}</>}
    </p>
    {data.config.schemaVersion === 2
      ? <CatalogEditor catalog={data.config} version={data.version} />
      : <LegacyEditor key={region} config={data.config} version={data.version} region={region} />}
    <details className="rounded border p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Change history</summary>
      <ul className="mt-3 space-y-2">
        {data.history?.map(change => <li key={change.version}>Version {change.version} · Staff #{change.updatedBy} · {formatDateTimeIST(change.createdAt)} IST</li>)}
        {!data.history?.length && <li>No published changes yet.</li>}
      </ul>
    </details>
  </>;
}
