import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { recordPayoutAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatDateTimeIST } from '@/lib/dateFormat';

interface PartnerBalance {
  userId: number;
  balance: number;
  currency: string;
  name: string | null;
  phone: string | null;
}

interface PayoutRecord {
  id: number;
  userId: number;
  amount: number;
  description: string | null;
  createdAt: string;
  name: string | null;
  phone: string | null;
}

function partnerLabel(p: { userId: number; name: string | null; phone: string | null }) {
  if (p.name) return p.phone ? `${p.name} (${p.phone})` : p.name;
  return `User #${p.userId}`;
}

export default async function PayoutsPage() {
  await requireSession();

  const [{ data: balances }, { data: history }] = await Promise.all([
    gatewayJson<{ data: PartnerBalance[] }>('/api/wallet/partners/summary'),
    gatewayJson<{ data: PayoutRecord[] }>('/api/wallet/payouts'),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <PageHeader title="Partner balances owed" />
        <Table>
          <Thead>
            <Th>Partner</Th>
            <Th>Balance</Th>
            <Th>Record payout</Th>
          </Thead>
          <tbody>
            {balances.map((b) => (
              <Tr key={b.userId}>
                <Td>{partnerLabel(b)}</Td>
                <Td>₹{b.balance.toFixed(2)}</Td>
                <Td>
                  <ActionForm
                    action={recordPayoutAction}
                    confirmMessage={`Record a payout to ${partnerLabel(b)}?`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="userId" value={b.userId} />
                    <input
                      type="number"
                      name="amount"
                      step="0.01"
                      min="0"
                      max={b.balance}
                      placeholder={`up to ${b.balance.toFixed(2)}`}
                      className="w-32 rounded border px-2 py-1"
                    />
                    <input
                      type="text"
                      name="description"
                      placeholder="Note (optional)"
                      className="w-40 rounded border px-2 py-1"
                    />
                    <SubmitButton pendingText="Paying out…">Pay out</SubmitButton>
                  </ActionForm>
                </Td>
              </Tr>
            ))}
            {balances.length === 0 && <EmptyRow colSpan={3}>No partner balances owed right now.</EmptyRow>}
          </tbody>
        </Table>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader title="Payout history" />
        <Table>
          <Thead>
            <Th>Partner</Th>
            <Th>Amount</Th>
            <Th>Note</Th>
            <Th>Date</Th>
          </Thead>
          <tbody>
            {history.map((h) => (
              <Tr key={h.id}>
                <Td>{partnerLabel(h)}</Td>
                <Td>₹{h.amount.toFixed(2)}</Td>
                <Td>{h.description || '—'}</Td>
                <Td>{formatDateTimeIST(h.createdAt)}</Td>
              </Tr>
            ))}
            {history.length === 0 && <EmptyRow colSpan={4}>No payouts recorded yet.</EmptyRow>}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
