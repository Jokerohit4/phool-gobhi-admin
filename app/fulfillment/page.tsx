import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { gatewayJson } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { parsePositiveId } from '@/lib/ids';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionForm } from '@/components/ui/ActionForm';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { Section } from '@/components/ui/Section';
import { InlineError } from '@/components/ui/InlineError';
import { fulfillmentAction } from './actions';
import { CheckinReversalForm, DisputedSessionQueue, SessionLogForm } from './SessionTools';
import { DISPUTED_PAGE_SIZE, DISPUTED_SESSIONS_PATH, type DisputedSessions } from './sessions';

type Fulfillment = { id: number; kind: string; status: string; details: { address?: string; panel?: string } };
type Customer = { id: number; name: string; phone: string; plan_type: string; plan_status: string; risk_bucket: string; clinical_status: string; trial_cleared: boolean; gym_pass_status: string; free_delight_sessions_remaining: number; addon_trainer_sessions_remaining: number; lab_credits_remaining: number; fulfillment: Fulfillment[] };
type Profile = { userId: number; sourceReportId: number | null; confirmedAt: string | null; confirmedDetails: { name?: string }; confirmedMarkers: Record<string, number>; clinicalStatus: string; clinicalNote?: string; clinicianName?: string; clinicianRegistration?: string; agreedActions?: string[] };
type CareRequest = { id: number; userId: number; kind: string; status: string; message: string; preferredAt: string | null };
const input = 'w-full rounded border p-2 text-sm dark:bg-gray-900';
function Hidden({ userId, action }: { userId: number; action: string }) { return <><input type="hidden" name="userId" value={userId} /><input type="hidden" name="action" value={action} /></>; }
function CompleteSession({ c, kind }: { c: Customer; kind: 'FREE_SESSION' | 'ADDON_SESSION' }) {
  const left = kind === 'FREE_SESSION' ? c.free_delight_sessions_remaining : c.addon_trainer_sessions_remaining;
  return <ActionForm action={fulfillmentAction} confirmMessage="Record one completed session?"><Hidden userId={c.id} action={kind} /><input type="hidden" name="idempotencyKey" value={randomUUID()} /><button disabled={left < 1} className="rounded border px-2 py-1 text-xs disabled:opacity-40">Complete {kind === 'FREE_SESSION' ? 'free' : 'extra'} session ({left})</button></ActionForm>;
}
export default async function FulfillmentPage({ searchParams }: { searchParams: Promise<{ disputesPage?: string | string[] }> }) {
  await requireSession();
  const { disputesPage } = await searchParams;
  const requestedPage = typeof disputesPage === 'string' ? parsePositiveId(disputesPage) : null;
  const page = requestedPage && requestedPage <= Math.floor(2147483647 / DISPUTED_PAGE_SIZE) ? requestedPage : 1;
  const [memberships, care, disputes] = await Promise.allSettled([
    gatewayJson<{ data: Customer[] }>('/api/wallet/coaching/admin/fulfillment'),
    gatewayJson<{ data: { profiles: Profile[]; requests: CareRequest[] } }>('/api/health/guidance/admin'),
    gatewayJson<{ data: DisputedSessions }>(DISPUTED_SESSIONS_PATH + '?page=' + page + '&limit=' + DISPUTED_PAGE_SIZE),
  ]);
  const customers = memberships.status === 'fulfilled' ? memberships.value.data : [];
  const { profiles, requests } = care.status === 'fulfilled' ? care.value.data : { profiles: [], requests: [] };
  return <div className="flex flex-col gap-6">
    <Breadcrumbs items={[{ label: 'Coaching fulfillment' }]} />
    <Section className="gap-4">
    <PageHeader title="Health guidance & fulfillment" subtitle="Paid memberships, session completion, clinical review and collection requests" />
    <div className="flex flex-wrap gap-3 text-sm">
      <Link href="/coaching-plans" className="underline">Guided plans & offerings</Link>
      <Link href="/reports" className="underline">Saved blood reports</Link>
      <Link href="/users" className="underline">Users & cohorts</Link>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <SessionLogForm />
      <CheckinReversalForm />
    </div>
    {disputes.status === 'fulfilled' ? <DisputedSessionQueue queue={disputes.value.data} /> : (
      <InlineError title="Could not load disputed sessions"
        message={disputes.reason instanceof Error ? disputes.reason.message : 'Could not load disputed sessions'}
        retryHref={'/fulfillment?disputesPage=' + page + '#disputed-sessions'} />
    )}
    {memberships.status === 'rejected' && <InlineError title="Could not load memberships"
      message={memberships.reason instanceof Error ? memberships.reason.message : 'Could not load memberships'} retryHref="/fulfillment" />}
    {care.status === 'rejected' && <InlineError title="Could not load care records"
      message={care.reason instanceof Error ? care.reason.message : 'Could not load care records'} retryHref="/fulfillment" />}
    <div className="overflow-x-auto rounded border"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-gray-50 dark:bg-gray-800">{['Customer', 'Phone', 'Plan', 'Risk / review', '72h cleared', 'Gym pass', 'Lab credits', 'Completed sessions'].map(x => <th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{customers.map(c => <tr key={c.id} className="border-b">
      <td className="p-3">{c.name}<small className="block">#{c.id}</small></td><td className="p-3">{c.phone || '—'}</td><td className="p-3">{c.plan_type}<small className="block">{c.plan_status}</small></td><td className="p-3">{c.risk_bucket} / {c.clinical_status}</td><td className="p-3">{c.trial_cleared ? 'Yes' : 'No'}</td>
      <td className="p-3"><ActionForm action={fulfillmentAction}><Hidden userId={c.id} action="GYM" /><select name="status" defaultValue={c.gym_pass_status} className={input}>{['NOT_ISSUED', 'AWAITING_ASSIGNMENT', 'ASSIGNED', 'ACTIVE', 'CANCELLED'].map(x => <option key={x}>{x}</option>)}</select><button className="mt-1 rounded border px-2 py-1 text-xs">Save pass status</button></ActionForm></td>
      <td className="p-3">{c.lab_credits_remaining}</td><td className="space-y-2 p-3"><CompleteSession c={c} kind="FREE_SESSION" /><CompleteSession c={c} kind="ADDON_SESSION" /></td>
    </tr>)}{memberships.status === 'fulfilled' && !customers.length && <tr><td colSpan={8} className="p-4">No paid coaching memberships yet.</td></tr>}</tbody></table></div>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Founder fulfillment queue</h2>{customers.flatMap(c => c.fulfillment.filter(r => ['REQUESTED', 'CONFIRMED'].includes(r.status)).map(r => <div key={r.id} className="rounded border p-4 text-sm"><b>{c.name} · {r.kind} · {r.status}</b>{r.details.address && <p>{r.details.panel}: {r.details.address}</p>}<ActionForm action={fulfillmentAction} className="mt-2 flex flex-wrap gap-2"><Hidden userId={c.id} action="FULFILLMENT_STATUS" /><input type="hidden" name="requestId" value={r.id} /><select name="status" className="rounded border p-1 dark:bg-gray-900"><option>CONFIRMED</option><option>COMPLETED</option><option>CANCELLED</option></select><button className="rounded border px-2 py-1">Update fulfillment</button></ActionForm></div>))}</section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Coaching & clinical requests</h2>{requests.map(r => <div key={r.id} className="rounded border p-4 text-sm"><b>Customer #{r.userId} · {r.kind}</b><p>{r.message}</p><p>{r.preferredAt ? new Date(r.preferredAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'No preferred time'} · {r.status}</p><ActionForm action={fulfillmentAction} className="mt-2 flex flex-wrap gap-2"><Hidden userId={r.userId} action="CARE_STATUS" /><input type="hidden" name="requestId" value={r.id} /><select name="status" defaultValue={r.status} className="rounded border p-1 dark:bg-gray-900">{['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map(s => <option key={s}>{s}</option>)}</select><button className="rounded border px-2 py-1">Update request</button></ActionForm></div>)}</section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Record a clinician’s review</h2><p className="text-sm text-gray-500">Record completed reviews with the clinician’s identity and registration. Patient-confirmed data is not clinical clearance.</p>{profiles.filter(p => p.confirmedAt).map(p => <details key={p.userId} className="rounded border p-4"><summary className="cursor-pointer">{p.confirmedDetails.name || `Customer #${p.userId}`} · {p.clinicalStatus}</summary><a className="my-3 inline-block text-sm text-emerald-700 underline" href={`/api/guidance/report-link?userId=${p.userId}`} target="_blank" rel="noreferrer">Open confirmed source report</a><p className="my-3 text-sm">Confirmed markers: {Object.entries(p.confirmedMarkers).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'None'}</p><ActionForm action={fulfillmentAction} className="space-y-3" confirmMessage="Record this clinician’s signed review and outcome?">
      <Hidden userId={p.userId} action="REVIEW" /><input type="hidden" name="sourceReportId" value={p.sourceReportId ?? ''} /><input type="hidden" name="confirmedAt" value={p.confirmedAt || ''} />
      <label className="block text-sm">Clinician name<input required name="clinicianName" defaultValue={p.clinicianName} maxLength={150} className={input} /></label>
      <label className="block text-sm">Registration / licence<input required name="clinicianRegistration" defaultValue={p.clinicianRegistration} maxLength={100} className={input} /></label>
      <label className="block text-sm">Signed review note<textarea required name="clinicalNote" defaultValue={p.clinicalNote} maxLength={10000} rows={4} className={input} /></label>
      <label className="block text-sm">Agreed actions, one per line<textarea name="agreedActions" defaultValue={p.agreedActions?.join('\n')} rows={4} className={input} /></label>
      <label className="block text-sm">Review outcome<select name="clinicalStatus" defaultValue={p.clinicalStatus === 'PENDING' ? 'FOLLOW_UP_REQUIRED' : p.clinicalStatus} className={input}><option>CLEARED</option><option>FOLLOW_UP_REQUIRED</option><option>NOT_CLEARED</option></select></label>
      <label className="block text-sm"><input type="checkbox" required name="attestReviewed" /> I am recording a completed review from the named clinician, with permission to record it.</label><button className="rounded bg-emerald-700 px-4 py-2 text-white">Record clinical review</button>
    </ActionForm></details>)}</section>
    </Section>
  </div>;
}
