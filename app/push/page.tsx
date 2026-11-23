import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { FilterBar } from '@/components/ui/FilterBar';
import { InlineError } from '@/components/ui/InlineError';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { StatTile } from '@/components/charts/StatTile';
import { SectionHeading } from '@/components/charts/SectionHeading';
import { PushTrendChart } from '@/components/charts/PushTrendChart';
import {
  PUSH_DAYS, PUSH_PLATFORMS, PUSH_ROLES,
  parsePushFilters, parsePushSort, pushFunnelQuery, pushHref, sortPushTypes, typeOptions,
  formatRate, formatCount, formatDuration, funnelSteps, hasNoPushEvents, unknownPlatformShare,
  type PushFilters, type PushFunnelData, type PushSort, type PushSortKey, type PushTypesData,
} from '@/lib/pushAnalytics';

export const metadata = { title: 'Push analytics' };

const COLUMNS: { key: PushSortKey; label: string; numeric: boolean }[] = [
  { key: 'type', label: 'Push type', numeric: false },
  { key: 'sent', label: 'Sent', numeric: true },
  { key: 'failed', label: 'Failed', numeric: true },
  { key: 'delivered', label: 'Delivered', numeric: true },
  { key: 'opened', label: 'Opened', numeric: true },
  { key: 'deliveredRate', label: 'Delivered %', numeric: true },
  { key: 'openRate', label: 'Open %', numeric: true },
];

export default async function PushAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; type?: string; platform?: string; role?: string; sort?: string; dir?: string }>;
}) {
  await requireSession();
  const raw = await searchParams;
  const filters = parsePushFilters(raw);
  const sort = parsePushSort(raw.sort, raw.dir);

  // Parallel, server-side. The type list is cosmetic (filter dropdown), so a
  // failure there never blocks the funnel and vice versa.
  const [funnelRes, typesRes] = await Promise.allSettled([
    gatewayJson<{ data: PushFunnelData }>(`/api/bookings/admin/analytics/push-funnel?${pushFunnelQuery(filters)}`),
    gatewayJson<{ data: PushTypesData }>(`/api/bookings/admin/analytics/push-types?days=${filters.days}`),
  ]);
  if (funnelRes.status === 'rejected') console.error('push-funnel failed', funnelRes.reason);
  if (typesRes.status === 'rejected') console.error('push-types failed', typesRes.reason);

  const types = typesRes.status === 'fulfilled' ? typesRes.value.data.types : undefined;
  const options = typeOptions(types, filters.type);

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: 'Push analytics' }]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Push analytics"
          subtitle="Every push the backend sends, followed from sent to delivered to opened."
        />
        <Link href="/notifications" className="rounded border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          Push campaigns
        </Link>
      </div>

      <Filters filters={filters} sort={sort} options={options} typesFailed={typesRes.status === 'rejected'} />

      {funnelRes.status === 'rejected' ? (
        <Card>
          <InlineError
            title="Push analytics are unavailable"
            message={funnelRes.reason instanceof Error ? funnelRes.reason.message : 'Could not load push analytics.'}
            retryHref={pushHref(filters, sort)}
          />
        </Card>
      ) : (
        <FunnelBody data={funnelRes.value.data} filters={filters} sort={sort} />
      )}
    </div>
  );
}

function Filters({ filters, sort, options, typesFailed }: { filters: PushFilters; sort: PushSort; options: string[]; typesFailed: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {PUSH_DAYS.map((d) => (
          <Link
            key={d}
            href={pushHref(filters, sort, { days: String(d) })}
            aria-current={d === filters.days ? 'true' : undefined}
            className={`rounded px-2.5 py-1 text-sm transition-colors ${
              d === filters.days
                ? 'bg-gray-800 font-medium text-white dark:bg-gray-200 dark:text-gray-900'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            {d} days
          </Link>
        ))}
      </div>
      <form action="/push" method="get">
        <input type="hidden" name="days" value={filters.days} />
        <input type="hidden" name="sort" value={sort.key} />
        <input type="hidden" name="dir" value={sort.dir} />
        <FilterBar>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Push type
            <select name="type" defaultValue={filters.type} className="rounded border bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
              <option value="">All types</option>
              {options.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Platform
            <select name="platform" defaultValue={filters.platform} className="rounded border bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
              <option value="">All platforms</option>
              {PUSH_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Recipient role
            <select name="role" defaultValue={filters.role} className="rounded border bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
              <option value="">All roles</option>
              {PUSH_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <button type="submit" className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white">Apply</button>
          <Link href={pushHref({ ...filters, type: '', platform: '', role: '' }, sort)} className="py-1.5 text-sm text-gray-500 underline">Clear filters</Link>
        </FilterBar>
      </form>
      {typesFailed && <p className="text-xs text-amber-700 dark:text-amber-400">The push type list could not be loaded, so the type dropdown is limited to the current selection.</p>}
    </div>
  );
}

function FunnelBody({ data, filters, sort }: { data: PushFunnelData; filters: PushFilters; sort: PushSort }) {
  const t = data.totals;
  const noEvents = hasNoPushEvents(t);
  const filtered = Boolean(filters.type || filters.platform || filters.role);

  if (noEvents) {
    return (
      <Card>
        <div className="py-8 text-center text-sm text-gray-500">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {filtered ? 'No pushes match these filters in this window.' : 'No push events yet.'}
          </p>
          <p className="mt-1">
            {filtered
              ? 'Try clearing a filter or widening the window.'
              : 'The apps and the backend only just started recording pushes. Sends from before this release carry no notification id and are not counted. Data appears here after the next push goes out.'}
          </p>
        </div>
      </Card>
    );
  }

  const steps = funnelSteps(t);
  const maxValue = Math.max(1, ...steps.map((s) => s.value));
  const unknownShare = unknownPlatformShare(data.byPlatform);
  const rows = sortPushTypes(data.byType, sort);

  return (
    <>
      <div className="rounded border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200" role="note">
        <p className="font-medium">How to read delivered</p>
        <p className="mt-1">
          Sent means the push provider (FCM) accepted the message. Delivered is a lower bound: the phone can show a push without
          running any app code (especially when the app is killed or in the background, and on iOS), so it never reports a delivery.
          Every open is counted as delivered. Opened is the reliable stage.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        <StatTile label="Sent" value={formatCount(t.sent)} hint="Accepted by FCM" />
        <StatTile label="Failed" value={formatCount(t.failed)} status={t.failed > 0 ? 'warning' : 'default'} hint="Rejected by FCM" />
        <StatTile label="Delivered" value={formatCount(t.delivered)} hint="Lower bound" />
        <StatTile label="Opened" value={formatCount(t.opened)} />
        <StatTile label="Delivered rate" value={formatRate(t.deliveredRate)} hint="Delivered / sent" />
        <StatTile label="Open rate" value={formatRate(t.openRate)} hint="Opened / sent" />
        <StatTile label="Open of delivered" value={formatRate(t.openOfDeliveredRate)} hint="Opened / delivered" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading title="Funnel" subtitle="Sent to delivered to opened, as a share of sent" />
          <div className="flex flex-col gap-3">
            {steps.map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-sm">
                  <span>{s.label}</span>
                  <span className="tabular-nums text-gray-600 dark:text-gray-300">{formatCount(s.value)} · {formatRate(s.pctOfSent)}</span>
                </div>
                <div className="mt-1 h-3 rounded bg-gray-100 dark:bg-gray-800">
                  <div className="h-3 rounded bg-emerald-500" style={{ width: `${Math.max(2, (s.value / maxValue) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionHeading title="Time to open" subtitle={`Send to first open, based on ${formatCount(data.timeToOpenSeconds.count)} opens`} />
          <div className="grid grid-cols-2 gap-4">
            <StatTile label="Median (p50)" value={formatDuration(data.timeToOpenSeconds.p50)} />
            <StatTile label="Slowest 10% (p90)" value={formatDuration(data.timeToOpenSeconds.p90)} />
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeading title="Daily trend" subtitle="By day of send (IST)" />
        <PushTrendChart points={data.byDay} />
      </Card>

      <Card>
        <SectionHeading title="By push type" subtitle="Click a column to sort" />
        <Table>
          <Thead>
            {COLUMNS.map((c) => {
              const active = sort.key === c.key;
              const nextDir = active && sort.dir === 'desc' ? 'asc' : 'desc';
              return (
                <Th key={c.key} className={c.numeric ? 'text-right' : ''}>
                  <Link href={pushHref(filters, sort, { sort: c.key, dir: c.key === 'type' && !active ? 'asc' : nextDir })} className="hover:underline">
                    {c.label}{active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </Link>
                </Th>
              );
            })}
          </Thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.type}>
                <Td>{r.type}</Td>
                <Td className="text-right tabular-nums">{formatCount(r.sent)}</Td>
                <Td className="text-right tabular-nums">{formatCount(r.failed)}</Td>
                <Td className="text-right tabular-nums">{formatCount(r.delivered)}</Td>
                <Td className="text-right tabular-nums">{formatCount(r.opened)}</Td>
                <Td className="text-right tabular-nums">{formatRate(r.deliveredRate)}</Td>
                <Td className="text-right tabular-nums">{formatRate(r.openRate)}</Td>
              </Tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={COLUMNS.length}>No push types in this window.</EmptyRow>}
          </tbody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading
            title="By platform"
            subtitle={
              unknownShare != null && unknownShare > 0
                ? `${formatRate(unknownShare)} of sends have an unknown platform. That is expected until the updated apps ship and report it.`
                : undefined
            }
          />
          <Table>
            <Thead>
              <Th>Platform</Th>
              <Th className="text-right">Sent</Th>
              <Th className="text-right">Delivered</Th>
              <Th className="text-right">Opened</Th>
            </Thead>
            <tbody>
              {data.byPlatform.map((p) => (
                <Tr key={p.platform}>
                  <Td>{p.platform}</Td>
                  <Td className="text-right tabular-nums">{formatCount(p.sent)}</Td>
                  <Td className="text-right tabular-nums">{formatCount(p.delivered)}</Td>
                  <Td className="text-right tabular-nums">{formatCount(p.opened)}</Td>
                </Tr>
              ))}
              {data.byPlatform.length === 0 && <EmptyRow colSpan={4}>No platform data.</EmptyRow>}
            </tbody>
          </Table>
        </Card>
        <Card>
          <SectionHeading title="Failures by error code" subtitle="FCM rejections in this window" />
          <Table>
            <Thead>
              <Th>Error code</Th>
              <Th className="text-right">Count</Th>
            </Thead>
            <tbody>
              {data.failuresByCode.map((f) => (
                <Tr key={f.code}>
                  <Td>{f.code}</Td>
                  <Td className="text-right tabular-nums">{formatCount(f.count)}</Td>
                </Tr>
              ))}
              {data.failuresByCode.length === 0 && <EmptyRow colSpan={2}>No failures in this window.</EmptyRow>}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
