import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { Section } from '@/components/ui/Section';
import { InlineError } from '@/components/ui/InlineError';
import { settleBankSettlementsAction } from './actions';

interface PendingSettlement {
  partnerId: number;
  amount: number;
  count: number;
  name: string | null;
  phone: string | null;
}

interface BankAccount {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string | null;
}

export default async function BankSettlementsPage() {
  await requireSession();

  let pending: PendingSettlement[] = [];
  let loadError: string | null = null;
  try {
    ({ data: pending } = await gatewayJson<{ data: PendingSettlement[] }>('/api/wallet/bank-settlements/admin/pending'));
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Could not load pending settlements';
  }

  // N+1 by design, matching this app's existing simplicity convention
  // elsewhere (e.g. the attendance page's by-gym join) — the partner count
  // here is small enough that a batch endpoint isn't worth the extra
  // plumbing yet.
  const bankAccounts = await Promise.all(
    pending.map((p) =>
      gatewayJson<{ data: BankAccount | null }>(`/api/auth/admin/bank-account/${p.partnerId}`).catch(() => ({ data: null }))
    )
  );

  const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: 'Attendance SaaS', href: '/attendance-saas' }, { label: 'Bank settlements' }]} />
      <Section>
        <PageHeader
          title="Attendance-SaaS bank settlements"
          subtitle="Registration revenue owed directly to partners' bank accounts — never credited to their in-app wallet. No automated transfer: mark settled only after you've actually made the payment."
        />
        <p className="text-sm text-gray-500"><Link href="/fulfillment" className="underline">Coaching fulfillment</Link> is separate from Attendance SaaS subscription revenue.</p>
      </Section>

      {loadError && (
        <InlineError title="Could not load bank settlements" message={loadError} retryHref="/attendance-saas/settlements" />
      )}

      <Card>
        <div className="text-sm text-gray-500">Total pending across all partners</div>
        <div className="text-2xl font-semibold">₹{totalPending.toFixed(2)}</div>
      </Card>

      <Table>
        <Thead>
          <Th>Partner</Th>
          <Th>Bank details</Th>
          <Th>Pending amount</Th>
          <Th>Visits</Th>
          <Th>Action</Th>
        </Thead>
        <tbody>
          {pending.map((p, i) => {
            const account = bankAccounts[i].data;
            return (
              <Tr key={p.partnerId}>
                <Td>
                  {p.name ?? `Partner #${p.partnerId}`}
                  <div className="text-xs text-gray-500">{p.phone}</div>
                </Td>
                <Td>
                  {account ? (
                    <>
                      {account.accountHolderName}
                      <div className="text-xs text-gray-500">
                        {account.accountNumber} · {account.ifscCode}
                        {account.upiId ? ` · ${account.upiId}` : ''}
                      </div>
                    </>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">No bank details on file</span>
                  )}
                </Td>
                <Td>₹{p.amount.toFixed(2)}</Td>
                <Td>{p.count}</Td>
                <Td>
                  <ActionForm
                    action={settleBankSettlementsAction}
                    confirmMessage={`Confirm you've already made a manual bank transfer of ₹${p.amount.toFixed(2)} to ${p.name ?? `partner #${p.partnerId}`}? This only records it — it does not send money.`}
                  >
                    <input type="hidden" name="partnerId" value={p.partnerId} />
                    <SubmitButton pendingText="Saving…" className="w-fit text-sm">
                      Mark settled
                    </SubmitButton>
                  </ActionForm>
                </Td>
              </Tr>
            );
          })}
          {pending.length === 0 && <EmptyRow colSpan={5}>{loadError ? 'No settlement data available.' : 'No pending settlements.'}</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
