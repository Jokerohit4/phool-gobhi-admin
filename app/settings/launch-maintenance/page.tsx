import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { ActionForm } from '@/components/ui/ActionForm';
import { Toggle } from '@/components/ui/Toggle';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { InlineError } from '@/components/ui/InlineError';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SettingsSectionNav } from '../SettingsSectionNav';
import { updateLaunchGateAction, updateMaintenanceAction } from '../actions';
import { MAINTENANCE_SECTIONS, EMPTY_MAINTENANCE_ENTRY, utcIsoToLaunchInput, type MaintenanceConfig } from '../settingsShared';

interface LaunchGate {
  enabled: boolean;
  launchAt: string | null;
}

export default async function LaunchMaintenanceSettingsPage() {
  await requireSession();

  const [gateSettled, configSettled] = await Promise.allSettled([
    gatewayJson<{ data: LaunchGate }>('/api/auth/launch-gate/admin'),
    gatewayJson<{ data: Record<string, unknown> }>('/api/auth/app-config/admin'),
  ]);
  if (gateSettled.status === 'rejected') console.error('LaunchMaintenanceSettingsPage: launch-gate load failed', gateSettled.reason);
  if (configSettled.status === 'rejected') console.error('LaunchMaintenanceSettingsPage: app-config load failed', configSettled.reason);
  const launchGate = gateSettled.status === 'fulfilled' ? gateSettled.value.data : null;
  const maintenanceConfig = configSettled.status === 'fulfilled' ? configSettled.value.data : null;

  const maintenanceRaw = ((maintenanceConfig as { maintenance?: Partial<MaintenanceConfig> } | null)?.maintenance || {}) as Partial<MaintenanceConfig>;
  const maintenance: MaintenanceConfig = {
    wallet: { ...EMPTY_MAINTENANCE_ENTRY, ...(maintenanceRaw.wallet || {}) },
    gyms: { ...EMPTY_MAINTENANCE_ENTRY, ...(maintenanceRaw.gyms || {}) },
  };

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Settings', href: '/settings' }, { label: 'Launch & maintenance' }]} />
      <PageHeader title="Launch & maintenance" subtitle="Control launch gating and website maintenance windows. These changes affect the website immediately; partner onboarding and apps are not affected as noted." />
      <SettingsSectionNav />

      {launchGate ? (
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
            <label className="flex items-center gap-3 text-sm font-medium">
              <Toggle name="enabled" defaultChecked={launchGate.enabled} />
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
      ) : (
        <InlineError title="Could not load the launch gate" message="This section could not be loaded, so editing is disabled to avoid saving over values you cannot see." retryHref="/settings/launch-maintenance" />
      )}

      {maintenanceConfig ? (
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
                  <label className="flex items-center gap-3 text-sm font-medium">
                    <Toggle name="enabled" defaultChecked={entry.enabled} />
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
      ) : (
        <InlineError title="Could not load maintenance windows" message="This section could not be loaded, so editing is disabled to avoid saving over values you cannot see." retryHref="/settings/launch-maintenance" />
      )}
    </div>
  );
}
