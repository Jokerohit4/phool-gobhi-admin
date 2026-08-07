import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { setMessageReadAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTimeIST } from '@/lib/dateFormat';

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default async function MessagesPage() {
  await requireSession();
  const { data: messages } = await gatewayJson<{ data: ContactMessage[] }>('/api/auth/admin/contact-messages');

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <PageHeader title="Contact messages" subtitle="Submissions from the website's /contact form." />
        <Table>
          <Thead>
            <Th>Status</Th>
            <Th>From</Th>
            <Th>Message</Th>
            <Th>Received</Th>
            <Th>Action</Th>
          </Thead>
          <tbody>
            {messages.map((m) => (
              <Tr key={m.id}>
                <Td>
                  <StatusBadge tone={m.isRead ? 'read' : 'unread'}>{m.isRead ? 'Read' : 'Unread'}</StatusBadge>
                </Td>
                <Td>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-gray-500">{m.email}</p>
                </Td>
                <Td className="max-w-md whitespace-pre-wrap">{m.message}</Td>
                <Td>{formatDateTimeIST(m.createdAt)}</Td>
                <Td>
                  <ActionForm action={setMessageReadAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="isRead" value={(!m.isRead).toString()} />
                    <SubmitButton variant="secondary" pendingText="Updating…">
                      {m.isRead ? 'Mark unread' : 'Mark read'}
                    </SubmitButton>
                  </ActionForm>
                </Td>
              </Tr>
            ))}
            {messages.length === 0 && <EmptyRow colSpan={5}>No messages yet.</EmptyRow>}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
