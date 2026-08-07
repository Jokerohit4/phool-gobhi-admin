import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import {
  approveGymAction,
  rejectGymAction,
  deleteReviewAction,
  updateGymCommissionAction,
  setGymActiveAction,
  deleteGymAdminAction,
} from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatDateIST } from '@/lib/dateFormat';

interface GymReview {
  id: number;
  customerId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
}

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
  weeklyPlanPrice: number | null;
  monthlyPlanPrice: number | null;
  quarterlyPlanPrice: number | null;
  sixMonthlyPlanPrice: number | null;
  yearlyPlanPrice: number | null;
  established: number | null;
  amenities: string[];
  brandDocs: string[];
  isApproved: boolean;
  isActive: boolean;
  rejectionReason: string | null;
  partnerId: number;
  commissionPct: number;
  images: { id: number; url: string; mediaType?: 'image' | 'video' }[];
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

  // Best-effort — a reviews-fetch failure shouldn't block the rest of the page.
  const reviews = await gatewayJson<{ data: GymReview[] }>(`/api/gyms/${id}/reviews`)
    .then((res) => res.data)
    .catch(() => [] as GymReview[]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={gym.name}
        subtitle={
          <>
            Partner{' '}
            <Link href={`/gyms?partnerId=${gym.partnerId}`} className="underline">
              #{gym.partnerId}
            </Link>{' '}
            · {gym.address}, {gym.city}, {gym.state}
          </>
        }
      />

      <Card className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Phone</dt>
          <dd>{gym.phone}</dd>
          <dt className="text-gray-500">Session price</dt>
          <dd>₹{gym.sessionPrice}</dd>
          <dt className="text-gray-500">Quoted price</dt>
          <dd>{gym.quotedPrice ? `₹${gym.quotedPrice}` : '—'}</dd>
          <dt className="text-gray-500">Plan prices</dt>
          <dd>
            {[
              ['Weekly', gym.weeklyPlanPrice],
              ['Monthly', gym.monthlyPlanPrice],
              ['Quarterly', gym.quarterlyPlanPrice],
              ['Six monthly', gym.sixMonthlyPlanPrice],
              ['Yearly', gym.yearlyPlanPrice],
            ]
              .filter(([, price]) => price != null)
              .map(([label, price]) => `${label} ₹${price}`)
              .join(', ') || '—'}
          </dd>
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
          <dt className="text-gray-500">Visibility</dt>
          <dd>
            {gym.isActive ? (
              <StatusBadge tone="approved">Active</StatusBadge>
            ) : (
              <StatusBadge tone="rejected">Deactivated</StatusBadge>
            )}
          </dd>
        </dl>

        {gym.description && <p className="text-sm">{gym.description}</p>}

        {gym.images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {gym.images.map((img) =>
              img.mediaType === 'video' ? (
                <video
                  key={img.id}
                  src={img.url}
                  className="h-24 w-24 rounded object-cover"
                  muted
                  controls
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.id} src={img.url} alt={gym.name} className="h-24 w-24 rounded object-cover" />
              )
            )}
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

      <Card className="flex flex-col gap-3">
        <h2 className="font-medium">Commission</h2>
        <p className="text-sm text-gray-500">
          Platform&apos;s share of this gym&apos;s bookings and subscriptions. Applies to every new booking/subscription
          going forward — it does not change already-completed payouts. Default for a new gym is 20%.
        </p>
        <ActionForm action={updateGymCommissionAction} className="flex items-end gap-3">
          <input type="hidden" name="gymId" value={gym.id} />
          <label className="flex flex-col gap-1 text-sm">
            Commission %
            <input
              type="number"
              name="commissionPct"
              min={0}
              max={100}
              step="0.01"
              defaultValue={gym.commissionPct}
              className="w-28 rounded border px-3 py-2 text-sm"
            />
          </label>
          <SubmitButton pendingText="Saving…" className="w-fit">
            Save
          </SubmitButton>
        </ActionForm>
      </Card>

      {reviews.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="font-medium">Reviews ({reviews.length})</h2>
          {reviews.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
              <div>
                <p className="text-sm font-medium">
                  {r.rating}★ · Customer #{r.customerId} · {formatDateIST(r.createdAt)}
                </p>
                {r.comment && <p className="mt-1 text-sm text-gray-600">{r.comment}</p>}
              </div>
              <ActionForm action={deleteReviewAction} confirmMessage="Remove this review? This cannot be undone.">
                <input type="hidden" name="gymId" value={gym.id} />
                <input type="hidden" name="reviewId" value={r.id} />
                <SubmitButton variant="danger" pendingText="Removing…" className="shrink-0 text-xs">
                  Remove
                </SubmitButton>
              </ActionForm>
            </div>
          ))}
        </Card>
      )}

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

      <Card className="flex flex-col gap-4">
        <h2 className="font-medium">Danger zone</h2>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-500">
            {gym.isActive
              ? 'Hides this gym from discovery and booking. Reversible — the gym and its data stay intact.'
              : 'This gym is currently hidden from discovery and booking.'}
          </p>
          <ActionForm
            action={setGymActiveAction}
            confirmMessage={
              gym.isActive
                ? `Deactivate "${gym.name}"? It will disappear from discovery until reactivated.`
                : `Reactivate "${gym.name}"?`
            }
          >
            <input type="hidden" name="gymId" value={gym.id} />
            <input type="hidden" name="isActive" value={gym.isActive ? 'false' : 'true'} />
            <SubmitButton
              variant={gym.isActive ? 'danger' : 'primary'}
              pendingText={gym.isActive ? 'Deactivating…' : 'Reactivating…'}
              className="w-fit"
            >
              {gym.isActive ? 'Deactivate' : 'Reactivate'}
            </SubmitButton>
          </ActionForm>
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-sm text-gray-500">
            Permanently deletes this gym, its photos, reviews and edit requests. Refused if it has any booking
            history — deactivate instead in that case.
          </p>
          <ActionForm
            action={deleteGymAdminAction}
            confirmMessage={`Permanently delete "${gym.name}"? This cannot be undone.`}
          >
            <input type="hidden" name="gymId" value={gym.id} />
            <SubmitButton variant="danger" pendingText="Deleting…" className="w-fit">
              Delete permanently
            </SubmitButton>
          </ActionForm>
        </div>
      </Card>
    </div>
  );
}
