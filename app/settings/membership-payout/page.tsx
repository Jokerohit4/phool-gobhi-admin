import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { formatDateTimeIST } from '@/lib/dateFormat';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { ActionForm } from '@/components/ui/ActionForm';
import { Card } from '@/components/ui/Card';
import { ExpectedUpdatedAt } from '@/components/ui/ExpectedUpdatedAt';
import { InlineError } from '@/components/ui/InlineError';
import { PageHeader } from '@/components/ui/PageHeader';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { SettingsSectionNav } from '../SettingsSectionNav';
import { removeGymPayoutAction, saveMembershipPayoutAction } from './actions';
import { GYM_PAYOUT_PATH, MEMBERSHIP_PAYOUT_PAGE, MEMBERSHIP_PAYOUT_PATH, type GymPayout, type MembershipPayout } from './config';
import { GymPayoutForm } from './GymPayoutForm';

export default async function MembershipPayoutPage() {
  await requireSession();
  const [result, gymResult] = await Promise.allSettled([
    gatewayJson<{ data: MembershipPayout }>(MEMBERSHIP_PAYOUT_PATH),
    gatewayJson<{ data: GymPayout[] }>(GYM_PAYOUT_PATH),
  ]);
  const payout = result.status === 'fulfilled' ? result.value.data : null;
  const overrides = gymResult.status === 'fulfilled' ? gymResult.value.data : null;

  return <div className="space-y-5">
    <Breadcrumbs items={[{ label: 'Settings', href: '/settings' }, { label: 'Membership payout' }]} />
    <PageHeader title="Membership payout" subtitle="Partner payout per membership gym visit at check-in." />
    <SettingsSectionNav />
    {payout ? <Card className="max-w-md">
      <ActionForm action={saveMembershipPayoutAction} preserveOnError className="space-y-4"
        confirmMessage="Change the partner payout for future membership check-ins?">
        <ExpectedUpdatedAt value={payout.updatedAt} />
        <p className="text-sm text-gray-500">{payout.updatedAt ? `Last saved ${formatDateTimeIST(payout.updatedAt)} IST` : 'Showing the current backend default'}</p>
        <label className="grid gap-1 text-sm">Payout per visit (₹)
          <input className="rounded border p-2 dark:bg-gray-900" name="payoutRupees" type="number" required min="0.01"
            max="21474836.47" step="0.01" defaultValue={(payout.payoutPaise / 100).toFixed(2)} />
        </label>
        <SubmitButton pendingText="Saving…">Save payout</SubmitButton>
      </ActionForm>
    </Card> : <InlineError title="Could not load the membership payout"
      message={result.status === 'rejected' && result.reason instanceof Error ? result.reason.message : 'Could not load the membership payout'}
      retryHref={MEMBERSHIP_PAYOUT_PAGE} />}
    <section className="space-y-3" aria-labelledby="gym-payout-heading">
      <h2 id="gym-payout-heading" className="text-lg font-semibold">Per-gym payout</h2>
      <p className="text-sm text-gray-500">{payout
        ? `Gyms without an override receive ₹${(payout.payoutPaise / 100).toFixed(2)} per visit.`
        : 'Default payout unavailable.'}</p>
      {overrides ? <Card className="space-y-4">
        {overrides.length > 0 ? <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th scope="col" className="p-2">Gym ID</th>
                <th scope="col" className="p-2">Payout per visit</th>
                <th scope="col" className="p-2">Updated at (IST)</th>
                <th scope="col" className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((row) => <tr key={row.gymId} className="border-b">
                <td className="p-2">{row.gymId}</td>
                <td className="p-2">₹{(row.payoutPaise / 100).toFixed(2)}</td>
                <td className="p-2">{formatDateTimeIST(row.updatedAt)}</td>
                <td className="p-2">
                  <ActionForm action={removeGymPayoutAction}
                    confirmMessage={`Remove the payout override for gym ${row.gymId}? The default will apply to future visits.`}>
                    <input type="hidden" name="gymId" value={row.gymId} />
                    <ExpectedUpdatedAt value={row.updatedAt} />
                    <SubmitButton pendingText="Removing…">Remove</SubmitButton>
                  </ActionForm>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div> : <p className="text-sm text-gray-500">No gym payout overrides.</p>}
        <GymPayoutForm overrides={overrides} />
      </Card> : <InlineError title="Could not load gym payout overrides"
        message={gymResult.status === 'rejected' && gymResult.reason instanceof Error ? gymResult.reason.message : 'Could not load gym payout overrides'}
        retryHref={MEMBERSHIP_PAYOUT_PAGE} />}
    </section>
  </div>;
}
