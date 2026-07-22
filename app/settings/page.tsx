import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { updateCancellationPolicyAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';

interface CancellationTier {
  maxHoursNotice: number | null;
  blocked: boolean;
  refundRate: number;
}

export default async function SettingsPage() {
  await requireSession();
  const { data: policy } = await gatewayJson<{
    data: { tiers: CancellationTier[]; updatedAt: string | null };
  }>('/api/bookings/cancellation-policy');

  // Pad/truncate to exactly 4 rows so the form always has tier0..tier3 to
  // submit, even if the stored policy somehow has a different count.
  const tiers = [...policy.tiers];
  while (tiers.length < 4) tiers.push({ maxHoursNotice: null, blocked: false, refundRate: 1 });
  const rows = tiers.slice(0, 4);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Cancellation policy"
          subtitle={
            policy.updatedAt
              ? `Live for the app and refund calculation — last updated ${new Date(policy.updatedAt).toLocaleString()}.`
              : 'Live for the app and refund calculation — not customized yet, showing defaults.'
          }
        />
        <Card className="max-w-2xl">
          <ActionForm action={updateCancellationPolicyAction} className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">
              Each row applies when the customer cancels with less notice than "Up to hours" (the
              last row has no upper bound). Leave "Up to hours" blank for the last row.
            </p>
            <div className="grid grid-cols-[1fr_1fr_1fr] gap-x-4 gap-y-2 items-center text-sm font-medium text-gray-500">
              <span>Up to hours before session</span>
              <span>Refund %</span>
              <span>Blocked entirely</span>
            </div>
            {rows.map((tier, i) => {
              const isLast = i === rows.length - 1;
              return (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr] gap-x-4 items-center">
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    name={`tier${i}_maxHours`}
                    defaultValue={tier.maxHoursNotice ?? ''}
                    disabled={isLast}
                    placeholder={isLast ? 'No limit' : undefined}
                    className="rounded border px-3 py-2 text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="1"
                    name={`tier${i}_refundPercent`}
                    defaultValue={Math.round(tier.refundRate * 100)}
                    className="rounded border px-3 py-2 text-sm"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name={`tier${i}_blocked`}
                      defaultChecked={tier.blocked}
                    />
                    Blocked
                  </label>
                </div>
              );
            })}
            <SubmitButton pendingText="Saving…" className="w-fit">
              Save policy
            </SubmitButton>
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}
