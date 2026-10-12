'use client';

import { requireSession } from '@/lib/auth';
import Link from 'next/link';
import { getContentQueue, updateContentExercise, updateContentArticle, approveContent, rejectContent } from '@/lib/contentApi';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Th, Tr, Td, EmptyRow } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatDateIST } from '@/lib/dateFormat';
import { highlightLines, lineCountDiffers } from '@/lib/highlight';

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; lang?: string; status?: string }>;
}) {
  await requireSession();
  const params = await searchParams;

  const languageTabs = ['en', 'hinglish', 'hi'];

  // Load all languages in parallel, collect results or errors
  const languagePromises = languageTabs.map(async (lang) => {
    try {
      const response = await getContentQueue(params.type as 'exercise' | 'article' | undefined, lang, params.status as 'rejected' | 'pending' | 'approved' | undefined);
      return { lang, success: true, items: response.data?.items || [] };
    } catch (err) {
      return { lang, success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  const languageResults = await Promise.allSettled(languagePromises);

  // Build per-language state
  const languageState = ['en', 'hinglish', 'hi'].map((lang, i) => {
    const result = languageResults[i];
    if (result.status === 'rejected') {
      return {
        lang,
        items: [],
        total: 0,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        failed: true,
      };
    }
    if (result.status === 'fulfilled' && result.value.success) {
      return {
        lang,
        items: result.value.items || [],
        total: result.value.items?.length || 0,
        error: null,
        failed: false,
      };
    }
    return {
      lang,
      items: [],
      total: 0,
      error: 'Unknown error',
      failed: true,
    };
  });

  // Check if all calls failed
  const allFailed = languageState.every((ls) => ls.failed);

  // Handle empty state
  const anyHasItems = languageState.some((ls) => ls.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Content review queue"
        subtitle="Pending reviews for exercise and article content. Filter by language and status."
      />

      <div className="flex gap-4 mb-6">
        <a
          href="?type=exercise&lang=en&status=pending"
          className="rounded px-3 py-1 text-sm font-medium bg-emerald-600 text-white"
        >
          Exercises
        </a>
        <a
          href="?type=article&lang=en&status=pending"
          className="rounded px-3 py-1 text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
        >
          Articles
        </a>
        <Link
          href="/?type=exercise"
          className="rounded px-3 py-1 text-sm font-medium"
        >
          All languages
        </Link>
        {['en', 'hinglish', 'hi'].map((lt) => (
          <a
            key={lt}
            href={`?lang=${lt}`}
            className="rounded px-3 py-1 text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
          >
            {lt === 'en' ? 'English' : lt === 'hinglish' ? 'Hinglish' : 'Hindi'}
          </a>
        ))}
        <Link
          href="/content?status=all"
          className="rounded px-3 py-1 text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
        >
          All
        </Link>
      </div>

      {/* Language-specific queues with error states */}
      {languageState.map((ls) => (
        <Card key={ls.lang} className="mb-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">{ls.lang.toUpperCase()} — {ls.total} pending</h3>
            {ls.failed && (
              <span className="text-sm text-red-600">—</span>
            )}
          </div>

          {ls.failed ? (
            <p className="text-sm text-red-500 dark:text-red-400">{ls.error}</p>
          ) : ls.items.length === 0 ? (
            <EmptyRow colSpan={7}>
              {ls.lang === 'en'
                ? 'Nothing waiting for review'
                : ls.lang === 'hinglish'
                  ? 'No pending reviews for this language'
                  : 'कोई pending समीक्षा nahi'}
            </EmptyRow>
          ) : (
            <Table>
              <Thead>
                <Th>Type</Th>
                <Th>Language</Th>
                <Th>Master</Th>
                <Th>Version</Th>
                <Th>Reviewed By</Th>
                <Th>Updated At</Th>
                <Th>Actions</Th>
              </Thead>
              <tbody>
                {ls.items.map((item, idx) => {
                  if (item.type === 'exercise') {
                    return (
                      <Tr key={item.id} className="border-b dark:border-gray-700">
                        <Td>{item.type}</Td>
                        <Td>{item.lang}</Td>
                        <Td>{item.master && item.master.reviewStatus ? item.master.reviewStatus : '—'}</Td>
                        <Td>{item.version}</Td>
                        <Td>{item.master && item.master.reviewedBy ? item.master.reviewedBy : '—'}</Td>
                        <Td>{formatDateIST(item.updatedAt)}</Td>
                        <Td className="flex flex-wrap gap-2">
                          <ActionForm action={approveContent}>
                            <input type="hidden" name="type" value="exercise" />
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="version" value={item.version} />
                            <SubmitButton variant="secondary" pendingText="…">
                              Approve
                            </SubmitButton>
                          </ActionForm>
                          <ActionForm action={rejectContent}>
                            <input type="hidden" name="type" value="exercise" />
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="version" value={item.version} />
                            <SubmitButton variant="danger" pendingText="…">
                              Reject
                            </SubmitButton>
                          </ActionForm>
                        </Td>
                      </Tr>
                    );
                  }
                  if (item.type === 'article') {
                    return (
                      <Tr key={item.id} className="border-b dark.border-gray-700">
                        <Td>{item.type}</Td>
                        <Td>{item.lang}</Td>
                        <Td>{item.master && item.master.title ? item.master.title : '—'}</Td>
                        <Td>{item.version}</Td>
                        <Td>{item.master && item.master.reviewedBy ? item.master.reviewedBy : '—'}</Td>
                        <Td>{formatDateIST(item.updatedAt)}</Td>
                        <Td className="flex flex-wrap gap-2">
                          <ActionForm action={approveContent}>
                            <input type="hidden" name="type" value="article" />
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="version" value={item.version} />
                            <SubmitButton variant="secondary" pendingText="…">
                              Approve
                            </SubmitButton>
                          </ActionForm>
                          <ActionForm action={rejectContent}>
                            <input type="hidden" name="type" value="article" />
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="version" value={item.version} />
                            <SubmitButton variant="danger" pendingText="…">
                              Reject
                            </SubmitButton>
                          </ActionForm>
                        </Td>
                      </Tr>
                    );
                  }
                  return null;
                })}
                {ls.items.length === 0 && (
                  <EmptyRow colSpan={7}>
                    {ls.lang === 'en'
                      ? 'Nothing waiting for review'
                      : ls.lang === 'hinglish'
                        ? 'No pending reviews for this language'
                        : 'कोई pending समीक्षा nahi'}
                  </EmptyRow>
                )}
              </tbody>
            </Table>
          )}
        </Card>
      ))}

      {/* Empty state when all languages have no items */}
      {allFailed || (!anyHasItems && languageState.every((ls) => ls.failed)) && (
        <Card className="border-red-300 text-sm text-red-600 dark.text-red-400">
          <p>Could not load content queue. Please retry.</p>
        </Card>
      )}

      {/* Edit modal / inline edit section */}
      {!allFailed && (
        <Card className="mt-6 max-w-2xl">
          <h3 className="text-lg font-medium">Inline edit</h3>
          <p className="text-sm text-gray-500">
            Select an item above and click Edit to modify steps/feelCues/mistakes (exercise)
            or title/body (article). Changes reset the item to pending and increment version.
          </p>
        </Card>
      )}
    </div>
  );
}