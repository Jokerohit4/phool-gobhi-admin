import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { ExpectedUpdatedAt } from '@/components/ui/ExpectedUpdatedAt';
import type { Routine } from '@/lib/routinesApi';
import { saveRoutineAction } from './actions';
import {
  CATEGORIES, CATEGORY_LABELS, GOALS, GOAL_LABELS, LANGS, LEVELS, MAX_MAIN_EXERCISES, formatExerciseLines,
} from './routineForm';

const field = 'w-full rounded border p-2 text-sm dark:bg-gray-900';
const NEW_ROUTINE_EXERCISES = [
  'March in Place | 1 | 120 | 0 | warm_up',
  'Barbell Bench Press | 3 | 10 | 90',
  'Treadmill Walk | 1 | 600 | 0',
].join('\n');

function Select({ name, label, value, options }: { name: string; label: string; value: string | null | undefined; options: { value: string; label: string }[] }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <select name={name} defaultValue={value ?? ''} required className={field}>
        <option value="" disabled>Choose…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

// `routine` is set when editing an existing routine; absent for a new one.
export function RoutineEditor({ routine }: { routine?: Routine }) {
  const editing = Boolean(routine);
  const text = (lang: string) => routine?.texts.find((t) => t.lang === lang);
  return (
    <ActionForm action={saveRoutineAction} className="flex flex-col gap-6">
      {routine && <input type="hidden" name="id" value={routine.id} />}
      <ExpectedUpdatedAt value={routine?.updatedAt} />

      <fieldset className="grid gap-4 rounded border p-5 md:grid-cols-2">
        <legend className="px-2 font-semibold">Basics</legend>
        <label className="grid gap-1 text-sm">
          Key
          <input
            name="key" defaultValue={routine?.key ?? ''} readOnly={editing} required={!editing}
            pattern="[a-z0-9_]{3,60}" maxLength={60} className={`${field} ${editing ? 'bg-gray-50 text-gray-500' : ''}`}
          />
          <span className="text-xs text-gray-500">
            {editing ? 'The stable id plans and the app use. It cannot be changed.' : 'Lowercase letters, digits and underscores, e.g. gym_push_c. Cannot be changed later.'}
          </span>
        </label>
        <label className="grid gap-1 text-sm">
          Sort order
          <input name="sortOrder" type="number" min={0} max={100000} step={1} defaultValue={routine?.sortOrder ?? 0} className={field} />
          <span className="text-xs text-gray-500">Lower numbers appear first in the app.</span>
        </label>
        <Select name="category" label="Category" value={routine?.category} options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} />
        <Select name="goal" label="Goal" value={routine?.goal} options={GOALS.map((g) => ({ value: g, label: GOAL_LABELS[g] }))} />
        <Select name="level" label="Level" value={routine?.level ?? 'beginner'} options={LEVELS.map((l) => ({ value: l, label: l === 'beginner' ? 'Beginner' : 'Intermediate' }))} />
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" name="isPublished" defaultChecked={routine?.isPublished ?? false} />
          Published (visible to users)
        </label>
        {routine?.legacyListed && (
          <p className="text-xs text-gray-500 md:col-span-2">
            This routine is also shown in the plain routine list that older app versions use, and the coached-plan engine can schedule it. Unpublishing removes it from both.
          </p>
        )}
      </fieldset>

      {LANGS.map(({ key, label }) => (
        <fieldset key={key} className="grid gap-4 rounded border p-5">
          <legend className="px-2 font-semibold">{label}{key === 'en' ? ' (required)' : ' (optional, falls back to English)'}</legend>
          <label className="grid gap-1 text-sm">
            Name
            <input name={`text.${key}.name`} defaultValue={text(key)?.name ?? ''} required={key === 'en'} maxLength={120} className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            Short description
            <input name={`text.${key}.description`} defaultValue={text(key)?.description ?? ''} maxLength={400} className={field} />
            <span className="text-xs text-gray-500">Muscles and setting, e.g. “Chest · shoulders · triceps”. The exercise count is shown automatically.</span>
          </label>
          <label className="grid gap-1 text-sm">
            Coaching guidance
            <textarea name={`text.${key}.guidance`} defaultValue={text(key)?.guidance ?? ''} rows={2} maxLength={600} className={field} />
          </label>
        </fieldset>
      ))}

      <fieldset className="grid gap-3 rounded border p-5">
        <legend className="px-2 font-semibold">Exercises</legend>
        <textarea
          name="exercises" required rows={14} spellCheck={false}
          defaultValue={routine ? formatExerciseLines(routine.exercises) : NEW_ROUTINE_EXERCISES}
          className={`${field} font-mono`}
        />
        <p className="text-xs text-gray-500">
          One per line: <code>name | sets | reps or seconds | rest (seconds) | phase</code>. Rest and phase are optional; phase is main
          (default), warm_up or cool_down. The number is reps for exercises counted in reps and seconds for timed ones, taken from the
          exercise library. Names must match the library exactly. At most {MAX_MAIN_EXERCISES} main exercises; warm-up and cool-down rows
          are not counted. Saving replaces the whole list. Existing copies users made are not changed.
        </p>
      </fieldset>

      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…">{editing ? 'Save changes' : 'Create routine'}</SubmitButton>
        {routine && <span className="text-xs text-gray-500">Version {routine.version}</span>}
      </div>
    </ActionForm>
  );
}
