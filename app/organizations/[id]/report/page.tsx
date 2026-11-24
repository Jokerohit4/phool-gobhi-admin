import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { gatewayJson, GatewayError } from '@/lib/api';
import { parsePositiveId } from '@/lib/ids';
import { buildReportView, parsePeriod, pctText, PERIODS, type Dashboard } from '@/lib/orgDashboard';
import { formatDateIST } from '@/lib/dateFormat';
import { InlineError } from '@/components/ui/InlineError';
import { PrintButton } from '@/components/ui/PrintButton';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';

// The page staff print or save as PDF and send to the company's HR contact.
// AGGREGATES ONLY (see lib/orgDashboard.ts): no names, no phone numbers, and
// small teams are left out.

export default async function CompanyReportPage({
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
    return <InlineError title="Could not load the report" message={e instanceof Error ? e.message : 'Unknown error'} retryHref={`/organizations/${id}/report?days=${days}`} />;
  }

  const r = buildReportView(d, formatDateIST);
  const maxWeekly = Math.max(1, ...r.weekly.map((w) => w.activeMembers));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Print: hide the portal chrome and force a plain light page. */}
      <style>{`@media print { aside, header, .no-print { display: none !important; } body { background: #fff !important; color: #000 !important; } main { padding: 0 !important; } }`}</style>

      <div className="no-print flex flex-wrap items-center gap-3">
        <PrintButton />
        <a className="text-sm underline" href={`/organizations/${id}/report.csv?days=${d.periodDays}`}>Download CSV</a>
        <Link className="text-sm underline" href={`/organizations/${id}/dashboard?days=${d.periodDays}`}>Back to dashboard</Link>
        <div className="ml-auto flex gap-1 text-sm">
          {PERIODS.map((p) => (
            <Link key={p} href={`/organizations/${id}/report?days=${p}`} className={`rounded border px-3 py-1 ${p === d.periodDays ? 'border-emerald-600 font-medium' : ''}`}>
              {p} days
            </Link>
          ))}
        </div>
      </div>

      {!d.complete && (
        <p className="no-print rounded border border-amber-400 p-3 text-sm text-amber-700">
          Consent and activity could not be read just now, so this report would show zeros. Do not send it; refresh and check again.
        </p>
      )}

      <header>
        <p className="text-sm text-gray-500">Phool Gobhi · Company wellness programme</p>
        <h1 className="text-2xl font-semibold">{r.company}</h1>
        <p className="text-sm text-gray-600">
          {formatDateIST(r.period.startDay)} to {formatDateIST(r.period.endDay)} ({r.period.days} days) · Programme expires: {r.expires}
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Summary</h2>
        <Table>
          <Thead><Th>Measure</Th><Th>Value</Th></Thead>
          <tbody>
            {r.headline.map((h) => <Tr key={h.label}><Td>{h.label}</Td><Td className="tabular-nums">{h.value}</Td></Tr>)}
          </tbody>
        </Table>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Participation</h2>
        <Table>
          <Thead><Th>Stage</Th><Th>People</Th></Thead>
          <tbody>{r.funnel.map((f) => <Tr key={f.label}><Td>{f.label}</Td><Td className="tabular-nums">{f.value}</Td></Tr>)}</tbody>
        </Table>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Active participants by week</h2>
        <div className="flex flex-col gap-1">
          {r.weekly.map((w) => (
            <div key={w.weekStart} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 text-gray-600">{formatDateIST(w.weekStart)}</span>
              <div className="h-4 flex-1 rounded bg-gray-100">
                <div className="h-4 rounded bg-emerald-600" style={{ width: `${(w.activeMembers / maxWeekly) * 100}%` }} />
              </div>
              <span className="w-8 text-right tabular-nums">{w.activeMembers}</span>
            </div>
          ))}
          {r.weekly.length === 0 && <p className="text-sm text-gray-500">No activity yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Active days per participant</h2>
        <Table>
          <Thead><Th>Active days</Th><Th>Participants</Th></Thead>
          <tbody>{r.distribution.map((x) => <Tr key={x.label}><Td>{x.label}</Td><Td className="tabular-nums">{x.members}</Td></Tr>)}</tbody>
        </Table>
      </section>

      {r.teams.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Teams</h2>
          <Table>
            <Thead><Th>Team</Th><Th>Participants</Th><Th>Avg active days</Th><Th>Participation</Th></Thead>
            <tbody>
              {r.teams.map((t) => (
                <Tr key={t.name}><Td>{t.name}</Td><Td>{t.participants}</Td><Td className="tabular-nums">{t.avgActiveDays}</Td><Td>{pctText(t.participationRate)}</Td></Tr>
              ))}
            </tbody>
          </Table>
          {r.hiddenTeams > 0 && <p className="mt-1 text-xs text-gray-500">{r.hiddenTeams} smaller team(s) not shown.</p>}
        </section>
      )}

      <footer className="border-t pt-3 text-xs text-gray-500">
        {r.notes.map((n) => <p key={n}>{n}</p>)}
      </footer>
    </div>
  );
}
