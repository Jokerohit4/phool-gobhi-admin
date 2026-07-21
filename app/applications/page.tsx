import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { setApplicationReadAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface JobApplication {
  id: number;
  jobOpeningId: number;
  jobTitle: string;
  name: string;
  email: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default async function ApplicationsPage() {
  await requireSession();
  const { data: applications } = await gatewayJson<{ data: JobApplication[] }>('/api/auth/admin/job-applications');

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <PageHeader title="Job applications" subtitle="Submissions from the website's /careers page." />
        <Table>
          <Thead>
            <Th>Status</Th>
            <Th>Role</Th>
            <Th>Applicant</Th>
            <Th>Message</Th>
            <Th>Received</Th>
            <Th>Action</Th>
          </Thead>
          <tbody>
            {applications.map((a) => (
              <Tr key={a.id}>
                <Td>
                  <StatusBadge tone={a.isRead ? 'read' : 'unread'}>{a.isRead ? 'Read' : 'Unread'}</StatusBadge>
                </Td>
                <Td>{a.jobTitle}</Td>
                <Td>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-gray-500">{a.email}</p>
                </Td>
                <Td className="max-w-md whitespace-pre-wrap">{a.message}</Td>
                <Td>{new Date(a.createdAt).toLocaleString()}</Td>
                <Td>
                  <ActionForm action={setApplicationReadAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="isRead" value={(!a.isRead).toString()} />
                    <SubmitButton variant="secondary" pendingText="Updating…">
                      {a.isRead ? 'Mark unread' : 'Mark read'}
                    </SubmitButton>
                  </ActionForm>
                </Td>
              </Tr>
            ))}
            {applications.length === 0 && <EmptyRow colSpan={6}>No applications yet.</EmptyRow>}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
