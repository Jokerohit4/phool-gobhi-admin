import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { setHealthFeatureFlagsAction, updateRetentionPolicyAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Toggle } from '@/components/ui/Toggle';

interface AdoptionSummary {
  consentedUsers: number;
  revokedUsers: number;
  totalSessions: number;
  finishedSessions: number;
  totalTemplates: number;
  syncedExerciseRecords: number;
  manualExerciseRecords: number;
}

interface FeedbackStats {
  shown: number;
  voted: number;
  actionRate: number;
  votes: Record<string, number>;
}

interface RetentionPolicy {
  suggestionFeedbackDays: number;
  updatedBy?: number | null;
}

interface FeatureFlags {
  healthMetrics: { enabled: boolean };
  healthPersonalisation: { enabled: boolean };
  recapSharing: { enabled: boolean };
}

const DEFAULT_FEATURES: FeatureFlags = {
  healthMetrics: { enabled: false },
  healthPersonalisation: { enabled: false },
  recapSharing: { enabled: false },
};

// The four votes SuggestionFeedback can carry, in the order that reads as a
// spectrum rather than alphabetically — "done" is the strongest signal and
// belongs next to "up", not buried after "skip".
const VOTE_LABELS: [string, string][] = [
  ['done', 'Did it'],
  ['up', 'Useful'],
  ['skip', 'Skipped'],
  ['down', 'Not useful'],
];

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-400">{hint}</div>}
    </Card>
  );
}

export default async function HealthPage() {
  await requireSession();

  // These four are independent reads and one failing should not blank the
  // whole page — Promise.all here would do exactly that, which is the bug
  // already noted against the Analytics views.
  const [summaryRes, feedbackRes, retentionRes, appConfigRes] = await Promise.allSettled([
    gatewayJson<{ data: AdoptionSummary }>('/api/health/admin/adoption-summary'),
    gatewayJson<{ data: FeedbackStats }>('/api/health/admin/suggestion-feedback'),
    gatewayJson<{ data: RetentionPolicy }>('/api/health/admin/retention-policy'),
    gatewayJson<{ data: Record<string, unknown> }>('/api/auth/app-config/admin'),
  ]);

  const summary = summaryRes.status === 'fulfilled' ? summaryRes.value.data : null;
  const feedback = feedbackRes.status === 'fulfilled' ? feedbackRes.value.data : null;
  const retention = retentionRes.status === 'fulfilled' ? retentionRes.value.data : null;

  const rawFeatures =
    appConfigRes.status === 'fulfilled'
      ? ((appConfigRes.value.data.features as Partial<FeatureFlags>) || {})
      : {};
  const features: FeatureFlags = {
    healthMetrics: { ...DEFAULT_FEATURES.healthMetrics, ...(rawFeatures.healthMetrics || {}) },
    healthPersonalisation: { ...DEFAULT_FEATURES.healthPersonalisation, ...(rawFeatures.healthPersonalisation || {}) },
    recapSharing: { ...DEFAULT_FEATURES.recapSharing, ...(rawFeatures.recapSharing || {}) },
  };

  const failed = [
    summaryRes.status === 'rejected' && 'adoption summary',
    feedbackRes.status === 'rejected' && 'suggestion feedback',
    retentionRes.status === 'rejected' && 'retention policy',
    appConfigRes.status === 'rejected' && 'feature flags',
  ].filter(Boolean) as string[];

  const voteRows = VOTE_LABELS.map(([key, label]) => ({
    label,
    count: feedback?.votes?.[key] ?? 0,
  }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Health & Training"
        subtitle="Adoption, whether the readiness suggestions land at all (GS-5), the retention window, and the switches that gate the whole layer. Aggregate only — there is deliberately no per-user drill-down into anyone's health data."
      />

      {failed.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <div className="text-sm text-amber-700 dark:text-amber-300">
            Could not load: {failed.join(', ')}. The rest of this page is still accurate.
          </div>
        </Card>
      )}

      {/* ── Adoption ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Adoption</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Consented users" value={summary?.consentedUsers ?? '—'} />
          <Stat
            label="Revoked consent"
            value={summary?.revokedUsers ?? '—'}
            hint="withdrawals, not deletions"
          />
          <Stat
            label="Sessions finished"
            value={summary ? `${summary.finishedSessions} / ${summary.totalSessions}` : '—'}
            hint="started sessions that were completed"
          />
          <Stat label="Routines saved" value={summary?.totalTemplates ?? '—'} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Device-synced records"
            value={summary?.syncedExerciseRecords ?? '—'}
            hint="HealthKit / Health Connect"
          />
          <Stat label="Manually logged" value={summary?.manualExerciseRecords ?? '—'} />
        </div>
      </section>

      {/* ── GS-5 ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Are the suggestions landing? (GS-5)</h2>
        <p className="text-sm text-gray-500">
          Of every readiness suggestion shown, how many got any reaction at all. A high impression count with a low
          action rate means the suggestions are being ignored, not that the feature is being used.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Suggestions shown" value={feedback?.shown ?? '—'} />
          <Stat label="Got a reaction" value={feedback?.voted ?? '—'} />
          <Stat
            label="Action rate"
            value={feedback ? `${feedback.actionRate}%` : '—'}
            hint="reactions ÷ impressions"
          />
        </div>
        <Table>
          <Thead>
            <Th>Reaction</Th>
            <Th>Count</Th>
            <Th>Share of reactions</Th>
          </Thead>
          {!feedback || feedback.voted === 0 ? (
            <EmptyRow colSpan={3}>
              No reactions recorded yet
              {features.healthMetrics.enabled ? '' : ' — Health metrics is switched off, so nothing is being shown'}
            </EmptyRow>
          ) : (
            voteRows.map((row) => (
              <Tr key={row.label}>
                <Td>{row.label}</Td>
                <Td>{row.count}</Td>
                <Td>{Math.round((row.count / feedback.voted) * 1000) / 10}%</Td>
              </Tr>
            ))
          )}
        </Table>
      </section>

      {/* ── Retention ────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Retention window</h2>
        <p className="text-sm text-gray-500">
          DPDPA purpose limitation. This applies to <strong>suggestion telemetry only</strong> — the impression and
          vote rows behind the numbers above. A user&apos;s own training history and biometrics are never on a timer:
          they are deleted with the account, not by age. Financial records are never swept at all.
        </p>
        <Card>
          <ActionForm action={updateRetentionPolicyAction} className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Telemetry expires after (days)</span>
              <input
                type="number"
                name="suggestionFeedbackDays"
                min={30}
                max={3650}
                defaultValue={retention?.suggestionFeedbackDays ?? 180}
                className="w-32 rounded border px-2 py-1 dark:bg-gray-800 dark:border-gray-700"
              />
            </label>
            <SubmitButton>Save</SubmitButton>
            <p className="w-full text-xs text-gray-400">
              Minimum 30 days, enforced server-side: a shorter window would delete telemetry before it has been
              aggregated, destroying the very metric it exists to produce. The sweep runs weekly.
            </p>
          </ActionForm>
        </Card>
      </section>

      {/* ── Switches ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Switches</h2>
        <p className="text-sm text-gray-500">
          The same auth-service app-config feature flags Settings edits, surfaced here so the gates live next to what
          they gate. Every one is enforced server-side, not just hidden in the client.
        </p>
        <Card>
          <ActionForm action={setHealthFeatureFlagsAction} className="flex flex-col gap-4">
            <label className="flex items-start gap-3 text-sm">
              <Toggle name="healthMetricsEnabled" defaultChecked={features.healthMetrics.enabled} />
              <span>
                <span className="font-medium">Health metrics</span>
                <span className="block text-xs text-gray-500">
                  The whole layer: logging, biometrics, progress, exports. Off means every customer-facing health route
                  returns 403.
                </span>
              </span>
            </label>

            <div className="rounded border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Needs legal sign-off first
              </div>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                These two are held separately from Health metrics on purpose. They are the only parts of this layer
                that need counsel before a real user touches them — leave both off until that review is done, even
                while testing the rest.
              </p>

              <label className="mt-3 flex items-start gap-3 text-sm">
                <Toggle
                  name="healthPersonalisationEnabled"
                  defaultChecked={features.healthPersonalisation.enabled}
                />
                <span>
                  <span className="font-medium">Personalisation</span>
                  <span className="block text-xs text-gray-500">
                    The only consent-bearing write in the service: choosing a non-neutral programming mode records that
                    the user agreed, under a specific privacy version. The consent wording has to be reviewed before
                    anyone actually agrees to it.
                  </span>
                </span>
              </label>

              <label className="mt-3 flex items-start gap-3 text-sm">
                <Toggle name="recapSharingEnabled" defaultChecked={features.recapSharing.enabled} />
                <span>
                  <span className="font-medium">Weekly recap sharing</span>
                  <span className="block text-xs text-gray-500">
                    The only feature producing something meant to leave the platform. The payload carries no PII by
                    construction — but &ldquo;we believe it carries no PII&rdquo; is exactly the claim worth having
                    checked before it becomes shareable.
                  </span>
                </span>
              </label>
            </div>

            <div>
              <SubmitButton>Save switches</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}
