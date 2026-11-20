import Link from 'next/link';
import type { ReactNode } from 'react';

export function InlineError({
  title = 'Could not load this section',
  message,
  retryHref,
  retryLabel = 'Try again',
  children,
}: {
  title?: string;
  message?: string;
  retryHref?: string;
  retryLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div role="alert" className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-medium">{title}</p>
      {message && <p className="mt-1 text-amber-800 dark:text-amber-300">{message}</p>}
      {children}
      {retryHref && (
        <Link href={retryHref} className="mt-3 inline-block underline">
          {retryLabel}
        </Link>
      )}
    </div>
  );
}
