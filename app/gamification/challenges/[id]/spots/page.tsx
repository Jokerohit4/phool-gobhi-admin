import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { createSpotAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';

interface CheckpointSpot {
  id: number;
  sequence: number;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  code: string;
}

export default async function ChallengeSpotsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const { data: spots } = await gatewayJson<{ data: CheckpointSpot[] }>(`/api/challenges/admin/challenges/${id}/checkpoint-spots`);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <Link href="/gamification/challenges" className="text-sm text-emerald-600 underline">
          &larr; Back to challenges
        </Link>
        <PageHeader
          title={`Checkpoint spots — challenge #${id}`}
          subtitle="Each row is one printed sticker. The sticker's QR should encode this code (plain identifier, not a signed token — the GPS-radius check is the anti-replay defense, not the code)."
        />
        <Table>
          <Thead>
            <Th>#</Th>
            <Th>Label</Th>
            <Th>Lat</Th>
            <Th>Lng</Th>
            <Th>Radius (m)</Th>
            <Th>Code</Th>
          </Thead>
          <tbody>
            {spots.map((s) => (
              <Tr key={s.id}>
                <Td>{s.sequence}</Td>
                <Td>{s.label}</Td>
                <Td>{s.lat}</Td>
                <Td>{s.lng}</Td>
                <Td>{s.radiusMeters}</Td>
                <Td className="font-mono text-xs">{s.code}</Td>
              </Tr>
            ))}
            {spots.length === 0 && <EmptyRow colSpan={6}>No spots yet.</EmptyRow>}
          </tbody>
        </Table>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader title="Add a spot" />
        <Card className="max-w-md">
          <ActionForm action={createSpotAction} className="flex flex-col gap-3">
            <input type="hidden" name="challengeId" value={id} />

            <label className="text-sm font-medium" htmlFor="sequence">Sequence</label>
            <input id="sequence" name="sequence" type="number" min={0} defaultValue={spots.length + 1} className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="label">Label</label>
            <input id="label" name="label" required className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="lat">Latitude</label>
            <input id="lat" name="lat" type="number" step="any" required className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="lng">Longitude</label>
            <input id="lng" name="lng" type="number" step="any" required className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="radiusMeters">Radius (meters)</label>
            <input id="radiusMeters" name="radiusMeters" type="number" min={10} defaultValue={75} className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="code">Code (encoded in the sticker&rsquo;s QR)</label>
            <input id="code" name="code" required placeholder="CKPT-XYZ" className="rounded border px-3 py-2 text-sm" />

            <SubmitButton pendingText="Adding…" className="w-fit">Add spot</SubmitButton>
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}
