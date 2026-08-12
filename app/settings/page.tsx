import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import {
  updateCancellationPolicyAction,
  updateAppVersionConfigAction,
  updateFeatureFlagsAction,
  updateLaunchGateAction,
  updateMaintenanceAction,
  updateOtpConfigAction,
  addOtpSkipAllowlistAction,
  removeOtpSkipAllowlistAction,
  updateProfileCompletionBonusAction,
  addWalletTopupPresetAction,
  removeWalletTopupPresetAction,
  updateWalletTopupCustomAmountAction,
} from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatDateIST, formatDateTimeIST } from '@/lib/dateFormat';

interface LaunchGate {
  enabled: boolean;
  launchAt: string | null;
}

// Inverse of launchInputToUtcIso in actions.ts — same fixed +5:30 IST offset,
// converting the stored UTC instant to the wall-clock string a
// datetime-local input expects, so the field round-trips through IST
// regardless of the admin's own browser timezone.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function utcIsoToLaunchInput(iso: string | null): string {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

interface CancellationTier {
  maxHoursNotice: number | null;
  blocked: boolean;
  refundRate: number;
}

interface AppVersionEntry {
  minVersion: string;
  latestVersion: string;
  updateUrl: string;
  message: string;
}

type AppVersionConfig = Record<'customer' | 'partner', Record<'android' | 'ios', AppVersionEntry>>;

const APP_VERSION_ROWS: Array<{ app: 'customer' | 'partner'; platform: 'android' | 'ios'; label: string }> = [
  { app: 'customer', platform: 'android', label: 'Customer — Android' },
  { app: 'customer', platform: 'ios', label: 'Customer — iOS' },
  { app: 'partner', platform: 'android', label: 'Partner — Android' },
  { app: 'partner', platform: 'ios', label: 'Partner — iOS' },
];

const EMPTY_APP_VERSION_ENTRY: AppVersionEntry = {
  minVersion: '1.0.0',
  latestVersion: '1.0.0',
  updateUrl: '',
  message: '',
};

interface FeatureFlags {
  buddy: { enabled: boolean };
}

// Buddy is live today, so the default is enabled — the toggle only does
// something once an admin deliberately turns it off.
const DEFAULT_FEATURES: FeatureFlags = { buddy: { enabled: true } };

function withFeatures(raw: Partial<FeatureFlags> | null | undefined): FeatureFlags {
  return {
    buddy: { enabled: raw?.buddy?.enabled ?? DEFAULT_FEATURES.buddy.enabled },
  };
}

interface MaintenanceConfig {
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  message: string;
}

type MaintenanceConfigMap = Record<'wallet' | 'gyms', MaintenanceConfig>;

const DEFAULT_MAINTENANCE: MaintenanceConfigMap = {
  wallet: { enabled: false, startsAt: null, endsAt: null, message: '' },
  gyms: { enabled: false, startsAt: null, endsAt: null, message: '' },
};

function withMaintenance(
  raw: Partial<Record<'wallet' | 'gyms', Partial<MaintenanceConfig>>> | null | undefined
): MaintenanceConfigMap {
  return {
    wallet: { ...DEFAULT_MAINTENANCE.wallet, ...(raw?.wallet || {}) },
    gyms: { ...DEFAULT_MAINTENANCE.gyms, ...(raw?.gyms || {}) },
  };
}

const MAINTENANCE_SECTIONS: Array<{
  feature: keyof MaintenanceConfigMap;
  label: string;
  blurb: string;
}> = [
  {
    feature: 'wallet',
    label: 'Wallet',
    blurb: 'Blocks wallet top-up, balance, transactions, subscriptions and any booking that moves wallet money.',
  },
  {
    feature: 'gyms',
    label: 'Gyms',
    blurb: 'Blocks gym browsing, gym detail, slot booking and QR check-in.',
  },
];

// Defensive fill — tolerates the admin GET returning a partial/missing config
// (e.g. before the first PUT ever lands) without the page crashing.
function withDefaults(config: Partial<AppVersionConfig> | null | undefined): AppVersionConfig {
  const merged = {} as AppVersionConfig;
  for (const { app, platform } of APP_VERSION_ROWS) {
    merged[app] = merged[app] || ({} as AppVersionConfig['customer']);
    merged[app][platform] = { ...EMPTY_APP_VERSION_ENTRY, ...(config?.[app]?.[platform] || {}) };
  }
  return merged;
}

type OtpProvider = 'fast2sms' | 'firebase' | 'skip';

interface OtpSkipAllowlistEntry {
  id: number;
  phone: string;
  note: string | null;
  createdAt: string;
}

interface WalletTopupConfig {
  presets: number[];
  allowCustomAmount: boolean;
  minCustomAmount: number | null;
  maxCustomAmount: number | null;
  updatedAt: string | null;
}

const OTP_PROVIDER_OPTIONS: Array<{ value: OtpProvider; label: string; description: string }> = [
  { value: 'firebase', label: 'Firebase phone auth', description: 'Default — real Firebase phone verification, no SMS cost.' },
  { value: 'fast2sms', label: 'Fast2SMS', description: 'Real paid SMS to every phone number — only used when explicitly selected here.' },
  {
    value: 'skip',
    label: 'Skip (test bypass)',
    description: 'Allowlisted numbers below verify with 123456, no real OTP sent. Every other number falls back to real Firebase phone verification — Fast2SMS never fires unless it’s explicitly selected above.',
  },
];

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

  const { data: appVersionRaw, updatedAt: appVersionUpdatedAt } = await gatewayJson<{
    data: Partial<AppVersionConfig> &
      Partial<FeatureFlags> & {
        maintenance?: Partial<Record<'wallet' | 'gyms', Partial<MaintenanceConfig>>>;
      };
    updatedAt?: string | null;
  }>('/api/auth/app-config/admin');
  const appVersionConfig = withDefaults(appVersionRaw);
  const features = withFeatures(appVersionRaw);
  const maintenance = withMaintenance(appVersionRaw?.maintenance);

  const { data: launchGate } = await gatewayJson<{ data: LaunchGate }>('/api/auth/launch-gate/admin');

  const { data: otpConfig, updatedAt: otpUpdatedAt } = await gatewayJson<{
    data: { provider: OtpProvider };
    updatedAt: string | null;
  }>('/api/auth/otp-config/admin');

  const { data: skipAllowlist } = await gatewayJson<{ data: OtpSkipAllowlistEntry[] }>(
    '/api/auth/otp-config/admin/skip-allowlist'
  );

  const { data: topupConfig } = await gatewayJson<{ data: WalletTopupConfig }>('/api/wallet/topup-config');

  const { data: profileCompletionBonus, updatedAt: bonusUpdatedAt } = await gatewayJson<{
    data: { amount: number };
    updatedAt: string | null;
  }>('/api/auth/profile-completion-bonus/admin');

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Launch gate"
          subtitle="Controls whether the website blocks gym browsing and booking creation. Partner onboarding (/partner/apply) is never affected."
        />
        <Card className="max-w-xl">
          <ActionForm
            action={updateLaunchGateAction}
            className="flex flex-col gap-4"
            confirmMessage="This changes whether gym browsing and booking are gated for every visitor, immediately. Continue?"
          >
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="enabled" defaultChecked={launchGate.enabled} />
              Gate enabled
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Launch date &amp; time (IST)
              <input
                type="datetime-local"
                name="launchAt"
                defaultValue={utcIsoToLaunchInput(launchGate.launchAt)}
                className="rounded border px-3 py-2 text-sm"
              />
            </label>
            <p className="text-sm text-gray-500">
              Disabled: the site is always live. Enabled with a date: gated until that instant, then opens
              automatically. Enabled with no date: gated indefinitely (manual hold).
            </p>
            <SubmitButton pendingText="Saving…" className="w-fit">
              Save launch gate
            </SubmitButton>
          </ActionForm>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader
          title="Maintenance windows"
          subtitle="Put the website's wallet or gyms section (or both) under maintenance — immediately or on a schedule. Blocks the matching pages and APIs on phoolgobhi.com only; the customer/partner apps are not affected."
        />
        {MAINTENANCE_SECTIONS.map(({ feature, label, blurb }) => {
          const entry = maintenance[feature];
          return (
            <Card key={feature} className="max-w-xl">
              <ActionForm
                action={updateMaintenanceAction}
                className="flex flex-col gap-4"
                confirmMessage={`This changes the ${label} maintenance window for every website visitor, immediately. Continue?`}
              >
                <input type="hidden" name="feature" value={feature} />
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" name="enabled" defaultChecked={entry.enabled} />
                    Under maintenance (immediate)
                  </label>
                  <p className="text-sm text-gray-500">{blurb}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1 text-sm">
                    Starts at (IST)
                    <input
                      type="datetime-local"
                      name="startsAt"
                      defaultValue={utcIsoToLaunchInput(entry.startsAt)}
                      className="rounded border px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Ends at (IST)
                    <input
                      type="datetime-local"
                      name="endsAt"
                      defaultValue={utcIsoToLaunchInput(entry.endsAt)}
                      className="rounded border px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                  Message shown to users
                  <input
                    type="text"
                    name="message"
                    defaultValue={entry.message}
                    placeholder={`Optional — e.g. "We'll be back by 10 PM IST"`}
                    className="rounded border px-3 py-2 text-sm"
                  />
                </label>
                <p className="text-sm text-gray-500">
                  Off with a start/end: the window still auto-engages while now is between them. On: gated
                  immediately until you switch it off — a past end time does not auto-release a manual hold.
                </p>
                <SubmitButton pendingText="Saving…" className="w-fit">
                  Save {label} maintenance
                </SubmitButton>
              </ActionForm>
            </Card>
          );
        })}
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader
          title="Cancellation policy"
          subtitle={
            policy.updatedAt
              ? `Live for the app and refund calculation — last updated ${formatDateTimeIST(policy.updatedAt)} IST.`
              : 'Live for the app and refund calculation — not customized yet, showing defaults.'
          }
        />
        <Card className="max-w-2xl">
          <ActionForm action={updateCancellationPolicyAction} className="flex flex-col gap-4">
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

      <section className="flex flex-col gap-4">
        <PageHeader
          title="App version config"
          subtitle={
            appVersionUpdatedAt
              ? `Controls the force-update gate and update-available nudge in both apps — last updated ${formatDateTimeIST(appVersionUpdatedAt)} IST.`
              : 'Controls the force-update gate and update-available nudge in both apps — not customized yet, showing defaults.'
          }
        />
        <Card className="max-w-3xl">
          <ActionForm
            action={updateAppVersionConfigAction}
            className="flex flex-col gap-6"
            confirmMessage="This changes force/soft-update behavior for every install of both apps, immediately. Continue?"
          >
            <p className="text-sm text-gray-500">
              &ldquo;Min version&rdquo; below the installed build hard-blocks the app with an update-now screen.
              &ldquo;Latest version&rdquo; above the installed build shows a dismissible update-available nudge instead.
            </p>
            {APP_VERSION_ROWS.map(({ app, platform, label }) => {
              const entry = appVersionConfig[app][platform];
              const prefix = `${app}_${platform}`;
              return (
                <div key={prefix} className="flex flex-col gap-2 border-t pt-4 first:border-t-0 first:pt-0">
                  <span className="text-sm font-medium text-gray-500">{label}</span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <label className="flex flex-col gap-1 text-sm">
                      Min version (force update below this)
                      <input
                        type="text"
                        name={`${prefix}_minVersion`}
                        defaultValue={entry.minVersion}
                        placeholder="1.0.0"
                        className="rounded border px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Latest version (soft nudge below this)
                      <input
                        type="text"
                        name={`${prefix}_latestVersion`}
                        defaultValue={entry.latestVersion}
                        placeholder="1.0.0"
                        className="rounded border px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 text-sm">
                      Store URL
                      <input
                        type="text"
                        name={`${prefix}_updateUrl`}
                        defaultValue={entry.updateUrl}
                        placeholder="https://play.google.com/store/apps/details?id=..."
                        className="rounded border px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 text-sm">
                      Message shown to users
                      <input
                        type="text"
                        name={`${prefix}_message`}
                        defaultValue={entry.message}
                        placeholder="Optional — shown on the update screen/dialog"
                        className="rounded border px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
            <SubmitButton pendingText="Saving…" className="w-fit">
              Save app version config
            </SubmitButton>
          </ActionForm>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader
          title="Feature flags"
          subtitle="Kill-switches for customer-app features. Saved to the same config blob as the app versions above; changes apply on the app's next launch (the app checks this once at startup)."
        />
        <Card className="max-w-xl">
          <ActionForm
            action={updateFeatureFlagsAction}
            className="flex flex-col gap-4"
            confirmMessage="This immediately gates the Gym Buddies tab for every customer app install on next launch. Continue?"
          >
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="buddyEnabled" defaultChecked={features.buddy.enabled} />
                Gym Buddies
              </label>
              <p className="text-sm text-gray-500">
                Off: the Buddies tab (and its routes) disappear from the customer app. Existing matches are not
                deleted — the flag only hides the feature.
              </p>
            </div>
            <SubmitButton pendingText="Saving…" className="w-fit">
              Save feature flags
            </SubmitButton>
          </ActionForm>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader
          title="OTP verification"
          subtitle={
            otpUpdatedAt
              ? `Controls how customer/partner phone login is verified — last updated ${formatDateTimeIST(otpUpdatedAt)} IST.`
              : 'Controls how customer/partner phone login is verified — not customized yet, showing defaults.'
          }
        />
        <Card className="max-w-2xl">
          <ActionForm
            action={updateOtpConfigAction}
            className="flex flex-col gap-4"
            confirmMessage="This changes how OTP verification works for every customer/partner login, platform-wide — including 'skip', which disables OTP verification entirely. Continue?"
          >
            <div className="flex flex-col gap-3">
              {OTP_PROVIDER_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="provider"
                    value={opt.value}
                    defaultChecked={otpConfig.provider === opt.value}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">{opt.label}</span>
                    <br />
                    <span className="text-gray-500">{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {otpConfig.provider === 'skip' && (
              <p className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
                Skip mode is live — allowlisted numbers below bypass real OTP with code 123456. Every other
                number still receives a real Fast2SMS OTP.
              </p>
            )}
            <SubmitButton pendingText="Saving…" className="w-fit">
              Save OTP provider
            </SubmitButton>
          </ActionForm>
        </Card>

        <Table>
          <Thead>
            <Th>Phone</Th>
            <Th>Note</Th>
            <Th>Added</Th>
            <Th>Action</Th>
          </Thead>
          <tbody>
            {skipAllowlist.map((entry) => (
              <Tr key={entry.id}>
                <Td>{entry.phone}</Td>
                <Td>{entry.note || '—'}</Td>
                <Td>{formatDateIST(entry.createdAt)}</Td>
                <Td>
                  <ActionForm action={removeOtpSkipAllowlistAction} confirmMessage={`Remove ${entry.phone}?`}>
                    <input type="hidden" name="id" value={entry.id} />
                    <SubmitButton variant="danger" pendingText="Removing…">Remove</SubmitButton>
                  </ActionForm>
                </Td>
              </Tr>
            ))}
            {skipAllowlist.length === 0 && <EmptyRow colSpan={4}>No numbers on the skip allowlist yet.</EmptyRow>}
          </tbody>
        </Table>

        <Card className="max-w-md">
          <ActionForm action={addOtpSkipAllowlistAction} className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="otp-skip-phone">Phone</label>
            <input
              id="otp-skip-phone"
              name="phone"
              required
              placeholder="9876543210"
              className="rounded border px-3 py-2 text-sm"
            />

            <label className="text-sm font-medium" htmlFor="otp-skip-note">Note (optional)</label>
            <input
              id="otp-skip-note"
              name="note"
              placeholder="e.g. QA test phone"
              className="rounded border px-3 py-2 text-sm"
            />

            <SubmitButton pendingText="Adding…" className="w-fit">Add to skip allowlist</SubmitButton>
          </ActionForm>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader
          title="Profile-completion bonus"
          subtitle={
            bonusUpdatedAt
              ? `One-time wallet credit when a customer's profile crosses from incomplete to complete — last updated ${formatDateTimeIST(bonusUpdatedAt)} IST.`
              : 'One-time wallet credit when a customer\'s profile crosses from incomplete to complete — not customized yet, showing defaults.'
          }
        />
        <Card className="max-w-md">
          <ActionForm
            action={updateProfileCompletionBonusAction}
            className="flex flex-col gap-4"
            confirmMessage="This changes the wallet reward for every customer completing their profile, immediately (it only applies to profiles completed after the change). Continue?"
          >
            <label className="flex flex-col gap-1 text-sm">
              Bonus amount (₹)
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
              goals) are set. Set to 0 to disable the bonus — a profile completed while it is disabled is never
              paid retroactively.
            </p>
            <SubmitButton pendingText="Saving…" className="w-fit">
              Save bonus amount
            </SubmitButton>
          </ActionForm>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader
          title="Wallet top-up amounts"
          subtitle={
            topupConfig.updatedAt
              ? `Live for website + app top-up — last updated ${formatDateTimeIST(topupConfig.updatedAt)} IST.`
              : 'Live for website + app top-up — not customized yet, showing defaults.'
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
                <Td>₹{amount}</Td>
                <Td>
                  <ActionForm action={removeWalletTopupPresetAction} confirmMessage={`Remove ₹${amount} as a preset?`}>
                    <input type="hidden" name="amount" value={amount} />
                    <SubmitButton variant="danger" pendingText="Removing…">Remove</SubmitButton>
                  </ActionForm>
                </Td>
              </Tr>
            ))}
            {topupConfig.presets.length === 0 && (
              <EmptyRow colSpan={2}>No preset amounts — custom amount only.</EmptyRow>
            )}
          </tbody>
        </Table>

        <Card className="max-w-sm">
          <ActionForm action={addWalletTopupPresetAction} className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="topup-preset-amount">New preset amount (₹)</label>
            <input
              id="topup-preset-amount"
              name="amount"
              type="number"
              min={1}
              step={1}
              required
              className="rounded border px-3 py-2 text-sm"
            />
            <SubmitButton pendingText="Adding…" className="w-fit">Add preset</SubmitButton>
          </ActionForm>
        </Card>

        <Card className="max-w-md">
          <ActionForm
            action={updateWalletTopupCustomAmountAction}
            className="flex flex-col gap-4"
            confirmMessage="This changes whether customers can type any custom top-up amount, platform-wide. Continue?"
          >
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="allowCustomAmount" defaultChecked={topupConfig.allowCustomAmount} />
              Allow customer-entered custom amount
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                Min (₹)
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
                Max (₹)
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
              toggle must stay on — customers need at least one way to top up. Amounts above ₹25,000 are rejected
              regardless of what&rsquo;s set here.
            </p>
            <SubmitButton pendingText="Saving…" className="w-fit">Save custom-amount settings</SubmitButton>
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}
