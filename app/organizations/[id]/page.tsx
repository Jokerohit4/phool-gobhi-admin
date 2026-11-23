import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { gatewayJson, GatewayError } from '@/lib/api';
import { parsePositiveId } from '@/lib/ids';
import {
  addMembersAction, createBoardAction, createTeamAction, deleteTeamAction, removeMemberAction,
  setMemberTeamAction, updateBoardAction, updateOrgAction,
} from '../actions';
import { boardEndLabel, expiryLabel, isoToIstDate, SCORING_LABEL, type OrgDetail } from '@/lib/orgApi';
import { formatDateIST } from '@/lib/dateFormat';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { InlineError } from '@/components/ui/InlineError';
import { Section } from '@/components/ui/Section';

const ORG_TONE = { active: 'active', expired: 'read', archived: 'revoked' } as const;
const BOARD_TONE = { live: 'active', upcoming: 'pending', ended: 'read', archived: 'revoked' } as const;
const input = 'rounded border px-3 py-2 text-sm';

export default async function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const id = parsePositiveId((await params).id);
  if (id === null) notFound();

  let org: OrgDetail;
  try {
    ({ data: org } = await gatewayJson<{ data: OrgDetail }>(`/api/challenges/admin/orgs/${id}`));
  } catch (e) {
    if (e instanceof GatewayError && e.status === 404) notFound();
    return (
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Companies', href: '/organizations' }, { label: 'Company' }]} />
        <InlineError title="Could not load this company" message={e instanceof Error ? e.message : 'Unknown error'} retryHref={`/organizations/${id}`} />
      </div>
    );
  }

  const expired = org.status === 'expired';

  return (
    <div className="flex flex-col gap-8">
      <Section>
        <Breadcrumbs items={[{ label: 'Companies', href: '/organizations' }, { label: org.name }]} />
        <PageHeader title={org.name} subtitle={`${org.activeMembers ?? 0} members · ${org.invitedMembers ?? 0} invited · ${expiryLabel(org)}`} />
        <div><StatusBadge tone={ORG_TONE[org.status]}>{org.status}</StatusBadge></div>
        {expired && (
          <Card className="max-w-2xl text-sm">
            This company profile has expired and is now a normal one: it no longer shows in the app and its members
            continue as normal users. Nothing was deleted. Set a later expiry date (or &quot;No expiry&quot;) below to bring it back.
          </Card>
        )}
      </Section>

      <Section title="Company profile and expiry">
        <Card className="max-w-xl">
          <ActionForm action={updateOrgAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={org.id} />
            <label className="text-sm font-medium" htmlFor="name">Name</label>
            <input id="name" name="name" defaultValue={org.name} required minLength={2} maxLength={80} className={input} />

            <fieldset className="flex flex-col gap-2 rounded border p-3">
              <legend className="px-1 text-sm font-medium">Expiry</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="noExpiry" defaultChecked={org.unlimited} /> No expiry
              </label>
              <label className="text-sm" htmlFor="expiresAt">Expires at the end of (IST)</label>
              <input id="expiresAt" name="expiresAt" type="date" defaultValue={isoToIstDate(org.expiresAt)} className={input} />
              <p className="text-xs text-gray-500">
                On this date the company stops showing in the app and everyone becomes a normal user again. Every
                leaderboard here also ends no later than this date.
              </p>
            </fieldset>

            {!expired && (
              <>
                <label className="text-sm font-medium" htmlFor="status">Visibility</label>
                <select id="status" name="status" defaultValue={org.status} className={input}>
                  <option value="active">Active</option>
                  <option value="archived">Archived (hide from members now)</option>
                </select>
              </>
            )}

            <label className="text-sm font-medium" htmlFor="contactName">Contact person</label>
            <input id="contactName" name="contactName" defaultValue={org.contactName ?? ''} maxLength={120} className={input} />
            <label className="text-sm font-medium" htmlFor="contactEmail">Contact email</label>
            <input id="contactEmail" name="contactEmail" type="email" defaultValue={org.contactEmail ?? ''} maxLength={160} className={input} />
            <label className="text-sm font-medium" htmlFor="notes">Notes (internal)</label>
            <textarea id="notes" name="notes" rows={3} defaultValue={org.notes ?? ''} maxLength={2000} className={input} />
            <SubmitButton pendingText="Saving…" className="w-fit">Save</SubmitButton>
          </ActionForm>
        </Card>
      </Section>

      <Section title="Leaderboards" subtitle="Each board has its own end date, or none. It can never run past the company's expiry.">
        <div className="flex flex-col gap-4">
          {org.leaderboards.map((b) => (
            <Card key={b.id} className="max-w-3xl">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h3 className="font-semibold">{b.name}</h3>
                <StatusBadge tone={BOARD_TONE[b.status]}>{b.status}</StatusBadge>
                <span className="text-sm text-gray-500">
                  {SCORING_LABEL[b.scoring]} · from {formatDateIST(b.startsAt)} · {boardEndLabel(b, formatDateIST)}
                </span>
                <Link className="ml-auto text-sm underline" href={`/organizations/${org.id}/leaderboards/${b.id}`}>View standings</Link>
              </div>
              {b.endsAt && b.configuredEndsAt !== b.endsAt && (
                <p className="mb-2 text-xs text-amber-600">Ends with the company profile, earlier than the date set on this board.</p>
              )}
              <ActionForm action={updateBoardAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={org.id} />
                <input type="hidden" name="boardId" value={b.id} />
                <label className="flex flex-col gap-1 text-sm">Name
                  <input name="name" defaultValue={b.name} required className={input} />
                </label>
                <label className="flex flex-col gap-1 text-sm">Description
                  <input name="description" defaultValue={b.description ?? ''} maxLength={500} className={input} />
                </label>
                <div className="flex flex-col gap-1 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" name="noEnd" defaultChecked={b.configuredEndsAt == null} /> No end date (unlimited)</label>
                  <label className="flex flex-col gap-1">Ends at the end of (IST)
                    <input name="endsAt" type="date" defaultValue={isoToIstDate(b.configuredEndsAt)} className={input} />
                  </label>
                </div>
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" name="showTeams" defaultChecked={b.showTeams} /> Show team standings</label>
                  <label className="flex flex-col gap-1">Visibility
                    <select name="status" defaultValue={b.archived ? 'archived' : 'active'} className={input}>
                      <option value="active">Active</option>
                      <option value="archived">Archived (hide from members)</option>
                    </select>
                  </label>
                </div>
                <SubmitButton pendingText="Saving…" className="w-fit">Save board</SubmitButton>
              </ActionForm>
            </Card>
          ))}
          {org.leaderboards.length === 0 && <p className="text-sm text-gray-500">No leaderboards yet.</p>}
        </div>

        <Card className="max-w-xl">
          <h3 className="mb-2 font-semibold">New leaderboard</h3>
          <ActionForm action={createBoardAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={org.id} />
            <label className="text-sm font-medium" htmlFor="b-name">Name</label>
            <input id="b-name" name="name" required minLength={2} maxLength={80} className={input} />
            <label className="text-sm font-medium" htmlFor="b-desc">Description (optional)</label>
            <input id="b-desc" name="description" maxLength={500} className={input} />
            <label className="text-sm font-medium" htmlFor="b-scoring">Ranks people by</label>
            <select id="b-scoring" name="scoring" defaultValue="active_days" className={input}>
              {Object.entries(SCORING_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <p className="text-xs text-gray-500">Everything works from a phone alone. No watch is needed.</p>
            <label className="text-sm font-medium" htmlFor="b-start">Starts on (IST, optional, defaults to today)</label>
            <input id="b-start" name="startsAt" type="date" className={input} />
            <fieldset className="flex flex-col gap-2 rounded border p-3">
              <legend className="px-1 text-sm font-medium">Expiry</legend>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="noEnd" defaultChecked /> No end date (unlimited)</label>
              <label className="text-sm" htmlFor="b-end">Or ends at the end of (IST)</label>
              <input id="b-end" name="endsAt" type="date" className={input} />
            </fieldset>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="showTeams" defaultChecked /> Show team standings</label>
            <SubmitButton pendingText="Creating…" className="w-fit">Create leaderboard</SubmitButton>
          </ActionForm>
        </Card>
      </Section>

      <Section title="Teams" subtitle="Team score is the average of its members, so a bigger team does not win just by size.">
        <div className="flex flex-wrap gap-3">
          {org.teams.map((t) => (
            <Card key={t.id} className="flex items-center gap-3">
              <span className="text-sm font-medium">{t.name}</span>
              <span className="text-xs text-gray-500">{t.members} people</span>
              <ActionForm action={deleteTeamAction} confirmMessage={`Delete team ${t.name}? Its members will have no team.`}>
                <input type="hidden" name="id" value={org.id} />
                <input type="hidden" name="teamId" value={t.id} />
                <SubmitButton variant="danger" pendingText="Deleting…">Delete</SubmitButton>
              </ActionForm>
            </Card>
          ))}
          {org.teams.length === 0 && <p className="text-sm text-gray-500">No teams. Leave this empty for an individual-only leaderboard.</p>}
        </div>
        <Card className="max-w-md">
          <ActionForm action={createTeamAction} className="flex items-end gap-3">
            <input type="hidden" name="id" value={org.id} />
            <label className="flex flex-1 flex-col gap-1 text-sm">New team name
              <input name="name" required minLength={2} maxLength={80} className={input} />
            </label>
            <SubmitButton pendingText="Adding…">Add team</SubmitButton>
          </ActionForm>
        </Card>
      </Section>

      <Section
        title="People"
        subtitle="Only people listed here can see this company in the app. Invited = no account yet; they are linked the first time they sign in with that number."
      >
        <Table>
          <Thead>
            <Th>Phone</Th>
            <Th>Name</Th>
            <Th>Status</Th>
            <Th>Team</Th>
            <Th>Added</Th>
            <Th>Action</Th>
          </Thead>
          <tbody>
            {org.members.map((m) => (
              <Tr key={m.id}>
                <Td>{m.phone}</Td>
                <Td>{m.name ?? '-'}</Td>
                <Td><StatusBadge tone={m.status === 'active' ? 'active' : 'pending'}>{m.status}</StatusBadge></Td>
                <Td>
                  <ActionForm action={setMemberTeamAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={org.id} />
                    <input type="hidden" name="memberId" value={m.id} />
                    <select name="teamId" defaultValue={m.teamId ?? ''} className="rounded border px-2 py-1 text-sm">
                      <option value="">No team</option>
                      {org.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <SubmitButton variant="secondary" pendingText="…">Set</SubmitButton>
                  </ActionForm>
                </Td>
                <Td>{formatDateIST(m.addedAt)}</Td>
                <Td>
                  <ActionForm action={removeMemberAction} confirmMessage={`Remove ${m.name ?? m.phone} from ${org.name}? They keep their account.`}>
                    <input type="hidden" name="id" value={org.id} />
                    <input type="hidden" name="memberId" value={m.id} />
                    <SubmitButton variant="danger" pendingText="Removing…">Remove</SubmitButton>
                  </ActionForm>
                </Td>
              </Tr>
            ))}
            {org.members.length === 0 && <EmptyRow colSpan={6}>No one yet. Add people below.</EmptyRow>}
          </tbody>
        </Table>

        <Card className="max-w-2xl">
          <h3 className="mb-2 font-semibold">Add people</h3>
          <ActionForm action={addMembersAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={org.id} />
            <label className="text-sm font-medium" htmlFor="members">One person per line: phone, name (optional), team (optional)</label>
            <textarea
              id="members" name="members" rows={8} required className={`${input} font-mono`}
              placeholder={'9876543210, Asha Rao, Sales\n9876543211, Bala Kumar, Ops\n9876543212'}
            />
            <p className="text-xs text-gray-500">
              Paste straight from a spreadsheet. Up to 500 at a time. Teams that do not exist yet are created. Adding a
              number that is already a member is harmless.
            </p>
            <SubmitButton pendingText="Adding…" className="w-fit">Add people</SubmitButton>
          </ActionForm>
        </Card>
      </Section>
    </div>
  );
}
