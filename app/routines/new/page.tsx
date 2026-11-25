import { requireSession } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { RoutineEditor } from '../RoutineEditor';

export const dynamic = 'force-dynamic';

export default async function NewRoutinePage() {
  await requireSession();
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Routines', href: '/routines' }, { label: 'New routine' }]} />
      <PageHeader title="New routine" subtitle="It starts unpublished: tick Published when it is ready for users." />
      <RoutineEditor />
    </div>
  );
}
