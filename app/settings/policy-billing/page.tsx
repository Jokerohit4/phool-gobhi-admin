import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { Toggle } from '@/components/ui/Toggle';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { InlineError } from '@/components/ui/InlineError';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SettingsSectionNav } from '../SettingsSectionNav';
import {
  updateCancellationPolicyAction,
  updateProfileCompletionBonusAction,
  addWalletTopupPresetAction,
  removeWalletTopupPresetAction,
  updateWalletTopupCustomAmountAction,
} from '../actions';
import { formatDateTimeIST, normalizeTiers, type CancellationTier, type WalletTopupConfig } from '../settingsShared';

export default async function PolicyBillingSettingsPage() {
  await requireSession();

  const [policySettled, bonusSettled, topupSettled] = await Promise.allSettled([
    gatewayJson<{ data: { tiers: CancellationTier[]; updatedAt: string | null } }>('/api/bookings/cancellation-policy'),
    gatewayJson<{ data: { amount: number }; updatedAt?: string | null }>('/api/auth/profile-completion-bonus/admin'),
    gatewayJson<{ data: WalletTopupConfig }>('/api/wallet/topup-config'),
  ]);
  for (const [name, r] of [['cancellation-policy', policySettled], ['profile-completion-bonus', bonusSettled], ['topup-config', topupSettled]] as const) {
    if (r.status === 'rejected') console.error(`PolicyBillingSettingsPage: ${name} load failed`, r.reason);
  }
  const policy = policySettled.status === 'fulfilled' ? policySettled.value.data : null;
  const topupConfig = topupSettled.status === 'fulfilled' ? topupSettled.value.data : null;
  const profileCompletionBonus =
    bonusSettled.status === 'fulfilled'
      ? { amount: bonusSettled.value.data.amount, updatedAt: bonusSettled.value.updatedAt ?? null }
      : null;

  const rows = policy ? normalizeTiers(policy.tiers) : [];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Settings', href: '/settings' }, { label: 'Policy & billing' }]} />
      <PageHeader title="Policy & billing" subtitle="Cancellation rules, wallet top-up presets, and profile-completion bonus configuration." />
      <SettingsSectionNav />

      {policy ? (
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Cancellation policy"
          subtitle={
            policy.updatedAt
              ? `Live for the app and refund calculation ? last updated ${formatDateTimeIST(policy.updatedAt)} IST.`
              : 'Live for the app and refund calculation ? not customized yet, showing defaults.'
          }
        />
        <Card className="max-w-2xl">
          <ActionForm
            action={updateCancellationPolicyAction}
            confirmMessage="This changes the refund rules applied to every future booking cancellation. Continue?"
            className="flex flex-col gap-4"
          >
            <p className="text-sm text-gray-500">
              Each row applies when the customer cancels with less notice than &ldquo;Up to hours&rdquo; (the
              last row has no upper bound). Leave &ldquo;Up to hours&rdquo; blank for the last row.
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
                  <label className="flex items-center gap-3 text-sm">
                    <Toggle name={`tier${i}_blocked`} defaultChecked={tier.blocked} />
                    Blocked
                  </label>
                </div>
              );
            })}
            <SubmitButton pendingText="Saving?" className="w-fit">
              Save policy
            </SubmitButton>
          </ActionForm>
        </Card>
      </section>
      ) : (
        <InlineError title="Could not load the cancellation policy" message="This section could not be loaded, so editing is disabled to avoid saving over values you cannot see." retryHref="/settings/policy-billing" />
      )}

      {topupConfig ? (
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Wallet top-up amounts"
          subtitle={
            topupConfig.updatedAt
              ? `Live for website + app top-up ? last updated ${formatDateTimeIST(topupConfig.updatedAt)} IST.`
              : 'Live for website + app top-up ? not customized yet, showing defaults.'
          }
        />
        <Table>
          <Thead>
            <Th>Amount</Th>
            <Th>Action</Th>
          </Thead>
          <tbody>
            {topupConfig.presets.map((amount) => (
              <Tr key={amount}>
                <Td>{`?${amount}`}</Td>
                <Td>
                  <ActionForm action={removeWalletTopupPresetAction} confirmMessage={`Remove ?${amount} as a preset?`}>
                    <input type="hidden" name="amount" value={amount} />
                    <SubmitButton variant="danger" pendingText="Removing?">Remove</SubmitButton>
                  </ActionForm>
                </Td>
              </Tr>
            ))}
            {topupConfig.presets.length === 0 && (
              <EmptyRow colSpan={2}>No preset amounts ? custom amount only.</EmptyRow>
            )}
          </tbody>
        </Table>

        <Card className="max-w-sm">
          <ActionForm
            action={addWalletTopupPresetAction}
            confirmMessage="Add this wallet top-up preset for all customers?"
            className="flex flex-col gap-3"
          >
            <label className="text-sm font-medium" htmlFor="topup-preset-amount">New preset amount (?)</label>
            <input
              id="topup-preset-amount"
              name="amount"
              type="number"
              min={1}
              step={1}
              required
              className="rounded border px-3 py-2 text-sm"
            />
            <SubmitButton pendingText="Adding?" className="w-fit">Add preset</SubmitButton>
          </ActionForm>
        </Card>

        <Card className="max-w-md">
          <ActionForm
            action={updateWalletTopupCustomAmountAction}
            className="flex flex-col gap-4"
            confirmMessage="This changes whether customers can type any custom top-up amount, platform-wide. Continue?"
          >
            <label className="flex items-center gap-3 text-sm font-medium">
              <Toggle name="allowCustomAmount" defaultChecked={topupConfig.allowCustomAmount} />
              Allow customer-entered custom amount
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                Min (?)
                <input
                  type="number"
                  name="minCustomAmount"
                  min={1}
                  step={1}
                  defaultValue={topupConfig.minCustomAmount ?? ''}
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Max (?)
                <input
                  type="number"
                  name="maxCustomAmount"
                  min={1}
                  step={1}
                  defaultValue={topupConfig.maxCustomAmount ?? ''}
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>
            </div>
            <p className="text-sm text-gray-500">
              Required whenever the toggle above is on. If there are no preset amounts (see table above), this
              toggle must stay on ? customers need at least one way to top up. Amounts above ?25,000 are rejected
              regardless of what?s set here.
            </p>
            <SubmitButton pendingText="Saving?" className="w-fit">Save custom-amount settings</SubmitButton>
          </ActionForm>
        </Card>
      </section>
      ) : (
        <InlineError title="Could not load wallet top-up settings" message="This section could not be loaded, so editing is disabled to avoid saving over values you cannot see." retryHref="/settings/policy-billing" />
      )}

      {profileCompletionBonus ? (
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Profile-completion bonus"
          subtitle={
            profileCompletionBonus.updatedAt
              ? `One-time wallet credit when a customer's profile crosses from incomplete to complete ? last updated ${formatDateTimeIST(profileCompletionBonus.updatedAt)} IST.`
              : 'One-time wallet credit when a customer\'s profile crosses from incomplete to complete ? not customized yet, showing defaults.'
          }
        />
        <Card className="max-w-md">
          <ActionForm
            action={updateProfileCompletionBonusAction}
            className="flex flex-col gap-4"
            confirmMessage="This changes the wallet reward for every customer completing their profile, immediately (it only applies to profiles completed after the change). Continue?"
          >
            <label className="flex flex-col gap-1 text-sm">
              Bonus amount (?)
              <input
                type="number"
                name="amount"
                min={0}
                max={1000}
                step={1}
                required
                defaultValue={profileCompletionBonus.amount}
                className="rounded border px-3 py-2 text-sm"
              />
            </label>
            <p className="text-sm text-gray-500">
              Credited once per user the moment all profile fields (name, photo, gender, date of birth, fitness
              goals) are set. Set to 0 to disable the bonus ? a profile completed while it is disabled is never
              paid retroactively.
            </p>
            <SubmitButton pendingText="Saving?" className="w-fit">
              Save bonus amount
            </SubmitButton>
          </ActionForm>
        </Card>
      </section>
      ) : (
        <InlineError title="Could not load the profile-completion bonus" message="This section could not be loaded, so editing is disabled to avoid saving over values you cannot see." retryHref="/settings/policy-billing" />
      )}
    </div>
  );
}
