import { gatewayJson } from './api';

export interface ContentItem {
  type: 'exercise' | 'article';
  id: string;
  lang: 'en' | 'hinglish' | 'hi';
  reviewStatus: 'pending' | 'approved' | 'rejected';
  version: number;
  reviewedBy: string | null;
  approvedAt: string | null;
  updatedAt: string;
}

export interface ExerciseItem extends ContentItem {
  type: 'exercise';
  exerciseId: string;
  exerciseName: string;
  steps: string[];
  feelCues: string[];
  mistakes: string[];
}

export interface ArticleItem extends ContentItem {
  type: 'article';
  slug: string;
  kind: string;
  title: string;
  body: string;
}

export interface MasterRow {
  id: string;
  lang: 'en';
  reviewStatus: 'pending' | 'approved' | 'rejected';
  version: number;
  reviewedBy: string | null;
  approvedAt: string | null;
  updatedAt: string;
  steps?: string[];
  feelCues?: string[];
  mistakes?: string[];
  slug?: string;
  kind?: string;
  title?: string;
  body?: string;
}

export interface ContentQueueResponse {
  data: {
    items: (ExerciseItem | ArticleItem & { master?: MasterRow })[];
    total: number;
  };
}

export async function getContentQueue(
  type?: 'exercise' | 'article',
  lang?: 'en' | 'hinglish' | 'hi',
  status?: 'pending' | 'approved' | 'rejected'
): Promise<ContentQueueResponse> {
  return gatewayJson<ContentQueueResponse>(
    `/api/health/content/admin/queue?type=${type ?? ''}&lang=${lang ?? ''}&status=${status ?? ''}`
  );
}

export async function updateContentExercise(
  id: string,
  steps?: string[],
  feelCues?: string[],
  mistakes?: string[]
): Promise<ExerciseItem> {
  return gatewayJson<ExerciseItem>(
    `/api/health/content/admin/exercises/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify({ steps, feelCues, mistakes }),
    }
  );
}

export async function updateContentArticle(
  id: string,
  title?: string,
  body?: string
): Promise<ArticleItem> {
  return gatewayJson<ArticleItem>(
    `/api/health/content/admin/articles/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify({ title, body }),
    }
  );
}

export async function approveContent(
  type: 'exercise' | 'article',
  id: string,
  version: number
): Promise<ExerciseItem | ArticleItem> {
  return gatewayJson<
    ExerciseItem | ArticleItem
  >(`/api/health/content/admin/${type}/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
}

export async function rejectContent(
  type: 'exercise' | 'article',
  id: string,
  version: number
): Promise<ExerciseItem | ArticleItem> {
  return gatewayJson<
    ExerciseItem | ArticleItem
  >(`/api/health/content/admin/${type}/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
}