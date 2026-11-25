import { describe, it, expect } from 'vitest';
import type { ExerciseLibraryEntry, RoutineExercise } from '@/lib/routinesApi';
import { buildExerciseRows, buildRoutinePayload, formatExerciseLines, MAX_MAIN_EXERCISES } from './routineForm';

const lib = (entries: [string, number, string][]) =>
  new Map<string, ExerciseLibraryEntry>(entries.map(([name, id, loggingType]) => [name.toLowerCase(), { id, name, loggingType }]));
const LIBRARY = lib([
  ['Barbell Row', 1, 'sets_reps_weight'],
  ['Plank', 2, 'duration'],
  ['Treadmill Walk', 3, 'duration_distance'],
  ['March in Place', 4, 'duration'],
]);

describe('exercise lines', () => {
  it('turns reps into reps and time into seconds from the library, with optional rest and phase', () => {
    const built = buildExerciseRows(
      ['March in Place | 1 | 120 | 0 | warm-up', 'Barbell Row | 3 | 8 | 120', 'plank|3|30', 'Treadmill Walk | 1 | 600 | 0'].join('\n'),
      LIBRARY,
    );
    expect(built).toEqual({
      ok: true,
      rows: [
        { exerciseId: 4, phase: 'warm_up', targetSets: 1, targetDurationSeconds: 120, restSeconds: 0 },
        { exerciseId: 1, phase: 'main', targetSets: 3, targetReps: 8, restSeconds: 120 },
        { exerciseId: 2, phase: 'main', targetSets: 3, targetDurationSeconds: 30 },
        { exerciseId: 3, phase: 'main', targetSets: 1, targetDurationSeconds: 600, restSeconds: 0 },
      ],
    });
  });

  it('names the line and the problem', () => {
    const msg = (text: string) => {
      const r = buildExerciseRows(text, LIBRARY);
      return r.ok ? 'ok' : r.message;
    };
    expect(msg('')).toMatch(/at least one exercise/);
    expect(msg('Barbell Row | 3')).toMatch(/^Line 1: write/);
    expect(msg('Barbell Row | 3 | 8\nBarbel Row | 3 | 8')).toMatch(/^Line 2: "Barbel Row" is not in the exercise library/);
    expect(msg('Barbell Row | 0 | 8')).toMatch(/sets must be/);
    expect(msg('Barbell Row | 3 | 8.5')).toMatch(/reps must be/);
    expect(msg('Plank | 3 | 0')).toMatch(/seconds must be/);
    expect(msg('Barbell Row | 3 | 8 | -5')).toMatch(/rest must be/);
    expect(msg('Barbell Row | 3 | 8 | 60 | finisher')).toMatch(/phase must be/);
    expect(msg('March in Place | 1 | 60 | 0 | warm_up')).toMatch(/at least one main exercise/);
  });

  it('caps main exercises but not warm-up or cool-down rows', () => {
    const main = Array.from({ length: MAX_MAIN_EXERCISES }, () => 'Barbell Row | 3 | 8').join('\n');
    expect(buildExerciseRows(`${main}\nMarch in Place | 1 | 60 | 0 | warm_up`, LIBRARY).ok).toBe(true);
    const r = buildExerciseRows(`${main}\nBarbell Row | 3 | 8`, LIBRARY);
    expect(r.ok).toBe(false);
  });

  it('round-trips existing rows through the editor text', () => {
    const rows: RoutineExercise[] = [
      { exerciseId: 4, order: 0, phase: 'warm_up', targetSets: 1, targetReps: null, targetDurationSeconds: 120, restSeconds: 0, instructions: null, exercise: { id: 4, name: 'March in Place', loggingType: 'duration' } },
      { exerciseId: 1, order: 1, phase: 'main', targetSets: 3, targetReps: 8, targetDurationSeconds: null, restSeconds: 120, instructions: null, exercise: { id: 1, name: 'Barbell Row', loggingType: 'sets_reps_weight' } },
      { exerciseId: 2, order: 2, phase: 'main', targetSets: 3, targetReps: null, targetDurationSeconds: 30, restSeconds: null, instructions: null, exercise: { id: 2, name: 'Plank', loggingType: 'duration' } },
    ];
    const text = formatExerciseLines(rows);
    expect(text).toBe('March in Place | 1 | 120 | 0 | warm_up\nBarbell Row | 3 | 8 | 120\nPlank | 3 | 30 | ');
    const back = buildExerciseRows(text, LIBRARY);
    expect(back.ok && back.rows.map((r) => [r.exerciseId, r.phase, r.targetReps ?? r.targetDurationSeconds])).toEqual([
      [4, 'warm_up', 120], [1, 'main', 8], [2, 'main', 30],
    ]);
  });
});

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
const GOOD = {
  key: 'gym_push_c', category: 'push', goal: 'muscleBuilding', level: 'beginner', sortOrder: '30',
  'text.en.name': 'Push Day C', 'text.en.description': 'Chest · shoulders', 'text.en.guidance': 'Go steady.',
  exercises: 'Barbell Row | 3 | 8 | 120',
};

describe('routine payload', () => {
  it('builds a create body; an unticked Published box means unpublished', () => {
    const r = buildRoutinePayload(form(GOOD), 'create', LIBRARY);
    expect(r.ok && r.payload).toMatchObject({
      key: 'gym_push_c', category: 'push', goal: 'muscleBuilding', level: 'beginner', sortOrder: 30, isPublished: false,
      texts: { en: { name: 'Push Day C', description: 'Chest · shoulders', guidance: 'Go steady.' } },
    });
    expect(r.ok && r.payload.texts.hi).toBeUndefined();
    expect(buildRoutinePayload(form({ ...GOOD, isPublished: 'on' }), 'create', LIBRARY)).toMatchObject({ ok: true, payload: { isPublished: true } });
  });

  it('on edit, an emptied translation is sent as null so it is removed, and the key is not sent', () => {
    const r = buildRoutinePayload(form({ ...GOOD, 'text.hi.name': '' }), 'edit', LIBRARY, '2026-11-28T10:00:00.000Z');
    expect(r.ok && r.payload.texts.hi).toBeNull();
    expect(r.ok && r.payload.key).toBeUndefined();
    expect(r.ok && r.payload.expectedUpdatedAt).toBe('2026-11-28T10:00:00.000Z');
  });

  it('rejects bad input with a message', () => {
    const msg = (v: Record<string, string>, mode: 'create' | 'edit' = 'create') => {
      const r = buildRoutinePayload(form({ ...GOOD, ...v }), mode, LIBRARY);
      return r.ok ? 'ok' : r.message;
    };
    expect(msg({ category: 'chest' })).toMatch(/category/);
    expect(msg({ goal: '' })).toMatch(/goal/);
    expect(msg({ level: 'expert' })).toMatch(/level/);
    expect(msg({ sortOrder: '-1' })).toMatch(/Sort order/);
    expect(msg({ 'text.en.name': '' })).toMatch(/English name/);
    expect(msg({ 'text.hi.name': '', 'text.hi.guidance': 'x' })).toMatch(/Hindi: add a name/);
    expect(msg({ 'text.en.name': 'x'.repeat(121) })).toMatch(/too long/);
    expect(msg({ key: 'Bad Key' })).toMatch(/Key must be/);
    expect(msg({ key: 'Bad Key' }, 'edit')).toBe('ok');
    expect(msg({ exercises: 'Nope | 3 | 8' })).toMatch(/not in the exercise library/);
  });
});
