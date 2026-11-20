'use client';

import Image from 'next/image';
import { useState, type ChangeEvent } from 'react';
import { ActionForm, type ActionState } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { asIndiaInput, type CampaignConfig, type CampaignOptions } from './campaigns';

export const campaignField = 'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900';
const label = 'grid gap-1 text-sm font-medium';
const intervals = [
  { minutes: 10080, label: 'Weeks' },
  { minutes: 1440, label: 'Days' },
  { minutes: 60, label: 'Hours' },
  { minutes: 1, label: 'Minutes' },
];

function previewImage(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function NotificationPreview({ title, subtitle, imageUrl, deepLink }: Pick<CampaignConfig, 'title' | 'subtitle' | 'imageUrl' | 'deepLink'>) {
  const image = previewImage(imageUrl);
  return <aside className="h-fit rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
    <h2 className="mb-3 text-sm font-semibold">Push preview</h2>
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
      {image && <Image unoptimized src={image} alt="" width={480} height={240} className="h-36 w-full object-cover" />}
      <div className="p-3">
        <p className="break-words text-sm font-semibold">{title || 'Title'}</p>
        <p className="break-words text-sm text-gray-600 dark:text-gray-300">{subtitle || 'Subtitle'}</p>
      </div>
    </div>
    {deepLink && <p className="mt-3 break-all text-xs text-gray-500">{deepLink}</p>}
  </aside>;
}

export function CampaignForm({ options, config, action }: {
  options: CampaignOptions;
  config?: CampaignConfig;
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
}) {
  const [initialPath, initialQuery] = (config?.deepLink ?? '/main').split('?');
  const [path, setPath] = useState(initialPath);
  const [title, setTitle] = useState(config?.title ?? '');
  const [subtitle, setSubtitle] = useState(config?.subtitle ?? '');
  const [imageUrl, setImageUrl] = useState(config?.imageUrl ?? '');
  const [mode, setMode] = useState(config?.mode ?? 'once');
  const interval = config?.intervalMinutes ?? 1440;
  const initialUnit = intervals.find(unit => interval % unit.minutes === 0)?.minutes ?? 1;
  const [intervalUnit, setIntervalUnit] = useState(initialUnit);
  const [audience, setAudience] = useState(config?.audience.type ?? 'users');
  const [parameterValue, setParameterValue] = useState(new URLSearchParams(initialQuery).values().next().value ?? '');
  const [selectedCohorts, setSelectedCohorts] = useState(config?.audience.cohorts ?? []);
  const [fields, setFields] = useState({
    name: config?.name ?? '',
    userIds: config?.audience.userIds?.join(', ') ?? '',
    startAt: asIndiaInput(config?.startAt),
    endAt: asIndiaInput(config?.endAt),
    intervalAmount: String(interval / initialUnit),
    maxRuns: String(config?.maxRuns ?? 7),
    event: config?.event ?? Object.keys(options.events)[0] ?? '',
    delayMinutes: String(config?.delayMinutes ?? 0),
    cooldownMinutes: String(config?.cooldownMinutes ?? 1440),
    maxPerUser: String(config?.maxPerUser ?? 1),
  });
  function bind(key: keyof typeof fields) {
    return {
      name: key,
      value: fields[key],
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const value = e.target.value;
        setFields(previous => ({ ...previous, [key]: value }));
      },
    };
  }
  const parameter = options.destinations.find(item => item.path === path)?.parameter;
  const deepLink = path + (parameter ? '?' + new URLSearchParams({ [parameter]: parameterValue }) : '');

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)]">
    <ActionForm action={action} className="space-y-5 rounded-xl border border-gray-200 p-5 dark:border-gray-800">
      <section className="grid gap-3">
        <h2 className="font-semibold">Content</h2>
        <label className={label}>Campaign name<input className={campaignField} {...bind('name')} maxLength={100} required /></label>
        <label className={label}>Title<input className={campaignField} name="title" value={title} onChange={e => setTitle(e.target.value)} maxLength={80} required /></label>
        <label className={label}>Subtitle<textarea className={campaignField} name="subtitle" value={subtitle} onChange={e => setSubtitle(e.target.value)} maxLength={220} rows={2} required /></label>
        <label className={label}>Image URL<input className={campaignField} name="imageUrl" type="url" placeholder="https://" value={imageUrl} onChange={e => setImageUrl(e.target.value)} maxLength={700} /></label>
        <label className={label}>Tap destination<select className={campaignField} name="destination" value={path} onChange={e => { setPath(e.target.value); setParameterValue(''); }}>
          {options.destinations.map(item => <option key={item.path} value={item.path}>{item.label}</option>)}
        </select></label>
        {parameter && <label className={label}>{parameter}
          <input type="hidden" name="parameterKey" value={parameter} />
          <input className={campaignField} name="parameterValue" value={parameterValue} onChange={e => setParameterValue(e.target.value)} inputMode={parameter === 'runId' ? 'text' : 'numeric'} required />
        </label>}
      </section>
      <section className="grid gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
        <h2 className="font-semibold">Audience</h2>
        <label className={label}>Recipients<select className={campaignField} name="audience" value={audience} onChange={e => setAudience(e.target.value as CampaignConfig['audience']['type'])}>
          <option value="users">Selected customer IDs</option>
          <option value="cohorts">Account cohorts</option>
          <option value="all">All eligible customers</option>
        </select></label>
        {audience === 'users' && <label className={label}>Customer IDs, separated by commas or spaces
          <textarea className={campaignField} {...bind('userIds')} rows={2} required />
        </label>}
        {audience === 'cohorts' && <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Choose cohorts</legend>
          {options.cohorts.map(cohort => <label key={cohort} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="cohorts" value={cohort} checked={selectedCohorts.includes(cohort)} onChange={e => {
              setSelectedCohorts(e.target.checked ? [...selectedCohorts, cohort] : selectedCohorts.filter(item => item !== cohort));
            }} />
            {cohort.toLowerCase().replaceAll('_', ' ')}
          </label>)}
        </fieldset>}
      </section>
      <section className="grid gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
        <h2 className="font-semibold">Timing</h2>
        <label className={label}>Trigger<select className={campaignField} name="mode" value={mode} onChange={e => setMode(e.target.value as CampaignConfig['mode'])}>
          <option value="once">One-time send</option>
          <option value="recurring">Recurring schedule</option>
          <option value="event">Customer event</option>
        </select></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Start (IST, blank to start on activation)
            <input className={campaignField} type="datetime-local" {...bind('startAt')} />
          </label>
          {mode !== 'once' && <label className={label}>End (IST, optional)
            <input className={campaignField} type="datetime-local" {...bind('endAt')} />
          </label>}
        </div>
        {mode === 'recurring' && <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>Repeat every<input className={campaignField} type="number" min={1} max={Math.floor(525600 / intervalUnit)} {...bind('intervalAmount')} required /></label>
            <label className={label}>Unit<select className={campaignField} name="intervalUnit" value={intervalUnit} onChange={e => setIntervalUnit(Number(e.target.value))}>
              {intervals.map(unit => <option key={unit.minutes} value={unit.minutes}>{unit.label}</option>)}
            </select></label>
          </div>
          <label className={label}>Maximum scheduled sends<input className={campaignField} type="number" min={2} max={1000} {...bind('maxRuns')} required /></label>
        </div>}
        {mode === 'event' && <>
          <label className={label}>Customer event<select className={campaignField} {...bind('event')}>
            {Object.entries(options.events).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={label}>Delay (minutes)<input className={campaignField} type="number" min={0} max={43200} {...bind('delayMinutes')} required /></label>
            <label className={label}>Cooldown (minutes)<input className={campaignField} type="number" min={1} max={43200} {...bind('cooldownMinutes')} required /></label>
            <label className={label}>Max sends per customer<input className={campaignField} type="number" min={1} max={100} {...bind('maxPerUser')} required /></label>
          </div>
        </>}
      </section>
      <SubmitButton pendingText="Saving…">{config ? 'Save changes' : 'Create draft'}</SubmitButton>
    </ActionForm>
    <NotificationPreview title={title} subtitle={subtitle} imageUrl={imageUrl} deepLink={deepLink} />
  </div>;
}
