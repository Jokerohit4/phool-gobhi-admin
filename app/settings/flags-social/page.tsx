import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { ActionForm } from '@/components/ui/ActionForm';
import { Toggle } from '@/components/ui/Toggle';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SettingsSectionNav } from '../SettingsSectionNav';
import { SocialSwitch } from '../SocialSwitch';
import { loadFlagRegistry, registryDrift, type FlagRegistryEntry } from '../flagRegistry';
import { updateFeatureFlagsAction, updateSocialSwitchAction } from '../actions';
import { InlineError } from '@/components/ui/InlineError';
import { socialEnabledFrom } from '@/lib/socialApi';

const FLAG_GROUP_ORDER = ['exploration', 'training', 'health', 'gamification', 'social', 'onboarding', 'coach', 'ops'] as const;

const FLAG_GROUP_LABELS: Record<string, string> = {
  exploration: 'Exploration',
  training: 'Workout tracking',
  health: 'Health & metrics',
  gamification: 'Gamification',
  social: 'Social',
  onboarding: 'Onboarding',
  coach: 'Coach journey',
  ops: 'Operations',
};

function flagLabel(name: string): string {
  if (name === 'homeIntroduction') return 'Home introduction (FRE)';
  if (name === 'weeklySummary') return 'Weekly summary';
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

function groupFlags(flags: FlagRegistryEntry[]): Array<[string, FlagRegistryEntry[]]> {
  const byGroup = new Map<string, FlagRegistryEntry[]>();
  for (const flag of flags) {
    const list = byGroup.get(flag.group) || [];
    list.push(flag);
    byGroup.set(flag.group, list);
  }
  return [...byGroup.entries()].sort(
    (a, b) => FLAG_GROUP_ORDER.indexOf(a[0] as never) - FLAG_GROUP_ORDER.indexOf(b[0] as never)
  );
}

export default async function FlagsSocialSettingsPage() {
  await requireSession();

  const [appConfigSettled, { flags: flagRegistry, failed: flagRegistryFailed }] = await Promise.all([
    gatewayJson<{ data: Record<string, unknown> }>('/api/auth/app-config/admin').then(
      (value) => ({ ok: true as const, value }),
      (reason: unknown) => ({ ok: false as const, reason }),
    ),
    loadFlagRegistry(),
  ]);
  if (!appConfigSettled.ok) console.error('FlagsSocialSettingsPage: app-config load failed', appConfigSettled.reason);
  const appConfig = appConfigSettled.ok ? appConfigSettled.value.data : null;

  const flagDrift = flagRegistryFailed ? { missing: [], unexpected: [] } : registryDrift(flagRegistry);
  const socialEnabled = appConfig ? socialEnabledFrom(appConfig) : false;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Settings', href: '/settings' }, { label: 'Flags & social' }]} />
      <PageHeader title="Flags & social" subtitle="Customer-app feature flags and the platform-wide social switch." />
      <SettingsSectionNav />

      <section className="flex flex-col gap-4">
        <PageHeader
          title="Feature flags"
          subtitle="Kill-switches for customer-app features. Saved to the same config blob as other app config; changes apply on the app's next launch (the app checks this once at startup). Gamification flags are also enforced server-side in challenge-service ? turning one off blocks its API routes immediately (within ~30s), not just after the app re-checks."
        />
        <Card className="max-w-xl">
          <ActionForm
            action={updateFeatureFlagsAction}
            className="flex flex-col gap-4"
            confirmMessage="This immediately gates these features for every customer app install (gamification flags also take effect server-side within ~30s). Continue?"
          >
            {flagRegistryFailed ? (
              <p className="text-sm text-red-600">
                Could not load the feature-flag registry from auth-service, so toggles are not shown rather than shown
                wrong. Check that auth-service is reachable and its <code>featureFlagRegistry</code> module deployed,
                then reload. Saving is also blocked while this is the case, so no flag can be silently turned off by an
                incomplete form.
              </p>
            ) : (
              <>
                {(flagDrift.missing.length > 0 || flagDrift.unexpected.length > 0) && (
                  <p className="text-xs text-amber-700">
                    {flagDrift.missing.length > 0 && (
                      <>auth-service does not serve {flagDrift.missing.join(', ')} yet (it is older than this portal). </>
                    )}
                    {flagDrift.unexpected.length > 0 && (
                      <>This portal does not know {flagDrift.unexpected.join(', ')} yet; it is still shown and saved.</>
                    )}
                  </p>
                )}
                {groupFlags(flagRegistry).map(([group, groupFlagList]) => (
                  <div key={group} className="flex flex-col gap-4 border-t pt-4 first:border-t-0 first:pt-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {FLAG_GROUP_LABELS[group] || group}
                    </h3>
                    {groupFlagList.map((flag) => {
                      const checked = flag.enabled;
                      const unmetDeps = flag.deps.filter(
                        (dep) => !flagRegistry.find((f) => f.name === dep)?.enabled
                      );
                      const crossGroupDeps = unmetDeps.filter(
                        (dep) => !groupFlagList.some((f) => f.name === dep)
                      );
                      return (
                        <div key={flag.name} className="flex flex-col gap-1">
                          <label className="flex items-center gap-3 text-sm font-medium">
                            <Toggle name={flag.clientKey || flag.name} defaultChecked={checked} />
                            {flagLabel(flag.name)}
                          </label>
                          {unmetDeps.length > 0 && (
                            <p className="text-xs text-amber-700">
                              Inert while{' '}
                              {unmetDeps.map((dep, i) => (
                                <span key={dep}>
                                  {i > 0 && ', '}
                                  <strong>{flagLabel(dep)}</strong>
                                  {crossGroupDeps.includes(dep) && <span className="font-normal"> (another section)</span>}
                                </span>
                              ))}{' '}
                              {unmetDeps.length === 1 ? 'is' : 'are'} off ? this toggle controls the flag, but the feature
                              will not respond until {unmetDeps.length === 1 ? 'it is' : 'they are'} on.
                            </p>
                          )}
                          <p className="text-sm text-gray-500">{flag.blastRadius}</p>
                          {flag.name === 'homeIntroduction' && (
                            <p className="text-sm text-gray-500">
                              New accounts enter when this and Coach journey are on; eligible accounts can restore the first
                              steps on another device. Existing accounts keep full Home. Switching this off restores full Home
                              immediately; water and workout completion and coin eligibility are verified by the server. Today
                              appears after a saved water log and completed workout; reminder and alarm setup is optional.
                              Steps/sleep unlock after 7 days, supplements after 10, and health records after 15 days from
                              journey start, with consent/setup still required. Small activity rewards taper over 14 days to
                              verified-location workouts only. Full Home is available after the first two steps. This setting
                              does not reset individual accounts.
                            </p>
                          )}
                          <details className="text-xs text-gray-500">
                            <summary className="cursor-pointer">Why this flag exists</summary>
                            <p className="mt-1 whitespace-pre-wrap">{flag.rationale}</p>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
            <SubmitButton pendingText="Saving?" className="w-fit">
              Save feature flags
            </SubmitButton>
          </ActionForm>
        </Card>
      </section>

      {appConfig ? (
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Social features"
          subtitle="One switch for Buddy, leaderboards and League in the customer app. Off by default. Saved into the same config blob as the flags above without changing anything else in it; apps pick it up on their next launch."
        />
        <Card className="max-w-xl">
          <SocialSwitch enabled={socialEnabled} action={updateSocialSwitchAction} />
        </Card>
      </section>
      ) : (
        <InlineError title="Could not load the social switch" message="This section could not be loaded, so editing is disabled to avoid saving over values you cannot see." retryHref="/settings/flags-social" />
      )}
    </div>
  );
}
