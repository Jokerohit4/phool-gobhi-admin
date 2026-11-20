import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { inviteStaffAction, setStaffStatusAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatDateIST } from '@/lib/dateFormat';
import { InlineError } from '@/components/ui/InlineError';
import { Section } from '@/components/ui/Section';

interface StaffMember {
  id: number;
  name: string;
  email: string;
  gobhiType: string;
  isActive: boolean;
  createdAt: string;
}

const GOBHI_TYPES = ['trainer', 'cleaner', 'manager'] as const;

export default async function StaffPage() {
  const session = await requireSession();
  let staff: StaffMember[] = [];
  let error = '';
  try {
    ({ data: staff } = await gatewayJson<{ data: StaffMember[] }>('/api/auth/admin/staff'));
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load staff';
  }

  return (
    <div className="flex flex-col gap-8">
      <Section>
        <Breadcrumbs items={[{ label: 'Staff' }]} />
        <PageHeader title="Staff" subtitle="Accounts with access to this admin portal." />
        {error && <InlineError title="Could not load staff" message={error} retryHref="/staff" />}
        <Table>
          <Thead>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Role type</Th>
            <Th>Status</Th>
            <Th>Joined</Th>
            <Th>Action</Th>
          </Thead>
          <tbody>
            {staff.map((s) => {
              const isSelf = s.id === session.id;
              return (
                <Tr key={s.id}>
                  <Td>{s.name}</Td>
                  <Td>{s.email}</Td>
                  <Td className="capitalize">{s.gobhiType}</Td>
                  <Td>
                    <StatusBadge tone={s.isActive ? 'active' : 'revoked'}>
                      {s.isActive ? 'Active' : 'Revoked'}
                    </StatusBadge>
                  </Td>
                  <Td>{formatDateIST(s.createdAt)}</Td>
                  <Td>
                    {isSelf ? (
                      <span className="text-gray-400">(you)</span>
                    ) : (
                      <ActionForm
                        action={setStaffStatusAction}
                        confirmMessage={
                          s.isActive
                            ? `Revoke admin access for ${s.name}?`
                            : `Restore admin access for ${s.name}?`
                        }
                      >
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="isActive" value={(!s.isActive).toString()} />
                        <SubmitButton variant={s.isActive ? 'danger' : 'secondary'} pendingText="Updating…">
                          {s.isActive ? 'Revoke' : 'Reactivate'}
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </Td>
                </Tr>
              );
            })}
            {!error && staff.length === 0 && <EmptyRow colSpan={6}>No staff accounts found.</EmptyRow>}
            {error && staff.length === 0 && <EmptyRow colSpan={6}>Could not load staff.</EmptyRow>}
          </tbody>
        </Table>
      </Section>

      <Section title="Invite staff">
        <Card className="max-w-md">
          <ActionForm
            action={inviteStaffAction}
            confirmMessage="Grant this person admin-portal access?"
            className="flex flex-col gap-3"
          >
            <label className="text-sm font-medium" htmlFor="name">Name</label>
            <input id="name" name="name" required className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={8} className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="gobhiType">Role type</label>
            <select id="gobhiType" name="gobhiType" required className="rounded border px-3 py-2 text-sm">
              <option value="">Select…</option>
              {GOBHI_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>

            <SubmitButton pendingText="Inviting…" className="w-fit">Invite</SubmitButton>
          </ActionForm>
        </Card>
      </Section>
    </div>
  );
}
