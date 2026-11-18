'use client';

// Loader facts — the tiny "did you know" line that sits under a spinner.
//
// Cache strategy (deliberate, not a plain fetch-every-time):
//   • keep 10 facts in use + 10 prefetched = 20 on device (except the very
//     first session, which shows a bundled seed until the first download lands)
//   • each new app/tab session promotes the prefetched batch, drops the old
//     one, and fetches the batch after it — a rolling window over the corpus
//   • a shuffled per-session order means the 10 in use never repeat before
//     the window rotates
//
// The canonical list lives in the backend (GET /content/loader-facts), sliced
// with offset/limit. Nothing here is a source of truth except the offline seed.

export interface LoaderFact {
  id: string;
  text: string;
}

export type LoaderAudience = 'customer' | 'partner' | 'admin' | 'marketing';

const STORAGE_KEY = 'pg.loader-facts.v1';
const SESSION_KEY = 'pg.loader-facts.session';
export const LOADER_FACT_BATCH = 10;

// Used only when the device has never downloaded a batch (first paint of the
// first ever session, or offline). Deliberately short — it is a stopgap.
const OFFLINE_SEED: LoaderFact[] = [
  { id: 'seed-1', text: 'Phool gobhi is 92% water and packs more vitamin C per serving than an orange.' },
  { id: 'seed-2', text: 'Over 70% of your immune system lives right inside your gut microbiome.' },
  { id: 'seed-3', text: 'Walking just 10 minutes after a meal helps keep your blood sugar steady.' },
  { id: 'seed-4', text: 'Your heart beats roughly 100,000 times a day to keep you moving.' },
  { id: 'seed-5', text: 'Slow, deep breathing signals your nervous system to lower stress in seconds.' },
  { id: 'seed-6', text: 'Your body builds a brand-new outer layer of skin every 28 days.' },
  { id: 'seed-7', text: 'Habit loops take an average of 66 days to become automatic, not 21.' },
  { id: 'seed-8', text: 'Consistency beats intensity—10 minutes daily outperforms 1 hour once a week.' },
  { id: 'seed-9', text: 'Your gut produces roughly 90% of your body’s serotonin.' },
  { id: 'seed-10', text: 'A 1% improvement every day compounds into 37x growth over one year.' },
];

interface StoredState {
  cursor: number;
  current: LoaderFact[];
  next: LoaderFact[] | null;
  order: number[];
  index: number;
  lastShownId?: string;
  loaded: boolean;
}

interface Batch {
  version: number;
  total: number;
  nextOffset: number;
  facts: LoaderFact[];
}

function isFact(value: unknown): value is LoaderFact {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as LoaderFact).id === 'string' &&
    typeof (value as LoaderFact).text === 'string'
  );
}

function readState(): StoredState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredState;
    if (!Array.isArray(parsed.current) || parsed.current.length === 0) return null;
    if (!parsed.current.every(isFact)) return null;
    if (parsed.next !== null && !(Array.isArray(parsed.next) && parsed.next.every(isFact))) return null;
    return {
      cursor: Number.isFinite(parsed.cursor) ? parsed.cursor : 0,
      current: parsed.current,
      next: Array.isArray(parsed.next) ? parsed.next : null,
      order: Array.isArray(parsed.order) && parsed.order.length === parsed.current.length
        ? parsed.order
        : shuffleIndexes(parsed.current.length),
      index: Number.isInteger(parsed.index) ? parsed.index : 0,
      lastShownId: typeof parsed.lastShownId === 'string' ? parsed.lastShownId : undefined,
      loaded: parsed.loaded === true,
    };
  } catch {
    return null;
  }
}

function writeState(state: StoredState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode / quota — facts are non-essential, never break a loader.
  }
}

function shuffleIndexes(length: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function newSessionState(
  current: LoaderFact[],
  next: LoaderFact[] | null,
  cursor: number,
  loaded: boolean,
): StoredState {
  return { cursor, current, next, order: shuffleIndexes(current.length), index: 0, loaded };
}

function wrapOffset(offset: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return ((offset % total) + total) % total;
}

async function fetchBatch(
  offset: number,
  audience: LoaderAudience,
  limit = LOADER_FACT_BATCH,
  locale?: string,
): Promise<Batch | null> {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
      audience,
    });
    if (locale) params.set('locale', locale);
    const res = await fetch(`/api/loader-facts?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Batch;
    if (!data || !Array.isArray(data.facts) || data.facts.length === 0) return null;
    if (!data.facts.every(isFact)) return null;
    return {
      version: Number(data.version) || 0,
      total: Number(data.total) || data.facts.length,
      nextOffset: Number(data.nextOffset) || wrapOffset(offset + limit, Number(data.total) || offset + limit),
      facts: data.facts,
    };
  } catch {
    return null;
  }
}

let bootstrapped: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Runs once per JS app load (route navigation does not re-run it). The very
 * first call seeds the store from the bundled fallback so a loader rendered
 * immediately has something to show, then downloads batches in the background.
 */
export function bootstrapLoaderFacts(
  audience: LoaderAudience = 'customer',
  locale?: string,
): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (bootstrapped) return bootstrapped;

  bootstrapped = (async () => {
    const existing = readState();

    if (!existing) {
      // First ever run: show the seed instantly, then replace it with batch 0
      // and prefetch batch 1 so the next session has fresh content ready.
      writeState(newSessionState(OFFLINE_SEED, null, 0, false));
      notify();

      const [first, second] = await Promise.all([
        fetchBatch(0, audience, LOADER_FACT_BATCH, locale),
        fetchBatch(LOADER_FACT_BATCH, audience, LOADER_FACT_BATCH, locale),
      ]);
      if (first) {
        writeState(newSessionState(first.facts, second?.facts ?? null, 0, true));
        markSessionPromoted();
        notify();
      }
      return;
    }

    // Same tab session (reload / client navigation): keep the window as-is.
    if (sessionAlreadyPromoted()) return;

    if (!existing.loaded) {
      // Still on the offline seed because the first download failed. Retry
      // the same window rather than skipping past batch 0.
      const [first, second] = await Promise.all([
        fetchBatch(existing.cursor, audience, LOADER_FACT_BATCH, locale),
        fetchBatch(existing.cursor + LOADER_FACT_BATCH, audience, LOADER_FACT_BATCH, locale),
      ]);
      if (first) {
        writeState(newSessionState(first.facts, second?.facts ?? null, existing.cursor, true));
      }
      markSessionPromoted();
      notify();
      return;
    }

    // New session: drop the old batch, promote the prefetched one (or keep
    // the current one if the prefetch failed), and pull the batch after it.
    const hasBufferedNext = !!existing.next?.length;
    const current = hasBufferedNext ? existing.next! : existing.current;
    const nextCursor = hasBufferedNext
      ? existing.cursor + LOADER_FACT_BATCH
      : existing.cursor;
    const fetchOffset = nextCursor + LOADER_FACT_BATCH;

    const fresh = await fetchBatch(fetchOffset, audience, LOADER_FACT_BATCH, locale);
    writeState(
      newSessionState(
        current,
        fresh?.facts ?? null,
        fresh ? wrapOffset(fetchOffset, fresh.total) : nextCursor,
        true,
      ),
    );
    markSessionPromoted();
    notify();
  })();

  return bootstrapped;
}

function markSessionPromoted(): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // sessionStorage unavailable — worst case the window rotates on reload.
  }
}

function sessionAlreadyPromoted(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/** Current fact without advancing the cycle. */
export function peekLoaderFact(): LoaderFact | null {
  const state = readState();
  if (!state || state.current.length === 0) return null;
  return state.current[state.order[state.index % state.order.length]] ?? null;
}

/**
 * Advances the per-session cycle and returns the next fact. The 10 in-use
 * facts are consumed one by one, in a shuffled order, before repeating.
 */
export function nextLoaderFact(): LoaderFact | null {
  const state = readState();
  if (!state || state.current.length === 0) return null;

  const nextIndex = (state.index + 1) % state.order.length;
  let fact = state.current[state.order[nextIndex]];
  if (fact && fact.id === state.lastShownId && state.current.length > 1) {
    const reroll = (nextIndex + 1) % state.order.length;
    fact = state.current[state.order[reroll]];
    state.index = reroll;
  } else {
    state.index = nextIndex;
  }
  state.lastShownId = fact?.id;
  writeState(state);
  return fact ?? null;
}

export function subscribeLoaderFacts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test/debug helper — also used by the admin portal's "reset preview" tool. */
export function resetLoaderFacts(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  bootstrapped = null;
  notify();
}
