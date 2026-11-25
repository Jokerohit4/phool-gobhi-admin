// Pure helpers for the routine editor: the exercise-list text format, and
// turning a posted form into the body health-service's admin routine route
// takes. No gateway or Next imports, so this is unit-tested on its own.
//
// Exercises are typed one per line:
//     Barbell Row | 3 | 8 | 120 | main
//     Plank | 3 | 30 | 45
//     March in Place | 1 | 120 | 0 | warm_up
// name | sets | target | rest seconds (optional) | phase (optional, default main).
// The target is reps for an exercise counted in reps and seconds for a timed
// one; which it is comes from the exercise library, so staff never have to say.
import type { ExerciseLibraryEntry, RoutineExercise } from '@/lib/routinesApi';

export const CATEGORIES = ['push', 'pull', 'legs', 'full_body', 'cardio', 'core', 'mobility'] as const;
export const GOALS = ['muscleBuilding', 'strength', 'fatLoss', 'stamina', 'beginner', 'mobility'] as const;
export const LEVELS = ['beginner', 'intermediate'] as const;
export const LANGS = [
  { key: 'en', label: 'English' },
  { key: 'hinglish', label: 'Hinglish' },
  { key: 'hi', label: 'Hindi' },
] as const;
export type LangKey = (typeof LANGS)[number]['key'];

export const CATEGORY_LABELS: Record<string, string> = {
  push: 'Push', pull: 'Pull', legs: 'Legs', full_body: 'Full body', cardio: 'Cardio', core: 'Core', mobility: 'Mobility',
};
export const GOAL_LABELS: Record<string, string> = {
  muscleBuilding: 'Muscle building', strength: 'Strength', fatLoss: 'Fat loss', stamina: 'Stamina',
  beginner: 'Getting started', mobility: 'Mobility',
};

export const MAX_MAIN_EXERCISES = 6;
export type Phase = 'warm_up' | 'main' | 'cool_down';

const PHASE_ALIASES: Record<string, Phase> = {
  main: 'main', warm_up: 'warm_up', 'warm-up': 'warm_up', warmup: 'warm_up', 'warm up': 'warm_up',
  cool_down: 'cool_down', 'cool-down': 'cool_down', cooldown: 'cool_down', 'cool down': 'cool_down',
};

/** The editor's text for existing rows, in the same format it parses. */
export function formatExerciseLines(rows: RoutineExercise[]): string {
  return rows
    .map((row) => {
      const target = row.targetDurationSeconds ?? row.targetReps ?? '';
      const parts = [row.exercise?.name ?? `#${row.exerciseId}`, row.targetSets, target, row.restSeconds ?? ''];
      if (row.phase !== 'main') parts.push(row.phase);
      return parts.join(' | ');
    })
    .join('\n');
}

export interface ExerciseRowPayload {
  exerciseId: number;
  phase: Phase;
  targetSets: number;
  targetReps?: number;
  targetDurationSeconds?: number;
  restSeconds?: number;
}

type Built = { ok: true; rows: ExerciseRowPayload[] } | { ok: false; message: string };

const whole = (s: string) => (/^\d+$/.test(s) ? Number(s) : NaN);

/** Parse the exercise lines against the library. Reports the first problem with its line number. */
export function buildExerciseRows(text: string, library: Map<string, ExerciseLibraryEntry>): Built {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { ok: false, message: 'Add at least one exercise' };
  const rows: ExerciseRowPayload[] = [];
  for (const [i, line] of lines.entries()) {
    const where = `Line ${i + 1}`;
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length < 3) return { ok: false, message: `${where}: write "name | sets | reps or seconds | rest | phase" (rest and phase are optional)` };
    const [name, setsText, targetText, restText = '', phaseText = ''] = parts;
    const entry = library.get(name.toLowerCase());
    if (!entry) return { ok: false, message: `${where}: "${name}" is not in the exercise library (check the spelling)` };
    const sets = whole(setsText);
    if (!(sets >= 1 && sets <= 100)) return { ok: false, message: `${where} (${name}): sets must be a whole number from 1 to 100` };
    const target = whole(targetText);
    const counted = entry.loggingType === 'sets_reps_weight';
    if (!(target >= 1) || target > (counted ? 1000 : 86400)) {
      return { ok: false, message: `${where} (${name}): ${counted ? 'reps must be a whole number from 1 to 1000' : 'seconds must be a whole number from 1 to 86400'}` };
    }
    let rest: number | undefined;
    if (restText !== '') {
      rest = whole(restText);
      if (!(rest >= 0 && rest <= 3600)) return { ok: false, message: `${where} (${name}): rest must be 0 to 3600 seconds` };
    }
    const phase = phaseText === '' ? 'main' : PHASE_ALIASES[phaseText.toLowerCase()];
    if (!phase) return { ok: false, message: `${where} (${name}): phase must be main, warm_up or cool_down` };
    rows.push({
      exerciseId: entry.id,
      phase,
      targetSets: sets,
      ...(counted ? { targetReps: target } : { targetDurationSeconds: target }),
      ...(rest !== undefined ? { restSeconds: rest } : {}),
    });
  }
  const main = rows.filter((r) => r.phase === 'main').length;
  if (main === 0) return { ok: false, message: 'A routine needs at least one main exercise' };
  if (main > MAX_MAIN_EXERCISES) return { ok: false, message: `A routine can have at most ${MAX_MAIN_EXERCISES} main exercises (it has ${main})` };
  return { ok: true, rows };
}

export interface RoutinePayload {
  key?: string;
  category: string;
  goal: string;
  level: string;
  sortOrder: number;
  isPublished: boolean;
  texts: Partial<Record<LangKey, { name: string; description: string; guidance: string } | null>>;
  exercises: ExerciseRowPayload[];
  expectedUpdatedAt?: string;
}

type PayloadResult = { ok: true; payload: RoutinePayload } | { ok: false; message: string };

const str = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === 'string' ? v.trim() : '';
};
const oneOf = <T extends string>(value: string, allowed: readonly T[]): value is T => (allowed as readonly string[]).includes(value);

export function buildRoutinePayload(
  form: FormData,
  mode: 'create' | 'edit',
  library: Map<string, ExerciseLibraryEntry>,
  expectedUpdatedAt?: string,
): PayloadResult {
  const category = str(form, 'category');
  const goal = str(form, 'goal');
  const level = str(form, 'level');
  if (!oneOf(category, CATEGORIES)) return { ok: false, message: 'Choose a category' };
  if (!oneOf(goal, GOALS)) return { ok: false, message: 'Choose a goal' };
  if (!oneOf(level, LEVELS)) return { ok: false, message: 'Choose a level' };
  const sortText = str(form, 'sortOrder');
  const sortOrder = sortText === '' ? 0 : whole(sortText);
  if (!(sortOrder >= 0 && sortOrder <= 100000)) return { ok: false, message: 'Sort order must be a whole number from 0 to 100000' };

  const texts: RoutinePayload['texts'] = {};
  for (const { key, label } of LANGS) {
    const name = str(form, `text.${key}.name`);
    const description = str(form, `text.${key}.description`);
    const guidance = str(form, `text.${key}.guidance`);
    if (name === '') {
      if (key === 'en') return { ok: false, message: 'English name is required' };
      if (description || guidance) return { ok: false, message: `${label}: add a name, or clear the description and guidance` };
      // An emptied translation is removed on edit and simply omitted on create.
      if (mode === 'edit') texts[key] = null;
      continue;
    }
    if (name.length > 120) return { ok: false, message: `${label} name is too long (120 characters at most)` };
    if (description.length > 400) return { ok: false, message: `${label} description is too long (400 characters at most)` };
    if (guidance.length > 600) return { ok: false, message: `${label} guidance is too long (600 characters at most)` };
    texts[key] = { name, description, guidance };
  }

  const built = buildExerciseRows(str(form, 'exercises'), library);
  if (!built.ok) return built;

  const payload: RoutinePayload = {
    category, goal, level, sortOrder,
    isPublished: form.get('isPublished') === 'on',
    texts,
    exercises: built.rows,
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
  };
  if (mode === 'create') {
    const key = str(form, 'key');
    if (!/^[a-z0-9_]{3,60}$/.test(key)) return { ok: false, message: 'Key must be 3-60 characters: lowercase letters, digits and underscores' };
    payload.key = key;
  }
  return { ok: true, payload };
}
