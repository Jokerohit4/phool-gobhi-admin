import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import { toISTFormDate } from '@/lib/istFormDate';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { ActionForm } from '@/components/ui/ActionForm';
import { Card } from '@/components/ui/Card';
import { ExpectedUpdatedAt } from '@/components/ui/ExpectedUpdatedAt';
import { InlineError } from '@/components/ui/InlineError';
import { PageHeader } from '@/components/ui/PageHeader';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { CATALOG_PATH, type ConfigResponse } from '../coaching-plans/config';
import { createCouponAction, updateCouponAction } from './actions';
import { COUPONS_PATH, type Coupon } from './config';

const input = 'w-full rounded border p-2 text-sm dark:bg-gray-900';
const field = 'grid gap-1 text-sm';

function CouponFields({ coupon }: { coupon?: Coupon }) {
  const value = coupon && (coupon.kind === 'fixed' ? (coupon.value / 100).toFixed(2) : coupon.value);
  return <div className="grid gap-4 sm:grid-cols-2">
    <label className={field}>Discount type
      <select className={input} name="kind" defaultValue={coupon?.kind ?? 'fixed'}>
        <option value="fixed">Fixed amount</option>
        <option value="percent">Percentage</option>
      </select>
    </label>
    <label className={field}>Value (₹ for fixed, whole percent for percentage)
      <input className={input} name="value" type="number" min="0.01" step="0.01" defaultValue={value} required />
    </label>
    <label className={field}>Eligible offers
      <select className={input} name="eligibility" defaultValue={coupon?.offerKeys ? 'selected' : 'all'}>
        <option value="all">All offers</option>
        <option value="selected">Only the listed offer keys</option>
      </select>
    </label>
    <label className={field}>Offer keys (separated by spaces or commas)
      <input className={input} name="offerKeys" defaultValue={coupon?.offerKeys?.join(', ')} />
      <span className="text-gray-500">An empty list with restricted eligibility makes the coupon unavailable.</span>
    </label>
    <label className={field}>Starts at (IST, optional)
      <input className={input} name="activeFrom" type="datetime-local" step="0.001" defaultValue={toISTFormDate(coupon?.activeFrom ?? null)} />
    </label>
    <label className={field}>Ends at (IST, optional)
      <input className={input} name="activeTo" type="datetime-local" step="0.001" defaultValue={toISTFormDate(coupon?.activeTo ?? null)} />
    </label>
    <label className={field}>Total limit (blank for unlimited)
      <input className={input} name="maxRedemptions" type="number" min="1" max="2147483647" defaultValue={coupon?.maxRedemptions ?? ''} />
    </label>
    <label className={field}>Per-customer limit (blank for unlimited)
      <input className={input} name="perCustomerLimit" type="number" min="1" max="2147483647" defaultValue={coupon?.perCustomerLimit ?? ''} />
    </label>
  </div>;
}

function CouponRow({ coupon }: { coupon: Coupon }) {
  const { code, enabled, redemptionCounts } = coupon;
  return <Card className="space-y-3">
    <h3 className="font-semibold">{code} · {enabled ? 'Enabled' : 'Disabled'}</h3>
    <p className="text-sm">Reserved {redemptionCounts.reserved} · Redeemed {redemptionCounts.redeemed} · Released {redemptionCounts.released}</p>
    <details>
      <summary className="cursor-pointer text-sm font-medium">Edit {code}</summary>
      <ActionForm action={updateCouponAction} preserveOnError className="mt-3 space-y-3">
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="operation" value="edit" />
        <ExpectedUpdatedAt value={coupon.updatedAt} />
        <CouponFields coupon={coupon} />
        <SubmitButton pendingText="Saving…">Save coupon</SubmitButton>
      </ActionForm>
    </details>
    <ActionForm action={updateCouponAction} confirmMessage={enabled
      ? `Disable coupon ${code} for future purchases?`
      : `Enable coupon ${code} for eligible purchases?`}>
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="operation" value={enabled ? 'disable' : 'enable'} />
      <ExpectedUpdatedAt value={coupon.updatedAt} />
      <SubmitButton variant={enabled ? 'danger' : 'secondary'} pendingText="Updating…">{enabled ? 'Disable' : 'Enable'} coupon</SubmitButton>
    </ActionForm>
  </Card>;
}

export default async function CouponsPage() {
  await requireSession();
  const [coupons, catalog] = await Promise.allSettled([
    gatewayJson<{ data: Coupon[] }>(COUPONS_PATH),
    gatewayJson<{ data: ConfigResponse }>(CATALOG_PATH),
  ]);
  const config = catalog.status === 'fulfilled' ? catalog.value.data.config : null;
  const keys = config?.schemaVersion === 2 ? config.offers.map(offer => offer.key)
    : [...new Set(Object.values(config?.regions ?? {}).flatMap(region => region.plans.map(plan => plan.product)))];

  return <div className="space-y-5">
    <Breadcrumbs items={[{ label: 'Coupons' }]} />
    <PageHeader title="Coaching coupons" />
    {catalog.status === 'rejected' && <InlineError title="Could not load catalog offer keys" message="You can still enter offer keys manually." retryHref="/coupons" />}
    {keys.length > 0 && <details className="rounded border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Catalog offer keys</summary>
      <p className="mt-2 break-words">{keys.join(', ')}</p>
    </details>}
    <Card className="space-y-3">
      <h2 className="font-semibold">Create coupon</h2>
      <ActionForm action={createCouponAction} preserveOnError className="space-y-4">
        <label className={field}>Coupon code
          <input className={input} name="code" required maxLength={32} pattern="[A-Za-z0-9_\x2d]+" />
        </label>
        <CouponFields />
        <SubmitButton pendingText="Creating…">Create coupon</SubmitButton>
      </ActionForm>
    </Card>
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Coupons</h2>
      {coupons.status === 'rejected'
        ? <InlineError title="Could not load coupons" message={coupons.reason instanceof Error ? coupons.reason.message : 'Could not load coupons'} retryHref="/coupons" />
        : coupons.value.data.length
          ? coupons.value.data.map(coupon => <CouponRow key={coupon.code} coupon={coupon} />)
          : <p className="text-sm text-gray-500">No coupons yet.</p>}
    </section>
  </div>;
}
