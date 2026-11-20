import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SettingsSectionNav } from '../SettingsSectionNav';
import { updateAppVersionConfigAction } from '../actions';
import { APP_VERSION_ROWS, formatDateTimeIST, normalizeAppVersionConfig } from '../settingsShared';

export default async function AppVersionsSettingsPage() {
  await requireSession();

  const appConfigRes = await gatewayJson<{ data: Record<string, unknown>; updatedAt?: string | null }>('/api/auth/app-config/admin');
  const appVersionConfig = normalizeAppVersionConfig(appConfigRes.data);
  const appVersionUpdatedAt = appConfigRes.updatedAt ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Settings', href: '/settings' }, { label: 'App versions' }]} />
      <PageHeader title="App versions" subtitle="Control force-update and update-available behavior for customer and partner apps." />
      <SettingsSectionNav />

      <section className="flex flex-col gap-4">
        <PageHeader
          title="App version config"
          subtitle={
            appVersionUpdatedAt
              ? `Controls the force-update gate and update-available nudge in both apps ? last updated ${formatDateTimeIST(appVersionUpdatedAt)} IST.`
              : 'Controls the force-update gate and update-available nudge in both apps ? not customized yet, showing defaults.'
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
                        placeholder="https://play.google.com/store/apps/details?id=?"
                        className="rounded border px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 text-sm">
                      Message shown to users
                      <input
                        type="text"
                        name={`${prefix}_message`}
                        defaultValue={entry.message}
                        placeholder="Optional ? shown on the update screen/dialog"
                        className="rounded border px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
            <SubmitButton pendingText="Saving?" className="w-fit">
              Save app version config
            </SubmitButton>
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}
