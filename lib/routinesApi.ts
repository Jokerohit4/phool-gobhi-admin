import { gatewayJson } from './api';

// Server-only typed access to health-service's staff routine-catalogue routes
// (/api/health/admin/templates) and the exercise library the editor resolves
// names against. Client components must only `import type` from here (this
// module pulls in next/headers through ./api).

export interface RoutineExercise {
  id?: number;
  exerciseId: number;
  order: number;
  phase: 'warm_up' | 'main' | 'cool_down';
  targetSets: number;
  targetReps: number | null;
  targetDurationSeconds: number | null;
  restSeconds: number | null;
  instructions: string | null;
  exercise?: { id: number; name: string; loggingType: string; equipment?: string } | null;
}

export interface RoutineText {
  lang: 'en' | 'hinglish' | 'hi';
  name: string;
  description: string | null;
  guidance: string | null;
}

export interface Routine {
  id: number;
  key: string | null;
  name: string;
  description: string | null;
  category: string | null;
  goal: string | null;
  level: string | null;
  estMinutes: number | null;
  sortOrder: number;
  isPublished: boolean;
  legacyListed: boolean;
  version: number;
  updatedBy: number | null;
  updatedAt: string;
  exercises: RoutineExercise[];
  texts: RoutineText[];
}

export interface ExerciseLibraryEntry {
  id: number;
  name: string;
  loggingType: string;
}

const BASE = '/api/health/admin/templates';

export async function fetchRoutines(): Promise<Routine[]> {
  return (await gatewayJson<{ data: Routine[] }>(BASE)).data;
}

export async function fetchRoutine(id: number): Promise<Routine> {
  return (await gatewayJson<{ data: Routine }>(`${BASE}/${id}`)).data;
}

/** Library exercises by lower-cased name, for resolving the editor's text lines. */
export async function fetchExerciseLibrary(): Promise<Map<string, ExerciseLibraryEntry>> {
  const { data } = await gatewayJson<{ data: (ExerciseLibraryEntry & { createdByUserId?: number | null })[] }>('/api/health/exercises');
  const map = new Map<string, ExerciseLibraryEntry>();
  for (const e of data) {
    // Staff's own custom exercises are not part of the shared library.
    if (e.createdByUserId) continue;
    map.set(e.name.toLowerCase(), { id: e.id, name: e.name, loggingType: e.loggingType });
  }
  return map;
}

/** Create (id null) or update a routine. Throws GatewayError, which keeps CONFIG_CONFLICT's errorCode. */
export async function saveRoutine(id: number | null, body: unknown): Promise<Routine> {
  const res = await gatewayJson<{ data: Routine }>(id === null ? BASE : `${BASE}/${id}`, {
    method: id === null ? 'POST' : 'PUT',
    body: JSON.stringify(body),
  });
  return res.data;
}
