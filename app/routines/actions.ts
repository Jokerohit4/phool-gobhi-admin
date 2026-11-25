'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { fetchExerciseLibrary, saveRoutine, type Routine } from '@/lib/routinesApi';
import { configErrorState, expectedUpdatedAtFrom } from '@/lib/configConcurrency';
import { parsePositiveId, INVALID_ID_MESSAGE } from '@/lib/ids';
import type { ActionState } from '@/components/ui/ActionForm';
import { buildRoutinePayload } from './routineForm';

// Create (no `id` field) or update (`id`) a catalogue routine. The exercise
// lines are resolved against the library here, so a misspelt name is reported
// with its line number before anything is sent.
export async function saveRoutineAction(_state: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const rawId = form.get('id');
  const id = rawId ? parsePositiveId(rawId) : null;
  if (rawId && id === null) return { ok: false, message: INVALID_ID_MESSAGE };

  let saved: Routine;
  try {
    const library = await fetchExerciseLibrary();
    const built = buildRoutinePayload(form, id === null ? 'create' : 'edit', library, expectedUpdatedAtFrom(form));
    if (!built.ok) return { ok: false, message: built.message };
    saved = await saveRoutine(id, built.payload);
  } catch (err) {
    return configErrorState(err, 'Could not save the routine');
  }
  revalidatePath('/routines');
  // redirect() throws, so it stays outside the try/catch above.
  if (id === null) redirect(`/routines/${saved.id}?created=1`);
  revalidatePath(`/routines/${id}`);
  return {
    ok: true,
    message: `Saved (version ${saved.version}). Users see the change within a minute; copies users already made are not affected.`,
  };
}
