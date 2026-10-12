import { gatewayFetch, gatewayJson } from './api';
import {
  buildQueueQuery,
  editPayload,
  type ArticleEdit,
  type ContentLang,
  type ContentStatus,
  type ContentType,
  type ExerciseEdit,
  type QueueFilters,
} from '@/app/content/contentDisplay';

// Server-only typed access to health-service's coach-content review surface
// (B15 contract). Client components must NOT import this module at runtime -
// it pulls in `next/headers` through lib/api. They take types with
// `import type` and the helpers from app/content/contentDisplay.ts instead.

interface ContentRowBase {
  id: number;
  lang: ContentLang;
  reviewStatus: ContentStatus;
  version: number;
  reviewedBy: number | null;
  approvedAt: string | null;
  updatedAt: string;
}

export interface ExerciseContentRow extends ContentRowBase {
  exerciseId: number;
  steps: string[];
  feelCues: string[];
  mistakes: string[];
}

export interface ArticleContentRow extends ContentRowBase {
  slug: string;
  kind: string;
  title: string;
  body: string;
}

export interface ExerciseQueueItem extends ExerciseContentRow {
  type: 'exercise';
  exerciseName: string | null;
  // Present (possibly null) on every non-English row.
  master?: ExerciseContentRow | null;
}

export interface ArticleQueueItem extends ArticleContentRow {
  type: 'article';
  master?: ArticleContentRow | null;
}

export type ContentQueueItem = ExerciseQueueItem | ArticleQueueItem;

export interface ContentQueue {
  items: ContentQueueItem[];
  total: number;
}

/// A gateway failure that keeps the backend's `code` (gatewayJson keeps only
/// the message), so a 409 CONTENT_CHANGED can be told apart from other errors.
export class ContentApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'ContentApiError';
  }
}

async function mutate<T>(method: 'PUT' | 'POST', path: string, body: unknown): Promise<T> {
  const res = await gatewayFetch(path, { method, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string; code?: string };
  if (!res.ok) {
    throw new ContentApiError(json?.error || `Request failed (${res.status})`, res.status, json?.code ?? null);
  }
  return (json?.data ?? json) as T;
}

export async function fetchContentQueue(filters: Partial<QueueFilters>): Promise<ContentQueue> {
  const query = buildQueueQuery(filters);
  const body = await gatewayJson<{ data?: Partial<ContentQueue> } | Partial<ContentQueue>>(
    `/api/health/content/admin/queue${query ? `?${query}` : ''}`,
  );
  const data = ((body as { data?: Partial<ContentQueue> })?.data ?? body) as Partial<ContentQueue>;
  const items = Array.isArray(data?.items) ? data.items : [];
  return { items, total: typeof data?.total === 'number' ? data.total : items.length };
}

/// Pending count for one language across both content types.
export async function fetchPendingCount(lang: ContentLang): Promise<number> {
  const queue = await fetchContentQueue({ lang, status: 'pending' });
  return queue.total;
}

export async function editContent(
  type: ContentType,
  id: number,
  input: ExerciseEdit | ArticleEdit,
): Promise<ExerciseContentRow | ArticleContentRow> {
  const path =
    type === 'exercise'
      ? `/api/health/content/admin/exercises/${id}`
      : `/api/health/content/admin/articles/${id}`;
  return mutate('PUT', path, editPayload(type, input as Record<string, unknown>));
}

export async function reviewContent(
  type: ContentType,
  id: number,
  decision: 'approve' | 'reject',
  version: number,
): Promise<ExerciseContentRow | ArticleContentRow> {
  return mutate('POST', `/api/health/content/admin/${type}/${id}/${decision}`, { version });
}
