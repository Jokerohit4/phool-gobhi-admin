import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { CHANGE_TYPE_LABELS } from '@/lib/editRequests';
import { approveEditRequestAction, rejectEditRequestAction } from './actions';

interface GymSnapshot {
  id: number;
  name: string;
  city: string;
  partnerId: number;
  openTime: string;
  closeTime: string;
  slotDuration: number;
  sessionPrice: number;
  images: { id: number; url: string }[];
  brandDocs: string[];
  [key: string]: unknown;
}

interface EditRequestDetail {
  id: number;
  gymId: number;
  partnerId: number;
  changeType: string;
  status: 'pending' | 'approved' | 'rejected';
  payload: Record<string, unknown>;
  rejectionReason: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  createdAt: string;
  gym: GymSnapshot;
}

// Human-friendly labels + how to render a raw value for the profile diff —
// mirrors the allowlist in gym-service's gymService.js updateGym.
const PROFILE_FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  address: 'Address',
  city: 'City',
  state: 'State',
  lat: 'Latitude',
  lng: 'Longitude',
  amenities: 'Amenities',
  phone: 'Phone',
  sessionPrice: 'Session price (₹)',
  quotedPrice: 'Quoted price (₹)',
  established: 'Established (year)',
  openTime: 'Opening time',
  closeTime: 'Closing time',
  slotDuration: 'Slot duration (min)',
  capacity: 'Capacity',
  weeklyPlanPrice: 'Weekly plan price (₹)',
  monthlyPlanPrice: 'Monthly plan price (₹)',
  quarterlyPlanPrice: 'Quarterly plan price (₹)',
  sixMonthlyPlanPrice: 'Six-monthly plan price (₹)',
  yearlyPlanPrice: 'Yearly plan price (₹)',
  googlePlaceId: 'Google place',
};

function formatValue(v: unknown) {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return String(v);
}

function fileNameFromUrl(url: string) {
  try {
    return decodeURIComponent(url.split('/').pop() || url);
  } catch {
    return url;
  }
}

export default async function EditRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  let request: EditRequestDetail;
  try {
    const res = await gatewayJson<{ data: EditRequestDetail }>(`/api/gyms/edit-requests/${id}`);
    request = res.data;
  } catch {
    notFound();
  }

  const { gym, payload, changeType } = request;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={CHANGE_TYPE_LABELS[changeType] ?? changeType}
        subtitle={
          <>
            <Link href={`/gyms/${gym.id}`} className="underline">
              {gym.name}
            </Link>{' '}
            · {gym.city} · Partner{' '}
            <Link href={`/gyms?partnerId=${gym.partnerId}`} className="underline">
              #{gym.partnerId}
            </Link>{' '}
            · <StatusBadge tone={request.status}>{request.status}</StatusBadge>
          </>
        }
      />

      <Card className="flex flex-col gap-4">
        {changeType === 'profile' && (
          <dl className="grid grid-cols-[max-content_1fr_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
            <dt className="font-medium text-gray-500">Field</dt>
            <dt className="font-medium text-gray-500">Current</dt>
            <dt className="font-medium text-gray-500">Proposed</dt>
            {Object.keys(payload).map((key) => (
              <div key={key} className="contents">
                <dd className="font-medium">{PROFILE_FIELD_LABELS[key] ?? key}</dd>
                <dd className="text-gray-500">{formatValue(gym[key])}</dd>
                <dd>{formatValue(payload[key])}</dd>
              </div>
            ))}
          </dl>
        )}

        {changeType === 'image_add' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-500">New photo to add:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={String(payload.url)} alt="Proposed" className="h-40 w-40 rounded object-cover" />
          </div>
        )}

        {changeType === 'image_delete' &&
          (() => {
            const image = gym.images.find((img) => img.id === payload.imageId);
            return (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-gray-500">Photo to remove:</p>
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt="To remove" className="h-40 w-40 rounded object-cover opacity-70" />
                ) : (
                  <p className="text-sm text-gray-500">Photo #{String(payload.imageId)} (no longer on the gym)</p>
                )}
              </div>
            );
          })()}

        {(changeType === 'doc_add' || changeType === 'doc_delete') && (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-gray-500">{changeType === 'doc_add' ? 'New document to add:' : 'Document to remove:'}</p>
            <a href={String(payload.url)} target="_blank" rel="noreferrer" className="underline">
              {fileNameFromUrl(String(payload.url))}
            </a>
          </div>
        )}

        {changeType === 'slot_prices' && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="font-medium text-gray-500">Slot</dt>
            <dt className="font-medium text-gray-500">Proposed price (₹)</dt>
            {(payload.prices as { startTime: string; price: number }[]).map((p) => (
              <div key={p.startTime} className="contents">
                <dd>{p.startTime}</dd>
                <dd>₹{p.price}</dd>
              </div>
            ))}
          </dl>
        )}

        {changeType === 'slot_block_add' && (
          <p className="text-sm">
            Block <strong>{String(payload.date)}</strong> {String(payload.startTime)}–{String(payload.endTime)}
          </p>
        )}

        {changeType === 'slot_block_delete' && (
          <p className="text-sm">Remove block #{String(payload.blockId)}</p>
        )}

        {request.status === 'rejected' && request.rejectionReason && (
          <p className="text-sm text-red-600 dark:text-red-400">Rejected — {request.rejectionReason}</p>
        )}
      </Card>

      {request.status === 'pending' && (
        <Card className="flex flex-col gap-4">
          <ActionForm action={approveEditRequestAction} confirmMessage="Approve this change? It goes live immediately.">
            <input type="hidden" name="requestId" value={request.id} />
            <SubmitButton pendingText="Approving…">Approve</SubmitButton>
          </ActionForm>

          <ActionForm action={rejectEditRequestAction} className="flex flex-col gap-2">
            <input type="hidden" name="requestId" value={request.id} />
            <label className="text-sm font-medium" htmlFor="reason">
              Rejection reason
            </label>
            <textarea id="reason" name="reason" required className="rounded border px-3 py-2 text-sm" rows={2} />
            <SubmitButton variant="danger" pendingText="Rejecting…" className="w-fit">
              Reject
            </SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
