import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { approveGymAction, rejectGymAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';

interface GymDetail {
  id: number;
  name: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  phone: string;
  sessionPrice: number;
  quotedPrice: number | null;
  established: number | null;
  amenities: string[];
  brandDocs: string[];
  isApproved: boolean;
  rejectionReason: string | null;
  partnerId: number;
  images: { id: number; url: string }[];
}

export default async function GymDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  let gym: GymDetail;
  try {
    const res = await gatewayJson<{ data: GymDetail }>(`/api/gyms/admin/${id}`);
    gym = res.data;
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={gym.name}
        subtitle={`Partner #${gym.partnerId} · ${gym.address}, ${gym.city}, ${gym.state}`}
      />

      <Card className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Phone</dt>
          <dd>{gym.phone}</dd>
          <dt className="text-gray-500">Session price</dt>
          <dd>₹{gym.sessionPrice}</dd>
          <dt className="text-gray-500">Quoted price</dt>
          <dd>{gym.quotedPrice ? `₹${gym.quotedPrice}` : '—'}</dd>
          <dt className="text-gray-500">Established</dt>
          <dd>{gym.established ?? '—'}</dd>
          <dt className="text-gray-500">Amenities</dt>
          <dd>{gym.amenities.join(', ') || '—'}</dd>
          <dt className="text-gray-500">Status</dt>
          <dd>
            {gym.isApproved ? (
              <StatusBadge tone="approved">Approved</StatusBadge>
            ) : gym.rejectionReason ? (
              <span className="flex items-center gap-2">
                <StatusBadge tone="rejected">Rejected</StatusBadge> {gym.rejectionReason}
              </span>
            ) : (
              <StatusBadge tone="pending">Pending</StatusBadge>
            )}
          </dd>
        </dl>

        {gym.description && <p className="text-sm">{gym.description}</p>}

        {gym.images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {gym.images.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={img.id} src={img.url} alt={gym.name} className="h-24 w-24 rounded object-cover" />
            ))}
          </div>
        )}

        {gym.brandDocs.length > 0 && (
          <div>
            <h2 className="font-medium">Verification documents</h2>
            <ul className="list-inside list-disc text-sm">
              {gym.brandDocs.map((doc) => (
                <li key={doc}>
                  <a href={doc} target="_blank" rel="noreferrer" className="underline">
                    {doc.split('/').pop()}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {!gym.isApproved && (
        <Card className="flex flex-col gap-4">
          <ActionForm action={approveGymAction} confirmMessage={`Approve "${gym.name}"?`}>
            <input type="hidden" name="gymId" value={gym.id} />
            <SubmitButton pendingText="Approving…">Approve</SubmitButton>
          </ActionForm>

          <ActionForm
            action={rejectGymAction}
            confirmMessage={`Reject "${gym.name}"? This cannot be undone from here.`}
            className="flex flex-col gap-2"
          >
            <input type="hidden" name="gymId" value={gym.id} />
            <label className="text-sm font-medium" htmlFor="reason">Rejection reason</label>
            <textarea id="reason" name="reason" required className="rounded border px-3 py-2 text-sm" rows={2} />
            <SubmitButton variant="danger" pendingText="Rejecting…" className="w-fit">Reject</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
