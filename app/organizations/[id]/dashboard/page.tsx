import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { gatewayJson, GatewayError } from '@/lib/api';
import { parsePositiveId } from '@/lib/ids';
import { boardEndLabel, expiryLabel, SCORING_LABEL } from '@/lib/orgApi';
import { INSTALL_LINK, inviteMessage, parsePeriod, pctText, PERIODS, phonesText, type Dashboard } from '@/lib/orgDashboard';
import { formatDateIST } from '@/lib/dateFormat';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { InlineError } from '@/components/ui/InlineError';
import { Section } from '@/components/ui/Section';
import { CopyButton } from '@/components/ui/CopyButton';
import { FunnelBarChart } from '@/components/charts/FunnelBarChart';
import { TrendLineChart } from '@/components/charts/TrendLineChart';

const ORG_TONE = { active: 'active', expired: 'read', archived: 'revoked' } as const;
const BOARD_TONE = { live: 'active', upcoming: 'pending', ended: 'read', archived: 'revoked' } as const;

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </Card>
  );
}

export default async function CompanyDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  await requireSession();
  const id = parsePositiveId((await params).id);
  if (id === null) notFound();
  const days = parsePeriod((await searchParams).days);

  let d: Dashboard;
  try {
    ({ data: d } = await gatewayJson<{ data: Dashboard }>(`/api/challenges/admin/orgs/${id}/dashboard?days=${days}`));
  } catch (e) {
    if (e instanceof GatewayError && e.status === 404) notFound();
    return (
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Companies', href: '/organizations' }, { label: 'Company', href: `/organizations/${id}` }, { label: 'Dashboard' }]} />
        <InlineError title="Could not load the dashboard" message={e instanceof Error ? e.message : 'Unknown error'} retryHref={`/organizations/${id}/dashboard?days=${days}`} />
      </div>
    );
  }

  const s = d.stats;
  const org = d.programme;
  const message = inviteMessage(org.name);

  return (
    <div className="flex flex-col gap-8">
      <Section>
        <Breadcrumbs items={[{ label: 'Companies', href: '/organizations' }, { label: org.name, href: `/organizations/${id}` }, { label: 'Dashboard' }]} />
        <PageHeader
          title={`${org.name}: programme dashboard`}
          subtitle={`${formatDateIST(s.window.startDay)} to ${formatDateIST(s.window.endDay)} · ${expiryLabel(org)}`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone={ORG_TONE[org.status]}>{org.status}</StatusBadge>
          <div className="flex gap-1 text-sm">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={`/organizations/${id}/dashboard?days=${p}`}
                className={`rounded border px-3 py-1 ${p === d.periodDays ? 'border-emerald-600 bg-emerald-50 font-medium dark:bg-emerald-900/30' : ''}`}
              >
                {p} days
              </Link>
            ))}
          </div>
          <Link className="text-sm underline" href={`/organizations/${id}`}>Manage people, teams and leaderboards</Link>
          <Link className="text-sm underline" href={`/organizations/${id}/report?days=${d.periodDays}`}>HR report (print or PDF)</Link>
          <a className="text-sm underline" href={`/organizations/${id}/report.csv?days=${d.periodDays}`}>Download CSV</a>
        </div>
        {org.status === 'expired' && (
          <Card className="max-w-2xl text-sm">
            This company has expired and is now a normal account for every member. These numbers are frozen at the last day. Extend the expiry on the company page to bring it back.
          </Card>
        )}
        {d.notStarted && (
          <Card className="max-w-2xl text-sm">This programme starts on {formatDateIST(org.startsAt)}. Numbers appear once it has started.</Card>
        )}
        {!d.complete && (
          <Card className="max-w-2xl text-sm text-amber-700">
            Consent and activity could not be read just now, so participants and activity show as zero. Refresh in a minute.
          </Card>
        )}
      </Section>

      <Section title="At a glance">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="People added" value={String(s.counts.added)} hint={`${s.counts.invited} not signed in yet`} />
          <Kpi label="Signed in" value={pctText(s.rates.joined)} hint={`${s.counts.joined} of ${s.counts.added}`} />
          <Kpi label="Agreed to join" value={pctText(s.rates.consented)} hint={`${s.counts.participants} participants${s.counts.optedOut ? ` · ${s.counts.optedOut} opted out` : ''}`} />
          <Kpi label="Active last 7 days" value={pctText(s.rates.activeLast7Days)} hint={`${s.activeLast7Days} of ${s.counts.participants}`} />
          <Kpi label="Active this period" value={pctText(s.rates.active)} hint={`${s.activeInPeriod} of ${s.counts.participants}`} />
          <Kpi label="Avg active days" value={String(s.avgActiveDays)} hint="per participant" />
          <Kpi label="Workout days" value={s.totals.workoutDays.toLocaleString('en-IN')} hint={`${s.totals.checkinDays.toLocaleString('en-IN')} gym check-in days`} />
          <Kpi label="Steps" value={s.totals.steps.toLocaleString('en-IN')} hint="phone-recorded" />
        </div>
      </Section>

      <Section title="Participation funnel" subtitle="Where people drop off between being added and being active.">
        <Card><FunnelBarChart steps={s.funnel.map((f) => ({ label: f.label, value: f.value }))} /></Card>
      </Section>

      <Section title="Active participants per day">
        <Card><TrendLineChart points={s.daily.map((x) => ({ day: x.day, value: x.activeMembers }))} /></Card>
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Weekly active participants" subtitle="Each person counted once per week.">
          <Table>
            <Thead><Th>Week starting (Mon)</Th><Th>Active participants</Th></Thead>
            <tbody>
              {s.weekly.map((w) => (
                <Tr key={w.weekStart}><Td>{formatDateIST(w.weekStart)}</Td><Td className="tabular-nums">{w.activeMembers}</Td></Tr>
              ))}
              {s.weekly.length === 0 && <EmptyRow colSpan={2}>No data yet.</EmptyRow>}
            </tbody>
          </Table>
        </Section>
        <Section title="How active are people?" subtitle="Participants by number of active days in this period.">
          <Card><FunnelBarChart steps={s.distribution.map((x) => ({ label: x.label, value: x.members }))} /></Card>
        </Section>
      </div>

      <Section title="Teams" subtitle={`Teams with fewer than ${d.minGroupSize} participants are hidden from the HR report.`}>
        <Table>
          <Thead>
            <Th>Team</Th><Th>People</Th><Th>Participants</Th><Th>Avg active days</Th><Th>Participation</Th><Th>In HR report</Th>
          </Thead>
          <tbody>
            {s.teams.map((t) => (
              <Tr key={t.teamId}>
                <Td>{t.name}</Td>
                <Td>{t.members}</Td>
                <Td>{t.participants}</Td>
                <Td className="tabular-nums">{t.avgActiveDays}</Td>
                <Td>{pctText(t.participationRate)}</Td>
                <Td>{t.small ? 'Hidden (too small)' : 'Shown'}</Td>
              </Tr>
            ))}
            {s.teams.length === 0 && <EmptyRow colSpan={6}>No teams set up for this company.</EmptyRow>}
          </tbody>
        </Table>
      </Section>

      <Section title="Leaderboards">
        <Table>
          <Thead><Th>Name</Th><Th>Ranks on</Th><Th>Status</Th><Th>Ends</Th><Th>Standings</Th></Thead>
          <tbody>
            {d.leaderboards.map((b) => (
              <Tr key={b.id}>
                <Td>{b.name}</Td>
                <Td>{SCORING_LABEL[b.scoring]}</Td>
                <Td><StatusBadge tone={BOARD_TONE[b.status]}>{b.status}</StatusBadge></Td>
                <Td>{boardEndLabel(b, formatDateIST)}</Td>
                <Td><Link className="underline" href={`/organizations/${id}/leaderboards/${b.id}`}>View</Link></Td>
              </Tr>
            ))}
            {d.leaderboards.length === 0 && <EmptyRow colSpan={5}>No leaderboards yet. Create one on the company page.</EmptyRow>}
          </tbody>
        </Table>
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title={`Not signed in yet (${d.actions.notSignedIn.length})`} subtitle="Added by phone number but no account yet. Ask HR to nudge them.">
          <Table>
            <Thead><Th>Phone</Th><Th>Name</Th><Th>Added</Th></Thead>
            <tbody>
              {d.actions.notSignedIn.map((m) => (
                <Tr key={m.phone}><Td>{m.phone}</Td><Td>{m.name ?? '-'}</Td><Td>{formatDateIST(m.addedAt)}</Td></Tr>
              ))}
              {d.actions.notSignedIn.length === 0 && <EmptyRow colSpan={3}>Everyone added has signed in.</EmptyRow>}
            </tbody>
          </Table>
          {d.actions.notSignedIn.length > 0 && <div><CopyButton text={phonesText(d.actions.notSignedIn)} label="Copy phone numbers" /></div>}
        </Section>
        <Section title={`Signed in, not joined yet (${d.actions.needsConsent.length})`} subtitle="They have not agreed to share health data, so they are not ranked.">
          <Table>
            <Thead><Th>Name</Th><Th>Phone</Th></Thead>
            <tbody>
              {d.actions.needsConsent.map((m) => (
                <Tr key={m.phone}><Td>{m.name ?? '-'}</Td><Td>{m.phone}</Td></Tr>
              ))}
              {d.actions.needsConsent.length === 0 && <EmptyRow colSpan={2}>No one is waiting.</EmptyRow>}
            </tbody>
          </Table>
          {d.actions.needsConsent.length > 0 && <div><CopyButton text={phonesText(d.actions.needsConsent)} label="Copy phone numbers" /></div>}
        </Section>
      </div>

      <Section title="Message for the company to send employees" subtitle={`Install link: ${INSTALL_LINK}`}>
        <Card className="max-w-2xl">
          <pre className="whitespace-pre-wrap text-sm">{message}</pre>
          <div className="mt-3"><CopyButton text={message} label="Copy message" /></div>
        </Card>
      </Section>
    </div>
  );
}
