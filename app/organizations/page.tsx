import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { createOrgAction } from './actions';
import { expiryLabel, type OrgSummary } from '@/lib/orgApi';
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

const TONE = { active: 'active', expired: 'read', archived: 'revoked' } as const;

export default async function OrganizationsPage() {
  await requireSession();
  let orgs: OrgSummary[] = [];
  let error = '';
  try {
    ({ data: orgs } = await gatewayJson<{ data: OrgSummary[] }>('/api/challenges/admin/orgs'));
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load companies';
  }

  return (
    <div className="flex flex-col gap-8">
      <Section>
        <Breadcrumbs items={[{ label: 'Companies' }]} />
        <PageHeader
          title="Companies"
          subtitle="Private programmes for a company's employees: a member list only you control, teams, and leaderboards with an end date (or none)."
        />
        {error && <InlineError title="Could not load companies" message={error} retryHref="/organizations" />}
        <Table>
          <Thead>
            <Th>Company</Th>
            <Th>Status</Th>
            <Th>Members</Th>
            <Th>Invited</Th>
            <Th>Leaderboards</Th>
            <Th>Expiry</Th>
            <Th>Created</Th>
          </Thead>
          <tbody>
            {orgs.map((o) => (
              <Tr key={o.id}>
                <Td>
                  <Link className="font-medium underline" href={`/organizations/${o.id}`}>{o.name}</Link>
                  <Link className="ml-3 text-xs underline" href={`/organizations/${o.id}/dashboard`}>Dashboard</Link>
                </Td>
                <Td><StatusBadge tone={TONE[o.status]}>{o.status}</StatusBadge></Td>
                <Td>{o.activeMembers ?? 0}</Td>
                <Td>{o.invitedMembers ?? 0}</Td>
                <Td>{o.leaderboards ?? 0}</Td>
                <Td>{expiryLabel(o)}{o.expiresAt ? ` (${formatDateIST(o.expiresAt)})` : ''}</Td>
                <Td>{formatDateIST(o.createdAt ?? o.startsAt)}</Td>
              </Tr>
            ))}
            {!error && orgs.length === 0 && <EmptyRow colSpan={7}>No companies yet. Create the first one below.</EmptyRow>}
            {error && orgs.length === 0 && <EmptyRow colSpan={7}>Could not load companies.</EmptyRow>}
          </tbody>
        </Table>
      </Section>

      <Section
        title="New company"
        subtitle="Nobody can join on their own. After creating it you add people by phone number."
      >
        <Card className="max-w-xl">
          <ActionForm action={createOrgAction} className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="name">Company name</label>
            <input id="name" name="name" required minLength={2} maxLength={80} className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="startsAt">Starts on (IST, optional, defaults to today)</label>
            <input id="startsAt" name="startsAt" type="date" className="rounded border px-3 py-2 text-sm" />

            <fieldset className="flex flex-col gap-2 rounded border p-3">
              <legend className="px-1 text-sm font-medium">When does the company profile expire?</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="noExpiry" defaultChecked /> No expiry (stays until you archive it)
              </label>
              <label className="text-sm" htmlFor="expiresAt">Or expires at the end of (IST)</label>
              <input id="expiresAt" name="expiresAt" type="date" className="rounded border px-3 py-2 text-sm" />
              <p className="text-xs text-gray-500">
                Untick &quot;No expiry&quot; to use a date. When it expires the company stops showing in the app and
                everyone simply continues as a normal user. Nothing is deleted, and you can extend it later.
              </p>
            </fieldset>

            <label className="text-sm font-medium" htmlFor="contactName">Contact person (optional)</label>
            <input id="contactName" name="contactName" maxLength={120} className="rounded border px-3 py-2 text-sm" />
            <label className="text-sm font-medium" htmlFor="contactEmail">Contact email (optional)</label>
            <input id="contactEmail" name="contactEmail" type="email" maxLength={160} className="rounded border px-3 py-2 text-sm" />
            <label className="text-sm font-medium" htmlFor="notes">Notes (internal)</label>
            <textarea id="notes" name="notes" rows={3} maxLength={2000} className="rounded border px-3 py-2 text-sm" />

            <SubmitButton pendingText="Creating…" className="w-fit">Create company</SubmitButton>
          </ActionForm>
        </Card>
      </Section>
    </div>
  );
}
