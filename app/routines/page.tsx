import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { fetchRoutines, type Routine } from '@/lib/routinesApi';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { InlineError } from '@/components/ui/InlineError';
import { Section } from '@/components/ui/Section';
import { CATEGORIES, CATEGORY_LABELS, GOAL_LABELS, LANGS } from './routineForm';

export const dynamic = 'force-dynamic';

const pill = (active: boolean) =>
  `rounded px-3 py-1 text-sm font-medium ${
    active ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
  }`;

const mainCount = (r: Routine) => r.exercises.filter((e) => e.phase === 'main').length;

export default async function RoutinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const params = await searchParams;
  const category = typeof params.category === 'string' && (CATEGORIES as readonly string[]).includes(params.category) ? params.category : null;
  const hiddenOnly = params.status === 'hidden';

  let routines: Routine[] = [];
  let error = '';
  try {
    routines = await fetchRoutines();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load routines';
  }
  const shown = routines.filter((r) => (!category || r.category === category) && (!hiddenOnly || !r.isPublished));
  const href = (next: { category?: string | null; status?: string | null }) => {
    const q = new URLSearchParams();
    const c = next.category === undefined ? category : next.category;
    const s = next.status === undefined ? (hiddenOnly ? 'hidden' : null) : next.status;
    if (c) q.set('category', c);
    if (s) q.set('status', s);
    const qs = q.toString();
    return `/routines${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <Section>
        <Breadcrumbs items={[{ label: 'Routines' }]} />
        <PageHeader
          title="Routines"
          subtitle="The starter routines users browse and copy, and the routines coached plans schedule. Changes reach the app within a minute, with no release. Routines are unpublished, never deleted."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/routines/new" className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700">New routine</Link>
          <span className="mx-2 text-gray-300">|</span>
          <Link href={href({ category: null })} className={pill(!category)}>All</Link>
          {CATEGORIES.map((c) => (
            <Link key={c} href={href({ category: c })} className={pill(category === c)}>{CATEGORY_LABELS[c]}</Link>
          ))}
          <span className="mx-2 text-gray-300">|</span>
          <Link href={href({ status: hiddenOnly ? null : 'hidden' })} className={pill(hiddenOnly)}>Unpublished only</Link>
        </div>
        {error && <InlineError title="Could not load routines" message={error} retryHref="/routines" />}
        <Table>
          <Thead>
            <Th>Name</Th>
            <Th>Category</Th>
            <Th>Goal</Th>
            <Th>Level</Th>
            <Th>Exercises</Th>
            <Th>~Min</Th>
            <Th>Languages</Th>
            <Th>Status</Th>
          </Thead>
          <tbody>
            {shown.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <Link href={`/routines/${r.id}`} className="font-medium underline">{r.name}</Link>
                  <div className="text-xs text-gray-500">{r.key ?? 'no key'}</div>
                </Td>
                <Td>{CATEGORY_LABELS[r.category ?? ''] ?? '—'}</Td>
                <Td>{GOAL_LABELS[r.goal ?? ''] ?? '—'}</Td>
                <Td className="capitalize">{r.level ?? '—'}</Td>
                <Td>{mainCount(r)}</Td>
                <Td>{r.estMinutes ?? '—'}</Td>
                <Td>{LANGS.map((l) => (r.texts.some((t) => t.lang === l.key) ? l.key : null)).filter(Boolean).join(', ')}</Td>
                <Td><StatusBadge tone={r.isPublished ? 'active' : 'pending'}>{r.isPublished ? 'Published' : 'Unpublished'}</StatusBadge></Td>
              </Tr>
            ))}
            {shown.length === 0 && !error && <EmptyRow colSpan={8}>No routines match these filters.</EmptyRow>}
          </tbody>
        </Table>
        <p className="text-xs text-gray-500">{shown.length} of {routines.length} routines.</p>
      </Section>
    </div>
  );
}
