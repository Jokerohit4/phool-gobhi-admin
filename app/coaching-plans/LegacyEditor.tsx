import Link from 'next/link';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { savePlansAction } from './actions';
import type { CatalogConfig, PlanConfig } from './config';

const field = 'w-full rounded border p-2 text-sm dark:bg-gray-900';
function TextField({ name, label, value, multiline = false, max = 2000 }: { name: string; label: string; value: string; multiline?: boolean; max?: number }) {
  return <label className="grid gap-1 text-sm">{label}{multiline ? <textarea name={name} defaultValue={value} rows={3} maxLength={max} className={field} /> : <input name={name} defaultValue={value} maxLength={max} className={field} />}</label>;
}
function NumberField({ name, label, value, min = 0, max = 100 }: { name: string; label: string; value: number; min?: number; max?: number }) {
  return <label className="grid gap-1 text-sm">{label}<input name={name} type="number" required min={min} max={max} step="1" defaultValue={value} className={field} /></label>;
}
function Check({ name, label, value }: { name: string; label: string; value: boolean }) { return <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={value} />{label}</label>; }
function PlanEditor({ plan: p, local }: { plan: PlanConfig; local: boolean }) {
  const name = (key: string) => `${p.product}.${key}`;
  return <fieldset className="space-y-5 rounded border p-5"><legend className="px-2 font-semibold">{p.product === 'MONTHLY_4499' ? 'Plan 1' : 'Plan 2'} · {p.title}</legend>
    <div className="flex flex-wrap gap-6"><Check name={name('enabled')} label="Available for purchase" value={p.enabled} /><Check name={name('featured')} label="Highlight this plan" value={p.featured} /></div>
    <div className="grid gap-4 md:grid-cols-2"><TextField name={name('title')} label="Plan name" value={p.title} max={120} /><TextField name={name('ctaLabel')} label="Button label" value={p.ctaLabel} max={80} />
      <label className="grid gap-1 text-sm">Price in ₹ (blank = not announced)<input name={name('price')} type="number" min="0.01" max="1000000" step="0.01" defaultValue={p.amountPaise === null ? '' : (p.amountPaise / 100).toFixed(2)} className={field} /></label>
      <NumberField name={name('durationDays')} label="Validity in days" value={p.durationDays} min={7} max={365} />
      <TextField name={name('badge')} label="Badge text (optional)" value={p.badge} max={100} /><TextField name={name('description')} label="Short description" value={p.description} max={500} />
    </div>
    {local ? <div className="space-y-4 rounded bg-gray-50 p-4 dark:bg-gray-800"><h3 className="font-semibold">Gym and trainer offering</h3><p className="text-xs text-gray-500">Use a public area label such as Sector 45. Keep gym names, trainer identities and direct contacts private.</p>
      <div className="flex flex-wrap gap-6"><Check name={name('gymAccess')} label="Include partner gym access" value={p.gymAccess} /><Check name={name('trainerSupport')} label="Offer qualified trainer floor support" value={p.trainerSupport} /></div>
      <div className="grid gap-4 md:grid-cols-2"><TextField name={name('gymArea')} label="Public gym area" value={p.gymArea} max={150} /><NumberField name={name('gymVisitsPerMonth')} label="Gym visits per month (0 if excluded)" value={p.gymVisitsPerMonth} /><NumberField name={name('freeFormSessions')} label="Included form sessions" value={p.freeFormSessions} max={20} /></div>
      <TextField name={name('gymDescription')} label="Gym access explanation" value={p.gymDescription} multiline /><TextField name={name('trainerDescription')} label="Trainer support explanation" value={p.trainerDescription} multiline />
    </div> : <><p className="rounded bg-gray-50 p-3 text-sm dark:bg-gray-800">This region is guidance-only. Gym access, floor sessions and doorstep panels stay excluded.</p><input type="hidden" name={name('gymVisitsPerMonth')} value="0" /><input type="hidden" name={name('freeFormSessions')} value="0" /></>}
    <div className="space-y-4"><h3 className="font-semibold">Coaching and clinical support</h3><NumberField name={name('checkInsPerWeek')} label="Coaching check-ins per week (0 if excluded)" value={p.checkInsPerWeek} max={7} /><TextField name={name('coachingDescription')} label="Check-in explanation" value={p.coachingDescription} multiline />
      <div className="flex flex-wrap gap-6"><Check name={name('mealRoutine')} label="Include AI Indian meal guidance" value={p.mealRoutine} /><Check name={name('dietitianReview')} label="Include one human clinical dietitian review" value={p.dietitianReview} /><Check name={name('doctorClearanceForRed')} label="Include doctor clearance for RED users" value={p.doctorClearanceForRed} /></div>
      <TextField name={name('mealDescription')} label="Meal guidance explanation" value={p.mealDescription} multiline /><TextField name={name('clinicalDescription')} label="Clinical review explanation" value={p.clinicalDescription} multiline />
    </div>
    {local ? <div className="space-y-4"><h3 className="font-semibold">Doorstep labs</h3><NumberField name={name('labCredits')} label="Included panels (0, 1 or 2)" value={p.labCredits} max={2} /><p className="text-xs text-gray-500">The baseline opens on Day 4. A second panel is reserved for Day 90, so a two-panel plan needs at least 90 days of validity.</p><TextField name={name('labDescription')} label="Lab collection explanation" value={p.labDescription} multiline /></div> : <input type="hidden" name={name('labCredits')} value="0" />}
    <TextField name={name('onboardingDescription')} label="What happens after the user joins" value={p.onboardingDescription} multiline />
  </fieldset>;
}
export function LegacyEditor({ config, version, region }: {
  config: CatalogConfig;
  version: number;
  region: keyof CatalogConfig['regions'];
}) {
  const local = region === 'GURUGRAM';
  const r = config.regions[region];
  return <div className="space-y-5">
    <p className="text-sm">This catalog uses legacy regional plans. The subscription catalog will appear when a v2 configuration is available.</p>
    <div className="flex gap-4 text-sm">
      <Link href="/coaching-plans?region=GURUGRAM" className="underline" aria-current={local ? 'page' : undefined}>Gurugram</Link>
      <Link href="/coaching-plans?region=REST_INDIA" className="underline" aria-current={!local ? 'page' : undefined}>Outside Gurugram</Link>
    </div>
    <ActionForm action={savePlansAction} preserveOnError confirmMessage="Publish these regional terms for future purchases?" className="space-y-6"><input type="hidden" name="region" value={region} /><input type="hidden" name="version" value={version} />
      <TextField name="label" label="Region label" value={r.label} max={150} />
      {r.plans.map(plan => <PlanEditor key={plan.product} plan={plan} local={local} />)}
      <fieldset className="space-y-4 rounded border p-5"><legend className="px-2 font-semibold">Trainer add-on</legend>
        {local ? <Check name="addon.enabled" label="Allow trainer add-on purchases" value={r.addon.enabled} /> : <p className="text-sm">Gym-floor add-ons stay unavailable outside Gurugram.</p>}
        <TextField name="addon.title" label="Add-on name" value={r.addon.title} max={120} /><TextField name="addon.description" label="Add-on explanation" value={r.addon.description} multiline />
        <div className="grid gap-4 md:grid-cols-3"><label className="grid gap-1 text-sm">Price in ₹<input required name="addon.price" type="number" min="0.01" max="1000000" step="0.01" defaultValue={(r.addon.amountPaise / 100).toFixed(2)} className={field} /></label><NumberField name="addon.sessions" label="Sessions per purchase" value={r.addon.sessions} min={1} max={20} /><NumberField name="addon.validityDays" label="Validity in days" value={r.addon.validityDays} min={1} max={365} /></div>
      </fieldset>
      <SubmitButton className="rounded bg-emerald-700 px-5 py-3 text-white" pendingText="Publishing…">Publish {local ? 'Gurugram' : 'outside-Gurugram'} offering</SubmitButton>
    </ActionForm>
  </div>;
}
