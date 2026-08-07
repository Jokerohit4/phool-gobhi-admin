import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { approveReviewAction, unapproveReviewAction, deleteReviewAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTimeIST } from '@/lib/dateFormat';

interface PlatformReview {
  id: number;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  rating: number;
  comment: string | null;
  isApproved: boolean;
  createdAt: string;
}

export default async function ReviewsPage() {
  await requireSession();
  const { data: reviews } = await gatewayJson<{ data: PlatformReview[] }>('/api/auth/admin/platform-reviews');

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Reviews"
          subtitle="Platform-wide reviews submitted from the website's /testimonials page. Approve to show under &ldquo;What users say about us&rdquo;."
        />
        <Table>
          <Thead>
            <Th>Status</Th>
            <Th>Customer</Th>
            <Th>Rating</Th>
            <Th>Comment</Th>
            <Th>Submitted</Th>
            <Th>Actions</Th>
          </Thead>
          <tbody>
            {reviews.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <StatusBadge tone={r.isApproved ? 'approved' : 'pending'}>
                    {r.isApproved ? 'Approved' : 'Pending'}
                  </StatusBadge>
                </Td>
                <Td>
                  <p className="font-medium">{r.customerName}</p>
                  {r.customerPhone && <p className="text-gray-500">{r.customerPhone}</p>}
                </Td>
                <Td>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Td>
                <Td className="max-w-md whitespace-pre-wrap">{r.comment || '—'}</Td>
                <Td>{formatDateTimeIST(r.createdAt)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <ActionForm action={r.isApproved ? unapproveReviewAction : approveReviewAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <SubmitButton variant="secondary" pendingText="Saving…">
                        {r.isApproved ? 'Unapprove' : 'Approve'}
                      </SubmitButton>
                    </ActionForm>
                    <ActionForm action={deleteReviewAction} confirmMessage="Remove this review? This cannot be undone.">
                      <input type="hidden" name="id" value={r.id} />
                      <SubmitButton variant="danger" pendingText="Removing…">
                        Remove
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </Td>
              </Tr>
            ))}
            {reviews.length === 0 && <EmptyRow colSpan={6}>No reviews yet.</EmptyRow>}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
