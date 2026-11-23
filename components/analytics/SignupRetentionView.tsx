import Link from 'next/link';
import { gatewayJson } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { InlineError } from '@/components/ui/InlineError';
import { SectionHeading } from '@/components/charts/SectionHeading';
import { SignupRetentionChart } from '@/components/charts/SignupRetentionChart';
import { cohortQs } from '@/lib/cohortFilter';
import {
  SIGNUP_GRANULARITIES, SIGNUP_PLATFORMS, SIGNUP_WINDOWS, SMALL_SAMPLE_THRESHOLD,
  cohortLabel, formatMinutes, formatPct100, formatReturnCount, formatReturnPct, isSmallSample,
  signupChartRows, signupRetentionQuery,
  type SignupCohort, type SignupGranularity, type SignupPlatform, type SignupRetentionData,
} from '@/lib/signupRetention';

const PLATFORM_LABELS: Record<SignupPlatform, string> = { app: 'App (iOS + Android)', ios: 'iOS', android: 'Android', web: 'Web', all: 'All' };

const th = 'whitespace-nowrap px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-gray-400';

function ReturnCell({ c }: { c: SignupCohort['d1'] }) {
  return (
    <td className="whitespace-nowrap px-2 py-1.5 text-center tabular-nums">
      <div>{formatReturnPct(c)}</div>
      <div className="text-xs text-gray-500">{formatReturnCount(c)}</div>
    </td>
  );
}

function CohortRow({ c, granularity, total = false }: { c: SignupCohort; granularity: string; total?: boolean }) {
  return (
    <tr className={`border-t border-gray-100 dark:border-gray-800 ${total ? 'bg-gray-50 font-medium dark:bg-gray-800/50' : ''}`}>
      <td className="whitespace-nowrap px-2 py-1.5">
        {total ? 'Total' : cohortLabel(c.start, granularity)}
        {!total && isSmallSample(c.size) && (
          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">small sample</span>
        )}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{c.size}</td>
      <ReturnCell c={c.d1} />
      <ReturnCell c={c.d3} />
      <ReturnCell c={c.d7} />
      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatPct100(c.onboardedPct)}</td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatPct100(c.workoutWithin24hPct)}</td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatMinutes(c.medianActiveMinutesDay1)}</td>
    </tr>
  );
}

export async function SignupRetentionView({
  platform, granularity, windowDays, cohort,
}: { platform: SignupPlatform; granularity: SignupGranularity; windowDays: number; cohort: string }) {
  const href = (o: { platform?: string; granularity?: string; days?: number } = {}) =>
    `/analytics?view=signupRetention&platform=${o.platform ?? platform}&granularity=${o.granularity ?? granularity}&days=${o.days ?? windowDays}${cohortQs(cohort)}`;

  let data: SignupRetentionData;
  try {
    ({ data } = await gatewayJson<{ data: SignupRetentionData }>(
      `/api/bookings/admin/analytics/retention-signup-cohorts?${signupRetentionQuery({ windowDays, platform, granularity, cohortQs: cohortQs(cohort) })}`,
    ));
  } catch (err) {
    return (
      <Card>
        <InlineError
          message={err instanceof Error ? err.message : 'Could not load signup retention.'}
          retryHref={href()}
        />
      </Card>
    );
  }

  const cohorts = [...data.cohorts].sort((a, b) => (a.start < b.start ? 1 : -1)); // newest first in the table
  const chartRows = signupChartRows(data.cohorts, granularity);
  const pill = (active: boolean) =>
    `rounded px-2.5 py-1 text-sm transition-colors ${active ? 'bg-gray-800 font-medium text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`;

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Platform</span>
            <div className="flex flex-wrap gap-1">
              {SIGNUP_PLATFORMS.map((p) => (
                <Link key={p} href={href({ platform: p })} aria-current={p === platform ? 'true' : undefined} className={pill(p === platform)}>{PLATFORM_LABELS[p]}</Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Group by</span>
            <div className="flex gap-1">
              {SIGNUP_GRANULARITIES.map((g) => (
                <Link key={g} href={href({ granularity: g })} aria-current={g === granularity ? 'true' : undefined} className={pill(g === granularity)}>{g === 'week' ? 'Week' : 'Day'}</Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Signups from</span>
            <div className="flex gap-1">
              {SIGNUP_WINDOWS.map((d) => (
                <Link key={d} href={href({ days: d })} aria-current={d === windowDays ? 'true' : undefined} className={pill(d === windowDays)}>Last {d} days</Link>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeading
          title="Return rate by signup cohort"
          subtitle={`Share of signups ${data.since} to ${data.until} (IST) who came back on day 1, 3 and 7. A person counts toward day N only once day N has fully passed, so the newest cohorts are always partial and a missing bar means not yet measurable, not zero.`}
        />
        <SignupRetentionChart rows={chartRows} />
      </Card>

      <Card>
        <SectionHeading
          title="Cohort detail"
          subtitle={`Each return cell is the rate with returned/eligible underneath. A dash means no one is eligible yet. Cohorts under ${SMALL_SAMPLE_THRESHOLD} signups are flagged as a small sample: do not read anything into their rates.`}
        />
        {cohorts.length === 0 ? (
          <p className="text-sm text-gray-500">No signups for this platform in this window.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={`${th} text-left`}>Cohort</th>
                  <th className={`${th} text-right`}>Signups</th>
                  <th className={`${th} text-center`}>D1</th>
                  <th className={`${th} text-center`}>D3</th>
                  <th className={`${th} text-center`}>D7</th>
                  <th className={`${th} text-right`}>Onboarded</th>
                  <th className={`${th} text-right`}>Workout in 24h</th>
                  <th className={`${th} text-right`}>Median active, day 1</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => <CohortRow key={c.start} c={c} granularity={granularity} />)}
                {data.total && <CohortRow c={data.total} granularity={granularity} total />}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-500">
          Platform is the one stamped on the signup event, else the person&apos;s first client-reported platform; people with neither only appear under All.
        </p>
      </Card>
    </>
  );
}
