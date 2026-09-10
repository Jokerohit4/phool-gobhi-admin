import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { gatewayJson } from '@/lib/api';
import { requireSession } from '@/lib/auth';

import { updateRetentionPolicyAction } from './actions';

/// health-service has had four gobhi-only endpoints since it shipped and no
/// screen for any of them: adoption counts, suggestion-feedback stats, and
/// the retention period. The last one matters most — it is a DPDPA control
/// that was admin-editable by API and therefore, in practice, not editable
/// at all.
///
/// Note what is deliberately absent: any per-user view. health-service's own
/// admin service returns aggregate counts only, by design — staff get
/// adoption numbers, never an individual's workout data. A drill-down here
/// would need that decision reversed first.

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
}

const EMPTY_ADOPTION: AdoptionSummary = {
  consentedUsers: 0,
  revokedUsers: 0,
  totalSessions: 0,
  finishedSessions: 0,
  totalTemplates: 0,
  syncedExerciseRecords: 0,
  manualExerciseRecords: 0,
};

export default async function HealthPage() {
  await requireSession();

  // Each call is caught on its own. health-service is dev-only today and
  // the whole surface sits behind a feature flag, so a 403 or a cold start
  // on one endpoint must not blank the other two — that is the mistake the
  // analytics page's bare Promise.all made (see its SupplyView).
  let adoption = EMPTY_ADOPTION;
  let adoptionError: string | null = null;
  try {
    ({ data: adoption } = await gatewayJson<{ data: AdoptionSummary }>(
      '/api/health/admin/adoption-summary',
    ));
  } catch (err) {
    adoptionError = err instanceof Error ? err.message : 'Could not load adoption numbers';
  }

  let feedback: FeedbackStats = { shown: 0, voted: 0, actionRate: 0, votes: {} };
  let feedbackError: string | null = null;
  try {
    ({ data: feedback } = await gatewayJson<{ data: FeedbackStats }>(
      '/api/health/admin/suggestion-feedback',
    ));
  } catch (err) {
    feedbackError = err instanceof Error ? err.message : 'Could not load suggestion feedback';
  }

  let retention: RetentionPolicy = { suggestionFeedbackDays: 180 };
  let retentionError: string | null = null;
  try {
    ({ data: retention } = await gatewayJson<{ data: RetentionPolicy }>(
      '/api/health/admin/retention-policy',
    ));
  } catch (err) {
    retentionError = err instanceof Error ? err.message : 'Could not load the retention policy';
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Health & Activity"
        subtitle="Adoption, suggestion quality, and how long purpose-limited telemetry is kept. Aggregate only — no individual's workout data is visible here."
      />

      <Card>
        <h2 className="mb-1 text-sm font-semibold">Adoption</h2>
        {adoptionError ? (
          <LoadError message={adoptionError} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Device sync connected" value={adoption.consentedUsers} />
              <Stat
                label="Revoked"
                value={adoption.revokedUsers}
                note="Their data was deleted at the same time"
              />
              <Stat label="Sessions logged" value={adoption.finishedSessions} />
              <Stat label="Routines saved" value={adoption.totalTemplates} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4 dark:border-gray-800">
              <Stat
                label="Started but unfinished"
                value={adoption.totalSessions - adoption.finishedSessions}
                note="Abandoned mid-workout, or a draft from a check-in nobody confirmed"
              />
              <Stat label="Self-logged cardio/yoga" value={adoption.manualExerciseRecords} />
              <Stat
                label="From a device"
                value={adoption.syncedExerciseRecords}
                note="Zero until HealthKit / Health Connect sync ships"
              />
            </div>
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold">Are the suggestions any good?</h2>
        <p className="mb-3 text-sm text-gray-500">
          Every suggestion shown is recorded, not just the ones reacted to — otherwise the action
          rate has no denominator. GS-5 targets 20%.
        </p>
        {feedbackError ? (
          <LoadError message={feedbackError} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Shown" value={feedback.shown} />
              <Stat label="Reacted to" value={feedback.voted} />
              <Stat label="Action rate" value={`${feedback.actionRate}%`} />
            </div>
            {Object.keys(feedback.votes).length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4 dark:border-gray-800">
                {Object.entries(feedback.votes).map(([vote, count]) => (
                  <Stat key={vote} label={VOTE_LABELS[vote] ?? vote} value={count} />
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold">Telemetry retention</h2>
        <p className="mb-1 text-sm text-gray-500">
          How long a single suggestion impression or vote is kept before the weekly sweep deletes
          it. Its purpose is an aggregate, which the individual row stops contributing to once
          counted.
        </p>
        <p className="mb-3 text-sm text-gray-500">
          This is the <strong>only</strong> health data on a timer. A user&rsquo;s own record —
          sessions, body numbers, preferences — is deleted when they delete it or their account,
          never on a clock. Changing this number does not touch any of that.
        </p>
        {retentionError ? (
          <LoadError message={retentionError} />
        ) : (
          <ActionForm action={updateRetentionPolicyAction} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium md:max-w-xs">
              Days before deletion
              <input
                type="number"
                name="suggestionFeedbackDays"
                defaultValue={retention.suggestionFeedbackDays}
                min={30}
                max={3650}
                step={1}
                className="rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              />
            </label>
            <p className="text-sm text-gray-500">
              Between 30 and 3650. The 30-day floor is deliberate: set it lower and the sweep would
              delete telemetry before it has been aggregated, silently destroying the metric it
              exists to produce.
            </p>
            <SubmitButton>Save retention period</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}

const VOTE_LABELS: Record<string, string> = {
  up: 'Useful',
  down: 'Not useful',
  skip: 'Dismissed',
  done: 'Did it',
};

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: number | string;
  note?: string;
}) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      {note && <div className="mt-1 text-xs text-gray-400">{note}</div>}
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <p className="text-sm text-red-600 dark:text-red-400">
      {message} — health-service is dev-only and flag-gated, so this is expected on prod.
    </p>
  );
}
