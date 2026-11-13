'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDateTimeIST } from '@/lib/dateFormat';
import type { ArticleQueueItem, ContentQueueItem, ExerciseQueueItem } from '@/lib/contentApi';
import { editContentAction, reviewContentAction, type ContentActionResult } from './actions';
import {
  bodyParagraphs,
  EXERCISE_FIELD_LABELS,
  EXERCISE_LIST_FIELDS,
  isSafetyLine,
  LANG_LABELS,
  lineCountDiffers,
  linesToText,
  STATUS_LABELS,
  textToLines,
  type ExerciseListField,
} from './contentDisplay';

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

function Line({ text }: { text: string | undefined }) {
  if (text === undefined) {
    return <span className="text-xs italic text-gray-400">(no line)</span>;
  }
  const flagged = isSafetyLine(text);
  return (
    <span
      className={
        flagged
          ? 'block rounded bg-yellow-100 px-1 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200'
          : 'block'
      }
      title={flagged ? 'Safety line — check it carefully' : undefined}
    >
      {text}
    </span>
  );
}

function CountBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
      line count differs
    </span>
  );
}

/// Translation next to its English master, one row per line index, so a
/// dropped or merged line shows up as an empty cell.
function SideBySide({
  label,
  master,
  translation,
  langLabel,
}: {
  label: string;
  master: readonly string[];
  translation: readonly string[];
  langLabel: string;
}) {
  const rows = Math.max(master.length, translation.length);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium">{label}</h4>
        <CountBadge show={lineCountDiffers(translation, master)} />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {master.length} English · {translation.length} {langLabel}
        </span>
      </div>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
            <th className="w-8 py-1">#</th>
            <th className="py-1">English</th>
            <th className="py-1">{langLabel}</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i} className="border-t align-top dark:border-gray-800">
              <td className="py-1 text-xs text-gray-400">{i + 1}</td>
              <td className="py-1 pr-3">
                <Line text={master[i]} />
              </td>
              <td className="py-1">
                <Line text={translation[i]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BulletList({ label, lines }: { label: string; lines: readonly string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-sm font-medium">{label}</h4>
      {lines.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">None</p>
      ) : (
        <ul className="ml-5 list-disc text-sm">
          {lines.map((line, i) => (
            <li key={i}>
              <Line text={line} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExerciseBody({ item }: { item: ExerciseQueueItem }) {
  const isTranslation = item.lang !== 'en';
  const master = item.master ?? null;
  return (
    <div className="flex flex-col gap-4">
      {isTranslation && !master && (
        <p className="text-xs text-red-600">No English master for this exercise yet.</p>
      )}
      {EXERCISE_LIST_FIELDS.map((field) =>
        isTranslation && master ? (
          <SideBySide
            key={field}
            label={EXERCISE_FIELD_LABELS[field]}
            master={master[field] ?? []}
            translation={item[field] ?? []}
            langLabel={LANG_LABELS[item.lang]}
          />
        ) : (
          <BulletList key={field} label={EXERCISE_FIELD_LABELS[field]} lines={item[field] ?? []} />
        ),
      )}
    </div>
  );
}

function ArticleBody({ item }: { item: ArticleQueueItem }) {
  const isTranslation = item.lang !== 'en';
  const master = item.master ?? null;
  const paragraphs = bodyParagraphs(item.body);
  if (isTranslation && master) {
    return (
      <div className="flex flex-col gap-4">
        <SideBySide
          label="Title"
          master={[master.title]}
          translation={[item.title]}
          langLabel={LANG_LABELS[item.lang]}
        />
        <SideBySide
          label="Body (paragraphs)"
          master={bodyParagraphs(master.body)}
          translation={paragraphs}
          langLabel={LANG_LABELS[item.lang]}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {isTranslation && !master && (
        <p className="text-xs text-red-600">No English master for this article yet.</p>
      )}
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap text-sm">
          <Line text={p} />
        </p>
      ))}
    </div>
  );
}

function EditForm({
  item,
  busy,
  onCancel,
  onSave,
}: {
  item: ContentQueueItem;
  busy: boolean;
  onCancel: () => void;
  onSave: (fields: Record<string, unknown>) => void;
}) {
  const [lists, setLists] = useState<Record<ExerciseListField, string>>(() => ({
    steps: item.type === 'exercise' ? linesToText(item.steps) : '',
    feelCues: item.type === 'exercise' ? linesToText(item.feelCues) : '',
    mistakes: item.type === 'exercise' ? linesToText(item.mistakes) : '',
  }));
  const [title, setTitle] = useState(item.type === 'article' ? item.title : '');
  const [body, setBody] = useState(item.type === 'article' ? item.body : '');

  function submit() {
    if (item.type === 'exercise') {
      onSave({
        steps: textToLines(lists.steps),
        feelCues: textToLines(lists.feelCues),
        mistakes: textToLines(lists.mistakes),
      });
    } else {
      onSave({ title, body });
    }
  }

  const inputClass =
    'w-full rounded border px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950';

  return (
    <div className="flex flex-col gap-3">
      {item.type === 'exercise' ? (
        EXERCISE_LIST_FIELDS.map((field) => (
          <label key={field} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {EXERCISE_FIELD_LABELS[field]}{' '}
              <span className="text-xs font-normal text-gray-500">(one item per line)</span>
            </span>
            <textarea
              className={inputClass}
              rows={Math.max(3, textToLines(lists[field]).length + 1)}
              value={lists[field]}
              onChange={(e) => setLists((prev) => ({ ...prev, [field]: e.target.value }))}
              disabled={busy}
            />
          </label>
        ))
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Title</span>
            <input
              className={inputClass}
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              Body <span className="text-xs font-normal text-gray-500">(blank line between paragraphs)</span>
            </span>
            <textarea
              className={inputClass}
              rows={12}
              value={body}
              maxLength={20000}
              onChange={(e) => setBody(e.target.value)}
              disabled={busy}
            />
          </label>
        </>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Saving sends this item back to pending as a new version.
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function ContentItem({ item }: { item: ContentQueueItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<ContentActionResult | null>(null);
  const [busy, startTransition] = useTransition();

  function handle(work: () => Promise<ContentActionResult>, onOk?: () => void) {
    setResult(null);
    startTransition(async () => {
      let res: ContentActionResult;
      try {
        res = await work();
      } catch (err) {
        res = { ok: false, message: err instanceof Error ? err.message : 'Something went wrong' };
      }
      setResult(res);
      if (res.ok) onOk?.();
      if (res.reload) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function review(decision: 'approve' | 'reject') {
    // `item.version` is the version on screen — the one the reviewer read.
    handle(() => reviewContentAction({ type: item.type, id: item.id, decision, version: item.version }));
  }

  function save(fields: Record<string, unknown>) {
    handle(
      () => editContentAction({ type: item.type, id: item.id, fields }),
      () => setEditing(false),
    );
  }

  const heading =
    item.type === 'exercise' ? item.exerciseName ?? `Exercise #${item.exerciseId}` : item.title;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium uppercase text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {item.type}
            </span>
            <h3 className="font-semibold">{heading}</h3>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {LANG_LABELS[item.lang] ?? item.lang} · version {item.version}
            {item.type === 'article' && ` · ${item.kind} · ${item.slug}`}
            {' · updated '}
            {formatDateTimeIST(item.updatedAt)}
          </p>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[item.reviewStatus] ?? ''}`}
        >
          {STATUS_LABELS[item.reviewStatus] ?? item.reviewStatus}
        </span>
      </div>

      {editing ? (
        <EditForm item={item} busy={busy} onCancel={() => setEditing(false)} onSave={save} />
      ) : item.type === 'exercise' ? (
        <ExerciseBody item={item} />
      ) : (
        <ArticleBody item={item} />
      )}

      {!editing && (
        <div className="flex flex-wrap gap-2">
          {item.reviewStatus !== 'approved' && (
            <Button type="button" onClick={() => review('approve')} disabled={busy}>
              {busy ? '…' : `Approve v${item.version}`}
            </Button>
          )}
          {item.reviewStatus !== 'rejected' && (
            <Button type="button" variant="danger" onClick={() => review('reject')} disabled={busy}>
              {busy ? '…' : 'Reject'}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setResult(null);
              setEditing(true);
            }}
            disabled={busy}
          >
            Edit
          </Button>
        </div>
      )}

      {result && (
        <p className={`text-sm ${result.ok ? 'text-emerald-600' : 'text-red-600'}`}>{result.message}</p>
      )}
    </Card>
  );
}
