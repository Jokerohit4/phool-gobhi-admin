import { requireSession } from '@/lib/auth';
import { fetchContentQueue, fetchPendingCount, type ContentQueue } from '@/lib/contentApi';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { ContentItem } from './ContentItem';
import {
  CONTENT_LANGS,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  filterHref,
  LANG_LABELS,
  parseFilters,
  STATUS_LABELS,
  type QueueFilters,
} from './contentDisplay';

export const dynamic = 'force-dynamic';

// Matches the pill style used by the food-requests and buddy-reports queues.
function pillClass(active: boolean): string {
  return `rounded px-3 py-1 text-sm font-medium ${
    active
      ? 'bg-emerald-600 text-white'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
  }`;
}

function FilterRow({
  label,
  options,
}: {
  label: string;
  options: { key: string; label: string; href: string; active: boolean }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{label}</span>
      {options.map((o) => (
        <a key={o.key} href={o.href} className={pillClass(o.active)}>
          {o.label}
        </a>
      ))}
    </div>
  );
}

const TYPE_LABELS = { exercise: 'Exercises', article: 'Articles' } as const;

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const filters: QueueFilters = parseFilters(await searchParams);
  const selfHref = filterHref(filters, {});

  // The queue and the three per-language counters load independently: a
  // failed counter shows "—" instead of taking the queue down with it.
  const [queueResult, ...countResults] = await Promise.allSettled([
    fetchContentQueue(filters),
    ...CONTENT_LANGS.map((lang) => fetchPendingCount(lang)),
  ]);

  const queue: ContentQueue | null = queueResult.status === 'fulfilled' ? queueResult.value : null;
  const loadError =
    queueResult.status === 'rejected'
      ? queueResult.reason instanceof Error
        ? queueResult.reason.message
        : 'Could not load the content queue'
      : null;
  const counts = CONTENT_LANGS.map((lang, i) => {
    const r = countResults[i] as PromiseSettledResult<number>;
    return { lang, value: r.status === 'fulfilled' ? String(r.value) : '—' };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Content"
        subtitle="Coach exercise copy and articles waiting for a human check. Nothing reaches users until it is approved, and any edit sends it back to pending. Highlighted lines carry safety words or numbers — compare them with the English line by line."
      />

      <div className="flex flex-wrap gap-3">
        {counts.map((c) => (
          <Card key={c.lang} className="min-w-32 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{LANG_LABELS[c.lang]} pending</p>
            <p className="text-2xl font-semibold">{c.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <FilterRow
          label="Type"
          options={[
            { key: 'all', label: 'All', href: filterHref(filters, { type: null }), active: !filters.type },
            ...CONTENT_TYPES.map((t) => ({
              key: t,
              label: TYPE_LABELS[t],
              href: filterHref(filters, { type: t }),
              active: filters.type === t,
            })),
          ]}
        />
        <FilterRow
          label="Language"
          options={[
            { key: 'all', label: 'All', href: filterHref(filters, { lang: null }), active: !filters.lang },
            ...CONTENT_LANGS.map((l) => ({
              key: l,
              label: LANG_LABELS[l],
              href: filterHref(filters, { lang: l }),
              active: filters.lang === l,
            })),
          ]}
        />
        <FilterRow
          label="Status"
          options={CONTENT_STATUSES.map((s) => ({
            key: s,
            label: STATUS_LABELS[s],
            href: filterHref(filters, { status: s }),
            active: filters.status === s,
          }))}
        />
      </div>

      {loadError && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-red-300 text-sm text-red-700 dark:border-red-800 dark:text-red-400">
          <span>Could not load the content queue: {loadError}</span>
          <a
            href={selfHref}
            className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
          >
            Retry
          </a>
        </Card>
      )}

      {queue && queue.items.length === 0 && (
        <Card className="text-sm text-gray-500 dark:text-gray-400">
          {filters.status === 'pending'
            ? 'Nothing waiting for review'
            : `No ${STATUS_LABELS[filters.status].toLowerCase()} items for these filters.`}
        </Card>
      )}

      {queue && queue.items.length > 0 && (
        <section className="flex flex-col gap-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {queue.total} item{queue.total === 1 ? '' : 's'}, oldest update first.
          </p>
          {queue.items.map((item) => (
            <ContentItem key={`${item.type}-${item.id}`} item={item} />
          ))}
        </section>
      )}
    </div>
  );
}
