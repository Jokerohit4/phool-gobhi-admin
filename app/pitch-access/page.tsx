import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { addPitchAccessAction, removePitchAccessAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatDateIST } from '@/lib/dateFormat';

interface PitchAccessContact {
  id: number;
  type: 'email' | 'phone';
  value: string;
  note: string | null;
  createdAt: string;
}

export default async function PitchAccessPage() {
  await requireSession();
  const { data: contacts } = await gatewayJson<{ data: PitchAccessContact[] }>('/api/auth/admin/pitch-access');

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Pitch deck access"
          subtitle="Emails and phone numbers allowed to view /pitch-deck on the website."
        />
        <Table>
          <Thead>
            <Th>Type</Th>
            <Th>Value</Th>
            <Th>Note</Th>
            <Th>Added</Th>
            <Th>Action</Th>
          </Thead>
          <tbody>
            {contacts.map((c) => (
              <Tr key={c.id}>
                <Td className="capitalize">{c.type}</Td>
                <Td>{c.value}</Td>
                <Td>{c.note || '—'}</Td>
                <Td>{formatDateIST(c.createdAt)}</Td>
                <Td>
                  <ActionForm action={removePitchAccessAction} confirmMessage={`Remove ${c.value}?`}>
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton variant="danger" pendingText="Removing…">Remove</SubmitButton>
                  </ActionForm>
                </Td>
              </Tr>
            ))}
            {contacts.length === 0 && <EmptyRow colSpan={5}>No contacts on the list yet.</EmptyRow>}
          </tbody>
        </Table>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader title="Add contact" />
        <Card className="max-w-md">
          <ActionForm action={addPitchAccessAction} className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="type">Type</label>
            <select id="type" name="type" required className="rounded border px-3 py-2 text-sm">
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>

            <label className="text-sm font-medium" htmlFor="value">Value</label>
            <input id="value" name="value" required placeholder="name@example.com or 9876543210" className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="note">Note (optional)</label>
            <input id="note" name="note" placeholder="e.g. investor name" className="rounded border px-3 py-2 text-sm" />

            <SubmitButton pendingText="Adding…" className="w-fit">Add</SubmitButton>
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}
