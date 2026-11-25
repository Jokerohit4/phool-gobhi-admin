import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { GatewayError } from '@/lib/api';
import { parsePositiveId } from '@/lib/ids';
import { fetchRoutine, type Routine } from '@/lib/routinesApi';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { InlineError } from '@/components/ui/InlineError';
import { RoutineEditor } from '../RoutineEditor';

export const dynamic = 'force-dynamic';

export default async function EditRoutinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const id = parsePositiveId((await params).id);
  if (id === null) notFound();
  const created = (await searchParams).created === '1';

  let routine: Routine;
  try {
    routine = await fetchRoutine(id);
  } catch (e) {
    if (e instanceof GatewayError && e.status === 404) notFound();
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: 'Routines', href: '/routines' }, { label: 'Routine' }]} />
        <InlineError title="Could not load this routine" message={e instanceof Error ? e.message : 'Could not load this routine'} retryHref={`/routines/${id}`} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Routines', href: '/routines' }, { label: routine.name }]} />
      <PageHeader
        title={routine.name}
        subtitle={created ? 'Created. It is unpublished until you tick Published.' : 'Edit the routine. Saving replaces its exercise list.'}
      />
      <RoutineEditor routine={routine} />
    </div>
  );
}
