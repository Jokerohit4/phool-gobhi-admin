import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { createJobOpeningAction, setJobOpeningActiveAction, deleteJobOpeningAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatDateIST } from '@/lib/dateFormat';

interface JobOpening {
  id: number;
  title: string;
  department: string;
  location: string;
  employmentType: 'full_time' | 'part_time' | 'internship' | 'contract';
  description: string;
  isActive: boolean;
  createdAt: string;
}

const EMPLOYMENT_TYPE_LABELS: Record<JobOpening['employmentType'], string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  internship: 'Internship',
  contract: 'Contract',
};

export default async function JobsPage() {
  await requireSession();
  const { data: jobs } = await gatewayJson<{ data: JobOpening[] }>('/api/auth/admin/jobs');

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Job openings"
          subtitle="Shown on the website's /careers page while open. Closing hides a listing without deleting its history."
        />
        <Table>
          <Thead>
            <Th>Title</Th>
            <Th>Department</Th>
            <Th>Location</Th>
            <Th>Type</Th>
            <Th>Status</Th>
            <Th>Posted</Th>
            <Th>Actions</Th>
          </Thead>
          <tbody>
            {jobs.map((job) => (
              <Tr key={job.id}>
                <Td>{job.title}</Td>
                <Td>{job.department}</Td>
                <Td>{job.location}</Td>
                <Td>{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</Td>
                <Td>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      job.isActive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {job.isActive ? 'Open' : 'Closed'}
                  </span>
                </Td>
                <Td>{formatDateIST(job.createdAt)}</Td>
                <Td className="flex flex-wrap gap-2">
                  <ActionForm action={setJobOpeningActiveAction}>
                    <input type="hidden" name="id" value={job.id} />
                    <input type="hidden" name="isActive" value={(!job.isActive).toString()} />
                    <SubmitButton variant="secondary" pendingText="Saving…">
                      {job.isActive ? 'Close' : 'Reopen'}
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={deleteJobOpeningAction} confirmMessage={`Delete "${job.title}"? This can't be undone.`}>
                    <input type="hidden" name="id" value={job.id} />
                    <SubmitButton variant="danger" pendingText="Deleting…">Delete</SubmitButton>
                  </ActionForm>
                </Td>
              </Tr>
            ))}
            {jobs.length === 0 && <EmptyRow colSpan={7}>No job openings posted yet.</EmptyRow>}
          </tbody>
        </Table>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader title="Post a new opening" />
        <Card className="max-w-lg">
          <ActionForm action={createJobOpeningAction} className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="title">Title</label>
            <input id="title" name="title" required placeholder="e.g. Founding Backend Engineer" className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="department">Department</label>
            <input id="department" name="department" required placeholder="e.g. Engineering" className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="location">Location</label>
            <input id="location" name="location" required placeholder="e.g. Gurugram (on-site)" className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="employmentType">Employment type</label>
            <select id="employmentType" name="employmentType" required className="rounded border px-3 py-2 text-sm">
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="internship">Internship</option>
              <option value="contract">Contract</option>
            </select>

            <label className="text-sm font-medium" htmlFor="description">Description</label>
            <textarea id="description" name="description" required rows={6} placeholder="Role, responsibilities, what we're looking for…" className="rounded border px-3 py-2 text-sm" />

            <SubmitButton pendingText="Posting…" className="w-fit">Post opening</SubmitButton>
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}
