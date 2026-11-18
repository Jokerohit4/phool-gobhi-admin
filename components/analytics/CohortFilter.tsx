import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { COHORT_PRESETS, cohortSummary } from '@/lib/cohortFilter';

// Server component: every choice is a plain link that rewrites ?cohort=, so the
// selection survives navigation between views and day ranges.
// `baseHref` is the current URL with every parameter except `cohort`.
export function CohortFilter({ baseHref, cohort, note }: { baseHref: string; cohort: string; note?: string }) {
  const custom = !COHORT_PRESETS.some((p) => p.value === cohort);
  const style = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm ${active
      ? 'bg-emerald-600 font-medium text-white'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`;
  return (
    <Card>
      <nav aria-label="Account cohort" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-gray-500">Accounts</span>
        {COHORT_PRESETS.map((p) => (
          <Link
            key={p.value}
            href={p.value === 'all' ? baseHref : `${baseHref}&cohort=${encodeURIComponent(p.value)}`}
            aria-current={p.value === cohort ? 'true' : undefined}
            title={'hint' in p ? p.hint : undefined}
            className={style(p.value === cohort)}
          >
            {p.label}
          </Link>
        ))}
        {custom && <span className={style(true)}>{cohortSummary(cohort)}</span>}
      </nav>
      {cohort !== 'all' && (
        <p className="mt-2 text-xs text-gray-500">
          Showing {cohortSummary(cohort)} only. Anonymous visitors count as Unknown users.
          {note ? ` ${note}` : ''}
        </p>
      )}
    </Card>
  );
}
