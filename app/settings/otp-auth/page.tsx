import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SettingsSectionNav } from '../SettingsSectionNav';
import { updateOtpConfigAction, addOtpSkipAllowlistAction, removeOtpSkipAllowlistAction } from '../actions';
import { OTP_PROVIDER_OPTIONS, formatDateIST, formatDateTimeIST, type OtpProvider, type OtpSkipAllowlistEntry } from '../settingsShared';

export default async function OtpAuthSettingsPage() {
  await requireSession();

  const [otpRes, otpSkipRes] = await Promise.all([
    gatewayJson<{ data: { provider: OtpProvider }; updatedAt?: string | null }>('/api/auth/otp-config/admin'),
    gatewayJson<{ data: OtpSkipAllowlistEntry[] }>('/api/auth/otp-config/admin/skip-allowlist'),
  ]);
  const otpConfig = { provider: otpRes.data.provider, updatedAt: otpRes.updatedAt ?? null };
  const skipAllowlist = otpSkipRes.data;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Settings', href: '/settings' }, { label: 'OTP & auth' }]} />
      <PageHeader title="OTP & auth" subtitle="Control phone-login OTP verification and the skip allowlist for testing." />
      <SettingsSectionNav />

      <section className="flex flex-col gap-4">
        <PageHeader
          title="OTP verification"
          subtitle={
            otpConfig.updatedAt
              ? `Controls how customer/partner phone login is verified ? last updated ${formatDateTimeIST(otpConfig.updatedAt)} IST.`
              : 'Controls how customer/partner phone login is verified ? not customized yet, showing defaults.'
          }
        />
        <Card className="max-w-2xl">
          <ActionForm
            action={updateOtpConfigAction}
            className="flex flex-col gap-4"
            confirmMessage="This changes how OTP verification works for every customer/partner login, platform-wide ? including 'skip', which disables OTP verification entirely. Continue?"
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
                Skip mode is live ? allowlisted numbers below bypass real OTP with code 123456. Every other
                number still verifies through real Firebase phone auth ? Fast2SMS never fires unless it is
                explicitly selected above.
              </p>
            )}
            <SubmitButton pendingText="Saving?" className="w-fit">
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
                <Td>{entry.note || '?'}</Td>
                <Td>{formatDateIST(entry.createdAt)}</Td>
                <Td>
                  <ActionForm action={removeOtpSkipAllowlistAction} confirmMessage={`Remove ${entry.phone}?`}>
                    <input type="hidden" name="id" value={entry.id} />
                    <SubmitButton variant="danger" pendingText="Removing?">Remove</SubmitButton>
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
            <SubmitButton pendingText="Adding?" className="w-fit">Add to skip allowlist</SubmitButton>
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}
