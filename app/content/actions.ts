'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { ContentApiError, editContent, reviewContent } from '@/lib/contentApi';
import { CONTENT_CHANGED_MESSAGE, isContentType, type ContentType } from './contentDisplay';

const CONTENT_PATH = '/content';

export interface ContentActionResult {
  ok: boolean;
  message: string;
  // Set when the row changed under the reviewer (409 CONTENT_CHANGED); the
  // client refreshes so the new version is what they review next.
  reload?: boolean;
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function failure(err: unknown): ContentActionResult {
  if (err instanceof ContentApiError && err.code === 'CONTENT_CHANGED') {
    revalidatePath(CONTENT_PATH);
    return { ok: false, message: CONTENT_CHANGED_MESSAGE, reload: true };
  }
  return { ok: false, message: err instanceof Error ? err.message : 'Something went wrong' };
}

export async function reviewContentAction(input: {
  type: ContentType;
  id: number;
  decision: 'approve' | 'reject';
  version: number;
}): Promise<ContentActionResult> {
  await requireSession();
  const id = positiveInt(input?.id);
  const version = positiveInt(input?.version);
  if (!isContentType(input?.type) || id == null) return { ok: false, message: 'Missing content id' };
  if (input.decision !== 'approve' && input.decision !== 'reject') {
    return { ok: false, message: 'Pick approve or reject' };
  }
  if (version == null) return { ok: false, message: 'Missing version' };

  try {
    // The version the reviewer is looking at travels with the decision, so an
    // edit made in between turns into a 409 instead of approving unseen text.
    await reviewContent(input.type, id, input.decision, version);
  } catch (err) {
    return failure(err);
  }
  revalidatePath(CONTENT_PATH);
  return { ok: true, message: input.decision === 'approve' ? 'Approved' : 'Rejected' };
}

export async function editContentAction(input: {
  type: ContentType;
  id: number;
  fields: Record<string, unknown>;
}): Promise<ContentActionResult> {
  await requireSession();
  const id = positiveInt(input?.id);
  if (!isContentType(input?.type) || id == null) return { ok: false, message: 'Missing content id' };

  let version: number | undefined;
  try {
    const row = await editContent(input.type, id, input.fields ?? {});
    version = typeof row?.version === 'number' ? row.version : undefined;
  } catch (err) {
    return failure(err);
  }
  revalidatePath(CONTENT_PATH);
  return {
    ok: true,
    message: version != null ? `Back to pending — version ${version}` : 'Back to pending',
  };
}
