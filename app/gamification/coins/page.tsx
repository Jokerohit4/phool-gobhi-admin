import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { updateEconomyConfigAction, createCatalogItemAction, setCatalogItemActiveAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatDateTimeIST } from '@/lib/dateFormat';

interface EconomyConfig {
  coinsPerCheckin: number;
  weeklyTargetBonus: number;
  milestones: Record<string, number>;
  pairedStreakWeeklyBonus: number;
  updatedAt: string | null;
}

const CATALOG_CATEGORIES = ['subscription_discount', 'priority_booking', 'buddy_unlock', 'brand_product'] as const;

interface CatalogItem {
  id: number;
  key: string;
  category: string;
  title: string;
  description: string | null;
  coinCost: number;
  discountAmount: number | null;
  isActive: boolean;
  createdAt: string;
}

const MILESTONE_ROW_COUNT = 4;

export default async function CoinsPage() {
  await requireSession();

  const { data: economy } = await gatewayJson<{ data: EconomyConfig }>('/api/challenges/admin/coins/economy-config');
  const { data: catalog } = await gatewayJson<{ data: CatalogItem[] }>('/api/challenges/admin/coins/catalog');

  const milestoneEntries = Object.entries(economy.milestones || {})
    .map(([week, amount]) => ({ week: Number(week), amount }))
    .sort((a, b) => a.week - b.week);
  const milestoneRows = Array.from({ length: MILESTONE_ROW_COUNT }, (_, i) => milestoneEntries[i] || { week: '', amount: '' });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Coin economy"
          subtitle={
            economy.updatedAt
              ? `How many coins each check-in/streak milestone pays out — last updated ${formatDateTimeIST(economy.updatedAt)} IST.`
              : 'How many coins each check-in/streak milestone pays out — not customized yet, showing the planning docs’ placeholder numbers.'
          }
        />
        <Card className="max-w-2xl">
          <ActionForm
            action={updateEconomyConfigAction}
            className="flex flex-col gap-4"
            confirmMessage="This changes coin payouts for every customer check-in and streak week going forward. Continue?"
          >
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                Coins per check-in
                <input
                  type="number"
                  name="coinsPerCheckin"
                  min={0}
                  defaultValue={economy.coinsPerCheckin}
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Weekly-target bonus
                <input
                  type="number"
                  name="weeklyTargetBonus"
                  min={0}
                  defaultValue={economy.weeklyTargetBonus}
                  className="rounded border px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Streak milestones (consecutive qualified weeks → bonus coins)</span>
              {milestoneRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    name={`milestoneWeek_${i}`}
                    min={1}
                    placeholder="Week #"
                    defaultValue={row.week}
                    className="w-28 rounded border px-3 py-2 text-sm"
                  />
                  <span className="text-sm text-gray-500">weeks →</span>
                  <input
                    type="number"
                    name={`milestoneAmount_${i}`}
                    min={0}
                    placeholder="Coins"
                    defaultValue={row.amount}
                    className="w-28 rounded border px-3 py-2 text-sm"
                  />
                  <span className="text-sm text-gray-500">coins</span>
                </div>
              ))}
              <p className="text-sm text-gray-500">Leave a row&rsquo;s week blank to remove that milestone.</p>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              Paired streak weekly bonus (paid to BOTH members when their shared streak survives a week)
              <input
                type="number"
                name="pairedStreakWeeklyBonus"
                min={0}
                defaultValue={economy.pairedStreakWeeklyBonus}
                className="w-40 rounded border px-3 py-2 text-sm"
              />
            </label>

            <SubmitButton pendingText="Saving…" className="w-fit">
              Save coin economy
            </SubmitButton>
          </ActionForm>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader
          title="Coin catalog"
          subtitle="What coins can be redeemed for. Only subscription_discount has real fulfillment wired up today — priority_booking/buddy_unlock are reserved categories with no product spec yet, and brand_product is reserved until a brand deal is signed."
        />
        <Table>
          <Thead>
            <Th>Key</Th>
            <Th>Category</Th>
            <Th>Title</Th>
            <Th>Coin cost</Th>
            <Th>Discount (₹)</Th>
            <Th>Status</Th>
            <Th>Action</Th>
          </Thead>
          <tbody>
            {catalog.map((item) => (
              <Tr key={item.id}>
                <Td className="font-mono text-xs">{item.key}</Td>
                <Td>{item.category}</Td>
                <Td>{item.title}</Td>
                <Td>{item.coinCost}</Td>
                <Td>{item.discountAmount ?? '—'}</Td>
                <Td>
                  <StatusBadge tone={item.isActive ? 'active' : 'revoked'}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </Td>
                <Td>
                  <ActionForm
                    action={setCatalogItemActiveAction}
                    confirmMessage={
                      item.isActive
                        ? `Deactivate "${item.title}"? Customers will no longer be able to redeem it.`
                        : `Re-activate "${item.title}"?`
                    }
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="isActive" value={(!item.isActive).toString()} />
                    <SubmitButton variant={item.isActive ? 'danger' : 'secondary'} pendingText="Updating…">
                      {item.isActive ? 'Deactivate' : 'Re-activate'}
                    </SubmitButton>
                  </ActionForm>
                </Td>
              </Tr>
            ))}
            {catalog.length === 0 && <EmptyRow colSpan={7}>No catalog items yet.</EmptyRow>}
          </tbody>
        </Table>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader title="Add catalog item" />
        <Card className="max-w-md">
          <ActionForm action={createCatalogItemAction} className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="key">Key (stable, machine-readable)</label>
            <input id="key" name="key" required placeholder="sub_discount_100" className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="category">Category</label>
            <select id="category" name="category" required defaultValue="subscription_discount" className="rounded border px-3 py-2 text-sm">
              {CATALOG_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <label className="text-sm font-medium" htmlFor="title">Title</label>
            <input id="title" name="title" required className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="description">Description</label>
            <input id="description" name="description" className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="coinCost">Coin cost</label>
            <input id="coinCost" name="coinCost" type="number" min={1} required className="rounded border px-3 py-2 text-sm" />

            <label className="text-sm font-medium" htmlFor="discountAmount">
              Discount amount (₹) — only used for subscription_discount
            </label>
            <input id="discountAmount" name="discountAmount" type="number" min={0} className="rounded border px-3 py-2 text-sm" />

            <SubmitButton pendingText="Creating…" className="w-fit">Add item</SubmitButton>
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}
