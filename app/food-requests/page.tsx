import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { createFoodItemAction, setFoodRequestStatusAction } from './actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatDateIST } from '@/lib/dateFormat';

interface FoodRequest {
  id: number;
  name: string;
  query: string;
  detail: string;
  status: 'pending' | 'resolved' | 'declined';
  requestCount: number;
  reviewNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

const FOOD_SOURCES = ['estimate', 'ifct2017', 'usda', 'label-scan', 'user-entered'];
const FOOD_BASES = ['raw', 'cooked', 'as_served'];

export default async function FoodRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireSession();
  const { status } = await searchParams;
  const tab = status === 'all' ? 'all' : 'pending';
  // The queue endpoint is demand-ordered for pending (count first, then
  // oldest) — that is its purpose, so the table reads the review order as-is.
  const queue = await gatewayJson<FoodRequest[]>(
    `/api/health/admin/food-requests?status=${tab}`,
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Food requests"
          subtitle="Dishes customers said the catalogue is missing — most asked first. Resolve or decline a request, or promote the dish straight into the catalogue below."
        />
        <div className="flex gap-2">
          <a
            href="/food-requests"
            className={`rounded px-3 py-1 text-sm font-medium ${
              tab === 'pending'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            Pending
          </a>
          <a
            href="/food-requests?status=all"
            className={`rounded px-3 py-1 text-sm font-medium ${
              tab === 'all'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            All
          </a>
        </div>
        <Table>
          <Thead>
            <Th>Name</Th>
            <Th>Asked for</Th>
            <Th>Detail</Th>
            <Th>Demand</Th>
            <Th>Status</Th>
            <Th>Opened</Th>
            <Th>Review</Th>
          </Thead>
          <tbody>
            {queue.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium">{r.name}</Td>
                <Td>{r.query}</Td>
                <Td>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {r.detail || '—'}
                  </span>
                </Td>
                <Td>{r.requestCount}</Td>
                <Td>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      r.status === 'pending'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        : r.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {r.status}
                  </span>
                </Td>
                <Td>{formatDateIST(r.createdAt)}</Td>
                <Td className="flex flex-wrap gap-2">
                  {r.status === 'pending' ? (
                    <>
                      <ActionForm action={setFoodRequestStatusAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="resolved" />
                        <SubmitButton variant="secondary" pendingText="…">
                          Resolve
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm action={setFoodRequestStatusAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="declined" />
                        <SubmitButton variant="danger" pendingText="…">
                          Decline
                        </SubmitButton>
                      </ActionForm>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {r.reviewNote || r.status}
                    </span>
                  )}
                </Td>
              </Tr>
            ))}
            {queue.length === 0 && (
              <EmptyRow colSpan={7}>
                {tab === 'pending'
                  ? 'No pending requests — the queue is clear.'
                  : 'No requests yet.'}
              </EmptyRow>
            )}
          </tbody>
        </Table>
      </section>

      <section className="flex flex-col gap-4">
        <PageHeader
          title="Add a food"
          subtitle="Sourced numbers only — per 100 g. Claiming a source you do not have in hand (IFCT 2017, USDA) without the value is a provenance lie; 'estimate' is honest until then. Adding a food closes the pending requests for its name."
        />
        <Card className="max-w-2xl">
          <ActionForm action={createFoodItemAction} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  placeholder="e.g. Sambar"
                  className="rounded border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="aliases">
                  Aliases
                </label>
                <input
                  id="aliases"
                  name="aliases"
                  placeholder="comma separated, e.g. sambar, kulambu"
                  className="rounded border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  ['kcal', 'kcal'],
                  ['proteinG', 'Protein (g)'],
                  ['carbsG', 'Carbs (g)'],
                  ['fatG', 'Fat (g)'],
                  ['fibreG', 'Fibre (g)'],
                ] as const
              ).map(([key, label]) => (
                <div className="flex flex-col gap-1" key={key}>
                  <label className="text-sm font-medium" htmlFor={key}>
                    {label}
                  </label>
                  <input
                    id={key}
                    name={key}
                    required
                    type="number"
                    min="0"
                    step="any"
                    className="rounded border px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['ironMg', 'Iron (mg)'],
                  ['magnesiumMg', 'Magnesium (mg)'],
                  ['calciumMg', 'Calcium (mg)'],
                  ['zincMg', 'Zinc (mg)'],
                ] as const
              ).map(([key, label]) => (
                <div className="flex flex-col gap-1" key={key}>
                  <label className="text-sm font-medium" htmlFor={key}>
                    {label}
                  </label>
                  <input
                    id={key}
                    name={key}
                    type="number"
                    min="0"
                    step="any"
                    className="rounded border px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="basis">
                  Basis
                </label>
                <select id="basis" name="basis" className="rounded border px-3 py-2 text-sm">
                  {FOOD_BASES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="source">
                  Source
                </label>
                <select id="source" name="source" className="rounded border px-3 py-2 text-sm">
                  {FOOD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="verifiedBy">
                  Verified by
                </label>
                <input
                  id="verifiedBy"
                  name="verifiedBy"
                  placeholder="e.g. IFCT 2017, entry 1201"
                  className="rounded border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="nonVeg" className="rounded" />
              Non-vegetarian
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="verified" className="rounded" />
              Verified (I have the source in front of me)
            </label>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="reviewNote">
                Review note
              </label>
              <textarea
                id="reviewNote"
                name="reviewNote"
                rows={2}
                placeholder="e.g. IFCT 2017 entry — 100g cooked sambar, mixed veg"
                className="rounded border px-3 py-2 text-sm"
              />
            </div>

            <SubmitButton pendingText="Adding…" className="w-fit">
              Add to catalogue
            </SubmitButton>
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}