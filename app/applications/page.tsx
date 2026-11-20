import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { setApplicationReadAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTimeIST } from '@/lib/dateFormat';
import { InlineError } from '@/components/ui/InlineError';
import { Section } from '@/components/ui/Section';

interface JobApplication {
  id: number;
  jobOpeningId: number;
  jobTitle: string;
  name: string;
  email: string;
  phone: string;
  portfolioUrl: string | null;
  linkedinUrl: string | null;
  message: string;
  resumeUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export default async function ApplicationsPage() {
  await requireSession();
  let applications: JobApplication[] = [];
  let error = '';
  try {
    ({ data: applications } = await gatewayJson<{ data: JobApplication[] }>('/api/auth/admin/job-applications'));
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load job applications';
  }

  return (
    <div className="flex flex-col gap-8">
      <Section>
        <Breadcrumbs items={[{ label: 'Applications' }]} />
        <PageHeader title="Job applications" subtitle="Submissions from the website's /careers page." />
        {error && <InlineError title="Could not load applications" message={error} retryHref="/applications" />}
        <Table>
          <Thead>
            <Th>Status</Th>
            <Th>Role</Th>
            <Th>Applicant</Th>
            <Th>Links</Th>
            <Th>Message</Th>
            <Th>Resume</Th>
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
                  <p className="text-gray-500">{a.phone}</p>
                </Td>
                <Td>
                  <div className="flex flex-col gap-1">
                    {a.portfolioUrl && (
                      <a href={a.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline dark:text-emerald-400">
                        Portfolio
                      </a>
                    )}
                    {a.linkedinUrl && (
                      <a href={a.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline dark:text-emerald-400">
                        LinkedIn
                      </a>
                    )}
                    {!a.portfolioUrl && !a.linkedinUrl && <span className="text-gray-400">—</span>}
                  </div>
                </Td>
                <Td className="max-w-md whitespace-pre-wrap">{a.message}</Td>
                <Td>
                  {a.resumeUrl ? (
                    <a href={a.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline dark:text-emerald-400">
                      View
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </Td>
                <Td>{formatDateTimeIST(a.createdAt)}</Td>
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
            {!error && applications.length === 0 && <EmptyRow colSpan={8}>No applications yet.</EmptyRow>}
            {error && applications.length === 0 && <EmptyRow colSpan={8}>Could not load applications.</EmptyRow>}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}
