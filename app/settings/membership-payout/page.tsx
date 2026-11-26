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
import { saveMembershipPayoutAction } from './actions';
import { MEMBERSHIP_PAYOUT_PAGE, MEMBERSHIP_PAYOUT_PATH, type MembershipPayout } from './config';

export default async function MembershipPayoutPage() {
  await requireSession();
  const [result] = await Promise.allSettled([gatewayJson<{ data: MembershipPayout }>(MEMBERSHIP_PAYOUT_PATH)]);
  const payout = result.status === 'fulfilled' ? result.value.data : null;

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
  </div>;
}
