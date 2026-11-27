import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { savePlansAction } from './actions';
import { REGIONS, type Components, type Offer, type V2Catalog } from './v2Config';

const input = 'w-full rounded border p-2 text-sm dark:bg-gray-900';
const panel = 'space-y-4 rounded border p-4';
const grid = 'grid gap-4 sm:grid-cols-2';

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={checked} />{label}</label>;
}

function ComponentFields({ prefix, value, remote = false }: { prefix: string; value: Components; remote?: boolean }) {
  return <div className={grid}>
    {!remote && <Check name={prefix + '.gym'} label="Unlimited gym access" checked={value.gym === 'unlimited'} />}
    <Check name={prefix + '.nutritionGuidance'} label="Nutrition guidance" checked={value.nutritionGuidance} />
    <label className="grid gap-1 text-sm">Trainer sessions (0 for none)
      <input className={input} name={prefix + '.trainer'} type="number" min="0" max="1000" required defaultValue={value.trainer?.sessions ?? 0} />
    </label>
    <label className="grid gap-1 text-sm">Trainer mode
      <select className={input} name={prefix + '.mode'} defaultValue={remote ? 'online' : value.trainer?.mode ?? 'online'}>
        <option value="online">Online</option>
        {!remote && <option value="in_person">In person</option>}
      </select>
    </label>
    <label className="grid gap-1 text-sm">Nutritionist sessions (0 for none)
      <input className={input} name={prefix + '.nutritionist'} type="number" min="0" max="1000" required defaultValue={value.nutritionist?.sessions ?? 0} />
    </label>
  </div>;
}

function OfferFields({ offer }: { offer: Offer }) {
  const key = offer.key;
  const override = offer.regionOverrides?.REST_INDIA.components;
  return <fieldset className={panel}>
    <legend className="px-2 font-semibold">{key} · {offer.family}</legend>
    <Check name={key + '.enabled'} label="Available for purchase" checked={offer.enabled} />
    <div className={grid}>
      <label className="grid gap-1 text-sm">Title
        <input className={input} name={key + '.title'} required maxLength={120} defaultValue={offer.title} />
      </label>
      <label className="grid gap-1 text-sm">Price in ₹
        <input className={input} name={key + '.price'} type="number" min="1" max="1000000" step="0.01" required defaultValue={(offer.amountPaise / 100).toFixed(2)} />
      </label>
      <label className="grid gap-1 text-sm">Duration in days
        <input className={input} name={key + '.durationDays'} type="number" min="1" max="365" required defaultValue={offer.durationDays} />
      </label>
      <label className="grid gap-1 text-sm">Refund policy
        <select className={input} name={key + '.refundPolicy'} defaultValue={offer.refundPolicy}>
          <option value="self_serve_72h">Self-serve within 72 hours</option>
          <option value="support">Contact support</option>
        </select>
      </label>
    </div>
    <label className="grid gap-1 text-sm">Description
      <textarea className={input} name={key + '.description'} required rows={3} maxLength={500} defaultValue={offer.description} />
    </label>
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">Purchase regions</legend>
      {Object.entries(REGIONS).map(([region, label]) => (
        <Check key={region} name={key + '.' + region} label={label} checked={offer.regions.some(value => value === region)} />
      ))}
    </fieldset>
    <fieldset className={panel}>
      <legend className="px-2 text-sm font-medium">Included components</legend>
      <ComponentFields prefix={key + '.base'} value={offer.components} />
    </fieldset>
    <details className={panel} open={Boolean(override)}>
      <summary className="cursor-pointer text-sm font-medium">Components outside Gurugram</summary>
      <Check name={key + '.override'} label="Use separate components outside Gurugram when available there" checked={Boolean(override)} />
      <ComponentFields prefix={key + '.remote'} value={{ ...offer.components, ...override }} remote />
    </details>
  </fieldset>;
}

export function CatalogEditor({ catalog, version }: { catalog: V2Catalog; version: number }) {
  return <ActionForm action={savePlansAction} preserveOnError confirmMessage="Publish these catalog terms for future purchases?" className="space-y-6">
    <input type="hidden" name="version" value={version} />
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Offers</h2>
      {catalog.offers.map(offer => <OfferFields key={offer.key} offer={offer} />)}
    </section>
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Add-ons</h2>
      {catalog.addons.map(addon => <fieldset className={panel} key={addon.key}>
        <legend className="px-2 font-semibold">{addon.key}</legend>
        <Check name={addon.key + '.enabled'} label="Available for purchase" checked={addon.enabled ?? true} />
        <label className="grid gap-1 text-sm">Unit price in ₹
          <input className={input} name={addon.key + '.price'} type="number" min="1" max="1000000" step="0.01" required defaultValue={(addon.unitPaise / 100).toFixed(2)} />
        </label>
        <label className="grid gap-1 text-sm">Volume tiers (minimum quantity, discount percent, one per line)
          <textarea className={input} name={addon.key + '.tiers'} rows={3} placeholder="4, 10" defaultValue={addon.volumeTiers?.map(tier => tier.minQty + ', ' + tier.discountPct).join('\n') ?? ''} />
        </label>
        {addon.volumeTierFamilies && <p className="text-sm">Volume tier eligibility · {addon.volumeTierFamilies.join(', ')}</p>}
      </fieldset>)}
    </section>
    <SubmitButton className="rounded bg-emerald-700 px-5 py-3 text-white" pendingText="Publishing…">Publish catalog</SubmitButton>
  </ActionForm>;
}
