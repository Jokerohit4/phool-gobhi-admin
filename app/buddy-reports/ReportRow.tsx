'use client';

import { Fragment, useState, useTransition } from 'react';
import { Td, Tr } from '@/components/ui/Table';
import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatDateTimeIST } from '@/lib/dateFormat';
import type { BuddyMessage, BuddyReport } from '@/lib/buddyApi';
import {
  isHighSeverity,
  photoUrl,
  reportPartLabel,
  reportReasonLabel,
  REPORT_STATUS_LABELS,
} from './reportDisplay';
import {
  actionReportAction,
  dismissReportAction,
  loadReportContextAction,
  releaseHoldAction,
  reinstateAction,
  suspendReportAction,
} from './actions';

export function ReportRow({ report }: { report: BuddyReport }) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<BuddyMessage[] | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  const reportedUserId = report.reportedUser?.userId ?? null;
  const photos = (report.reportedUser?.photos ?? [])
    .map(photoUrl)
    .filter((url): url is string => Boolean(url));

  function toggleContext() {
    const next = !expanded;
    setExpanded(next);
    if (next && messages === null && !loading) {
      startTransition(async () => {
        try {
          setMessages(await loadReportContextAction(report.id));
        } catch (err) {
          setContextError(err instanceof Error ? err.message : 'Could not load the chat');
        }
      });
    }
  }

  function speaker(fromUserId: number): string {
    if (fromUserId === report.reporter.userId) return reportPartLabel(report.reporter);
    if (fromUserId === report.reportedUser?.userId) return reportPartLabel(report.reportedUser);
    return `#${fromUserId}`;
  }

  return (
    <Fragment>
      <Tr>
        <Td>
          <div className="flex flex-col gap-1">
            <span className="inline-block w-fit rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {REPORT_STATUS_LABELS[report.status] ?? report.status}
            </span>
            {isHighSeverity(report) && (
              <span className="inline-block w-fit rounded px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                High
              </span>
            )}
          </div>
        </Td>

        <Td className="max-w-xs">
          <p className="font-medium">{reportReasonLabel(report.reason)}</p>
          {report.details && (
            <p className="mt-1 whitespace-pre-wrap text-xs text-gray-500 dark:text-gray-400">
              {report.details}
            </p>
          )}
        </Td>

        <Td>
          <p className="text-xs text-gray-500 dark:text-gray-400">Reporter</p>
          <p className="font-medium">{reportPartLabel(report.reporter)}</p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Reported</p>
          <p className="font-medium">{reportPartLabel(report.reportedUser)}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {report.priorReportCount > 0 && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {report.priorReportCount} prior report{report.priorReportCount === 1 ? '' : 's'}
              </span>
            )}
            {report.genderChanged && (
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                Gender changed
              </span>
            )}
          </div>
        </Td>

        <Td>
          {report.reportedUser?.erased ? (
            <span className="text-xs text-gray-500 dark:text-gray-400">&mdash;</span>
          ) : (
            <div className="flex flex-col gap-2">
              {report.reportedUser?.bio && (
                <p className="max-w-xs whitespace-pre-wrap text-xs">{report.reportedUser.bio}</p>
              )}
              {photos.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {photos.slice(0, 6).map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`${url}-${i}`}
                      src={url}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  ))}
                </div>
              ) : (
                <span className="text-xs text-gray-500 dark:text-gray-400">No photos</span>
              )}
            </div>
          )}
        </Td>

        <Td className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
          {formatDateTimeIST(report.createdAt)}
        </Td>

        <Td>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <ActionForm action={dismissReportAction}>
                <input type="hidden" name="id" value={report.id} />
                <SubmitButton variant="secondary" pendingText="…">
                  Dismiss
                </SubmitButton>
              </ActionForm>
              <ActionForm action={actionReportAction}>
                <input type="hidden" name="id" value={report.id} />
                <SubmitButton variant="secondary" pendingText="…">
                  Actioned
                </SubmitButton>
              </ActionForm>
              <ActionForm
                action={suspendReportAction}
                confirmMessage="Suspend this user? Every active match on both sides ends immediately."
              >
                <input type="hidden" name="id" value={report.id} />
                <SubmitButton variant="danger" pendingText="…">
                  Actioned + Suspend
                </SubmitButton>
              </ActionForm>
            </div>
            {reportedUserId != null && (
              <div className="flex flex-wrap gap-2">
                <ActionForm action={releaseHoldAction}>
                  <input type="hidden" name="userId" value={reportedUserId} />
                  <SubmitButton variant="secondary" pendingText="…">
                    Release hold
                  </SubmitButton>
                </ActionForm>
                <ActionForm
                  action={reinstateAction}
                  confirmMessage="Reinstate this user? Their deck returns; old chats stay closed."
                >
                  <input type="hidden" name="userId" value={reportedUserId} />
                  <SubmitButton variant="secondary" pendingText="…">
                    Reinstate
                  </SubmitButton>
                </ActionForm>
              </div>
            )}
            <button
              type="button"
              onClick={toggleContext}
              className="w-fit text-left text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              {expanded ? 'Hide chat' : 'Show last 20 messages'}
            </button>
          </div>
        </Td>
      </Tr>

      {expanded && (
        <Tr>
          <Td colSpan={6} className="bg-gray-50 dark:bg-gray-900">
            {loading && <p className="text-xs text-gray-500 dark:text-gray-400">Loading chat…</p>}
            {contextError && <p className="text-xs text-red-600">{contextError}</p>}
            {!loading && !contextError && messages !== null && messages.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No chat between these users (the report came from the deck).
              </p>
            )}
            {!loading && !contextError && messages && messages.length > 0 && (
              <ul className="flex flex-col gap-2">
                {messages.map((m, i) => (
                  <li key={`${m.createdAt}-${i}`} className="text-xs">
                    <span className="font-medium">{speaker(m.fromUserId)}</span>
                    <span className="ml-2 text-gray-400">{formatDateTimeIST(m.createdAt)}</span>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Td>
        </Tr>
      )}
    </Fragment>
  );
}
